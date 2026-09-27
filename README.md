# Not Blind

Not Blind 是一款 Windows 桌面沉浸式音乐播放器：有多套可切换的主页主题、歌词舞台、播放页视觉效果，还有能把播放器铺成桌面背景的桌面模式。

> **这是基于 Mineradio 的二次开发版本（非官方）。**
> 原项目：[XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)，作者 XxHuberrr，GPL-3.0 协议，目前已长期停更。
> Not Blind 在 Mineradio 2.2.0 源码的基础上修改，由 [fjzh632346-cmd](https://github.com/fjzh632346-cmd) 维护，与原作者没有隶属关系。有问题请在本仓库反馈，不要去打扰原作者。
> 仓库保留了原项目的完整提交历史，可以看到哪些代码是原作者写的、哪些是后来改的。

## 和原版 Mineradio 相比改了什么

- **改名换装**：软件名、图标、安装向导、开场动画（「一线」地平线开场）都换成了 Not Blind 自己的设计。装过原版 Mineradio 或二改版 2.3.0 的电脑，安装 Not Blind 时会自动关闭并卸载旧版，设置、登录和歌单会带过来。
- **主页主题**：回声（默认）、星图（北斗天穹）、午后窗影、孔版海报四套，左上角拉绳或在设置里切换。每套主题都有自己的歌单栏、搜索框、视觉/设置面板风格，主页还会显示当前歌词。
- **播放页**：新增镜湖、声纹沙、铜雨、谐振等 3D 视觉效果和对应的歌词动效，另有平面（2D）歌词和配套的平面歌单。
- **桌面模式**：拼图进出场、编辑态自动隐藏桌面图标、右键回退、顶部灵动岛、限帧省电等。
- **界面整理**：右上角改为「视觉」和「设置」两个入口，快捷键和上手引导重新整理。
- **软件内反馈**：没有 GitHub 账号也能直接在软件里提交反馈（详见 [PRIVACY.md](./PRIVACY.md)）。
- **更新检测**：改为检测本仓库的 Releases。

改动较多的代码在 `public/js/modules/12-home-themes/`、`public/js/modules/13-desktop-extras/`、`public/notblind-*.js`、`desktop/feedback.js`，其余文件里的改动标了 `[二改]` / `[修]` 注释。完整改动记录见 [CHANGELOG.md](./CHANGELOG.md) 和 Git 提交历史。

## 下载

到本仓库的 [Releases](https://github.com/fjzh632346-cmd/NotBlind/releases) 页面，下载 `NotBlind-版本号-Setup.exe` 并运行。每个版本的源码与同名 tag 对应。

以前装过 Mineradio（原版 2.2.0 或二改版 2.3.0）的话，直接装 Not Blind 就行，不用先卸载。第一次打开会有一份使用引导，之后在「设置 › 常用 › 使用引导」可以再看。

安装包没有数字签名，Windows 可能提示风险：浏览器下载栏点「保留」；蓝色 SmartScreen 窗口点「更多信息 → 仍要运行」。如果杀毒软件明确报毒，请不要运行，并在 Issues 里反馈。

## 自己从源码运行 / 打包

需要 Node.js 和 Git。

```bash
npm install
npm start          # 直接运行
npm run build:win  # 打包 Windows 安装包，产物在 dist/
```

国内下载 Electron 慢的话，打包前先设置镜像（PowerShell）：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
```

软件内反馈要连到你自己的接收服务器：在项目根目录建一个 `feedback.local.json`，写 `{"endpoint": "http://你的服务器:端口/api/feedback", "key": "你的 appKey"}`（这个文件不会进 Git，打包时会带上）；也可以直接填 `package.json` 的 `notblind.feedback`。不填的话，反馈功能不会发送任何东西。

## 第三方音乐平台说明

Not Blind 不是网易云音乐、QQ 音乐、酷狗音乐、汽水音乐、Spotify 或任何音乐平台的官方客户端，和这些平台没有隶属关系。

平台接入功能只用于个人学习，以及用户用**自己的账号**在本机播放。使用时请遵守各平台的用户协议、版权规则和会员权益规则。本项目不提供、也不接受任何绕过付费或会员、破解音质、下载或再分发音乐内容的功能。

## 用户数据与隐私

登录状态、Cookie、播放记录、自定义封面和歌词等都只保存在你自己电脑上。只有你主动提交反馈时，才会发送你填写的内容和基本诊断信息。详见 [PRIVACY.md](./PRIVACY.md)。

## 致谢

- **Mineradio 原作者 XxHuberrr**：Not Blind 的播放、歌词舞台、粒子视觉、3D 歌单架、桌面模式等核心能力都来自 Mineradio。原项目的说明文档保存在 [docs/upstream/MINERADIO_README.md](./docs/upstream/MINERADIO_README.md)。
- Mineradio 的共创者 emily，以及 Mineradio 早期的测试者和贡献者（名单见 [NOTICE.md](./NOTICE.md)）。
- 第三方开源项目与社区移植代码（Electron、Three.js、GSAP、NeteaseCloudMusicApi、Cuefield 等），详见 [NOTICE.md](./NOTICE.md) 和 [docs/THIRD_PARTY_PORTS.md](./docs/THIRD_PARTY_PORTS.md)。

## 版权与授权

- Mineradio 原始代码：Copyright (C) 2026 XxHuberrr
- Not Blind 修改部分：Copyright (C) 2026 fjzh632346-cmd

本项目整体采用 **GPL-3.0** 协议授权，全文见 [LICENSE](./LICENSE)。你可以自由使用、修改和再发布，但再发布时必须同样以 GPL-3.0 开源，并保留以上版权与署名信息。

"Mineradio" 名称和 MR Logo 归原作者所有，Not Blind 没有使用它们作为本软件的标识。第三方依赖和服务分别遵循各自的授权与服务条款。
