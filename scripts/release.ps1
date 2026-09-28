# ============================================================
# Not Blind 一键发布：打包 → 推源码 → 建 GitHub Release → 上传安装包
# 由「发布新版本.bat」调用。版本号取 package.json 的 version。
# 可以重复运行：已经做完的步骤会自动跳过（比如上传到一半断网，再点一次就行）。
# ============================================================
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# 统一用不带 BOM 的 UTF-8：bat 里 chcp 65001 之后，默认编码会在发给 git 的输入前面加 BOM，
# git 读不懂（第一次运行时 git credential 就是因为这个报 missing protocol field）
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
try { [Console]::OutputEncoding = $Utf8NoBom } catch { }
try { [Console]::InputEncoding = $Utf8NoBom } catch { }
$OutputEncoding = $Utf8NoBom

$Owner = 'fjzh632346-cmd'
$Repo = 'NotBlind'
$Branch = 'main'
$Src = Split-Path -Parent $PSScriptRoot
$RepoUrl = "https://github.com/$Owner/$Repo.git"
$Api = "https://api.github.com/repos/$Owner/$Repo"
$GitName = 'fjzh632346-cmd'
$GitEmail = 'fjzh632346-cmd@users.noreply.github.com'

$LogDir = Join-Path $Src '_release_logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ('release-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
try { Start-Transcript -Path $LogFile -Force | Out-Null } catch { }

function Step($n, $text) { Write-Host ''; Write-Host "[$n/7] $text" -ForegroundColor Cyan }
function Info($text) { Write-Host "      $text" }
function Ok($text) { Write-Host "      $text" -ForegroundColor Green }
function Warn($text) { Write-Host "      $text" -ForegroundColor Yellow }
function Fail($text) {
  Write-Host ''
  Write-Host "  × $text" -ForegroundColor Red
  Write-Host "  日志：$LogFile" -ForegroundColor DarkGray
  try { Stop-Transcript | Out-Null } catch { }
  exit 1
}

# 运行外部命令，输出进日志；返回退出码
function Run($exe, [string[]]$argList) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $exe @argList 2>&1 | ForEach-Object { "$_" } | Out-Host
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $old
  }
}
# 运行外部命令，拿回文本输出（不打印）
function Capture($exe, [string[]]$argList) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & $exe @argList 2>$null
    return ($out | Out-String).Trim()
  } finally {
    $ErrorActionPreference = $old
  }
}

Write-Host '============================================' -ForegroundColor DarkCyan
Write-Host '  Not Blind 一键发布' -ForegroundColor White
Write-Host '============================================' -ForegroundColor DarkCyan

# ---------- 1. 检查 ----------
Step 1 '检查版本号和工具'
$pkg = Get-Content (Join-Path $Src 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$Version = [string]$pkg.version
if (-not $Version) { Fail 'package.json 里没有版本号' }
$Tag = "v$Version"
Info "要发布的版本：$Tag"

foreach ($tool in @('node', 'npm', 'git')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    if ($tool -eq 'git' -and (Get-Command winget -ErrorAction SilentlyContinue)) {
      Warn '没找到 git，正在自动安装（可能弹出确认窗口）……'
      Run 'winget' @('install', '--id', 'Git.Git', '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements') | Out-Null
      $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
      if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'git 安装后仍找不到，请重启电脑后再点一次' }
    } else {
      Fail "没找到 $tool，请先安装后再点一次"
    }
  }
}
Ok '工具齐全'

# 系统代理（开了梯子时让 git / npm 也走它）
$GitProxyArgs = @()
try {
  $sysProxy = [System.Net.WebRequest]::GetSystemWebProxy().GetProxy([Uri]'https://github.com')
  if ($sysProxy -and $sysProxy.Host -ne 'github.com') {
    $proxyUrl = $sysProxy.AbsoluteUri.TrimEnd('/')
    $GitProxyArgs = @('-c', "http.proxy=$proxyUrl")
    $env:npm_config_https_proxy = $proxyUrl
    $env:npm_config_proxy = $proxyUrl
    Info "检测到系统代理 $proxyUrl，git / npm 会走它"
  }
} catch { }
function GitRun([string[]]$argList) { return Run 'git' (@('-C', $Src, '-c', 'core.quotepath=false') + $GitProxyArgs + $argList) }
function GitOut([string[]]$argList) { return Capture 'git' (@('-C', $Src, '-c', 'core.quotepath=false') + $GitProxyArgs + $argList) }

# ---------- 2. GitHub 登录 ----------
Step 2 '获取 GitHub 权限'
$TokenFile = Join-Path $env:APPDATA 'NotBlind-release\github-token.xml'
function Test-Token($t) {
  if (-not $t) { return $false }
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 -Uri 'https://api.github.com/user' -Headers @{ Authorization = "token $t"; 'User-Agent' = 'NotBlind-release' }
  } catch {
    $resp = $_.Exception.Response
    if ($resp -and [int]$resp.StatusCode -eq 401) { return $false }
    Fail ('连不上 GitHub：' + $_.Exception.Message + '（开梯子后再点一次）')
  }
  $scopes = [string]$r.Headers['X-OAuth-Scopes']
  $login = ($r.Content | ConvertFrom-Json).login
  if ($login -ne $Owner) { Warn "这个登录是 $login，不是 $Owner"; return $false }
  # 细粒度令牌没有 scopes 头，直接放行，后面真操作失败会报出来
  if ($scopes -and ($scopes -notmatch '(^|,\s*)(public_)?repo(\s*,|$)')) { Warn "权限不够（$scopes）"; return $false }
  return $true
}
$Token = $null
if (Test-Path $TokenFile) {
  try {
    $sec = Import-Clixml $TokenFile
    $Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if (-not (Test-Token $Token)) { $Token = $null }
  } catch { $Token = $null }
}
if (-not $Token) {
  # 借用 git 已保存的 GitHub 登录（没登录过会弹出浏览器登录）
  Info '读取 git 保存的 GitHub 登录（没登录过会弹出登录窗口）……'
  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = (Get-Command git).Source
    $psi.Arguments = 'credential fill'
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = $Utf8NoBom
    $psi.EnvironmentVariables['GIT_TERMINAL_PROMPT'] = '0'
    $proc = [System.Diagnostics.Process]::Start($psi)
    # 直接写字节，保证前面没有 BOM
    $bytes = [Text.Encoding]::ASCII.GetBytes("protocol=https`nhost=github.com`n`n")
    $proc.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
    $proc.StandardInput.BaseStream.Flush()
    $proc.StandardInput.Close()
    $credOut = $proc.StandardOutput.ReadToEnd()
    $credErr = $proc.StandardError.ReadToEnd()
    [void]$proc.WaitForExit(300000)
    foreach ($line in ($credOut -split "`r?`n")) { if ($line -like 'password=*') { $Token = $line.Substring(9).Trim() } }
    if (-not $Token -and $credErr) { Warn ('git 没给出登录：' + $credErr.Trim()) }
  } catch {
    Warn ('读取 git 登录失败：' + $_.Exception.Message)
  }
  if ($Token -and -not (Test-Token $Token)) { $Token = $null }
  if ($Token) { Ok '用的是 git 里保存的 GitHub 登录' }
}
if (-not $Token) {
  Warn '需要一次性提供 GitHub 令牌（以后会记住，不用再输）。注意：不是 GitHub 密码！'
  Warn '  1. 浏览器会打开「New personal access token (classic)」页面（要求确认身份就按提示验证）'
  Warn '  2. Note 已填好、repo 已勾好，拉到最下面点绿色的 Generate token'
  Warn '  3. 复制新出现的 ghp_ 开头的那一长串，回到这个黑窗口，点右键粘贴（看不到字是正常的），回车'
  Start-Process 'https://github.com/settings/tokens/new?scopes=repo&description=NotBlind-release'
  for ($i = 1; $i -le 3 -and -not $Token; $i++) {
    $sec = Read-Host '粘贴令牌' -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
    if ($plain -notmatch '^(ghp_|github_pat_)') {
      Warn ("这不像令牌（令牌以 ghp_ 开头，长度 40 左右；刚才收到 " + $plain.Length + " 个字符）。不要输 GitHub 密码，再粘贴一次：")
      continue
    }
    if (Test-Token $plain) {
      $Token = $plain
      $sec = ConvertTo-SecureString $plain -AsPlainText -Force
      New-Item -ItemType Directory -Force -Path (Split-Path $TokenFile) | Out-Null
      $sec | Export-Clixml $TokenFile
      Ok '令牌已加密保存在本机，以后不用再输'
    } else {
      Warn '这个令牌 GitHub 不认（可能没复制全，或者没勾 repo），再粘贴一次：'
    }
  }
  if (-not $Token) { Fail '令牌三次都不对，稍后再点一次' }
}
Ok "已登录 $Owner"
$Headers = @{ Authorization = "token $Token"; 'User-Agent' = 'NotBlind-release'; Accept = 'application/vnd.github+json' }

function Api($method, $url, $body) {
  $params = @{ Method = $method; Uri = $url; Headers = $Headers; UseBasicParsing = $true }
  if ($null -ne $body) {
    $params.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 5))
    $params.ContentType = 'application/json; charset=utf-8'
  }
  return Invoke-RestMethod @params
}

# 已经发过并且带齐文件就直接结束
$releases = @(Api 'GET' "$Api/releases?per_page=30" $null)
$Release = $releases | Where-Object { $_.tag_name -eq $Tag } | Select-Object -First 1
$Needed = @("NotBlind-$Version-Setup.exe", "NotBlind-$Version-Setup.exe.blockmap", 'latest.yml')
if ($Release -and -not $Release.draft) {
  $have = @($Release.assets | Where-Object { $_.state -eq 'uploaded' } | ForEach-Object { $_.name })
  $missing = @($Needed | Where-Object { $have -notcontains $_ })
  if ($missing.Count -eq 0) {
    Ok "$Tag 已经发布过，文件齐全，不用再发。"
    Info "要发新版本，先让 Claude 把版本号改大。"
    try { Stop-Transcript | Out-Null } catch { }
    exit 0
  }
}

# ---------- 3. 装依赖 ----------
Step 3 '安装 / 更新依赖（npm install）'
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
Push-Location $Src
try {
  $code = Run 'npm' @('install', '--no-audit', '--no-fund')
  if ($code -ne 0) {
    Warn '默认源失败，改用国内镜像再试一次……'
    $code = Run 'npm' @('install', '--no-audit', '--no-fund', '--registry=https://registry.npmmirror.com')
  }
  if ($code -ne 0) { Fail 'npm install 失败' }
} finally { Pop-Location }
Ok '依赖就绪'

# ---------- 4. 打包 ----------
Step 4 "打包 $Tag（几分钟）"
$Dist = Join-Path $Src 'dist'
$Exe = Join-Path $Dist "NotBlind-$Version-Setup.exe"
$BlockMap = "$Exe.blockmap"
$Yml = Join-Path $Dist 'latest.yml'
foreach ($f in @($Exe, $BlockMap, $Yml)) { if (Test-Path $f) { Remove-Item $f -Force } }
Push-Location $Src
try {
  $code = Run 'npm' @('run', 'build:win')
} finally { Pop-Location }
if ($code -ne 0) { Fail '打包失败（详细原因在日志里，把日志给 Claude 看）' }
foreach ($f in @($Exe, $BlockMap, $Yml)) { if (-not (Test-Path $f)) { Fail "打包后缺文件：$f" } }
$ymlText = Get-Content $Yml -Raw -Encoding UTF8
if ($ymlText -notmatch "(?m)^version:\s*'?$([regex]::Escape($Version))'?\s*$") { Fail "latest.yml 里的版本号和 $Version 对不上" }
if ($ymlText -notmatch 'sha512:') { Fail 'latest.yml 里没有校验码' }
Ok ("打包完成：" + [math]::Round((Get-Item $Exe).Length / 1MB, 1) + ' MB')

# ---------- 5. 推源码 ----------
Step 5 '把源码推到 GitHub'
if (-not (Test-Path (Join-Path $Src '.git'))) {
  Info '第一次：把这个文件夹接到 GitHub 仓库上（只拿目录，不动你的文件）……'
  $tmp = Join-Path (Split-Path $Src) '_notblind_git_tmp'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  $code = Run 'git' ($GitProxyArgs + @('clone', '--no-checkout', '--filter=blob:none', '--branch', $Branch, $RepoUrl, $tmp))
  if ($code -ne 0) { Fail '连不上 GitHub（git clone 失败）' }
  Move-Item (Join-Path $tmp '.git') (Join-Path $Src '.git')
  Remove-Item $tmp -Recurse -Force
  $attr = (Get-Item (Join-Path $Src '.git') -Force)
  $attr.Attributes = $attr.Attributes -bor [IO.FileAttributes]::Hidden
}
GitRun @('config', 'user.name', $GitName) | Out-Null
GitRun @('config', 'user.email', $GitEmail) | Out-Null
GitRun @('config', 'core.autocrlf', 'true') | Out-Null
GitRun @('config', 'diff.renames', 'false') | Out-Null
if ((GitRun @('fetch', 'origin', $Branch)) -ne 0) { Fail '连不上 GitHub（git fetch 失败）' }
# 以本地文件为准：HEAD 对齐到 GitHub 最新，文件内容不动
GitRun @('reset', '-q', "origin/$Branch") | Out-Null
GitRun @('add', '-A') | Out-Null
# 安全起见：本地没有、GitHub 上有的文件不删（只增改）
$deleted = @((GitOut @('diff', '--cached', '--name-only', '--diff-filter=D')) -split "`r?`n" | Where-Object { $_ })
if ($deleted.Count -gt 0) {
  Warn ("本地缺少 GitHub 上的 " + $deleted.Count + " 个文件，保留 GitHub 上的不删：")
  $deleted | Select-Object -First 10 | ForEach-Object { Warn "  $_" }
  $pathFile = Join-Path $LogDir 'keep-paths.txt'
  [IO.File]::WriteAllLines($pathFile, $deleted)
  GitRun @('reset', '-q', "--pathspec-from-file=$pathFile", 'HEAD') | Out-Null
}
$changed = @((GitOut @('diff', '--cached', '--name-only')) -split "`r?`n" | Where-Object { $_ })
if ($changed.Count -gt 0) {
  Info ("有 " + $changed.Count + " 个文件改动，提交并推送……")
  if ((GitRun @('commit', '-q', '-m', "Not Blind $Tag")) -ne 0) { Fail 'git commit 失败' }
  if ((GitRun @('push', 'origin', "HEAD:$Branch")) -ne 0) { Fail 'git push 失败（网络或登录问题）' }
} else {
  Info 'GitHub 上的源码已经是最新'
}
$Sha = GitOut @('rev-parse', 'HEAD')
Ok "源码已同步（提交 $($Sha.Substring(0,7))）"

# ---------- 6. 建 Release + 上传 ----------
Step 6 "在 GitHub 建 $Tag 发布并上传安装包"
# 更新说明：优先 docs/update/release-notes.md（第一行写 <!-- version: x.y.z -->），否则取 CHANGELOG
$notesFile = Join-Path $Src 'docs\update\release-notes.md'
$Body = ''
if (Test-Path $notesFile) {
  $raw = Get-Content $notesFile -Raw -Encoding UTF8
  if ($raw -match "<!--\s*version:\s*$([regex]::Escape($Version))\s*-->") { $Body = $raw.Trim() }
}
if (-not $Body) {
  $cl = Get-Content (Join-Path $Src 'CHANGELOG.md') -Raw -Encoding UTF8
  $m = [regex]::Match($cl, "(?ms)^## v$([regex]::Escape($Version))\b[^\n]*\n(.*?)(?=^## |\z)")
  if ($m.Success) { $Body = $m.Groups[1].Value.Trim() } else { $Body = "Not Blind $Tag" }
}
$gpl = 'Not Blind 是 Mineradio（XxHuberrr，GPL-3.0）的二次开发版本，本版本源码见同名 tag。'
if ($Body -notmatch 'GPL-3\.0') { $Body = $Body + "`n`n---`n" + $gpl }

if (-not $Release) {
  $Release = Api 'POST' "$Api/releases" @{
    tag_name = $Tag; target_commitish = $Sha; name = "Not Blind $Version"
    body = $Body; draft = $true; prerelease = $false
  }
  Info '已建草稿（传完文件再公开，免得别人看到缺文件的版本）'
} elseif ($Release.draft) {
  $Release = Api 'PATCH' "$Api/releases/$($Release.id)" @{ target_commitish = $Sha; body = $Body }
}

Add-Type -AssemblyName System.Net.Http
function Upload-Asset($path) {
  $name = Split-Path $path -Leaf
  $size = (Get-Item $path).Length
  $cur = Api 'GET' "$Api/releases/$($Release.id)" $null
  $exist = $cur.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
  if ($exist) {
    # 内容完全一样（sha256 相同）才跳过；这次重新打包过的就换掉，免得校验码对不上
    $localHash = 'sha256:' + (Get-FileHash -Algorithm SHA256 $path).Hash.ToLower()
    if ($exist.state -eq 'uploaded' -and [string]$exist.digest -eq $localHash) { Info "$name 已在，跳过"; return }
    Api 'DELETE' "$Api/releases/assets/$($exist.id)" $null | Out-Null
  }
  for ($try = 1; $try -le 3; $try++) {
    Info ("上传 $name（" + [math]::Round($size / 1MB, 1) + " MB）第 $try 次……")
    $client = New-Object System.Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromHours(3)
    $client.DefaultRequestHeaders.Add('Authorization', "token $Token")
    $client.DefaultRequestHeaders.Add('User-Agent', 'NotBlind-release')
    $stream = [IO.File]::OpenRead($path)
    try {
      $content = New-Object System.Net.Http.StreamContent($stream)
      $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/octet-stream')
      $url = "https://uploads.github.com/repos/$Owner/$Repo/releases/$($Release.id)/assets?name=" + [Uri]::EscapeDataString($name)
      $sw = [Diagnostics.Stopwatch]::StartNew()
      $resp = $client.PostAsync($url, $content).GetAwaiter().GetResult()
      if ($resp.IsSuccessStatusCode) {
        Ok ("$name 上传完成（" + [int]$sw.Elapsed.TotalSeconds + ' 秒）')
        return
      }
      Warn ("失败：HTTP " + [int]$resp.StatusCode + ' ' + $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult())
    } catch {
      Warn ("失败：" + $_.Exception.Message)
    } finally {
      $stream.Dispose(); $client.Dispose()
    }
    # 清掉传了一半的
    try {
      $cur = Api 'GET' "$Api/releases/$($Release.id)" $null
      $half = $cur.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
      if ($half) { Api 'DELETE' "$Api/releases/assets/$($half.id)" $null | Out-Null }
    } catch { }
    Start-Sleep -Seconds 5
  }
  Fail "$name 上传了 3 次都没成功（多半是网络，稍后再点一次，会从这一步接着来）"
}
# 小文件先传，安装包最后；latest.yml 最后公开前才生效
Upload-Asset $BlockMap
Upload-Asset $Exe
Upload-Asset $Yml

# 核对
$cur = Api 'GET' "$Api/releases/$($Release.id)" $null
foreach ($n in $Needed) {
  $a = $cur.assets | Where-Object { $_.name -eq $n -and $_.state -eq 'uploaded' } | Select-Object -First 1
  if (-not $a) { Fail "GitHub 上缺 $n" }
  $local = Join-Path $Dist $n
  if ([int64]$a.size -ne (Get-Item $local).Length) { Fail "$n 大小对不上" }
}
if ($cur.draft) {
  $Release = Api 'PATCH' "$Api/releases/$($Release.id)" @{ draft = $false; make_latest = 'true' }
}
Ok '三个文件都在，已公开'

# ---------- 7. 收尾 ----------
Step 7 '检查结果'
Start-Sleep -Seconds 3
$latest = Api 'GET' "$Api/releases/latest" $null
if ($latest.tag_name -ne $Tag) { Warn "GitHub 的「最新版本」现在是 $($latest.tag_name)，不是 $Tag，请看一眼发布页" }
else { Ok "GitHub 最新版本 = $Tag，装了自动更新的用户会陆续收到" }
Write-Host ''
Write-Host "  发布完成：$($Release.html_url)" -ForegroundColor Green
Write-Host "  日志：$LogFile" -ForegroundColor DarkGray
try { Start-Process $Release.html_url } catch { }
try { Stop-Transcript | Out-Null } catch { }
exit 0
