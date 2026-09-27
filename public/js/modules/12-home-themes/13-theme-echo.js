// ============================================================
// Home theme · 回声（Not Blind 默认页）
// 接在「地平线 · 灰绿」开场之后：开场那条线和那个圆原位留下，变成深色主页上的灰绿线；
// 左边六个超粗空心大字入口，悬停变实心并往圆的方向拉出几层回声（静止，不跟节拍跳）；
// 圆 = 正在播放（朱红进度弧、30 秒刻度、跟着低音荡开的波纹），沿圆周拖动调进度。
// 只用 Canvas 2D + CSS 3D，没有 WebGL。
// ============================================================
(function () {
  'use strict';
  var ID = 'echo';

  // 第一次装上这个版本时，把主页换成回声（之后用户用拉绳/设置改了就尊重用户的选择）
  try {
    var ADOPT = 'mineradio-home-theme-echo-adopted';
    if (!localStorage.getItem(ADOPT)) {
      localStorage.setItem(typeof HOME_THEME_STORAGE_KEY === 'string' ? HOME_THEME_STORAGE_KEY : 'mineradio-home-theme-v1', ID);
      localStorage.setItem(ADOPT, '1');
    }
  } catch (_e) { }

  var HEAVY = '"Source Han Sans SC Heavy","思源黑体 Heavy","Noto Sans SC Black","Noto Sans CJK SC","Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif';
  var UI = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  var THIN = '"Segoe UI Light","Segoe UI","Microsoft YaHei UI Light","Microsoft YaHei UI",sans-serif';
  var MONO = '"Cascadia Mono",Consolas,"Microsoft YaHei UI",monospace';
  var HOT = '#ff4a1c';
  var VOLC = '#e3c27a';   // [二改] 音量：小圆上的黄铜色弧，和朱红进度区分开

  var CSS = [
    '.hth-echo{--ink:#dfe3dc;--ink2:rgba(223,227,220,.66);--ink3:rgba(223,227,220,.44);--ink4:rgba(223,227,220,.16);--hot:' + HOT + ';background:#141211;color:var(--ink);font-family:' + UI + ';user-select:none;-webkit-font-smoothing:antialiased}',
    '.hth-echo button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}',
    '.hth-echo button:focus-visible,.hth-echo input:focus-visible,.hth-echo [tabindex]:focus-visible{outline:1.5px solid var(--hot);outline-offset:3px}',
    '.hth-echo .ec-mono{font-family:' + MONO + ';letter-spacing:.04em;font-variant-numeric:tabular-nums}',
    '.hth-echo svg.ec-ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linejoin:round;stroke-linecap:round;display:block}',
    '.hth-echo .ec-cv{position:absolute;inset:0;pointer-events:none}',
    // [二改][流畅度] 颗粒不再是一层全屏 mix-blend-mode 叠加（每帧都要把整屏抓出来混合一遍），改成烘进画布底图
    '.hth-echo .ec-grain{display:none}',
    '.hth-echo .ec-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(130% 95% at 42% 42%,transparent 52%,rgba(0,0,0,.42) 100%)}',
    // 名字（拉绳在 x<90，所以往右让开）
    '.hth-echo .ec-brand{position:absolute;left:104px;top:34px;font:300 20px/1 ' + THIN + ';letter-spacing:.16em;color:var(--ink);transition:opacity .8s .6s}',
    // 大字入口
    '.hth-echo .ec-stk3d{position:absolute;left:96px;top:128px;width:48vw;bottom:156px;perspective:1100px;transition:opacity .5s,transform .6s cubic-bezier(.2,.8,.2,1)}',
    '.hth-echo .ec-stk{position:absolute;inset:0;transform-style:preserve-3d;transform-origin:0 50%}',
    '.hth-echo .ec-row{position:relative;display:flex;align-items:center;gap:22px;height:var(--rh);transform-style:preserve-3d;cursor:pointer;transition:opacity .9s var(--d,0s),transform 1.2s cubic-bezier(.2,.8,.2,1) var(--d,0s)}',
    '.hth-echo .ec-row .ec-idx{font:11px ' + MONO + ';color:var(--ink3);width:20px;align-self:flex-start;margin-top:calc(var(--rh)*.2)}',
    '.hth-echo .ec-wd{position:relative;transform-style:preserve-3d;font:900 var(--fs)/1 ' + HEAVY + ';letter-spacing:.02em}',
    '.hth-echo .ec-wd>span{display:block;white-space:nowrap}',
    // 感应范围只到字本身（左右各多留一点），不再是整行一直延伸到屏幕中间
    '.hth-echo .ec-row{pointer-events:none}',
    '.hth-echo .ec-row .ec-wd{pointer-events:auto}',
    '.hth-echo .ec-row .ec-wd::before{content:"";position:absolute;left:-10px;right:-14px;top:-4px;bottom:-4px}',
    '.hth-echo .ec-face{color:transparent;-webkit-text-stroke:1.5px rgba(223,227,220,.36);transition:color .35s,-webkit-text-stroke-color .35s}',
    '.hth-echo .ec-echo{position:absolute;left:0;top:0;color:transparent;-webkit-text-stroke:1.5px rgba(223,227,220,.7);opacity:0;pointer-events:none}',
    // [二改][流畅度] 30 层回声字平时都是透明的，只有正在显示的那一行才升成独立图层
    '.hth-echo .ec-row.vis .ec-echo{will-change:transform,opacity}',
    '.hth-echo .ec-wd input{font:inherit;letter-spacing:inherit;width:6.5em;background:transparent;border:0;outline:none;color:var(--ink);caret-color:var(--hot);padding:0;user-select:text}',
    '.hth-echo .ec-wd input::placeholder{color:transparent;-webkit-text-stroke:1.5px rgba(223,227,220,.3)}',
    '.hth-echo .ec-row.on .ec-face{color:var(--ink);-webkit-text-stroke-color:var(--ink)}',
    '.hth-echo .ec-stk.dim .ec-row:not(.on) .ec-face{-webkit-text-stroke-color:rgba(223,227,220,.2)}',
    '.hth-echo .ec-row.na .ec-face{-webkit-text-stroke-color:rgba(223,227,220,.18)}',
    '.hth-echo .ec-row .ec-meta{margin-left:calc(var(--fs)*1.9);font-size:12px;color:var(--ink2);letter-spacing:.06em;opacity:0;transform:translateX(-10px);transition:opacity .3s,transform .35s;white-space:nowrap;max-width:26vw;overflow:hidden;text-overflow:ellipsis}',
    '.hth-echo .ec-row.on .ec-meta{opacity:1;transform:none}',
    '.hth-echo .ec-row .ec-meta b{font:500 11px ' + MONO + ';color:var(--hot);margin-right:10px;letter-spacing:.1em}',
    '.hth-echo.pre .ec-row{opacity:0;transform:translateZ(-520px)}',
    '.hth-echo.dw-open .ec-stk3d{opacity:.22}',
    // 圆（点击 / 拖动区）
    '.hth-echo .ec-ring{position:absolute;border-radius:50%}',
    '.hth-echo .ec-pp{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;display:grid;place-items:center;color:var(--ink);opacity:.9;transition:opacity .2s,transform .2s}',
    '.hth-echo .ec-pp:hover{opacity:1;transform:scale(1.08)}',
    '.hth-echo .ec-pp svg{width:20px;height:20px}',
    '.hth-echo .ec-tip{position:absolute;font:11px ' + MONO + ';color:var(--ink);background:rgba(10,10,10,.62);padding:3px 7px;border-radius:3px;pointer-events:none;opacity:0;transition:opacity .15s;white-space:nowrap;transform:translate(-50%,-150%)}',
    '.hth-echo .ec-tip.on{opacity:1}',
    // 正在播放
    '.hth-echo .ec-np{position:absolute;display:flex;flex-direction:column;gap:8px;max-width:38vw;transition:opacity .8s .5s,transform .9s .5s}',
    '.hth-echo .ec-np-lb{font-size:11px;color:var(--ink3);letter-spacing:.14em;display:flex;align-items:center;gap:8px}',
    '.hth-echo .ec-np-lb i{width:6px;height:6px;border-radius:50%;background:var(--hot);box-shadow:0 0 10px var(--hot)}',
    '.hth-echo .ec-np-lb.paused i{background:var(--ink3);box-shadow:none}',
    '.hth-echo .ec-np-t{font:900 30px/1.15 ' + HEAVY + ';text-align:left;letter-spacing:.02em;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;transition:color .25s}',
    '.hth-echo .ec-np-t:hover{color:var(--hot)}',
    '.hth-echo .ec-np-sub{font-size:13px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.hth-echo .ec-np-ctl{display:flex;align-items:center;gap:16px;margin-top:4px;color:var(--ink2)}',
    '.hth-echo .ec-np-ctl .ec-time{font-size:12px;margin-right:4px;cursor:pointer}',
    '.hth-echo .ec-np-ctl button{transition:color .2s,transform .2s}',
    '.hth-echo .ec-np-ctl button:hover{color:var(--ink);transform:translateY(-1px)}',
    '.hth-echo .ec-np-ctl button.on{color:var(--hot)}',
    '.hth-echo .ec-np-ctl .ec-like.on svg{fill:var(--hot);stroke:var(--hot)}',
    '.hth-echo .ec-np-ctl .ec-sep{width:1px;height:14px;background:var(--ink4)}',
    // 没有在放的歌：邀请
    '.hth-echo .ec-inv{position:absolute;display:none;flex-direction:column;gap:12px;max-width:40vw}',
    '.hth-echo.empty .ec-inv{display:flex}',
    '.hth-echo.empty .ec-np{display:none}',
    '.hth-echo .ec-inv b{font:900 26px/1.2 ' + HEAVY + ';letter-spacing:.04em}',
    '.hth-echo .ec-inv p{margin:0;font-size:13px;color:var(--ink2);line-height:1.7}',
    '.hth-echo .ec-inv .ec-inv-b{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}',
    '.hth-echo .ec-inv button{font-size:13px;padding:7px 14px;border-radius:999px;border:1px solid var(--ink3);transition:border-color .2s,color .2s,background .2s}',
    '.hth-echo .ec-inv button:hover{border-color:var(--hot);color:#fff;background:rgba(255,74,28,.12)}',
    // 为你挑选
    '.hth-echo .ec-picks{position:absolute;right:48px;top:128px;width:min(330px,25vw);transition:opacity .8s .7s,transform .9s .7s}',
    '.hth-echo .ec-picks .ec-hd{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12px;color:var(--ink2);padding-bottom:10px;border-bottom:1px solid var(--ink4)}',
    '.hth-echo .ec-picks .ec-hd em{font:normal 11px ' + UI + ';color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.hth-echo .ec-picks ol{list-style:none;margin:0;padding:0}',
    '.hth-echo .ec-picks li{display:flex;align-items:baseline;gap:10px;padding:9px 0;font-size:14px;cursor:pointer;min-width:0}',
    '.hth-echo .ec-picks li::after{content:"";order:2;flex:1 1 12px;min-width:12px;border-bottom:1px dotted rgba(223,227,220,.2);transform:translateY(-3px)}',
    '.hth-echo .ec-picks li .t{max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .2s}',
    '.hth-echo .ec-picks li .a{order:1;font-size:11px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:30%}',
    '.hth-echo .ec-picks li .d{order:3;font:11px ' + MONO + ';color:var(--ink3)}',
    '.hth-echo .ec-picks li:hover .t{color:var(--hot)}',
    '.hth-echo .ec-picks .ec-none{font-size:12px;color:var(--ink3);padding:12px 0;line-height:1.7}',
    // 底部
    '.hth-echo .ec-foot-l{position:absolute;left:56px;bottom:34px;transition:opacity .8s .8s,transform .9s .8s}',
    '.hth-echo .ec-clock{font:300 44px/1 ' + THIN + ';letter-spacing:.04em}',
    '.hth-echo .ec-date{font-size:12px;color:var(--ink3);margin:8px 0 10px;letter-spacing:.12em}',
    '.hth-echo .ec-stats{font-size:12px;color:var(--ink2);letter-spacing:.04em}',
    '.hth-echo .ec-stats b{font:500 12px ' + MONO + ';color:var(--ink)}',
    '.hth-echo .ec-foot-r{position:absolute;right:48px;bottom:34px;max-width:36vw;text-align:right;font-size:13px;color:var(--ink2);letter-spacing:.1em;line-height:1.6;transition:opacity .8s .9s,transform .9s .9s,color .2s;cursor:pointer}',
    '.hth-echo .ec-foot-r:hover{color:var(--ink)}',
    '.hth-echo .ec-foot-r.ec-hide{opacity:0!important;pointer-events:none}',
    '.hth-echo .ec-picks.short li:nth-child(n+4){display:none}',
    '.hth-echo .ec-foot-r span{display:block;margin-top:6px;font-size:10px;color:var(--ink3);letter-spacing:.34em}',
    // [歌词位] 每日一句从右下角挪到地平线上：放歌时是当前这句歌词（从线下升起、线下有淡倒影），没歌词时是每日一句
    '.hth-echo .ec-foot-r{display:none!important}',
    '.hth-echo .ec-ly{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;pointer-events:none;transition:opacity .45s}',
    '.hth-echo .ec-ly-in{position:absolute;left:0;bottom:0;width:var(--lw,520px);display:flex;flex-direction:column;align-items:flex-start;gap:9px;pointer-events:auto;cursor:pointer;outline:none}',
    '.hth-echo .ec-ly-lb{font:11px/1 ' + MONO + ';letter-spacing:.16em;color:var(--ink3);display:flex;align-items:center;gap:8px;white-space:nowrap;max-width:var(--lw,520px);overflow:hidden;text-overflow:ellipsis;transition:color .3s}',
    '.hth-echo .ec-ly-lb i{flex:none;width:5px;height:5px;border-radius:50%;background:var(--hot);box-shadow:0 0 8px var(--hot);transition:background .3s,box-shadow .3s}',
    '.hth-echo .ec-ly-lb em{font-style:normal;font-family:' + UI + ';letter-spacing:.08em;color:var(--ink2)}',
    '.hth-echo .ec-ly.q .ec-ly-lb i,.hth-echo .ec-ly.pz .ec-ly-lb i{background:var(--ink3);box-shadow:none}',
    '.hth-echo .ec-ly-clip{position:relative;overflow:hidden;padding:4px 0 2px}',
    '.hth-echo .ec-ly-t{display:block;color:var(--ink);font:900 var(--lfs,28px)/1.2 ' + HEAVY + ';letter-spacing:.03em;white-space:normal;word-break:break-all;text-wrap:balance;max-width:var(--lw,520px);transition:transform .6s cubic-bezier(.2,.8,.2,1),opacity .45s,color .4s}',
    '.hth-echo .ec-ly-t.pre{transform:translateY(118%);opacity:0;transition:none}',
    '.hth-echo .ec-ly-t.out{position:absolute;left:0;bottom:2px;transform:translateY(118%);opacity:0;transition:transform .4s cubic-bezier(.55,0,.8,.35),opacity .35s}',
    '.hth-echo .ec-ly.q .ec-ly-t{font:300 var(--qfs,21px)/1.45 ' + THIN + ';letter-spacing:.1em;color:var(--ink2)}',
    '.hth-echo .ec-ly.pz .ec-ly-t{color:rgba(223,227,220,.56)}',
    '.hth-echo .ec-ly-in:hover .ec-ly-t,.hth-echo .ec-ly-in:focus-visible .ec-ly-t{color:#fff}',
    '.hth-echo .ec-ly.q .ec-ly-in:hover .ec-ly-t{color:var(--ink)}',
    '.hth-echo .ec-ly-in:hover .ec-ly-lb{color:var(--ink2)}',
    '.hth-echo .ec-ly-go{font:11px/1 ' + MONO + ';letter-spacing:.14em;color:var(--hot);opacity:0;transition:opacity .25s;margin-left:6px}',
    '.hth-echo .ec-ly-in:hover .ec-ly-go,.hth-echo .ec-ly-in:focus-visible .ec-ly-go{opacity:1}',
    '.hth-echo .ec-ly-rf{position:absolute;left:0;top:1px;width:var(--lw,520px);transform:scaleY(-1);opacity:.16;filter:blur(1.1px);pointer-events:none;-webkit-mask-image:linear-gradient(to top,#000 0%,rgba(0,0,0,.35) 45%,transparent 85%);mask-image:linear-gradient(to top,#000 0%,rgba(0,0,0,.35) 45%,transparent 85%)}',
    '.hth-echo .ec-ly.q .ec-ly-rf{opacity:.09}',
    '.hth-echo:has(.ec-stk.dim) .ec-ly{opacity:.14}',
    'body:has(#playlist-panel.show) .hth-echo .ec-ly{opacity:0;pointer-events:none}',
    '.hth-echo.pre .ec-ly{opacity:0}',
    '.hth-echo.pre .ec-np,.hth-echo.pre .ec-picks,.hth-echo.pre .ec-foot-l,.hth-echo.pre .ec-foot-r,.hth-echo.pre .ec-brand,.hth-echo.pre .ec-inv{opacity:0;transform:translateY(14px)}',
    // 右侧抽屉（入口展开的列表）
    '.hth-echo .ec-dw{position:absolute;top:0;right:0;bottom:0;width:min(440px,40vw);z-index:6;background:rgba(22,20,19,.985);border-left:1px solid var(--ink4);box-shadow:-30px 0 60px rgba(0,0,0,.35);transform:translateX(104%);transition:transform .55s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;padding:124px 34px 32px;box-sizing:border-box;visibility:hidden}',
    '.hth-echo .ec-dw.on{transform:none;visibility:visible}',
    '.hth-echo .ec-dw-idx{font:11px ' + MONO + ';color:var(--ink3);letter-spacing:.12em}',
    '.hth-echo .ec-dw h2{margin:10px 0 6px;font:900 44px/1 ' + HEAVY + ';letter-spacing:.02em}',
    '.hth-echo .ec-dw-meta{font-size:12px;color:var(--ink3);line-height:1.6}',
    '.hth-echo .ec-dw-x{position:absolute;top:124px;right:34px;font:11px ' + MONO + ';color:var(--ink3);padding:4px 8px;border:1px solid var(--ink4)!important;border-radius:4px}',
    '.hth-echo .ec-dw-x:hover{color:var(--ink)}',
    '.hth-echo .ec-dw ol{list-style:none;margin:22px 0 0;padding:0 8px 0 0;overflow:auto;flex:1;scrollbar-width:thin;scrollbar-color:rgba(223,227,220,.18) transparent}',
    '.hth-echo .ec-dw li{display:grid;grid-template-columns:28px 1fr auto;column-gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(223,227,220,.08);cursor:pointer}',
    '.hth-echo .ec-dw li.cv{grid-template-columns:40px 1fr auto}',
    '.hth-echo .ec-dw li .n{font:11px ' + MONO + ';color:var(--ink3)}',
    '.hth-echo .ec-dw li .c{width:40px;height:40px;border-radius:3px;background-size:cover;background-position:center}',
    '.hth-echo .ec-dw li .m{min-width:0;display:flex;flex-direction:column;gap:2px}',
    '.hth-echo .ec-dw li .t{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .2s}',
    '.hth-echo .ec-dw li .a{font-size:11px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.hth-echo .ec-dw li .d{font:11px ' + MONO + ';color:var(--ink3);display:flex;gap:10px;align-items:center}',
    '.hth-echo .ec-dw li .v{font:11px ' + UI + ';color:var(--ink3);padding:2px 7px;border:1px solid var(--ink4)!important;border-radius:999px;opacity:0;transition:opacity .2s,color .2s}',
    '.hth-echo .ec-dw li:hover .v{opacity:1}',
    '.hth-echo .ec-dw li .v:hover{color:var(--ink)}',
    '.hth-echo .ec-dw li:hover .t{color:var(--hot)}',
    '.hth-echo .ec-dw-foot{margin-top:16px;display:flex;gap:10px}',
    '.hth-echo .ec-dw-foot button,.hth-echo .ec-dw-empty button{font-size:12px;color:var(--ink2);padding:6px 12px;border-radius:999px;border:1px solid var(--ink4)!important;transition:color .2s,border-color .2s}',
    '.hth-echo .ec-dw-foot button:hover,.hth-echo .ec-dw-empty button:hover{color:var(--ink);border-color:var(--hot)!important}',
    '.hth-echo .ec-dw-empty{margin-top:26px;font-size:13px;color:var(--ink2);line-height:1.8;display:flex;flex-direction:column;gap:12px;align-items:flex-start}',
    '@media (max-height:760px){.hth-echo .ec-clock{font-size:34px}.hth-echo .ec-date{margin:6px 0 6px}}',
    '@media (prefers-reduced-motion:reduce){.hth-echo *{transition-duration:.01s!important}}',
  ].join('\n');

  var IC = {
    prev: '<svg class="ec-ic" viewBox="0 0 24 24"><path d="M6.5 6v12M18 6.5l-8.5 5.5 8.5 5.5z"/></svg>',
    next: '<svg class="ec-ic" viewBox="0 0 24 24"><path d="M17.5 6v12M6 6.5l8.5 5.5L6 17.5z"/></svg>',
    play: '<svg class="ec-ic" viewBox="0 0 24 24"><path d="M8 5.5l11 6.5-11 6.5z"/></svg>',
    pause: '<svg class="ec-ic" viewBox="0 0 24 24"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>',
    like: '<svg class="ec-ic" viewBox="0 0 24 24"><path d="M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6z"/></svg>',
    lyric: '<svg class="ec-ic" viewBox="0 0 24 24"><path d="M5 7h10M5 12h14M5 17h8"/></svg>',
    queue: '<svg class="ec-ic" viewBox="0 0 24 24"><path d="M4 6.5h11M4 11.5h11M4 16.5h7"/><path d="M17.5 13.5v6l3.5-3z"/></svg>',
    plus: '<svg class="ec-ic" viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>'
  };

  var ENT = [
    { k: 'daily', w: '推荐' }, { k: 'lib', w: '曲库' }, { k: 'find', w: '发现' },
    { k: 'radio', w: '电台' }, { k: 'recent', w: '最近' }, { k: 'search', w: '搜索' }
  ];
  var NE = 5;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function eOut3(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function eIO(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hashHue(t) { var h = 0; String(t || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return h % 360; }

  function create(root, ctx) {
    ctx.injectStyle('theme-echo', CSS);
    var A = ctx.actions;
    root.classList.add('pre');
    root.innerHTML =
      '<canvas class="ec-cv"></canvas><div class="ec-grain"></div>' +
      '<div class="ec-brand">Not Blind</div>' +
      '<div class="ec-stk3d"><div class="ec-stk"></div></div>' +
      '<div class="ec-picks"><div class="ec-hd"><span>为你挑选</span><em></em></div><ol></ol></div>' +
      '<div class="ec-ring"><button class="ec-pp" aria-label="播放 / 暂停"></button></div>' +
      '<div class="ec-tip ec-mono"></div>' +
      '<div class="ec-np">' +
      '<div class="ec-np-lb ec-mono"><i></i><span class="ec-np-st">正在播放</span> · <span class="ec-np-src"></span></div>' +
      '<button class="ec-np-t" title="进入沉浸模式"></button>' +
      '<div class="ec-np-sub"></div>' +
      '<div class="ec-np-ctl"><span class="ec-mono ec-time" title="点一下切换 已播 / 剩余"></span>' +
      '<button class="ec-prev" aria-label="上一首" title="上一首">' + IC.prev + '</button>' +
      '<button class="ec-play" aria-label="播放 / 暂停" title="播放 / 暂停"></button>' +
      '<button class="ec-next" aria-label="下一首" title="下一首">' + IC.next + '</button>' +
      '<button class="ec-like" aria-label="喜欢" title="喜欢">' + IC.like + '</button><i class="ec-sep"></i>' +
      '<button class="ec-lyr" aria-label="歌词" title="歌词">' + IC.lyric + '</button>' +
      '<button class="ec-q" aria-label="歌单 / 队列" title="歌单 / 队列">' + IC.queue + '</button></div></div>' +
      '<div class="ec-inv"><b>还没有正在放的歌</b><p>登录网易云或 QQ 音乐，推荐、曲库、电台就都会亮起来；也可以先导入电脑里的歌。</p>' +
      '<div class="ec-inv-b"><button class="ec-login">登录网易云 / QQ 音乐</button><button class="ec-import">导入本地音乐</button></div></div>' +
      '<div class="ec-foot-l"><div class="ec-clock"></div><div class="ec-date"></div><div class="ec-stats"></div></div>' +
      '<div class="ec-foot-r" title="换一句"><span class="ec-q-t"></span><span class="ec-q-s"></span></div>' +
      '<div class="ec-ly"><div class="ec-ly-in" role="button" tabindex="0"><div class="ec-ly-lb"><i></i><span></span><b class="ec-ly-go"></b></div><div class="ec-ly-clip"></div></div>' +
      '<div class="ec-ly-rf" aria-hidden="true"><div class="ec-ly-clip"></div></div></div>' +
      '<aside class="ec-dw" aria-hidden="true"><div class="ec-dw-idx"></div><h2></h2><div class="ec-dw-meta"></div>' +
      '<button class="ec-dw-x">关闭 Esc</button><ol></ol><div class="ec-dw-foot"></div></aside>' +
      '<div class="ec-vig"></div>';
    var $ = function (s) { return root.querySelector(s); };
    var cv = $('.ec-cv'), g = cv.getContext('2d', { alpha: false });
    var stk3d = $('.ec-stk3d'), stk = $('.ec-stk'), ring = $('.ec-ring'), tip = $('.ec-tip'), np = $('.ec-np'), inv = $('.ec-inv');
    var dw = $('.ec-dw');
    var M = null, W = 0, H = 0, dpr = 1;
    var raf = 0, running = false, lastDraw = 0, t0 = performance.now();
    var mx = .5, my = .5, smx = .5, smy = .5;
    var ripples = [], plucks = [], lastSide = 0, lastPy = 0, lastPluck = 0, idleRip = 0;
    var ringHover = null, seeking = null, showLeft = false;
    // [二改] 音量：小圆 = 音量环（和外圈进度一样可以拖、可以悬停看数值；在圆上滚轮也能调）
    var volHover = null, volSeek = null, volTipUntil = 0, volLocal = 0.65;
    function volGet() { try { if (typeof targetVolume === 'number' && isFinite(targetVolume)) return clamp(targetVolume, 0, 1); } catch (_e) { } return volLocal; }
    function volSet(v) {
      v = clamp(Math.round(v * 100) / 100, 0, 1); volLocal = v;
      try { if (typeof setVolume === 'function') setVolume(v, true); } catch (err) { console.warn('[echo] volume', err); }
    }
    function VR() { return CR() * .34; }
    function onVolBand(p) { return Math.abs(p.d - VR()) < 13; }
    var pos = { base: 0, at: 0, dur: 0, playing: false };
    var enterT = -9, dwKey = '';
    var listeners = [];
    function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); }
    // [二改][流畅度] 画布底图（底色 + 颗粒）只画一次，每帧直接贴上去，代替 清屏 + 一层全屏混合
    var grainTile = null, bgCache = null;
    function buildBgCache() {
      var c = bgCache || document.createElement('canvas');
      c.__ecBg = true;
      c.width = cv.width; c.height = cv.height;
      var x = c.getContext('2d', { alpha: false });
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.fillStyle = '#141211'; x.fillRect(0, 0, c.width, c.height);
      if (grainTile) {
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        x.globalCompositeOperation = 'overlay'; x.globalAlpha = .07;
        x.fillStyle = x.createPattern(grainTile, 'repeat');
        x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      }
      bgCache = c;
    }
    var timeEl = null;

    // ---------- [歌词位] 地平线上的一句：歌词 / 每日一句 ----------
    var LY = { el: null, inn: null, lb: null, go: null, clip: null, rclip: null, key: '', mode: '', timer: 0, x0: 0, lw: 520, fs: 28, qfs: 21 };
    var measCtx = document.createElement('canvas').getContext('2d');
    function lyricInfo() {
      // 提前 0.35 秒换上下一句（和这个主题换句动画的长短配好，开唱时新句已经显示出来）
      var o = { lead: 0.35 };
      try { if (ctx.lyric) return ctx.lyric(o); if (typeof homeThemeLyric === 'function') return homeThemeLyric(o); } catch (_e) { }
      return null;
    }
    function lyFit(text, quote) {
      // 先按一行量：放不下就缩字号（最多缩到 78%），再放不下就折成两行（CSS 均衡折行）
      var base = quote ? LY.qfs : LY.fs;
      measCtx.font = (quote ? '300 ' : '900 ') + base + 'px ' + (quote ? THIN : HEAVY);
      var w = measCtx.measureText(text).width * (quote ? 1.1 : 1.03);
      var fs = base;
      if (w > LY.lw) fs = Math.max(base * .78, base * LY.lw / w);
      LY.el.style.setProperty(quote ? '--qfs' : '--lfs', fs.toFixed(1) + 'px');
      return Math.min(LY.lw, w * fs / base);
    }
    function lySwap(text, instant) {
      [LY.clip, LY.rclip].forEach(function (clip) {
        [].forEach.call(clip.querySelectorAll('.ec-ly-t:not(.out)'), function (o) {
          if (instant) { o.remove(); return; }
          o.classList.add('out'); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 650);
        });
        var n = document.createElement('span'); n.className = 'ec-ly-t'; n.textContent = text;
        if (!instant) n.classList.add('pre');
        clip.appendChild(n);
        if (!instant) requestAnimationFrame(function () { requestAnimationFrame(function () { n.classList.remove('pre'); }); });
      });
    }
    function pollLyric() {
      if (!M || !LY.el) return;
      var L = lyricInfo(), isLy = !!(M.now && L && (L.state === 'line' || L.state === 'paused') && L.text);
      var q = M.quote && M.quote.text ? M.quote : null;
      var mode = isLy ? 'ly' : (q ? 'q' : 'none');
      LY.el.classList.toggle('pz', isLy && L.state === 'paused');
      var key = isLy ? 'L' + (L.key || L.text) : (q ? 'Q' + q.text : '');
      if (key === LY.key) return;
      var first = !LY.key;
      LY.key = key; LY.mode = mode;
      LY.el.classList.toggle('q', mode === 'q');
      LY.el.style.display = mode === 'none' ? 'none' : '';
      if (mode === 'none') return;
      var text = isLy ? L.text : q.text;
      LY.lb.innerHTML = isLy ? ('此刻' + (L.translation ? ' · <em>' + esc(L.translation) + '</em>' : '')) : ('每日一句' + (q.source ? ' · ' + esc(q.source) : ''));
      LY.go.textContent = isLy ? '→ 播放页' : '↻ 换一句';
      LY.inn.title = isLy ? '进入播放页' : '换一句';
      LY.inn.setAttribute('aria-label', (isLy ? '当前歌词：' : '每日一句：') + text);
      var tw = lyFit(text, !isLy);
      lySwap(text, first || ctx.reducedMotion);
      // 新的一句从线上升起时，在它脚下轻轻拨一下地平线
      if (isLy && !first && !ctx.reducedMotion) {
        plucks.push({ t: (performance.now() - t0) / 1000, u: uAt(LY.x0 + tw * .5), amp: 2.6, w: .12, decay: 2.3 });
        if (plucks.length > 8) plucks.shift();
        kick();
      }
    }
    function layoutLyric() {
      if (!LY.el) return;
      // 放在左边大字和圆之间的那段地平线上
      var fsEnt = parseFloat(stk.style.getPropertyValue('--fs')) || 80;
      var x0 = Math.max(W * .25, 96 + 42 + fsEnt * 2.1 + 64);
      var x1 = CX() - CR() - 56;
      LY.x0 = x0; LY.lw = Math.max(220, x1 - x0);
      LY.fs = clamp(H * .032, 22, 34); LY.qfs = clamp(H * .023, 16, 23);
      var xa = x0, xb = Math.min(x1, x0 + 420);
      var ya = lyBase(uAt(xa)), yb = lyBase(uAt(xb));
      var ang = Math.atan2(yb - ya, xb - xa);
      LY.el.style.left = xa + 'px'; LY.el.style.top = (ya - 1) + 'px';
      LY.el.style.transform = 'rotate(' + ang.toFixed(4) + 'rad)';
      LY.el.style.setProperty('--lw', LY.lw.toFixed(0) + 'px');
      if (LY.key) { LY.key = ''; LY.mode = ''; pollLyric(); }
    }
    LY.el = $('.ec-ly'); LY.inn = $('.ec-ly-in'); LY.lb = $('.ec-ly-lb span'); LY.go = $('.ec-ly-go');
    LY.clip = $('.ec-ly-in .ec-ly-clip'); LY.rclip = $('.ec-ly-rf .ec-ly-clip');

    // 颗粒（静态，一次生成）
    (function () {
      var c = document.createElement('canvas'); c.width = c.height = 180; var x = c.getContext('2d');
      var im = x.createImageData(180, 180);
      for (var i = 0; i < im.data.length; i += 4) { var v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0);
      grainTile = c;
    })();

    // ---------- 地平线几何：与开场完全一致 ----------
    function lx(u) { return W * (1.03 - 1.06 * u); }
    function lyBase(u) { var s = u * u * (3 - 2 * u); return H * (.55 + .07 * (s * .5 + u * .5)); }
    function uAt(x) { return (1.03 - x / W) / 1.06; }
    function CX() { return lx(.30); }
    function CY() { return lyBase(.30); }
    function CR() { return H * .15; }
    function lineOff(u, t) {
      var y = 0, ends = Math.sin(Math.PI * clamp(u, 0, 1));
      for (var i = 0; i < plucks.length; i++) {
        var p = plucks[i], dt = t - p.t; if (dt < 0 || dt > 2.4) continue;
        var env = Math.exp(-dt * p.decay), shape = Math.exp(-Math.pow((u - p.u) / p.w, 2));
        y += p.amp * env * ends * (shape * Math.sin(dt * 34) + .45 * Math.sin(u * 22 - dt * 16) * Math.exp(-Math.pow((u - p.u) / (p.w * 3), 2)));
      }
      return y;
    }

    // ---------- 入口大字 ----------
    var rows = ENT.map(function (e, i) {
      var row = document.createElement('div');
      row.className = 'ec-row'; row.style.setProperty('--d', (.05 + i * .07) + 's');
      row.setAttribute('role', 'button'); row.tabIndex = 0;
      var echoes = ''; for (var k = 0; k < NE; k++) echoes += '<span class="ec-echo" aria-hidden="true">' + e.w + '</span>';
      row.innerHTML = '<span class="ec-idx">' + String(i + 1).padStart(2, '0') + '</span><div class="ec-wd"><span class="ec-face">' + e.w + '</span>' + echoes + '</div><span class="ec-meta"><b>→</b><span></span></span>';
      stk.appendChild(row);
      var R = { el: row, e: e, on: 0, k: 0, vis: false, echoes: row.querySelectorAll('.ec-echo'), meta: row.querySelector('.ec-meta span'), typing: false };
      on(row, 'pointerenter', function () { R.on = 1; row.classList.add('on'); stk.classList.add('dim'); kick(); });
      on(row, 'pointerleave', function () { if (R.typing) return; R.on = 0; row.classList.remove('on'); if (!rows.some(function (x) { return x.on; })) stk.classList.remove('dim'); kick(); });
      on(row, 'click', function () { if (e.k === 'search') startSearch(R); else openDrawer(e.k); });
      on(row, 'keydown', function (ev) { if (ev.target === row && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); ev.stopPropagation(); row.click(); } });
      return R;
    });

    function startSearch(R) {
      if (R.typing) return; R.typing = true;
      var face = R.el.querySelector('.ec-face'); face.style.display = 'none';
      var inp = document.createElement('input'); inp.placeholder = '搜索'; inp.setAttribute('aria-label', '搜索歌名、歌手'); inp.spellcheck = false;
      R.el.querySelector('.ec-wd').insertBefore(inp, face);
      R.on = 1; R.el.classList.add('on'); stk.classList.add('dim');
      inp.focus();
      var composing = false;
      var done = function () {
        if (!R.typing) return; R.typing = false; inp.remove(); face.style.display = '';
        R.on = 0; R.el.classList.remove('on'); stk.classList.remove('dim'); kick();
      };
      inp.addEventListener('compositionstart', function () { composing = true; });
      inp.addEventListener('compositionend', function () { composing = false; });
      inp.addEventListener('keydown', function (ev) {
        ev.stopPropagation();
        if (composing || ev.isComposing) return;
        if (ev.key === 'Enter' && inp.value.trim()) { var q = inp.value.trim(); done(); A.search(q); }
        else if (ev.key === 'Escape') { if (inp.value) inp.value = ''; else done(); }
      });
      inp.addEventListener('keyup', function (ev) { ev.stopPropagation(); });
      inp.addEventListener('blur', function () { setTimeout(done, 150); });
      R.cancel = done;
    }

    // ---------- 抽屉：入口展开的列表 ----------
    function trackLi(t, i, act) {
      return '<li data-i="' + i + '" data-act="' + act + '"><span class="n">' + String(i + 1).padStart(2, '0') + '</span><span class="m"><span class="t">' + esc(t.title) + '</span><span class="a">' + esc(t.artist) + (t.providerLabel ? ' · ' + esc(t.providerLabel) : '') + '</span></span><span class="d">' + (t.duration ? fmt(t.duration) : '') + '</span></li>';
    }
    function coverStyle(it) {
      var h = hashHue(it.title);
      var fb = 'linear-gradient(135deg,hsl(' + h + ' 32% 30%),hsl(' + ((h + 40) % 360) + ' 36% 14%))';
      return 'background-image:' + (it.cover ? 'url("' + String(it.cover).replace(/"/g, '%22') + '"),' : '') + fb;
    }
    function plLi(it, i, act, view) {
      return '<li class="cv" data-i="' + i + '" data-act="' + act + '"><span class="c" style=\'' + coverStyle(it) + '\'></span><span class="m"><span class="t">' + esc(it.title) + '</span><span class="a">' + esc(it.sub || '') + (it.providerLabel ? ' · ' + esc(it.providerLabel) : '') + '</span></span><span class="d">' + (view ? '<button class="v" data-view="' + i + '">看曲目</button>' : '') + '</span></li>';
    }
    function drawerData(k) {
      var m = M || ctx.model();
      if (k === 'daily') {
        var songs = (m.daily.songs && m.daily.songs.length ? m.daily.songs : m.daily.preview) || [];
        return { t: '每日推荐', meta: (m.daily.label || '') + (m.daily.count ? ' · ' + m.daily.count + ' 首' : ''), html: songs.map(function (s, i) { return trackLi(s, i, 'daily'); }).join(''), empty: !songs.length, foot: songs.length ? [['播放全部', function () { A.playDaily(0); }]] : [] };
      }
      if (k === 'lib') {
        var li = m.library.items || [];
        return { t: '音乐库', meta: (m.library.label || '') + ' · ' + (m.library.playlistCount || 0) + ' 张歌单', html: li.map(function (it, i) { return plLi(it, i, 'lib', true); }).join(''), empty: !li.length, foot: [['在软件里打开音乐库', function () { A.openLibrary(); }]] };
      }
      if (k === 'find') {
        var fi = m.discover.items || [];
        return { t: '发现', meta: m.discover.sub || '', html: fi.map(function (it, i) { return plLi(it, i, 'find', true); }).join(''), empty: !fi.length, foot: m.discover.available ? [['打开发现页', function () { A.openDiscover(); }]] : [] };
      }
      if (k === 'radio') {
        var ri = m.radio.items || [];
        return { t: '电台', meta: m.radio.sub || '', html: ri.map(function (it, i) { return '<li data-i="' + i + '" data-act="radio"><span class="n">' + String(i + 1).padStart(2, '0') + '</span><span class="m"><span class="t">' + esc(it.title) + '</span><span class="a">' + esc(it.sub || '') + '</span></span><span class="d"></span></li>'; }).join(''), empty: !ri.length, foot: m.radio.available ? [['更多电台', function () { A.openRadio(); }]] : [] };
      }
      if (k === 'recent') {
        var re = m.recent || [];
        return { t: '最近聆听', meta: '最近播放 · ' + re.length + ' 首（所有平台）', html: re.map(function (s, i) { return trackLi(s, i, 'recent'); }).join(''), empty: !re.length, foot: [] };
      }
      return null;
    }
    function openDrawer(k) {
      var d = drawerData(k); if (!d) return;
      dwKey = k;
      dw.querySelector('.ec-dw-idx').textContent = String(ENT.findIndex(function (e) { return e.k === k; }) + 1).padStart(2, '0') + ' / 06';
      dw.querySelector('h2').textContent = d.t;
      dw.querySelector('.ec-dw-meta').textContent = d.meta;
      var ol = dw.querySelector('ol');
      ol.innerHTML = d.empty ? '' : d.html;
      ol.scrollTop = 0;
      var foot = dw.querySelector('.ec-dw-foot'); foot.innerHTML = '';
      var old = dw.querySelector('.ec-dw-empty'); if (old) old.remove();
      if (d.empty) {
        var em = document.createElement('div'); em.className = 'ec-dw-empty';
        em.innerHTML = (M && M.login && M.login.any) ? '<span>这里暂时还没有内容。</span>' : '<span>登录网易云或 QQ 音乐之后，这里会列出你的内容。</span><button>去登录</button>';
        var b = em.querySelector('button'); if (b) b.onclick = function () { A.openLogin(); };
        dw.insertBefore(em, foot);
      }
      d.foot.forEach(function (f) { var b = document.createElement('button'); b.textContent = f[0]; b.onclick = f[1]; foot.appendChild(b); });
      dw.classList.add('on'); dw.setAttribute('aria-hidden', 'false'); root.classList.add('dw-open');
    }
    function closeDrawer() { if (!dwKey) return false; dwKey = ''; dw.classList.remove('on'); dw.setAttribute('aria-hidden', 'true'); root.classList.remove('dw-open'); return true; }
    on(dw.querySelector('.ec-dw-x'), 'click', closeDrawer);
    on(dw.querySelector('ol'), 'click', function (ev) {
      var m = M || ctx.model();
      var v = ev.target.closest('[data-view]');
      var li = ev.target.closest('li'); if (!li) return;
      var i = +li.dataset.i, act = li.dataset.act;
      if (v) { var list = act === 'lib' ? m.library.items : m.discover.items; if (list && list[i]) A.openPlaylist(list[i]); return; }
      if (act === 'daily') A.playDaily(i);
      else if (act === 'recent') A.playRecent(i);
      else if (act === 'lib' && m.library.items[i]) A.playPlaylist(m.library.items[i]);
      else if (act === 'find' && m.discover.items[i]) A.playPlaylist(m.discover.items[i]);
      else if (act === 'radio' && m.radio.items[i]) A.playRadio(m.radio.items[i]);
    });
    on(root, 'keydown', function (ev) { if (ev.key === 'Escape' && dwKey) { ev.stopPropagation(); closeDrawer(); } });
    on(root, 'pointerdown', function (ev) {
      if (dwKey && !ev.target.closest('.ec-dw') && !ev.target.closest('.ec-row')) closeDrawer();
    });

    // ---------- 正在播放 ----------
    function curPos() {
      if (!pos.playing || seeking) return seeking ? seeking.f * pos.dur : pos.base;
      return Math.min(pos.dur || 1e9, pos.base + (performance.now() - pos.at) / 1000);
    }
    $('.ec-pp').onclick = function (ev) { ev.stopPropagation(); if (M && M.now) A.togglePlay(); else if (M && M.login && M.login.any) A.resume(); else A.openLogin(); };
    $('.ec-np-t').onclick = function () { A.openImmersive ? A.openImmersive() : A.resume(); };
    $('.ec-prev').onclick = function () { A.prev(); };
    $('.ec-play').onclick = function () { A.togglePlay(); };
    $('.ec-next').onclick = function () { A.next(); };
    $('.ec-like').onclick = function () { A.toggleLike(); };
    $('.ec-lyr').onclick = function () { A.toggleLyrics(); };
    $('.ec-q').onclick = function () {
      if (typeof openPlaylistPanelTab === 'function') { try { openPlaylistPanelTab('queue', true); return; } catch (_e) { } }
      ctx.toast('鼠标移到窗口最左边，就能拉出歌单 / 队列');
    };
    $('.ec-time').onclick = function () { showLeft = !showLeft; paintTime(); };
    $('.ec-login').onclick = function () { A.openLogin(); };
    $('.ec-import').onclick = function () { A.importLocal(); };
    $('.ec-foot-r').onclick = function () { A.nextQuote(); };

    function polar(x, y) {
      var r = root.getBoundingClientRect();
      var dx = x - r.left - CX(), dy = y - r.top - CY();
      var a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
      return { d: Math.hypot(dx, dy), a: a };
    }
    on(ring, 'pointerdown', function (ev) {
      if (ev.target.closest('.ec-pp')) return;
      var p = polar(ev.clientX, ev.clientY), R = CR();
      if (onVolBand(p)) {
        volSeek = { f: p.a / (Math.PI * 2) }; volSet(volSeek.f); ring.setPointerCapture(ev.pointerId); ev.preventDefault(); ev.stopPropagation(); kick();
        return;
      }
      if (M && M.now && pos.dur && Math.abs(p.d - R) < 20) {
        seeking = { f: p.a / (Math.PI * 2) }; ring.setPointerCapture(ev.pointerId); ev.preventDefault(); kick();
      } else if (p.d < R) {
        if (M && M.now) { A.openImmersive ? A.openImmersive() : A.resume(); } else A.openLogin();
      }
    });
    on(ring, 'pointermove', function (ev) {
      if (volSeek) {
        var a = polar(ev.clientX, ev.clientY).a / (Math.PI * 2);
        // 拖过 12 点不绕圈：从满音量那头拖过去停在 100%，从 0 那头拖过去停在 0
        if (volSeek.f > .8 && a < .2) a = 1; else if (volSeek.f < .2 && a > .8) a = 0;
        volSeek.f = a; volSet(a); kick(); return;
      }
      if (seeking) { seeking.f = polar(ev.clientX, ev.clientY).a / (Math.PI * 2); kick(); }
    });
    function endVolSeek() { if (!volSeek) return; volSeek = null; volTipUntil = performance.now() + 900; ptrDirty = true; kick(); setTimeout(kick, 950); }
    on(ring, 'pointerup', endVolSeek); on(ring, 'pointercancel', endVolSeek);
    on(ring, 'wheel', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var step = ev.deltaY < 0 ? .05 : -.05;
      volSet(volGet() + step);
      volTipUntil = performance.now() + 1100; ptrDirty = true; kick(); setTimeout(kick, 1150);
    }, { passive: false });
    function endSeek() {
      if (!seeking) return;
      var f = seeking.f; seeking = null;
      pos.base = f * pos.dur; pos.at = performance.now();
      A.seek(f); kick();
    }
    on(ring, 'pointerup', endSeek); on(ring, 'pointercancel', endSeek);

    on(root, 'pointermove', function (ev) {
      var r = root.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      mx = x / W; my = y / H;
      var t = (performance.now() - t0) / 1000;
      // 鼠标划过地平线：拨一下（和开场一样的手感）
      var u = uAt(x);
      if (u >= 0 && u <= 1) {
        var side = Math.sign(y - lyBase(u));
        if (lastSide && side && side !== lastSide && t - lastPluck > .08) {
          var v = Math.min(1, Math.abs(y - lastPy) / 26);
          plucks.push({ t: t, u: u, amp: 3 + 9 * v, w: .07, decay: 2.8 }); if (plucks.length > 8) plucks.shift();
          lastPluck = t;
        }
        lastSide = side; lastPy = y;
      } else lastSide = 0;
      var p = polar(ev.clientX, ev.clientY), R = CR();
      var nextHover = (M && M.now && pos.dur && Math.abs(p.d - R) < 20) ? p.a : null;
      if (nextHover !== ringHover) ptrDirty = true;
      ringHover = nextHover;
      var nextVol = onVolBand(p) ? p.a : null;
      if (nextVol !== volHover) ptrDirty = true;
      volHover = nextVol;
      ring.style.cursor = (ringHover != null || volHover != null) ? 'grab' : (p.d < R ? 'pointer' : '');
      kick();
    });
    on(root, 'pointerleave', function () { if (ringHover != null || volHover != null) { ringHover = null; volHover = null; ptrDirty = true; kick(); } });

    // ---------- 布局 ----------
    function layout() {
      W = root.clientWidth || window.innerWidth; H = root.clientHeight || window.innerHeight;
      // [二改][流畅度] 画布最多约 550 万像素：4K 屏（150% 缩放）上原来是 3840×2160 整屏重画，
      // 细线在 ~1.2 倍密度下肉眼看不出区别，每帧要填的像素少了三分之一以上
      dpr = Math.min(1.5, window.devicePixelRatio || 1, Math.sqrt(5.5e6 / Math.max(1, W * H)));
      var cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (cv.width !== cw || cv.height !== ch || !bgCache) {
        cv.width = cw; cv.height = ch;
        buildBgCache();
        lastDraw = 0;   // 画布重新分配后是纯黑的，下一帧立刻补画
      }
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      var R = CR(), cx = CX(), cy = CY();
      var sr = stk3d.getBoundingClientRect(), rr = root.getBoundingClientRect();
      var rh = sr.height / ENT.length, fs = Math.min(rh * .84, sr.width * .2);
      stk.style.setProperty('--rh', rh + 'px'); stk.style.setProperty('--fs', fs + 'px');
      stk3d.style.perspectiveOrigin = (cx - (sr.left - rr.left)) + 'px ' + (cy - (sr.top - rr.top)) + 'px';
      ring.style.left = (cx - R - 20) + 'px'; ring.style.top = (cy - R - 20) + 'px';
      ring.style.width = ring.style.height = (2 * R + 40) + 'px';
      var top = Math.min(cy + R + 30, H - 176);
      np.style.left = inv.style.left = (cx - R) + 'px';
      np.style.top = inv.style.top = top + 'px';
      np.style.maxWidth = inv.style.maxWidth = Math.max(260, W - (cx - R) - 48) + 'px';
      // 窗口矮的时候，每日一句会和播放控件挤在一起：让它先让位
      var fr = $('.ec-foot-r'); fr.classList.remove('ec-hide');
      requestAnimationFrame(function () {
        var a = (M && !M.now ? inv : np).getBoundingClientRect(), b = fr.getBoundingClientRect();
        var hit = a.bottom > b.top - 10 && a.right > b.left - 10 && a.left < b.right + 10;
        fr.classList.toggle('ec-hide', hit);
      });
      $('.ec-picks').classList.toggle('short', H < 800);
      layoutLyric();
      kick();
    }

    // ---------- 数据 ----------
    var cache = {};
    function setText(el, key, v) { if (cache[key] === v) return; cache[key] = v; el.textContent = v; }
    function paintTime() {
      if (!M || !M.now) return;
      var p = curPos();
      if (!timeEl) timeEl = $('.ec-time');
      setText(timeEl, 'time', showLeft ? '−' + fmt(Math.max(0, pos.dur - p)) + ' / ' + fmt(pos.dur) : fmt(p) + ' / ' + fmt(pos.dur));
    }
    function update(m) {
      if (!m) return;
      M = m;
      var n = m.now;
      root.classList.toggle('empty', !n);
      if (n) {
        var dur = n.duration || 0;
        pos.dur = dur; pos.playing = !!n.playing;
        if (!seeking) { pos.base = n.position || 0; pos.at = performance.now(); }
        setText($('.ec-np-t'), 'title', n.title);
        setText($('.ec-np-sub'), 'sub', n.artist + (n.album ? ' — ' + n.album : ''));
        setText($('.ec-np-src'), 'src', n.providerLabel || '');
        setText($('.ec-np-st'), 'st', n.playing ? '正在播放' : '已暂停');
        $('.ec-np-lb').classList.toggle('paused', !n.playing);
        var ic = n.playing ? 'pause' : 'play';
        if (cache.ic !== ic) { cache.ic = ic; $('.ec-play').innerHTML = IC[ic]; $('.ec-pp').innerHTML = IC[ic]; }
        $('.ec-like').classList.toggle('on', !!n.liked);
        $('.ec-lyr').classList.toggle('on', !!m.lyricsOn);
        paintTime();
      } else if (cache.ic !== 'plus') { cache.ic = 'plus'; $('.ec-pp').innerHTML = IC.plus; pos.dur = 0; pos.playing = false; }
      // 入口说明 + 不可用时变淡
      var metas = {
        daily: m.daily.count ? (m.daily.label + ' · ' + m.daily.count + ' 首') : (m.daily.label || '登录后生成'),
        lib: (m.library.label || '本地音乐') + ' · ' + (m.library.playlistCount || 0) + ' 张歌单',
        find: m.discover.sub || '', radio: m.radio.sub || '',
        recent: m.recent && m.recent.length ? '最近播放 · ' + m.recent.length + ' 首' : '还没有听歌记录',
        search: '点一下直接打字 · 回车搜'
      };
      rows.forEach(function (R) {
        setText(R.meta, 'meta-' + R.e.k, metas[R.e.k] || '');
        var na = (R.e.k === 'find' && !m.discover.available) || (R.e.k === 'radio' && !m.radio.available) || (R.e.k === 'daily' && !m.daily.count);
        R.el.classList.toggle('na', !!na);
      });
      // 为你挑选
      var pk = m.picks.items || [];
      setText($('.ec-picks em'), 'pksrc', m.picks.label || '');
      var sig = pk.map(function (t) { return t.key; }).join('|');
      if (cache.pk !== sig) {
        cache.pk = sig;
        $('.ec-picks ol').innerHTML = pk.length ? pk.map(function (t, i) {
          return '<li data-i="' + i + '" title="' + esc(t.title + ' — ' + t.artist) + '"><span class="t">' + esc(t.title) + '</span><span class="a">' + esc(t.artist) + '</span><span class="d">' + (t.duration ? fmt(t.duration) : '') + '</span></li>';
        }).join('') : '<li class="ec-none">' + (m.login && m.login.any ? '今天的推荐还在路上。' : '登录后，这里每天会挑几首给你。') + '</li>';
      }
      // 底部
      setText($('.ec-clock'), 'clock', m.clock.time);
      setText($('.ec-date'), 'date', m.clock.month + '月' + m.clock.day + '日 ' + m.clock.weekday);
      var td = m.today || {};
      var st = td.minutes || td.count
        ? '今日聆听 <b>' + (td.minutes || 0) + '</b> 分钟 · <b>' + (td.count || 0) + '</b> 首' + (td.topArtist ? ' · 最常听 ' + esc(td.topArtist) : '') + (td.streak ? ' · 连续 <b>' + td.streak + '</b> 天' : '')
        : '今天还没开始听';
      if (cache.stats !== st) { cache.stats = st; $('.ec-stats').innerHTML = st; }
      var q = m.quote && m.quote.text ? m.quote : { text: '耳朵先到的地方，眼睛随后就到。', source: '' };
      setText($('.ec-q-t'), 'qt', q.text);
      setText($('.ec-q-s'), 'qs', q.source || '每日一句');
      pollLyric();
      // 抽屉开着时，数据变了也跟着刷新（只在列表内容变化时）
      if (dwKey) {
        var d = drawerData(dwKey), ol = dw.querySelector('ol');
        if (d && cache.dw !== dwKey + d.html) { cache.dw = dwKey + d.html; var s = ol.scrollTop; ol.innerHTML = d.empty ? '' : d.html; ol.scrollTop = s; }
      }
      if (cache.lay !== (n ? 1 : 0) + '|' + W + 'x' + H) { cache.lay = (n ? 1 : 0) + '|' + W + 'x' + H; layout(); }
      kick();
    }
    on($('.ec-picks ol'), 'click', function (ev) { var li = ev.target.closest('li[data-i]'); if (li) A.playPick(+li.dataset.i); });
    // [歌词位] 点歌词 = 进播放页；点每日一句 = 换一句
    function lyAct() { if (LY.mode === 'ly') { if (A.openImmersive) A.openImmersive(); } else if (LY.mode === 'q' && A.nextQuote) A.nextQuote(); }
    on(LY.inn, 'click', lyAct);
    on(LY.inn, 'keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); lyAct(); } });

    // ---------- 节拍：主页盖住 3D 场景时主循环不分析音频，这里自己看一眼低音 ----------
    var an = { buf: null, avg: 0, last: 0, n: 0, lastCheck: 0 };
    function beatCheck(t) {
      if (!pos.playing || ctx.reducedMotion) return;
      var a = null; try { a = typeof analyser !== 'undefined' ? analyser : null; } catch (_e) { a = null; }
      if (a && a.frequencyBinCount) {
        if (!an.buf || an.buf.length !== a.frequencyBinCount) an.buf = new Uint8Array(a.frequencyBinCount);
        try { a.getByteFrequencyData(an.buf); } catch (_e) { return; }
        var s = 0; for (var i = 1; i < 7; i++) s += an.buf[i]; s /= 6 * 255;
        an.avg = an.avg ? an.avg * .94 + s * .06 : s;
        if (s > an.avg * 1.22 + .035 && t - an.last > .3) { an.last = t; onBeat(); }
      } else if (t - an.last > 60 / 96) { an.last = t; onBeat(); }   // 拿不到音频数据时按 96 BPM 轻轻荡
    }
    function onBeat() {
      an.n++;
      var R = CR(), bar = an.n % 4 === 0, t = (performance.now() - t0) / 1000;
      ripples.push(bar ? { t0: t, r1: R * 2.1, a: .24, lw: 1.3, dur: 1.9 } : { t0: t, r1: R * 1.45, a: .09, lw: 1, dur: 1.2 });
      if (ripples.length > 12) ripples.shift();
      if (bar) { plucks.push({ t: t, u: .3, amp: 2, w: .1, decay: 2.2 }); if (plucks.length > 8) plucks.shift(); }
    }

    // ---------- 画 ----------
    function draw(t) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (bgCache) g.drawImage(bgCache, 0, 0); else { g.fillStyle = '#141211'; g.fillRect(0, 0, cv.width, cv.height); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 线
      g.beginPath();
      for (var u = 0; u <= 1.0001; u += .004) { var x = lx(u), y = lyBase(u) + lineOff(u, t); if (u === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.strokeStyle = 'rgba(223,227,220,.5)'; g.lineWidth = 1.6; g.lineCap = 'round'; g.stroke();
      var R = CR(), cx = CX(), cy = CY();
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.strokeStyle = 'rgba(223,227,220,.34)'; g.lineWidth = 2; g.stroke();
      var arcK = eIO((t - enterT - .2) / 1.1);
      if (M && M.now && pos.dur) {
        var p = clamp(curPos() / pos.dur, 0, 1) * arcK, a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * p;
        g.beginPath(); g.arc(cx, cy, R, a0, a1); g.strokeStyle = HOT; g.lineWidth = 3; g.lineCap = 'round'; g.stroke();
        g.save(); g.shadowColor = HOT; g.shadowBlur = 14;
        g.beginPath(); g.arc(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, 4.5, 0, 7); g.fillStyle = '#ff5a2e'; g.fill(); g.restore();
        var n = Math.floor(pos.dur / 30);
        g.strokeStyle = 'rgba(223,227,220,.36)'; g.lineWidth = 1.2;
        g.beginPath();   // 刻度合成一条路径画（长播客几百个刻度时原来是几百次 stroke）
        for (var i = 0; i <= n; i++) { var a = a0 + Math.PI * 2 * (i * 30 / pos.dur); g.moveTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6)); g.lineTo(cx + Math.cos(a) * (R + 12), cy + Math.sin(a) * (R + 12)); }
        g.stroke();
      }
      g.beginPath(); g.arc(cx, cy, R * .34, 0, Math.PI * 2); g.strokeStyle = 'rgba(223,227,220,.4)'; g.lineWidth = 1.25; g.stroke();
      // [二改] 音量环：和外圈进度同样的画法（弧 + 发光端点 + 刻度），颜色换成黄铜色
      var vr = R * .34, vv = (volSeek ? volSeek.f : volGet()) * arcK, v0 = -Math.PI / 2, v1 = v0 + Math.PI * 2 * vv;
      if (vv > .004) {
        g.beginPath(); g.arc(cx, cy, vr, v0, v1); g.strokeStyle = VOLC; g.lineWidth = 2.4; g.lineCap = 'round'; g.stroke();
      }
      g.save(); g.shadowColor = VOLC; g.shadowBlur = 10;
      g.beginPath(); g.arc(cx + Math.cos(v1) * vr, cy + Math.sin(v1) * vr, 3.4, 0, 7); g.fillStyle = VOLC; g.fill(); g.restore();
      g.strokeStyle = 'rgba(223,227,220,.3)'; g.lineWidth = 1;
      g.beginPath();   // 每 10% 一格
      for (var vi = 0; vi < 10; vi++) { var va = v0 + Math.PI * 2 * vi / 10; g.moveTo(cx + Math.cos(va) * (vr + 4), cy + Math.sin(va) * (vr + 4)); g.lineTo(cx + Math.cos(va) * (vr + (vi % 5 ? 7 : 9)), cy + Math.sin(va) * (vr + (vi % 5 ? 7 : 9))); }
      g.stroke();
      for (var j = ripples.length - 1; j >= 0; j--) {
        var r = ripples[j], k = (t - r.t0) / r.dur; if (k >= 1) { ripples.splice(j, 1); continue; } if (k < 0) continue;
        g.beginPath(); g.arc(cx, cy, R + (r.r1 - R) * eOut3(k), 0, Math.PI * 2); g.strokeStyle = 'rgba(223,227,220,' + (r.a * (1 - k)).toFixed(3) + ')'; g.lineWidth = r.lw; g.stroke();
      }
      var volTip = volSeek || volHover != null || performance.now() < volTipUntil;
      if (volTip && !seeking) {
        var vang = volSeek ? v1 : (volHover != null ? volHover - Math.PI / 2 : v1);
        var vgx = cx + Math.cos(vang) * vr, vgy = cy + Math.sin(vang) * vr;
        if (volHover != null && !volSeek) { g.beginPath(); g.arc(vgx, vgy, 6, 0, 7); g.strokeStyle = 'rgba(227,194,122,.9)'; g.lineWidth = 1.4; g.stroke(); }
        var vshow = volHover != null && !volSeek ? (volHover / (Math.PI * 2)) : (volSeek ? volSeek.f : volGet());
        tip.style.left = vgx + 'px'; tip.style.top = vgy + 'px';
        tip.textContent = (volHover != null && !volSeek ? '→ 音量 ' : '音量 ') + Math.round(clamp(vshow, 0, 1) * 100) + '%';
        tip.classList.add('on');
      } else if (ringHover != null || seeking) {
        var ang = (seeking ? seeking.f * Math.PI * 2 : ringHover) - Math.PI / 2;
        var gx = cx + Math.cos(ang) * R, gy = cy + Math.sin(ang) * R;
        g.beginPath(); g.arc(gx, gy, 7, 0, 7); g.strokeStyle = 'rgba(223,227,220,.9)'; g.lineWidth = 1.5; g.stroke();
        tip.style.left = gx + 'px'; tip.style.top = gy + 'px';
        tip.textContent = '→ ' + fmt((ang + Math.PI / 2) / (Math.PI * 2) * pos.dur);
        tip.classList.add('on');
      } else tip.classList.remove('on');
    }
    function frameRows(dt) {
      smx += (mx - smx) * Math.min(1, dt * 3.2); smy += (my - smy) * Math.min(1, dt * 3.2);
      var tf = 'rotateY(' + (9 + (smx - .5) * 7).toFixed(2) + 'deg) rotateX(' + ((.5 - smy) * 5).toFixed(2) + 'deg)';
      if (tf !== lastStkTf) { lastStkTf = tf; stk.style.transform = tf; }
      var busy = Math.abs(mx - smx) > .002 || Math.abs(my - smy) > .002;
      var gap = 64;   // 回声间距固定，不跟节拍跳
      rows.forEach(function (R) {
        R.k += (R.on - R.k) * Math.min(1, dt * (R.on ? 6 : 4.5));
        if (Math.abs(R.on - R.k) > .003) busy = true;
        if (R.k < .003 && !R.on) { if (R.vis) { for (var i = 0; i < R.echoes.length; i++) R.echoes[i].style.opacity = 0; R.vis = false; R.el.classList.remove('vis'); } return; }
        if (!R.vis) R.el.classList.add('vis');
        R.vis = true;
        for (var e = 0; e < R.echoes.length; e++) {
          var f = clamp(R.k * 1.5 - e * .09, 0, 1);
          R.echoes[e].style.transform = 'translateZ(' + (-(e + 1) * gap * f).toFixed(1) + 'px)';
          R.echoes[e].style.opacity = (f * Math.pow(1 - e / (NE + 1), 1.1) * .85).toFixed(3);
        }
      });
      return busy;
    }
    var lastT = 0, lastStkTf = '', rowsBusy = true, idleTimer = 0, ptrDirty = false;
    // [二改][流畅度] 按"画面有没有在动"决定画多快，原来是只要在放歌就按显示器刷新率（144Hz 屏就是 144 次/秒）
    // 整屏重画，什么都不动时也每秒重画 30 次：
    //   拖圆环 / 悬停圆环：跟手，每帧都画
    //   波纹、拨弦、入场、大字回声在动：最多 60 帧
    //   只剩进度弧在走（放歌但这一刻没有波纹）：约 12 帧，进度弧每秒只挪几个像素
    //   什么都不动（暂停且没有动画）：停下不画，7 秒后自己醒来荡一圈待机波纹
    function loop(now) {
      raf = 0;
      if (!running) return;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; }
      var t = (now - t0) / 1000;
      // 跟手只在"拖动中"或"鼠标刚在圆环上动过"时；鼠标停在圆环上不动就不再每帧重画
      var follow = !!seeking || !!volSeek || ptrDirty;
      var active = moving(t);
      var gap = follow ? 0 : (active ? 15 : (pos.playing ? 80 : -1));
      if (gap < 0) {
        // 完全静止：不再排下一帧；待机波纹用定时器唤醒
        var wait = Math.max(200, 7000 - (now - idleRip));
        if (M) idleTimer = setTimeout(function () { idleTimer = 0; kick(); }, wait);
        drawFrame(now, t);   // 被数据更新叫醒时（换歌、暂停）补画一帧，然后停下
        // 这一帧本身可能刚开了新动画（待机波纹、大字回声开始收回），那就接着画
        if (moving(t)) { if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; } raf = requestAnimationFrame(loop); }
        return;
      }
      if (gap && now - lastDraw < gap) { raf = requestAnimationFrame(loop); return; }
      drawFrame(now, t);
      raf = requestAnimationFrame(loop);
    }
    function moving(t) {
      return ripples.length > 0 || plucks.some(function (p) { return t - p.t < 2.4; }) || t - enterT < 2 || rowsBusy;
    }
    function drawFrame(now, t) {
      ptrDirty = false;
      var dt = Math.min(.05, (now - (lastT || now)) / 1000);
      lastT = now; lastDraw = now;
      beatCheck(t);
      if (!pos.playing && M && now - idleRip > 7000) { idleRip = now; var R = CR(); ripples.push({ t0: t, r1: R * 2.3, a: .26, lw: 1.2, dur: 1.8 }, { t0: t + .25, r1: R * 2.3, a: .18, lw: 1.2, dur: 1.8 }); }
      draw(t);
      rowsBusy = frameRows(dt);
      if (M && M.now && pos.playing) paintTime();
    }
    function kick() { if (running && !raf) raf = requestAnimationFrame(loop); }
    function releaseCanvas() {
      cv.width = cv.height = 0;
      if (bgCache) { bgCache.width = bgCache.height = 0; bgCache = null; }
    }
    function start() {
      if (running) return; running = true; lastT = 0; rowsBusy = true; kick();
      if (!LY.timer) LY.timer = setInterval(pollLyric, 100);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; } if (LY.timer) { clearInterval(LY.timer); LY.timer = 0; } }

    layout();
    enterT = (performance.now() - t0) / 1000;
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('pre'); }); });
    start();

    return {
      update: update,
      resize: function () { layout(); },
      // [二改][内存] 离开主页（去播放页）时把整屏画布和底图还掉，回来时 layout() 会按尺寸重新分配
      pause: function () { stop(); releaseCanvas(); },
      resume: function () { layout(); start(); },
      back: function () {
        var typing = rows.filter(function (R) { return R.typing; })[0];
        if (typing && typing.cancel) { typing.cancel(); return true; }
        return closeDrawer();
      },
      destroy: function () {
        stop();
        releaseCanvas();
        listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
        listeners = [];
        root.innerHTML = '';
        root.classList.remove('pre', 'empty', 'dw-open');
      }
    };
  }

  registerHomeTheme({
    id: ID,
    name: '回声',
    cordColor: 'rgba(223,227,220,.72)',
    cordGlow: 'rgba(255,74,28,.32)',
    create: create
  });
})();
