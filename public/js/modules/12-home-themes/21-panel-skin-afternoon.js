// ============================================================
// 午后窗影 · 左侧歌单栏皮肤
// - 整栏是一块贴在墙上的纸板，纸色和阴影跟着午后阳光走；入夜（19–6 点）和播放页上压暗、偏旧
// - 当前队列 = 一叠明信片：正在听的那张用纸胶带贴着（红色"在听"小印、邮票、邮戳里是播放位置），
//   后面的错落压着只露抬头，最底下一张整张露出来；悬停往右抽出，露出 喜欢 / 下一首 / 收藏 / 移除
// - 我的歌单 = 书架（布面书脊、烫印横线、旧纸标签、竖排书名按书高缩字号），点书 = 翻开成目录页
// - 我的播客 = 杂志架（封面朝外，每排两本，刊名、期数、几何插画、条形码）
// 只改外观 + 插装饰节点（data-skin-deco），原来的点击、长按拖动排序、虚拟列表都不动
// ============================================================
(function () {
  var S = 'body[data-panel-skin="afternoon"]';
  var P = S + ' #playlist-panel';
  function dark(sel) { return S + ' #playlist-panel.aw-night ' + sel + ',' + S + '[data-hth-page="stage"] #playlist-panel ' + sel; }
  function darkSelf(extra) { return S + ' #playlist-panel.aw-night' + (extra || '') + ',' + S + '[data-hth-page="stage"] #playlist-panel' + (extra || ''); }

  var FONTS = [
    '--aw-serif:"SimSun","宋体","STSong","Noto Serif CJK SC","Source Han Serif SC",serif',
    '--aw-kai:"KaiTi","楷体","STKaiti","AR PL UKai CN","Noto Serif CJK SC",serif',
    '--aw-fang:"FangSong","仿宋","STFangsong","Noto Serif CJK SC",serif',
    '--aw-latin:Georgia,"Noto Serif CJK SC","DejaVu Serif",serif'
  ].join(';');
  // 纸面按钮：去掉原来的毛玻璃胶囊
  var FLAT = 'background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important;min-width:0!important;';
  var PAPER_BG = 'background-color:var(--aw-paper)!important;background-image:var(--aw-sun,none),var(--aw-noise)!important;background-blend-mode:normal,multiply!important;background-size:100% 1400px,auto!important;background-repeat:no-repeat,repeat!important;';

  var css = [
    // ---------------- 纸板本身 ----------------
    P + '{' + FONTS + ';--aw-paper:#e4dccd;--aw-ink:#2b241d;--aw-ink2:rgba(43,36,29,.58);--aw-ink3:rgba(43,36,29,.38);--aw-line:rgba(43,36,29,.14);--aw-red:#9b3b25;' +
      '--aw-wood1:#b48d62;--aw-wood2:#86633f;--aw-sx:-4px;--aw-sy:5px;--aw-top:44px;--aw-tool:34px;' +
      'color:var(--aw-ink)!important;font-family:var(--aw-serif)!important;padding:0 14px 22px 18px!important;border:0!important;border-radius:3px!important;' +
      'background-color:var(--aw-paper)!important;background-image:var(--aw-sun,none),var(--aw-noise)!important;background-blend-mode:normal,multiply!important;background-size:100% 1400px,auto!important;background-repeat:no-repeat,repeat!important;background-position:0 0,0 0!important;' +
      'box-shadow:var(--aw-sx) var(--aw-sy) 24px rgba(66,46,26,.26),calc(var(--aw-sx)*.3) calc(var(--aw-sy)*.3) 3px rgba(66,46,26,.16),inset 0 0 0 1px rgba(90,70,50,.10),inset 0 1px 0 rgba(255,255,255,.45)!important;' +
      'backdrop-filter:none!important;-webkit-backdrop-filter:none!important;scrollbar-width:none!important}',
    P + '::-webkit-scrollbar{width:0!important;display:none}',
    S + '[data-hth-page="home"] #playlist-panel{height:100vh!important}',
    P + ' .queue-toolbar{background-position:0 calc(-1 * var(--aw-top)),0 0!important}',
    P + '.pinned{border:0!important}',
    P + ' *{font-family:inherit}',
    // 入夜 / 播放页：暗木色的墙洞 + 台灯的暖光
    darkSelf() + '{--aw-paper:#1f1d21;--aw-ink:#efe5d4;--aw-ink2:rgba(233,223,207,.55);--aw-ink3:rgba(233,223,207,.36);--aw-line:rgba(233,223,207,.12);--aw-red:#d9826a;--aw-wood1:#5a4331;--aw-wood2:#35271c;' +
      'box-shadow:0 20px 60px rgba(0,0,0,.42),0 0 0 1px rgba(255,255,255,.06),inset 0 1px 0 rgba(255,255,255,.05)!important}',

    // ---------------- 顶部：分页标签 + 钉子 ----------------
    P + ' .playlist-panel-sticky{position:sticky!important;top:0!important;z-index:9!important;display:flex!important;align-items:center;gap:8px;height:var(--aw-top);box-sizing:border-box;margin:0 -14px 0 -18px!important;padding:12px 12px 0 26px!important;border:0!important;border-radius:3px 3px 0 0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;isolation:auto!important;' + PAPER_BG + '}',
    P + ' .playlist-panel-sticky::after{display:none!important}',
    P + ' .queue-head{display:contents!important}',
    P + ' .queue-head>div:first-child{display:none!important}',
    P + ' .queue-head-act{order:2;margin-left:auto;gap:2px!important}',
    P + ' .queue-head-act>button:not(#playlist-pin-btn){display:none!important}',
    P + ' .panel-tabs{order:1;display:flex!important;gap:15px!important;margin:0!important;min-width:0}',
    P + ' .panel-tab{' + FLAT + 'position:relative;padding:4px 0!important;font-size:13.5px!important;letter-spacing:.2em!important;color:var(--aw-ink3)!important;white-space:nowrap;font-weight:400!important;transition:color .2s!important;cursor:pointer}',
    P + ' .panel-tab:hover{color:var(--aw-ink)!important;background:none!important}',
    P + ' .panel-tab.active{color:var(--aw-ink)!important;background:none!important}',
    P + ' .panel-tab.active::after{content:"";position:absolute;left:0;right:.2em;bottom:-2px;height:1px;background:currentColor}',
    P + ' #playlist-pin-btn{' + FLAT + 'width:26px!important;height:26px!important;padding:0!important;display:grid!important;place-items:center;color:var(--aw-ink3)!important;transition:transform .35s cubic-bezier(.2,1.5,.3,1),color .2s!important}',
    P + ' #playlist-pin-btn:hover{color:var(--aw-ink)!important;background:none!important}',
    P + ' #playlist-pin-btn.active{color:var(--aw-red)!important;transform:rotate(-38deg);background:none!important}',
    P + ' #playlist-pin-btn svg{width:15px;height:15px}',

    // ---------------- 工具行：纸面小字按钮 ----------------
    P + ' .queue-toolbar{position:sticky!important;top:var(--aw-top)!important;z-index:8!important;display:flex!important;flex-wrap:wrap;align-items:baseline!important;justify-content:flex-start!important;gap:3px 15px!important;min-height:var(--aw-tool);box-sizing:border-box;margin:0 -14px 2px -18px!important;padding:9px 12px 6px 26px!important;border:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;' + PAPER_BG + 'font-size:11.5px;letter-spacing:.2em;color:var(--aw-ink2)}',
    P + ' .queue-toolbar>div:not(.queue-chip):not([data-skin-deco]){display:contents!important}',
    P + ' .queue-chip{' + FLAT + 'display:inline!important;height:auto!important;padding:0!important;font-size:11.5px!important;letter-spacing:.2em;color:var(--aw-ink2)!important;white-space:nowrap}',
    P + ' .queue-toolbar .fx-mini-btn,' + P + ' .queue-toolbar .aw-tbtn{' + FLAT + 'display:inline!important;flex:none!important;width:auto!important;height:auto!important;padding:0!important;font-size:11.5px!important;letter-spacing:.2em!important;line-height:1.4!important;color:var(--aw-ink2)!important;white-space:nowrap;font-weight:400!important;cursor:pointer;transition:color .2s!important}',
    P + ' .queue-toolbar .fx-mini-btn:hover,' + P + ' .queue-toolbar .aw-tbtn:hover{color:var(--aw-ink)!important;background:none!important}',
    // 队列：模式名本身就是按钮（"切换模式"按钮透明地盖在模式名上）
    P + ' #queue-pane .queue-toolbar{position:sticky!important}',
    P + ' #play-mode-chip{order:1;color:var(--aw-ink)!important;border-bottom:1px dotted var(--aw-ink3)!important;padding-bottom:1px!important}',
    P + ' #queue-pane .aw-mode-btn{position:absolute!important;left:22px;top:6px;width:64px!important;height:22px!important;font-size:0!important;color:transparent!important;z-index:2}',
    P + ' #queue-pane .queue-toolbar:has(.aw-mode-btn:hover) #play-mode-chip{border-bottom-style:solid!important}',
    P + ' #queue-pane .aw-shuf{order:2}',
    P + ' #queue-pane .aw-clear{order:3}',
    P + ' #queue-pane .aw-hint,' + P + ' .queue-toolbar .aw-hint{order:4;margin-left:auto;color:var(--aw-ink3);font-size:10.5px;letter-spacing:.18em;white-space:nowrap}',
    P + ' #queue-pane .aw-qnote{order:5;flex:0 0 100%;margin-top:7px;font-family:var(--aw-kai);font-size:13px;letter-spacing:.06em;color:var(--aw-ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' #queue-pane .aw-qnote b{font-weight:400;color:var(--aw-ink)}',
    P + ' .aw-clear.aw-warn{color:var(--aw-red)!important}',
    // 歌单 / 播客：提示小字靠右
    P + ' #pl-pane .queue-chip,' + P + ' #podcast-pane .queue-chip{order:5;margin-left:auto;font-size:10.5px!important;letter-spacing:.14em;color:var(--aw-ink3)!important}',
    P + ' #pl-pane .queue-toolbar .fx-mini-btn:last-child::before,' + P + ' #podcast-pane .queue-toolbar>.fx-mini-btn::before{content:"↻ ";letter-spacing:0}',

    // ---------------- 当前队列：一叠明信片 ----------------
    P + ' #queue-list{display:flex!important;flex-direction:column!important;gap:0!important;margin:0!important;padding:10px 4px 26px 2px!important;min-height:0}',
    P + ' #queue-list .queue-item{--H:118px;--pp:#f1e9d6;--ink:#26324d;position:relative!important;display:block!important;box-sizing:border-box!important;height:var(--H)!important;min-height:0!important;' +
      'width:calc(var(--aw-w,100%) - var(--aw-x,0px))!important;margin:0 0 calc(48px - var(--H)) var(--aw-x,0px)!important;padding:0!important;border:0!important;border-radius:1.5px!important;color:var(--ink)!important;' +
      'background-color:var(--pp)!important;background-image:var(--aw-noise),linear-gradient(168deg,rgba(255,255,255,.34),rgba(255,255,255,0) 42%,rgba(90,60,30,.06) 100%)!important;background-blend-mode:multiply,normal!important;' +
      'box-shadow:inset 0 0 0 .5px rgba(70,50,30,.16),inset 0 1px 0 rgba(255,255,255,.55),0 .5px 1px rgba(40,28,16,.28),calc(var(--aw-sx)*.55) calc(var(--aw-sy)*.55 + 2px) 6px rgba(50,34,20,.26)!important;' +
      'rotate:var(--aw-r,0deg)!important;translate:0 0!important;transition:translate .38s cubic-bezier(.2,1.3,.3,1),rotate .38s cubic-bezier(.2,1.3,.3,1),box-shadow .25s,filter .3s!important;cursor:pointer;overflow:visible!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;font-family:var(--aw-kai)!important}',
    P + ' #queue-list .queue-item.aw-k1{--pp:#f3efe6}',
    P + ' #queue-list .queue-item.aw-k2{--pp:#dcc6a0;--ink:#3a2a1c}',
    P + ' #queue-list .queue-item.aw-k3{--pp:#e2e4dc}',
    P + ' #queue-list .queue-item.aw-k4{--pp:#eddcb6;--ink:#3a2a1c}',
    P + ' #queue-list .queue-item.aw-brown{--ink:#3e2c1e}',
    // 航空信封的红蓝斜纹边
    P + ' #queue-list .queue-item.aw-air::before{content:"";position:absolute;inset:0;padding:3.5px;border-radius:inherit;pointer-events:none;opacity:.8;z-index:0;' +
      'background:repeating-linear-gradient(135deg,#b3392f 0 5px,transparent 0 9px,#2d4f86 0 14px,transparent 0 18px);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}',
    // 右下角一点点翘起
    P + ' #queue-list .queue-item::after{content:"";position:absolute;right:0;bottom:0;width:22px;height:16px;pointer-events:none;border-radius:0 0 1.5px 0;background:linear-gradient(135deg,transparent 45%,rgba(0,0,0,.07) 60%,rgba(255,255,255,.35) 100%)}',
    P + ' #queue-list .queue-item:hover{translate:7px 0!important;rotate:0deg!important;background-color:var(--pp)!important;box-shadow:inset 0 0 0 .5px rgba(70,50,30,.16),inset 0 1px 0 rgba(255,255,255,.55),0 .5px 1px rgba(40,28,16,.28),calc(var(--aw-sx)*.8) calc(var(--aw-sy)*.8 + 4px) 12px rgba(50,34,20,.32)!important}',
    P + ' #queue-list .queue-item.now{--H:164px;width:100%!important;margin:14px 0 22px 0!important;z-index:2;rotate:-.8deg!important;cursor:pointer}',
    P + ' #queue-list .queue-item.now:hover{translate:0 -2px!important;rotate:-.3deg!important}',
    P + ' #queue-list .queue-item.aw-past{filter:saturate(.55) brightness(.97)!important;opacity:.78}',
    P + ' #queue-list .queue-item.aw-past:hover{filter:none!important;opacity:1}',
    // 原来的封面 = 邮票上的图；没有封面时用哈希画的小图兜底
    P + ' #queue-list .queue-item>img{position:absolute!important;right:11.5px;top:8.5px;width:25px!important;height:31px!important;border-radius:0!important;object-fit:cover;z-index:3;background:none!important;rotate:var(--aw-sr,1deg)!important;box-shadow:none!important;margin:0!important}',
    P + ' #queue-list .queue-item>div:first-child{display:none!important}',
    P + ' #queue-list .queue-item.now>img{right:15.5px;top:14.5px;width:35px!important;height:43px!important}',
    P + ' #queue-list .qi-info{position:absolute!important;left:15px;right:70px;top:7px;z-index:2;min-width:0;transition:right .2s}',
    P + ' #queue-list .qi-name{font-family:var(--aw-kai)!important;font-size:16px!important;line-height:1.35!important;letter-spacing:.04em;color:var(--ink)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;rotate:-.6deg!important;transform-origin:0 50%;font-weight:400!important;text-shadow:none!important}',
    P + ' #queue-list .qi-sub{display:flex!important;align-items:baseline;gap:.6em;margin:1px 0 0 2px;font-family:var(--aw-kai)!important;font-size:11.5px!important;letter-spacing:.08em;color:var(--ink)!important;opacity:.72;white-space:nowrap;overflow:hidden}',
    P + ' #queue-list .queue-artist-link{flex:0 1 auto;min-width:0;color:inherit!important;font:inherit!important;letter-spacing:inherit;text-decoration:none!important;background:none!important}',
    P + ' #queue-list .queue-artist-link:hover{text-decoration:underline!important;text-underline-offset:3px}',
    P + ' #queue-list .aw-dur{flex:none;font-family:var(--aw-latin);font-style:italic;letter-spacing:.02em;opacity:.85}',
    // 悬停：歌手行让位，露出小字按钮
    P + ' #queue-list .qi-act{position:absolute!important;right:50px;top:27px;z-index:4;display:flex!important;align-items:center;gap:9px!important;opacity:0!important;pointer-events:none;transition:opacity .2s!important;white-space:nowrap}',
    P + ' #queue-list .queue-item:hover .qi-act,' + P + ' #queue-list .queue-item:focus-within .qi-act{opacity:1!important;pointer-events:auto}',
    P + ' #queue-list .queue-item:hover .qi-info{right:176px}',
    P + ' #queue-list .queue-item:hover .aw-pm{opacity:.18}',
    P + ' #queue-list .qi-act button{' + FLAT + 'width:auto!important;height:auto!important;padding:0!important;font-size:0!important;line-height:1!important;color:var(--ink)!important;opacity:.72;cursor:pointer;display:inline-flex!important;align-items:center}',
    P + ' #queue-list .qi-act button::after{font-family:var(--aw-serif);font-size:11px;letter-spacing:.1em}',
    P + ' #queue-list .qi-act button:nth-child(1)::after{content:"喜欢"}',
    P + ' #queue-list .qi-act button.liked:nth-child(1)::after{content:"已喜欢"}',
    P + ' #queue-list .qi-act button.liked{color:#a83a2a!important;opacity:1}',
    P + ' #queue-list .qi-act button:nth-child(2)::after{content:"下一首"}',
    P + ' #queue-list .qi-act button:nth-child(3)::after{content:"收藏"}',
    P + ' #queue-list .qi-act button:nth-child(4)::after{content:"移除"}',
    P + ' #queue-list .qi-act button svg{display:none!important}',
    P + ' #queue-list .qi-act button:hover{opacity:1;background:none!important;text-decoration:underline;text-underline-offset:3px}',
    P + ' #queue-list .qi-act button:nth-child(4):hover{color:#a83a2a!important}',
    P + ' #queue-list .queue-item.now .qi-act{top:auto;bottom:9px;right:14px}',
    P + ' #queue-list .queue-item.now:hover .qi-info{right:44%}',
    P + ' #queue-list .queue-item.now:hover .aw-to{opacity:0}',
    // 邮票：齿孔边
    P + ' #queue-list .aw-stamp{position:absolute;right:9px;top:6px;width:30px;height:36px;padding:2.5px;box-sizing:border-box;background:#f8f4ea;z-index:2;pointer-events:none;' +
      '-webkit-mask:linear-gradient(#000 0 0) content-box,radial-gradient(circle,transparent 1.1px,#000 1.3px) -2px -2px/4px 4px;mask:linear-gradient(#000 0 0) content-box,radial-gradient(circle,transparent 1.1px,#000 1.3px) -2px -2px/4px 4px;filter:drop-shadow(0 .5px .6px rgba(40,28,16,.35));rotate:var(--aw-sr,1deg)!important}',
    P + ' #queue-list .aw-stamp i{display:block;width:100%;height:100%;position:relative;overflow:hidden;background-color:var(--c);background-image:var(--aw-noise),linear-gradient(160deg,rgba(255,255,255,.18),rgba(0,0,0,.12));background-blend-mode:multiply,normal}',
    P + ' #queue-list .aw-stamp svg{position:absolute;inset:0;width:100%;height:100%}',
    P + ' #queue-list .now .aw-stamp{width:40px;height:48px;top:12px;right:13px}',
    // 邮戳：双圈 + 波浪线，油墨相乘
    P + ' #queue-list .aw-pm{position:absolute;right:25px;top:13px;width:27px;height:27px;box-sizing:border-box;border-radius:50%;border:1.1px solid currentColor;color:rgba(44,40,78,.5);mix-blend-mode:multiply;rotate:var(--aw-pr,-14deg)!important;display:grid;place-items:center;font-family:var(--aw-latin);font-size:6.5px;letter-spacing:.02em;pointer-events:none;z-index:3;transition:opacity .2s}',
    P + ' #queue-list .aw-pm::before{content:"";position:absolute;inset:2.4px;border-radius:50%;border:.7px solid currentColor}',
    P + ' #queue-list .aw-pm b{font-weight:400;color:rgba(44,40,78,.78);white-space:nowrap}',
    P + ' #queue-list .aw-pm svg{position:absolute;left:-34px;top:5px;width:36px;height:16px}',
    P + ' #queue-list .now .aw-pm{width:36px;height:36px;right:36px;top:30px;font-size:8px}',
    P + ' #queue-list .now .aw-pm svg{left:-44px;top:8px;width:46px;height:20px}',
    // 背面印的格子：分隔线、地址线（只有最底下那张整张露出来时看得到）
    P + ' #queue-list .aw-dv{position:absolute;left:58%;top:52px;bottom:14px;width:1px;background:rgba(70,55,40,.22);pointer-events:none}',
    P + ' #queue-list .aw-ad{position:absolute;left:calc(58% + 10px);right:12px;top:66px;height:40px;pointer-events:none;background:repeating-linear-gradient(180deg,transparent 0 13px,rgba(70,55,40,.24) 0 14px)}',
    P + ' #queue-list .aw-pc{position:absolute;left:15px;bottom:11px;font-family:var(--aw-fang);font-size:8.5px;letter-spacing:.42em;color:rgba(70,55,40,.42);white-space:nowrap;pointer-events:none}',
    P + ' #queue-list .now .aw-dv{top:40px}',
    P + ' #queue-list .now .aw-ad{top:84px;height:56px;background:repeating-linear-gradient(180deg,transparent 0 17px,rgba(70,55,40,.24) 0 18px)}',
    P + ' #queue-list .now .aw-pc{top:19px;left:42px;bottom:auto}',
    P + ' #queue-list .aw-to{position:absolute;left:calc(58% + 12px);top:86px;font-family:var(--aw-kai);font-size:13px;letter-spacing:.1em;opacity:.85;line-height:18px;white-space:nowrap;pointer-events:none;transition:opacity .2s}',
    P + ' #queue-list .aw-seal{position:absolute;left:15px;top:13px;width:20px;height:20px;box-sizing:border-box;display:grid;place-items:center;border:1.2px solid #a83a2a;border-radius:2px;color:#a83a2a;font-family:var(--aw-kai);font-size:8.5px;line-height:1;writing-mode:vertical-rl;letter-spacing:0;opacity:.82;mix-blend-mode:multiply;rotate:4deg!important;pointer-events:none}',
    P + ' #queue-list .aw-tape{position:absolute;left:50%;top:-9px;width:70px;height:19px;margin-left:-35px;rotate:-4deg!important;z-index:5;pointer-events:none;background:rgba(218,196,150,.62);background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.16) 0 3px,transparent 0 7px);' +
      'clip-path:polygon(2% 8%,6% 0,11% 9%,15% 1%,85% 0,90% 8%,94% 0,99% 10%,98% 92%,93% 100%,88% 91%,83% 100%,14% 100%,9% 92%,4% 100%,1% 90%);box-shadow:0 1px 2px rgba(0,0,0,.08)}',
    P + ' #queue-list .now .qi-info{top:44px;bottom:24px;right:44%;display:flex;flex-direction:column;justify-content:space-between}',
    P + ' #queue-list .now .qi-name{font-size:21px!important;line-height:1.3!important;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;max-height:2.6em;rotate:-1deg!important;color:var(--ink)!important}',
    P + ' #queue-list .now .qi-sub{font-size:13px!important;overflow:hidden}',
    P + ' #queue-list .aw-ji{flex:none}',
    // 长按拖动排序
    S + '.panel-reordering #playlist-panel #queue-list .queue-item.is-reordering{background-color:var(--pp)!important;border:0!important;translate:8px 0!important;rotate:.6deg!important;z-index:50;pointer-events:none!important;box-shadow:inset 0 0 0 .5px rgba(70,50,30,.16),0 16px 22px rgba(50,34,20,.34)!important;opacity:1!important}',
    P + ' #queue-list.is-reordering-list .queue-item{cursor:grabbing}',
    S + '.panel-reordering #playlist-panel #pl-list .pl-card.is-reordering{translate:0 -14px!important;rotate:-2deg!important;z-index:5;pointer-events:none!important;border:0!important;box-shadow:calc(var(--aw-sx)*1.6) 10px 16px rgba(40,26,14,.45)!important}',
    P + ' #queue-list .queue-item.reorder-pressing{box-shadow:inset 0 0 0 .5px rgba(70,50,30,.16),0 6px 14px rgba(50,34,20,.3)!important}',
    // 空队列 / 载入提示
    P + ' #queue-list>div[style*="text-align"]{font-family:var(--aw-kai)!important;font-size:15px!important;line-height:1.9!important;letter-spacing:.06em;color:var(--aw-ink2)!important;text-align:left!important;padding:14px 8px 0!important}',
    P + ' #queue-list>div[style*="text-align"]::after{content:"";display:block;height:110px;margin:16px 4px 0;border:1px dashed var(--aw-ink3);border-radius:2px;rotate:-1.5deg!important}',
    P + ' .queue-hydration-status,' + P + ' .playlist-catalog-status{color:var(--aw-ink2)!important;font-family:var(--aw-kai)!important;font-size:12px!important;letter-spacing:.08em}',
    P + ' .queue-hydration-spinner{border-color:var(--aw-line)!important;border-top-color:var(--aw-ink2)!important}',
    P + ' .queue-hydration-retry{' + FLAT + 'color:var(--aw-ink)!important;border-bottom:1px solid var(--aw-ink3)!important;font:12px var(--aw-serif)!important}',
    dark('#queue-list .queue-item') + '{filter:brightness(.7) sepia(.22)!important;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.3),0 1px 1.5px rgba(0,0,0,.5),0 4px 9px rgba(0,0,0,.42)!important}',
    dark('#queue-list .queue-item.now') + '{filter:brightness(.86) sepia(.14)!important}',
    dark('#queue-list .queue-item:hover') + '{filter:brightness(.84) sepia(.14)!important}',
    dark('#queue-list .queue-item.aw-past') + '{filter:brightness(.55) sepia(.3)!important;opacity:.85}',

    // ---------------- 我的歌单：书架 ----------------
    P + ' #pl-list{display:flex!important;flex-wrap:wrap;align-items:flex-end;gap:0 2px;margin:0!important;padding:0 6px 12px!important}',
    P + ' #pl-list>*{flex:0 0 100%;box-sizing:border-box}',
    P + ' #pl-list .pl-section-label{display:flex!important;justify-content:space-between;align-items:baseline;gap:10px;margin:14px 0 0!important;padding:0 2px!important;font-size:11px!important;font-weight:400!important;letter-spacing:.24em!important;text-transform:none!important;color:var(--aw-ink)!important;white-space:nowrap;text-shadow:none!important;background:none!important;border:0!important;box-shadow:none!important;min-height:18px}',
    P + ' #pl-list .pl-section-label .aw-cnt{font-family:var(--aw-latin);font-size:11px;letter-spacing:.04em;color:var(--aw-ink3)}',
    P + ' #pl-list .pl-section-label.aw-hov{font-size:0!important}',
    P + ' #pl-list .pl-section-label .aw-hv{display:none;font-size:11px;letter-spacing:.16em;overflow:hidden;text-overflow:ellipsis;min-width:0;max-width:78%}',
    P + ' #pl-list .pl-section-label.aw-hov .aw-hv{display:block;order:-1}',
    P + ' #pl-list .pl-section-label.aw-hov .aw-cnt{font-size:11px}',
    // 书脊
    P + ' #pl-list .pl-card{--aw-c:#6d7a5a;--aw-g:#eadcae;position:relative!important;display:block!important;flex:none!important;box-sizing:border-box!important;width:var(--aw-w,32px)!important;height:var(--aw-h,136px)!important;margin:16px 0 0!important;padding:0!important;border:0!important;border-radius:2.5px 2.5px 1px 1px!important;cursor:pointer;overflow:visible!important;' +
      'background-color:var(--aw-c)!important;' +
      'background-image:linear-gradient(var(--aw-g),var(--aw-g)),linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),linear-gradient(var(--aw-g),var(--aw-g)),linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),linear-gradient(var(--aw-g),var(--aw-g)),linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),' +
      'var(--aw-noise),var(--aw-cloth),linear-gradient(90deg,rgba(0,0,0,.42) 0,rgba(0,0,0,.12) 7%,rgba(255,255,255,.16) 24%,rgba(255,255,255,.07) 38%,rgba(0,0,0,0) 55%,rgba(0,0,0,.10) 76%,rgba(0,0,0,.44) 100%),linear-gradient(180deg,rgba(255,255,255,.06),rgba(0,0,0,.10))!important;' +
      'background-size:calc(100% - 4px) 1px,calc(100% - 4px) 1px,calc(100% - 4px) 1px,calc(100% - 4px) 1px,calc(100% - 4px) 1px,calc(100% - 4px) 1px,auto,auto,auto,auto!important;' +
      'background-position:2px 11px,2px 12px,2px 15px,2px 16px,2px calc(100% - 25px),2px calc(100% - 24px),0 0,0 0,0 0,0 0!important;' +
      'background-repeat:no-repeat,no-repeat,no-repeat,no-repeat,no-repeat,no-repeat,repeat,repeat,no-repeat,no-repeat!important;' +
      'background-blend-mode:normal,normal,normal,normal,normal,normal,multiply,normal,normal,normal!important;' +
      'box-shadow:calc(var(--aw-sx)*.9) calc(var(--aw-sy)*.4) 6px rgba(40,26,14,.40),1px 0 0 rgba(0,0,0,.18)!important;' +
      'transform-origin:50% 100%;translate:0 0!important;rotate:0deg!important;transition:translate .38s cubic-bezier(.2,1.4,.3,1),rotate .38s cubic-bezier(.2,1.4,.3,1),box-shadow .3s,filter .3s!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    // 上下两道硬壳边
    P + ' #pl-list .pl-card::before,' + P + ' #pl-list .pl-card::after{content:""!important;display:block!important;position:absolute!important;left:-.5px!important;right:-.5px!important;width:auto!important;height:3px!important;pointer-events:none;border-radius:0!important;z-index:1;' +
      'background:linear-gradient(90deg,rgba(0,0,0,.5),rgba(255,255,255,.10) 30%,rgba(0,0,0,.10) 60%,rgba(0,0,0,.5)),var(--aw-c)!important}',
    P + ' #pl-list .pl-card::before{top:0!important;bottom:auto!important;border-radius:2.5px 2.5px 0 0!important;box-shadow:inset 0 .8px 0 rgba(255,255,255,.28),0 1px 0 rgba(0,0,0,.28)!important}',
    P + ' #pl-list .pl-card::after{bottom:0!important;top:auto!important;box-shadow:0 -1px 0 rgba(0,0,0,.28),inset 0 -.6px 0 rgba(0,0,0,.4)!important}',
    P + ' #pl-list .pl-card:hover,' + P + ' #pl-list .pl-card:focus-visible{translate:0 -12px!important;rotate:-1.2deg!important;background-color:var(--aw-c)!important;box-shadow:calc(var(--aw-sx)*1.6) calc(var(--aw-sy)*.8) 12px rgba(40,26,14,.45),1px 0 0 rgba(0,0,0,.18)!important;border:0!important}',
    P + ' #pl-list .pl-card>:first-child{display:none!important}',
    P + ' #pl-list .pl-card>:nth-child(2){position:absolute!important;left:0;right:0;top:21px;bottom:31px;display:flex!important;justify-content:center;overflow:hidden;min-width:0}',
    P + ' #pl-list .pl-name{writing-mode:vertical-rl;font-family:var(--aw-serif)!important;font-size:var(--aw-fs,12px)!important;font-weight:400!important;letter-spacing:.14em;line-height:1!important;color:var(--aw-g)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-height:100%;text-shadow:0 -.6px 0 rgba(0,0,0,.55),0 .6px 0 rgba(255,255,255,.14)!important}',
    P + ' #pl-list .pl-card .tag-source,' + P + ' #pl-list .pl-card .pl-sub{display:none!important}',
    P + ' #pl-list .aw-pg{position:absolute;left:0;right:0;bottom:9px;text-align:center;font-family:var(--aw-latin);font-size:9.5px;color:var(--aw-g);opacity:.9;letter-spacing:0;text-shadow:0 -.5px 0 rgba(0,0,0,.5);pointer-events:none;z-index:2}',
    // 烫金
    P + ' #pl-list .pl-card.aw-foil .pl-name,' + P + ' #pl-list .pl-card.aw-foil .aw-pg{background:linear-gradient(180deg,#f3dc9c 0,#b88b3e 45%,#e9cc84 70%,#9c7231 100%);-webkit-background-clip:text;background-clip:text;color:transparent!important;text-shadow:none!important;filter:drop-shadow(0 -.5px 0 rgba(0,0,0,.5))}',
    P + ' #pl-list .pl-card.aw-foil{--aw-g:#c9a257}',
    // 旧纸贴纸标签
    P + ' #pl-list .pl-card.aw-lab>:nth-child(2){left:17%;right:17%;top:24px;bottom:auto;max-height:calc(100% - 58px);padding:6px 0;box-sizing:border-box;border-radius:1px;' +
      'background-color:#ece2ca;background-image:var(--aw-noise),linear-gradient(180deg,rgba(255,255,255,.35),rgba(120,90,50,.08));background-blend-mode:multiply,normal;box-shadow:inset 0 0 0 1.5px #ece2ca,inset 0 0 0 2.1px rgba(80,60,40,.45),0 .5px 1px rgba(0,0,0,.35)}',
    P + ' #pl-list .pl-card.aw-lab .pl-name{color:#2e261d!important;text-shadow:none!important;font-family:var(--aw-kai)!important;letter-spacing:.08em}',
    // 最后一本斜靠
    P + ' #pl-list .pl-card.aw-lean{rotate:-7deg!important;transform-origin:0 100%;margin-left:17px!important}',
    P + ' #pl-list .pl-card.aw-lean:hover{rotate:-4deg!important;translate:0 -8px!important}',
    // 收藏的歌单：夹一张书签纸条
    P + ' #pl-list .aw-slip{position:absolute;right:20%;top:-13px;width:7px;height:20px;z-index:-1;background-color:#efe6d1;background-image:var(--aw-noise);background-blend-mode:multiply;box-shadow:0 0 0 .5px rgba(0,0,0,.18);clip-path:polygon(0 4%,40% 0,100% 3%,100% 100%,0 100%);pointer-events:none}',
    // 新建 = 牛皮纸空白笔记本
    P + ' #pl-list .aw-new{flex:none;position:relative;width:24px;height:118px;margin:16px 0 0 3px;border-radius:1.5px;cursor:pointer;background-color:#c9ae84;background-image:var(--aw-noise),linear-gradient(90deg,rgba(0,0,0,.28) 0,rgba(0,0,0,.05) 10%,rgba(255,255,255,.2) 30%,rgba(0,0,0,0) 55%,rgba(0,0,0,.3) 100%);background-blend-mode:multiply,normal;' +
      'box-shadow:calc(var(--aw-sx)*.9) calc(var(--aw-sy)*.4) 6px rgba(40,26,14,.32);transition:translate .38s cubic-bezier(.2,1.4,.3,1),rotate .38s;transform-origin:50% 100%;border:0;padding:0;display:block;font:inherit}',
    P + ' #pl-list .aw-new:hover{translate:0 -10px!important;rotate:-1.2deg!important}',
    P + ' #pl-list .aw-new span{position:absolute;left:0;right:0;top:18px;writing-mode:vertical-rl;margin:0 auto;font-family:var(--aw-kai);font-size:12px;letter-spacing:.3em;color:rgba(70,62,52,.75)}',
    P + ' #pl-list .aw-new i{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-style:normal;font-family:var(--aw-kai);font-size:13px;color:rgba(70,62,52,.7)}',
    P + ' #pl-list .aw-new::after{content:"";position:absolute;left:0;right:0;top:52%;height:2px;background:rgba(90,60,30,.3)}',
    // 书立
    P + ' #pl-list .aw-bookend{flex:none;position:relative;width:6px;height:58px;margin-left:6px;border-radius:1px 1px 0 0;background:linear-gradient(90deg,#2c2723,#6b625a 35%,#48413a 60%,#221e1b);box-shadow:var(--aw-sx) 0 6px rgba(40,30,20,.35),inset 0 1px 0 rgba(255,255,255,.2);pointer-events:none}',
    P + ' #pl-list .aw-bookend::after{content:"";position:absolute;left:-18px;right:0;bottom:0;height:2px;background:linear-gradient(90deg,#2c2723,#5a524b)}',
    // 木板（书后面墙洞的阴影画在木板的伪元素上，排在书下面）
    P + ' #pl-list .aw-plank{position:relative;height:15px;margin:0 -4px 2px;border-radius:1px;pointer-events:none;' +
      'background:var(--aw-noise),linear-gradient(180deg,#8a6a48 0,#b99469 1px,#c9a57b 5px,#6f5236 5.5px,#a07c56 6.5px,var(--aw-wood1) 45%,var(--aw-wood2) 100%);background-blend-mode:multiply,normal;' +
      'box-shadow:0 8px 12px rgba(60,40,22,.30),0 2px 2px rgba(60,40,22,.25)}',
    P + ' #pl-list .aw-plank::before{content:"";position:absolute;left:-2px;right:-2px;bottom:100%;height:60px;z-index:-1;background:linear-gradient(0deg,rgba(40,26,14,.15),rgba(40,26,14,0))}',
    P + ' #pl-list .aw-plank::after{content:"";position:absolute;left:0;right:0;top:6px;bottom:0;opacity:.35;background:repeating-linear-gradient(90deg,rgba(60,38,20,0) 0 37px,rgba(60,38,20,.35) 38px,rgba(60,38,20,0) 41px),linear-gradient(177deg,transparent 30%,rgba(255,235,200,.25) 45%,transparent 60%)}',
    dark('#pl-list .pl-card') + '{filter:brightness(.78)!important;box-shadow:0 -2px 8px rgba(0,0,0,.55),1px 0 0 rgba(0,0,0,.3)!important}',
    dark('#pl-list .pl-card:hover') + '{filter:brightness(1)!important}',
    dark('#pl-list .aw-new') + '{filter:brightness(.72)!important}',
    dark('#pl-list .aw-plank::before') + '{background:linear-gradient(0deg,rgba(0,0,0,.35),transparent)}',
    // 其它提示文字
    P + ' #pl-list>div[style*="text-align"],' + P + ' #podcast-list>div[style*="text-align"]{font-family:var(--aw-kai)!important;font-size:14px!important;line-height:1.9!important;letter-spacing:.06em;color:var(--aw-ink2)!important;padding:18px 8px!important}',
    P + ' .mini-queue-skeleton{background:var(--aw-line)!important}',

    // ---------------- 翻开的书：目录页 ----------------
    P + ' #pl-list.aw-reading>.pl-card,' + P + ' #pl-list.aw-reading>.pl-section-label,' + P + ' #pl-list.aw-reading>[data-skin-deco]{display:none!important}',
    P + ' #pl-list .pl-inline-detail{--aw-c:#6d7a5a;position:relative!important;display:block!important;box-sizing:border-box!important;margin:8px 0 10px!important;padding:0 12px 12px 24px!important;border:0!important;border-radius:1px 3px 3px 1px!important;color:#2b241d!important;' +
      'background-color:#f4eee1!important;background-image:var(--aw-noise),linear-gradient(90deg,var(--aw-c) 0,var(--aw-c) 7px,rgba(0,0,0,.18) 7px,rgba(0,0,0,0) 22px)!important;background-blend-mode:multiply,normal!important;' +
      'box-shadow:calc(var(--aw-sx)*.7) calc(var(--aw-sy)*.7) 16px rgba(50,34,20,.3),0 0 0 .5px rgba(60,40,20,.2)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:awPageIn .42s cubic-bezier(.2,1.12,.3,1) both}',
    '@keyframes awPageIn{from{opacity:0;transform:translateY(10px) scale(.985)}}',
    P + ' #pl-list .pl-detail-sticky{position:sticky!important;top:calc(var(--aw-top) + var(--aw-tool))!important;z-index:5!important;margin:0 0 0 -2px!important;padding:14px 2px 0 2px!important;border:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background-color:#f4eee1!important;background-image:var(--aw-noise)!important;background-blend-mode:multiply!important}',
    P + ' #pl-list .pl-detail-head{display:flex!important;align-items:flex-start!important;gap:12px!important;margin:0!important;padding:0!important;border:0!important}',
    P + ' #pl-list .pl-detail-cover{width:56px!important;height:56px!important;border-radius:0!important;flex:none;object-fit:cover;background-color:var(--aw-c)!important;background-image:var(--aw-noise),var(--aw-cloth)!important;background-blend-mode:multiply,normal;box-shadow:0 0 0 .5px rgba(0,0,0,.25),1px 2px 5px rgba(50,34,20,.3)!important}',
    P + ' #pl-list .pl-detail-title{font-family:var(--aw-serif)!important;font-size:17px!important;font-weight:400!important;letter-spacing:.08em;line-height:1.3!important;color:#2b241d!important;white-space:normal!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding-right:58px;text-shadow:none!important}',
    P + ' #pl-list .pl-detail-sub{font-size:11px!important;letter-spacing:.2em;color:rgba(43,36,29,.55)!important;margin-top:5px!important}',
    P + ' #pl-list .pl-detail-count{position:absolute;right:4px;top:40px;font-family:var(--aw-latin);font-size:10.5px!important;color:rgba(43,36,29,.45)!important}',
    P + ' #pl-list .pl-detail-actions{display:flex!important;flex-wrap:wrap;align-items:center;gap:6px 14px!important;margin:12px 0 0!important;min-height:24px}',
    P + ' #pl-list .pl-detail-play{' + FLAT + 'height:auto!important;min-width:0!important;padding:4px 10px!important;background:#2b241d!important;color:#f4eee1!important;font:12px var(--aw-serif)!important;letter-spacing:.2em;gap:5px!important;border-radius:1px!important;transition:background .2s,translate .25s cubic-bezier(.2,1.5,.3,1)!important}',
    P + ' #pl-list .pl-detail-play:hover{background:#9b3b25!important;translate:0 -1px!important}',
    P + ' #pl-list .pl-detail-play svg{width:10px!important;height:10px!important}',
    P + ' #pl-list .pl-detail-top-btn{' + FLAT + 'height:auto!important;min-width:0!important;padding:0!important;font:12px var(--aw-serif)!important;letter-spacing:.14em;color:rgba(43,36,29,.6)!important}',
    P + ' #pl-list .pl-detail-top-btn:hover{color:#9b3b25!important;background:none!important}',
    P + ' #pl-list .aw-back{position:absolute;right:2px;top:14px;' + 'font:11px var(--aw-serif);letter-spacing:.16em;color:rgba(43,36,29,.5);background:none;border:0;padding:0;cursor:pointer;white-space:nowrap}',
    P + ' #pl-list .aw-back:hover{color:#2b241d}',
    P + ' #pl-list .aw-toc{margin:8px 0 0;padding:7px 0 6px 1.2em;text-align:center;font-size:12px;letter-spacing:1.2em;color:rgba(43,36,29,.5);border-top:1px solid rgba(43,36,29,.12);pointer-events:none}',
    P + ' #pl-list .pl-detail-list{display:block!important;overflow:visible!important;padding:0!important;margin:0!important}',
    P + ' #pl-list .pl-detail-row{position:relative;display:flex!important;align-items:center!important;gap:6px!important;box-sizing:border-box!important;height:50px!important;min-height:50px!important;margin:0 0 6px!important;padding:0 2px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;backdrop-filter:none!important;cursor:pointer;color:#2b241d}',
    P + ' #pl-list .pl-detail-row::before{content:"";position:absolute;left:0;right:0;bottom:-3px;border-bottom:1px solid rgba(43,36,29,.06);pointer-events:none}',
    P + ' #pl-list .pl-detail-row:hover{background:radial-gradient(ellipse at 22% 60%,rgba(255,206,130,.42),transparent 70%)!important}',
    P + ' #pl-list .pl-detail-row>img,' + P + ' #pl-list .pl-detail-row>div:not([style*="flex:1"]){display:none!important}',
    P + ' #pl-list .aw-no{flex:none;width:22px;font-family:var(--aw-latin);font-size:10.5px;color:rgba(43,36,29,.4)}',
    P + ' #pl-list .pl-detail-row>div[style*="flex:1"]{display:flex!important;align-items:baseline;gap:6px;min-width:0;flex:1!important}',
    P + ' #pl-list .pl-detail-row>div[style*="flex:1"]::after{content:"";order:2;flex:1;min-width:10px;border-bottom:1px dotted rgba(43,36,29,.35);translate:0 -3px!important}',
    P + ' #pl-list .pl-detail-row-title{order:1;flex:0 1 auto;max-width:58%;font-size:13px!important;font-weight:400!important;letter-spacing:.04em;color:#2b241d!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' #pl-list .pl-detail-row:hover .pl-detail-row-title{color:#9b3b25!important}',
    P + ' #pl-list .pl-detail-row-artist{order:3;flex:0 1 auto;min-width:0;max-width:36%;margin:0!important;font:11px var(--aw-serif)!important;letter-spacing:.06em;color:rgba(43,36,29,.6)!important;background:none!important}',
    P + ' #pl-list .pl-detail-row-artist:hover{color:#9b3b25!important}',
    P + ' #pl-list .pl-detail-remove{' + FLAT + 'flex:none;width:18px!important;height:18px!important;padding:0!important;font-size:13px!important;color:rgba(43,36,29,.35)!important;opacity:0;transition:opacity .2s}',
    P + ' #pl-list .pl-detail-row:hover .pl-detail-remove{opacity:1}',
    P + ' #pl-list .pl-detail-remove:hover{color:#9b3b25!important}',
    P + ' #pl-list .pl-detail-row-title,' + P + ' #pl-list .pl-detail-row-artist{font-family:var(--aw-serif)!important}',
    P + ' #pl-list .pl-detail-loading-row{cursor:default}',
    P + ' #pl-list .pl-detail-loading-row .pl-detail-row-artist{max-width:none}',
    P + ' #pl-list .pl-detail-progress{color:rgba(43,36,29,.5)!important;font-family:var(--aw-kai)!important;font-size:12px!important;letter-spacing:.08em}',
    P + ' #pl-list .pl-inline-detail .queue-hydration-spinner{border-color:rgba(43,36,29,.15)!important;border-top-color:rgba(43,36,29,.6)!important}',
    P + ' #pl-list .pl-inline-detail>div[style*="text-align"],' + P + ' #pl-list .pl-detail-list>div[style*="text-align"]{font-family:var(--aw-kai)!important;color:rgba(43,36,29,.6)!important;font-size:14px!important}',
    dark('#pl-list .pl-inline-detail') + '{background-color:#e6dcc8!important;box-shadow:0 12px 34px rgba(0,0,0,.5),0 0 0 .5px rgba(0,0,0,.3)!important}',
    dark('#pl-list .pl-detail-sticky') + '{background-color:#e6dcc8!important}',

    // ---------------- 我的播客：杂志架 ----------------
    P + ' #podcast-list{display:flex!important;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:0 10px;padding:4px 2px 14px!important;margin:0!important}',
    P + ' #podcast-list>*{flex:0 0 100%;box-sizing:border-box}',
    P + ' #podcast-list .pl-card.podcast-card:not(.podcast-child){--c:#e9e1cf;--g:#2b2a33;--a:#b7452f;position:relative!important;display:block!important;flex:none!important;box-sizing:border-box!important;width:124px!important;height:178px!important;margin:22px 0 0!important;padding:0!important;border:0!important;border-radius:1px!important;overflow:hidden!important;cursor:pointer;color:var(--g)!important;' +
      'background-color:var(--c)!important;background-image:var(--aw-noise),linear-gradient(160deg,rgba(255,255,255,.14),rgba(0,0,0,.10))!important;background-blend-mode:multiply,normal!important;' +
      'box-shadow:calc(var(--aw-sx)*.7) calc(var(--aw-sy)*.5 + 2px) 7px rgba(40,26,14,.36),0 0 0 .5px rgba(0,0,0,.2)!important;rotate:var(--aw-r,0deg)!important;transform-origin:50% 100%;translate:0 0!important;transition:translate .4s cubic-bezier(.2,1.3,.3,1),rotate .4s cubic-bezier(.2,1.3,.3,1),box-shadow .3s,filter .3s!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    P + ' #podcast-list .pl-card.podcast-card:not(.podcast-child)::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(90deg,rgba(0,0,0,.3),rgba(0,0,0,0));z-index:4;pointer-events:none}',
    P + ' #podcast-list .pl-card.podcast-card:not(.podcast-child)::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:5;background:linear-gradient(118deg,transparent 38%,rgba(255,255,255,.20) 47%,rgba(255,255,255,.04) 53%,transparent 60%)}',
    P + ' #podcast-list .pl-card.podcast-card:not(.podcast-child):hover{translate:0 -14px!important;rotate:calc(var(--aw-r,0deg)*.3)!important;z-index:5;background-color:var(--c)!important;border:0!important;box-shadow:calc(var(--aw-sx)*1.2) calc(var(--aw-sy)*.8 + 6px) 14px rgba(40,26,14,.42),0 0 0 .5px rgba(0,0,0,.2)!important}',
    P + ' #podcast-list .podcast-card:not(.podcast-child)>img{position:absolute!important;left:10px;right:8px;top:48px;width:calc(100% - 18px)!important;height:82px!important;border-radius:0!important;object-fit:cover;z-index:2;box-shadow:0 0 0 .5px rgba(0,0,0,.2)!important;margin:0!important}',
    P + ' #podcast-list .podcast-card:not(.podcast-child)>div:first-child{display:none!important}',
    P + ' #podcast-list .podcast-card:not(.podcast-child)>div:last-child{position:static!important}',
    P + ' #podcast-list .podcast-card:not(.podcast-child) .pl-name{position:absolute;left:10px;right:8px;top:9px;font-family:var(--aw-serif)!important;font-weight:700!important;font-size:17px!important;line-height:1.12!important;letter-spacing:.06em;color:var(--g)!important;white-space:nowrap;overflow:hidden;text-overflow:clip;text-shadow:none!important;z-index:3}',
    P + ' #podcast-list .podcast-card:not(.podcast-child) .pl-sub{position:absolute;left:10px;right:30px;top:136px;margin:0!important;font-family:var(--aw-fang)!important;font-size:9px!important;letter-spacing:.1em;color:var(--g)!important;opacity:.85;white-space:nowrap;overflow:hidden;z-index:3}',
    P + ' #podcast-list .aw-vol{position:absolute;left:10px;right:8px;top:32px;display:flex;justify-content:space-between;padding-top:2px;border-top:.5px solid currentColor;font-family:var(--aw-latin);font-size:7px;letter-spacing:.12em;opacity:.8;z-index:3;pointer-events:none}',
    P + ' #podcast-list .aw-art{position:absolute;left:10px;right:8px;top:48px;height:82px;z-index:1;pointer-events:none}',
    P + ' #podcast-list .aw-art svg{width:100%;height:100%;display:block}',
    P + ' #podcast-list .aw-bc{position:absolute;right:8px;bottom:27px;width:16px;height:8px;padding:1px;box-sizing:border-box;background:#f4efe4;z-index:3;pointer-events:none}',
    P + ' #podcast-list .aw-bc i{display:block;height:100%;background:repeating-linear-gradient(90deg,#222 0 1px,transparent 1px 2px,#222 2px 2.6px,transparent 2.6px 4px)}',
    P + ' #podcast-list .aw-rack{position:relative;z-index:6;height:24px;margin:-18px -4px 0;border-radius:1.5px;pointer-events:none;' +
      'background:var(--aw-noise),linear-gradient(180deg,#d3b286 0,var(--aw-wood1) 12%,var(--aw-wood2) 100%);background-blend-mode:multiply,normal;box-shadow:0 8px 12px rgba(60,40,22,.32),inset 0 1px 0 rgba(255,240,215,.45),inset 0 -2px 0 rgba(0,0,0,.2)}',
    P + ' #podcast-list .aw-rack::before{content:"";position:absolute;left:0;right:0;bottom:100%;height:70px;z-index:-1;background:linear-gradient(0deg,rgba(40,26,14,.15),rgba(40,26,14,0))}',
    P + ' #podcast-list .aw-cap{display:flex;justify-content:space-between;align-items:baseline;padding:9px 6px 0;font-size:11px;letter-spacing:.24em;color:var(--aw-ink2);white-space:nowrap;min-height:26px;pointer-events:none}',
    P + ' #podcast-list .aw-cap b{font-weight:400;color:var(--aw-ink);overflow:hidden;text-overflow:ellipsis;max-width:70%}',
    P + ' #podcast-list .aw-cap span{font-family:var(--aw-latin);letter-spacing:.04em}',
    dark('#podcast-list .pl-card.podcast-card:not(.podcast-child)') + '{filter:brightness(.74) sepia(.12)!important;box-shadow:0 4px 10px rgba(0,0,0,.55),0 0 0 .5px rgba(0,0,0,.3)!important}',
    dark('#podcast-list .pl-card.podcast-card:not(.podcast-child):hover') + '{filter:brightness(.9) sepia(.06)!important}',
    dark('#podcast-list .aw-rack::before') + '{background:linear-gradient(0deg,rgba(0,0,0,.35),transparent)}',
    // 点进一份播客：一页目录
    P + ' #podcast-list .podcast-inline-head{display:flex!important;align-items:baseline;justify-content:space-between;margin:12px 0 6px!important;padding:0 4px!important}',
    P + ' #podcast-list .podcast-inline-head .pl-section-label{margin:0!important;font-family:var(--aw-serif)!important;font-size:16px!important;font-weight:400!important;letter-spacing:.1em!important;text-transform:none!important;color:var(--aw-ink)!important;text-shadow:none!important}',
    P + ' #podcast-list .podcast-inline-head .fx-mini-btn{' + FLAT + 'height:auto!important;padding:0!important;font-size:11.5px!important;letter-spacing:.2em;color:var(--aw-ink2)!important}',
    P + ' #podcast-list .podcast-inline-head .fx-mini-btn::before{content:"← "}',
    P + ' #podcast-list .podcast-inline-head .fx-mini-btn:hover{color:var(--aw-ink)!important}',
    P + ' #podcast-list .pl-card.podcast-child{display:flex!important;align-items:center;gap:10px;margin:0!important;padding:8px 4px!important;border:0!important;border-bottom:1px dotted var(--aw-line)!important;border-radius:0!important;background:none!important;box-shadow:none!important;backdrop-filter:none!important;color:var(--aw-ink)}',
    P + ' #podcast-list .pl-card.podcast-child:hover{background:radial-gradient(ellipse at 30% 50%,rgba(255,206,130,.35),transparent 70%)!important}',
    P + ' #podcast-list .pl-card.podcast-child img,' + P + ' #podcast-list .pl-card.podcast-child>div:first-child{width:34px!important;height:34px!important;border-radius:0!important;box-shadow:0 0 0 .5px rgba(0,0,0,.2),1px 1px 3px rgba(50,34,20,.25)!important}',
    P + ' #podcast-list .pl-card.podcast-child .pl-name{font-size:13px!important;color:var(--aw-ink)!important;font-weight:400!important}',
    P + ' #podcast-list .pl-card.podcast-child .pl-sub{font-size:11px!important;color:var(--aw-ink2)!important}',
    '@media (prefers-reduced-motion:reduce){' + P + ' *{transition:none!important;animation:none!important}}'
  ].join('\n');

  // ---------------- 小工具 ----------------
  var h32 = function (s) { return typeof panelSkinHash === 'function' ? panelSkinHash(s) : 0; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmt(sec) { sec = Math.max(0, Math.round(Number(sec) || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function songDur(s) { try { return typeof playbackDurationFromSong === 'function' ? (playbackDurationFromSong(s) || 0) : 0; } catch (_e) { return 0; } }
  function songKey(s) { return s ? String(s.id || s.mid || s.localKey || '') + '|' + (s.name || '') + '|' + (s.artist || '') : ''; }
  function Q() { try { return playQueue || []; } catch (_e) { return []; } }
  function curIdx() { try { return currentIdx; } catch (_e) { return -1; } }
  function nowPos() {
    var p = 0;
    try { p = getPlaybackCurrentSeconds() || 0; } catch (_e) { }
    if (!p) { try { p = typeof currentResumeSeconds === 'function' ? (currentResumeSeconds(0) || 0) : 0; } catch (_e2) { } }
    return p;
  }
  function nowDur(s) { var d = 0; try { d = getPlaybackDurationSeconds() || 0; } catch (_e) { } return d || songDur(s); }

  var PAL = [['#6d7a5a', '#eadcae'], ['#8a4b3a', '#efd9a8'], ['#3f5a6e', '#e7dcbc'], ['#c2a878', '#2b241d'], ['#5b4a62', '#ead9b0'], ['#96a096', '#26221d'], ['#cfc3aa', '#2b241d'], ['#2f3e4f', '#e3cf9a'], ['#a0633c', '#f2e1bc'], ['#7a8488', '#f0e4c8'], ['#4e5f4b', '#e8d8a8']];
  var MAGPAL = [['#e9e1cf', '#2b2a33', '#b7452f'], ['#27384a', '#efe4c8', '#d9a35b'], ['#b5543a', '#f6ead2', '#2a2320'], ['#d8cfb4', '#233a33', '#5f8a6e'], ['#1f1e22', '#ece0c4', '#c9a257'], ['#8fa39a', '#1f2a2a', '#f0e7d2']];
  var STAMP = ['<circle cx="10" cy="9" r="4"/><path d="M0 16q2.5-2 5 0t5 0t5 0t5 0V24H0z"/>',
    '<path d="M0 24L7 11l3 4 4-7 6 10v6z"/><circle cx="15.5" cy="5" r="1.8"/>',
    '<path d="M12 4a7 7 0 1 0 5 12a6 6 0 1 1-5-12z"/><circle cx="4" cy="5" r=".7"/><circle cx="6" cy="20" r=".6"/>',
    '<path d="M10 3l5 8h-3l4 6h-5v5H9v-5H4l4-6H5z"/>',
    '<path d="M4 5h12v15H4z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 5v15M4 12h12" stroke="currentColor" stroke-width="1"/><path d="M5 19l6-6 4 6z" opacity=".45"/>',
    '<path d="M2 13q4-5 8 0q4-5 8 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6 19q2-2.4 4 0q2-2.4 4 0" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>'];
  var WAVE = '<svg viewBox="0 0 36 16" fill="none" stroke="currentColor" stroke-width="1.1"><path d="M0 3q4.5-2.5 9 0t9 0t9 0t9 0M0 8q4.5-2.5 9 0t9 0t9 0t9 0M0 13q4.5-2.5 9 0t9 0t9 0t9 0"/></svg>';
  function stampHTML(hh) {
    var c = PAL[(hh >>> 3) % PAL.length];
    return '<span data-skin-deco class="aw-stamp"><i style="--c:' + c[0] + ';color:' + c[1] + '"><svg viewBox="0 0 20 24" fill="currentColor">' + STAMP[(hh >>> 20) % STAMP.length] + '</svg></i></span>';
  }
  function pmHTML(hh, txt) { return '<span data-skin-deco class="aw-pm" style="--aw-pr:' + (((hh >>> 14) % 50) - 25) + 'deg">' + WAVE + '<b>' + txt + '</b></span>'; }
  function todayMark() { var d = new Date(); return String(d.getMonth() + 1).padStart(2, '0') + '·' + String(d.getDate()).padStart(2, '0'); }
  function magArt(hh, c) {
    var k = (hh >>> 9) % 5, a = c[2], g = c[1];
    if (k === 0) return '<svg viewBox="0 0 86 66" preserveAspectRatio="xMidYMid slice"><circle cx="54" cy="30" r="20" fill="' + a + '"/><path d="M0 50q10-6 21 0t21 0t22 0t22 0V66H0z" fill="' + g + '" opacity=".85"/><path d="M0 58q10-5 21 0t21 0t22 0t22 0" fill="none" stroke="' + c[0] + '" stroke-width="1" opacity=".6"/></svg>';
    if (k === 1) return '<svg viewBox="0 0 86 66" preserveAspectRatio="xMidYMid slice"><rect x="10" y="4" width="46" height="58" fill="' + a + '"/><path d="M10 33h46M33 4v58" stroke="' + c[0] + '" stroke-width="2"/><circle cx="66" cy="16" r="6" fill="' + g + '"/></svg>';
    if (k === 2) { var o = ''; for (var i = 0; i < 7; i++) o += '<path d="M4 ' + (8 + i * 8) + 'q20 ' + (-6 + i % 3 * 3) + ' 40 0t40 0" fill="none" stroke="' + (i === 3 ? a : g) + '" stroke-width="' + (i === 3 ? 2.4 : 1) + '"/>'; return '<svg viewBox="0 0 86 66" preserveAspectRatio="xMidYMid slice">' + o + '</svg>'; }
    if (k === 3) return '<svg viewBox="0 0 86 66" preserveAspectRatio="xMidYMid slice"><path d="M0 66L22 26l14 18 16-30 34 52z" fill="' + g + '" opacity=".9"/><circle cx="64" cy="14" r="8" fill="' + a + '"/></svg>';
    var d = ''; for (var y = 0; y < 6; y++) for (var x = 0; x < 8; x++) { var on = ((hh >>> (x + y * 3)) & 3) === 0; d += '<circle cx="' + (8 + x * 10) + '" cy="' + (8 + y * 10) + '" r="' + (on ? 3.6 : 1.4) + '" fill="' + (on ? a : g) + '"/>'; }
    return '<svg viewBox="0 0 86 66" preserveAspectRatio="xMidYMid slice">' + d + '</svg>';
  }
  function hasDeco(el) { for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.hasAttribute('data-skin-deco')) return true; return false; }
  function deco(tag, cls, html) { var el = document.createElement(tag); el.setAttribute('data-skin-deco', ''); el.className = cls; if (html != null) el.innerHTML = html; return el; }

  // 纸纹 / 布纹（程序生成，data URL）
  var TEX = null;
  function textures() {
    if (TEX) return TEX;
    TEX = { noise: 'none', cloth: 'none' };
    try {
      var c = document.createElement('canvas'); c.width = c.height = 160; var g = c.getContext('2d');
      var im = g.createImageData(160, 160), d = im.data, s = 99;
      var r = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      for (var i = 0; i < d.length; i += 4) { var v = 238 + (r() - .5) * 22; d[i] = v; d[i + 1] = v - 2; d[i + 2] = v - 6; d[i + 3] = 255; }
      g.putImageData(im, 0, 0);
      g.globalAlpha = .07; g.strokeStyle = '#6b5a44'; g.lineWidth = .6;
      for (var k = 0; k < 60; k++) { var x = r() * 160, y = r() * 160, a = r() * Math.PI, l = 4 + r() * 10; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * .5 + r() * 2, y + Math.sin(a) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      TEX.noise = 'url(' + c.toDataURL() + ')';
      var c2 = document.createElement('canvas'); c2.width = c2.height = 6; var g2 = c2.getContext('2d');
      g2.fillStyle = 'rgba(255,255,255,.07)'; g2.fillRect(0, 0, 6, 1); g2.fillRect(0, 3, 6, 1); g2.fillStyle = 'rgba(0,0,0,.08)'; g2.fillRect(0, 0, 1, 6); g2.fillRect(3, 0, 1, 6);
      TEX.cloth = 'url(' + c2.toDataURL() + ')';
    } catch (_e) { }
    return TEX;
  }

  // ---------------- 光线：跟着时间 ----------------
  var lastLight = '';
  function isNight(h) { return h >= 19 || h < 6; }
  function applyLight(panel) {
    if (!panel) return;
    var h = typeof panelSkinHour === 'function' ? panelSkinHour() : 15;
    var night = isNight(h);
    var sx, sy, sun;
    if (night) {
      sx = 0; sy = 6;
      sun = 'linear-gradient(180deg,rgba(255,196,130,.14) 0,rgba(255,196,130,.05) 160px,rgba(255,196,130,0) 360px)';
    } else {
      var t = clamp((h - 6) / 13, 0, 1);                 // 0 清晨 → 1 傍晚
      sx = Math.round((5 - 10 * t) * 10) / 10;           // 早上光从左来，影子往右；下午反过来
      sy = Math.round((4 + Math.abs(t - .5) * 5) * 10) / 10;
      var warm = clamp((h - 14.5) / 4.5, 0, 1);          // 越接近傍晚越暖
      var a = (0.20 + warm * 0.14).toFixed(3);
      var col = warm > .5 ? '255,214,160' : '255,236,205';
      sun = 'linear-gradient(' + (t < .5 ? '90deg' : '270deg') + ',rgba(' + col + ',' + a + ') 0%,rgba(' + col + ',0) 58%)';
    }
    var sig = (night ? 'n' : 'd') + sx + ',' + sy + sun;
    panel.classList.toggle('aw-night', night);
    if (sig === lastLight) return;
    lastLight = sig;
    panel.style.setProperty('--aw-sx', sx + 'px');
    panel.style.setProperty('--aw-sy', sy + 'px');
    panel.style.setProperty('--aw-sun', sun);
  }

  // ---------------- 队列：明信片 ----------------
  function paperClass(hh) { var k = hh % 9; return k === 5 ? 'aw-air' : (k > 0 && k < 5 ? 'aw-k' + k : ''); }
  function decorateQueue(list) {
    var q = Q(), cur = curIdx();
    var expected = q.length;
    try { if (typeof queueHydrationExpectedTotal === 'function') expected = Math.max(expected, queueHydrationExpectedTotal() || 0); } catch (_e) { }
    var items = list.querySelectorAll('.queue-item[data-queue-index]');
    var mark = todayMark();
    for (var n = 0; n < items.length; n++) {
      var el = items[n];
      if (hasDeco(el)) continue;
      var i = Number(el.getAttribute('data-queue-index'));
      var s = q[i];
      if (!s) continue;
      var isNow = el.classList.contains('now');
      var hh = h32((isNow ? 'now' : '') + songKey(s));
      el.classList.add('aw-card');
      var pc = paperClass(hh); if (pc) el.classList.add(pc);
      if ((hh >>> 17) % 3 === 0) el.classList.add('aw-brown');
      if (i < cur) el.classList.add('aw-past');
      if (i === expected - 1) el.classList.add('aw-last');
      if (!isNow) {
        var w = clamp(90 + ((hh >>> 4) % 11), 90, 100), x = (hh >>> 8) % 9, r = (((hh >>> 12) % 9) - 4) * .28;
        el.style.setProperty('--aw-w', w + '%');
        el.style.setProperty('--aw-x', x + 'px');
        el.style.setProperty('--aw-r', r.toFixed(2) + 'deg');
      }
      el.style.setProperty('--aw-sr', ((((hh >>> 11) % 5) - 2) * .6).toFixed(1) + 'deg');
      var sub = el.querySelector('.qi-sub');
      if (sub) {
        if (isNow) sub.appendChild(deco('span', 'aw-ji', '寄'));
        else { var d = songDur(s); if (d) sub.appendChild(deco('span', 'aw-dur', fmt(d))); }
      }
      var html = stampHTML(hh) + '<span data-skin-deco class="aw-dv"></span><span data-skin-deco class="aw-ad"></span>';
      if (isNow) {
        html += '<span data-skin-deco class="aw-tape"></span><span data-skin-deco class="aw-pc">明 信 片 · POST CARD</span><span data-skin-deco class="aw-seal">在听</span>' +
          pmHTML(hh, '<span class="aw-pmt">' + fmt(nowPos()) + '</span>') +
          '<span data-skin-deco class="aw-to">寄往 · 此刻<br>共 <span class="aw-tot">' + fmt(nowDur(s)) + '</span></span>';
      } else {
        html += pmHTML(hh, mark) + '<span data-skin-deco class="aw-pc">POST CARD</span>';
      }
      el.insertAdjacentHTML('beforeend', html);
    }
    updateQueueNote();
  }
  function updateQueueNote() {
    var note = document.querySelector('#queue-pane .aw-qnote');
    if (!note) return;
    var q = Q(), cur = curIdx(), txt;
    var total = q.length;
    try { if (typeof queueHydrationExpectedTotal === 'function') total = Math.max(total, queueHydrationExpectedTotal() || 0); } catch (_e) { }
    if (!total) txt = '还没有寄来的明信片';
    else {
      var left = Math.max(0, total - Math.max(cur, -1) - 1);
      if (!left) txt = '这是最后一张了';
      else {
        var secs = 0;
        for (var i = Math.max(cur + 1, 0); i < q.length; i++) secs += songDur(q[i]);
        txt = '后面还有 <b>' + left + '</b> 张' + (secs ? ' · 约 ' + Math.max(1, Math.round(secs / 60)) + ' 分钟' + (total > q.length ? '+' : '') : '');
      }
    }
    if (note.__txt !== txt) { note.__txt = txt; note.innerHTML = txt; }
  }
  function tickNowCard() {
    var list = document.getElementById('queue-list');
    var now = list && list.querySelector('.queue-item.now');
    if (!now) return;
    var s = Q()[curIdx()];
    var t = now.querySelector('.aw-pmt'); if (t) { var v = fmt(nowPos()); if (t.textContent !== v) t.textContent = v; }
    var tt = now.querySelector('.aw-tot'); if (tt && s) { var v2 = fmt(nowDur(s)); if (tt.textContent !== v2) tt.textContent = v2; }
  }

  // ---------------- 歌单：书架 ----------------
  function plFromCard(card) {
    var idx = Number(card.getAttribute('data-playlist-index'));
    var pl = null;
    try { pl = userPlaylists[idx]; } catch (_e) { }
    if (!pl || String(pl.id) !== String(card.getAttribute('data-playlist-id') || '')) {
      try {
        var id = card.getAttribute('data-playlist-id');
        pl = userPlaylists.find(function (p) { return String(p.id) === String(id); }) || pl;
      } catch (_e2) { }
    }
    return pl || { id: card.getAttribute('data-playlist-id'), name: card.getAttribute('data-playlist-title'), trackCount: 0 };
  }
  function isLiked(pl) { return !!(pl && (Number(pl.specialType || 0) === 5 || String(pl.id || '') === 'spotify-liked' || /我喜欢|喜欢的音乐|Liked/i.test(pl.name || ''))); }
  function bookStyle(pl, provider) {
    var hh = h32(String(pl.id) + (pl.name || ''));
    var c = PAL[hh % PAL.length];
    var liked = isLiked(pl);
    if (liked) c = provider === 'qq' ? ['#2f5a4e', '#ecd9a4'] : ['#8e2f2a', '#f1dba6'];
    var count = Number(pl.trackCount) || 0;
    var w = Math.round(27 + Math.log(count + 1) * 2.4);
    var h = Math.round(126 + (hh >> 5) % 28);
    var lab = ((hh >>> 9) % 3 === 0) && !liked;
    var lum = parseInt(c[0].slice(1, 3), 16) + parseInt(c[0].slice(3, 5), 16) + parseInt(c[0].slice(5, 7), 16);
    return { hh: hh, c: c[0], g: c[1], w: w, h: h, lab: lab, foil: !lab && lum < 330 && ((hh >>> 13) % 2 === 0 || liked) };
  }
  function spineFont(title, st) {
    var t = String(title || '').replace(/\s+/g, '');
    var avail = st.h - (st.lab ? 82 : 56);
    var n = Math.max(1, t.length);
    var fs = clamp(avail / (n * 1.16), 8, Math.min(12.5, st.w * .46));
    var cap = Math.floor(avail / (fs * 1.16));
    return { fs: fs, fits: n <= cap };
  }
  function decoratePlaylists(list) {
    var detail = list.querySelector(':scope > .pl-inline-detail');
    list.classList.toggle('aw-reading', !!detail);
    if (!detail) lastDetailKey = '';
    if (detail) { decorateDetail(detail, list); return; }
    var cards = list.querySelectorAll(':scope > .pl-card');
    if (!cards.length || list.querySelector(':scope > .aw-plank')) return;
    // 1) 书脊样式
    var groups = [], g = null;
    for (var c = list.firstElementChild; c; c = c.nextElementSibling) {
      if (c.classList.contains('pl-section-label')) { g = { label: c, cards: [], key: '' }; groups.push(g); continue; }
      if (!c.classList.contains('pl-card')) continue;
      if (!g) { g = { label: null, cards: [], key: '' }; groups.push(g); }
      g.cards.push(c);
    }
    groups.forEach(function (grp) {
      grp.cards.forEach(function (card) {
        var provider = card.getAttribute('data-playlist-provider') || '';
        grp.key = grp.key || provider;
        var pl = plFromCard(card);
        var st = bookStyle(pl, provider);
        var sf = spineFont(pl.name, st);
        if (st.lab && !sf.fits) { st.lab = false; sf = spineFont(pl.name, st); }
        card.style.setProperty('--aw-c', st.c);
        card.style.setProperty('--aw-g', st.g);
        card.style.setProperty('--aw-w', st.w + 'px');
        card.style.setProperty('--aw-h', st.h + 'px');
        card.style.setProperty('--aw-fs', sf.fs.toFixed(1) + 'px');
        if (st.lab) card.classList.add('aw-lab');
        if (st.foil) card.classList.add('aw-foil');
        card.setAttribute('title', (pl.name || '') + ' · ' + (Number(pl.trackCount) || 0) + ' 首');
        card.appendChild(deco('span', 'aw-pg', String(Number(pl.trackCount) || 0)));
        if (pl.subscribed) card.appendChild(deco('span', 'aw-slip'));
      });
      var n = grp.cards.length;
      if (grp.label && !hasDeco(grp.label)) {
        grp.label.appendChild(deco('span', 'aw-hv'));
        grp.label.appendChild(deco('span', 'aw-cnt', n + ' 本'));
      }
      var lastCard = grp.cards[n - 1];
      if (!lastCard) return;
      var anchor = lastCard;
      if (grp.key === 'mineradio') {
        var nb = deco('button', 'aw-new', '<span>新建</span><i>＋</i>');
        nb.type = 'button'; nb.title = '新建内置歌单'; nb.setAttribute('aria-label', '新建内置歌单');
        anchor.after(nb); anchor = nb;
      } else if (n >= 3 && (h32(lastCard.getAttribute('data-playlist-id') || '') % 2 === 0)) {
        lastCard.classList.add('aw-lean');
      } else if (n > 2) {
        var be = deco('span', 'aw-bookend'); anchor.after(be); anchor = be;
      }
    });
    // 2) 按实际折行，在每一排书下面垫一块木板
    var ends = [], lineBottom = null, prevShelf = null;
    for (var el = list.firstElementChild; el; el = el.nextElementSibling) {
      var shelfItem = el.classList.contains('pl-card') || el.classList.contains('aw-new') || el.classList.contains('aw-bookend');
      if (!shelfItem) { if (prevShelf) ends.push(prevShelf); prevShelf = null; lineBottom = null; continue; }
      var b = el.offsetTop + el.offsetHeight;
      if (prevShelf && lineBottom != null && Math.abs(b - lineBottom) > 4) ends.push(prevShelf);
      lineBottom = b; prevShelf = el;
    }
    if (prevShelf) ends.push(prevShelf);
    ends.forEach(function (e) { e.after(deco('div', 'aw-plank')); });
  }
  function decorateDetail(detail, list) {
    var key = detail.getAttribute('data-pl-detail') || '';
    var parts = key.split(':'), provider = parts[0], pid = parts.slice(1).join(':');
    var pl = null;
    try { pl = (playlistPanelDetailState && playlistPanelDetailState.playlist) || null; } catch (_e) { }
    if (pl) {
      var st = bookStyle(pl, provider);
      detail.style.setProperty('--aw-c', st.c);
    }
    var sticky = detail.querySelector('.pl-detail-sticky');
    if (sticky && !hasDeco(sticky)) {
      var back = deco('button', 'aw-back', '← 放回书架');
      back.type = 'button';
      back.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        try { openPlaylistPanelDetail(provider, pid, ''); } catch (_e2) { }
      });
      sticky.appendChild(back);
      sticky.appendChild(deco('div', 'aw-toc', '目录'));
    }
    detail.querySelectorAll('.pl-detail-row[data-pl-detail-row]').forEach(function (row) {
      if (hasDeco(row)) return;
      var i = Number(row.getAttribute('data-pl-detail-row')) || 0;
      row.insertBefore(deco('span', 'aw-no', String(i + 1).padStart(2, '0')), row.firstChild);
    });
    if (key !== lastDetailKey) {
      lastDetailKey = key;
      var panel = list.closest('#playlist-panel');
      if (panel && panel.scrollTop > 0) { try { if (typeof gsap !== 'undefined') gsap.killTweensOf(panel); } catch (_e3) { } panel.scrollTop = 0; }
    }
    fixDetailOffset(detail, list);
  }
  var lastDetailKey = '';
  // 书架模式下书排成好几列，虚拟列表按"一张卡 69px"算出来的详情位置不准。
  // 这里把详情实际的位置写回虚拟列表的偏移表，让目录行的窗口跟着真实滚动位置走。
  var fixRaf = 0;
  function fixDetailOffset(detail, list) {
    try {
      var cache = playlistPanelVirtualCache;
      if (!cache || !cache.entries) return;
      var idx = -1;
      for (var i = 0; i < cache.entries.length; i++) if (cache.entries[i].type === 'detail') { idx = i; break; }
      if (idx < 0) return;
      var actual = Math.round(detail.getBoundingClientRect().top - list.getBoundingClientRect().top);
      if (Math.abs((cache.offsets[idx] || 0) - actual) <= 2) return;
      cache.offsets[idx] = actual;
      if (fixRaf) return;
      fixRaf = requestAnimationFrame(function () {
        fixRaf = 0;
        if (typeof renderUserPlaylistsList === 'function' && queueViewTab === 'playlists') renderUserPlaylistsList({ preserveScroll: true });
      });
    } catch (_e) { }
  }

  // ---------------- 播客：杂志 ----------------
  function decoratePodcasts(list) {
    var mags = list.querySelectorAll(':scope > .pl-card.podcast-card:not(.podcast-child)');
    if (!mags.length || list.querySelector(':scope > .aw-rack')) return;
    var prevC = -1;
    for (var i = 0; i < mags.length; i++) {
      var m = mags[i];
      var title = m.getAttribute('data-podcast-title') || '';
      var hh = h32((m.getAttribute('data-podcast-key') || '') + title);
      var ci = hh % MAGPAL.length; if (ci === prevC) ci = (ci + 1) % MAGPAL.length; prevC = ci;
      var c = MAGPAL[ci];
      var rot = [-1.8, 1.4][i % 2] + (((hh >>> 5) % 5) - 2) * .3;
      m.style.setProperty('--c', c[0]); m.style.setProperty('--g', c[1]); m.style.setProperty('--a', c[2]);
      m.style.setProperty('--aw-r', rot.toFixed(2) + 'deg');
      var cnt = 0;
      try { var pc = (myPodcastCollections || []).find(function (p) { return String(p.key) === String(m.getAttribute('data-podcast-key')); }); cnt = pc ? Number(pc.count) || 0 : 0; } catch (_e) { }
      m.insertAdjacentHTML('afterbegin', '<span data-skin-deco class="aw-art">' + magArt(hh, c) + '</span>');
      m.insertAdjacentHTML('beforeend', '<span data-skin-deco class="aw-vol"><span>PODCAST</span><span>' + (cnt ? 'No.' + cnt : '') + '</span></span><span data-skin-deco class="aw-bc"><i></i></span>');
      if (i % 2 === 1 || i === mags.length - 1) {
        var rack = deco('div', 'aw-rack');
        m.after(rack);
        if (i <= 1) rack.after(deco('div', 'aw-cap', '<b>我的播客</b><span>' + mags.length + ' 份</span>'));
      }
    }
  }

  // ---------------- 工具行上的装饰 ----------------
  function toolbarDeco(panel) {
    var qt = panel && panel.querySelector('#queue-pane .queue-toolbar');
    if (qt && !qt.querySelector('.aw-shuf')) {
      var btns = qt.querySelectorAll('button');
      Array.prototype.forEach.call(btns, function (b) {
        var oc = b.getAttribute('onclick') || '';
        if (/cyclePlayMode/.test(oc)) { b.classList.add('aw-mode-btn'); b.setAttribute('title', '切换播放模式'); }
        if (/clearQueue/.test(oc)) b.classList.add('aw-clear');
      });
      var shuf = deco('button', 'aw-tbtn aw-shuf', '打乱');
      shuf.type = 'button'; shuf.title = '把队列顺序打乱';
      shuf.addEventListener('click', function () { try { shuffleQueue(); } catch (_e) { } });
      qt.appendChild(shuf);
      qt.appendChild(deco('span', 'aw-hint', '长按换顺序'));
      qt.appendChild(deco('div', 'aw-qnote'));
    }
  }
  function removeToolbarDeco(panel) {
    if (!panel) return;
    panel.querySelectorAll('.queue-toolbar [data-skin-deco]').forEach(function (n) { n.remove(); });
    panel.querySelectorAll('.aw-mode-btn,.aw-clear').forEach(function (b) { b.classList.remove('aw-mode-btn', 'aw-clear'); if (/cyclePlayMode/.test(b.getAttribute('onclick') || '')) b.removeAttribute('title'); });
  }

  // 书架：悬停时书格标题换成这本书的名字；点"新建"笔记本
  function onShelfOver(e) {
    var card = e.target && e.target.closest && e.target.closest('#pl-list > .pl-card');
    var list = document.getElementById('pl-list');
    if (!list) return;
    list.querySelectorAll('.pl-section-label.aw-hov').forEach(function (l) { if (!card || l !== labelOf(card)) l.classList.remove('aw-hov'); });
    if (!card) return;
    var label = labelOf(card);
    if (!label) return;
    var hv = label.querySelector('.aw-hv');
    if (!hv) return;
    var pl = plFromCard(card);
    hv.textContent = (pl.name || '') + '  ·  ' + (Number(pl.trackCount) || 0) + ' 首' + (pl.subscribed ? ' · 收藏' : '');
    label.classList.add('aw-hov');
  }
  function labelOf(card) { for (var p = card.previousElementSibling; p; p = p.previousElementSibling) if (p.classList.contains('pl-section-label')) return p; return null; }
  function onShelfLeave() {
    var list = document.getElementById('pl-list');
    if (list) list.querySelectorAll('.pl-section-label.aw-hov').forEach(function (l) { l.classList.remove('aw-hov'); });
  }
  function onShelfClick(e) {
    var nb = e.target && e.target.closest && e.target.closest('#pl-list .aw-new');
    if (!nb) return;
    e.preventDefault(); e.stopPropagation();
    try { promptCreateBuiltInPlaylist(); } catch (_e) { }
  }

  var bound = null;
  registerPanelSkin({
    id: 'afternoon',
    css: css,
    virtual: { queueRowStep: 48, fullPlaylistRender: true },
    attach: function (panel) {
      if (!panel) return;
      var t = textures();
      panel.style.setProperty('--aw-noise', t.noise);
      panel.style.setProperty('--aw-cloth', t.cloth);
      lastLight = '';
      applyLight(panel);
      toolbarDeco(panel);
      var pl = document.getElementById('pl-list');
      if (pl && !bound) {
        bound = pl;
        pl.addEventListener('pointerover', onShelfOver);
        pl.addEventListener('pointerleave', onShelfLeave);
        pl.addEventListener('click', onShelfClick, true);
      }
      updateQueueNote();
    },
    detach: function (panel) {
      if (panel) {
        ['--aw-noise', '--aw-cloth', '--aw-sx', '--aw-sy', '--aw-sun'].forEach(function (k) { panel.style.removeProperty(k); });
        panel.classList.remove('aw-night');
        removeToolbarDeco(panel);
      }
      if (bound) {
        bound.removeEventListener('pointerover', onShelfOver);
        bound.removeEventListener('pointerleave', onShelfLeave);
        bound.removeEventListener('click', onShelfClick, true);
        bound.classList.remove('aw-reading');
        bound = null;
      }
      lastLight = '';
    },
    decorate: function (kind, container, panel) {
      if (kind === 'head') { toolbarDeco(panel); return; }
      if (kind === 'queue') decorateQueue(container);
      else if (kind === 'playlists') decoratePlaylists(container);
      else if (kind === 'podcasts') decoratePodcasts(container);
    },
    tick: function (panel) {
      applyLight(panel);
      tickNowCard();
      updateQueueNote();
    }
  });
})();
