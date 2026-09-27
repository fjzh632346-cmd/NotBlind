// ============================================================
// 歌单栏皮肤 · 孔版海报 (riso-poster)：票根夹 / 节目册
// 一张现印的节目册：纸面 + 左侧蓝色书脊；页眉是"今晚曲目单 / 票根夹 / 广播节目单"；
// 三个分页是粉 / 蓝 / 黄三块版的索引标签；
// 当前队列 = 曲目单（序号 · 歌名 ···· 歌手 · 时长），正在播的一行用黄色荧光笔划过；
// 我的歌单 = 一摞票根（票根里是双色套印的封面 + Nº），展开详情 = 翻开的曲目单；
// 我的播客 = 广播节目表（频率 + 节目名）。
// 只靠 CSS + 装饰节点（data-skin-deco），不动原来的渲染和点击 / 长按拖动排序。
// 播放页（背后是深色 3D 舞台）上：纸被一盏台灯照着，四周压暗，油墨稍收一点。
// ============================================================
(function () {
  var ID = 'riso-poster';
  var B = 'body[data-panel-skin="' + ID + '"]';
  var P = B + ' #playlist-panel';
  var STAGE = B + '[data-hth-page="stage"] #playlist-panel';
  var ROW = 46;          // 当前队列每行步长（行高，行间距为 0）

  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmt(s) { s = Math.max(0, Math.floor(Number(s) || 0)); return Math.floor(s / 60) + ':' + pad2(s % 60); }
  // 全局变量是 var 声明的，不一定挂在 window 上：用 typeof 读
  function queueArr() { try { return typeof playQueue !== 'undefined' && Array.isArray(playQueue) ? playQueue : []; } catch (_e) { return []; } }
  function curIdx() { try { return typeof currentIdx === 'number' ? currentIdx : -1; } catch (_e) { return -1; } }
  function playlistsArr() { try { return typeof userPlaylists !== 'undefined' && Array.isArray(userPlaylists) ? userPlaylists : []; } catch (_e) { return []; } }
  function podcastsArr() { try { return typeof myPodcastCollections !== 'undefined' && Array.isArray(myPodcastCollections) ? myPodcastCollections : []; } catch (_e) { return []; } }
  function detailTracks() { try { return typeof playlistPanelDetailState !== 'undefined' && playlistPanelDetailState ? (playlistPanelDetailState.tracks || []) : []; } catch (_e) { return []; } }
  function songDur(song) {
    if (!song) return 0;
    try { if (typeof playbackDurationFromSong === 'function') return Number(playbackDurationFromSong(song)) || 0; } catch (_e) { }
    var d = Number(song.duration) || 0;
    if (!d && song.dt) d = song.dt / 1000;
    return d > 36000 ? d / 1000 : d;
  }
  function hash01(s) { return (typeof panelSkinHash === 'function' ? panelSkinHash(s) : 0) / 4294967296; }

  // 来源 → 用哪块版的墨
  var SRC_INK = { mineradio: 'b', netease: 'a', qq: 'c', kugou: 'b', qishui: 'a', spotify: 'c' };
  var SRC_EN = { mineradio: 'BUILT-IN', netease: 'NETEASE', qq: 'QQ MUSIC', kugou: 'KUGOU', qishui: 'QISHUI', spotify: 'SPOTIFY' };
  var SRC_CN = { mineradio: '内置', netease: '网易云', qq: 'QQ 音乐', kugou: '酷狗', qishui: '汽水', spotify: 'Spotify' };
  function srcFromLabel(t) {
    t = String(t || '');
    if (/内置|Not Blind/i.test(t)) return 'mineradio';
    if (/网易/.test(t)) return 'netease';
    if (/QQ/i.test(t)) return 'qq';
    if (/酷狗/.test(t)) return 'kugou';
    if (/汽水/.test(t)) return 'qishui';
    if (/Spotify/i.test(t)) return 'spotify';
    return '';
  }

  // ---------- 纸纤维 / 油墨颗粒（只生成一次，挂在歌单栏上） ----------
  var tex = null;
  function makeTextures() {
    if (tex) return tex;
    var seed = 902114;
    var r = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    var f = document.createElement('canvas'); f.width = f.height = 300;
    var fg = f.getContext('2d'); fg.lineCap = 'round';
    for (var i = 0; i < 380; i++) {
      var x = r() * 300, y = r() * 300, an = r() * Math.PI, l = 3 + r() * 16;
      fg.strokeStyle = 'rgba(90,72,40,' + (0.05 + r() * 0.1).toFixed(3) + ')'; fg.lineWidth = 0.5 + r() * 0.8;
      fg.beginPath(); fg.moveTo(x, y); fg.quadraticCurveTo(x + Math.cos(an) * l * 0.5 + (r() - 0.5) * 4, y + Math.sin(an) * l * 0.5 + (r() - 0.5) * 4, x + Math.cos(an) * l, y + Math.sin(an) * l); fg.stroke();
    }
    for (i = 0; i < 1500; i++) { fg.fillStyle = 'rgba(80,60,30,' + (r() * 0.06).toFixed(3) + ')'; fg.fillRect(r() * 300, r() * 300, 1, 1); }
    // 油墨颗粒：给实地色块（索引标签、票根、按钮）加一点不匀和针孔
    var W = 160, c = document.createElement('canvas'); c.width = c.height = W;
    var cg = c.getContext('2d'), id = cg.createImageData(W, W), d = id.data;
    for (var k = 0; k < W * W; k++) {
      var a = 0.86 + r() * 0.14;
      if (r() < 0.035) a = 0.15 + r() * 0.35;
      d[k * 4 + 3] = a * 255;
    }
    cg.putImageData(id, 0, 0);
    tex = { fiber: 'url(' + f.toDataURL('image/png') + ')', grain: 'url(' + c.toDataURL('image/png') + ')' };
    return tex;
  }


  var css = [
    // ---------- 纸：节目册本体 ----------
    P + '{--paper:#f1eadb;--ia:#ff3d9a;--ib:#2a4c9c;--ic:#ffd92e;--ax:1.5px;--ay:-1px;--bx:-1px;--by:1.2px;--cx:2px;--cy:2px;',
    '--rp-sheet:color-mix(in srgb,var(--paper) 62%,#fffdf5);--rp-spring:cubic-bezier(.34,1.42,.5,1);--rp-out:cubic-bezier(.2,.8,.2,1);',
    '--hei:"Microsoft YaHei UI","Microsoft YaHei","Noto Sans CJK SC",sans-serif;--kai:"KaiTi","楷体","STKaiti","AR PL UKai CN",serif;',
    '--disp:Impact,"Haettenschweiler","Arial Narrow","DejaVu Sans Condensed",sans-serif;--mono:Consolas,"DejaVu Sans Mono",monospace;',
    'padding:0 16px 22px 24px!important;border-radius:1px!important;border:0!important;color:var(--ib);font-family:var(--hei);',
    'background-color:var(--rp-sheet)!important;',
    'background-image:linear-gradient(90deg,var(--ib) 0 6px,transparent 6px),var(--rp-fiber,none)!important;background-size:auto,300px 300px!important;',
    'box-shadow:7px 8px 0 -1px color-mix(in srgb,var(--ib) 20%,transparent),0 18px 40px -14px rgba(30,30,60,.42),0 1px 0 rgba(0,0,0,.05)!important;',
    'backdrop-filter:none!important;-webkit-backdrop-filter:none!important;rotate:-.35deg;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--ib) 45%,transparent) transparent}',
    P + '.pinned{box-shadow:7px 8px 0 -1px color-mix(in srgb,var(--ia) 26%,transparent),0 18px 40px -14px rgba(30,30,60,.42)!important}',
    P + '::-webkit-scrollbar{width:4px}' + P + '::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ib) 45%,transparent)!important;border-radius:0}',
    P + ' *{-webkit-font-smoothing:antialiased}',
    P + ' button:focus-visible{outline:2px dashed var(--ia);outline-offset:2px}',

    // ---------- 页眉（吸顶）：节目册刊头 + 三块版的索引标签 ----------
    P + ' .playlist-panel-sticky{top:0!important;margin:0 -16px 10px -24px!important;padding:14px 16px 0 30px!important;border-radius:0!important;border:0!important;',
    'background:var(--rp-sheet)!important;background-image:linear-gradient(90deg,var(--ib) 0 6px,transparent 6px),var(--rp-fiber,none)!important;background-size:auto,300px 300px!important;',
    'box-shadow:0 10px 12px -12px rgba(30,30,60,.35)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    P + ' .playlist-panel-sticky::after{content:"";position:absolute;left:30px;right:16px;bottom:0;height:3px;background:var(--ib);translate:var(--bx) var(--by)}',
    P + ' .queue-head{position:relative;margin:0 0 10px!important;align-items:flex-start;gap:8px}',
    P + ' .queue-head>div:first-child{min-width:0;flex:1}',
    P + ' .queue-head .fx-title,' + P + ' .queue-head .fx-sub{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
    P + ' .rp-mast{display:block}',
    P + ' .rp-kick{display:block;font:700 10px/1 var(--mono);letter-spacing:.2em;color:var(--ib);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .rp-h2{display:block;margin-top:7px;font:900 28px/1.05 var(--hei);letter-spacing:.04em;color:var(--ib);translate:var(--bx) var(--by);text-shadow:2px -1.5px 0 color-mix(in srgb,var(--ia) 80%,transparent);white-space:nowrap}',
    P + ' .rp-h2>span{display:none}',
    P + ' .rp-h2 small{font:400 13px var(--disp);letter-spacing:.12em;color:var(--ia);text-shadow:none;margin-left:8px;vertical-align:4px}',
    P + ':has(#tab-queue.active) .rp-h2 .q,' + P + ':has(#tab-pl.active) .rp-h2 .l,' + P + ':has(#tab-podcast.active) .rp-h2 .p{display:inline}',
    P + ' .rp-sub{display:block;margin-top:7px;font:700 10.5px/1 var(--mono);letter-spacing:.12em;color:var(--ib);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .rp-sub em{font-style:normal;color:var(--ia)}',
    // 右上角：图钉 + 随机（印成小方框）
    P + ' .queue-head-act{position:absolute;right:0;top:-4px;gap:4px!important}',
    P + ' .rp-kick{padding-right:64px}',
    P + ' .queue-head-act .fx-mini-btn{height:22px!important;min-height:0!important;padding:0 7px!important;border-radius:0!important;border:1.5px solid var(--ib)!important;background:transparent!important;color:var(--ib)!important;box-shadow:none!important;font:700 11px/1 var(--hei)!important;letter-spacing:.06em;translate:var(--bx) var(--by);transition:background .12s,color .12s,transform .15s!important}',
    P + ' .queue-head-act .fx-mini-btn:hover{background:var(--ic)!important;transform:rotate(-2deg)}',
    P + ' .queue-head-act .playlist-pin-btn{width:24px!important;min-width:24px!important;padding:0!important;border-color:transparent!important;display:grid!important;place-items:center;transition:transform .2s var(--rp-spring)!important}',
    P + ' .queue-head-act .playlist-pin-btn:hover{background:transparent!important;transform:rotate(-14deg) scale(1.12)}',
    P + ' .queue-head-act .playlist-pin-btn.active{color:var(--ia)!important;transform:rotate(28deg)}',
    // 索引标签：粉 = 曲目单，蓝 = 票根夹，黄 = 广播。没选中的是网点、选中的是实地并且高出一截
    P + ' .panel-tabs{display:flex!important;align-items:flex-end!important;gap:4px!important;height:34px;margin:0!important;padding:0!important;position:relative;z-index:1}',
    P + ' .panel-tab{position:relative;flex:1 1 0;min-width:0;height:26px!important;padding:0 6px!important;border:0!important;border-radius:3px 3px 0 0!important;font-size:0!important;color:var(--paper)!important;',
    'box-shadow:none!important;display:flex;align-items:center;justify-content:center;gap:5px;transition:height .22s var(--rp-spring),filter .2s!important;',
    '-webkit-mask-image:var(--rp-grain,none);mask-image:var(--rp-grain,none);-webkit-mask-size:160px;mask-size:160px}',
    P + ' .panel-tab::before{font:900 13px/1 var(--hei);letter-spacing:.14em;white-space:nowrap}',
    P + ' .panel-tab::after{font:400 10px/1 var(--mono);letter-spacing:.1em;opacity:.8;white-space:nowrap}',
    P + ' #tab-queue::before{content:"曲目单"}' + P + ' #tab-queue::after{content:"SET"}',
    P + ' #tab-pl::before{content:"票根夹"}' + P + ' #tab-pl::after{content:"TKT"}',
    P + ' #tab-podcast::before{content:"广播"}' + P + ' #tab-podcast::after{content:"FM"}',
    P + ' #tab-queue{background:var(--ia)!important;translate:var(--ax) var(--ay)}',
    P + ' #tab-pl{background:var(--ib)!important;translate:var(--bx) var(--by)}',
    P + ' #tab-podcast{background:var(--ic)!important;color:var(--ib)!important;translate:var(--cx) var(--cy)}',
    P + ' .panel-tab:not(.active){background-image:radial-gradient(circle,var(--rp-sheet) 0 1.1px,transparent 1.5px)!important;background-size:4px 4px!important;filter:saturate(.9);opacity:.9}',
    P + ' .panel-tab:not(.active):hover{height:30px!important}',
    P + ' .panel-tab.active{height:34px!important}',

    // ---------- 工具条：印成页眉下的一行小字 ----------
    P + ' .queue-toolbar{position:relative!important;top:auto!important;z-index:1!important;margin:0 0 4px!important;padding:2px 0 6px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    P + ' .queue-chip{height:auto!important;padding:0!important;border:0!important;border-radius:0!important;background:none!important;font:700 10px/1 var(--mono)!important;letter-spacing:.14em;color:var(--ib)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
    P + ' .queue-chip::before{content:"";display:inline-block;width:8px;height:8px;margin-right:6px;background:var(--ia);translate:var(--ax) var(--ay)}',
    P + ' .queue-toolbar .fx-mini-btn{flex:none!important;width:auto!important;height:22px!important;padding:0 7px!important;border-radius:0!important;border:1.5px solid var(--ib)!important;background:transparent!important;color:var(--ib)!important;font:700 11px/1 var(--hei)!important;letter-spacing:.06em;box-shadow:none!important;transition:background .12s,color .12s,transform .15s!important}',
    P + ' .queue-toolbar .fx-mini-btn:hover{background:var(--ic)!important;transform:rotate(-2deg)}',
    P + ' #queue-pane .queue-toolbar .fx-mini-btn:last-child:hover{background:var(--ia)!important;border-color:var(--ia)!important;color:var(--paper)!important}',

    // ---------- 今晚曲目单（当前队列） ----------
    P + ' .queue-list{gap:0!important;margin-top:0!important}',
    P + ' .queue-item{position:relative;height:' + ROW + 'px;box-sizing:border-box;gap:8px!important;padding:0 4px 0 2px!important;margin:0!important;border:0!important;border-bottom:1.5px dotted color-mix(in srgb,var(--ib) 60%,transparent)!important;border-radius:0!important;background:none!important;box-shadow:none!important;align-items:center!important;isolation:isolate;transition:transform .2s,opacity .2s!important}',
    P + ' .queue-item>img,' + P + ' .queue-item>div[style]:not(.qi-info){display:none!important}',
    // 荧光笔：悬停时划一道黄色网点，正在播的那行一直划着
    P + ' .queue-item::before{content:"";position:absolute;left:24px;right:0;top:11px;height:24px;background:radial-gradient(circle,var(--ic) 0 1.9px,transparent 2.3px) 0 0/4.4px 4.4px,color-mix(in srgb,var(--ic) 45%,transparent);translate:var(--cx) var(--cy);transform:scaleX(0);transform-origin:0 50%;transition:transform .2s var(--rp-out);z-index:-1;pointer-events:none}',
    P + ' .queue-item:hover::before{transform:scaleX(1)}',
    P + ' .queue-item.now::before{transform:scaleX(1);left:22px;right:-4px;top:10px;height:26px;background:var(--ic);border-radius:2px 6px 3px 5px}',
    P + ' .rp-n{flex:none;width:24px;font:400 19px/1 var(--disp);color:var(--ia);translate:var(--ax) var(--ay);text-align:left}',
    P + ' .queue-item.now .rp-n{font-size:0}',
    P + ' .queue-item.now .rp-n::before{content:"";display:inline-block;width:0;height:0;border-left:11px solid var(--ia);border-top:7px solid transparent;border-bottom:7px solid transparent;translate:3px 0}',
    P + ' .qi-info{display:flex!important;align-items:baseline;gap:8px;flex:1 1 auto;min-width:0}',
    P + ' .qi-name{flex:0 1 auto;min-width:0;font:900 15px/1.2 var(--hei)!important;letter-spacing:.02em;color:var(--ib)!important;translate:var(--bx) var(--by);text-shadow:none!important}',
    P + ' .queue-item.now .qi-name{font-size:16px!important}',
    P + ' .qi-info::after{content:"";order:2;flex:1 1 10px;min-width:10px;border-bottom:1.5px dotted var(--ib);opacity:.55;translate:0 -3px}',
    P + ' .qi-sub{order:3;flex:0 1 auto;max-width:40%;min-width:0;font:400 13.5px/1.2 var(--kai)!important;color:var(--ia)!important}',
    P + ' .queue-artist-link{color:var(--ia)!important;font:inherit!important;translate:var(--ax) var(--ay)}',
    P + ' .queue-artist-link:hover{color:var(--ib)!important;text-decoration:underline wavy var(--ia) 1.5px!important;text-underline-offset:4px}',
    P + ' .rp-d{flex:none;font:700 10.5px/1 var(--mono);letter-spacing:.06em;color:var(--ib)}',
    // 行尾的操作：悬停时从纸下面抽出来一排小方框
    P + ' .qi-act{position:absolute;right:0;top:50%;margin-top:-11px;gap:3px!important;padding-left:8px;background:linear-gradient(90deg,transparent,var(--rp-sheet) 8px);opacity:0;transform:translateX(6px);transition:opacity .14s,transform .2s var(--rp-spring)!important;pointer-events:none}',
    P + ' .queue-item:hover .qi-act,' + P + ' .queue-item:focus-within .qi-act{opacity:1;transform:none;pointer-events:auto}',
    P + ' .qi-act button{width:auto!important;min-width:22px;height:22px!important;padding:0 4px!important;border-radius:0!important;border:1.5px solid var(--ib)!important;background:var(--rp-sheet)!important;color:var(--ib)!important;font:700 11px/1 var(--hei)!important;display:inline-grid;place-items:center;box-shadow:none!important}',
    P + ' .qi-act button svg{width:12px;height:12px}',
    P + ' .qi-act button:hover,' + P + ' .qi-act button.queue-next:hover{background:var(--ib)!important;color:var(--paper)!important}',
    P + ' .qi-act button:last-child:hover{background:var(--ia)!important;border-color:var(--ia)!important}',
    P + ' .qi-act button.liked{color:var(--ia)!important;border-color:var(--ia)!important}',
    // 长按拖动排序：被拎起来的那一行像一张纸条
    B + '.panel-reordering #playlist-panel .queue-item.is-reordering,' + B + '.panel-reordering #playlist-panel .pl-card.is-reordering{background:var(--rp-sheet)!important;border-color:var(--ib)!important;box-shadow:0 10px 18px -8px rgba(30,30,60,.4)!important;rotate:-.8deg;opacity:1}',
    P + ' .queue-item.reorder-pressing,' + P + ' .pl-card.reorder-pressing{border-color:var(--ia)!important}',
    P + ' .queue-hydration-status,' + P + ' .playlist-catalog-status,' + P + ' #queue-list>div[style]:not([class]),' + P + ' #pl-list>div[style]:not([class]),' + P + ' #podcast-list>div[style]:not([class]){color:var(--ib)!important;font:400 15px/1.6 var(--kai)!important;opacity:.85}',

    // ---------- 票根夹（我的歌单） ----------
    P + ' .pl-section-label{display:flex!important;align-items:center;gap:7px;height:12px;margin:12px 0 7px!important;font:700 10px/1 var(--mono)!important;letter-spacing:.16em!important;color:var(--ib)!important;text-shadow:none!important;white-space:nowrap}',
    P + ' .pl-section-label::before{content:"";flex:none;width:9px;height:9px;background:var(--sw,var(--ib))}',
    P + ' .pl-section-label::after{content:attr(data-rp-en);order:2;flex:1;min-width:0;overflow:hidden;border-bottom:1.5px dotted var(--ib);padding-bottom:1px;letter-spacing:.2em;opacity:.8;text-align:right;font-size:9px}',
    P + ' .pl-card:not(.podcast-card){position:relative;height:62px;box-sizing:border-box;margin:0 0 7px!important;padding:0 10px 0 0!important;gap:0!important;align-items:stretch!important;',
    'border:2px solid var(--ib)!important;border-radius:0!important;background:var(--rp-sheet)!important;box-shadow:0 3px 0 -1px color-mix(in srgb,var(--ib) 30%,transparent)!important;',
    'transform:translateX(var(--jx,0)) rotate(var(--jr,0deg));transition:transform .26s var(--rp-spring),box-shadow .2s!important;--tk:var(--ia);--tkt:var(--paper)}',
    P + ' .pl-card[data-playlist-provider="mineradio"]{--tk:var(--ib);--tkt:var(--paper)}',
    P + ' .pl-card[data-playlist-provider="netease"],' + P + ' .pl-card[data-playlist-provider="qishui"]{--tk:var(--ia);--tkt:var(--paper)}',
    P + ' .pl-card[data-playlist-provider="qq"],' + P + ' .pl-card[data-playlist-provider="spotify"]{--tk:var(--ic);--tkt:var(--ib)}',
    P + ' .pl-card[data-playlist-provider="kugou"]{--tk:var(--ib);--tkt:var(--paper)}',
    // 票根上下的两个半圆缺口（撕口）
    P + ' .pl-card:not(.podcast-card)::before,' + P + ' .pl-card:not(.podcast-card)::after{content:""!important;position:absolute!important;left:53px!important;width:14px!important;height:14px!important;border-radius:50%!important;background:var(--rp-sheet)!important;border:2px solid var(--ib)!important;box-shadow:none!important;z-index:2}',
    P + ' .pl-card:not(.podcast-card)::before{top:-9px!important;bottom:auto!important;clip-path:inset(50% 0 0 0)}',
    P + ' .pl-card:not(.podcast-card)::after{bottom:-9px;clip-path:inset(0 0 50% 0)}',
    // 票根：封面双色套印（灰度 × 墨色），角上印 Nº
    P + ' .rp-stub{position:relative;flex:none;width:60px;margin:0;overflow:hidden;background:var(--tk);isolation:isolate;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2px;color:var(--tkt);-webkit-mask-image:var(--rp-grain,none);mask-image:var(--rp-grain,none);-webkit-mask-size:160px;mask-size:160px}',
    P + ' .rp-stub b{font:400 24px/.9 var(--disp);letter-spacing:.02em}',
    P + ' .rp-stub small{font:700 8.5px/1 var(--mono);letter-spacing:.14em;opacity:.9}',
    P + ' .rp-stub img{position:absolute;inset:0;width:100%!important;height:100%!important;border-radius:0!important;object-fit:cover;filter:grayscale(1) contrast(1.35) brightness(1.08);mix-blend-mode:multiply;opacity:.9}',
    P + ' .rp-stub.has-img b{display:none}',
    P + ' .rp-stub.has-img small{position:absolute;left:3px;bottom:3px;padding:2px 3px;background:var(--rp-sheet);color:var(--ib);z-index:1;opacity:1}',
    P + ' .rp-stub.has-img small i{font-style:normal;color:var(--ia)}',
    P + ' .rp-perf{flex:none;width:0;margin:6px 0;border-left:2px dashed var(--ib);translate:var(--bx) var(--by)}',
    P + ' .pl-card:not(.podcast-card)>img,' + P + ' .pl-card:not(.podcast-card)>.pl-built-in-placeholder,' + P + ' .pl-card:not(.podcast-card)>div[style*="width:44px"]{display:none!important}',
    P + ' .pl-card:not(.podcast-card)>div[style*="flex:1"]{padding:10px 0 0 14px;min-width:0}',
    P + ' .pl-name{font:900 16px/1.2 var(--hei)!important;letter-spacing:.02em;color:var(--ib)!important;translate:var(--bx) var(--by)}',
    P + ' .pl-name .tag-source{display:none!important}',
    P + ' .pl-sub{margin-top:6px!important;font:700 10px/1 var(--mono)!important;letter-spacing:.12em;color:var(--ib)!important}',
    P + ' .pl-card:not(.podcast-card) .pl-sub::before{content:"SEAT ";color:var(--ia)}',
    P + ' .rp-flag{position:absolute;right:8px;top:7px;font:700 9.5px/1 var(--mono);letter-spacing:.1em;padding:3px 4px;border:1.5px solid var(--ia);color:var(--ia);background:var(--rp-sheet);transform:rotate(6deg);z-index:1;pointer-events:none}',
    P + ' .pl-card:not(.podcast-card):has(.rp-flag)>div[style*="flex:1"]{padding-right:38px}',
    P + ' .pl-card:not(.podcast-card):hover,' + P + ' .pl-card:not(.podcast-card):focus-visible{--jx:10px;--jr:-1deg;z-index:3}',
    P + ' .pl-card:not(.podcast-card):hover .rp-stub{animation:rp-mis .28s ease-out}',
    '@keyframes rp-mis{0%{translate:3px -2px}55%{translate:-1px 1px}100%{translate:0 0}}',
    P + ' .pl-card.expanded:not(.podcast-card){--jx:0px;--jr:0deg;z-index:3;border-bottom-style:dashed!important;box-shadow:none!important}',
    P + ' .pl-card.expanded:not(.podcast-card) .pl-name{text-decoration:underline wavy var(--ia) 1.5px;text-underline-offset:5px}',
    P + ' .pl-built-in-placeholder{display:none!important}',
    // 展开详情 = 翻开的曲目单
    P + ' .pl-inline-detail{margin:-2px 0 16px!important;padding:0 10px 14px!important;border:2px solid var(--ib)!important;border-top:0!important;border-radius:0!important;background:var(--rp-sheet)!important;box-shadow:0 3px 0 -1px color-mix(in srgb,var(--ib) 30%,transparent)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    P + ' .pl-detail-sticky{top:var(--rp-head,150px)!important;margin:0 -10px 6px!important;padding:12px 10px 8px!important;border-radius:0!important;background:var(--rp-sheet)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:0 8px 10px -10px rgba(30,30,60,.3)}',
    P + ' .pl-detail-head{position:relative;isolation:isolate;margin:0 0 8px!important;padding:0 0 8px!important;border-bottom:3px solid var(--ib)!important}',
    P + ' .rp-dcov{position:absolute;left:0;top:0;width:52px;height:52px;background:var(--ia);translate:var(--ax) var(--ay);z-index:-1;pointer-events:none}',
    P + ' .pl-detail-cover{width:52px!important;height:52px!important;border-radius:0!important;background:transparent!important;filter:grayscale(1) contrast(1.35) brightness(1.08);mix-blend-mode:multiply;outline:2px solid var(--ib);outline-offset:2px}',
    P + ' div.pl-detail-cover{background:radial-gradient(circle,var(--ia) 0 1.9px,transparent 2.3px) 0 0/4.6px 4.6px,var(--ic)!important;filter:none;mix-blend-mode:normal}',
    P + ' .pl-detail-title{font:900 18px/1.2 var(--hei)!important;color:var(--ib)!important}',
    P + ' .pl-detail-sub{margin-top:4px!important;font:700 10px/1 var(--mono)!important;letter-spacing:.12em;color:var(--ib)!important}',
    P + ' .pl-detail-count{font:400 22px/1 var(--disp)!important;color:var(--ia)!important}',
    P + ' .pl-detail-actions{gap:6px!important;margin:0!important;flex-wrap:wrap}',
    P + ' .pl-detail-play{position:relative;height:30px!important;min-width:0!important;flex:1 1 auto;padding:0 14px!important;border:0!important;border-radius:0!important;background:var(--ia)!important;color:var(--paper)!important;font:900 14px/1 var(--hei)!important;letter-spacing:.14em;translate:var(--ax) var(--ay);transition:transform .15s!important;box-shadow:none!important}',
    P + ' .pl-detail-play::before,' + P + ' .pl-detail-play::after{content:"";position:absolute;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:var(--rp-sheet)}',
    P + ' .pl-detail-play::before{left:-5px}' + P + ' .pl-detail-play::after{right:-5px}',
    P + ' .pl-detail-play:hover{transform:rotate(-1.2deg) scale(1.02)}',
    P + ' .pl-detail-top-btn{height:30px!important;min-width:0!important;padding:0 8px!important;border-radius:0!important;border:1.5px solid var(--ib)!important;background:transparent!important;color:var(--ib)!important;font:700 11px/1 var(--hei)!important;box-shadow:none!important}',
    P + ' .pl-detail-top-btn:hover{background:var(--ic)!important}',
    P + ' .pl-detail-top-btn.danger:hover{background:var(--ia)!important;border-color:var(--ia)!important;color:var(--paper)!important}',
    P + ' .pl-detail-list{gap:6px!important}',
    P + ' .pl-detail-row{position:relative;min-height:50px!important;height:50px;box-sizing:border-box;margin:0!important;padding:0 2px!important;gap:8px!important;border:0!important;border-bottom:1.5px dotted color-mix(in srgb,var(--ib) 60%,transparent)!important;border-radius:0!important;background:none!important;box-shadow:none!important;isolation:isolate}',
    P + ' .pl-detail-row>img,' + P + ' .pl-detail-row>div[style*="width:34px"]{display:none!important}',
    P + ' .pl-detail-row::before{content:"";position:absolute;left:24px;right:0;top:13px;height:24px;background:radial-gradient(circle,var(--ic) 0 1.9px,transparent 2.3px) 0 0/4.4px 4.4px,color-mix(in srgb,var(--ic) 45%,transparent);transform:scaleX(0);transform-origin:0 50%;transition:transform .2s var(--rp-out);z-index:-1;pointer-events:none}',
    P + ' .pl-detail-row:hover::before{transform:scaleX(1)}',
    P + ' .pl-detail-row>div[style*="flex:1"]{display:flex;align-items:baseline;gap:8px}',
    P + ' .pl-detail-row>div[style*="flex:1"]::after{content:"";order:2;flex:1 1 10px;min-width:10px;border-bottom:1.5px dotted var(--ib);opacity:.55;translate:0 -3px}',
    P + ' .pl-detail-row-title{flex:0 1 auto;min-width:0;font:900 14.5px/1.2 var(--hei)!important;color:var(--ib)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .pl-detail-row-artist{order:3;flex:0 1 auto;max-width:40%;min-width:0;margin:0!important;padding:0!important;border:0!important;background:none!important;font:400 13px/1.2 var(--kai)!important;color:var(--ia)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .pl-detail-row-artist:hover{text-decoration:underline wavy var(--ia) 1.5px;text-underline-offset:4px}',
    P + ' .pl-detail-remove{border-radius:0!important;border:1.5px solid var(--ib)!important;background:var(--rp-sheet)!important;color:var(--ib)!important}',
    P + ' .pl-detail-remove:hover{background:var(--ia)!important;border-color:var(--ia)!important;color:var(--paper)!important}',
    P + ' .pl-detail-progress{color:var(--ib)!important;font:700 10px/1 var(--mono)!important;letter-spacing:.14em}',

    // ---------- 广播节目单（我的播客） ----------
    P + ' .pl-card.podcast-card{position:relative;height:66px;box-sizing:border-box;margin:0!important;padding:0 6px 0 0!important;gap:10px!important;border:0!important;border-bottom:1.5px dotted var(--ib)!important;border-radius:0!important;background:none!important;box-shadow:none!important;isolation:isolate}',
    P + ' .pl-card.podcast-card>img,' + P + ' .pl-card.podcast-card>div[style*="width:44px"]{display:none!important}',
    P + ' .rp-fq{flex:none;width:64px;margin-right:4px;text-align:center;font:400 24px/1 var(--disp);color:var(--ia);translate:var(--ax) var(--ay)}',
    P + ' .rp-fq small{display:block;margin-top:2px;font:700 8.5px/1.4 var(--mono);letter-spacing:.14em;color:var(--ib)}',
    P + ' .podcast-card .pl-name{font-size:16.5px!important}',
    P + ' .podcast-card .pl-sub{margin-top:5px!important;font:400 13px/1.2 var(--kai)!important;letter-spacing:.02em;color:var(--ia)!important}',
    P + ' .rp-air{position:absolute;right:4px;top:22px;font:700 10px/1 var(--mono);letter-spacing:.16em;color:var(--paper);background:var(--ia);padding:5px 6px;opacity:0;transform:rotate(4deg) scale(.8);transition:opacity .15s,transform .2s var(--rp-spring);pointer-events:none}',
    P + ' .pl-card.podcast-card:hover .rp-air{opacity:1;transform:rotate(4deg)}',
    P + ' .pl-card.podcast-card:hover .pl-name{text-decoration:underline wavy var(--ic) 2px;text-underline-offset:5px}',

    // ---------- 播放页：纸被一盏台灯照着（背后是深色 3D 舞台） ----------
    STAGE + '{background-image:radial-gradient(120% 70% at 30% 4%,rgba(255,236,200,0) 0,rgba(70,48,20,.07) 50%,rgba(14,16,40,.26) 100%),linear-gradient(90deg,var(--ib) 0 6px,transparent 6px),var(--rp-fiber,none)!important;background-size:auto,auto,300px 300px!important;',
    'box-shadow:0 0 0 1px rgba(255,210,150,.06),0 30px 80px rgba(0,0,0,.62),-10px 0 120px -30px rgba(255,190,110,.26)!important;filter:saturate(.94)}',
    STAGE + ' .playlist-panel-sticky{background-image:radial-gradient(160% 140% at 32% 0%,rgba(255,236,200,0) 0,rgba(60,40,18,.06) 60%,rgba(8,10,28,.16) 100%),linear-gradient(90deg,var(--ib) 0 6px,transparent 6px),var(--rp-fiber,none)!important;background-size:auto,auto,300px 300px!important}',
    STAGE + ' .panel-tab:not(.active){filter:brightness(.8) saturate(.85)}',

    // 减弱动效
    '@media (prefers-reduced-motion:reduce){' + P + ' *,' + P + ' *::before,' + P + ' *::after{animation:none!important;transition-duration:0s!important}}',
  ].join('\n');

  // ---------- 装饰 ----------
  var HEAD_HTML = '<div class="rp-mast" data-skin-deco="1"><span class="rp-kick">NOT BLIND · 节目册</span>' +
    '<span class="rp-h2"><span class="q">今晚曲目单<small>SETLIST</small></span><span class="l">票根夹<small>TICKETS</small></span><span class="p">广播节目单<small>ON AIR</small></span></span>' +
    '<span class="rp-sub"></span></div>';

  function setText(el, s) { if (el && el.textContent !== s) el.textContent = s; }
  function setHTML(el, s) { if (el && el.__rp !== s) { el.__rp = s; el.innerHTML = s; } }

  function updateHead(panel) {
    panel = panel || document.getElementById('playlist-panel');
    if (!panel) return;
    var sub = panel.querySelector('.rp-sub');
    if (!sub) return;
    var tab = '';
    try { tab = typeof queueViewTab === 'string' ? queueViewTab : ''; } catch (_e) { }
    var html;
    if (tab === 'playlists') {
      var pls = playlistsArr(), src = {};
      pls.forEach(function (p) { src[p.provider || 'x'] = 1; });
      html = pls.length ? pls.length + ' 张票根 · ' + Object.keys(src).length + ' 个来源' : '一张票根都还没有';
    } else if (tab === 'podcasts') {
      var pc = podcastsArr();
      html = pc.length ? pc.length + ' 档节目 · 已订阅' : '登录后同步订阅';
    } else {
      var q = queueArr(), ci = curIdx(), tot = 0;
      q.forEach(function (s) { tot += songDur(s); });
      html = q.length ? q.length + ' 首' + (tot ? ' · 约 ' + Math.max(1, Math.round(tot / 60)) + ' 分钟' : '') + (ci >= 0 && ci < q.length ? ' · <em>正在演第 ' + pad2(ci + 1) + ' 首</em>' : '') : '还没有曲目 · 搜索后点「下」排进来';
    }
    setHTML(sub, html);
    // 详情的吸顶要贴在页眉下面
    var sticky = panel.querySelector('.playlist-panel-sticky');
    if (sticky) {
      var h = sticky.offsetHeight;
      if (h && panel.__rpHead !== h) { panel.__rpHead = h; panel.style.setProperty('--rp-head', h + 'px'); }
    }
  }

  function decorateQueue(list) {
    var q = queueArr();
    [].forEach.call(list.querySelectorAll('.queue-item[data-queue-index]'), function (it) {
      var i = Number(it.getAttribute('data-queue-index'));
      var n = it.querySelector(':scope > .rp-n');
      if (!n) { n = document.createElement('span'); n.className = 'rp-n'; n.setAttribute('data-skin-deco', '1'); it.insertBefore(n, it.firstChild); }
      setText(n, pad2(i + 1));
      var d = it.querySelector(':scope > .rp-d');
      var song = q[i], dur = songDur(song);
      if (!d) { d = document.createElement('span'); d.className = 'rp-d'; d.setAttribute('data-skin-deco', '1'); var act = it.querySelector(':scope > .qi-act'); it.insertBefore(d, act || null); }
      setText(d, dur > 0 ? fmt(dur) : '');
    });
  }

  function decoratePlaylists(list) {
    var pls = playlistsArr();
    [].forEach.call(list.querySelectorAll('.pl-section-label'), function (lb) {
      if (lb.hasAttribute('data-rp-en')) return;
      var src = srcFromLabel(lb.textContent);
      lb.setAttribute('data-rp-en', SRC_EN[src] || '');
      lb.style.setProperty('--sw', 'var(--i' + (SRC_INK[src] || 'b') + ')');
    });
    [].forEach.call(list.querySelectorAll('.pl-card[data-playlist-index]'), function (card) {
      var idx = Number(card.getAttribute('data-playlist-index'));
      var pl = pls[idx] || {};
      var id = card.getAttribute('data-playlist-provider') + ':' + card.getAttribute('data-playlist-id');
      if (!card.style.getPropertyValue('--jr')) {
        var h = hash01(id), h2 = hash01(id + 'x');
        card.style.setProperty('--jr', ((h - 0.5) * 1.1).toFixed(2) + 'deg');
        card.style.setProperty('--jx', ((h2 - 0.5) * 4).toFixed(1) + 'px');
      }
      var stub = card.querySelector(':scope > .rp-stub');
      if (!stub) {
        stub = document.createElement('span'); stub.className = 'rp-stub'; stub.setAttribute('data-skin-deco', '1');
        var perf = document.createElement('span'); perf.className = 'rp-perf'; perf.setAttribute('data-skin-deco', '1');
        card.insertBefore(perf, card.firstChild); card.insertBefore(stub, perf);
      }
      var img = card.querySelector(':scope > img');
      var src = img ? img.getAttribute('src') : '';
      var sig = (idx + 1) + '|' + src;
      if (stub.__rp !== sig) {
        stub.__rp = sig;
        stub.classList.toggle('has-img', !!src);
        stub.innerHTML = (src ? '<img alt="" loading="lazy" decoding="async" src="' + src.replace(/"/g, '&quot;') + '" onerror="this.remove();this.parentNode&&this.parentNode.classList.remove(\'has-img\')">' : '') +
          '<small>' + (src ? '<i>Nº</i> ' : 'Nº') + '</small><b>' + pad2(idx + 1) + '</b>';
        if (src) stub.querySelector('small').insertAdjacentText('beforeend', pad2(idx + 1));
      }
      var flagText = pl.subscribed ? '收藏' : (/我喜欢/.test(pl.name || '') ? '♥ 喜欢' : '');
      var flag = card.querySelector(':scope > .rp-flag');
      if (flagText && !flag) { flag = document.createElement('span'); flag.className = 'rp-flag'; flag.setAttribute('data-skin-deco', '1'); card.appendChild(flag); }
      if (flag) { if (flagText) setText(flag, flagText); else flag.remove(); }
    });
    // 展开详情里的曲目行：补序号
    var tracks = detailTracks();
    [].forEach.call(list.querySelectorAll('.pl-detail-row[data-pl-detail-row]'), function (row) {
      var i = Number(row.getAttribute('data-pl-detail-row'));
      var n = row.querySelector(':scope > .rp-n');
      if (!n) { n = document.createElement('span'); n.className = 'rp-n'; n.setAttribute('data-skin-deco', '1'); row.insertBefore(n, row.firstChild); }
      setText(n, pad2(i + 1));
      var d = row.querySelector(':scope > .rp-d');
      var t = tracks[i], dur = songDur(t);
      if (dur > 0) {
        if (!d) { d = document.createElement('span'); d.className = 'rp-d'; d.setAttribute('data-skin-deco', '1'); var rm = row.querySelector(':scope > .pl-detail-remove'); row.insertBefore(d, rm || null); }
        setText(d, fmt(dur));
      }
    });
  }

  function decorateDetailHead(list) {
    var head = list.querySelector('.pl-detail-head');
    if (!head || head.querySelector(':scope > .rp-dcov')) return;
    if (!head.querySelector(':scope > img.pl-detail-cover')) return;
    var d = document.createElement('span'); d.className = 'rp-dcov'; d.setAttribute('data-skin-deco', '1');
    head.insertBefore(d, head.firstChild);
  }

  var FQ = ['88.1', '93.6', '101.7', '104.3', '97.4', '106.9'];
  function decoratePodcasts(list) {
    [].forEach.call(list.querySelectorAll('.pl-card.podcast-card'), function (card, i) {
      var fq = card.querySelector(':scope > .rp-fq');
      if (!fq) {
        fq = document.createElement('span'); fq.className = 'rp-fq'; fq.setAttribute('data-skin-deco', '1');
        card.insertBefore(fq, card.firstChild);
        var air = document.createElement('span'); air.className = 'rp-air'; air.setAttribute('data-skin-deco', '1'); air.textContent = 'ON AIR ▶';
        card.appendChild(air);
      }
      var k = (typeof panelSkinHash === 'function' ? panelSkinHash(card.getAttribute('data-podcast-key') || String(i)) : i) % FQ.length;
      setHTML(fq, FQ[k] + '<small>FM · CH' + pad2(i + 1) + '</small>');
    });
  }

  // 墨色跟着海报走：海报换一套墨（悬停节目单时会重新套印），歌单栏也跟着换
  var INK_KEYS = ['--ia', '--ib', '--ic', '--paper'];
  function syncInks(panel) {
    panel = panel || document.getElementById('playlist-panel');
    var root = document.querySelector('.hth-riso-poster');
    if (!panel) return;
    var sig = '';
    var vals = INK_KEYS.map(function (k) { var v = root ? root.style.getPropertyValue(k).trim() : ''; sig += v + '|'; return v; });
    if (panel.__rpInk === sig) return;
    panel.__rpInk = sig;
    INK_KEYS.forEach(function (k, i) { if (vals[i]) panel.style.setProperty(k, vals[i]); else panel.style.removeProperty(k); });
  }

  registerPanelSkin({
    id: ID,
    css: css,
    virtual: { queueRowStep: ROW },
    attach: function (panel) {
      if (!panel) return;
      try { var t = makeTextures(); panel.style.setProperty('--rp-fiber', t.fiber); panel.style.setProperty('--rp-grain', t.grain); } catch (e) { console.warn('[PanelSkin riso]', e); }
      syncInks(panel);
    },
    detach: function (panel) {
      if (!panel) return;
      ['--rp-fiber', '--rp-grain', '--rp-head'].concat(INK_KEYS).forEach(function (k) { panel.style.removeProperty(k); });
      panel.__rpInk = null; panel.__rpHead = 0;
      [].forEach.call(panel.querySelectorAll('[data-skin-deco]'), function (n) { n.remove(); });
      [].forEach.call(panel.querySelectorAll('.pl-card[data-playlist-index]'), function (c) { c.style.removeProperty('--jr'); c.style.removeProperty('--jx'); });
      [].forEach.call(panel.querySelectorAll('.pl-section-label[data-rp-en]'), function (l) { l.removeAttribute('data-rp-en'); l.style.removeProperty('--sw'); });
    },
    decorate: function (kind, el, panel) {
      if (kind === 'head') {
        var box = el.querySelector('.queue-head > div:first-child');
        if (box && !box.querySelector('.rp-mast')) box.insertAdjacentHTML('beforeend', HEAD_HTML);
      } else if (kind === 'queue') decorateQueue(el);
      else if (kind === 'playlists') { decoratePlaylists(el); decorateDetailHead(el); }
      else if (kind === 'podcasts') decoratePodcasts(el);
      updateHead(panel);
    },
    tick: function (panel) { syncInks(panel); updateHead(panel); },
  });
})();
