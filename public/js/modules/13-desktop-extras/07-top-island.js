;
// ============================================================
// [二改] 右上角「灵动岛」
// 把原来散在右上角的 ?引导 / 新版本 / DIY / 设为桌面背景 / 主页 / 账号胶囊 收进一个岛：
// [二改 2026-09-26] 岛上改成 主页 / 桌面背景 / 视觉 / 设置：DIY 去掉，引导挪进 设置 › 系统。
//   收起 = 账号头像叠层 + 一个状态小图标；鼠标停 0.1 秒弹开一整行；点头像出账号卡片；
//   有新版本、打开下载页、进出桌面背景、切换 DIY、登录可能失效时，岛自己展开说一句（约 3 秒）。
//   播放 / 暂停 / 切歌不提示（用户要求）。
// 做法（为了好回滚、不动原逻辑）：
//   - 旧按钮一个都没删、id 和函数都没改，只是用样式藏起来；岛上的按钮去 .click() 旧按钮，
//     所以主进程 IPC、aria-busy、引导、各种状态逻辑都照旧。状态也是从旧按钮 / 全局状态读出来的。
//   - 岛挂在哪：标题栏显示时挂进标题栏（窗口按钮左边，窗口按钮保留原按钮只换外观）；
//     标题栏不显示时（全屏、桌面背景模式、浏览器里）挂进 #top-right。显隐规则因此和原来这两块一样。
// 回退：localStorage['mineradio-top-island'] = 'off' 后重开软件，一切照旧。
// ============================================================
(function () {
  'use strict';
  try { if (localStorage.getItem('mineradio-top-island') === 'off') return; } catch (_) { }
  if (window.MRTopIsland) return;

  var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var SLOT = null, HOST = '', HOME = null;
  var ISLH = { mini: 36, full: 48, note: 54 };
  var CARD_TOP = 46; // 卡片顶到岛顶的距离

  /* ---------- 样式 ---------- */
  var STYLE_TEXT = [
    // 颜色（放在 body 上，窗口按钮也能用）
    'body.mri-on{--mri-sans:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Segoe UI","Noto Sans CJK SC","DejaVu Sans",sans-serif;--mri-num:"Segoe UI Variable Text","Segoe UI","Bahnschrift","DejaVu Sans",sans-serif;--mri-danger:#e5484d;--mri-amber:#f5a524;',
    '--mri-ink:rgba(255,255,255,.93);--mri-ink2:rgba(255,255,255,.68);--mri-ink3:rgba(255,255,255,.42);--mri-line:rgba(255,255,255,.14);--mri-hover:rgba(255,255,255,.10);--mri-hover2:rgba(255,255,255,.15);--mri-chip:rgba(255,255,255,.08);--mri-chip-on:rgba(255,255,255,.17);',
    '--mri-isl1:rgba(14,14,17,.90);--mri-isl2:rgba(6,6,8,.94);--mri-rim-a:rgba(255,255,255,.34);--mri-rim-c:rgba(255,255,255,.16);--mri-shadow:0 14px 34px -14px rgba(0,0,0,.78),0 2px 8px -3px rgba(0,0,0,.45);',
    '--mri-accent:#f1c47c;--mri-accent-glow:rgba(241,196,124,.55);--mri-accent-ink:#1c1406;--mri-gold-a:#fbe7b0;--mri-gold-b:#c3923f;--mri-gold-c:#fff6d8;--mri-gold-t:#ecc986;--mri-jade-a:#c9fff0;--mri-jade-b:#1fb89a;--mri-jade-c:#eafff8;--mri-jade-t:#6fe0c4;',
    '--mri-av-gap:rgba(22,23,29,.95);--mri-focus:rgba(150,200,255,.95);--mri-glyph:rgba(255,255,255,.78);--mri-glyph-sh:drop-shadow(0 1px 2px rgba(0,0,0,.65))}',
    'body.mri-on.mri-light{--mri-ink:rgba(32,25,18,.92);--mri-ink2:rgba(32,25,18,.64);--mri-ink3:rgba(32,25,18,.40);--mri-line:rgba(70,48,24,.15);--mri-hover:rgba(70,48,24,.08);--mri-hover2:rgba(70,48,24,.12);--mri-chip:rgba(70,48,24,.06);--mri-chip-on:rgba(70,48,24,.12);',
    '--mri-isl1:rgba(255,253,250,.92);--mri-isl2:rgba(244,239,231,.94);--mri-rim-a:rgba(255,255,255,1);--mri-rim-c:rgba(120,90,60,.24);--mri-shadow:0 14px 32px -16px rgba(90,60,30,.55),0 1px 3px rgba(90,60,30,.18);',
    '--mri-accent:#cf7a1c;--mri-accent-glow:rgba(207,122,28,.38);--mri-accent-ink:#fff;--mri-gold-a:#e8c47a;--mri-gold-b:#a4741d;--mri-gold-c:#f6e0a6;--mri-gold-t:#9c6912;--mri-jade-a:#8fe0c8;--mri-jade-b:#118a70;--mri-jade-c:#c9f3e6;--mri-jade-t:#0f7a63;',
    '--mri-av-gap:rgba(250,247,241,.96);--mri-focus:rgba(30,110,230,.9);--mri-glyph:rgba(32,25,18,.74);--mri-glyph-sh:drop-shadow(0 1px 1.5px rgba(255,255,255,.85))}',

    // 旧元素藏起来（不删）
    'body.mri-on #desktop-titlebar .desktop-window-controls>#visual-guide-btn,body.mri-on #desktop-titlebar .desktop-window-controls>#update-entry,body.mri-on #desktop-titlebar .desktop-window-controls>#diy-mode-btn{display:none!important}',
    'body.mri-on.mri-host-tb #top-right{display:none!important}',
    'body.mri-on.mri-host-tr #top-right>:not(.mri-slot):not(#mri-home){display:none!important}',
    'body.mri-on.mri-host-tr #top-right{gap:0!important}',
    'body.mri-on #fullscreen-diy-zone{display:none!important}',

    // 标题栏：岛 + 窗口按钮一排，岛顶 10px，窗口按钮顶 12px（和概念稿一样）
    'body.mri-on.desktop-shell #desktop-titlebar{padding-right:10px}',
    'body.mri-on #desktop-titlebar .desktop-window-controls{gap:2px;margin-top:12px}',
    'html body.mri-on #desktop-titlebar .desktop-window-controls>button.desktop-window-btn.desktop-window-btn{width:32px!important;height:32px!important;border-radius:16px!important;border:0!important;background:transparent!important;color:var(--mri-glyph)!important;box-shadow:none!important;transform:none;transition:background .18s,color .18s,transform .25s cubic-bezier(.2,1.25,.3,1)}',
    'html body.mri-on #desktop-titlebar .desktop-window-controls>button.desktop-window-btn.desktop-window-btn svg{width:16px;height:16px;stroke-width:1.5;filter:var(--mri-glyph-sh)}',
    'html body.mri-on #desktop-titlebar .desktop-window-controls>button.desktop-window-btn.desktop-window-btn:hover{background:var(--mri-hover2)!important;color:var(--mri-ink)!important;-webkit-backdrop-filter:blur(10px)!important;backdrop-filter:blur(10px)!important;transform:none}',
    'html body.mri-on #desktop-titlebar .desktop-window-controls>button.desktop-window-btn.desktop-window-btn:active{transform:scale(.9)}',
    'html body.mri-on #desktop-titlebar .desktop-window-controls>button.desktop-window-btn.desktop-window-btn.close:hover{background:var(--mri-danger)!important;color:#fff!important}',
    'html body.mri-on #desktop-titlebar .desktop-window-controls>button.desktop-window-btn.desktop-window-btn.close:hover svg{stroke-width:1.8;filter:none}',

    // 岛的插槽：高度固定 36，岛长高时往下溢出，不挤动窗口按钮
    '.mri-slot{position:relative;flex:none;box-sizing:content-box;height:36px;margin-right:10px;pointer-events:auto;-webkit-app-region:no-drag;z-index:2;',
    '  --mri-spring:cubic-bezier(.2,1.25,.3,1);--mri-sd:520ms;--mri-spring-soft:cubic-bezier(.22,1.1,.3,1);--mri-sds:560ms;',
    '  font:13px/1.4 var(--mri-sans);color:var(--mri-ink);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none;text-align:left;letter-spacing:normal;direction:ltr;text-transform:none;transition:opacity .2s ease}',
    '#top-right>.mri-slot{margin-right:0}',
    // [主题配色] 回声主页（深色哑光底 #141211、灰绿字 #dfe3dc、朱红点缀）：岛换成同一套颜色，去掉玻璃高光和金色
    'body.mri-on:not(.mri-light){--mri-ink:#dfe3dc;--mri-ink2:rgba(223,227,220,.64);--mri-ink3:rgba(223,227,220,.40);--mri-line:rgba(223,227,220,.13);--mri-hover:rgba(223,227,220,.07);--mri-hover2:rgba(223,227,220,.11);--mri-chip:rgba(223,227,220,.05);--mri-chip-on:rgba(223,227,220,.12);',
    '--mri-isl1:rgba(26,24,22,.94);--mri-isl2:rgba(20,18,17,.96);--mri-rim-a:rgba(223,227,220,.15);--mri-rim-c:rgba(223,227,220,.15);--mri-shadow:0 12px 28px -18px rgba(0,0,0,.8);',
    '--mri-accent:#ff4a1c;--mri-accent-glow:rgba(255,74,28,.32);--mri-accent-ink:#fff;--mri-av-gap:#141211;--mri-focus:#ff4a1c;--mri-glyph:rgba(223,227,220,.7);--mri-glyph-sh:none}',
    'body.mri-on:not(.mri-light) .mri-isl,body.mri-on:not(.mri-light) .mri-card{background:linear-gradient(180deg,var(--mri-isl1),var(--mri-isl2));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:var(--mri-shadow)}',
    'body.mri-on:not(.mri-light) .mri-isl::after,body.mri-on:not(.mri-light) .mri-card::after{background:var(--mri-rim-a);opacity:1}',
    'body.mri-on:not(.mri-light) .mri-nic.mri-acc{box-shadow:none}',
    // [二改 回声风格] 岛整体换成默认页（回声）那套：哑光深底、1px 灰绿细线、按下 = 字变亮 + 底下一道朱红短线
    '.mri-slot .mri-lb{font-size:12.5px;letter-spacing:.04em}',
    '.mri-slot .mri-lb[aria-pressed=true]{background:transparent;color:var(--mri-ink)}',
    '.mri-slot .mri-lb::after{content:"";position:absolute;left:50%;bottom:4px;width:14px;height:1.5px;margin-left:-7px;border-radius:1px;background:var(--mri-accent);transform:scaleX(0);transition:transform .35s var(--mri-spring)}',
    '.mri-slot .mri-lb[aria-pressed=true]::after{transform:scaleX(1)}',
    '.mri-slot .mri-lb[aria-pressed=true] .mri-ic{color:var(--mri-ink)}',
    'body.mri-on:not(.mri-light) .mri-isl{box-shadow:0 10px 26px -16px rgba(0,0,0,.85)}',
    'body.mri-on:not(.mri-light) .mri-isep{background:rgba(223,227,220,.14)}',
    '.mri-slot .mri-card .mri-sec{font-family:"Cascadia Mono",Consolas,"Microsoft YaHei UI",monospace;letter-spacing:.12em;font-size:10.5px}',
    '.mri-slot .mri-foot{font-family:"Cascadia Mono",Consolas,"Microsoft YaHei UI",monospace}',
    // 主页键：从岛里拿出来，和窗口按钮一样大小，放在最小化左边（没有标题栏时放在岛右边）
    '#mri-home{position:relative;flex:none;width:32px;height:32px;border-radius:16px;border:0;padding:0;margin:0 2px 0 0;background:transparent;color:var(--mri-glyph);display:grid;place-items:center;cursor:pointer;-webkit-app-region:no-drag;pointer-events:auto;transition:background .18s,color .18s,transform .25s cubic-bezier(.2,1.25,.3,1),opacity .2s}',
    '#mri-home svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;filter:var(--mri-glyph-sh);display:block}',
    '#mri-home:hover{background:var(--mri-hover2);color:var(--mri-ink)}',
    '#mri-home:active{transform:scale(.9)}',
    '#mri-home:focus-visible{outline:2px solid var(--mri-focus);outline-offset:-2px}',
    '#mri-home::after{content:"";position:absolute;left:50%;bottom:3px;width:10px;height:1.5px;margin-left:-5px;border-radius:1px;background:var(--mri-accent);transform:scaleX(0);transition:transform .35s cubic-bezier(.2,1.25,.3,1)}',
    '#mri-home[aria-pressed=true]{color:var(--mri-ink)}',
    '#mri-home[aria-pressed=true]::after{transform:scaleX(1)}',
    '#top-right>#mri-home{margin:2px 0 0 6px}',
    'body.mri-on.splash-active:not(.splash-revealing) #mri-home{opacity:0;pointer-events:none}',
    'html.startup-fast-skip-preload #mri-home{opacity:0!important;visibility:hidden!important}',
    'body.immersive-mode #mri-home{opacity:0;pointer-events:none}',
    // [主题配色] 午后窗影：白天（hth-chrome-light）是被太阳照着的纸墙——米色哑光底、暖墨字、赭红点缀；入夜换成暖深色
    'body.mri-on.mri-th-afternoon.mri-light{--mri-ink:#2a221b;--mri-ink2:rgba(42,34,27,.66);--mri-ink3:rgba(42,34,27,.42);--mri-line:rgba(60,44,28,.14);--mri-hover:rgba(60,44,28,.07);--mri-hover2:rgba(60,44,28,.11);--mri-chip:rgba(60,44,28,.05);--mri-chip-on:rgba(60,44,28,.11);',
    '--mri-isl1:rgba(242,235,222,.93);--mri-isl2:rgba(232,223,207,.95);--mri-rim-a:rgba(255,251,242,.95);--mri-rim-c:rgba(90,66,40,.2);--mri-shadow:0 12px 26px -16px rgba(80,56,30,.5),0 1px 2px rgba(80,56,30,.14);',
    '--mri-accent:#9b3b25;--mri-accent-glow:rgba(155,59,37,.28);--mri-accent-ink:#fff;--mri-av-gap:rgba(240,233,220,.96);--mri-focus:#b0662a;--mri-glyph:rgba(42,34,27,.72);--mri-glyph-sh:none}',
    'body.mri-on.mri-th-afternoon:not(.mri-light){--mri-ink:rgba(240,228,208,.92);--mri-ink2:rgba(236,224,204,.64);--mri-ink3:rgba(236,224,204,.40);--mri-line:rgba(236,224,204,.12);--mri-hover:rgba(236,224,204,.07);--mri-hover2:rgba(236,224,204,.11);--mri-chip:rgba(236,224,204,.05);--mri-chip-on:rgba(236,224,204,.12);',
    '--mri-isl1:rgba(36,30,26,.92);--mri-isl2:rgba(24,20,18,.95);--mri-rim-a:rgba(255,222,176,.2);--mri-rim-c:rgba(255,222,176,.1);--mri-shadow:0 12px 28px -18px rgba(0,0,0,.8);',
    '--mri-accent:#e3906a;--mri-accent-glow:rgba(227,144,106,.32);--mri-accent-ink:#1c120c;--mri-av-gap:#1d1916;--mri-focus:#e3906a;--mri-glyph:rgba(240,228,208,.72);--mri-glyph-sh:none}',
    'body.mri-on.mri-th-afternoon .mri-isl,body.mri-on.mri-th-afternoon .mri-card{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:var(--mri-shadow)}',
    'body.mri-on.mri-th-afternoon .mri-isl::after,body.mri-on.mri-th-afternoon .mri-card::after{opacity:1}',
    // [主题配色] 星图：夜空深蓝底、象牙白字、星光金点缀（和视觉 / 设置面板的星图皮肤一致）
    'body.mri-on.mri-th-star-atlas:not(.mri-light){--mri-ink:#ece6d8;--mri-ink2:rgba(236,230,216,.66);--mri-ink3:rgba(236,230,216,.4);--mri-line:rgba(236,230,216,.13);--mri-hover:rgba(236,230,216,.07);--mri-hover2:rgba(236,230,216,.11);--mri-chip:rgba(236,230,216,.05);--mri-chip-on:rgba(236,230,216,.12);',
    '--mri-isl1:rgba(10,13,26,.9);--mri-isl2:rgba(5,7,16,.94);--mri-rim-a:rgba(220,180,108,.26);--mri-rim-c:rgba(220,180,108,.12);--mri-shadow:0 12px 30px -16px rgba(0,0,0,.9);',
    '--mri-accent:#dcb46c;--mri-accent-glow:rgba(220,180,108,.4);--mri-accent-ink:#140f05;--mri-av-gap:#080b16;--mri-focus:#dcb46c;--mri-glyph:rgba(236,230,216,.72);--mri-glyph-sh:none}',
    'body.mri-on.mri-th-star-atlas .mri-isl,body.mri-on.mri-th-star-atlas .mri-card{-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}',
    // [主题配色] 孔版海报：印刷纸底、联邦蓝油墨、荧光粉点缀，套印错位的粉色投影
    'body.mri-on.mri-th-riso-poster.mri-light{--mri-ink:#2a4c9c;--mri-ink2:rgba(42,76,156,.72);--mri-ink3:rgba(42,76,156,.46);--mri-line:rgba(42,76,156,.2);--mri-hover:rgba(42,76,156,.07);--mri-hover2:rgba(42,76,156,.12);--mri-chip:rgba(42,76,156,.06);--mri-chip-on:rgba(255,217,46,.7);',
    '--mri-isl1:rgba(243,237,224,.98);--mri-isl2:rgba(238,230,214,.99);--mri-rim-a:rgba(42,76,156,.85);--mri-rim-c:rgba(42,76,156,.85);--mri-shadow:3px 3px 0 rgba(255,61,154,.85);',
    '--mri-accent:#ff3d9a;--mri-accent-glow:rgba(255,61,154,.3);--mri-accent-ink:#fff;--mri-av-gap:#f2ebdc;--mri-focus:#ff3d9a;--mri-glyph:rgba(42,76,156,.85);--mri-glyph-sh:none}',
    'body.mri-on.mri-th-riso-poster.mri-light .mri-isl,body.mri-on.mri-th-riso-poster.mri-light .mri-card{background:radial-gradient(rgba(42,76,156,.07) .8px,rgba(0,0,0,0) 1.3px) 0 0/5px 5px,linear-gradient(180deg,var(--mri-isl1),var(--mri-isl2));-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:var(--mri-shadow)}',
    'body.mri-on.mri-th-riso-poster.mri-light .mri-isl::after,body.mri-on.mri-th-riso-poster.mri-light .mri-card::after{background:var(--mri-rim-a);opacity:1;padding:1.5px}',
    'body.mri-on.mri-th-riso-poster.mri-light .mri-slot .mri-lb{font-weight:700}',
    // 主页键在浅色主题下别被主题宿主给窗口按钮加的底色框住（按下态只用那道短线表示）
    'html body.mri-on #desktop-titlebar .desktop-window-controls>#mri-home,html body.mri-on #top-right>#mri-home{background:transparent!important;border:0!important;box-shadow:none!important;color:var(--mri-glyph)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}',
    'html body.mri-on #desktop-titlebar .desktop-window-controls>#mri-home:hover,html body.mri-on #top-right>#mri-home:hover{background:var(--mri-hover2)!important;color:var(--mri-ink)!important}',
    'html body.mri-on #desktop-titlebar .desktop-window-controls>#mri-home[aria-pressed=true],html body.mri-on #top-right>#mri-home[aria-pressed=true]{color:var(--mri-ink)!important}',
    'body.mri-on.splash-active:not(.splash-revealing) .mri-slot{opacity:0;pointer-events:none}',
    'body.mri-on.splash-active.splash-revealing .mri-slot{opacity:1;transition:opacity 560ms 220ms cubic-bezier(.32,0,.1,1)}',
    'html.startup-fast-skip-preload .mri-slot{opacity:0!important;visibility:hidden!important;pointer-events:none!important}',
    '.mri-slot *,.mri-slot *::before,.mri-slot *::after{box-sizing:border-box;margin:0;padding:0}',
    '.mri-isl,.mri-card{-webkit-app-region:no-drag}',
    '.mri-slot button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;position:relative;text-transform:none;letter-spacing:inherit;line-height:inherit;min-width:0;min-height:0;box-shadow:none;outline:none;appearance:none;-webkit-appearance:none;width:auto;height:auto}',
    '.mri-slot button:focus{outline:none}',
    '.mri-slot button:focus-visible{outline:2px solid var(--mri-focus);outline-offset:-2px}',
    '.mri-slot svg.mri-ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block;pointer-events:none}',
    '.mri-slot .mri-hid{display:none!important}',

    // 岛
    '.mri-isl{position:relative;height:36px;width:48px;border-radius:18px;overflow:hidden;pointer-events:auto;',
    '  background:linear-gradient(180deg,var(--mri-isl1),var(--mri-isl2));-webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);box-shadow:var(--mri-shadow),0 0 0 .5px rgba(0,0,0,.2);',
    '  transition:width var(--mri-sds) var(--mri-spring-soft),height var(--mri-sds) var(--mri-spring-soft),border-radius var(--mri-sds) var(--mri-spring-soft),transform .3s var(--mri-spring)}',
    '.mri-isl::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;padding:1px;background:linear-gradient(170deg,var(--mri-rim-a),transparent 40%,transparent 70%,var(--mri-rim-c));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.7}',
    '.mri-isl:active{transform:scale(.985)}',
    '.mri-il{position:absolute;top:0;right:0;bottom:0;display:flex;align-items:center;white-space:nowrap;opacity:0;filter:blur(6px);transform:scale(.92);transform-origin:right center;pointer-events:none;transition:opacity .2s ease,filter .3s ease,transform var(--mri-sds) var(--mri-spring-soft)}',
    '.mri-isl[data-mode=mini] .mri-mini,.mri-isl[data-mode=full] .mri-full,.mri-isl[data-mode=note] .mri-note{opacity:1;filter:none;transform:none;pointer-events:auto;transition-delay:.06s}',
    '.mri-mini{padding:0 6px;gap:7px;cursor:default}',
    // [二改] 收起时头像撑满整个岛（原来是 36px 的岛里放 24px 头像，外面一圈岛底色，看着像个带框的小头像）
    '.mri-mini{padding:0}',
    '.mri-mini .mri-stack{--sz:36px;--ov:-11px;--spread:0px}',
    '.mri-mini .mri-av{box-shadow:0 0 0 1.5px var(--mri-av-gap)}',
    '.mri-mini .mri-av.mri-vip::after{inset:0}',
    '.mri-mini .mri-ist:not(.mri-hid){margin:0 8px 0 6px}',
    // 头像叠层原来是行内元素，按文字基线排，会比岛整体高出约 2px（圆框和头像错开的另一半原因）
    '.mri-mini .mri-mstack{display:flex;align-items:center;height:100%;line-height:0}',
    '.mri-mini .mri-stack{display:flex;line-height:0}',
    // [二改] 收起时岛就是头像本身：去掉岛自己的描边和投影（孔版的粉色错版投影、蓝色描边套在头像外面，看着像头像和圆框没对齐）
    'body.mri-on .mri-isl[data-mode=mini]{box-shadow:none!important;background:transparent!important}',
    'body.mri-on .mri-isl[data-mode=mini]::after{opacity:0!important}',
    'body.mri-on.mri-th-riso-poster.mri-light .mri-isl[data-mode=mini] .mri-av:not(.mri-vip){outline:2px solid #2a4c9c;outline-offset:-2px}',
    '.mri-ist{width:22px;height:22px;display:grid;place-items:center;color:var(--mri-ink2)}',
    '.mri-ist .mri-ic{width:16px;height:16px}',
    '.mri-ist .mri-ring{width:18px;height:18px}',
    '.mri-full{padding:0 7px;gap:2px}',
    '.mri-slot .mri-acct{height:36px;padding:0 7px 0 4px;border-radius:18px;display:flex;align-items:center;transition:background .18s}',
    '.mri-slot .mri-acct:hover{background:var(--mri-hover)}',
    '.mri-isep{width:1px;height:18px;background:var(--mri-line);margin:0 5px;flex:none}',
    '.mri-slot .mri-lb{height:34px;padding:0 11px 0 9px;border-radius:17px;display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--mri-ink2);transition:background .18s,color .18s,opacity .18s}',
    '.mri-lb .mri-ic{width:16px;height:16px}',
    '.mri-slot .mri-lb:hover{background:var(--mri-hover);color:var(--mri-ink)}',
    '.mri-slot .mri-lb[aria-pressed=true]{background:var(--mri-chip-on);color:var(--mri-ink)}',
    '.mri-slot .mri-lb[data-mri-act=wall][aria-pressed=true]{color:var(--mri-accent)}',
    '.mri-slot .mri-lb[aria-busy=true]{opacity:.55;pointer-events:none}',
    '.mri-slot .mri-lb.mri-upd{color:var(--mri-accent)}',
    '.mri-slot .mri-lb.mri-fb .mri-ic{color:var(--mri-accent)}',
    '.mri-lb.mri-upd .mri-ring{width:16px;height:16px}',
    '.mri-note{padding:0 8px 0 9px;gap:11px}',
    '.mri-nic{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--mri-chip-on);color:var(--mri-ink);flex:none}',
    '.mri-nic.mri-acc{background:var(--mri-accent);color:var(--mri-accent-ink);box-shadow:0 0 16px var(--mri-accent-glow)}',
    '.mri-nic.mri-warn{background:var(--mri-amber);color:#2a1800}',
    '.mri-nic .mri-ic{width:17px;height:17px}',
    '.mri-nic .mri-ring{width:20px;height:20px}',
    '.mri-nt{display:flex;flex-direction:column;gap:1px;padding-right:4px}',
    '.mri-nt b{font-size:13px;font-weight:600;color:var(--mri-ink)}',
    '.mri-nt small{font-size:11px;color:var(--mri-ink2)}',
    '.mri-slot .mri-na{height:30px;padding:0 13px;border-radius:15px;background:var(--mri-hover2);font-size:12px;color:var(--mri-ink);font-weight:500;transition:background .15s}',
    '.mri-slot .mri-na:hover{background:var(--mri-chip-on)}',

    // 转圈（打开下载页时）
    '.mri-ring .mri-rb{fill:none;stroke:var(--mri-line);stroke-width:1.6}',
    '.mri-ring .mri-rp{fill:none;stroke:var(--mri-accent);stroke-width:1.8;stroke-linecap:round;stroke-dasharray:100 100;stroke-dashoffset:72;transform-origin:center;transform-box:fill-box;animation:mri-spin 1s linear infinite}',
    '@keyframes mri-spin{from{transform:rotate(-90deg)}to{transform:rotate(270deg)}}',

    // 头像叠层
    '.mri-stack{display:inline-flex;align-items:center;--sz:24px;--ov:-8px;--spread:4px}',
    '.mri-full .mri-stack{--sz:28px;--ov:-9px;--spread:6px}',
    '.mri-av{position:relative;width:var(--sz);height:var(--sz);border-radius:50%;flex:none;display:block;box-shadow:0 0 0 1.5px var(--mri-av-gap);transition:margin .45s var(--mri-spring),transform .35s var(--mri-spring)}',
    '.mri-av+.mri-av{margin-left:var(--ov)}',
    '.mri-acct:hover .mri-av+.mri-av{margin-left:calc(var(--ov) + var(--spread))}',
    '.mri-av img{width:100%;height:100%;border-radius:50%;display:block;object-fit:cover;pointer-events:none;transition:filter .3s}',
    '.mri-av.mri-vip::after{content:"";position:absolute;inset:-1px;border-radius:50%;background:conic-gradient(from 210deg,var(--ra),var(--rb) 25%,var(--rc) 45%,var(--rb) 70%,var(--ra));-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 1.6px),#000 calc(100% - 1.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 1.6px),#000 calc(100% - 1.5px));pointer-events:none}',
    '.mri-av.mri-gold{--ra:var(--mri-gold-a);--rb:var(--mri-gold-b);--rc:var(--mri-gold-c)}',
    '.mri-av.mri-jade{--ra:var(--mri-jade-a);--rb:var(--mri-jade-b);--rc:var(--mri-jade-c)}',
    '.mri-av.mri-exp img{filter:grayscale(1) brightness(.75)}',
    '.mri-av.mri-exp::before{content:"!";position:absolute;right:-3px;bottom:-3px;width:12px;height:12px;border-radius:50%;background:var(--mri-amber);color:#2a1800;font:800 9px/12px var(--mri-num);text-align:center;z-index:3;box-shadow:0 0 0 1.5px var(--mri-av-gap)}',
    '.mri-av.mri-eyes{background:radial-gradient(circle at 35% 30%,#454956,#16171c 70%);box-shadow:0 0 0 1.5px var(--mri-av-gap),inset 0 1px 0 rgba(255,255,255,.18)}',
    'body.mri-light .mri-av.mri-eyes{background:radial-gradient(circle at 35% 30%,#fffdf8,#e7dfd2 72%);box-shadow:0 0 0 1.5px var(--mri-av-gap),inset 0 0 0 1px rgba(90,60,30,.18)}',
    '.mri-eye{position:absolute;border-radius:50%;background:#f7f5f0;top:34%;overflow:hidden;animation:mri-blink 5.2s infinite}',
    'body.mri-light .mri-eye{background:#2a2118}',
    '.mri-eye.mri-big{width:34%;height:40%;left:17%}',
    '.mri-eye.mri-small{width:24%;height:29%;left:57%;top:40%}',
    '.mri-eye b{position:absolute;width:52%;height:52%;border-radius:50%;background:#16171c;left:24%;top:24%;transform:translate(calc(var(--ex,0)*45%),calc(var(--ey,0)*45%))}',
    'body.mri-light .mri-eye b{background:#fbf7ef}',
    '@keyframes mri-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}',

    // 账号卡片
    '.mri-card{position:absolute;top:' + CARD_TOP + 'px;right:0;width:300px;padding:8px;border-radius:20px;color:var(--mri-ink);',
    '  background:linear-gradient(180deg,var(--mri-isl1),var(--mri-isl2));-webkit-backdrop-filter:blur(30px) saturate(170%);backdrop-filter:blur(30px) saturate(170%);box-shadow:var(--mri-shadow),0 0 0 .5px rgba(0,0,0,.2);',
    '  opacity:0;transform:scale(.9) translateY(-6px);transform-origin:calc(100% - 40px) -8px;pointer-events:none;visibility:hidden;transition:opacity .18s ease,transform var(--mri-sd) var(--mri-spring),visibility 0s linear .2s;z-index:2}',
    '.mri-card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;padding:1px;background:linear-gradient(170deg,var(--mri-rim-a),transparent 40%,transparent 70%,var(--mri-rim-c));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.7}',
    '.mri-slot.mri-card-open .mri-card{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition:opacity .18s ease,transform var(--mri-sd) var(--mri-spring),visibility 0s}',
    '.mri-card .mri-sec{display:flex;justify-content:space-between;align-items:baseline;padding:6px 10px 4px;font-size:11px;color:var(--mri-ink3);letter-spacing:.06em}',
    '.mri-card hr{border:0;height:1px;background:var(--mri-line);margin:6px 8px}',
    '.mri-arow{display:flex;align-items:center;gap:11px;height:54px;padding:0 8px 0 10px;border-radius:13px;transition:background .15s}',
    '.mri-arow:hover{background:var(--mri-hover)}',
    '.mri-arow .mri-av{--sz:34px}',
    '.mri-arow .mri-nm{font-size:14px;color:var(--mri-ink);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mri-arow .mri-sub{font-size:11.5px;color:var(--mri-ink2);display:flex;gap:6px;align-items:center;white-space:nowrap;overflow:hidden}',
    '.mri-pdot{width:6px;height:6px;border-radius:50%;background:var(--pc);flex:none;box-shadow:0 0 6px var(--pc)}',
    '.mri-vtag{font:600 10px/1 var(--mri-sans);letter-spacing:.04em;color:var(--vt);padding:2px 5px;border-radius:4px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--vt) 45%,transparent)}',
    '.mri-xp{color:var(--mri-amber)}',
    '.mri-slot .mri-mg{margin-left:auto;font-size:12px;color:var(--mri-ink2);padding:5px 10px;border-radius:10px;flex:none;transition:background .15s,color .15s}',
    '.mri-slot .mri-mg:hover{background:var(--mri-hover2);color:var(--mri-ink)}',
    '.mri-slot .mri-mg.mri-hot{color:var(--mri-amber)}',
    '.mri-slot .mri-row{display:flex;align-items:center;gap:12px;width:100%;min-height:40px;padding:6px 10px;border-radius:12px;text-align:left;color:var(--mri-ink2);font-size:12.5px;transition:background .15s,color .15s}',
    '.mri-slot .mri-row:hover{background:var(--mri-hover);color:var(--mri-ink)}',
    '.mri-row .mri-ico{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;box-shadow:inset 0 0 0 1px var(--mri-line);flex:none}',
    '.mri-row .mri-ico .mri-ic{width:15px;height:15px}',
    '.mri-cta{display:flex;align-items:center;gap:12px;padding:10px}',
    '.mri-cta .mri-av{--sz:40px}',
    '.mri-cta .mri-t1{font-size:14px;font-weight:500}',
    '.mri-cta .mri-t2{font-size:11.5px;color:var(--mri-ink3)}',
    '.mri-slot .mri-btn{padding:7px 12px;border-radius:12px;background:var(--mri-ink);color:var(--mri-av-gap);font-size:12px;font-weight:600;white-space:nowrap}',
    '.mri-slot .mri-btn:hover{filter:brightness(1.08)}',
    '.mri-foot{padding:6px 10px 2px;font:11px/1.4 var(--mri-num);color:var(--mri-ink3);display:flex;justify-content:space-between}',
    '.mri-card .mri-it{opacity:0;transform:translateY(-5px);transition:opacity .2s ease,transform .45s var(--mri-spring)}',
    '.mri-slot.mri-card-open .mri-card .mri-it{opacity:1;transform:none;transition-delay:calc(var(--i,0)*22ms + 40ms)}',
    '@media (prefers-reduced-motion: reduce){.mri-slot *,.mri-slot *::before,.mri-slot *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;transition-delay:0s!important}}'
  ].join('\n');

  /* ---------- 图标 ---------- */
  var P = {
    home: '<path d="M4 11 12 4.5 20 11"/><path d="M6 9.6V19.5h12V9.6"/><path d="M10 19.5v-5h4v5"/>',
    wall: '<rect x="3" y="4" width="18" height="12.5" rx="1.8"/><path d="M8.5 20h7M12 16.5V20"/><path d="M6.5 13.5l3.6-3.8 2.6 2.5 1.8-1.7 3 3"/><circle cx="15.6" cy="7.7" r="1.1"/>',
    wallx: '<rect x="3" y="4" width="18" height="12.5" rx="1.8"/><path d="M8.5 20h7M12 16.5V20"/><path d="M9 12.8l6-5.6M10.6 7.2H15v4.4"/>',
    diy: '<path d="M4.5 7.5h8M17.5 7.5h2M4.5 16.5h2M11.5 16.5h8"/><circle cx="15" cy="7.5" r="2.2"/><circle cx="9" cy="16.5" r="2.2"/>',
    guide: '<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.7a2.45 2.45 0 1 1 3.4 2.25c-.62.28-1 .8-1 1.45v.45"/><path d="M12 16.9v.01" stroke-width="2.2"/>',
    eye: '<path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.9"/>',
    gear: '<circle cx="12" cy="12" r="2.8"/><path d="M12 3.2v2.3M12 18.5v2.3M20.8 12h-2.3M5.5 12H3.2M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6M18.2 18.2l-1.6-1.6M7.4 7.4 5.8 5.8"/><circle cx="12" cy="12" r="6.1"/>',
    up: '<path d="M12 17V7.5M7.8 11.5 12 7.3l4.2 4.2"/>',
    upc: '<circle cx="12" cy="12" r="8.6"/><path d="M12 16V8.4M8.8 11.4 12 8.2l3.2 3.2"/>',
    plus: '<path d="M12 6.5v11M6.5 12h11"/>',
    user: '<circle cx="12" cy="8.6" r="3.6"/><path d="M5.2 19.5c1.2-3.5 3.9-5.1 6.8-5.1s5.6 1.6 6.8 5.1"/>',
    warn: '<path d="M12 7.5v6"/><path d="M12 17v.01" stroke-width="2.4"/>',
    check: '<path d="M6.5 12.5l3.5 3.5 7.5-8"/>',
    msg: '<path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5z"/><path d="M8.5 9.5h7M8.5 12.2h4.5"/>'
  };
  function ic(n) { return '<svg class="mri-ic mri-ic-' + n + '" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + '</svg>'; }
  function ring() { return '<svg class="mri-ring" viewBox="0 0 24 24" aria-hidden="true"><circle class="mri-rb" cx="12" cy="12" r="10"/><circle class="mri-rp" cx="12" cy="12" r="10" pathLength="100"/></svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s, r) { return (r || SLOT).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || SLOT).querySelectorAll(s)); }
  function byId(id) { return document.getElementById(id); }
  function has(cls) { return !!(document.body && document.body.classList.contains(cls)); }

  /* ---------- 弹簧曲线（CSS linear()） ---------- */
  function springCurve(k, c) {
    var x = 0, v = 0, t = 0, dt = 1 / 600, s = [0];
    while (t < 2.5) { var a = -k * (x - 1) - c * v; v += a * dt; x += v * dt; t += dt; s.push(x); if (t > .25 && Math.abs(x - 1) < .0015 && Math.abs(v) < .02) break; }
    var N = 42, pts = []; for (var i = 0; i <= N; i++) pts.push(+s[Math.round(i / N * (s.length - 1))].toFixed(4));
    pts[N] = 1; return { e: 'linear(' + pts.join(',') + ')', d: Math.round(t * 1000) };
  }

  /* ---------- 从软件里读真实状态 ---------- */
  var PLAT = {
    netease: { pc: '#d95b67' }, qq: { pc: '#31c9a0' }, kugou: { pc: '#56e0ff' }, qishui: { pc: '#45d68f' }
  };
  function vipLabel(a) {
    if (a.pending) return '会员待同步';
    if (a.level === 'none') return '';
    if (a.p === 'netease') return a.level === 'svip' ? '黑胶SVIP' : '黑胶VIP';
    if (a.p === 'qq') return a.level === 'svip' ? '豪华绿钻' : '绿钻';
    return a.level === 'svip' ? 'SVIP' : 'VIP';
  }
  function ringCls(a) {
    if (a.pending || a.level === 'none') return '';
    return (a.p === 'qq' || a.p === 'qishui') ? ' mri-vip mri-jade' : ' mri-vip mri-gold';
  }
  // 头像地址缓存：原版 avatarSrc 每次都会拼一个 &v=时间戳，岛每 1.5 秒读一次状态，
  // 地址一变就重建 <img>，图还没加载完又被换掉，于是一直是黑的。按原始头像地址缓存一次就稳定了。
  var avCache = {}, avBad = {};
  function avFallback(p) {
    try { return typeof providerAvatarSrc === 'function' ? providerAvatarSrc(p, { avatar: '' }) : ''; } catch (_) { return ''; }
  }
  function avFor(p, st) {
    var raw = String(st && st.avatar || '');
    var k = p + '|' + raw;
    if (avBad[k]) return avFallback(p);
    if (!avCache[k]) {
      var v = '';
      try { v = typeof providerAvatarSrc === 'function' ? providerAvatarSrc(p, st) : ''; } catch (_) { }
      avCache[k] = v || avFallback(p);
    }
    return avCache[k];
  }
  function onAvError(e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.closest || !img.closest('.mri-av')) return;
    var k = img.getAttribute('data-avk');
    if (!k || avBad[k]) return;
    avBad[k] = true;
    var fb = avFallback(k.split('|')[0]);
    if (fb) img.src = fb;
  }
  function readAccounts() {
    var out = [];
    if (typeof hasPlatformLogin !== 'function' || typeof platformStatus !== 'function') return out;
    var order = typeof accountProviderOrder === 'function' ? accountProviderOrder() : ['netease', 'qq', 'kugou', 'qishui'];
    order.forEach(function (p) {
      if (!hasPlatformLogin(p)) return;
      var st = platformStatus(p) || {};
      var meta = typeof platformMeta === 'function' ? platformMeta(p) : { label: p };
      var a = {
        p: p,
        name: (p === 'qq' && st.preview) ? '待接入' : (typeof providerAccountIdentity === 'function' ? providerAccountIdentity(p, st) : (st.nickname || meta.label)),
        plat: meta.label || p,
        av: avFor(p, st),
        level: typeof providerVipLevel === 'function' ? providerVipLevel(p, st) : 'none',
        pending: typeof providerMembershipNeedsSync === 'function' ? !!providerMembershipNeedsSync(p, st) : false,
        stale: !!st.stale,
        raw: String(st.avatar || '')
      };
      a.vip = vipLabel(a);
      out.push(a);
    });
    return out;
  }
  function read() {
    var n = { accounts: [], stack: [], login: false, upd: 'none', ver: '', cur: '', wallAvail: false, wall: false, wallBusy: false, vis: false, prefs: false, home: false };
    try {
      n.accounts = readAccounts();
      n.login = n.accounts.length > 0;
      // 头像叠层：用户在登录面板里选了"显示在外面"的平台就只放那些，否则放全部已登录的
      var shown = typeof accountProviderExternalRenderList === 'function' ? accountProviderExternalRenderList() : [];
      var picked = n.accounts.filter(function (a) { return shown.indexOf(a.p) >= 0; });
      n.stack = (picked.length ? picked : n.accounts).map(function (a) { return a.p; });
    } catch (_) { }
    var u = byId('update-entry');
    if (u && u.classList.contains('available')) {
      n.upd = u.classList.contains('downloading') ? 'opening' : (u.classList.contains('ready') ? 'opened' : 'avail');
    }
    try {
      if (typeof updatePreviewState !== 'undefined' && updatePreviewState) {
        n.ver = String(updatePreviewState.version || '');
        n.cur = String(updatePreviewState.currentVersion || '');
      }
    } catch (_) { }
    var w = byId('desktop-bg-btn');
    n.wallAvail = !!(w && !w.hidden);
    n.wall = !!(w && w.classList.contains('is-on'));
    n.wallBusy = !!(w && w.getAttribute('aria-busy') === 'true');
    n.vis = has('nb-visual-open');
    n.prefs = has('nb-settings-open');
    n.home = has('empty-home-active');
    return n;
  }

  var S = read();
  S.card = false;
  var isl = { hover: false, focus: false, guide: false, note: null, noteT: 0, ht: 0, lt: 0, pending: null };
  function acct(p) { for (var i = 0; i < S.accounts.length; i++) if (S.accounts[i].p === p) return S.accounts[i]; return null; }
  function staleKey(st) { for (var i = 0; i < st.accounts.length; i++) if (st.accounts[i].stale) return st.accounts[i].p; return ''; }

  function avHTML(a, extra) {
    return '<span class="mri-av' + ringCls(a) + (a.stale ? ' mri-exp' : '') + '"' + (extra || '') + '><img src="' + esc(a.av) + '" data-avk="' + esc(a.p + '|' + a.raw) + '" alt="" draggable="false"></span>';
  }
  function eyesHTML() { return '<span class="mri-av mri-eyes"><i class="mri-eye mri-big"><b></b></i><i class="mri-eye mri-small"><b></b></i></span>'; }
  function tip(a) { return a.plat + ' · ' + a.name + (a.vip ? ' · ' + a.vip : '') + (a.stale ? ' · 登录可能已失效' : ''); }
  function stackHTML() {
    if (!S.login) return '<span class="mri-stack">' + eyesHTML() + '</span>';
    return '<span class="mri-stack">' + S.stack.map(function (p, i) {
      var a = acct(p); return a ? avHTML(a, ' style="z-index:' + (9 - i) + '" title="' + esc(tip(a)) + '"') : '';
    }).join('') + '</span>';
  }

  /* ---------- DOM ---------- */
  function build() {
    var r = document.createElement('div');
    r.id = 'mri-slot';
    r.className = 'mri-slot';
    r.setAttribute('role', 'region');
    r.setAttribute('aria-label', '账号与常用入口');
    r.innerHTML =
      '<div class="mri-isl" data-mode="mini">' +
        '<div class="mri-il mri-mini" aria-hidden="true" inert><span class="mri-mstack"></span><span class="mri-ist mri-hid"></span></div>' +
        '<div class="mri-il mri-full">' +
          '<button type="button" class="mri-acct" data-mri-act="acct" aria-haspopup="dialog" aria-expanded="false"></button><i class="mri-isep" aria-hidden="true"></i>' +
          '<button type="button" class="mri-lb" data-mri-act="wall" aria-pressed="false"></button>' +
          '<button type="button" class="mri-lb" data-mri-act="visual" aria-pressed="false" aria-haspopup="dialog" title="主页主题与播放页效果">' + ic('eye') + '<span>视觉</span></button>' +
          '<button type="button" class="mri-lb" data-mri-act="prefs" aria-pressed="false" aria-haspopup="dialog" title="设置（P）">' + ic('gear') + '<span>设置</span></button>' +
          // [二改 2026-09-28] 反馈放到小岛上，和「视觉」「设置」并排，谁都能一眼看到
          '<button type="button" class="mri-lb mri-fb' + (window.desktopWindow && typeof window.desktopWindow.feedbackSubmit === 'function' ? '' : ' mri-hid') + '" data-mri-act="feedback" aria-haspopup="dialog" title="给作者写反馈（不用登录）">' + ic('msg') + '<span>反馈</span></button>' +
          '<button type="button" class="mri-lb mri-upd mri-hid" data-mri-act="update"><span class="mri-ulic"></span><span class="mri-ul">新版本</span></button>' +
        '</div>' +
        '<div class="mri-il mri-note" role="status" aria-live="polite" inert></div>' +
      '</div>' +
      '<div class="mri-card" role="dialog" aria-label="账号与登录接入"></div>';
    return r;
  }

  function cardHTML() {
    var ver = S.cur ? 'Not Blind ' + esc(S.cur) : 'Not Blind';
    if (!S.login) {
      return '<div class="mri-cta mri-it" style="--i:0"><span class="mri-stack">' + eyesHTML() + '</span><div style="flex:1;min-width:0"><div class="mri-t1">还没有登录</div><div class="mri-t2">登录后同步歌单和每日推荐</div></div><button type="button" class="mri-btn" data-mri-act="login">登录</button></div>' +
        '<div class="mri-foot mri-it" style="--i:1"><span>' + ver + '</span><span>Esc 关闭</span></div>';
    }
    var i = 0;
    var rows = S.accounts.map(function (a) {
      i++;
      var vt = (a.p === 'qq' || a.p === 'qishui') ? 'var(--mri-jade-t)' : 'var(--mri-gold-t)';
      return '<div class="mri-arow mri-it" style="--i:' + i + '">' + avHTML(a) +
        '<div style="min-width:0;flex:1"><div class="mri-nm">' + esc(a.name) + '</div><div class="mri-sub"><i class="mri-pdot" style="--pc:' + ((PLAT[a.p] || PLAT.netease).pc) + '"></i>' + esc(a.plat) +
        (a.vip && !a.stale ? '<span class="mri-vtag" style="--vt:' + (a.pending ? 'var(--mri-ink3)' : vt) + '">' + esc(a.vip) + '</span>' : '') +
        (a.stale ? '<span class="mri-xp">· 可能已失效</span>' : '') + '</div></div>' +
        (a.stale
          ? '<button type="button" class="mri-mg mri-hot" data-mri-act="relogin" data-mri-p="' + a.p + '">重新登录</button>'
          : '<button type="button" class="mri-mg" data-mri-act="manage" data-mri-p="' + a.p + '" aria-label="管理' + esc(a.plat) + '账号">管理</button>') +
        '</div>';
    }).join('');
    var more = S.accounts.length < 4;
    return '<div class="mri-sec mri-it" style="--i:0"><span>账号</span><span>' + S.accounts.length + ' 个平台</span></div>' + rows +
      '<hr class="mri-it" style="--i:' + (++i) + '">' +
      (more ? '<button type="button" class="mri-row mri-it" style="--i:' + (++i) + '" data-mri-act="addlogin"><span class="mri-ico">' + ic('plus') + '</span><span>登录其他平台</span></button>' : '') +
      '<button type="button" class="mri-row mri-it" style="--i:' + (++i) + '" data-mri-act="settings"><span class="mri-ico">' + ic('user') + '</span><span>账号与登录设置</span></button>' +
      '<div class="mri-foot mri-it" style="--i:' + (++i) + '"><span>' + ver + '</span><span>Esc 关闭</span></div>';
  }

  /* ---------- 渲染 ---------- */
  function render() {
    if (!SLOT) return;
    var st = stackHTML();
    var m = $('.mri-mstack');
    if (m.innerHTML !== st) m.innerHTML = st;
    var ac = $('.mri-acct');
    if (ac.innerHTML !== st) ac.innerHTML = st;
    var xk = staleKey(S), xa = xk && acct(xk);
    ac.setAttribute('aria-label', !S.login ? '还没登录 · 打开登录' : (xa ? '账号（' + xa.plat + '登录可能已失效）' : '账号与登录接入'));
    ac.title = !S.login ? '登录账号' : S.accounts.map(tip).join('\n');
    ac.setAttribute('aria-expanded', S.card ? 'true' : 'false');

    if (HOME) {
      HOME.setAttribute('aria-pressed', S.home ? 'true' : 'false');
      HOME.title = S.home ? '主页（点正在播放的歌名进入播放页）' : '回到主页（Home）';
    }

    var w = $('[data-mri-act=wall]', $('.mri-full'));
    w.classList.toggle('mri-hid', !S.wallAvail);
    w.setAttribute('aria-pressed', S.wall ? 'true' : 'false');
    w.setAttribute('aria-busy', S.wallBusy ? 'true' : 'false');
    w.title = S.wall ? '回到窗口' : '设为桌面背景';
    var wh = ic(S.wall ? 'wallx' : 'wall') + '<span>' + (S.wall ? '回到窗口' : '桌面背景') + '</span>';
    if (w.getAttribute('data-k') !== String(S.wall)) { w.innerHTML = wh; w.setAttribute('data-k', String(S.wall)); }

    $('[data-mri-act=visual]', $('.mri-full')).setAttribute('aria-pressed', S.vis ? 'true' : 'false');
    $('[data-mri-act=prefs]', $('.mri-full')).setAttribute('aria-pressed', S.prefs ? 'true' : 'false');

    var u = $('.mri-upd');
    u.classList.toggle('mri-hid', S.upd === 'none');
    var uk = S.upd;
    if (u.getAttribute('data-k') !== uk) {
      $('.mri-ulic', u).innerHTML = S.upd === 'opening' ? ring() : ic(S.upd === 'opened' ? 'check' : 'upc');
      $('.mri-ul', u).textContent = S.upd === 'opening' ? '正在打开' : (S.upd === 'opened' ? '已打开' : '新版本');
      u.setAttribute('data-k', uk);
    }
    u.title = S.upd === 'opening' ? '正在打开下载页' : (S.ver ? '发现新版本 v' + S.ver : '发现新版本');
    u.setAttribute('aria-label', u.title);

    SLOT.classList.toggle('mri-card-open', !!S.card);
    if (S.card) {
      var cd = $('.mri-card'), had = cd.contains(document.activeElement), html = cardHTML();
      if (cd.__mriHtml !== html) {
        cd.innerHTML = html; cd.__mriHtml = html;
        if (had) { var f = $('.mri-card button'); if (f) f.focus({ preventScroll: true }); }
      }
    }
    status();
  }
  /* 收起态的状态小图标：打开下载页 > 新版本 > 登录可能失效 > 桌面背景 > 无（只剩头像） */
  function status() {
    var st = $('.mri-ist'), h = '', t = '';
    if (S.upd === 'opening') { h = ring(); t = '正在打开下载页'; }
    else if (S.upd !== 'none') { h = '<span style="color:var(--mri-accent);filter:drop-shadow(0 0 5px var(--mri-accent-glow))">' + ic('upc') + '</span>'; t = S.ver ? '发现新版本 v' + S.ver : '发现新版本'; }
    else if (staleKey(S)) { h = '<span style="color:var(--mri-amber)">' + ic('warn') + '</span>'; t = acct(staleKey(S)).plat + '登录可能已失效'; }
    else if (S.wall) { h = '<span style="color:var(--mri-accent)">' + ic('wall') + '</span>'; t = '桌面背景模式'; }
    if (st.getAttribute('data-h') !== h) { st.innerHTML = h; st.setAttribute('data-h', h); }
    st.classList.toggle('mri-hid', !h);
    st.title = t;
    size();
  }
  function size() {
    if (!SLOT) return;
    var el = $('.mri-isl');
    // 视觉 / 设置面板开着时岛保持展开，按下的那个按钮一直看得见
    var mode = isl.note ? 'note' : (isl.hover || isl.focus || S.card || isl.guide || S.vis || S.prefs) ? 'full' : 'mini';
    var layer = $('.mri-' + mode, el), w = layer.offsetWidth, h = ISLH[mode];
    if (w > 0) el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.borderRadius = (h / 2) + 'px';
    el.dataset.mode = mode;
    $$('.mri-il', el).forEach(function (x) { x.setAttribute('aria-hidden', x.classList.contains('mri-' + mode) ? 'false' : 'true'); });
    var full = $('.mri-full', el), note = $('.mri-note', el);
    if (mode === 'note') { full.setAttribute('inert', ''); note.removeAttribute('inert'); }
    else { full.removeAttribute('inert'); note.setAttribute('inert', ''); }
    shield(h);
  }
  // 桌面背景模式下，主进程只把 #top-right 的方框当成"软件按钮"，方框外的点击会穿到 Windows 桌面。
  // 所以挂在 #top-right 时，让插槽的方框把展开的岛和卡片都包进去。
  function shield(h) {
    var extra = 0;
    if (HOST === 'tr') {
      extra = Math.max(0, (h || 36) - 36);
      if (S.card) { var cd = $('.mri-card'); extra = Math.max(extra, CARD_TOP + (cd.offsetHeight || 0) + 8 - 36); }
    }
    var v = extra ? extra + 'px' : '';
    if (SLOT.style.paddingBottom !== v) SLOT.style.paddingBottom = v;
  }

  /* ---------- 通知：自己展开约 3 秒再收回 ---------- */
  var NOTES = {
    update: function () { return { i: ic('up'), c: 'mri-acc', t: S.ver ? '发现新版本 v' + S.ver : '发现新版本', s: '看看这次更新了什么', a: ['查看', 'update'] }; },
    opening: function () { return { i: ring(), c: '', t: '正在打开下载页', s: '会在系统浏览器里打开', a: null }; },
    opened: function () { return { i: ic('check'), c: 'mri-acc', t: '下载页已在浏览器打开', s: '软件不会在本地下载或打补丁', a: null }; },
    expired: function () { var a = acct(staleKey(S)) || { plat: '', p: '' }; return { i: ic('warn'), c: 'mri-warn', t: a.plat + '登录可能已失效', s: '重新登录后继续同步歌单', a: ['重新登录', 'relogin', a.p] }; },
    wallon: function () { return { i: ic('wall'), c: 'mri-acc', t: '已设为桌面背景', s: '点这里的"回到窗口"就能回来', a: ['回到窗口', 'wall'] }; },
    walloff: function () { return { i: ic('wallx'), c: '', t: '已回到窗口', s: '桌面背景已关闭', a: null }; },
  };
  function visible() {
    if (!SLOT || !SLOT.isConnected || has('immersive-mode')) return false;
    if (has('splash-active') && !has('splash-revealing')) return false;
    var host = HOST === 'tb' ? byId('desktop-titlebar') : byId('top-right');
    if (!host) return false;
    var cs = getComputedStyle(host);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
  }
  function notify(kind) {
    if (!SLOT || !NOTES[kind]) return false;
    if (has('splash-active')) { isl.pending = kind; return false; } // 开屏还在，等进去再说
    if (!visible()) return false;
    var n = NOTES[kind](), box = $('.mri-note');
    box.innerHTML = '<span class="mri-nic ' + n.c + '">' + n.i + '</span><span class="mri-nt"><b>' + esc(n.t) + '</b><small>' + esc(n.s) + '</small></span>' +
      (n.a ? '<button type="button" class="mri-na" data-mri-act="' + n.a[1] + '"' + (n.a[2] ? ' data-mri-p="' + n.a[2] + '"' : '') + '>' + n.a[0] + '</button>' : '');
    isl.note = kind; size();
    clearTimeout(isl.noteT);
    var done = function () {
      if (isl.hover || box.contains(document.activeElement)) { isl.noteT = setTimeout(done, 1200); return; }
      isl.note = null; size();
    };
    isl.noteT = setTimeout(done, 3200);
    return true;
  }

  /* ---------- 卡片 ---------- */
  var kbd = false;
  function openCard() { if (S.card) return; S.card = true; render(); var f = $('.mri-card button'); if (f && kbd) f.focus({ preventScroll: true }); }
  function closeCard(refocus) { if (!S.card) return; S.card = false; render(); if (refocus) $('.mri-acct').focus({ preventScroll: true }); }

  /* ---------- 动作：都去点旧按钮 / 调原来的函数 ---------- */
  function clickOld(id, fallback) {
    var b = byId(id);
    if (b) { b.click(); return true; }
    if (typeof fallback === 'function') { try { fallback(); } catch (e) { console.warn('[top-island]', e); } }
    return false;
  }
  function openLogin(p) {
    if (typeof showLoginModal === 'function') { showLoginModal({ provider: p, source: 'top-account' }); return; }
    clickOld('user-btn', typeof onUserBtnClick === 'function' ? onUserBtnClick : null);
  }
  function act(name, el) {
    switch (name) {
      case 'home': clickOld('home-btn', typeof goHome === 'function' ? goHome : null); break;
      case 'wall': clickOld('desktop-bg-btn'); break;
      case 'visual': if (typeof toggleNbVisualSheet === 'function') toggleNbVisualSheet(); break;
      case 'prefs': if (typeof toggleFxPanel === 'function') toggleFxPanel(); break;
      case 'feedback': if (typeof window.openNbFeedback === 'function') window.openNbFeedback(); break;
      case 'update': clickOld('update-entry', typeof openUpdatePanel === 'function' ? openUpdatePanel : null); break;
      case 'acct': S.card ? closeCard(false) : openCard(); break;
      case 'manage': case 'relogin': closeCard(false); openLogin(el.getAttribute('data-mri-p') || undefined); break;
      case 'addlogin':
        closeCard(false);
        var next = ['netease', 'qq', 'kugou', 'qishui'].filter(function (p) { return !acct(p); })[0];
        openLogin(next);
        break;
      case 'settings': case 'login': closeCard(false); clickOld('user-btn', typeof onUserBtnClick === 'function' ? onUserBtnClick : null); break;
    }
    // 岛的状态跟着旧按钮变，稍后再读一次
    setTimeout(schedule, 60);
  }

  /* ---------- 明暗 ---------- */
  var TONE_TH = '';
  function tone() {
    // 主页主题显示时按主题的明暗；播放页上浅色歌词特效（网点校样、光斑）铺满时也按浅色，
    // 不然右上角的主页 / 窗口按钮是浅灰白，印在米白纸面上几乎看不见
    var light = has('home-theme-on') ? has('hth-chrome-light') : (has('nb-lfx-light') && !has('immersive-mode'));
    if (has('mri-light') !== light) document.body.classList.toggle('mri-light', light);
    // 主页主题显示时，岛跟着换成那套主题的配色（目前只有回声有专门的一套，其它主题用默认深色 / 浅色）
    var th = '';
    try { if (has('home-theme-on') && typeof homeThemeHost === 'object' && homeThemeHost) th = String(homeThemeHost.current || ''); } catch (_e) { th = ''; }
    if (th !== TONE_TH) {
      if (TONE_TH) document.body.classList.remove('mri-th-' + TONE_TH);
      if (th) document.body.classList.add('mri-th-' + th);
      TONE_TH = th;
    }
  }

  /* ---------- 挂到哪：标题栏 or #top-right ---------- */
  function wantHost() {
    var tb = byId('desktop-titlebar');
    if (tb && has('desktop-shell')) {
      var d = getComputedStyle(tb).display;
      if (d !== 'none' && tb.querySelector('.desktop-window-controls')) return 'tb';
    }
    return 'tr';
  }
  function placeHost() {
    var want = wantHost();
    if (want === HOST && SLOT.parentNode) return;
    var parent, before = null;
    if (want === 'tb') {
      parent = byId('desktop-titlebar').querySelector('.desktop-window-controls');
      before = parent.querySelector('.desktop-window-btn');
    } else {
      parent = byId('top-right');
    }
    if (!parent) return;
    if (S.card) { S.card = false; SLOT.classList.remove('mri-card-open'); }
    isl.hover = false;
    if (before) parent.insertBefore(SLOT, before); else parent.appendChild(SLOT);
    if (HOME) parent.insertBefore(HOME, SLOT.nextSibling);
    HOST = want;
    document.body.classList.toggle('mri-host-tb', want === 'tb');
    document.body.classList.toggle('mri-host-tr', want === 'tr');
    render();
  }

  /* ---------- 刷新 ---------- */
  var lastSig = '', baseline = false, rafId = 0;
  function refresh() {
    var n = read();
    var sig = JSON.stringify(n);
    if (sig === lastSig) return;
    lastSig = sig;
    var o = S; n.card = o.card; S = n;
    if (S.card && !document.body.contains(SLOT)) S.card = false;
    render();
    if (!baseline) return;
    // 播放 / 暂停 / 切歌不在这里——只有这些会让岛自己说一句
    if (o.upd !== S.upd) {
      if (S.upd === 'avail' && o.upd === 'none') notify('update');
      else if (S.upd === 'opening') notify('opening');
      else if (S.upd === 'opened') notify('opened');
    } else if (o.wall !== S.wall) notify(S.wall ? 'wallon' : 'walloff');
    else { var xs = staleKey(S); if (xs && xs !== staleKey(o)) notify('expired'); }
  }
  function tick() {
    rafId = 0;
    if (!SLOT) return;
    // 用户原来开着"自动隐藏账号胶囊"的话，新样式下不需要了（岛本来就小），别让 #top-right 缩出屏幕
    if (has('user-capsule-auto-hide')) document.body.classList.remove('user-capsule-auto-hide', 'user-capsule-peek');
    placeHost();
    tone();
    refresh();
    if (isl.guide && typeof visualGuideActive !== 'undefined' && !visualGuideActive) { isl.guide = false; size(); }
    if (isl.pending && !has('splash-active')) { var k = isl.pending; isl.pending = null; setTimeout(function () { notify(k); }, 900); }
  }
  function schedule() { if (!rafId) rafId = requestAnimationFrame(tick); }

  /* ---------- 事件 ---------- */
  function bind() {
    var el = $('.mri-isl');
    el.addEventListener('pointerenter', function () { clearTimeout(isl.lt); clearTimeout(isl.ht); isl.ht = setTimeout(function () { isl.hover = true; size(); }, RM.matches ? 0 : 110); });
    el.addEventListener('pointerleave', function () { clearTimeout(isl.ht); isl.lt = setTimeout(function () { isl.hover = false; size(); }, RM.matches ? 0 : 380); });
    // 只有键盘（Tab）进来才靠焦点撑开；鼠标点过的按钮留着焦点不该让岛一直开着
    el.addEventListener('focusin', function (e) { var fv = false; try { fv = e.target.matches(':focus-visible'); } catch (_) { } isl.focus = fv; size(); });
    el.addEventListener('focusout', function (e) { if (!el.contains(e.relatedTarget)) { isl.focus = false; size(); } });
    SLOT.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-mri-act]'); if (!a || !SLOT.contains(a)) return;
      e.preventDefault();
      kbd = e.detail === 0;
      var name = a.getAttribute('data-mri-act');
      if (S.card && name !== 'acct' && !$('.mri-card').contains(a)) closeCard(false);
      act(name, a);
    });
    // 拖图片会把窗口拖走 / 拖出幽灵图，禁掉
    SLOT.addEventListener('dragstart', function (e) { e.preventDefault(); });
    // Esc：卡片开着时只关卡片
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && S.card) { e.stopPropagation(); e.preventDefault(); closeCard(SLOT.contains(document.activeElement)); }
    }, true);
    document.addEventListener('pointerdown', function (e) { if (S.card && !SLOT.contains(e.target)) closeCard(false); }, true);
    // 未登录的小眼睛跟着光标（只读指针位置）
    addEventListener('pointermove', function (e) {
      if (S.login || !SLOT) return;
      $$('.mri-av.mri-eyes').forEach(function (a) {
        var r = a.getBoundingClientRect(); if (!r.width) return;
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 120);
        a.style.setProperty('--ex', (dx / m * k).toFixed(2)); a.style.setProperty('--ey', (dy / m * k).toFixed(2));
      });
    }, { passive: true });
    addEventListener('resize', function () { schedule(); size(); }, { passive: true });
    document.addEventListener('fullscreenchange', schedule);

    if (typeof MutationObserver === 'function') {
      var mo = new MutationObserver(schedule);
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      ['update-entry', 'diy-mode-btn', 'desktop-bg-btn', 'user-btn'].forEach(function (id) {
        var t = byId(id); if (t) mo.observe(t, { attributes: true, attributeFilter: ['class', 'aria-busy', 'aria-pressed', 'hidden', 'title'], childList: id === 'user-btn', subtree: id === 'user-btn' });
      });
      // 桌面背景按钮是后挂上的
      var tr = byId('top-right');
      if (tr) new MutationObserver(function () {
        var b = byId('desktop-bg-btn');
        if (b && !b.__mriObs) { b.__mriObs = true; mo.observe(b, { attributes: true, attributeFilter: ['class', 'aria-busy', 'hidden'] }); schedule(); }
      }).observe(tr, { childList: true });
      var b0 = byId('desktop-bg-btn'); if (b0) b0.__mriObs = true;
    }
    // 登录状态（过期、会员）不一定动 DOM，低频兜底
    setInterval(schedule, 1500);
  }

  /* ---------- 和原逻辑的几处对接 ---------- */
  function hookGlobals() {
    // 这些提示岛自己会说，就不再弹一遍中间的 toast（岛看不见时照常弹）
    var QUIET = { 'DIY 玩家模式已开启': 1, '已切回简约模式': 1, '已在浏览器打开网盘下载页': 1, '已在浏览器打开更新页面': 1, 'QQ 音乐登录状态可能已失效': 1 };
    if (typeof window.showToast === 'function' && !window.showToast.__mri) {
      var origToast = window.showToast;
      var wrapped = function (msg) {
        try { if (QUIET[msg] && visible()) return; } catch (_) { }
        return origToast.apply(this, arguments);
      };
      wrapped.__mri = true;
      window.showToast = wrapped;
    }
    // 使用引导里"账号""视觉""设置"三步圈岛上对应的按钮
    if (typeof window.guideTargetRect === 'function' && !window.guideTargetRect.__mri) {
      var origRect = window.guideTargetRect;
      var g = function (step) {
        var sel = step && step.selector;
        var ISL_SEL = { '#user-btn': '.mri-acct', '#nb-visual-btn': '[data-mri-act=visual]', '#nb-settings-btn': '[data-mri-act=prefs]', '#diy-mode-btn': '[data-mri-act=visual]', '#desktop-bg-btn': '[data-mri-act=wall]' };
        if (SLOT && ISL_SEL[sel] && visible()) {
          if (!isl.guide) {
            isl.guide = true; size();
            setTimeout(function () { if (typeof scheduleVisualGuidePositioning === 'function') scheduleVisualGuidePositioning(); }, 620);
          }
          var t = $(ISL_SEL[sel]);
          var r = t && t.getBoundingClientRect();
          if (r && r.width > 0) return r;
        } else if (isl.guide) { isl.guide = false; size(); }
        return origRect.apply(this, arguments);
      };
      g.__mri = true;
      window.guideTargetRect = g;
    }
    // 3D 场景 / 歌单架的指针判断把岛当成 UI（卡片会伸到舞台上）
    try { if (typeof UI_HIT_SELECTOR === 'string' && UI_HIT_SELECTOR.indexOf('#mri-slot') < 0) UI_HIT_SELECTOR += ',#mri-slot'; } catch (_) { }
  }

  /* ---------- 挂载 ---------- */
  function mount() {
    if (SLOT || !document.body || !byId('top-right')) return;
    var style = document.createElement('style');
    style.id = 'mri-style';
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);
    SLOT = build();
    HOME = document.createElement('button');
    HOME.type = 'button';
    HOME.id = 'mri-home';
    HOME.setAttribute('aria-label', '主页');
    HOME.setAttribute('aria-pressed', 'false');
    HOME.innerHTML = ic('home');
    HOME.addEventListener('click', function (e) { e.preventDefault(); act('home'); });
    if (SLOT && !SLOT.__mriAvErr) { SLOT.__mriAvErr = true; SLOT.addEventListener('error', onAvError, true); }
    if (window.CSS && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)')) {
      var a = springCurve(300, 21), b = springCurve(210, 22);
      SLOT.style.setProperty('--mri-spring', a.e); SLOT.style.setProperty('--mri-sd', a.d + 'ms');
      SLOT.style.setProperty('--mri-spring-soft', b.e); SLOT.style.setProperty('--mri-sds', b.d + 'ms');
    }
    document.body.classList.add('mri-on');
    if (has('user-capsule-auto-hide')) document.body.classList.remove('user-capsule-auto-hide', 'user-capsule-peek');
    placeHost();
    bind();
    hookGlobals();
    tone();
    var el = $('.mri-isl'); el.style.transition = 'none'; lastSig = ''; refresh(); render(); void el.offsetWidth; el.style.transition = '';
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { size(); });
    // 启动时各种状态（DIY、登录）陆续就位，这段时间不算"变化"，不弹通知
    setTimeout(function () { refresh(); baseline = true; }, 2500);
  }

  window.MRTopIsland = {
    get state() { var o = {}; for (var k in S) o[k] = S[k]; o.host = HOST; o.mode = SLOT && $('.mri-isl').dataset.mode; return o; },
    notify: function (k) { return notify(k); },
    refresh: schedule
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
