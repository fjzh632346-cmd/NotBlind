# Not Blind 发布流程

原版 Mineradio 2.2.0 的发布说明保存在 [docs/upstream/MINERADIO_RELEASE_2.2.0.md](./docs/upstream/MINERADIO_RELEASE_2.2.0.md)。

## 每次发新版

1. 把 `package.json` 的 `version` 改成新版本号（要比上一版大，旧版才会提示更新）。`docs/update/latest.yml` 里的版本号和日期也一起改。
2. 打包：`npm run build:win`，产物是 `dist/NotBlind-<版本>-Setup.exe`。
3. **先推源码，再发安装包**：把这次打包用的源码推到 main 分支，确认 GitHub 上的代码和打包用的完全一致。
4. 在 Releases 新建 tag `v<版本>`（指向第 3 步推上去的那个提交），上传 `NotBlind-<版本>-Setup.exe` 和 `docs/update/latest.yml`。
   - 正文前几行写更新说明：每行 72 字以内，软件内最多显示 4 行。
   - 国内下载慢的话，可以在正文加网盘线路：`<!-- notblind-download-page: 名字|https://网盘链接 -->`。
5. 在 Release 正文末尾保留一句：「Not Blind 是 Mineradio（XxHuberrr，GPL-3.0）的二次开发版本，本版本源码见同名 tag。」

## 旧版为什么也能收到更新

旧版 Mineradio 2.3.0 查的是 `fjzh632346-cmd/Mineradio-Plus`，仓库改名后 GitHub 会自动跳转到这里，所以它们也会提示 Not Blind 的新版本。**这个仓库以后不要再改名，也不要新建叫 Mineradio-Plus 的仓库**，否则跳转会断。

## 开源协议（GPL-3.0）要守住的几条

- 每个发出去的安装包，都要有对应的完整源码可以下载（第 3、4 步的 tag 就是为这个）。
- 不能删掉 LICENSE、NOTICE.md，也不能删掉原作者 XxHuberrr 的版权和署名。
- 不能给别人加额外限制，比如「禁止修改」「禁止再发布」。
- 反馈服务器的 `config.json`（后台密码）、各平台 Cookie、打包产物都不要提交到仓库。
