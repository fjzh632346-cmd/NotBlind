# Not Blind 发布流程

原版 Mineradio 2.2.0 的发布说明保存在 [docs/upstream/MINERADIO_RELEASE_2.2.0.md](./docs/upstream/MINERADIO_RELEASE_2.2.0.md)。

## 一键发布（推荐）

双击源码根目录的 **`发布新版本.bat`**，它会按顺序做完下面「每次发新版」的第 2–5 步：装依赖 → 打包 → 推源码 → 建 GitHub 发布（先存草稿，三个文件传完再公开）→ 核对。

- 发布前要准备好的（Claude 改代码时一起做）：`package.json` 的版本号、`CHANGELOG.md` 对应段落、`docs/update/release-notes.md`（第一行 `<!-- version: x.y.z -->`，接着 4 行 72 字以内的短句是软件内更新提示）。
- GitHub 登录：优先用 git 已保存的登录；没有就弹出浏览器登录，或让你粘贴一次令牌（加密存在 `%APPDATA%\NotBlind-release\`）。
- 可以重复点：已经上传过、内容完全一样的文件会跳过；中途断网再点一次就行。
- 源码以本地为准，但 GitHub 上有、本地没有的文件不会被删。
- 每次运行的日志在 `_release_logs\`（不进仓库），出问题把日志给 Claude 看。

## 每次发新版

1. 把 `package.json` 的 `version` 改成新版本号（要比上一版大，旧版才会提示更新）。
2. 打包：`npm run build:win`。`dist` 里会出来三个要用的文件：
   - `NotBlind-<版本>-Setup.exe`（安装包）
   - `NotBlind-<版本>-Setup.exe.blockmap`（差量更新用的"分块目录"）
   - `latest.yml`（版本号 + 安装包的校验码）
3. **先推源码，再发安装包**：把这次打包用的源码推到 main 分支，确认 GitHub 上的代码和打包用的完全一致。
4. 在 Releases 新建 tag `v<版本>`（指向第 3 步推上去的那个提交），**把第 2 步的三个文件都传上去**，发布为正式版（不要勾 pre-release）。
   - `latest.yml` 一定要传 `dist` 里打包生成的那份（带校验码），**不要**传 `docs/update/latest.yml`（那份没有校验码，软件内自动更新会失败）。
   - 三个文件缺一不可：少了 `latest.yml` 老用户收不到更新；少了 `.blockmap` 下一版只能整包下载。
   - 正文前几行写更新说明：每行 72 字以内，软件内最多显示 4 行。
   - 需要的话仍可在正文加网盘线路（软件内自动更新失败时的备用）：`<!-- notblind-download-page: 名字|https://网盘链接 -->`。
5. 在 Release 正文末尾保留一句：「Not Blind 是 Mineradio（XxHuberrr，GPL-3.0）的二次开发版本，本版本源码见同名 tag。」
6. 旧版本的发布页**不要删**：差量更新要从用户当前版本的发布页取它的 `.blockmap`。

## 软件内自动更新是怎么走的（3.1.1 起）

- 软件启动 20 秒后检查一次，之后每 6 小时查一次。版本信息 `latest.yml` 优先直连 GitHub 拿，连不上再走加速线路。
- 有新版就在后台下载安装包，线路按 `package.json › notblind.update.mirrors` 的顺序，某条失败自动换下一条，最后直连 GitHub。
- 下载完用 `latest.yml` 里的校验码核对，对不上就丢掉，不会装。
- 能差量就差量：用新旧两版的 `.blockmap` 算出变了哪些块，只下载这些块；线路不支持分段下载时自动改为整包下载。
- 下完后右上角更新图标显示「重启并更新」；用户不点的话，下次正常退出软件时静默安装。
- 源码运行（`npm start`）时不会自动更新。
- 3.1.0 及更早的版本没有这个功能，只会提示并打开发布页，需要手动装一次 3.1.1。

## 旧版为什么也能收到更新

旧版 Mineradio 2.3.0 查的是 `fjzh632346-cmd/Mineradio-Plus`，仓库改名后 GitHub 会自动跳转到这里，所以它们也会提示 Not Blind 的新版本。**这个仓库以后不要再改名，也不要新建叫 Mineradio-Plus 的仓库**，否则跳转会断。

## 开源协议（GPL-3.0）要守住的几条

- 每个发出去的安装包，都要有对应的完整源码可以下载（第 3、4 步的 tag 就是为这个）。
- 不能删掉 LICENSE、NOTICE.md，也不能删掉原作者 XxHuberrr 的版权和署名。
- 不能给别人加额外限制，比如「禁止修改」「禁止再发布」。
- 反馈服务器的 `config.json`（后台密码）、各平台 Cookie、打包产物都不要提交到仓库。
