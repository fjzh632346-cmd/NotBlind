// ============================================================
// 歌单栏皮肤 · 星图（star-atlas）· 星表
// 左侧歌单栏变成一页"星表"：没有卡片、没有毛玻璃，只有一根赤纬刻度线，
// 每一行是刻度线上的一颗星——星的亮度 = 首数（歌单）/ 离现在多近（队列），颜色按名字固定。
// - 队列：正在播放的那首在「中天」，后面的歌标出「还有多久升起」（正在播放时写成钟点），已播过的沉在地平线下（变暗）
// - 歌单：按来源分成「三垣」：紫微垣 = 内置，太微垣 = 网易云，天市垣 = QQ 音乐（其它平台用星宿名）
// - 展开歌单：封面换成"目镜视场"（按歌单 id 生成的一小片天），曲目连成一条竖直的星链
// - 播客：射电源
// 只改外观 + 插入带 data-skin-deco 的装饰节点；原来的点击、长按拖动排序、虚拟列表都不动。
// ============================================================
(function () {
  'use strict';
  if (typeof registerPanelSkin !== 'function') return;

  var ID = 'star-atlas';
  var B = 'body[data-panel-skin="star-atlas"]';
  var PN = B + ' #playlist-panel';
  var ROW = 40;                        // 队列每行（= 虚拟列表步长）
  var SERIF = '"Source Han Serif SC","Noto Serif SC","Noto Serif CJK SC","Songti SC","STSong","SimSun","宋体",serif';
  var SANS = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  var THIN = '"Segoe UI Light","Segoe UI","Microsoft YaHei UI Light","Microsoft YaHei UI","Noto Sans CJK SC",sans-serif';
  var MONO = '"Cascadia Mono","Consolas","SFMono-Regular","Menlo","DejaVu Sans Mono",monospace';
  // 三垣 + 几个星宿：平台 → [星区名, 说明]
  var SEC = {
    mineradio: ['紫微垣', 'Not Blind 内置'], netease: ['太微垣', '网易云音乐'], qq: ['天市垣', 'QQ 音乐'],
    kugou: ['角 宿', '酷狗音乐'], qishui: ['斗 宿', '汽水音乐'], spotify: ['奎 宿', 'Spotify']
  };
  var SC = ['255,238,215', '255,226,196', '214,226,255', '255,246,236', '232,236,255'];

  // ---------- 样式 ----------
  var css = [
    // 整个栏：去掉卡片和毛玻璃，只留一根刻度线（背景第一层）、刻度（第二、三层，随滚动移动）、顶端的天极（第四层）
    PN + '{--sx-iv:236,230,216;--sx-gold:201,168,106;--sx-tk:0px;--sx-spring:cubic-bezier(.3,1.32,.5,1);--sx-out:cubic-bezier(.2,.75,.2,1);' +
      'left:0!important;box-sizing:border-box;width:calc(clamp(282px,19vw,352px) + 28px)!important;padding:0 10px 30px 28px!important;border-radius:0!important;border:0!important;box-shadow:none!important;' +
      'backdrop-filter:none!important;-webkit-backdrop-filter:none!important;color:rgb(var(--sx-iv));font-family:' + SERIF + ';scrollbar-width:none;' +
      'background:' +
      'radial-gradient(circle at 44.5px 7px,rgba(236,222,190,.95) 0 .9px,rgba(0,0,0,0) 1.4px 2.8px,rgba(var(--sx-gold),.75) 3.1px 3.9px,rgba(0,0,0,0) 4.4px) 0 0/62px 16px no-repeat,' +
      'linear-gradient(rgba(var(--sx-iv),.34),rgba(var(--sx-iv),.2) 70%,rgba(var(--sx-iv),.05)) 44px 13px/1px calc(100% - 13px) no-repeat,' +
      'repeating-linear-gradient(rgba(var(--sx-iv),.16) 0 1px,rgba(0,0,0,0) 1px 12px) 40.5px calc(24px + var(--sx-tk)) / 3.5px calc(100% - 24px) no-repeat,' +
      'repeating-linear-gradient(rgba(var(--sx-iv),.2) 0 1px,rgba(0,0,0,0) 1px 60px) 37px calc(24px + var(--sx-tk)) / 7px calc(100% - 24px) no-repeat!important;' +
      '-webkit-mask:linear-gradient(#000 calc(100% - 34px),rgba(0,0,0,0));mask:linear-gradient(#000 calc(100% - 34px),rgba(0,0,0,0))}',
    PN + '::-webkit-scrollbar{width:0!important;display:none}',
    PN + '.pinned{border:0!important;box-shadow:none!important}',
    PN + ' *{font-family:inherit}',
    PN + ' button{font-family:inherit}',
    PN + ' :focus-visible{outline:1px dashed rgba(var(--sx-gold),.6)!important;outline-offset:3px;border-radius:1px}',
    // 栏后面那片"夜色"：不是卡片，是从左边缘向右淡出去的一层暗（装饰节点，放在栏的后面）
    B + ' .sx-pveil{position:fixed;left:0;top:0;bottom:0;width:calc(clamp(282px,19vw,352px) + 328px);z-index:16;pointer-events:none;opacity:0;transition:opacity .45s var(--sx-out,ease);' +
      'background:linear-gradient(90deg,rgba(1,2,6,.88),rgba(1,2,6,.8) 38%,rgba(1,2,6,.42) 70%,rgba(1,2,6,0));-webkit-mask:linear-gradient(rgba(0,0,0,0) 70px,#000 210px);mask:linear-gradient(rgba(0,0,0,0) 70px,#000 210px)}',
    B + ' #playlist-panel.show:not(.playlist-panel-closing)~.sx-pveil,' + B + ' #playlist-panel.peek:not(.playlist-panel-closing)~.sx-pveil{opacity:1}',
    // 钉住时它是常驻的：夜色收窄，只在栏后面，不去压主页上的字
    B + ' #playlist-panel.pinned~.sx-pveil{width:calc(clamp(282px,19vw,352px) + 116px);background:linear-gradient(90deg,rgba(1,2,6,.84),rgba(1,2,6,.74) calc(100% - 120px),rgba(1,2,6,0))}',
    B + '[data-hth-page="stage"] .sx-pveil{background:linear-gradient(90deg,rgba(2,3,8,.9),rgba(2,3,8,.8) 42%,rgba(2,3,8,.45) 74%,rgba(2,3,8,0));-webkit-mask:linear-gradient(rgba(0,0,0,0) 20px,#000 120px);mask:linear-gradient(rgba(0,0,0,0) 20px,#000 120px)}',

    // ---------- 顶部：星 表 Catalogue · 钉住 / 三个分页 ----------
    PN + ' .playlist-panel-sticky{position:sticky;top:0!important;z-index:9;isolation:isolate;margin:0 0 0 -28px!important;padding:0 0 10px 62px!important;height:80px;box-sizing:border-box;border:0!important;border-radius:0!important;box-shadow:none!important;' +
      'background:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    // 顶部要盖住滚上来的行，但不能是一块有边的黑板：向右、向下都淡出去
    PN + ' .playlist-panel-sticky::before,' + PN + ' .queue-toolbar::after{content:"";position:absolute;left:0;top:0;right:-10px;bottom:0;z-index:-1;pointer-events:none;background:linear-gradient(90deg,rgba(1,2,6,.86),rgba(1,2,6,.82) 62%,rgba(1,2,6,0));' +
      '-webkit-mask:linear-gradient(#000 72%,rgba(0,0,0,0));mask:linear-gradient(#000 72%,rgba(0,0,0,0))}',
    PN + ' .queue-toolbar::after{top:-2px}',
    PN + ' .playlist-panel-sticky::after{display:none!important}',
    PN + ' .queue-head{display:flex;align-items:center;margin:0!important;height:22px;padding-top:0}',
    PN + ' .queue-head>div:first-child{flex:1;min-width:0}',
    PN + ' .queue-head .fx-title,' + PN + ' .queue-head .fx-sub{display:none!important}',
    PN + ' .sx-kick{display:flex;align-items:baseline;gap:12px;white-space:nowrap;line-height:1}',
    PN + ' .sx-kick span{font:400 11px/1 ' + SERIF + ';letter-spacing:.5em;color:rgba(var(--sx-gold),.75)}',
    PN + ' .sx-kick em{font:italic 400 10px/1 Georgia,"Times New Roman","DejaVu Serif",serif;letter-spacing:.26em;color:rgba(var(--sx-iv),.24)}',
    PN + ' .queue-head-act{gap:2px!important}',
    PN + ' .queue-head-act .fx-mini-btn{height:22px!important;min-width:0!important;width:auto!important;padding:0 5px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;' +
      'font:400 10.5px/1 ' + SANS + '!important;letter-spacing:.18em;color:rgba(var(--sx-iv),.32)!important;transition:color .3s}',
    PN + ' .queue-head-act .fx-mini-btn:hover{color:rgba(var(--sx-iv),.85)!important;background:none!important}',
    PN + ' .playlist-pin-btn svg{display:none}',
    PN + ' .playlist-pin-btn::before{content:"";display:inline-block;width:5px;height:5px;margin-right:6px;border-radius:50%;border:1px solid currentColor;vertical-align:1px}',
    PN + ' .playlist-pin-btn::after{content:"钉住"}',
    PN + ' .playlist-pin-btn.active{color:rgb(var(--sx-gold))!important}',
    PN + ' .playlist-pin-btn.active::before{background:currentColor;box-shadow:0 0 6px rgba(var(--sx-gold),.8)}',
    PN + ' .playlist-pin-btn.active::after{content:"已钉住"}',
    PN + ' .panel-tabs{position:relative;display:flex;gap:22px!important;margin:16px 0 0!important;height:30px;align-items:flex-start}',
    PN + ' .panel-tab{position:relative;padding:2px 0 10px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;font-size:0!important;color:rgba(var(--sx-iv),.34)!important;transition:color .3s!important}',
    PN + ' .panel-tab::after{font:400 15px/1 ' + SERIF + ';letter-spacing:.2em}',
    PN + ' #tab-queue::after{content:"队列"}',
    PN + ' #tab-pl::after{content:"歌单"}',
    PN + ' #tab-podcast::after{content:"播客"}',
    PN + ' .panel-tab:hover{color:rgba(var(--sx-iv),.72)!important}',
    PN + ' .panel-tab.active{color:rgb(var(--sx-iv))!important}',
    PN + ' .sx-tabm{position:absolute;left:0;bottom:2px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:#fff;pointer-events:none;box-shadow:0 0 5px 1px rgba(255,240,215,.8),0 0 12px 3px rgba(var(--sx-gold),.3);transition:transform .5s var(--sx-spring)}',

    // ---------- 每一页顶上的一行：星区名 + 说明 + 工具（工具平时很淡，靠近才亮） ----------
    PN + ' .queue-toolbar{position:sticky;top:80px!important;z-index:7;height:30px;box-sizing:border-box;margin:0 0 4px -28px!important;padding:0 2px 0 62px!important;border:0!important;border-radius:0!important;box-shadow:none!important;' +
      'background:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;justify-content:flex-start!important;gap:10px!important;white-space:nowrap;isolation:isolate}',
    PN + ' .queue-toolbar::before{content:"";position:absolute;left:34px;top:50%;width:22px;border-top:1px dashed rgba(var(--sx-gold),.34)}',
    PN + ' .sx-cn{flex:none;font:400 11px/1 ' + SERIF + ';letter-spacing:.42em;color:rgba(var(--sx-gold),.75)}',
    PN + ' .queue-chip{height:auto!important;padding:0!important;border:0!important;border-radius:0!important;background:none!important;font:400 10.5px/1 ' + SANS + '!important;letter-spacing:.12em;color:rgba(var(--sx-iv),.3)!important;min-width:0;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}',
    PN + ' #pl-pane .queue-chip,' + PN + ' #podcast-pane .queue-chip{display:none!important}',
    PN + ' .queue-toolbar>div:last-child,' + PN + ' .queue-toolbar>button:last-child{margin-left:auto;display:flex;gap:0!important;flex:none}',
    PN + ' .queue-toolbar .fx-mini-btn{height:24px!important;padding:0 5px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;font:400 10.5px/1 ' + SANS + '!important;letter-spacing:.12em;color:rgba(var(--sx-iv),.3)!important;transition:color .25s}',
    PN + ':hover .queue-toolbar .fx-mini-btn,' + PN + ' .queue-toolbar:focus-within .fx-mini-btn{color:rgba(var(--sx-iv),.5)!important}',
    PN + ' .queue-toolbar .fx-mini-btn:hover{color:#fff!important}',

    // ---------- 队列：一行一颗星 ----------
    PN + ' .queue-list{gap:0!important;margin-top:0!important}',
    PN + ' .queue-item{position:relative;height:' + ROW + 'px;box-sizing:border-box;gap:10px!important;padding:0 2px 0 34px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;transition:opacity .3s,transform .32s var(--sx-spring)!important}',
    PN + ' .queue-item>img,' + PN + ' .queue-item>div:not(.qi-info):not(.qi-act){display:none!important}',
    PN + ' .queue-item::before,' + PN + ' .pl-card::before,' + PN + ' .pl-detail-row::before{content:"";position:absolute;left:16.5px;top:50%;width:calc(2px + 3px * var(--m,.4));height:calc(2px + 3px * var(--m,.4));transform:translate(-50%,-50%);border-radius:50%;background:rgb(255,250,242);pointer-events:none;' +
      'box-shadow:0 0 calc(2px + 4px * var(--m,.4)) calc(1px * var(--m,.4)) rgba(var(--sc,255,238,215),.55),0 0 calc(8px + 10px * var(--m,.4)) 1px rgba(var(--sc,255,238,215),calc(.08 + .14 * var(--m,.4)));opacity:calc(.45 + .55 * var(--m,.4));transition:transform .4s var(--sx-spring),opacity .3s}',
    PN + ' .qi-info{display:flex;align-items:baseline;gap:.8em;min-width:0}',
    PN + ' .qi-name{flex:0 1 auto;min-width:0;font:400 14.5px/1.3 ' + SERIF + '!important;letter-spacing:.1em;color:rgba(var(--sx-iv),.8)!important;transition:color .25s}',
    PN + ' .qi-sub{flex:0 10000 auto;min-width:2em;font-size:0!important}',
    PN + ' .queue-artist-link{font:400 11px/1 ' + SANS + '!important;letter-spacing:.06em;color:rgba(var(--sx-iv),.32)!important}',
    PN + ' .queue-artist-link:hover{color:rgba(var(--sx-iv),.8)!important}',
    PN + ' .sx-rise{flex:none;margin-left:auto;font:300 11px/1 ' + THIN + ';letter-spacing:.08em;color:rgba(var(--sx-iv),.34);font-variant-numeric:tabular-nums;white-space:nowrap;max-width:80px;overflow:hidden;transition:max-width .3s var(--sx-out),opacity .2s}',
    PN + ' .qi-act{flex:none;display:flex;gap:0!important;max-width:0;overflow:hidden;opacity:0!important;transform:translateX(6px);transition:max-width .35s var(--sx-out),opacity .2s,transform .4s var(--sx-spring)!important}',
    PN + ' .queue-item:hover .qi-act,' + PN + ' .queue-item:focus-within .qi-act{max-width:120px;opacity:1!important;transform:none}',
    PN + ' .queue-item:hover .sx-rise,' + PN + ' .queue-item:focus-within .sx-rise{max-width:0;opacity:0}',
    PN + ' .qi-act button{width:24px!important;height:24px!important;display:grid;place-items:center;padding:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;color:rgba(var(--sx-iv),.45)!important;font:400 12px/1 ' + SERIF + '!important}',
    PN + ' .qi-act button svg{width:13px!important;height:13px!important}',
    PN + ' .qi-act button:hover{color:#fff!important;background:none!important}',
    PN + ' .qi-act button.liked{color:rgb(222,150,140)!important}',
    PN + ' .queue-item:hover .qi-name,' + PN + ' .queue-item:focus-visible .qi-name{color:#fff!important}',
    PN + ' .queue-item:hover::before{transform:translate(-50%,-50%) scale(1.7);opacity:1}',
    // 已经播过的：沉到地平线下
    PN + ' .queue-item.sx-set .qi-name{color:rgba(var(--sx-iv),.42)!important}',
    PN + ' .queue-item.sx-set::before{opacity:.28}',
    PN + ' .queue-item.sx-set .sx-rise{color:rgba(var(--sx-iv),.2)}',
    // 正在播放：中天
    PN + ' .queue-item.now::before{width:6px;height:6px;opacity:1;box-shadow:0 0 6px 2px rgba(255,246,228,.85),0 0 20px 6px rgba(var(--sx-gold),.28),0 0 42px 10px rgba(190,205,255,.1)}',
    PN + ' .queue-item.now .qi-name{color:#fff!important;font-size:15.5px!important}',
    PN + ' .queue-item.now .sx-rise{color:rgba(var(--sx-gold),.85);letter-spacing:.3em}',
    PN + ' .queue-item.now .queue-artist-link{color:rgba(var(--sx-iv),.5)!important}',
    // 长按拖动：星先变大（按住的反馈），拖起来以后名字亮起
    PN + ' .queue-item.reorder-pressing::before,' + PN + ' .pl-card.reorder-pressing::before{transform:translate(-50%,-50%) scale(2.2);opacity:1;transition:transform .9s ease-out}',
    B + '.panel-reordering #playlist-panel .queue-item.is-reordering,' + B + '.panel-reordering #playlist-panel .pl-card.is-reordering{background:linear-gradient(90deg,rgba(var(--sx-gold),.12),rgba(var(--sx-gold),0) 80%)!important;box-shadow:none!important;border:0!important;outline:0!important}',
    B + '.panel-reordering #playlist-panel .is-reordering .qi-name,' + B + '.panel-reordering #playlist-panel .is-reordering .pl-name{color:#fff!important}',
    PN + ' .queue-hydration-status,' + PN + ' .playlist-catalog-status{justify-content:flex-start!important;padding-left:34px!important;font:400 10.5px/1.4 ' + SANS + ';letter-spacing:.1em;color:rgba(var(--sx-iv),.34)!important}',
    PN + ' #queue-list>div:not(.queue-item):not(.queue-virtual-spacer):not(.queue-hydration-status),' + PN + ' #pl-list>div[style]:not(.playlist-virtual-spacer):not(.pl-inline-detail),' + PN + ' #podcast-list>div[style]{text-align:left!important;padding:12px 8px 0 34px!important;font:400 13px/2 ' + SERIF + '!important;letter-spacing:.12em;color:rgba(var(--sx-iv),.5)!important}',

    // ---------- 歌单：三垣分组 ----------
    PN + ' #pl-list{margin-top:0!important}',
    PN + ' .pl-section-label{position:relative;display:flex;align-items:center;gap:10px;height:31px;box-sizing:border-box;margin:0!important;padding:4px 0 0 34px!important;font-size:0!important;white-space:nowrap;text-shadow:none!important}',
    PN + ' .pl-section-label::before{content:"";position:absolute;left:6px;top:calc(50% + 2px);width:22px;border-top:1px dashed rgba(var(--sx-gold),.34)}',
    PN + ' .sx-lb{font:400 10.5px/1 ' + SANS + ';letter-spacing:.14em;color:rgba(var(--sx-iv),.3);text-transform:none;overflow:hidden;text-overflow:ellipsis}',
    PN + ' .sx-sc{margin-left:auto;padding-right:4px;font:300 10.5px/1 ' + THIN + ';letter-spacing:.1em;color:rgba(var(--sx-iv),.22)}',
    PN + ' .pl-card{position:relative;height:69px;box-sizing:border-box;gap:10px!important;margin:0!important;padding:0 4px 0 34px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;transition:background .3s!important}',
    PN + ' .pl-card>img,' + PN + ' .pl-card>.pl-built-in-placeholder,' + PN + ' .pl-card>div[style*="width:44px"]{display:none!important}',
    PN + ' .sx-no{flex:none;width:2.1em;font:300 10.5px/1 ' + MONO + ';letter-spacing:.04em;color:rgba(var(--sx-gold),.46);align-self:center;margin-top:-17px}',
    PN + ' .pl-name{font:400 14.5px/1.3 ' + SERIF + '!important;letter-spacing:.1em;color:rgba(var(--sx-iv),.8)!important;transition:color .25s}',
    PN + ' .pl-name .tag-source{display:none!important}',
    PN + ' .pl-sub{margin-top:6px!important;font:400 10.5px/1.2 ' + SANS + '!important;letter-spacing:.1em;color:rgba(var(--sx-iv),.3)!important}',
    PN + ' .sx-mag{flex:none;align-self:center;margin-top:-17px;font:300 11px/1 ' + THIN + ';letter-spacing:.08em;color:rgba(var(--sx-iv),.34);font-variant-numeric:tabular-nums;white-space:nowrap}',
    PN + ' .pl-card:hover .pl-name,' + PN + ' .pl-card:focus-visible .pl-name{color:#fff!important}',
    PN + ' .pl-card:hover::before{transform:translate(-50%,-50%) scale(1.7);opacity:1}',
    PN + ' .pl-card.expanded{background:linear-gradient(90deg,rgba(var(--sx-gold),.07),rgba(var(--sx-gold),0) 75%)!important}',
    PN + ' .pl-card.expanded .pl-name{color:#fff!important}',
    PN + ' .pl-card.expanded::before{opacity:1;transform:translate(-50%,-50%) scale(1.5)}',
    PN + ' .pl-card.expanded .sx-no{color:rgb(var(--sx-gold))}',

    // ---------- 展开的歌单：目镜视场 + 一条竖直的星链 ----------
    PN + ' .pl-inline-detail{margin:0!important;padding:0 0 12px!important;min-height:0!important;background:none!important;border:0!important;box-shadow:none!important;border-radius:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    PN + ' .pl-detail-sticky{position:relative!important;top:auto!important;margin:0 0 4px!important;padding:10px 0 10px 34px!important;border-radius:0!important;background:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    PN + ' .pl-detail-head{gap:14px!important;margin:0!important;padding:0 0 0!important;border:0!important}',
    PN + ' .pl-detail-cover{display:none!important}',
    PN + ' .sx-eye{flex:none;width:52px;height:52px;border-radius:50%;box-shadow:0 0 0 1px rgba(var(--sx-iv),.12),0 0 24px rgba(0,0,0,.8)}',
    PN + ' .pl-detail-head>div{min-width:0}',
    PN + ' .pl-detail-title{font:300 19px/1.3 ' + SERIF + '!important;letter-spacing:.12em;color:#fff!important}',
    PN + ' .pl-detail-sub{margin-top:4px!important;font:400 10.5px/1.5 ' + SANS + '!important;letter-spacing:.12em;color:rgba(var(--sx-iv),.38)!important}',
    PN + ' .pl-detail-count{display:none!important}',
    PN + ' .pl-detail-actions{flex-wrap:wrap;gap:2px!important;margin:12px 0 0!important}',
    PN + ' .pl-detail-play{position:relative;height:26px!important;min-width:0!important;margin-right:10px;padding:0 0 0 16px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;font:400 13px/1 ' + SERIF + '!important;letter-spacing:.16em;color:rgba(var(--sx-iv),.88)!important;transition:color .25s}',
    PN + ' .pl-detail-play svg{display:none}',
    PN + ' .pl-detail-play::before{content:"";position:absolute;left:1px;top:50%;width:4px;height:4px;margin-top:-2px;border-radius:50%;background:rgba(var(--sx-gold),.95);box-shadow:0 0 6px rgba(var(--sx-gold),.7)}',
    PN + ' .pl-detail-play:hover{color:#fff!important}',
    PN + ' .pl-detail-top-btn{height:26px!important;min-width:0!important;padding:0 5px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;font:400 10.5px/1 ' + SANS + '!important;letter-spacing:.12em;color:rgba(var(--sx-iv),.4)!important}',
    PN + ' .pl-detail-top-btn:hover{color:#fff!important}',
    PN + ' .pl-detail-top-btn.danger:hover{color:rgb(222,150,140)!important}',
    PN + ' .pl-detail-list{gap:0!important;overflow:hidden!important;background:none!important}',
    PN + ' .pl-detail-row{position:relative;height:56px;min-height:0!important;margin:0!important;box-sizing:border-box;gap:10px!important;padding:0 2px 0 34px!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important}',
    PN + ' .pl-detail-row>img,' + PN + ' .pl-detail-row>div[style*="width:34px"]{display:none!important}',
    PN + ' .pl-detail-row .sx-no{margin-top:-15px;color:rgba(var(--sx-gold),.36)}',
    PN + ' .pl-detail-row-title{font:400 14px/1.3 ' + SERIF + '!important;letter-spacing:.1em;color:rgba(var(--sx-iv),.8)!important;transition:color .25s}',
    PN + ' .pl-detail-row-artist{margin-top:4px!important;font:400 10.5px/1.2 ' + SANS + '!important;letter-spacing:.08em;color:rgba(var(--sx-iv),.32)!important}',
    PN + ' .pl-detail-row-artist:hover{color:rgba(var(--sx-iv),.8)!important}',
    PN + ' .pl-detail-row:hover .pl-detail-row-title{color:#fff!important}',
    PN + ' .pl-detail-row:hover::before{transform:translate(-50%,-50%) scale(1.7);opacity:1}',
    PN + ' .pl-detail-row.sx-playing .pl-detail-row-title{color:#fff!important}',
    PN + ' .pl-detail-row.sx-playing::before{width:6px;height:6px;opacity:1;box-shadow:0 0 6px 2px rgba(255,246,228,.85),0 0 18px 5px rgba(var(--sx-gold),.3)}',
    PN + ' .pl-detail-remove{width:22px!important;height:22px!important;border:0!important;background:none!important;color:rgba(var(--sx-iv),.3)!important;opacity:0;transition:opacity .2s,color .2s}',
    PN + ' .pl-detail-row:hover .pl-detail-remove{opacity:1}',
    PN + ' .pl-detail-remove:hover{color:rgb(222,150,140)!important}',
    PN + ' .pl-detail-progress,' + PN + ' .pl-detail-loading-row{justify-content:flex-start!important;padding-left:34px!important;font:400 10.5px/1.4 ' + SANS + '!important;letter-spacing:.1em;color:rgba(var(--sx-iv),.3)!important}',

    // ---------- 播客：射电源 ----------
    PN + ' .pl-card.podcast-card{height:52px;background:none!important;border:0!important}',
    PN + ' .pl-card.podcast-card::before{width:4px;height:4px;opacity:1;background:rgba(200,220,255,.85);box-shadow:0 0 6px 1px rgba(170,200,255,.5)}',
    PN + ' .pl-card.podcast-card::after{content:"";position:absolute;left:10.5px;top:50%;width:12px;height:12px;margin-top:-7px;border-radius:50%;border:1px solid rgba(170,200,255,.28);border-left-color:transparent;border-right-color:transparent;pointer-events:none}',
    PN + ' .pl-card.podcast-card:hover::after{animation:sxp-pulse 1.8s ease-out}',
    '@keyframes sxp-pulse{from{transform:scale(.6);opacity:1}to{transform:scale(2.2);opacity:0}}',
    PN + ' .pl-card.podcast-card .sx-no{margin-top:-15px}',

    // ---------- 空的时候：一句邀请 ----------
    PN + ' .sx-inv{padding:10px 8px 6px 34px;font:400 14px/2 ' + SERIF + ';letter-spacing:.12em;color:rgba(var(--sx-iv),.62)}',
    PN + ' .sx-inv small{display:block;margin-top:6px;font:400 11px/1.9 ' + SANS + ';letter-spacing:.08em;color:rgba(var(--sx-iv),.34)}',
    PN + ' .sx-inv .bt{display:flex;flex-direction:column;align-items:flex-start;gap:4px;margin-top:14px}',
    PN + ' .sx-lk{position:relative;padding:5px 0 5px 16px;border:0;background:none;cursor:pointer;font:400 13px/1.2 ' + SERIF + ';letter-spacing:.16em;color:rgba(var(--sx-iv),.85);transition:color .25s}',
    PN + ' .sx-lk::before{content:"";position:absolute;left:1px;top:50%;width:4px;height:4px;margin-top:-2px;border-radius:50%;background:rgba(var(--sx-gold),.9);box-shadow:0 0 6px rgba(var(--sx-gold),.7)}',
    PN + ' .sx-lk.sec{color:rgba(var(--sx-iv),.5)}',
    PN + ' .sx-lk.sec::before{background:rgba(var(--sx-iv),.4);box-shadow:none}',
    PN + ' .sx-lk:hover{color:#fff}',
    PN + ' .sx-inv~div[style]{display:none!important}',

    // ---------- 播放页上：同一张星表，稍微收敛 ----------
    B + '[data-hth-page="stage"] #playlist-panel .playlist-panel-sticky::before,' + B + '[data-hth-page="stage"] #playlist-panel .queue-toolbar::after{background:linear-gradient(90deg,rgba(2,3,8,.92),rgba(2,3,8,.88) 62%,rgba(2,3,8,0))}',
    // 播放页底部有播放条：栏在它上面收住
    B + '[data-hth-page="stage"] #playlist-panel{max-height:calc(100vh - 78px - 140px)!important}',
    B + '[data-hth-page="stage"] #playlist-panel .qi-name,' + B + '[data-hth-page="stage"] #playlist-panel .pl-name{text-shadow:0 0 12px rgba(0,0,0,.9)}',
    '@media (prefers-reduced-motion:reduce){' + PN + ' *,' + PN + ' *::before,' + PN + ' *::after{transition-duration:.01s!important;animation:none!important}}'
  ].join('\n');

  // ---------- 小工具 ----------
  function hash(s) { return typeof panelSkinHash === 'function' ? panelSkinHash(s) : 0; }
  function rng(seed) {
    var a = seed >>> 0 || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmt(sec) { sec = Math.max(0, Math.floor(Number(sec) || 0)); var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); }
  function hhmm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function deco(tag, cls, html) { var el = document.createElement(tag); el.className = cls; el.setAttribute('data-skin-deco', ''); if (html != null) el.innerHTML = html; return el; }
  function starVars(el, key, m) {
    var sc = SC[hash(key) % SC.length], mv = m.toFixed(2);
    if (el.__sxM !== mv) { el.style.setProperty('--m', mv); el.__sxM = mv; }
    if (el.__sxC !== sc) { el.style.setProperty('--sc', sc); el.__sxC = sc; }
  }
  function songDur(s) {
    try { if (typeof playbackDurationFromSong === 'function') return playbackDurationFromSong(s) || 0; } catch (_e) { }
    var d = Number(s && (s.duration || s.durationMs || s.dt)) || 0; return d > 1000 ? d / 1000 : d;
  }
  function g(name) { try { return window[name]; } catch (_e) { return undefined; } }

  // 目镜视场：歌单的"封面"是从目镜里看到的它那一小片天（按 id 生成，缓存）
  var eyeCache = {};
  function eyepiece(key) {
    if (eyeCache[key]) return eyeCache[key];
    var N = 112, c = document.createElement('canvas'); c.width = c.height = N;
    var x = c.getContext('2d'); if (!x) return '';
    var r = rng(hash(key) ^ 0x9e37), R = N / 2, i;
    x.save(); x.beginPath(); x.arc(R, R, R - 1, 0, 7); x.clip();
    var bg = x.createRadialGradient(R * 0.9, R * 0.85, 2, R, R, R); bg.addColorStop(0, '#0d1120'); bg.addColorStop(1, '#020309'); x.fillStyle = bg; x.fillRect(0, 0, N, N);
    var ang = r() * 3.14;
    for (i = 0; i < 16; i++) { var t = (r() - 0.5) * 1.6, px = R + Math.cos(ang) * t * R + (r() - 0.5) * 14, py = R + Math.sin(ang) * t * R + (r() - 0.5) * 14, rad = 10 + r() * 22, gg = x.createRadialGradient(px, py, 0, px, py, rad); gg.addColorStop(0, r() < 0.5 ? 'rgba(200,185,160,.07)' : 'rgba(160,175,220,.06)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
    for (i = 0; i < 70; i++) {
      var sx = r() * N, sy = r() * N, m = Math.pow(r(), 4.5), cc = r() < 0.5 ? '255,236,210' : '215,226,255';
      x.fillStyle = 'rgba(' + cc + ',' + (0.3 + 0.7 * m).toFixed(2) + ')'; x.beginPath(); x.arc(sx, sy, 0.45 + 1.5 * m, 0, 7); x.fill();
      if (m > 0.35) { var hg = x.createRadialGradient(sx, sy, 0, sx, sy, 4 + 8 * m); hg.addColorStop(0, 'rgba(' + cc + ',' + (0.25 * m).toFixed(2) + ')'); hg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = hg; x.fillRect(sx - 12, sy - 12, 24, 24); }
    }
    x.restore();
    var vg = x.createRadialGradient(R, R, R * 0.6, R, R, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = vg; x.beginPath(); x.arc(R, R, R - 1, 0, 7); x.fill();
    x.strokeStyle = 'rgba(236,230,216,.22)'; x.lineWidth = 1.2; x.beginPath(); x.arc(R, R, R - 1.2, 0, 7); x.stroke();
    try { eyeCache[key] = c.toDataURL('image/png'); } catch (_e) { eyeCache[key] = ''; }
    return eyeCache[key];
  }

  // ---------- 顶部 ----------
  function tabMarker(panel) {
    if (!panel) return;
    var tabs = panel.querySelector('.panel-tabs'); if (!tabs) return;
    var m = tabs.querySelector('.sx-tabm');
    if (!m) { m = deco('i', 'sx-tabm'); tabs.appendChild(m); }
    var a = tabs.querySelector('.panel-tab.active'); if (!a || !a.offsetWidth) return;
    var x = a.offsetLeft + a.offsetWidth / 2 - 2;
    var t = 'translateX(' + x.toFixed(1) + 'px)';
    if (m.style.transform !== t) m.style.transform = t;
  }
  function decorateHead(head, panel) {
    var box = head.querySelector('.queue-head>div:first-child');
    if (box && !box.querySelector('.sx-kick')) box.appendChild(deco('div', 'sx-kick', '<span>星 表</span><em>Catalogue</em>'));
    tabMarker(panel);
    // 每一页顶上那一行的星区名
    [['queue-pane', '星 序'], ['pl-pane', '星 区'], ['podcast-pane', '射电源']].forEach(function (p) {
      var bar = document.querySelector('#' + p[0] + ' > .queue-toolbar');
      if (bar && !bar.querySelector('.sx-cn')) bar.insertBefore(deco('span', 'sx-cn', p[1]), bar.firstChild);
    });
  }

  // ---------- 队列 ----------
  // 已播过的沉在地平线下；正在播放的在中天；后面的每一首标出"还有多久升起"（在播放时写成钟点）
  function queueTimes(list) {
    var qs = g('playQueue'), ci = g('currentIdx');
    if (!Array.isArray(qs)) return;
    var pos = 0, cd = 0, isPlaying = false;
    try { pos = typeof getPlaybackCurrentSeconds === 'function' ? getPlaybackCurrentSeconds() : 0; } catch (_e) { }
    try { cd = typeof getPlaybackDurationSeconds === 'function' ? getPlaybackDurationSeconds() : songDur(qs[ci]); } catch (_e) { cd = songDur(qs[ci]); }
    try { isPlaying = !!g('playing') || !!(typeof audio !== 'undefined' && audio && !audio.paused); } catch (_e) { }
    var rows = list.querySelectorAll('.queue-item[data-queue-index]');
    if (!rows.length) return;
    // 只为画出来的那几行累计时长（从当前这首往后）
    var maxI = 0; [].forEach.call(rows, function (r) { maxI = Math.max(maxI, Number(r.getAttribute('data-queue-index')) || 0); });
    var acc = {}, t = Math.max(0, (cd || 0) - pos), unknown = !(cd > 0);
    for (var i = (ci || 0) + 1; i <= maxI && i < qs.length; i++) {
      acc[i] = unknown ? -1 : t;
      var d = songDur(qs[i]); if (!(d > 0)) unknown = true; t += d;
    }
    var now = Date.now();
    [].forEach.call(rows, function (r) {
      var i = Number(r.getAttribute('data-queue-index'));
      var lab = r.querySelector('.sx-rise');
      if (!lab) { lab = deco('span', 'sx-rise'); var act = r.querySelector('.qi-act'); r.insertBefore(lab, act || null); }
      var txt = '';
      if (i === ci) txt = '中 天';
      else if (i > ci && acc[i] != null) txt = acc[i] < 0 ? '' : (isPlaying ? hhmm(new Date(now + acc[i] * 1000)) : '+' + fmt(acc[i]));
      if (lab.textContent !== txt) lab.textContent = txt;
      if (i > ci && i === ci + 1) lab.title = isPlaying ? '预计升起（开始播放）的时刻' : '还要多久轮到它';
    });
  }
  function decorateQueue(list) {
    var ci = g('currentIdx'), qs = g('playQueue') || [];
    [].forEach.call(list.querySelectorAll('.queue-item[data-queue-index]'), function (r) {
      var i = Number(r.getAttribute('data-queue-index')), s = qs[i] || {};
      var m = i === ci ? 1 : i < ci ? 0.3 : clamp(0.78 - (i - ci - 1) * 0.06, 0.2, 0.78);
      starVars(r, (s.id || s.name || '') + ':' + (s.artist || ''), m);
      r.classList.toggle('sx-set', i < ci);
      if (!r.hasAttribute('tabindex')) r.setAttribute('tabindex', '0');
    });
    queueTimes(list);
  }

  // ---------- 歌单 ----------
  var TEXT_SEC = [[/内置|not blind|mineradio/i, 'mineradio'], [/网易/, 'netease'], [/qq/i, 'qq'], [/酷狗/, 'kugou'], [/汽水/, 'qishui'], [/spotify/i, 'spotify']];
  function providerOfLabel(lab) {
    var n = lab.nextElementSibling;
    while (n && !n.classList.contains('pl-card') && !n.classList.contains('pl-section-label')) n = n.nextElementSibling;
    if (n && n.classList.contains('pl-card')) return n.getAttribute('data-playlist-provider') || '';
    var t = lab.textContent || '';
    for (var i = 0; i < TEXT_SEC.length; i++) if (TEXT_SEC[i][0].test(t)) return TEXT_SEC[i][1];
    return '';
  }
  function countOf(pv) {
    var up = g('userPlaylists'); if (!Array.isArray(up)) return 0;
    var n = 0; up.forEach(function (p) { var k = typeof normalizePlaylistProvider === 'function' ? normalizePlaylistProvider(p.provider) : p.provider; if (k === pv) n++; }); return n;
  }
  function inviteHtml(title, sub, withNew) {
    return '<div>' + title + '<small>' + sub + '</small></div><div class="bt">' +
      '<button class="sx-lk" type="button" data-sx="login">登录 QQ 音乐 / 网易云</button>' +
      '<button class="sx-lk sec" type="button" data-sx="import">导入本地音乐</button>' +
      (withNew ? '<button class="sx-lk sec" type="button" data-sx="new">新建一个内置歌单</button>' : '') + '</div>';
  }
  function decoratePlaylists(list) {
    var cards = list.querySelectorAll('.pl-card[data-playlist-index]');
    var inv = list.querySelector('.sx-inv');
    var loading = false; try { loading = !!(g('playlistCatalogSyncState') && g('playlistCatalogSyncState').loading); } catch (_e) { }
    if (!cards.length && !loading) {
      if (!inv) { inv = deco('div', 'sx-inv', inviteHtml('你的星表还是一张白纸。', '登录网易云或 QQ 音乐，你的歌单会成为这里的一片片星区；也可以先导入本地音乐，或者新建一个内置歌单。', true)); list.insertBefore(inv, list.firstChild); }
      return;
    }
    if (inv) inv.remove();
    [].forEach.call(list.querySelectorAll('.pl-section-label'), function (lab) {
      var pv = providerOfLabel(lab), nm = SEC[pv] || ['星 区', lab.textContent || ''];
      if (lab.__sxPv === pv && lab.querySelector('.sx-cn')) return;
      lab.__sxPv = pv;
      [].forEach.call(lab.querySelectorAll('[data-skin-deco]'), function (d) { d.remove(); });
      lab.appendChild(deco('span', 'sx-cn', nm[0]));
      lab.appendChild(deco('span', 'sx-lb', nm[1]));
      var c = countOf(pv); if (c) lab.appendChild(deco('span', 'sx-sc', c + ' 张'));
    });
    [].forEach.call(cards, function (card) {
      var idx = Number(card.getAttribute('data-playlist-index')) || 0;
      var up = g('userPlaylists') || [], pl = up[idx] || {};
      var n = Number(pl.trackCount) || 0;
      starVars(card, (card.getAttribute('data-playlist-provider') || '') + ':' + (card.getAttribute('data-playlist-id') || ''), clamp(Math.log(Math.max(1, n)) / Math.log(520), 0.15, 1));
      if (!card.querySelector('.sx-no')) {
        var no = deco('span', 'sx-no', String(idx + 1).padStart(2, '0'));
        card.insertBefore(no, card.firstChild);
      }
      var mg = card.querySelector('.sx-mag'), mt = n ? n + ' 颗' : '';
      if (!mg) { mg = deco('span', 'sx-mag'); card.appendChild(mg); }
      if (mg.textContent !== mt) { mg.textContent = mt; mg.title = n + ' 首'; }
      if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
    });
    // 展开的详情
    var det = list.querySelector('.pl-inline-detail');
    if (det) decorateDetail(det);
  }
  function decorateDetail(det) {
    var key = det.getAttribute('data-pl-detail') || '';
    var head = det.querySelector('.pl-detail-head');
    if (head && !head.querySelector('.sx-eye')) {
      var src = eyepiece(key);
      if (src) { var img = deco('img', 'sx-eye'); img.alt = ''; img.src = src; head.insertBefore(img, head.firstChild); }
    }
    var qs = g('playQueue') || [], cur = qs[g('currentIdx')] || null;
    var st = g('playlistPanelDetailState') || {}, tracks = st.tracks || [];
    [].forEach.call(det.querySelectorAll('.pl-detail-row[data-pl-detail-row]'), function (r) {
      var i = Number(r.getAttribute('data-pl-detail-row')), s = tracks[i] || {};
      var h = hash((s.id || s.name || i) + ':' + (s.artist || ''));
      starVars(r, String(h), 0.18 + (h >>> 8) % 1000 / 1000 * 0.72);
      if (!r.querySelector('.sx-no')) r.insertBefore(deco('span', 'sx-no', String(i + 1).padStart(2, '0')), r.firstChild);
      var on = !!(cur && s && ((cur.id && s.id && String(cur.id) === String(s.id)) || (!cur.id && cur.name === s.name && cur.artist === s.artist)));
      r.classList.toggle('sx-playing', on);
    });
  }

  // ---------- 播客 ----------
  function decoratePodcasts(list) {
    var cards = list.querySelectorAll('.pl-card.podcast-card');
    var inv = list.querySelector('.sx-inv');
    var logged = false; try { logged = !!(g('loginStatus') && g('loginStatus').loggedIn); } catch (_e) { }
    if (!cards.length && !logged) {
      if (!inv) { inv = deco('div', 'sx-inv', inviteHtml('还没有收听的射电源。', '登录网易云以后，你收藏、创建的播客会像射电信号一样出现在这里。', false)); list.insertBefore(inv, list.firstChild); }
      return;
    }
    if (inv) inv.remove();
    [].forEach.call(cards, function (c, i) {
      if (!c.querySelector('.sx-no')) c.insertBefore(deco('span', 'sx-no', String(i + 1).padStart(2, '0')), c.firstChild);
      if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '0');
    });
  }

  // ---------- 刻度随滚动移动（视差一半） ----------
  var bound = null;
  function onScroll() {
    var p = bound; if (!p) return;
    var v = -((p.scrollTop * 0.5) % 60);
    p.style.setProperty('--sx-tk', v.toFixed(1) + 'px');
  }
  function onClick(e) {
    var b = e.target && e.target.closest && e.target.closest('[data-sx]'); if (!b) { if (e.target && e.target.closest && e.target.closest('.panel-tab')) setTimeout(function () { tabMarker(bound); }, 0); return; }
    e.stopPropagation();
    var k = b.getAttribute('data-sx');
    try {
      if (k === 'login' && typeof showLoginModal === 'function') showLoginModal();
      else if (k === 'import' && typeof openHomeLocalImport === 'function') openHomeLocalImport();
      else if (k === 'new' && typeof promptCreateBuiltInPlaylist === 'function') promptCreateBuiltInPlaylist();
    } catch (err) { console.warn('[star-atlas skin]', err); }
  }
  // 行：键盘 Enter = 点击（原来的行只认鼠标）
  function onKey(e) {
    if (e.key !== 'Enter' || !e.target || !e.target.matches) return;
    if (e.target.matches('.queue-item[tabindex],.pl-card[tabindex]')) { e.preventDefault(); e.target.click(); }
  }

  registerPanelSkin({
    id: ID,
    css: css,
    virtual: { queueRowStep: ROW },
    attach: function (panel) {
      if (!panel) return;
      bound = panel;
      panel.addEventListener('scroll', onScroll, { passive: true });
      panel.addEventListener('click', onClick);
      panel.addEventListener('keydown', onKey);
      if (!document.querySelector('.sx-pveil')) { var v = deco('div', 'sx-pveil'); v.setAttribute('aria-hidden', 'true'); panel.insertAdjacentElement('afterend', v); }
      onScroll();
    },
    detach: function (panel) {
      if (panel) {
        panel.removeEventListener('scroll', onScroll);
        panel.removeEventListener('click', onClick);
        panel.removeEventListener('keydown', onKey);
        panel.style.removeProperty('--sx-tk');
        [].forEach.call(panel.querySelectorAll('[data-skin-deco]'), function (d) { d.remove(); });
        [].forEach.call(panel.querySelectorAll('.sx-set,.sx-playing'), function (el) { el.classList.remove('sx-set', 'sx-playing'); });
        [].forEach.call(panel.querySelectorAll('.queue-item,.pl-card,.pl-detail-row'), function (el) { el.style.removeProperty('--m'); el.style.removeProperty('--sc'); el.__sxM = el.__sxC = null; });
        [].forEach.call(panel.querySelectorAll('.pl-section-label'), function (l) { l.__sxPv = null; });
      }
      var v = document.querySelector('.sx-pveil'); if (v) v.remove();
      bound = null;
    },
    decorate: function (kind, el, panel) {
      if (kind === 'head') decorateHead(el, panel);
      else if (kind === 'queue') decorateQueue(el);
      else if (kind === 'playlists') decoratePlaylists(el);
      else if (kind === 'podcasts') decoratePodcasts(el);
    },
    tick: function (panel) {
      if (!panel || !(panel.classList.contains('show') || panel.classList.contains('peek'))) return;
      var q = document.getElementById('queue-list');
      if (q && q.offsetParent) queueTimes(q);
      tabMarker(panel);
    }
  });
})();
