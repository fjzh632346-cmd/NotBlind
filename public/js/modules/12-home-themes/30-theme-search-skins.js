// ============================================================
// [二改] 主页主题上的搜索框：每个主题一种样子
// 搜索功能还是软件原来那一套（#search-area：输入框、平台切换、结果列表、红心 / 收藏 / 下一首），
// 这里只在"主题开着、搜索浮层打开"（body.nb-theme-searching）时，按当前主题换外观和文案：
//   回声 echo         —— 一条地平线：没有框，只有一道细线和编号列表，朱红点缀
//   星图 star-atlas   —— 夜空星盘：深蓝底、金色细边、星号代替放大镜，封面变成圆形星体
//   午后窗影 afternoon —— 墙上的便签纸：米色纸面、宋体、横格线；夜里换成暖灯下的深色纸
//   孔版 riso-poster  —— 套色印刷：粗蓝框、粉色错版阴影、盖章式的平台切换、黄色高亮
// ============================================================
;(function () {
  if (window.__nbThemeSearchSkins) return;
  window.__nbThemeSearchSkins = true;

  var SANS = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  var MONO = '"Cascadia Mono",Consolas,"Microsoft YaHei UI",monospace';
  var SERIF = '"Source Han Serif SC","Noto Serif SC","Songti SC","STSong","SimSun","宋体",serif';

  // :not(#nb-x) 只是为了把优先级抬高一级（原来的搜索框样式里有很多带 id 和 !important 的规则）
  function sc(theme, extra) { return 'html body.nb-theme-searching.mri-th-' + theme + (extra || '') + ':not(#nb-x):not(#nb-y) '; }

  // 所有主题共用：去掉原来的玻璃效果和上传按钮，结果区统一的骨架
  function base(t) {
    var p = sc(t);
    return [
      p + '#upload-actions{display:none!important}',
      p + '#search-box,' + p + '#search-results,' + p + '#search-results.show,' + p + '.search-mode-tabs,' + p + '.search-mode-tabs button,' + p + '.search-result .add-btn,' + p + '.song-action-btn,' + p + '.search-history-chip{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
      p + '#search-box::before,' + p + '#search-results.show::before,' + p + '#search-results.search-history-surface::before{content:none!important}',
      p + '#search-results.show .search-result{background:transparent!important}',
      p + '.search-result:hover{background:transparent!important}',
      p + '#search-stack{position:relative}',
      p + '#search-stack::before{position:absolute;left:0;bottom:100%;margin-bottom:10px;white-space:nowrap;pointer-events:none}'
    ].join('\n');
  }

  var CSS = [
    // ---------------- 回声：一条地平线 ----------------
    base('echo'),
    sc('echo') + '#search-stack{width:min(600px,60vw)}',
    sc('echo') + '#search-stack::before{content:"06 — 搜索";font:500 11px/1 ' + MONO + ';letter-spacing:.3em;color:rgba(223,227,220,.44)}',
    sc('echo') + '#search-box,' + sc('echo') + '#search-area.peek #search-box{height:64px!important;padding:0 2px!important;border-radius:0!important;background:transparent!important;border:0!important;border-bottom:1.5px solid rgba(223,227,220,.5)!important;box-shadow:none!important;transform:none!important}',
    sc('echo') + '#search-box:focus-within{border-bottom-color:#ff4a1c!important}',
    sc('echo') + '#search-icon{color:rgba(223,227,220,.5)!important;margin-right:16px}',
    sc('echo') + '#search-input{font:300 26px/1.2 ' + SANS + '!important;color:#dfe3dc!important;letter-spacing:.06em!important;caret-color:#ff4a1c}',
    sc('echo') + '#search-input::placeholder{color:rgba(223,227,220,.26)!important}',
    sc('echo') + '.search-mode-tabs{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;margin-top:14px!important;gap:0!important}',
    sc('echo') + '.search-mode-tabs button{height:22px!important;padding:0 12px!important;border-radius:0!important;background:transparent!important;border:0!important;box-shadow:none!important;color:rgba(223,227,220,.4)!important;font:500 11px/22px ' + MONO + '!important;letter-spacing:.14em!important}',
    sc('echo') + '.search-mode-tabs button+button{border-left:1px solid rgba(223,227,220,.16)!important}',
    sc('echo') + '.search-mode-tabs button:hover{color:#dfe3dc!important}',
    sc('echo') + '.search-mode-tabs button.active{color:#ff4a1c!important;background:transparent!important;box-shadow:none!important;text-decoration:underline;text-underline-offset:6px}',
    sc('echo') + '#search-results,' + sc('echo') + '#search-results.show,' + sc('echo') + '#search-results.show:not(.search-history-surface),' + sc('echo') + '#search-results.search-history-surface{margin-top:18px!important;background:rgba(20,18,17,.96)!important;border:0!important;border-top:1px solid rgba(223,227,220,.22)!important;border-radius:0!important;box-shadow:0 30px 60px rgba(0,0,0,.45)!important;counter-reset:ecr;max-height:min(440px,58vh)!important}',
    sc('echo') + '#search-results::-webkit-scrollbar-thumb{background:rgba(223,227,220,.18)!important}',
    sc('echo') + '#search-results.show .search-result{counter-increment:ecr;padding:12px 14px 12px 12px!important;border-bottom:1px solid rgba(223,227,220,.08)!important;transition:padding .25s cubic-bezier(.2,.8,.2,1),background .2s}',
    sc('echo') + '#search-results.show .search-result::before{content:counter(ecr,decimal-leading-zero);width:22px;flex:none;font:500 11px/1 ' + MONO + ';color:rgba(223,227,220,.34);letter-spacing:.06em}',
    sc('echo') + '#search-results.show .search-result:hover{padding-left:20px!important;background:rgba(223,227,220,.035)!important}',
    sc('echo') + '#search-results.show .search-result:hover::before{color:#ff4a1c}',
    sc('echo') + '.search-result img{width:36px!important;height:36px!important;border-radius:2px!important;filter:grayscale(1) contrast(1.05);opacity:.8;transition:filter .3s,opacity .3s}',
    sc('echo') + '.search-result:hover img{filter:none;opacity:1}',
    sc('echo') + '.search-result-title{color:#dfe3dc!important;font-weight:400!important;font-size:13.5px!important;letter-spacing:.04em}',
    sc('echo') + '.search-result-meta,' + sc('echo') + '.search-artist-link{color:rgba(223,227,220,.44)!important;font-family:' + SANS + '}',
    sc('echo') + '.tag-source{background:transparent!important;border:1px solid rgba(223,227,220,.22)!important;color:rgba(223,227,220,.6)!important;border-radius:2px!important;font-family:' + MONO + '!important;box-shadow:none!important}',
    sc('echo') + '.song-action-btn,' + sc('echo') + '.search-result .add-btn{background:transparent!important;border:1px solid rgba(223,227,220,.18)!important;box-shadow:none!important;color:rgba(223,227,220,.6)!important;border-radius:50%!important}',
    sc('echo') + '.song-action-btn:hover,' + sc('echo') + '.search-result .add-btn:hover{border-color:#ff4a1c!important;color:#ff4a1c!important;background:transparent!important}',
    sc('echo') + '.song-action-btn.liked{color:#ff4a1c!important;border-color:rgba(255,74,28,.6)!important}',
    sc('echo') + '.search-empty{color:rgba(223,227,220,.36)!important;font-family:' + MONO + ';letter-spacing:.08em}',
    sc('echo') + '.search-history-chip{background:transparent!important;border:1px solid rgba(223,227,220,.2)!important;border-radius:2px!important;color:rgba(223,227,220,.7)!important;box-shadow:none!important}',

    // ---------------- 星图：夜空星盘 ----------------
    base('star-atlas'),
    sc('star-atlas') + '#search-stack::before{content:"✦  寻 星";font:400 12px/1 ' + SERIF + ';letter-spacing:.5em;color:rgba(201,168,106,.7);left:50%;transform:translateX(-50%)}',
    sc('star-atlas') + '#search-box,' + sc('star-atlas') + '#search-area.peek #search-box{height:58px!important;border-radius:29px!important;padding:0 24px!important;background:radial-gradient(120% 180% at 50% -40%,rgba(38,52,92,.95),rgba(9,13,28,.96) 60%)!important;border:1px solid rgba(201,168,106,.42)!important;box-shadow:0 0 0 5px rgba(201,168,106,.05),0 18px 50px rgba(0,0,0,.55),inset 0 1px 0 rgba(236,230,216,.08)!important}',
    sc('star-atlas') + '#search-box:focus-within{border-color:rgba(201,168,106,.8)!important;box-shadow:0 0 0 5px rgba(201,168,106,.09),0 0 28px rgba(201,168,106,.18),0 18px 50px rgba(0,0,0,.55)!important;transform:none!important}',
    sc('star-atlas') + '#search-icon{display:none!important}',
    sc('star-atlas') + '#search-box::after{content:"✦";order:-1;margin-right:14px;color:rgb(201,168,106);font-size:15px;text-shadow:0 0 10px rgba(201,168,106,.8);animation:nbstw 3.2s ease-in-out infinite}',
    '@keyframes nbstw{0%,100%{opacity:.55}50%{opacity:1}}',
    sc('star-atlas') + '#search-input{font:400 16px/1.2 ' + SERIF + '!important;color:rgb(236,230,216)!important;letter-spacing:.14em!important;caret-color:rgb(201,168,106)}',
    sc('star-atlas') + '#search-input::placeholder{color:rgba(236,230,216,.3)!important}',
    sc('star-atlas') + '.search-mode-tabs{margin:12px auto 0!important;background:transparent!important;border:0!important;box-shadow:none!important;gap:6px!important}',
    sc('star-atlas') + '.search-mode-tabs button{height:24px!important;padding:0 12px!important;background:transparent!important;border:1px solid transparent!important;box-shadow:none!important;color:rgba(236,230,216,.42)!important;font:400 11px/22px ' + SERIF + '!important;letter-spacing:.24em!important;border-radius:12px!important}',
    sc('star-atlas') + '.search-mode-tabs button:hover{color:rgba(236,230,216,.9)!important}',
    sc('star-atlas') + '.search-mode-tabs button.active{color:rgb(201,168,106)!important;border-color:rgba(201,168,106,.45)!important;background:rgba(201,168,106,.06)!important;box-shadow:none!important}',
    sc('star-atlas') + '#search-results,' + sc('star-atlas') + '#search-results.show,' + sc('star-atlas') + '#search-results.show:not(.search-history-surface),' + sc('star-atlas') + '#search-results.search-history-surface{margin-top:14px!important;border-radius:22px!important;background:radial-gradient(90% 60% at 50% 0%,rgba(30,42,78,.97),rgba(8,11,24,.97))!important;border:1px solid rgba(201,168,106,.26)!important;box-shadow:0 26px 70px rgba(0,0,0,.6),inset 0 1px 0 rgba(236,230,216,.06)!important;padding:6px 0!important}',
    sc('star-atlas') + '#search-results::-webkit-scrollbar-thumb{background:rgba(201,168,106,.3)!important}',
    sc('star-atlas') + '#search-results.show .search-result{border-bottom:1px solid rgba(201,168,106,.08)!important;padding:10px 18px!important}',
    sc('star-atlas') + '#search-results.show .search-result:hover{background:linear-gradient(90deg,rgba(201,168,106,.10),transparent 70%)!important}',
    sc('star-atlas') + '.search-result img{border-radius:50%!important;width:38px!important;height:38px!important;box-shadow:0 0 0 1px rgba(201,168,106,.35),0 0 14px rgba(201,168,106,.12);transition:box-shadow .3s}',
    sc('star-atlas') + '.search-result:hover img{box-shadow:0 0 0 1px rgba(201,168,106,.8),0 0 20px rgba(201,168,106,.4)}',
    sc('star-atlas') + '.search-result-title{color:rgb(236,230,216)!important;font-family:' + SERIF + '!important;font-weight:500!important;letter-spacing:.05em}',
    sc('star-atlas') + '.search-result-meta,' + sc('star-atlas') + '.search-artist-link{color:rgba(201,168,106,.62)!important}',
    sc('star-atlas') + '.tag-source{background:transparent!important;border:1px solid rgba(201,168,106,.35)!important;color:rgba(201,168,106,.85)!important;box-shadow:none!important;border-radius:8px!important}',
    sc('star-atlas') + '.song-action-btn,' + sc('star-atlas') + '.search-result .add-btn{background:rgba(236,230,216,.04)!important;border:1px solid rgba(201,168,106,.22)!important;box-shadow:none!important;color:rgba(236,230,216,.7)!important}',
    sc('star-atlas') + '.song-action-btn:hover,' + sc('star-atlas') + '.search-result .add-btn:hover{border-color:rgba(201,168,106,.8)!important;color:rgb(201,168,106)!important;box-shadow:0 0 12px rgba(201,168,106,.3)!important}',
    sc('star-atlas') + '.song-action-btn.liked{color:rgb(233,196,120)!important}',
    sc('star-atlas') + '.search-empty{color:rgba(236,230,216,.4)!important;font-family:' + SERIF + ';letter-spacing:.14em}',
    sc('star-atlas') + '.search-history-chip{background:transparent!important;border:1px solid rgba(201,168,106,.3)!important;color:rgba(236,230,216,.75)!important;box-shadow:none!important}',

    // ---------------- 午后窗影：墙上的便签（白天浅色、夜里暖灯深色） ----------------
    base('afternoon'),
    sc('afternoon') + '#search-stack{width:min(540px,58vw);--aw-paper:#f4efe4;--aw-paper2:#ebe3d3;--aw-ink:#2a221b;--aw-ink2:rgba(42,34,27,.62);--aw-ink3:rgba(42,34,27,.36);--aw-line:rgba(42,34,27,.12);--aw-acc:#b5603a}',
    sc('afternoon', ':not(.hth-chrome-light)') + '#search-stack{--aw-paper:#2f2822;--aw-paper2:#27211c;--aw-ink:rgba(240,228,208,.92);--aw-ink2:rgba(236,224,204,.62);--aw-ink3:rgba(236,224,204,.36);--aw-line:rgba(236,224,204,.12);--aw-acc:#e3906a}',
    sc('afternoon') + '#search-stack::before{content:"写 在 墙 上";font:400 12px/1 ' + SERIF + ';letter-spacing:.4em;color:var(--aw-ink2);left:4px}',
    sc('afternoon') + '#search-box,' + sc('afternoon') + '#search-area.peek #search-box{height:60px!important;border-radius:3px!important;padding:0 22px!important;background:var(--aw-paper)!important;border:0!important;box-shadow:0 1px 0 rgba(255,255,255,.4) inset,0 12px 26px -10px rgba(40,26,14,.45),0 2px 4px rgba(40,26,14,.18)!important;transform:rotate(-.6deg)!important}',
    sc('afternoon') + '#search-box::after{content:"";position:absolute;left:50%;top:-9px;width:64px;height:18px;margin-left:-32px;background:rgba(236,226,200,.55);box-shadow:0 1px 2px rgba(40,26,14,.15);transform:rotate(2deg);pointer-events:none}',
    sc('afternoon', ':not(.hth-chrome-light)') + '#search-box::after{background:rgba(236,226,200,.16)!important}',
    sc('afternoon') + '#search-icon{color:var(--aw-ink3)!important}',
    sc('afternoon') + '#search-input{font:400 18px/1.2 ' + SERIF + '!important;color:var(--aw-ink)!important;letter-spacing:.1em!important;caret-color:var(--aw-acc);background-image:linear-gradient(var(--aw-line),var(--aw-line))!important;background-size:100% 1px!important;background-position:0 100%!important;background-repeat:no-repeat!important;padding-bottom:4px!important}',
    sc('afternoon') + '#search-input::placeholder{color:var(--aw-ink3)!important}',
    sc('afternoon') + '.search-mode-tabs{background:transparent!important;border:0!important;box-shadow:none!important;padding:0 4px!important;margin-top:12px!important;gap:4px!important}',
    sc('afternoon') + '.search-mode-tabs button{height:24px!important;padding:0 11px!important;border-radius:2px 2px 0 0!important;background:var(--aw-paper2)!important;border:0!important;box-shadow:0 2px 5px -2px rgba(40,26,14,.3)!important;color:var(--aw-ink2)!important;font:400 11.5px/24px ' + SERIF + '!important;letter-spacing:.12em!important;transform:translateY(2px);transition:transform .2s,color .2s,background .2s!important}',
    sc('afternoon') + '.search-mode-tabs button:hover{transform:translateY(0);color:var(--aw-ink)!important}',
    sc('afternoon') + '.search-mode-tabs button.active{background:var(--aw-paper)!important;color:var(--aw-acc)!important;transform:translateY(0);box-shadow:0 -2px 6px -2px rgba(40,26,14,.25)!important}',
    sc('afternoon') + '#search-results,' + sc('afternoon') + '#search-results.show,' + sc('afternoon') + '#search-results.show:not(.search-history-surface),' + sc('afternoon') + '#search-results.search-history-surface{margin-top:10px!important;border-radius:3px!important;border:0!important;background:repeating-linear-gradient(180deg,transparent 0 61px,var(--aw-line) 61px 62px),var(--aw-paper)!important;background-attachment:local!important;box-shadow:0 18px 40px -14px rgba(40,26,14,.5),0 2px 5px rgba(40,26,14,.18)!important;transform:rotate(.35deg)}',
    sc('afternoon') + '#search-results::-webkit-scrollbar-thumb{background:var(--aw-line)!important}',
    sc('afternoon') + '#search-results.show .search-result{border-bottom:0!important;height:62px;padding:0 18px!important}',
    sc('afternoon') + '#search-results.show .search-result:hover{background:linear-gradient(90deg,rgba(255,214,150,.22),transparent 80%)!important}',
    sc('afternoon') + '.search-result img{width:40px!important;height:40px!important;border-radius:1px!important;border:3px solid #fbf8f1;box-shadow:0 2px 5px rgba(40,26,14,.28);transform:rotate(-2deg);transition:transform .3s}',
    sc('afternoon') + '.search-result:nth-child(even) img{transform:rotate(1.5deg)}',
    sc('afternoon') + '.search-result:hover img{transform:rotate(0) scale(1.06)}',
    sc('afternoon') + '.search-result-title{color:var(--aw-ink)!important;font-family:' + SERIF + '!important;font-weight:500!important;letter-spacing:.06em}',
    sc('afternoon') + '.search-result-meta,' + sc('afternoon') + '.search-artist-link{color:var(--aw-ink2)!important;font-family:' + SERIF + '}',
    sc('afternoon') + '.tag-source{background:transparent!important;border:1px solid var(--aw-ink3)!important;color:var(--aw-ink2)!important;box-shadow:none!important;border-radius:2px!important}',
    sc('afternoon') + '.song-action-btn,' + sc('afternoon') + '.search-result .add-btn{background:transparent!important;border:1px solid var(--aw-line)!important;box-shadow:none!important;color:var(--aw-ink2)!important}',
    sc('afternoon') + '.song-action-btn:hover,' + sc('afternoon') + '.search-result .add-btn:hover{color:var(--aw-acc)!important;border-color:var(--aw-acc)!important;background:transparent!important}',
    sc('afternoon') + '.song-action-btn.liked{color:var(--aw-acc)!important}',
    sc('afternoon') + '.search-empty{color:var(--aw-ink3)!important;font-family:' + SERIF + ';letter-spacing:.1em}',
    sc('afternoon') + '.search-history-chip{background:var(--aw-paper2)!important;border:0!important;color:var(--aw-ink2)!important;box-shadow:none!important;border-radius:2px!important}',

    // ---------------- 孔版：套色印刷 ----------------
    base('riso-poster'),
    sc('riso-poster') + '#search-stack{width:min(560px,60vw)}',
    sc('riso-poster') + '#search-stack::before{content:"盖章搜索 · HANDBILL";font:900 12px/1 ' + SANS + ';letter-spacing:.16em;color:#ff3d9a;left:6px;transform:rotate(-1.5deg)}',
    sc('riso-poster') + '#search-box,' + sc('riso-poster') + '#search-area.peek #search-box{height:62px!important;border-radius:0!important;padding:0 20px!important;background:#f1eadb!important;border:3px solid #2a4c9c!important;box-shadow:5px 5px 0 #ff3d9a!important;transform:rotate(-.8deg)!important}',
    sc('riso-poster') + '#search-box:focus-within{box-shadow:7px 7px 0 #ff3d9a,-3px -3px 0 #ffd92e!important}',
    sc('riso-poster') + '#search-icon{color:#2a4c9c!important;stroke-width:3}',
    sc('riso-poster') + '#search-input{font:900 22px/1.2 ' + SANS + '!important;color:#2a4c9c!important;letter-spacing:.06em!important;caret-color:#ff3d9a}',
    sc('riso-poster') + '#search-input::placeholder{color:rgba(42,76,156,.35)!important;font-weight:700!important}',
    sc('riso-poster') + '.search-mode-tabs{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;margin-top:14px!important;gap:8px!important}',
    sc('riso-poster') + '.search-mode-tabs button{height:26px!important;padding:0 10px!important;border-radius:0!important;background:transparent!important;border:2px solid #2a4c9c!important;box-shadow:none!important;color:#2a4c9c!important;font:900 11px/22px ' + SANS + '!important;letter-spacing:.08em!important;transform:rotate(-2deg);transition:transform .18s cubic-bezier(.34,1.42,.5,1),background .15s!important}',
    sc('riso-poster') + '.search-mode-tabs button:nth-child(even){transform:rotate(1.5deg)}',
    sc('riso-poster') + '.search-mode-tabs button:hover{transform:rotate(0) scale(1.06)}',
    sc('riso-poster') + '.search-mode-tabs button.active{background:#ffd92e!important;color:#2a4c9c!important;box-shadow:3px 3px 0 #ff3d9a!important}',
    sc('riso-poster') + '#search-results,' + sc('riso-poster') + '#search-results.show,' + sc('riso-poster') + '#search-results.show:not(.search-history-surface),' + sc('riso-poster') + '#search-results.search-history-surface{margin-top:14px!important;border-radius:0!important;background:#f1eadb!important;border:3px solid #2a4c9c!important;box-shadow:6px 6px 0 rgba(255,61,154,.85)!important;transform:rotate(.4deg)}',
    sc('riso-poster') + '#search-results::-webkit-scrollbar{width:6px!important}',
    sc('riso-poster') + '#search-results::-webkit-scrollbar-thumb{background:#2a4c9c!important;border-radius:0!important}',
    sc('riso-poster') + '#search-results.show .search-result{border-bottom:2px dashed rgba(42,76,156,.35)!important;padding:10px 16px!important}',
    sc('riso-poster') + '#search-results.show .search-result:hover{background:#ffd92e!important}',
    sc('riso-poster') + '.search-result img{border-radius:0!important;width:42px!important;height:42px!important;filter:grayscale(1) contrast(1.3) brightness(1.05);mix-blend-mode:multiply;box-shadow:2px 2px 0 #ff3d9a;transition:filter .2s}',
    sc('riso-poster') + '.search-result:hover img{filter:none;mix-blend-mode:normal}',
    sc('riso-poster') + '.search-result-title{color:#2a4c9c!important;font-weight:900!important;font-size:14px!important}',
    sc('riso-poster') + '.search-result-meta,' + sc('riso-poster') + '.search-artist-link{color:rgba(42,76,156,.72)!important;font-weight:600!important}',
    sc('riso-poster') + '.tag-source{background:#ff3d9a!important;border:0!important;color:#f1eadb!important;box-shadow:none!important;border-radius:0!important;font-weight:900!important}',
    sc('riso-poster') + '.song-action-btn,' + sc('riso-poster') + '.search-result .add-btn{background:transparent!important;border:2px solid #2a4c9c!important;box-shadow:none!important;color:#2a4c9c!important;border-radius:0!important}',
    sc('riso-poster') + '.song-action-btn:hover,' + sc('riso-poster') + '.search-result .add-btn:hover{background:#2a4c9c!important;color:#f1eadb!important}',
    sc('riso-poster') + '.song-action-btn.liked{color:#ff3d9a!important;border-color:#ff3d9a!important}',
    sc('riso-poster') + '.search-empty{color:#2a4c9c!important;font-weight:700;letter-spacing:.08em}',
    sc('riso-poster') + '.search-history-chip{background:transparent!important;border:2px solid #2a4c9c!important;color:#2a4c9c!important;box-shadow:none!important;border-radius:0!important;font-weight:800}',

    // 搜索框整体往下挪，离开窗口顶部那条"拖动窗口"的区域（窗口化时那里点不动），也给上面的小标题留位置
    'html body.nb-theme-searching.home-theme-on #search-area.peek{top:78px!important;-webkit-app-region:no-drag}',
    // 顶部入口的代点按钮（见下面 titlebar 代理）
    '#nb-tb-proxy{position:absolute;display:none;z-index:3;background:transparent;border:0;padding:0;margin:0;cursor:pointer;pointer-events:auto;-webkit-app-region:no-drag;outline:none}',
    '#nb-tb-proxy.on{display:block}',

    // 遮罩也跟着主题换颜色：亮色主题用纸色压一层，暗色主题用深色
    'html body.nb-theme-searching.mri-th-star-atlas #nb-theme-search-veil{background:rgba(4,7,18,.58)!important}',
    'html body.nb-theme-searching.mri-th-afternoon.hth-chrome-light #nb-theme-search-veil{background:rgba(236,228,212,.5)!important}',
    'html body.nb-theme-searching.mri-th-afternoon:not(.hth-chrome-light) #nb-theme-search-veil{background:rgba(20,15,12,.55)!important}',
    'html body.nb-theme-searching.mri-th-riso-poster #nb-theme-search-veil{background:rgba(241,234,219,.62)!important}'
  ].join('\n');

  // 每个主题的输入框提示语
  var PH = {
    'echo': '想听什么',
    'star-atlas': '寻一颗星：歌名、歌手……',
    'afternoon': '把想听的写在这里',
    'riso-poster': '要印哪首？'
  };

  function ensureStyle() {
    if (document.getElementById('nb-theme-search-skins')) return;
    var st = document.createElement('style');
    st.id = 'nb-theme-search-skins';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function currentTheme() {
    var m = /(?:^|\s)mri-th-([a-z-]+)/.exec(document.body.className);
    return m ? m[1] : '';
  }
  var savedPh = null;
  function sync() {
    var inp = document.getElementById('search-input');
    if (!inp) return;
    var on = document.body.classList.contains('nb-theme-searching');
    var ph = on ? PH[currentTheme()] : null;
    if (ph) {
      if (savedPh === null) savedPh = inp.getAttribute('placeholder') || '';
      if (inp.getAttribute('placeholder') !== ph) inp.setAttribute('placeholder', ph);
    } else if (savedPh !== null) {
      inp.setAttribute('placeholder', savedPh);
      savedPh = null;
    }
  }
  // ---------- 窗口化时，顶部 44px 是"拖动窗口"的区域（标题栏，层级在所有界面之上）。
  // 主题放在左上角 / 顶部的搜索入口落在这条区域里，Windows 会把点击当成拖窗口，只有伸出去的下边缘点得到。
  // 做法：在标题栏里放一个透明的"代点按钮"，按入口的真实位置盖上去，点它 = 点入口。
  // 全屏 / 浏览器里标题栏不显示，代点按钮也就不出现，入口照常自己接点击。
  var ENTRY_SEL = '.rp-hint, .sx-hint, .ha-shint';
  var proxy = null, proxyTarget = null;
  function ensureProxy(tb) {
    if (proxy && proxy.parentNode === tb) return proxy;
    if (!proxy) {
      proxy = document.createElement('button');
      proxy.type = 'button'; proxy.id = 'nb-tb-proxy'; proxy.setAttribute('aria-label', '搜索');
      proxy.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (proxyTarget && proxyTarget.isConnected) proxyTarget.click(); hideProxy(); });
      proxy.addEventListener('pointerenter', function () { if (proxyTarget) proxyTarget.classList.add('hov'); });
      proxy.addEventListener('pointerleave', function () { if (proxyTarget) proxyTarget.classList.remove('hov'); });
    }
    tb.appendChild(proxy);
    return proxy;
  }
  function hideProxy() {
    if (proxy) proxy.classList.remove('on');
    if (proxyTarget) proxyTarget.classList.remove('hov');
    proxyTarget = null;
  }
  function visibleEl(el) {
    if (!el || !el.isConnected) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05 && cs.pointerEvents !== 'none';
  }
  function syncProxy() {
    var b = document.body;
    var tb = document.getElementById('desktop-titlebar');
    if (!tb || !b.classList.contains('home-theme-on') || b.classList.contains('nb-theme-searching') || getComputedStyle(tb).display === 'none') { hideProxy(); return; }
    var tbr = tb.getBoundingClientRect(), H = tbr.height || 44;
    var root = document.getElementById('home-theme-root') || document;
    var list = root.querySelectorAll(ENTRY_SEL), target = null, r = null;
    for (var i = 0; i < list.length; i++) {
      if (!visibleEl(list[i])) continue;
      var rr = list[i].getBoundingClientRect();
      if (rr.top < tbr.top + H + 4) { target = list[i]; r = rr; break; }
    }
    if (!target) { hideProxy(); return; }
    var p = ensureProxy(tb), padX = 14, padY = 10;
    if (proxyTarget && proxyTarget !== target) proxyTarget.classList.remove('hov');
    proxyTarget = target;
    var top = Math.max(0, r.top - tbr.top - padY), bottom = Math.min(H, r.bottom - tbr.top + padY);
    p.style.left = Math.round(r.left - tbr.left - padX) + 'px';
    p.style.top = Math.round(top) + 'px';
    p.style.width = Math.round(r.width + padX * 2) + 'px';
    p.style.height = Math.max(0, Math.round(bottom - top)) + 'px';
    p.title = target.getAttribute('title') || target.getAttribute('aria-label') || '搜索';
    p.classList.add('on');
  }
  var proxyTimer = 0;
  function scheduleProxy() { if (proxyTimer) return; proxyTimer = setTimeout(function () { proxyTimer = 0; try { syncProxy(); } catch (_e) { } }, 60); }

  function boot() {
    ensureStyle();
    new MutationObserver(scheduleProxy).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', scheduleProxy);
    setInterval(function () { if (document.body.classList.contains('home-theme-on') && !document.hidden) syncProxy(); }, 800);
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    sync();
  }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
