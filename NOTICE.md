# NOTICE

## Not Blind

Not Blind 是 [Mineradio](https://github.com/XxHuberrr/Mineradio)（作者 XxHuberrr，GPL-3.0）的二次开发版本，由 fjzh632346-cmd 在 Mineradio 2.2.0 源码基础上修改，修改始于 2026 年 9 月。修改内容见 README.md、CHANGELOG.md 和 Git 提交历史。

- Not Blind 修改部分：Copyright (C) 2026 fjzh632346-cmd，同样以 GPL-3.0 授权。
- Not Blind 的名称、「拨弦」图标、安装向导图、开场动画和新增主页主题的视觉设计由 Not Blind 作者制作。
- Mineradio 原作者的版权声明、致谢以及下方原 NOTICE 内容均原样保留。

Not Blind 不是任何音乐平台的官方客户端，也不隶属于网易云音乐、QQ 音乐、腾讯音乐娱乐集团、酷狗音乐、汽水音乐（字节跳动）或 Spotify。

---

## Mineradio 原 NOTICE（原文保留）


Mineradio 使用了以下第三方项目或服务。各项目版权归其原作者所有。

### Third-party Libraries

- Electron
- Three.js
- GSAP
- music-tempo
- NeteaseCloudMusicApi
- mpg123-decoder

### Community Contributions

- Cuefield AutoMix planner/runtime: adapted for experimental local testing from [SLYysl/cuefield-mineradio](https://github.com/SLYysl/cuefield-mineradio) at revision `c16f05a0bc731a49da7d42c135337fcac58f6dba` (GPL-3.0). The optional remote-feedback component from that repository is not included; Mineradio stores Cuefield ratings locally in the current user's data directory.
- Wallpaper Engine local-library detection and import UX: independently adapted from the approach used by [ww085213/Mineradio-LX-Music](https://github.com/ww085213/Mineradio-LX-Music) at commit `a5ef80a219709080700be5b1d00f1ea71a5a2576` (GPL-3.0). Mineradio only indexes local `project.json` metadata; it does not execute imported Web/Application projects or replace the user's existing background-media settings.
- Full-desktop main-window mode and home-dashboard information hierarchy: initially adapted from [ww085213/Mineradio-LX-Music](https://github.com/ww085213/Mineradio-LX-Music) at commit `82826df814c32853d99697c0ee60f749a2fcad79`, with the homepage refreshed against `812e2dc2e18bbc263e61dbd0206cb765e003d6e9` (GPL-3.0). Mineradio keeps its own provider, queue, playlist, listening-history, WorkerW validation, DPI, lifecycle, and cleanup implementations; see `docs/THIRD_PARTY_PORTS.md` in the corresponding source distribution.
- Qishui Passport Web QR authentication bridge: focused port from [Wx2yZx/Mineradio-Qishui-QR-Login](https://github.com/Wx2yZx/Mineradio-Qishui-QR-Login) at commit `aaadaab7d011714f94fbe45b382ba8dcc7cf17b9` (declared `GPL-3.0-only`). Only the official QR create/poll, security-signing host, session persistence, and second-verification path are integrated; Mineradio keeps its own catalogue, playlist, entitlement, and playback adapters. The bundled ByteDance/Qishui web security runtime resources remain the property of their respective rights holders and are used only to interoperate with the user's own official account session.

### Third-party Services

Mineradio 可能与网易云音乐、QQ 音乐等第三方音乐服务进行用户自有账号相关的本地客户端交互。

Mineradio 不是任何音乐平台的官方客户端，也不隶属于网易云音乐、QQ 音乐或腾讯音乐娱乐集团。请用户自行遵守对应平台的服务协议、版权规则和会员权益规则。

### Original Design

Mineradio 名称、MR Logo、界面视觉设计、启动动画方向、粒子视觉体验和电影镜头系统的产品表达属于作者原创设计。

emily 作为 Mineradio 早期视觉底层想法与 `emily` 视觉预设改进方向的共创者和灵感来源之一，特此致谢。

感谢小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦在早期体验、测试反馈和发布准备中的帮助。
