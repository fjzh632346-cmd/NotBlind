// ============================================================
// Panel skin · 回声（左侧歌单栏）
// 哑光深底 + 灰绿字 + 细线分隔，强调色朱红；和回声主页的地平线圆一个语言：
// - 头部：「歌单 / 队列」+ 数量，分页是细下划线文字标签（带数量）
// - 队列：已播放 N 首（默认收起）/ 正在播放卡片（封面、朱红小字、细进度线、还剩 m:ss）/ 接下来 · N 首（编号细线列表）
// - 歌单 / 播客：分组标题 = 小字 + 细线 + 数量；行式列表；展开详情同一套
// 只加 CSS 和装饰节点（data-skin-deco），原来的点击、长按拖动排序、各按钮都不动
// ============================================================
(function () {
  'use strict';
  var ID = 'echo';
  var STEP = 44;      // 队列每行高度（虚拟列表步长）
  var NOW_H = 98;     // 正在播放卡片高度
  var UP_H = 40;      // 「接下来 · N 首」标题高度
  var EXTRA = NOW_H + UP_H - STEP; // 正在播放这一块比普通行多出来的高度（没画出来时补到占位里）
  var HIST_KEY = 'notblind-echo-panel-hist-open';

  var HEAVY = '"Source Han Sans SC Heavy","思源黑体 Heavy","Noto Sans SC Black","Microsoft YaHei UI","Microsoft YaHei","Noto Sans CJK SC","PingFang SC",sans-serif';
  var UI = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  var MONO = '"Cascadia Mono",Consolas,"Microsoft YaHei UI","Noto Sans Mono","DejaVu Sans Mono",monospace';

  var histOpen = false;
  try { histOpen = localStorage.getItem(HIST_KEY) === '1'; } catch (_e) { }

  function svgUrl(svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'; }
  var IC_NEXT = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5v7a3.5 3.5 0 0 0 3.5 3.5H19"/><path d="M15 11l4 4-4 4"/></svg>');
  var IC_ADD = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h11M4 11.5h11M4 16.5h7"/><path d="M18 14v6M15 17h6"/></svg>');

  var B = 'body[data-panel-skin="echo"]';
  var P = B + ' #playlist-panel';
  var CSS = [
    // ---------- 面板本体：哑光深底、细线框、直角 ----------
    P + '{--ecp-bg:#141211;--ecp-ink:#dfe3dc;--ecp-ink2:rgba(223,227,220,.66);--ecp-ink3:rgba(223,227,220,.44);--ecp-ink4:rgba(223,227,220,.16);--ecp-line:rgba(223,227,220,.07);--ecp-hot:#ff4a1c;--fc-accent-rgb:255,74,28;' +
      'width:clamp(340px,24vw,420px)!important;padding:22px 22px 16px!important;border-radius:3px!important;background:#141211!important;border:1px solid var(--ecp-ink4)!important;' +
      'box-shadow:30px 0 70px rgba(0,0,0,.42),0 0 0 1px rgba(0,0,0,.35)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;color:var(--ecp-ink);font-family:' + UI + ';-webkit-font-smoothing:antialiased;scrollbar-width:thin;scrollbar-color:var(--ecp-ink4) transparent!important}',
    P + '.pinned{border-color:var(--ecp-ink4)!important;box-shadow:30px 0 70px rgba(0,0,0,.42),0 0 0 1px rgba(0,0,0,.35)!important}',
    P + '::-webkit-scrollbar{width:3px}',
    P + '::-webkit-scrollbar-thumb{background:var(--ecp-ink4)!important;border-radius:0}',
    B + '[data-hth-page="stage"] #playlist-panel{background:rgba(18,16,15,.93)!important;box-shadow:24px 0 80px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.4)!important}',
    P + ' button{font-family:inherit}',
    P + ' button:focus-visible{outline:1.5px solid var(--ecp-hot)!important;outline-offset:2px}',
    P + ' .ecp-mono{font-family:' + MONO + ';letter-spacing:.04em;font-variant-numeric:tabular-nums}',

    // ---------- 头部 ----------
    P + ' .playlist-panel-sticky{top:-22px!important;margin:-22px -22px 0!important;padding:22px 22px 0!important;border-radius:0!important;background:var(--ecp-bg)!important;border:0!important;box-shadow:0 14px 18px -14px rgba(0,0,0,.55)!important}',
    B + '[data-hth-page="stage"] #playlist-panel .playlist-panel-sticky{background:rgb(18,16,15)!important}',
    P + ' .playlist-panel-sticky::after{display:none!important}',
    P + ' .queue-head{align-items:center!important;margin:0!important}',
    P + ' .playlist-panel-sticky .fx-title{display:flex;align-items:center;gap:10px;font:900 21px/1.1 ' + HEAVY + '!important;letter-spacing:.04em;color:var(--ecp-ink)!important;text-shadow:none!important}',
    P + ' .ecp-tc{font:500 10px/1 ' + MONO + ';letter-spacing:.04em;color:var(--ecp-ink3);border:1px solid var(--ecp-ink4);border-radius:3px;padding:2px 5px;font-variant-numeric:tabular-nums}',
    P + ' .playlist-panel-sticky .fx-sub{display:none!important}',
    P + ' .queue-head-act{gap:6px!important}',
    P + ' .fx-mini-btn,' + P + ' .fx-mini-btn.ghost{height:26px!important;min-width:0!important;padding:0 11px!important;border-radius:999px!important;border:1px solid var(--ecp-ink4)!important;background:transparent!important;box-shadow:none!important;color:var(--ecp-ink2)!important;font:12px/1 ' + UI + '!important;letter-spacing:.04em;transition:color .2s,border-color .2s!important}',
    P + ' .fx-mini-btn:hover,' + P + ' .fx-mini-btn.ghost:hover{color:var(--ecp-ink)!important;border-color:var(--ecp-ink3)!important;background:transparent!important;transform:none!important}',
    P + ' .playlist-pin-btn,' + P + ' .playlist-pin-btn.active{width:30px!important;height:30px!important;padding:0!important;border:0!important;border-radius:50%!important;color:var(--ecp-ink3)!important;background:transparent!important;display:grid;place-items:center}',
    P + ' .playlist-pin-btn:hover{color:var(--ecp-ink)!important;background:var(--ecp-line)!important}',
    P + ' .playlist-pin-btn.active{color:var(--ecp-hot)!important}',
    P + ' .playlist-pin-btn svg{width:16px;height:16px}',
    P + ' .panel-tabs{gap:22px!important;margin:18px 0 0!important;border-bottom:1px solid var(--ecp-ink4);padding:0!important}',
    P + ' .panel-tab,' + P + ' .panel-tab.active{position:relative;height:auto!important;padding:0 0 10px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:var(--ecp-ink3)!important;font:13px/1.2 ' + UI + '!important;letter-spacing:.06em;transition:color .2s!important}',
    P + ' .panel-tab:hover{color:var(--ecp-ink2)!important;background:transparent!important}',
    P + ' .panel-tab.active{color:var(--ecp-ink)!important}',
    P + ' .panel-tab.active::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--ecp-hot)}',
    P + ' .panel-tab .ecp-n{font:normal 10px/1 ' + MONO + ';margin-left:5px;color:var(--ecp-ink3);font-variant-numeric:tabular-nums}',

    // ---------- 工具条（不再吸顶，一行细字） ----------
    P + ' .queue-toolbar{position:relative!important;top:auto!important;z-index:2;margin:14px 0 4px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;gap:10px!important}',
    P + ' .queue-chip{height:24px!important;padding:0 10px!important;border-radius:999px!important;border:1px solid var(--ecp-ink4)!important;background:transparent!important;color:var(--ecp-ink2)!important;font-size:11px!important;letter-spacing:.04em;white-space:nowrap;box-shadow:none!important}',
    P + ' #pl-pane .queue-chip,' + P + ' #podcast-pane .queue-chip{border-color:transparent!important;padding:0!important;color:var(--ecp-ink3)!important;overflow:hidden;text-overflow:ellipsis;min-width:0}',
    P + ' .queue-toolbar .fx-mini-btn{height:24px!important;font-size:11px!important;padding:0 11px!important;white-space:nowrap;flex:0 0 auto!important;width:auto!important}',
    P + ' .queue-toolbar>div[style]{gap:4px!important;flex:0 0 auto}',
    P + ' .queue-toolbar>.fx-mini-btn{flex:0 0 auto!important;width:auto!important}',
    P + ' .queue-toolbar>.queue-chip{flex:0 1 auto}',

    // ---------- 队列 ----------
    P + ' .queue-list{gap:0!important;margin-top:0!important}',
    P + ' #queue-list{margin-top:calc(-1 * var(--ecp-hist,0px))!important}',
    P + ' #queue-list.ecp-collapsed{pointer-events:none}',
    P + ' #queue-list.ecp-collapsed>*{pointer-events:auto}',
    P + ' #queue-list.ecp-collapsed>.queue-item.ecp-old{visibility:hidden!important;pointer-events:none!important}',
    P + ' .ecp-hist{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:center;width:100%;height:32px;padding:0!important;border:0;background:none;color:var(--ecp-ink3);font-size:11px;letter-spacing:.08em;cursor:pointer;transition:color .2s}',
    P + ' .ecp-hist:hover{color:var(--ecp-ink2)}',
    P + ' .ecp-hist span{letter-spacing:.04em}',
    // 普通行：编号 · 歌名 · 歌手 …… 时长
    P + ' .queue-item{position:relative;display:flex!important;align-items:center!important;gap:10px!important;box-sizing:border-box;height:' + STEP + 'px;margin:0!important;padding:0 2px 0 4px!important;border:0!important;border-bottom:1px solid var(--ecp-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;transition:background .2s,opacity .2s!important}',
    P + ' .queue-item:hover{background:rgba(223,227,220,.035)!important}',
    P + ' .queue-item:not(.now)>img,' + P + ' .queue-item:not(.now)>div:not([class]){display:none!important}',
    P + ' .queue-item .ecp-num{flex:0 0 22px;font:10px/1 ' + MONO + ';color:var(--ecp-ink3);letter-spacing:.02em;font-variant-numeric:tabular-nums}',
    P + ' .queue-item .qi-info{display:flex;align-items:baseline;gap:9px;min-width:0;flex:1 1 auto}',
    P + ' .queue-item .qi-name{flex:0 1 auto;min-width:0;font-size:14px!important;line-height:1.3;color:var(--ecp-ink)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .2s}',
    P + ' .queue-item .qi-sub{flex:0 3 auto;min-width:4.6em;font-size:11px!important;color:var(--ecp-ink3)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .queue-item .queue-artist-link{color:var(--ecp-ink3)!important;font-size:11px;text-shadow:none!important}',
    P + ' .queue-item .queue-artist-link:hover{color:var(--ecp-ink)!important;text-decoration:underline;text-decoration-color:var(--ecp-ink4);text-underline-offset:3px}',
    P + ' .queue-item:not(.now):hover .qi-name{color:var(--ecp-hot)!important}',
    P + ' .queue-item .ecp-nx{flex:0 0 auto;align-self:center;font-size:10px;line-height:14px;color:var(--ecp-ink3);border:1px solid var(--ecp-ink4);border-radius:3px;padding:0 4px;white-space:nowrap}',
    P + ' .queue-item .ecp-dur{flex:0 0 auto;margin-left:auto;font:11px/1 ' + MONO + ';color:var(--ecp-ink3);font-variant-numeric:tabular-nums;transition:opacity .15s}',
    P + ' .queue-item.ecp-old{opacity:.42!important}',
    P + ' .queue-item.ecp-old:hover{opacity:.8!important}',
    // 悬停才出的按钮：盖在时长上
    P + ' .qi-act{position:absolute;right:0;top:50%;transform:translateY(-50%);display:flex!important;gap:0!important;padding-left:18px;opacity:0!important;pointer-events:none;background:linear-gradient(90deg,rgba(27,25,24,0),rgb(27,25,24) 16px)!important;transition:opacity .15s!important}',
    B + '[data-hth-page="stage"] #playlist-panel .qi-act{background:linear-gradient(90deg,rgba(18,16,15,0),rgb(24,22,21) 16px)!important}',
    P + ' .queue-item:hover .qi-act{opacity:1!important;pointer-events:auto}',
    P + ' .queue-item:not(.now):hover .ecp-dur{opacity:0}',
    P + ' .qi-act button,' + P + ' .qi-act button.liked,' + P + ' .qi-act button.queue-next{width:26px!important;height:26px!important;display:grid!important;place-items:center;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;box-shadow:none!important;color:var(--ecp-ink3)!important;font:300 17px/1 ' + UI + '!important;transition:color .15s,background .15s!important}',
    P + ' .qi-act button:hover,' + P + ' .qi-act button.queue-next:hover{color:var(--ecp-ink)!important;background:var(--ecp-line)!important}',
    P + ' .qi-act button:last-child:hover{color:var(--ecp-hot)!important}',
    P + ' .qi-act button svg{width:15px;height:15px}',
    P + ' .qi-act .heart-svg{width:14px!important;height:14px!important}',
    P + ' .qi-act .heart-svg path{fill:none!important;stroke:currentColor;stroke-width:2.1}',
    P + ' .qi-act button.liked{color:var(--ecp-hot)!important}',
    P + ' .qi-act button.liked .heart-svg path{fill:currentColor!important}',
    P + ' .qi-act button.queue-next{font-size:0!important}',
    P + ' .qi-act button.queue-next::before{content:"";width:15px;height:15px;background:currentColor;-webkit-mask:' + IC_NEXT + ' center/contain no-repeat;mask:' + IC_NEXT + ' center/contain no-repeat}',
    P + ' .qi-act button:nth-child(3) svg{display:none}',
    P + ' .qi-act button:nth-child(3)::before{content:"";width:15px;height:15px;background:currentColor;-webkit-mask:' + IC_ADD + ' center/contain no-repeat;mask:' + IC_ADD + ' center/contain no-repeat}',
    // 正在播放：一块卡片
    P + ' .queue-item.now{display:grid!important;grid-template-columns:58px minmax(0,1fr) auto;column-gap:14px;align-items:center;height:' + NOW_H + 'px;padding:0!important;border-top:1px solid var(--ecp-ink4)!important;border-bottom:1px solid var(--ecp-ink4)!important;background:transparent!important}',
    P + ' .queue-item.now:hover{background:rgba(223,227,220,.025)!important}',
    P + ' .queue-item.now .ecp-num{display:none}',
    P + ' .queue-item.now>img,' + P + ' .queue-item.now>div:not([class]){grid-column:1;grid-row:1;width:58px!important;height:58px!important;border-radius:3px!important;object-fit:cover;background:rgba(223,227,220,.06)!important;box-shadow:0 6px 18px rgba(0,0,0,.4)}',
    P + ' .queue-item.now .qi-info{grid-column:2;grid-row:1;display:flex;flex-direction:column;align-items:stretch;gap:3px;min-width:0}',
    P + ' .queue-item.now .qi-name{font:900 17px/1.25 ' + HEAVY + '!important;letter-spacing:.03em;color:var(--ecp-ink)!important}',
    P + ' .queue-item.now .qi-sub,' + P + ' .queue-item.now .queue-artist-link{font-size:12px!important;color:var(--ecp-ink2)!important}',
    P + ' .queue-item.now .qi-sub{min-width:0}',
    P + ' .ecp-lb{display:flex;align-items:center;gap:8px;font-size:10px;line-height:14px;letter-spacing:.2em;color:var(--ecp-hot);white-space:nowrap}',
    P + ' .ecp-eq{display:inline-flex;gap:2px;height:10px;align-items:flex-end}',
    P + ' .ecp-eq i{width:2px;height:10px;background:var(--ecp-hot);transform-origin:bottom;animation:ecp-eq .8s ease-in-out infinite alternate}',
    P + ' .ecp-eq i:nth-child(2){animation-duration:.55s}' + P + ' .ecp-eq i:nth-child(3){animation-duration:.95s}' + P + ' .ecp-eq i:nth-child(4){animation-duration:.7s}',
    P + '.ecp-paused .ecp-lb{color:var(--ecp-ink3)}',
    P + '.ecp-paused .ecp-eq i{animation:none;background:var(--ecp-ink3);transform:scaleY(.45)}',
    P + '.ecp-paused .ecp-eq i:nth-child(2){transform:scaleY(.8)}' + P + '.ecp-paused .ecp-eq i:nth-child(3){transform:scaleY(.6)}' + P + '.ecp-paused .ecp-eq i:nth-child(4){transform:scaleY(.95)}',
    '@keyframes ecp-eq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}',
    P + ' .ecp-prog{position:relative;height:9px;margin-top:3px;pointer-events:none}',
    P + ' .ecp-prog::before{content:"";position:absolute;left:0;right:0;top:4px;height:1px;background:var(--ecp-ink4)}',
    P + ' .ecp-prog i{position:absolute;left:0;right:0;top:3.5px;height:2px;background:var(--ecp-hot);transform-origin:0 50%;transform:scaleX(var(--p,0));transition:transform 1s linear}',
    P + ' .ecp-left{grid-column:3;grid-row:1;align-self:end;margin-bottom:17px;font:11px/1 ' + MONO + ';color:var(--ecp-ink3);white-space:nowrap;font-variant-numeric:tabular-nums;transition:opacity .15s}',
    P + ' .queue-item.now .qi-act{top:8px;transform:none;background:rgb(25,23,22)!important;padding-left:6px}',
    P + ' .queue-item.now:hover .ecp-left{opacity:.5}',
    // 接下来
    P + ' .ecp-up{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;box-sizing:border-box;height:' + UP_H + 'px;padding:0 2px 8px 0;font-size:11px;color:var(--ecp-ink3);letter-spacing:.08em;white-space:nowrap;pointer-events:none}',
    P + ' .ecp-up em{font-style:normal;font-size:10px;opacity:.75;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis}',
    // 长按拖动
    P + ' .queue-item.reorder-pressing{background:rgba(223,227,220,.05)!important}',
    P + ' .queue-item.is-reordering,' + P + ' .pl-card.is-reordering{background:rgba(223,227,220,.07)!important;outline:1px solid var(--ecp-ink4);outline-offset:-1px;cursor:grabbing}',
    P + ' .queue-hydration-status,' + P + ' .playlist-catalog-status{color:var(--ecp-ink3)!important;font-size:10.5px;letter-spacing:.04em}',
    P + ' .queue-hydration-spinner{border-color:var(--ecp-ink4)!important;border-top-color:var(--ecp-hot)!important}',
    P + ' .queue-hydration-retry{border:1px solid var(--ecp-ink4)!important;background:transparent!important;color:var(--ecp-ink2)!important;border-radius:999px!important}',
    P + ' .mini-queue-skeleton{height:34px!important;margin:5px 0!important;border-radius:0!important;background:transparent!important;border:0!important;border-bottom:1px solid var(--ecp-line)!important;box-shadow:none!important}',

    // ---------- 歌单 / 播客：分组标题 = 小字 + 细线 + 数量 ----------
    P + ' #pl-list{margin-top:0!important}',
    P + ' .pl-section-label{display:flex;align-items:center;gap:12px;box-sizing:border-box;height:31px;margin:0!important;padding:9px 0 0!important;font:11px/1 ' + UI + '!important;font-weight:400!important;letter-spacing:.14em!important;text-transform:none!important;color:var(--ecp-ink3)!important;text-shadow:none!important;white-space:nowrap}',
    P + ' .pl-section-label::after{content:"";order:2;flex:1;height:1px;background:var(--ecp-ink4)}',
    P + ' .pl-section-label .ecp-gc{order:3;font:10px/1 ' + MONO + ';letter-spacing:.04em;color:var(--ecp-ink3);font-variant-numeric:tabular-nums}',
    P + ' .podcast-inline-head{margin:6px 0 2px!important;gap:12px!important}',
    P + ' .podcast-inline-head .pl-section-label{flex:1;min-width:0;padding:0!important;height:26px}',
    P + ' .podcast-inline-head .fx-mini-btn{flex:0 0 auto!important;width:auto!important;order:-1}',
    P + ' .pl-card,' + P + ' .pl-card.podcast-card,' + P + ' .pl-card.podcast-child,' + P + ' .pl-card.expanded{position:relative;display:flex!important;align-items:center!important;gap:14px!important;box-sizing:border-box;height:69px;margin:0!important;padding:0 24px 0 2px!important;border:0!important;border-bottom:1px solid var(--ecp-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;transition:background .2s!important}',
    P + ' .pl-card:hover,' + P + ' .pl-card.podcast-card:hover{background:rgba(223,227,220,.035)!important}',
    P + ' .pl-card>img,' + P + ' .pl-card>div:not([class])[style*="width:44px"],' + P + ' .pl-built-in-placeholder{width:46px!important;height:46px!important;flex:0 0 46px!important;border-radius:3px!important;object-fit:cover;background:rgba(223,227,220,.05)!important;box-shadow:0 4px 12px rgba(0,0,0,.3)}',
    P + ' .pl-built-in-placeholder{display:grid!important;place-items:center;border:1px solid var(--ecp-ink4)!important;box-shadow:none!important;background:transparent!important;color:var(--ecp-ink3)!important;font:500 10px/1 ' + MONO + '!important;letter-spacing:.1em;text-shadow:none!important}',
    P + ' .pl-name{font-size:14px!important;line-height:1.35;color:var(--ecp-ink)!important;transition:color .2s}',
    P + ' .pl-sub{margin-top:4px!important;font-size:11px!important;color:var(--ecp-ink3)!important;letter-spacing:.02em}',
    P + ' .pl-card:hover .pl-name{color:var(--ecp-hot)!important}',
    P + ' .pl-card .tag-source{display:inline-block;margin-left:8px!important;padding:0 4px!important;border:1px solid var(--ecp-ink4)!important;border-radius:3px!important;background:transparent!important;box-shadow:none!important;color:var(--ecp-ink3)!important;font:500 9px/13px ' + MONO + '!important;letter-spacing:.06em;vertical-align:2px!important;text-shadow:none!important}',
    // 右边一个细箭头：歌单是往下展开，播客是进入
    P + ' .pl-card::after{content:"";position:absolute;right:5px;top:50%;width:6px;height:6px;margin-top:-4px;border-right:1.5px solid var(--ecp-ink3);border-bottom:1.5px solid var(--ecp-ink3);transform:rotate(45deg);opacity:.55;transition:transform .25s,opacity .2s,border-color .2s}',
    P + ' .pl-card.podcast-card::after{transform:rotate(-45deg);margin-top:-3px}',
    P + ' .pl-card:hover::after{opacity:1}',
    P + ' .pl-card.expanded::after{transform:rotate(-135deg);margin-top:-1px;opacity:1;border-color:var(--ecp-hot)}',
    P + ' .pl-card.expanded::before{content:"";position:absolute;left:-12px;top:14px;bottom:14px;width:2px;background:var(--ecp-hot)}',
    P + ' .pl-card.expanded{border-bottom-color:var(--ecp-ink4)!important}',
    // 展开详情
    P + ' .pl-inline-detail{margin:0!important;padding:0 0 12px 12px!important;box-sizing:border-box;border:0!important;border-left:1px solid var(--ecp-ink4)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;min-height:0!important}',
    P + ' .pl-detail-sticky{position:sticky!important;top:calc(var(--ecp-head-h,100px) - 22px)!important;box-sizing:border-box;height:130px;margin:0!important;padding:12px 0 0!important;border-radius:0!important;background:var(--ecp-bg)!important;box-shadow:none!important;display:flex;flex-direction:column}',
    B + '[data-hth-page="stage"] #playlist-panel .pl-detail-sticky{background:rgb(18,16,15)!important}',
    P + ' .pl-detail-sticky::after{content:"";position:absolute;left:0;right:0;bottom:-8px;height:8px;background:linear-gradient(rgba(20,18,17,.9),rgba(20,18,17,0));pointer-events:none}',
    P + ' .pl-detail-head,' + P + ' .pl-detail-sticky .pl-detail-head{gap:12px!important;margin:0!important;padding:0 0 12px!important;border-bottom:1px solid var(--ecp-line)!important;background:transparent!important;border-radius:0!important;box-shadow:none!important}',
    P + ' .pl-detail-cover{width:48px!important;height:48px!important;border-radius:3px!important;background:rgba(223,227,220,.05)!important;box-shadow:0 6px 16px rgba(0,0,0,.35)}',
    P + ' .pl-detail-title{font:900 16px/1.3 ' + HEAVY + '!important;letter-spacing:.03em;color:var(--ecp-ink)!important}',
    P + ' .pl-detail-sub{font-size:11px!important;color:var(--ecp-ink3)!important;margin-top:4px!important}',
    P + ' .pl-detail-count{font:11px/1 ' + MONO + '!important;color:var(--ecp-ink3)!important;font-variant-numeric:tabular-nums}',
    P + ' .pl-detail-actions{gap:6px!important;margin:12px 0 0!important;flex-wrap:nowrap;overflow:hidden}',
    P + ' .pl-detail-play{height:26px!important;min-width:0!important;padding:0 12px 0 10px!important;border-radius:999px!important;border:1px solid var(--ecp-hot)!important;background:transparent!important;box-shadow:none!important;color:var(--ecp-hot)!important;font:12px/1 ' + UI + '!important;letter-spacing:.04em;gap:6px!important;transition:background .2s,color .2s!important}',
    P + ' .pl-detail-play:hover{background:var(--ecp-hot)!important;color:#141211!important}',
    P + ' .pl-detail-play svg{width:11px!important;height:11px!important}',
    P + ' .pl-detail-top-btn{flex:0 0 auto}',
    P + ' .pl-detail-top-btn.danger:hover{color:var(--ecp-hot)!important;border-color:var(--ecp-hot)!important}',
    P + ' .pl-detail-list{gap:0!important;scrollbar-width:none}',
    P + ' .pl-detail-list::-webkit-scrollbar{width:0}',
    P + ' .pl-detail-row{position:relative;display:flex!important;align-items:center!important;gap:12px!important;box-sizing:border-box;height:56px;flex:0 0 56px;margin:0!important;padding:0 4px 0 0!important;border:0!important;border-bottom:1px solid var(--ecp-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}',
    P + ' .pl-detail-row:hover{background:rgba(223,227,220,.035)!important}',
    P + ' .pl-detail-row .ecp-num{flex:0 0 18px;font:10px/1 ' + MONO + ';color:var(--ecp-ink3);font-variant-numeric:tabular-nums}',
    P + ' .pl-detail-row>img,' + P + ' .pl-detail-row>div[style*="width:34px"]{width:36px!important;height:36px!important;border-radius:3px!important;background:rgba(223,227,220,.05)!important}',
    P + ' .pl-detail-row-title{font-size:13px!important;font-weight:400!important;color:var(--ecp-ink)!important;transition:color .2s}',
    P + ' .pl-detail-row:hover .pl-detail-row-title{color:var(--ecp-hot)!important}',
    P + ' .pl-detail-row-artist{font:11px ' + UI + '!important;color:var(--ecp-ink3)!important;margin-top:3px!important;text-shadow:none!important}',
    P + ' .pl-detail-row-artist:hover{color:var(--ecp-ink)!important;text-decoration:underline;text-decoration-color:var(--ecp-ink4)}',
    P + ' .pl-detail-row .ecp-dur{flex:0 0 auto;font:11px/1 ' + MONO + ';color:var(--ecp-ink3);font-variant-numeric:tabular-nums}',
    P + ' .pl-detail-remove{width:24px!important;height:24px!important;border:0!important;border-radius:50%!important;background:transparent!important;box-shadow:none!important;color:var(--ecp-ink3)!important;font:300 17px/1 ' + UI + '!important;opacity:0;transition:opacity .15s,color .15s!important}',
    P + ' .pl-detail-row:hover .pl-detail-remove{opacity:1}',
    P + ' .pl-detail-row:hover .ecp-dur{display:none}',
    P + ' .pl-detail-remove:hover{color:var(--ecp-hot)!important}',
    P + ' .pl-detail-progress{color:var(--ecp-ink3)!important;font-size:10.5px!important;letter-spacing:.04em}',
    P + ' .pl-detail-loading-row .pl-detail-row-title{color:var(--ecp-ink2)!important}',

    // 歌单栏打开时，主页左边的大字退到后面（和概念稿一样），免得两层字打架
    B + ':has(#playlist-panel.show) .hth-echo .ec-stk3d,' + B + ':has(#playlist-panel.peek) .hth-echo .ec-stk3d{opacity:.14!important;transform:translateX(90px)}',
    B + ':has(#playlist-panel.show) .hth-echo .ec-foot-l,' + B + ':has(#playlist-panel.peek) .hth-echo .ec-foot-l{opacity:0!important;transition:opacity .3s 0s!important}'
  ].join('\n');

  // ---------- 小工具 ----------
  function pad2(n) {
    var neg = n < 0; n = Math.abs(n);
    return (neg ? '-' : '') + (n < 10 ? '0' + n : String(n));
  }
  function fmt(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function songSeconds(song) {
    try { return typeof playbackDurationFromSong === 'function' ? (playbackDurationFromSong(song) || 0) : 0; } catch (_e) { return 0; }
  }
  function queueArr() { try { return (typeof playQueue !== 'undefined' && Array.isArray(playQueue)) ? playQueue : []; } catch (_e) { return []; } }
  function curIndex() { try { return typeof currentIdx === 'number' ? currentIdx : -1; } catch (_e) { return -1; } }
  function isPlaying() { try { return typeof playing !== 'undefined' && !!playing; } catch (_e) { return false; } }
  function deco(tag, cls, text) {
    var el = document.createElement(tag);
    el.className = cls;
    el.setAttribute('data-skin-deco', '');
    if (text != null) el.textContent = text;
    return el;
  }
  function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }
  function playbackPos() {
    var dur = 0, pos = 0;
    try { dur = typeof getPlaybackDurationSeconds === 'function' ? (getPlaybackDurationSeconds() || 0) : 0; } catch (_e) { }
    try { pos = typeof getPlaybackCurrentSeconds === 'function' ? (getPlaybackCurrentSeconds() || 0) : 0; } catch (_e) { }
    if (!pos) { try { pos = typeof currentResumeSeconds === 'function' ? (currentResumeSeconds(0) || 0) : 0; } catch (_e) { } }
    if (!dur) { var q = queueArr(), c = curIndex(); if (q[c]) dur = songSeconds(q[c]); }
    return { pos: Math.max(0, pos), dur: Math.max(0, dur) };
  }

  // ---------- 头部：标题数量、分页数量 ----------
  function updateCounts(panel) {
    panel = panel || document.getElementById('playlist-panel');
    if (!panel) return;
    var q = queueArr().length, pl = 0, pod = 0;
    try { pl = (typeof userPlaylists !== 'undefined' && userPlaylists) ? userPlaylists.length : 0; } catch (_e) { }
    try { pod = (typeof myPodcastCollections !== 'undefined' && myPodcastCollections) ? myPodcastCollections.length : 0; } catch (_e) { }
    var title = panel.querySelector('.playlist-panel-sticky .fx-title');
    if (title) {
      var tc = title.querySelector('.ecp-tc');
      if (!tc) { tc = deco('span', 'ecp-tc', ''); title.appendChild(tc); }
      setText(tc, String(q));
      tc.title = '队列里一共 ' + q + ' 首';
    }
    [['tab-queue', q], ['tab-pl', pl], ['tab-podcast', pod]].forEach(function (t) {
      var btn = document.getElementById(t[0]);
      if (!btn) return;
      var n = btn.querySelector('.ecp-n');
      if (!n) { n = deco('i', 'ecp-n', ''); btn.appendChild(n); }
      setText(n, String(t[1]));
    });
    var sticky = panel.querySelector('.playlist-panel-sticky');
    if (sticky && sticky.offsetHeight) {
      var h = sticky.offsetHeight + 'px';
      if (panel.style.getPropertyValue('--ecp-head-h') !== h) panel.style.setProperty('--ecp-head-h', h);
    }
  }

  // ---------- 队列 ----------
  function toggleHist() {
    var list = document.getElementById('queue-list');
    var panel = document.getElementById('playlist-panel');
    var cur = curIndex();
    histOpen = !histOpen;
    try { localStorage.setItem(HIST_KEY, histOpen ? '1' : '0'); } catch (_e) { }
    if (list) applyHistLayout(list, cur);
    if (panel && cur > 0) {
      // 展开：已播放的歌出现在「正在播放」上面；太多时只露出最近几首，正在播放那块尽量不跳
      panel.scrollTop = histOpen ? Math.max(0, (cur - 4) * STEP) : 0;
    }
    try { if (typeof renderQueuePanel === 'function') renderQueuePanel({ animate: false }); } catch (_e) { }
  }
  function applyHistLayout(list, cur) {
    var collapsed = !histOpen && cur > 0;
    list.classList.toggle('ecp-collapsed', collapsed);
    var v = collapsed ? (cur * STEP) + 'px' : '0px';
    if (list.style.getPropertyValue('--ecp-hist') !== v) list.style.setProperty('--ecp-hist', v);
    var pane = document.getElementById('queue-pane');
    var hist = pane && pane.querySelector(':scope > .ecp-hist');
    if (cur > 0 && queueArr().length) {
      if (!hist) {
        hist = deco('button', 'ecp-hist', '');
        hist.type = 'button';
        hist.appendChild(deco('b', 'ecp-hist-t', ''));
        hist.lastChild.style.fontWeight = '400';
        hist.appendChild(deco('span', 'ecp-hist-a', ''));
        hist.addEventListener('click', function (e) { e.stopPropagation(); toggleHist(); });
        pane.insertBefore(hist, list);
      }
      setText(hist.firstChild, '已播放 ' + cur + ' 首');
      setText(hist.lastChild, collapsed ? '展开' : '收起');
      hist.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    } else if (hist) {
      hist.remove();
    }
  }
  function decorateQueueItem(item, i, cur, q) {
    var song = q[i];
    var numText = cur >= 0 ? pad2(i - cur) : pad2(i + 1);
    var num = item.firstElementChild && item.firstElementChild.classList.contains('ecp-num') ? item.firstElementChild : null;
    if (!num) { num = deco('span', 'ecp-num ecp-mono', ''); item.insertBefore(num, item.firstChild); }
    setText(num, numText);
    item.classList.toggle('ecp-old', cur >= 0 && i < cur);
    var info = item.querySelector('.qi-info');
    if (!info) return;
    if (i === cur) {
      if (!info.querySelector('.ecp-lb')) {
        var lb = deco('div', 'ecp-lb', '');
        var eq = deco('span', 'ecp-eq', '');
        for (var k = 0; k < 4; k++) eq.appendChild(document.createElement('i'));
        lb.appendChild(eq);
        lb.appendChild(deco('span', 'ecp-lb-t', isPlaying() ? '正在播放' : '已暂停'));
        info.insertBefore(lb, info.firstChild);
        var prog = deco('div', 'ecp-prog', '');
        prog.appendChild(document.createElement('i'));
        info.appendChild(prog);
      }
      if (!item.querySelector(':scope > .ecp-left')) item.insertBefore(deco('span', 'ecp-left', ''), item.querySelector('.qi-act'));
      updateNow(item);
    } else {
      if (i === cur + 1 && !info.querySelector('.ecp-nx')) {
        var name = info.querySelector('.qi-name');
        var nx = deco('span', 'ecp-nx', '下一首');
        if (name && name.nextSibling) info.insertBefore(nx, name.nextSibling); else info.appendChild(nx);
      }
      var dur = item.querySelector(':scope > .ecp-dur');
      if (!dur) { dur = deco('span', 'ecp-dur', ''); item.insertBefore(dur, item.querySelector('.qi-act')); }
      var s = songSeconds(song);
      setText(dur, s ? fmt(s) : '');
    }
  }
  function decorateQueue(list) {
    var q = queueArr();
    var cur = curIndex();
    if (cur >= q.length) cur = -1;
    applyHistLayout(list, cur);
    var items = list.querySelectorAll(':scope > .queue-item[data-queue-index]');
    var first = -1, last = -1, nowEl = null;
    for (var n = 0; n < items.length; n++) {
      var item = items[n];
      var i = Number(item.getAttribute('data-queue-index'));
      if (!isFinite(i)) continue;
      if (first < 0) first = i;
      last = i;
      if (i === cur) nowEl = item;
      decorateQueueItem(item, i, cur, q);
    }
    // 「接下来 · N 首」紧跟在正在播放后面
    var up = list.querySelector(':scope > .ecp-up');
    if (nowEl) {
      if (!up || up.previousElementSibling !== nowEl) {
        if (up) up.remove();
        up = deco('div', 'ecp-up', '');
        up.appendChild(deco('span', 'ecp-up-t', ''));
        up.appendChild(deco('em', 'ecp-up-h', '长按一行拖动排序'));
        nowEl.parentNode.insertBefore(up, nowEl.nextSibling);
      }
      var left = Math.max(0, q.length - cur - 1);
      setText(up.firstChild, '接下来 · ' + left + ' 首');
      setText(up.lastChild, left ? '长按一行拖动排序' : '队列到底了');
    } else if (up) {
      up.remove();
    }
    // 正在播放那块比普通行高：它没画出来时，把多出来的高度补进上 / 下占位，滚动时列表总高不跳
    var spacers = list.querySelectorAll(':scope > .queue-virtual-spacer');
    for (var sIdx = 0; sIdx < spacers.length; sIdx++) {
      var sp = spacers[sIdx];
      if (sp.getAttribute('data-ecp-base') == null) sp.setAttribute('data-ecp-base', String(parseFloat(sp.style.height) || 0));
      var base = Number(sp.getAttribute('data-ecp-base')) || 0;
      var isTop = !sp.previousElementSibling;
      var add = 0;
      if (cur >= 0 && !nowEl && first >= 0) {
        if (isTop && first > cur) add = EXTRA;
        if (!isTop && last < cur) add = EXTRA;
      }
      var h = (base + add) + 'px';
      if (sp.style.height !== h) sp.style.height = h;
    }
  }
  function updateNow(item) {
    if (!item) return;
    var pb = playbackPos();
    var p = pb.dur ? Math.max(0, Math.min(1, pb.pos / pb.dur)) : 0;
    var bar = item.querySelector('.ecp-prog');
    if (bar) { var pv = p.toFixed(4); if (bar.style.getPropertyValue('--p') !== pv) bar.style.setProperty('--p', pv); }
    setText(item.querySelector('.ecp-left'), pb.dur ? '还剩 ' + fmt(pb.dur - pb.pos) : '');
    setText(item.querySelector('.ecp-lb-t'), isPlaying() ? '正在播放' : '已暂停');
  }

  // ---------- 歌单 / 播客 ----------
  var GROUP_KEYS = { 'Not Blind 内置歌单': 'mineradio', '网易云歌单': 'netease', 'QQ 音乐歌单': 'qq', '酷狗音乐歌单': 'kugou', '汽水音乐歌单': 'qishui', 'Spotify 歌单': 'spotify' };
  function groupCount(key) {
    var n = 0;
    try {
      (userPlaylists || []).forEach(function (pl) {
        var k = typeof normalizePlaylistProvider === 'function' ? normalizePlaylistProvider(pl && pl.provider) : (pl && pl.provider);
        if (k === key) n++;
      });
    } catch (_e) { }
    return n;
  }
  function labelCount(label, n) {
    var c = label.querySelector('.ecp-gc');
    if (!c) { c = deco('span', 'ecp-gc', ''); label.appendChild(c); }
    setText(c, n == null ? '' : pad2(n));
  }
  function decoratePlaylists(list) {
    var labels = list.querySelectorAll(':scope > .pl-section-label');
    for (var i = 0; i < labels.length; i++) {
      var lb = labels[i];
      var txt = (lb.firstChild && lb.firstChild.nodeType === 3 ? lb.firstChild.nodeValue : lb.textContent || '').trim();
      var key = GROUP_KEYS[txt];
      if (key) labelCount(lb, groupCount(key));
    }
    decorateDetailRows(list);
  }
  function decorateDetailRows(list) {
    var rows = list.querySelectorAll('.pl-detail-row[data-pl-detail-row]');
    var tracks = [];
    try { tracks = (playlistPanelDetailState && playlistPanelDetailState.tracks) || []; } catch (_e) { }
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var idx = Number(row.getAttribute('data-pl-detail-row'));
      if (!row.querySelector(':scope > .ecp-num')) row.insertBefore(deco('span', 'ecp-num ecp-mono', pad2(idx + 1)), row.firstChild);
      if (!row.querySelector(':scope > .ecp-dur')) {
        var s = songSeconds(tracks[idx]);
        if (s) {
          var d = deco('span', 'ecp-dur', fmt(s));
          var rm = row.querySelector('.pl-detail-remove');
          if (rm) row.insertBefore(d, rm); else row.appendChild(d);
        }
      }
    }
  }
  function decoratePodcasts(list) {
    var cards = list.querySelectorAll(':scope > .pl-card.podcast-card:not(.podcast-child)');
    var head = list.querySelector(':scope > .ecp-podhead');
    if (cards.length) {
      if (!head || head !== list.firstElementChild) {
        if (head) head.remove();
        head = deco('div', 'pl-section-label ecp-podhead', '收藏与创建');
        list.insertBefore(head, list.firstChild);
      }
      labelCount(head, cards.length);
    } else if (head) {
      head.remove();
    }
    var inner = list.querySelector('.podcast-inline-head .pl-section-label');
    if (inner) labelCount(inner, list.querySelectorAll('.pl-card.podcast-child').length || null);
  }

  // ---------- 接入底座 ----------
  function nowItem(panel) {
    var list = document.getElementById('queue-list');
    return list && list.querySelector(':scope > .queue-item.now');
  }
  registerPanelSkin({
    id: ID,
    css: CSS,
    virtual: { queueRowStep: STEP },
    attach: function (panel) {
      if (panel) panel.classList.toggle('ecp-paused', !isPlaying());
    },
    detach: function (panel) {
      if (!panel) return;
      Array.prototype.forEach.call(panel.querySelectorAll('[data-skin-deco]'), function (el) { el.remove(); });
      panel.classList.remove('ecp-paused');
      panel.style.removeProperty('--ecp-head-h');
      var list = document.getElementById('queue-list');
      if (list) { list.classList.remove('ecp-collapsed'); list.style.removeProperty('--ecp-hist'); }
      Array.prototype.forEach.call(panel.querySelectorAll('.ecp-old'), function (el) { el.classList.remove('ecp-old'); });
      Array.prototype.forEach.call(panel.querySelectorAll('[data-ecp-base]'), function (el) {
        el.style.height = (Number(el.getAttribute('data-ecp-base')) || 0) + 'px';
        el.removeAttribute('data-ecp-base');
      });
    },
    decorate: function (kind, container, panel) {
      if (kind === 'queue') decorateQueue(container);
      else if (kind === 'playlists') decoratePlaylists(container);
      else if (kind === 'podcasts') decoratePodcasts(container);
      updateCounts(panel);
    },
    tick: function (panel) {
      if (!panel) return;
      var on = isPlaying();
      if (panel.classList.contains('ecp-paused') === on) panel.classList.toggle('ecp-paused', !on);
      if (!panel.classList.contains('show') && !panel.classList.contains('peek')) return;
      updateNow(nowItem(panel));
    }
  });
})();
