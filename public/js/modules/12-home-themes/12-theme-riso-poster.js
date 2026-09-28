// ============================================================
// Home theme · 孔版海报 (riso-poster)
// 三色孔版印刷海报：巨型堆叠歌名（蓝版）、当日数字叠印（黄版）、
// 当前封面的三色网点分色（粉 / 蓝 / 黄），右侧节目单 / 票根 / 印章式播放键。
// 渲染：WebGL 三遍（静态版面 → 小尺寸画面 → 网点合成），DOM 叠在上面做正片叠底。
// ============================================================
(function () {
  'use strict';

  var ID = 'riso-poster';
  var W0 = 1600, H0 = 900;
  var HEI = '"Microsoft YaHei UI","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  var DISP = 'Impact,"Haettenschweiler","Arial Narrow","DejaVu Sans Condensed",sans-serif';
  // 封面区域（设计坐标）：左上 x,y → 右下 x,y
  var CR = [318, 70, 1030, 652];
  var KO = [956, 588, 86]; // 贴纸处蓝、粉版镂空
  var SW = 300, SH = 245;  // 画面 pass 的分辨率（与封面区域同比例）

  var PAL = [
    { name: 'FLUO PINK / FEDERAL BLUE / YELLOW', a: '#ff3d9a', b: '#2a4c9c', c: '#ffd92e', p: '#f1eadb' },
    { name: 'ORANGE / TEAL / SUNFLOWER', a: '#ff6a2b', b: '#0d6f7a', c: '#ffc93a', p: '#efe8d6' },
    { name: 'BRIGHT RED / BLUE / FLUO YELLOW', a: '#f2413c', b: '#1f3f95', c: '#f6ee3a', p: '#f3eee2' },
    { name: 'VIOLET / MINT / FLUO PINK', a: '#ff4fae', b: '#5a3e9b', c: '#79e0b8', p: '#eeeae4' },
    { name: 'GREEN / FLUO PINK / YELLOW', a: '#ff4a9c', b: '#00804a', c: '#ffe23a', p: '#f0ead8' },
    { name: 'MEDIUM BLUE / FLUO ORANGE / KRAFT', a: '#ff6d2e', b: '#1e5fb4', c: '#f7c948', p: '#e6d8bd' },
  ];

  var CJK_RE = /[⺀-鿿豈-﫿＀-￯　-〿가-힯]/;
  var NO_START = '，。、；：？！）」』】〉》”’,.;:?!)]}…～%';
  var NO_END = '（「『【〈《“‘([{';
  var TRAIL = /[，、。；：,;:·\s]+$/;
  var WD_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var CN_NUM = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  function fmt(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x;
  }
  function cnNum(n) {
    n = Number(n) || 0;
    if (n <= 10) return CN_NUM[n];
    if (n < 20) return '十' + CN_NUM[n % 10];
    return CN_NUM[Math.floor(n / 10)] + '十' + (n % 10 ? CN_NUM[n % 10] : '');
  }
  function sessionName(time) {
    var h = parseInt(String(time || '0').split(':')[0], 10) || 0;
    if (h < 5) return '深夜场';
    if (h < 9) return '清晨场';
    if (h < 12) return '上午场';
    if (h < 17) return '午后场';
    if (h < 19) return '傍晚场';
    if (h < 23) return '夜场';
    return '深夜场';
  }
  function hashStr(s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }
  function hex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- 标题拆分：主标题 + 括号 / 破折号后的副标题 ----------
  function splitTitle(title) {
    title = String(title || '').replace(/\s+/g, ' ').trim();
    var m = title.match(/^(.+?)\s*[（(【\[「]([^）)】\]」]+)[）)】\]」]?\s*$/);
    if (m && m[1].trim()) return { main: m[1].trim(), sub: m[2].trim() };
    m = title.match(/^(.+?)\s+((?:feat\.?|ft\.?|featuring)\s+.+)$/i);
    if (m && m[1].trim()) return { main: m[1].trim(), sub: m[2].trim() };
    m = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (m && m[1].trim()) return { main: m[1].trim(), sub: m[2].trim() };
    return { main: title || '—', sub: '' };
  }

  // 拆成不可再分的单位：每个汉字一个单位，拉丁单词整体一个单位；避头尾标点粘到相邻单位上
  // 中文词边界（Electron/Chromium 自带 Intl.Segmenter）：断行时尽量不拆开一个词
  var wordSeg = null;
  try { if (typeof Intl !== 'undefined' && Intl.Segmenter) wordSeg = new Intl.Segmenter('zh', { granularity: 'word' }); } catch (_e) { wordSeg = null; }
  function wordStarts(s) {
    var set = Object.create(null);
    if (!wordSeg) return null;
    try { for (var it = wordSeg.segment(s)[Symbol.iterator](), r = it.next(); !r.done; r = it.next()) set[r.value.index] = 1; } catch (_e) { return null; }
    return set;
  }
  function tokenize(s) {
    var starts = wordStarts(s);
    var raw = [], buf = '', bufAt = 0, sp = false, idx = 0;
    function flush() { if (buf) { raw.push({ t: buf, sp: sp, ws: !starts || !!starts[bufAt] || sp }); sp = false; buf = ''; } }
    Array.from(s).forEach(function (ch) {
      var at = idx; idx += ch.length;
      if (/\s/.test(ch)) { flush(); if (raw.length) sp = true; return; }
      if (CJK_RE.test(ch)) { flush(); raw.push({ t: ch, sp: sp, ws: !starts || !!starts[at] || sp }); sp = false; return; }
      if (!buf) bufAt = at;
      buf += ch;
    });
    flush();
    var out = [];
    raw.forEach(function (u) {
      var prev = out[out.length - 1];
      if (prev && (NO_START.indexOf(u.t[0]) >= 0 || NO_END.indexOf(prev.t[prev.t.length - 1]) >= 0)) {
        prev.t += (u.sp ? ' ' : '') + u.t;
        return;
      }
      out.push({ t: u.t, sp: u.sp, ws: u.ws });
    });
    return out;
  }

  // ---------- 巨型标题排版 ----------
  // 在左侧版块里把标题排成 2~4 行，每行尽量撑满本区域宽度；
  // 上半部分的行可以压到封面网点上（叠印），下半部分的行要让开播放控件。
  // 只允许底边轻微出血（不超过笔画粗细的一小部分），左边永不裁切。
  var T_X0 = 18, T_UP_R = 752, T_LOW_R = 580, T_LOWER_Y = 668, T_TILT = 0.03, T_GAP = 0.07, T_RATIO = 1.45, T_SMAX = 400, T_NIB = 0.022;
  var measureCtx = document.createElement('canvas').getContext('2d');
  // Impact 只有常规体；没有 Impact 的系统上改用粗体的窄体兜底，避免细字
  var impactKnown = null;
  function hasImpact() {
    if (impactKnown !== null) return impactKnown;
    var probe = 'Hamburgefontsiv 0123';
    measureCtx.font = '40px monospace'; var a = measureCtx.measureText(probe).width;
    measureCtx.font = '40px Impact, monospace'; var b = measureCtx.measureText(probe).width;
    impactKnown = Math.abs(a - b) > 1;
    return impactKnown;
  }

  function layoutTitle(title, top) {
    var parts = splitTitle(title);
    var main = parts.main;
    var latin = !CJK_RE.test(main);
    var font = latin
      ? (hasImpact() ? function (s) { return '400 ' + s + 'px ' + DISP; } : function (s) { return '700 ' + s + 'px ' + DISP; })
      : function (s) { return '900 ' + s + 'px ' + HEI; };
    var sx = latin ? 0.94 : 1;
    var units = tokenize(main);
    if (units.length > 34) { units = units.slice(0, 33); units[32].t += '…'; }
    var mc = measureCtx;
    mc.font = font(100);
    var spW = mc.measureText(' ').width / 100;
    var U = units.map(function (u) {
      var mt = mc.measureText(u.t);
      var tr = u.t.replace(TRAIL, '');
      return {
        t: u.t, sp: u.sp, ws: u.ws !== false, w: mt.width / 100, we: (tr ? mc.measureText(tr).width : 0) / 100,
        a: (mt.actualBoundingBoxAscent || 80) / 100, d: (mt.actualBoundingBoxDescent || 10) / 100,
      };
    });
    var N = U.length;
    function lineInfo(i, j) {
      var w = 0, a = 0, d = 0;
      for (var k = i; k < j; k++) {
        w += (k === j - 1 ? U[k].we : U[k].w) + (k > i && U[k].sp ? spW : 0);
        a = Math.max(a, U[k].a); d = Math.max(d, U[k].d);
      }
      // 一个超长的拉丁单词独占一行时允许横向压窄（不拆词）
      var lsx = latin && j - i === 1 && U[i].t.length > 10 ? 0.7 : sx;
      var inner = 0;
      for (k = i; k < j - 1; k++) if (/[，、。；：,;:]$/.test(U[k].t)) inner++;
      return { i: i, j: j, w: Math.max(w, 0.2), a: a || 0.8, d: d || 0.1, sx: lsx, inner: inner };
    }
    function evaluate(lines) {
      var n = lines.length, zone = [], s = [], tops = [], bots = [], k, it;
      for (k = 0; k < n; k++) zone[k] = 0;
      for (it = 0; it < 4; it++) {
        for (k = 0; k < n; k++) {
          var yMid = it ? (tops[k] + bots[k]) / 2 : 0;
          var lim = (zone[k] ? T_LOW_R : T_UP_R) - T_X0 - T_TILT * yMid;
          s[k] = Math.min(T_SMAX, lim / (lines[k].w * lines[k].sx));
        }
        var mn = Math.min.apply(null, s);
        for (k = 0; k < n; k++) s[k] = Math.min(s[k], mn * T_RATIO);
        var H = 0;
        for (k = 0; k < n; k++) H += (lines[k].a + lines[k].d) * s[k] + (k < n - 1 ? T_GAP * s[k] : 0);
        var avail = H0 - top + T_NIB * s[n - 1];
        var f = Math.min(1, avail / H), y = 0;
        for (k = 0; k < n; k++) {
          s[k] *= f; tops[k] = y; bots[k] = y + (lines[k].a + lines[k].d) * s[k]; y = bots[k] + T_GAP * s[k];
        }
        var changed = false;
        for (k = 0; k < n; k++) if (!zone[k] && top + bots[k] > T_LOWER_Y) { zone[k] = 1; changed = true; }
        if (!changed && it > 0) break;
      }
      var min = Math.min.apply(null, s), avg = s.reduce(function (x, v) { return x + v; }, 0) / n;
      // 行数越接近 3 越像原稿；单字成行在长标题里扣分
      var orphan = 0;
      for (k = 0; k < n; k++) if (lines[k].j - lines[k].i === 1 && N > n + 2) orphan += 0.08;
      var wMin = Infinity, wMax = 0, punct = 0, midWord = 0;
      for (k = 0; k < n; k++) {
        wMin = Math.min(wMin, lines[k].w); wMax = Math.max(wMax, lines[k].w);
        if (k < n - 1 && TRAIL.test(U[lines[k].j - 1].t)) punct += 0.15;
        punct -= 0.06 * lines[k].inner; // 在逗号处断行更自然
        if (k > 0 && !U[lines[k].i].ws) midWord++;                         // 把一个词拆到两行，扣分
        if (k > 0 && /^[\u4e00-\u9fff][，、。；：,;:]$/.test(U[lines[k].i].t)) midWord++; // 行首是"单字+逗号"（短语尾巴被甩到下一行），同样扣分
      }
      var bal = 1 - 0.3 * (1 - wMin / wMax);
      var fill = Math.min(1, bots[n - 1] / (H0 - top));                    // 竖向填满左侧版块
      bal *= 0.6 + 0.4 * fill;
      return { score: min * (1 - orphan) * bal * (1 + punct) * Math.pow(0.55, midWord) /* 原 0.86：更不愿意把词拆到两行 */ + 0.03 * avg - (n === 4 ? 2 : 0), s: s, tops: tops, bots: bots, zone: zone };
    }
    var best = null, nMin = N === 1 ? 1 : 2, nMax = Math.min(4, N);
    function rec(start, left, acc) {
      if (left === 1) {
        var lines = acc.concat([lineInfo(start, N)]);
        var r = evaluate(lines);
        if (!best || r.score > best.score) { best = r; best.lines = lines; }
        return;
      }
      for (var b = start + 1; b <= N - left + 1; b++) rec(b, left - 1, acc.concat([lineInfo(start, b)]));
    }
    for (var n = nMin; n <= nMax; n++) rec(0, n, []);

    // 行宽已经顶满时会剩下竖向空间：整体往下挪（底边对齐出血），但不把上半区的行挪进播放控件那一带
    var nL = best.lines.length, lastBot = best.bots[nL - 1];
    var shift = Math.max(0, H0 - top + T_NIB * best.s[nL - 1] - lastBot);
    for (var z = 0; z < nL; z++) if (!best.zone[z]) shift = Math.min(shift, Math.max(0, T_LOWER_Y - top - best.bots[z]));
    for (z = 0; z < nL; z++) { best.tops[z] += shift; best.bots[z] += shift; }
    var out = [];
    best.lines.forEach(function (ln, k) {
      var txt = '';
      for (var q = ln.i; q < ln.j; q++) txt += (q > ln.i && U[q].sp ? ' ' : '') + U[q].t;
      txt = txt.replace(TRAIL, '') || txt;
      var size = best.s[k];
      mc.font = font(size);
      var mt = mc.measureText(txt);
      var inkL = mt.actualBoundingBoxLeft || 0, inkW = (mt.actualBoundingBoxLeft || 0) + (mt.actualBoundingBoxRight || mt.width);
      var yMid = (best.tops[k] + best.bots[k]) / 2;
      var lim = (best.zone[k] ? T_LOW_R : T_UP_R) - T_X0 - T_TILT * yMid;
      var lsx = ln.sx;
      if (inkW * lsx > lim) lsx = lim / inkW;
      out.push({ text: txt, size: size, sx: lsx, x: inkL * lsx, y: best.tops[k] + ln.a * size });
    });
    return { font: font, lines: out, sub: parts.sub, latin: latin, main: main };
  }

  // ---------- CSS ----------
  var CSS = [
    '&{--paper:#f1eadb;--ia:#ff3d9a;--ib:#2a4c9c;--ic:#ffd92e;--ax:1.5px;--ay:-1px;--bx:-1px;--by:1.2px;--cx:2px;--cy:2px;',
    '--rp-spring:cubic-bezier(.34,1.42,.5,1);--rp-out:cubic-bezier(.2,.8,.2,1);--rp-sheet:color-mix(in srgb,var(--paper) 62%,#fffdf5);',
    '--hei:"Microsoft YaHei UI","Microsoft YaHei","Noto Sans CJK SC",sans-serif;--kai:"KaiTi","楷体","STKaiti","AR PL UKai CN",serif;',
    '--disp:Impact,"Haettenschweiler","Arial Narrow","DejaVu Sans Condensed",sans-serif;--mono:Consolas,"DejaVu Sans Mono",monospace;--serif:Georgia,"Times New Roman","DejaVu Serif",serif;',
    'background:var(--paper);isolation:isolate;font-family:var(--hei);color:var(--ib);-webkit-font-smoothing:antialiased;user-select:none;transition:background .2s}',
    '& *{box-sizing:border-box;margin:0;padding:0}',
    '& button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;outline:none}',
    '& button:focus-visible{outline:2px dashed var(--ia);outline-offset:2px}',
    '& ol,& ul{list-style:none}',
    '& .rp-gl,& .rp-flat{position:absolute;left:0;top:0;width:100%;height:100%;display:block}',
    '& .rp-stage{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:0 0;mix-blend-mode:multiply}',
    '& .rp-s2{pointer-events:none}& .rp-s2>*{pointer-events:auto}& .rp-s2 .np,& .rp-s2 .times{pointer-events:none}& .rp-s2 .times .qt{pointer-events:auto}',
    // 斑点层没有遮罩时是一整块纸色，会盖住整张海报：遮罩生成好之前先藏起来
    '& .rp-speck{position:absolute;inset:0;pointer-events:none;background:var(--paper);transition:background .2s;-webkit-mask-size:100% 100%;mask-size:100% 100%;opacity:0;visibility:hidden}',
    '& .rp-speck.on{opacity:1;visibility:visible}',
    '& .a{color:var(--ia);translate:var(--ax) var(--ay)}& .b{color:var(--ib);translate:var(--bx) var(--by)}& .c{color:var(--ic);translate:var(--cx) var(--cy)}',
    '& .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    // 巨型标题的点击区（标题本身画在印版上）：点了进入沉浸模式
    '& .title-hit{position:absolute;left:18px;top:var(--tt,158px);width:734px;height:calc(880px - var(--tt,158px));display:block;cursor:pointer;background:none}',
    '& .title-hit .th-up,& .title-hit .th-low{position:absolute;left:0;display:block}',
    '& .title-hit .th-up{top:0;width:734px;height:calc(668px - var(--tt,158px))}',
    '& .title-hit .th-low{top:calc(668px - var(--tt,158px));width:562px;height:212px}',
    '& .title-hit{pointer-events:none}& .title-hit .th-up,& .title-hit .th-low{pointer-events:auto}',
    '& .title-hit .th-tag{position:absolute;left:4px;bottom:-14px;font:700 12px/1 var(--mono);letter-spacing:.16em;white-space:nowrap;background:var(--paper);padding:3px 6px;opacity:0;transform:translateY(4px);transition:opacity .18s,transform .18s;pointer-events:none}',
    '& .title-hit:hover .th-tag{opacity:1;transform:none}',
    // header
    '& .kicker{position:absolute;left:1122px;top:146px;font:700 11.5px/1 var(--mono);letter-spacing:.22em;white-space:nowrap}',
    '& .dow{position:absolute;left:1432px;top:172px;font:400 34px/.9 var(--disp);letter-spacing:.02em;text-transform:uppercase;white-space:nowrap}',
    '& .dow b{display:block;font-size:52px;letter-spacing:.01em}',
    '& .datecn{position:absolute;left:1124px;top:268px;font:700 15px/1 var(--hei);letter-spacing:.3em;white-space:nowrap}',
    '& .hl-hit{position:absolute;left:1122px;top:296px;width:436px;height:52px;display:block}',
    '& .hl-hit .tag{position:absolute;right:8px;top:50%;margin-top:-9px;font:700 11px/18px var(--mono);letter-spacing:.14em;padding:0 6px;background:var(--paper);opacity:0;transform:translateX(-6px);transition:opacity .18s,transform .18s}',
    '& .hl-hit:hover .tag,& .hl-hit:focus-visible .tag{opacity:1;transform:none}',
    '& .hl-hit::after{content:"";position:absolute;left:0;right:0;bottom:-5px;height:3px;background:var(--ia);transform:scaleX(0);transform-origin:0 50%;transition:transform .22s cubic-bezier(.2,.8,.2,1)}',
    '& .hl-hit:hover::after{transform:scaleX(1)}',
    '& .head-sub{position:absolute;left:1124px;top:352px;width:436px;font:700 13px/1.5 var(--mono);letter-spacing:.08em}',
    '& .head-sub em{font:italic 15px var(--serif);letter-spacing:0}',
    // lineup
    '& .lu-h,& .sa-h{position:absolute;left:1122px;width:436px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;font:700 12px/1 var(--mono);letter-spacing:.2em;border-bottom:3px solid currentColor;padding-bottom:6px;white-space:nowrap}',
    '& .lu-h{top:392px}& .sa-h{top:630px}',
    '& .sa-h .src{font:700 11px/1 var(--hei);letter-spacing:.08em;color:var(--ia);overflow:hidden;text-overflow:ellipsis;min-width:0}',
    '& .lineup{position:absolute;left:1122px;top:410px;width:436px}',
    '& .lineup li{position:relative;height:35px}',
    '& .lineup li::after{content:"";position:absolute;left:0;right:0;bottom:0;border-bottom:1.5px dotted var(--ib);translate:var(--bx) var(--by)}',
    '& .lineup button{position:relative;display:flex;align-items:baseline;width:100%;height:35px;text-align:left;padding-top:3px;white-space:nowrap}',
    '& .lineup .n{flex:none;width:56px;font:400 31px/1 var(--disp);color:var(--ia);translate:var(--ax) var(--ay);transition:transform .15s}',
    '& .lineup .t{flex:none;font:900 25px/1 var(--hei);color:var(--ib);translate:var(--bx) var(--by);letter-spacing:.02em;transition:transform .15s}',
    '& .lineup .e{flex:none;margin-left:10px;font:700 11px/1 var(--mono);letter-spacing:.16em;color:var(--ib);translate:var(--bx) var(--by)}',
    '& .lineup .m{margin-left:auto;padding-left:12px;min-width:0;font:700 13px/1.1 var(--mono);color:var(--ia);translate:var(--ax) var(--ay);letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis}',
    '& .lineup .hl{position:absolute;left:44px;top:4px;height:27px;width:0;background:var(--ic);translate:var(--cx) var(--cy);transition:width .22s cubic-bezier(.2,.8,.2,1);z-index:-1}',
    '& .lineup button:hover .hl,& .lineup button:focus-visible .hl{width:calc(100% - 44px)}',
    '& .lineup button:hover .n{transform:translateX(6px) rotate(-4deg)}',
    '& .lineup button:hover .t{transform:translateX(4px)}',
    '& .lineup li.first .t{font-size:27px}& .lineup li.first .n{font-size:34px}',
    '& .lineup li.on .t{text-decoration:underline wavy var(--ia) 2px;text-underline-offset:6px}',
    '& .lineup li.dim .m{opacity:.62}',
    // support acts
    '& .acts{position:absolute;left:1122px;top:652px;width:440px;height:62px;font:900 19px/1.62 var(--hei);letter-spacing:.01em;overflow:hidden}',
    '& .acts button{position:relative;display:inline-block;max-width:196px;vertical-align:top;padding:0 1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:transform .15s}',
    '& .acts button span{font:400 13px/1 var(--kai);margin-left:3px;color:var(--ia);translate:var(--ax) var(--ay);display:inline-block;transform:translateY(-1px)}',
    '& .acts .sep{color:var(--ia);margin:0 5px;font-weight:400;translate:var(--ax) var(--ay);display:inline-block;vertical-align:top;font-style:normal}',
    '& .acts button:hover,& .acts button:focus-visible{background:linear-gradient(transparent 52%,var(--ic) 52%,var(--ic) 90%,transparent 90%);transform:translateY(-1px)}',
    '& .acts button.on{text-decoration:line-through var(--ia) 3px}',
    '& .acts .hint{font:400 15px/1.5 var(--kai);color:var(--ib)}',
    '& .acts .go{font:900 17px/1.62 var(--hei)}',
    // ticket
    '& .ticket{position:absolute;left:1122px;top:724px;width:438px;height:144px;display:flex;border:2.5px solid var(--ib);translate:var(--bx) var(--by)}',
    '& .ticket .stub{flex:none;width:112px;border-right:2.5px dashed var(--ib);padding:10px;display:flex;flex-direction:column;justify-content:space-between}',
    '& .ticket .stub small{font:700 10px/1.25 var(--mono);letter-spacing:.14em;white-space:nowrap}',
    '& .ticket .stub strong{font:400 54px/.85 var(--disp);color:var(--ia);translate:calc(var(--ax) - var(--bx)) calc(var(--ay) - var(--by));white-space:nowrap}',
    '& .ticket .stub strong sub{font-size:15px;vertical-align:baseline;margin-left:2px}',
    '& .ticket .main{flex:1;min-width:0;padding:10px 14px;display:flex;flex-direction:column;justify-content:space-between}',
    '& .ticket .row{display:flex;justify-content:space-between;font:700 10.5px/1 var(--mono);letter-spacing:.14em;white-space:nowrap}',
    '& .ticket .big{font:900 23px/1.12 var(--hei);letter-spacing:.02em}',
    '& .ticket .big i{font:400 15px var(--kai);font-style:normal;color:var(--ia);translate:calc(var(--ax) - var(--bx)) calc(var(--ay) - var(--by));display:inline-block}',
    '& .ticket .nx{display:flex;align-items:baseline;gap:8px;font:700 12px/1 var(--mono);letter-spacing:.1em;border-top:1.5px dotted var(--ib);padding-top:7px;text-align:left;width:100%;white-space:nowrap;min-width:0}',
    '& .ticket .nx b{font:900 17px/1 var(--hei);letter-spacing:.02em;min-width:0;overflow:hidden;text-overflow:ellipsis;transition:color .15s}',
    '& .ticket .nx .na{min-width:0;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}',
    '& .ticket .nx .d{margin-left:auto;flex:none}',
    '& .ticket .nx .ar{flex:none;display:inline-block;transition:transform .15s}',
    '& .ticket .nx:hover b,& .ticket .nx:focus-visible b{color:var(--ia)}& .ticket .nx:hover .ar{transform:translateX(4px)}',
    '& .notch{position:absolute;width:18px;height:18px;border-radius:50%;background:var(--paper);border:2.5px solid var(--ib);left:101px}',
    '& .notch.t{top:-11px;clip-path:inset(50% 0 0 0)}& .notch.btm{bottom:-11px;clip-path:inset(0 0 50% 0)}',
    '& .colo{position:absolute;left:1122px;top:878px;font:700 9.5px/1 var(--mono);letter-spacing:.14em;white-space:nowrap}',
    // 左上角"直接打字"提示章（原来的 SEARCH 撕条：主页上直接打字就能搜，不用先点哪里）
    '& .rp-hint{position:absolute;left:122px;top:16px;height:36px;display:flex;align-items:center;gap:8px;padding:0 12px 0 9px;color:var(--ib);border:2.5px solid var(--ib);translate:var(--bx) var(--by);transform:rotate(-2deg);font:900 14px/1 var(--hei);letter-spacing:.08em;white-space:nowrap;-webkit-mask-image:var(--rp-grain);mask-image:var(--rp-grain);-webkit-mask-size:160px;mask-size:160px;transition:transform .2s var(--rp-spring)}',
    '& .rp-hint small{font:700 11.5px/1 var(--hei);letter-spacing:.1em;color:var(--ia)}',
    '& .rp-hint:hover{transform:rotate(0) scale(1.04)}& .rp-hint svg{display:block}',
    // [二改] 章在窗口顶部的"拖动窗口"条里，Windows 会把点击当成拖窗口，所以原来很难点开：挖掉这块拖动区，并把可点范围往外扩一圈
    '& .rp-hint{-webkit-app-region:no-drag;cursor:pointer}',
    // [二改] 章所在的海报层整体做了缩放，Electron 算"哪里不能拖窗口"时不认缩放，挖出来的位置对不上。
    // 所以另放一块不缩放的透明点击区，按章在屏幕上的真实位置盖上去（四周再放宽一圈）
    '& .rp-hint-hit{position:absolute;z-index:30;display:block;border:0;padding:0;margin:0;background:transparent;cursor:pointer;-webkit-app-region:no-drag;outline:none}',
    '& .rp-hint.hov{transform:rotate(0) scale(1.04)}',
    '&.rp-search .rp-hint-hit{display:none}',
    // transport
    '& .np{position:absolute;left:600px;top:678px;width:430px;display:flex;justify-content:space-between;gap:16px;font:700 11px/1 var(--mono);letter-spacing:.2em;white-space:nowrap}',
    '& .np .nt{min-width:0;overflow:hidden;text-overflow:ellipsis;letter-spacing:.08em}',
    '& .np .ns{flex:none}',
    // 播放器：贴纸 = 唯一的播放键；进度是一条撕票虚线；其余按钮靠近才浮现
    '& .rp-tear{position:absolute;left:600px;top:814px;width:430px;height:40px;cursor:pointer;touch-action:none}',
    '& .rp-tear .perf{position:absolute;left:0;right:0;top:19px;height:2px;background:repeating-linear-gradient(90deg,var(--ib) 0 6px,transparent 6px 11px);translate:var(--bx) var(--by);transition:height .15s,top .15s}',
    '& .rp-tear .hole{position:absolute;top:13px;width:14px;height:14px;border-radius:50%;border:2px solid var(--ib);background:var(--paper);translate:var(--bx) var(--by)}',
    '& .rp-tear .hole.l{left:-20px}& .rp-tear .hole.r{right:-20px}',
    '& .rp-tear .used{position:absolute;left:0;top:16px;height:8px;width:0;translate:var(--ax) var(--ay)}',
    '& .rp-tear .used::before{content:"";position:absolute;left:0;right:0;top:2px;height:4px;background:var(--ia)}',
    '& .rp-tear .used::after{content:"";position:absolute;left:0;right:0;top:-4px;height:6px;background:linear-gradient(135deg,transparent 50%,var(--ia) 50%) 0 0/7px 6px repeat-x,linear-gradient(225deg,transparent 50%,var(--ia) 50%) 0 0/7px 6px repeat-x;opacity:.55}',
    '& .rp-tear .cut{position:absolute;top:-6px;left:0;width:30px;height:30px;margin-left:-15px;color:var(--ib);translate:var(--bx) var(--by);transition:transform .2s var(--rp-spring);pointer-events:none}',
    '& .rp-tear .cut svg{display:block}',
    '& .rp-tear:hover .perf,& .rp-tear.drag .perf{height:3px;top:18.5px}',
    '& .rp-tear:hover .cut,& .rp-tear.drag .cut{transform:rotate(-12deg) scale(1.12)}',
    '& .rp-tear .tag{position:absolute;top:-22px;left:0;transform:translateX(-50%);font:700 11px/16px var(--mono);letter-spacing:.08em;padding:0 5px;background:var(--ic);color:var(--ib);opacity:0;transition:opacity .15s;pointer-events:none;white-space:nowrap}',
    '& .rp-tear:hover .tag,& .rp-tear.drag .tag{opacity:1}',
    '& .rp-tear.off{cursor:default}& .rp-tear.off .cut,& .rp-tear.off .tag{display:none}',
    '& .rp-tearlbl{position:absolute;left:680px;width:270px;top:866px;text-align:center;font:700 11px/1 var(--hei);letter-spacing:.08em;color:var(--ib);opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}',
    '&.rp-near .rp-tearlbl{opacity:.8}',
    '& .rp-ctl{position:absolute;left:596px;top:730px;width:440px;height:64px;display:flex;align-items:center;gap:2px;pointer-events:none!important}',
    '& .rp-ctl>*{opacity:0;transform:translateY(6px);transition:opacity .16s,transform .22s var(--rp-spring)}',
    '&.rp-near .rp-ctl{pointer-events:auto!important}',
    '&.rp-near .rp-ctl>*{opacity:1;transform:none}',
    '&.rp-near .rp-ctl>*:nth-child(2){transition-delay:.02s}&.rp-near .rp-ctl>*:nth-child(3){transition-delay:.04s}&.rp-near .rp-ctl>*:nth-child(4){transition-delay:.06s}&.rp-near .rp-ctl>*:nth-child(5){transition-delay:.08s}&.rp-near .rp-ctl>*:nth-child(6){transition-delay:.1s}',
    '& .rp-g{width:44px;height:52px;display:grid;place-items:center;color:var(--ib);translate:var(--bx) var(--by);transition:transform .15s}',
    '& .rp-g:hover{transform:scale(1.1) rotate(-4deg)!important}& .rp-g:active{transform:scale(.92)!important}',
    '& .rp-g svg{display:block}',
    '& .rp-g.heart{color:var(--ia);translate:var(--ax) var(--ay)}',
    '& .rp-g.heart path{fill:transparent;stroke:currentColor;stroke-width:3;transition:fill .15s}',
    '& .rp-g.heart.on path{fill:currentColor}',
    '& .rp-g.lyr{width:40px;height:40px;margin:0 6px;border:2.5px solid var(--ib);font:900 21px/1 var(--hei)}',
    '& .rp-g.lyr.on{background:var(--ib);color:var(--paper)}',
    '& .rp-ink{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;min-width:0;cursor:default;outline:none}',
    // [二改 2026-09-28] 墨量能点能拖：那排墨点就是滑条（上下各放宽 18px 好点中）
    '& .rp-ink .dots{cursor:pointer;padding:18px 5px;margin:-18px -5px;touch-action:none}',
    '& .rp-ink.drag .dots i{transition:none}',
    '& .rp-ink b em{min-width:2.7em;font-variant-numeric:tabular-nums}',   // 数字变宽变窄时整组别左右挪（不然拖着拖着墨点跑了）
    '& .rp-ink:focus-visible .dots{outline:1.5px dashed var(--ia);outline-offset:-14px}',
    '& .rp-ink .dots{display:flex;align-items:center;gap:2px;height:16px}',
    '& .rp-ink .dots i{display:block;border-radius:50%;background:var(--ib);translate:var(--bx) var(--by);opacity:.35;transition:background .15s,opacity .15s}',
    '& .rp-ink .dots i.on{background:var(--ia);translate:var(--ax) var(--ay);opacity:1}',
    '& .rp-ink b{font:700 9.5px/1.2 var(--hei);letter-spacing:.12em;color:var(--ib);white-space:nowrap;text-align:left}',
    '& .rp-ink b em{display:block;font:400 20px/1 var(--disp);letter-spacing:.02em;color:var(--ia);font-style:normal}',
    '& .rp-ink.live b em{animation:rp-misA .3s}',
    '& .rp-ink.nov{cursor:default;opacity:.5}',
    '& .rp-nextq{font:700 10px/1.3 var(--hei);letter-spacing:.1em;color:var(--ib);text-align:left;width:84px;margin-left:4px;white-space:nowrap}',
    '& .rp-nextq b{display:block;font:900 14px/1.2 var(--hei);letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis}',
    '& .rp-nextq:hover b{color:var(--ia)}',
    // 喜欢 = 一枚心形小章，盖在封面右下角
    '& .rp-heartmark{position:absolute;left:742px;top:470px;width:104px;height:104px;color:var(--ib);translate:var(--bx) var(--by);pointer-events:none!important;opacity:0;transform:rotate(-14deg) scale(.6);-webkit-mask-image:var(--rp-grain);mask-image:var(--rp-grain);-webkit-mask-size:160px;mask-size:160px}',
    '& .rp-heartmark.on{opacity:.92;transform:rotate(-14deg) scale(1);transition:opacity .08s,transform .32s cubic-bezier(.3,1.8,.4,1)}',
    '& .rp-heartmark.off{opacity:0;transform:rotate(-14deg) scale(1.04);transition:opacity .5s}',
    '& .rp-heartmark svg{display:block;width:100%;height:100%}',
    '@keyframes rp-misA{0%{translate:4px -3px}55%{translate:-1px 1px}100%{translate:var(--ax) var(--ay)}}',
    '& .times{position:absolute;left:600px;top:866px;width:430px;display:flex;justify-content:space-between;gap:14px;font:700 12px/1 var(--mono);letter-spacing:.12em;white-space:nowrap}',
    '& .times .qt{min-width:0;overflow:hidden;text-overflow:ellipsis;font:700 12px/1 var(--hei);letter-spacing:.06em;cursor:pointer;transition:color .15s}',
    '& .times .qt:hover{color:var(--ia)}',
    '& .times span{flex:none}',
    // 已播时间：点一下切换 已播 / 剩余
    "& .times .t-cur{min-width:64px;text-align:left;color:var(--ia);translate:calc(var(--ax) - var(--bx)) calc(var(--ay) - var(--by));pointer-events:auto;cursor:pointer}",
    '& .times .t-cur:hover{text-decoration:underline dotted 1.5px;text-underline-offset:3px}',
    '& .times .qt{transition:opacity .2s,color .15s}&.rp-near .times .qt{opacity:0}',
    // [歌词位] 粉版竖排大字 = 此刻这句歌词（没歌词时是每日一句）；上面盖一块透明点击区 + 悬停时的小标签
    '& .rp-vhit{position:absolute;left:1012px;top:52px;width:60px;height:820px;display:block;cursor:pointer;background:none;-webkit-app-region:no-drag}',
    '& .rp-vhit .vt{position:absolute;left:66px;top:6px;font:700 10.5px/1 var(--mono);letter-spacing:.14em;white-space:nowrap;padding:4px 6px;background:var(--ic);color:var(--ib);opacity:0;transform:translateX(-4px);transition:opacity .15s,transform .2s var(--rp-spring);pointer-events:none}',
    '& .rp-vhit:hover .vt,& .rp-vhit:focus-visible .vt{opacity:1;transform:none}',
    '& .rp-vhit .vk{position:absolute;left:-2px;top:-30px;width:64px;text-align:center;font:700 9.5px/1.25 var(--mono);letter-spacing:.12em;color:var(--ia);translate:var(--ax) var(--ay);opacity:.85;pointer-events:none;white-space:pre}',
    '&.rp-empty .rp-vhit{display:none}',
    // sticker
    '& .sticker{position:absolute;left:874px;top:506px;width:164px;height:164px;cursor:pointer;border-radius:50%}',
    '& .sticker .rot{position:absolute;inset:0;animation:rp-spin 18s linear infinite;color:var(--ib);translate:var(--bx) var(--by)}',
    '& .sticker.fast .rot{animation-duration:6s}',
    '& .sticker .mid{position:absolute;inset:40px;display:grid;place-items:center;text-align:center;color:var(--ia);translate:var(--ax) var(--ay);transition:transform .2s}',
    '& .sticker .mid b{display:block;font:400 34px/.9 var(--disp);white-space:nowrap}',
    '& .sticker .mid small{display:block;font:900 13px/1.2 var(--hei);letter-spacing:.2em;white-space:nowrap}',
    '& .sticker:hover .mid{transform:scale(1.1) rotate(-6deg)}',
    // 贴纸 = 播放键：中间是粉版实心的播放 / 暂停字形，按下时盖一下章、洇开一圈黄墨；墨量（音量）决定贴纸的浓淡
    '& .sticker .mid .st-t{display:none}',
    '& .sticker .mid>div{display:flex;flex-direction:column;align-items:center}',
    '& .sticker .st-g{display:block;order:-1;margin:0 auto 2px;width:54px;height:54px;translate:3px 0}',
    '& .sticker .st-g svg{display:block}',
    '& .sticker .mid small{font:400 14px/1 var(--kai);letter-spacing:.3em;margin-left:.3em}',
    '& .sticker .mid,& .sticker .rot{opacity:calc(.38 + .62 * var(--vol,.8));transition:opacity .25s,transform .2s}',
    '& .sticker{touch-action:none}& .sticker:focus-visible{outline:2px dashed var(--ia);outline-offset:6px}',
    '& .st-blot{position:absolute;left:50%;top:50%;width:190px;height:190px;margin:-95px 0 0 -95px;border-radius:50%;background:radial-gradient(circle,var(--ic) 0 44%,transparent 45%);translate:var(--cx) var(--cy);opacity:0;pointer-events:none}',
    '& .sticker.hit .st-blot{animation:rp-blot .6s ease-out}& .sticker.hit .mid{animation:rp-stamp .42s cubic-bezier(.3,1.6,.4,1)}',
    // 左边缘露出的一摞票根：鼠标碰到 / 点一下就拉出歌单栏
    '& .rp-peek{position:absolute;left:0;top:0;width:18px;height:160px;transform-origin:0 0;cursor:pointer;z-index:3}',
    '& .rp-peek i{position:absolute;left:-18px;width:30px;height:28px;border-radius:0 2px 2px 0;transition:transform .25s var(--rp-spring)}',
    '& .rp-peek i::after{content:"";position:absolute;right:6px;top:4px;bottom:4px;border-right:1.5px dashed color-mix(in srgb,var(--paper) 80%,transparent)}',
    '& .rp-peek i.a{background:radial-gradient(circle,var(--ia) 0 1.9px,transparent 2.3px) 0 0/4.6px 4.6px,var(--ia);translate:var(--ax) var(--ay)}',
    '& .rp-peek i.b{background:var(--ib);translate:var(--bx) var(--by)}',
    '& .rp-peek i.c{background:radial-gradient(circle,color-mix(in srgb,var(--ic) 70%,#e2a500) 0 1.4px,transparent 1.8px) 0 0/4px 4px,var(--ic);translate:var(--cx) var(--cy)}',
    '& .rp-peek i.c::after{border-color:color-mix(in srgb,var(--ib) 50%,transparent)}',
    '& .rp-peek:hover i{transform:translateX(5px)}& .rp-peek:hover i:nth-child(2n){transform:translateX(8px)}',
    // 盖章搜索：一张现印的传单。每打一个字就盖一个章；拼音组字时先用铅笔打草稿；回车交给软件的搜索面板
    '& .rp-s3{mix-blend-mode:normal;pointer-events:none;z-index:5}',
    '& .rp-veil{position:absolute;left:-600px;top:-600px;width:2800px;height:2100px;background:color-mix(in srgb,var(--paper) 55%,transparent);opacity:0;pointer-events:none;transition:opacity .2s}',
    '&.rp-search .rp-veil{opacity:1;pointer-events:auto}',
    '& .rp-flyer{position:absolute;left:146px;top:104px;width:920px;height:404px;transform-origin:30px -60px;transform:translate(-40px,-50px) scale(.3) rotate(-4deg);opacity:0;pointer-events:none;transition:transform .36s var(--rp-spring),opacity .16s}',
    '&.rp-search .rp-flyer{transform:rotate(-.5deg);opacity:1;pointer-events:auto}',
    '& .rp-flyer .shadow{position:absolute;inset:0;translate:10px 12px;background:radial-gradient(circle,var(--ib) 0 1.5px,transparent 1.9px) 0 0/5px 5px;opacity:.5}',
    '& .rp-flyer .sheet{position:absolute;inset:0;overflow:hidden;isolation:isolate;background-color:var(--rp-sheet);background-image:var(--rp-fiber);background-size:300px 300px;box-shadow:0 22px 50px -18px rgba(30,30,60,.4)}',
    '& .rp-flyer .pin{position:absolute;inset:0;pointer-events:none;background:var(--rp-sheet);-webkit-mask-image:var(--rp-pin);mask-image:var(--rp-pin);-webkit-mask-size:220px 220px;mask-size:220px 220px;z-index:30}',
    '& .rp-tape{position:absolute;width:110px;height:30px;background:color-mix(in srgb,var(--ic) 55%,transparent);z-index:35;-webkit-mask:linear-gradient(90deg,transparent 0,#000 4px,#000 calc(100% - 4px),transparent 100%);mask:linear-gradient(90deg,transparent 0,#000 4px,#000 calc(100% - 4px),transparent 100%);opacity:.85}',
    '& .rp-tape.l{left:-24px;top:-10px;transform:rotate(-32deg)}& .rp-tape.r{right:-26px;top:-8px;transform:rotate(28deg)}',
    '& .rp-fin{position:absolute;inset:0;padding:30px 40px 20px 44px}',
    '& .rp-fhead{display:flex;justify-content:space-between;align-items:center;gap:20px}',
    '& .rp-kick{font:700 10.5px/1 var(--mono);letter-spacing:.2em;color:var(--ib);white-space:nowrap}',
    '& .rp-fhead .keys{font:700 10.5px/1 var(--mono);letter-spacing:.12em;color:var(--ib);opacity:.8;white-space:nowrap}',
    '& .rp-fhead .keys b{display:inline-block;padding:2px 4px;margin:0 2px;border:1.5px solid var(--ib);font-weight:700}',
    '& .rp-qline{position:relative;height:96px;margin-top:10px;display:flex;align-items:center;cursor:text}',
    '& .rp-qline .glass{flex:none;width:46px;height:46px;margin-right:14px;color:var(--ia);translate:var(--ax) var(--ay)}',
    '& .rp-qline .glass svg{display:block}',
    '& .rp-stamps{display:flex;align-items:center;height:96px;min-width:0;overflow:hidden;white-space:nowrap}',
    '& .rp-ch{position:relative;display:inline-block;font:900 68px/1 var(--hei);color:var(--ib);translate:var(--bx) var(--by);margin-right:.02em;-webkit-mask-image:var(--rp-grain);mask-image:var(--rp-grain);-webkit-mask-size:180px 180px;mask-size:180px 180px}',
    '& .rp-ch::before{content:attr(data-c);position:absolute;left:0;top:0;color:var(--ia);z-index:-1;translate:calc(var(--ax) - var(--bx) + 1.5px) calc(var(--ay) - var(--by) - 1px);mix-blend-mode:multiply;opacity:.9}',
    '& .rp-ch.new{animation:rp-chs .17s cubic-bezier(.25,1.5,.45,1) both}',
    '& .rp-ch.new::before{animation:rp-reg .2s ease-out both}',
    '@keyframes rp-chs{0%{transform:scale(1.22) rotate(var(--r,0deg));opacity:.25}60%{transform:scale(.97,.94) rotate(0);opacity:1}100%{transform:none;opacity:1}}',
    '@keyframes rp-reg{0%{translate:7px -6px}100%{translate:calc(var(--ax) - var(--bx) + 1.5px) calc(var(--ay) - var(--by) - 1px)}}',
    '& .rp-ch.draft{font:400 52px/1 var(--kai);color:color-mix(in srgb,var(--ib) 55%,transparent);-webkit-mask-image:none;mask-image:none;border-bottom:2px dashed var(--ia);animation:none}',
    '& .rp-ch.draft::before{display:none}',
    '& .rp-caret{flex:none;width:4px;height:62px;margin-left:6px;background:var(--ia);animation:rp-blink 1s steps(1) infinite}',
    '@keyframes rp-blink{50%{opacity:0}}',
    '& .rp-ph{font:400 34px/1 var(--kai);color:color-mix(in srgb,var(--ib) 45%,transparent);margin-left:8px;white-space:nowrap}',
    '& .rp-qin{position:absolute;left:60px;top:0;width:600px;height:96px;opacity:0;border:0;outline:0;background:transparent;font:900 68px/1 var(--hei);color:transparent;caret-color:transparent;user-select:text}',
    '& .rp-go{flex:none;margin-left:auto;width:76px;height:76px;border-radius:50%;display:grid;place-items:center;align-content:center;gap:2px;background:var(--ia);color:var(--rp-sheet);translate:var(--ax) var(--ay);box-shadow:0 0 0 4px var(--rp-sheet),0 0 0 6.5px var(--ia);font:900 15px/1 var(--hei);letter-spacing:.1em;transition:transform .2s var(--rp-spring),opacity .2s}',
    '& .rp-go small{font:700 9px/1 var(--mono);letter-spacing:.14em;opacity:.85}',
    '& .rp-go:hover{transform:rotate(-10deg) scale(1.06)}',
    '& .rp-go.off{opacity:.28;pointer-events:none}',
    '& .rp-modes{display:flex;gap:4px;margin-top:6px;align-items:center}',
    '& .rp-mode{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px 0 6px;font:700 12px/1 var(--hei);letter-spacing:.06em;color:var(--ib);transition:transform .15s}',
    '& .rp-mode i{display:block;width:12px;height:12px;background:var(--mc,var(--ib));translate:var(--cx) var(--cy);transition:transform .2s var(--rp-spring)}',
    '& .rp-mode:hover{transform:translateY(-1px)}& .rp-mode:hover i{transform:rotate(45deg)}',
    '& .rp-mode.on{background:var(--mc,var(--ib));color:var(--mt,var(--paper))}',
    '& .rp-mode.on i{background:var(--rp-sheet);transform:scale(.6)}',
    '& .rp-modes .hint{margin-left:auto;font:700 10px/1 var(--mono);letter-spacing:.14em;color:var(--ib);opacity:.7;white-space:nowrap}',
    '& .rp-rule{margin-top:10px;border-top:3px solid var(--ib);translate:var(--bx) var(--by)}',
    '& .rp-sug{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:4px}',
    '& .rp-sug .col{min-width:0}',
    '& .rp-sug .lbl{display:flex;justify-content:space-between;margin:14px 0 8px;font:700 10.5px/1 var(--mono);letter-spacing:.2em;color:var(--ib);white-space:nowrap}',
    '& .rp-rst{display:flex;flex-wrap:wrap;gap:10px 12px;max-height:98px;overflow:hidden}',
    '& .rp-rstamp{position:relative;max-width:100%;padding:7px 11px;font:900 17px/1 var(--hei);color:var(--ia);border:2.5px solid var(--ia);translate:var(--ax) var(--ay);transform:rotate(var(--r,-2deg));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-mask-image:var(--rp-grain);mask-image:var(--rp-grain);-webkit-mask-size:150px;mask-size:150px;transition:transform .2s var(--rp-spring),background .15s}',
    '& .rp-rstamp.b{color:var(--ib);border-color:var(--ib);translate:var(--bx) var(--by)}',
    '& .rp-rstamp:hover,& .rp-rstamp:focus-visible{transform:rotate(0) scale(1.06);background:color-mix(in srgb,var(--ic) 45%,transparent)}',
    '& .rp-note{font:400 15.5px/1.75 var(--kai);color:var(--ib)}',
    '& .rp-note em{font-style:normal;color:var(--ia)}',
    '& .rp-ffoot{position:absolute;left:44px;right:40px;bottom:20px;display:flex;justify-content:space-between;gap:20px;padding-top:9px;border-top:1.5px dotted var(--ib);font:700 10px/1 var(--mono);letter-spacing:.16em;color:var(--ib);white-space:nowrap}',
    '& .rp-ffoot span{overflow:hidden;text-overflow:ellipsis}& .rp-ffoot span:last-child{color:var(--ia);flex:none}',
    '&.rp-rm .rp-flyer,&.rp-rm .rp-ch,&.rp-rm .rp-ch::before,&.rp-rm .rp-ctl>*,&.rp-rm .rp-heartmark{animation:none!important;transition-duration:0s!important;transition-delay:0s!important}',
    '&.rp-paused *,&.rp-rm *{animation-play-state:paused!important}',
    '&.rp-rm .sticker .rot{animation:none}',
    '@keyframes rp-spin{to{transform:rotate(360deg)}}',
    '@keyframes rp-stamp{0%{transform:scale(1.35) rotate(-14deg);opacity:.5}35%{transform:scale(.9) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(0)}}',
    '@keyframes rp-blot{0%{opacity:.9;transform:scale(.6)}100%{opacity:0;transform:scale(1.25)}}',
  ].join('\n').replace(/&/g, '.hth-' + ID);

  // 贴纸里的播放 / 暂停字形（粉版实心，镂空处露出纸色）
  var IC_ST_PLAY = '<svg width="54" height="54" viewBox="0 0 54 54"><path d="M15 6l33 21-33 21z" fill="currentColor"/></svg>';
  var IC_ST_PAUSE = '<svg width="54" height="54" viewBox="0 0 54 54" fill="currentColor"><rect x="11" y="7" width="11" height="40"/><rect x="32" y="7" width="11" height="40"/></svg>';
  var IC_PREV = '<svg width="34" height="34" viewBox="0 0 72 72" fill="currentColor"><rect x="4" y="10" width="9" height="52"/><path d="M40 10v52L13 36zM68 10v52L41 36z"/></svg>';
  var IC_NEXT = '<svg width="34" height="34" viewBox="0 0 72 72" fill="currentColor"><path d="M4 10v52l27-26zM32 10v52l27-26z"/><rect x="59" y="10" width="9" height="52"/></svg>';
  var IC_HEART = '<svg width="34" height="34" viewBox="0 0 52 52"><path d="M26 45S5 32 5 17.5C5 10 10.5 5.5 16.5 5.5c4.6 0 7.8 2.6 9.5 6 1.7-3.4 4.9-6 9.5-6C41.5 5.5 47 10 47 17.5 47 32 26 45 26 45z"/></svg>';
  var IC_CUT = '<svg width="34" height="24" viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="6" cy="6" r="4.2"/><circle cx="6" cy="18" r="4.2"/><path d="M9.6 8.2L32 17M9.6 15.8L32 7"/></svg>';
  var IC_GLASS = '<svg width="46" height="46" viewBox="0 0 46 46" fill="none" stroke="currentColor" stroke-width="5"><circle cx="19" cy="19" r="13"/><path d="M29 29l13 13" stroke-linecap="square"/></svg>';
  var IC_GLASS_S = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/><path d="M12 12l6 6"/></svg>';
  function heartMarkSVG(date) {
    return '<svg viewBox="0 0 100 100"><path d="M50 90S7 63 7 33C7 18 18 8 31 8c9 0 15.5 5 19 11.5C53.5 13 60 8 69 8c13 0 24 10 24 25 0 30-43 57-43 57z" fill="none" stroke="currentColor" stroke-width="5.5"/>' +
      '<path d="M50 80S17 59 17 35C17 24 25 17 33 17c7.5 0 12.5 4.5 17 11 4.5-6.5 9.5-11 17-11 8 0 16 7 16 18 0 24-33 45-33 45z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.5"/>' +
      '<text x="50" y="47" text-anchor="middle" font-family="Impact,\'Arial Narrow\',\'DejaVu Sans Condensed\',sans-serif" font-weight="700" font-size="17" fill="currentColor" letter-spacing="1">LOVED</text>' +
      '<text x="50" y="63" text-anchor="middle" font-family="Consolas,\'DejaVu Sans Mono\',monospace" font-weight="700" font-size="9" fill="currentColor">' + esc(date) + '</text></svg>';
  }
  // 搜索平台（和软件搜索面板的模式一一对应）
  var SEARCH_MODES = [
    { id: 'song', label: '全部', c: ['var(--ib)', 'var(--paper)'] }, { id: 'netease', label: '网易云', c: ['var(--ia)', 'var(--paper)'] },
    { id: 'qq', label: 'QQ', c: ['var(--ic)', 'var(--ib)'] }, { id: 'kugou', label: '酷狗', c: ['var(--ib)', 'var(--paper)'] },
    { id: 'qishui', label: '汽水', c: ['var(--ia)', 'var(--paper)'] }, { id: 'podcast', label: '播客', c: ['var(--ic)', 'var(--ib)'] },
  ];

  function template(uid) {
    var li = '';
    for (var i = 0; i < 6; i++) {
      li += '<li class="' + (i === 0 ? 'first' : '') + '"><button type="button" data-p="' + i + '"><i class="hl"></i><span class="n">0' + (i + 1) + '</span><span class="t"></span><span class="e"></span><span class="m"></span></button></li>';
    }
    return '' +
      '<canvas class="rp-gl"></canvas>' +
      '<div class="rp-stage rp-s1">' +
      '<button type="button" class="rp-hint" title="点这里搜索">' + IC_GLASS_S + '搜索<small>· 盖章搜索</small></button>' +
      '<button type="button" class="title-hit" title="进入沉浸模式"><span class="th-up"></span><span class="th-low"></span><span class="th-tag a">点标题 · 进入沉浸模式 →</span></button>' +
      '<div class="kicker b">NOT BLIND PRESENTS</div>' +
      '<div class="dow b"><span class="dw"></span><b class="tm"></b></div>' +
      '<div class="datecn b"></div>' +
      '<button type="button" class="hl-hit"><span class="tag a"></span></button>' +
      '<div class="head-sub b ell"></div>' +
      '<div class="lu-h b"><span class="luh-l"></span><span class="luh-r">06 ACTS</span></div>' +
      '<ol class="lineup">' + li + '</ol>' +
      '<div class="sa-h b"><span>SUPPORT ACTS · 为你挑选</span><span class="src"></span></div>' +
      '<div class="acts b"></div>' +
      '<div class="ticket"><i class="notch t"></i><i class="notch btm"></i>' +
      '<div class="stub"><small>ADMIT ONE<br>今日聆听</small><strong><span class="tk-min"></span><sub>MIN</sub></strong><small class="tk-no"></small></div>' +
      '<div class="main"><div class="row"><span>TODAY · 今日票根</span><span class="tk-seat"></span></div>' +
      '<div class="big ell"><span class="tk-big"></span> <i class="tk-sub"></i></div>' +
      '<button type="button" class="nx"><span class="ar">NEXT UP →</span><b class="nx-t"></b><span class="na nx-a"></span><span class="d nx-d"></span></button></div></div>' +
      '<div class="colo b"></div>' +
      '</div>' +
      '<div class="rp-stage rp-s2">' +
      '<div class="np b"><span class="ns"></span><span class="nt"></span></div>' +
      '<button type="button" class="rp-vhit" aria-label="此刻的歌词"><span class="vt"></span></button>' +
      '<div class="rp-heartmark"></div>' +
      '<div class="rp-ctl">' +
      '<button type="button" class="rp-g prev" title="上一首">' + IC_PREV + '</button>' +
      '<button type="button" class="rp-g nxt" title="下一首">' + IC_NEXT + '</button>' +
      '<div class="rp-ink" role="slider" tabindex="0" aria-label="音量（墨量）" aria-valuemin="0" aria-valuemax="100" title="点或左右拖那排墨点调音量（墨量）；在播放器附近滚滚轮也行"><span class="dots"></span><b>墨量<em></em></b></div>' +
      '<button type="button" class="rp-g heart" title="喜欢">' + IC_HEART + '</button>' +
      '<button type="button" class="rp-g lyr ci" title="主页歌词开关">词</button>' +
      '<button type="button" class="rp-nextq" title="接下来播放 · 打开当前队列">接下来 →<b></b></button>' +
      '</div>' +
      '<div class="rp-tearlbl">✂ 拖剪刀调进度 · 滚轮调墨量（音量）</div>' +
      '<div class="rp-tear" role="slider" aria-label="播放进度" aria-valuemin="0" aria-valuemax="100" tabindex="0"><i class="hole l"></i><i class="hole r"></i><div class="perf"></div><div class="used"></div><div class="cut">' + IC_CUT + '</div><div class="tag"></div></div>' +
      '<div class="times b"><span class="t-cur" title="点一下：已播 / 剩余"></span><span class="qt" title="换一句"></span><span class="t-dur"></span></div>' +
      '<div class="sticker" role="button" tabindex="0">' +
      '<svg class="rot" viewBox="0 0 164 164"><defs><path id="' + uid + '-cp" d="M82,82 m-64,0 a64,64 0 1,1 128,0 a64,64 0 1,1 -128,0"/></defs>' +
      '<text font-family="Impact,\'Arial Narrow\',\'DejaVu Sans Condensed\',sans-serif" font-size="16" fill="currentColor" font-weight="700"><textPath class="st-ring" href="#' + uid + '-cp" textLength="400" lengthAdjust="spacing"></textPath></text></svg>' +
      '<i class="st-blot"></i><div class="mid"><div><b class="st-t"></b><small class="st-s"></small><span class="st-g"></span></div></div></div>' +
      '</div>' +
      '<div class="rp-speck"></div>' +
      '<div class="rp-peek" title="歌单栏"><i class="a" style="top:0;rotate:-3deg"></i><i class="b" style="top:30px;rotate:2deg"></i><i class="c" style="top:62px;rotate:-1.5deg"></i><i class="a" style="top:96px;rotate:2.5deg"></i><i class="b" style="top:126px;rotate:-2deg"></i></div>' +
      '<div class="rp-stage rp-s3"><div class="rp-veil"></div>' +
      '<div class="rp-flyer" role="dialog" aria-label="盖章搜索"><div class="shadow"></div><div class="sheet">' +
      '<div class="rp-fin"><div class="rp-fhead"><span class="rp-kick">HANDBILL · 现印传单 · 盖章搜索</span><span class="keys"><b>↵</b>开印 <b>Tab</b>换平台 <b>Esc</b>擦掉 / 收起</span></div>' +
      '<div class="rp-qline"><span class="glass">' + IC_GLASS + '</span><div class="rp-stamps"></div><span class="rp-ph">输入歌名，每个字都会盖上去……</span><i class="rp-caret"></i>' +
      '<input class="rp-qin" type="text" autocomplete="off" spellcheck="false" aria-label="搜索歌曲、歌手、歌单">' +
      '<button type="button" class="rp-go off" title="开印 · 搜索">开印<small>ENTER</small></button></div>' +
      '<div class="rp-modes"></div><div class="rp-rule"></div>' +
      '<div class="rp-sug"><div class="col l"></div><div class="col r"></div></div></div>' +
      '<div class="rp-ffoot"><span class="f1"></span><span class="f2">RISO · 3 INKS · 油墨未干，请勿折叠</span></div>' +
      '<div class="pin"></div></div><i class="rp-tape l"></i><i class="rp-tape r"></i></div></div>';
  }

  // ---------- shaders ----------
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var COMMON = 'precision highp float;\n' +
    'uniform vec2 uRes;uniform vec4 uSt;\n' +
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n' +
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}\n' +
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}\n' +
    'vec2 designPos(){vec2 css=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uSt.w;return (css-uSt.xy)/uSt.z;}\n' +
    'const vec4 CR=vec4(' + CR.map(function (v) { return v.toFixed(1); }).join(',') + ');\n' +
    'vec2 cuv(vec2 d){return (d-CR.xy)/(CR.zw-CR.xy);}\n';
  // 静态 pass：版面文字 × 墨层密度 / 颗粒 + 纸面。只在尺寸或套准偏移变化时重画。
  // 边缘毛糙（原稿里的 SVG feTurbulence）在这里用噪声位移实现，只作用于印版文字（巨型标题等）。
  var FS_STATIC = COMMON +
    'uniform sampler2D uTex,uVTex;uniform vec2 oA,oB,oC,oV;uniform float uMode;\n' +
    'vec2 suv(vec2 d){vec2 p=(d*uSt.z+uSt.xy)*uSt.w;return vec2(p.x,uRes.y-p.y)/uRes;}\n' +
    'float inkK(vec2 d,float sd){float dens=.78+.14*vn(d*.011+sd)+.08*vn(d*.05+sd);dens*=.95+.05*vn(vec2(d.y*.06+sd,sd));' +
    'float tooth=vn(d*1.3+sd*3.);float g=h21(floor(gl_FragCoord.xy)+sd*31.);return clamp(dens*(1.-.28*smoothstep(.62,.95,tooth))*(.88+.12*g),0.,1.);}\n' +
    'void main(){vec2 d=designPos();\n' +
    ' vec2 wob=(vec2(vn(d*.28),vn(d*.28+7.))-.5)*1.3+(vec2(vn(d*.9+3.1),vn(d*.9+8.7))-.5)*1.2;\n' +
    ' float kA=inkK(d,1.7),kB=inkK(d,5.3),kC=inkK(d,9.1);\n' +
    ' if(uMode>.5){gl_FragColor=vec4(kA,kB,kC,1.);return;}\n' +
    ' float tA=texture2D(uTex,suv(d-oA+wob)).r;float tB=texture2D(uTex,suv(d-oB+wob)).g;float tC=texture2D(uTex,suv(d-oC+wob)).b;\n' +
    // [歌词位] 粉版竖排歌词单独一张纹理、单独一个套准偏移：换句时只有它抖，别的版不动
    ' tA=max(tA,texture2D(uVTex,suv(d-oV+wob)).r);\n' +
    ' float f1=smoothstep(.66,.74,vn(vec2(d.x*.07,d.y*.9)));\n' +
    ' float f2=smoothstep(.68,.76,vn(mat2(.8,.6,-.6,.8)*d*vec2(.06,.85)+3.));\n' +
    ' float f3=smoothstep(.7,.78,vn(mat2(.3,-.95,.95,.3)*d*vec2(.05,.7)+11.));\n' +
    ' float mot=fbm(d*.005);\n' +
    ' float pa=(.955+.06*mot)-(f1+f2+f3)*.032+(h21(gl_FragCoord.xy*.7)-.5)*.04;\n' +
    ' gl_FragColor=vec4(tA*kA,tB*kB,tC*kC,pa/1.1);}';
  // 画面 pass：输出三色墨量（r=粉 g=蓝 b=黄）+ 封面边缘遮罩。有封面时对封面做分色，否则画程序生成的"海边日落"。
  var FS_SCENE = COMMON +
    'uniform float uT,uHas,uSeed,uMove,uGam;uniform vec2 uLv;uniform sampler2D uCov;uniform vec4 uFit;\n' +
    'float inC(vec2 d){vec2 c=cuv(d);float e=.03*(vn(d*.02)-.5);vec2 m=smoothstep(-.01,.05,c+e)*smoothstep(-.01,.05,1.-c+e);return m.x*m.y;}\n' +
    'vec3 scene(vec2 c,float t){\n' +
    ' float hz=.585+(fract(uSeed*7.31)-.5)*.1+.004*sin(c.x*7.+t*.5);vec2 q=vec2(c.x*1.22,c.y);\n' +
    ' vec2 sp=vec2((.45+.3*uSeed)*1.22,hz-.185+.008*sin(t*.35));float sd=length(q-sp);\n' +
    ' float sun=smoothstep(.175,.168,sd)*step(c.y,hz);float glow=exp(-sd*3.2);float up=c.y/hz;\n' +
    ' float cl=vn(vec2(c.x*2.6+t*.02+uSeed*9.,c.y*11.))*.65+vn(vec2(c.x*5.3,c.y*23.)+4.+uSeed*5.)*.35;\n' +
    ' float band=smoothstep(.55,.75,cl)*smoothstep(.1,.5,up);\n' +
    ' vec3 sky=vec3(.12+.62*up*up+.35*glow+.25*band,.62*(1.-up)*(1.-up)+.12*band*(1.-glow),.06+.95*glow*glow+.2*up);\n' +
    ' sky=mix(sky,vec3(.55,0.,1.),sun);float dp=clamp((c.y-hz)/(1.-hz),0.,1.);\n' +
    ' float wv=sin(3.2/(c.y-hz+.035)-t*1.3+(vn(c*vec2(5.,26.)+t*.05)*.7+vn(c*vec2(11.,52.))*.3)*5.);\n' +
    ' float rw=.035+.2*dp;float rx=(q.x-sp.x)/rw;float refl=exp(-rx*rx)*smoothstep(-.3,.8,wv)*(1.-.3*dp);\n' +
    ' vec3 sea=vec3(.3+.2*wv*(1.-dp)+.5*refl,.3+.32*dp+.14*wv-.5*refl,.04+.95*refl+.08*(1.-dp));\n' +
    ' vec3 r=mix(sky,sea,smoothstep(hz-.002,hz+.002,c.y));return clamp(r*(1.+.05*sin(t*.9)),0.,1.);}\n' +
    // 分色：RGB → 粉 / 蓝 / 黄 三块版的墨量
    'vec3 sep(vec2 c,float t){float z=1.+.02*uMove*sin(t*.21);vec2 cc=(c-.5)/z+.5+uMove*vec2(.006*sin(t*.17),.005*cos(t*.13));\n' +
    ' vec2 uv=uFit.xy+clamp(cc,0.,1.)*uFit.zw;vec3 rgb=texture2D(uCov,vec2(uv.x,1.-uv.y)).rgb;\n' +
    ' rgb=clamp((rgb-uLv.x)/max(uLv.y-uLv.x,.05),0.,1.);rgb=pow(rgb,vec3(uGam));\n' +
    ' float L=dot(rgb,vec3(.3,.59,.11));rgb=clamp(mix(vec3(L),rgb,1.55),0.,1.);\n' +
    ' vec3 cmy=1.-rgb;float k=min(min(cmy.x,cmy.y),cmy.z);vec3 ch=cmy-k;\n' +
    // 暗部主要走蓝版，彩色部分各走各的版，避免三色叠成一片泥
    ' float b=clamp(ch.x*.85+k*1.02-.04,0.,1.);\n' +
    ' float a=clamp(ch.y*1.1+k*.22-.03,0.,1.);\n' +
    ' float y=clamp(ch.z*1.08+k*.12-.03,0.,1.);\n' +
    ' vec3 v=vec3(a,b,y);float tot=v.x+v.y+v.z;v*=min(1.,1.45/max(tot,.001));\n' +
    ' return v*.92;}\n' +
    'void main(){vec2 c=vec2(gl_FragCoord.x/' + SW + '.,1.-gl_FragCoord.y/' + SH + '.);vec2 d=CR.xy+c*(CR.zw-CR.xy);\n' +
    ' vec3 v=uHas>.5?sep(c,uT):scene(c,uT);gl_FragColor=vec4(v,inC(d));}';
  // 合成 pass：三块网点屏 + 印版 + 纸，正片叠底
  var FS_DYN = COMMON +
    'uniform sampler2D uS0,uS1,uSc;uniform float uT,uMOn,uFlash;uniform vec2 uM,oA,oB,oC;uniform vec3 uA,uB,uC,uP;\n' +
    'const vec3 KO=vec3(' + KO.map(function (v) { return v.toFixed(1); }).join(',') + ');\n' +
    'float gN;\n' +
    'float ht(vec2 d,float ang,float cell,int ch){vec2 m=uM;float L=exp(-dot(d-m,d-m)/(170.*170.))*uMOn;vec2 w=m+(d-m)*(1.-.58*L);\n' +
    ' float ca=cos(ang),sa=sin(ang);vec2 q=mat2(ca,sa,-sa,ca)*w/cell;vec2 id=floor(q)+.5;vec2 f=q-id;vec2 cc=mat2(ca,-sa,sa,ca)*(id*cell);\n' +
    ' vec2 c=cuv(cc);if(c.x<-.02||c.x>1.02||c.y<-.02||c.y>1.02)return 0.;\n' +
    ' vec4 s=texture2D(uSc,vec2(c.x,1.-c.y));if(s.a<=.01)return 0.;\n' +
    ' float tone=ch==0?s.x:(ch==1?s.y:s.z);tone=clamp(tone*(1.+.35*L)+.08*L,0.,1.)*s.a;\n' +
    ' if(ch<2)tone*=smoothstep(KO.z,KO.z+4.,length(cc-KO.xy));\n' +
    ' float r=sqrt(tone)*.74;float dist=length(f)+(fract(gN*(1.+float(ch)*1.618))-.5)*.14;\n' +
    ' float aa=1.1/(cell*uSt.z*uSt.w)*(1.-.58*L);return smoothstep(r+aa,r-aa,dist)*step(.03,tone);}\n' +
    'void main(){vec2 d=designPos();vec2 uv=gl_FragCoord.xy/uRes;vec4 s0=texture2D(uS0,uv);float cA=s0.r,cB=s0.g,cC=s0.b;\n' +
    ' if(d.x>CR.x-24.&&d.x<CR.z+24.&&d.y>CR.y-24.&&d.y<CR.w+24.){gN=vn(d*.7);vec3 k=texture2D(uS1,uv).rgb;\n' +
    '  float ko=smoothstep(.15,.5,s0.g);float hA=ht(d-oA,.2618,8.5,0)*(1.-.6*ko);float hB=ht(d-oB,.7854,8.5,1)*(1.-ko);float hC=ht(d-oC,1.309,10.,2)*(1.-.45*ko);\n' +
    '  vec2 cq=cuv(d);float em=smoothstep(-.003,.001,min(min(cq.x,cq.y),min(1.-cq.x,1.-cq.y))+(gN-.5)*.01);\n' +
    '  cA=max(cA,hA*k.r*em);cB=max(cB,hB*k.g*em);cC=max(cC,hC*k.b*em);}\n' +
    ' float fr=floor(uT*20.);\n' +
    ' cA*=1.+uFlash*(h21(vec2(1.7,fr))-.5)*.35;cB*=1.+uFlash*(h21(vec2(5.3,fr))-.5)*.35;cC*=1.+uFlash*(h21(vec2(9.1,fr))-.5)*.35;\n' +
    ' vec3 col=uP*(s0.a*1.1);col*=mix(vec3(1.),uC,clamp(cC,0.,1.));col*=mix(vec3(1.),uA,clamp(cA,0.,1.));col*=mix(vec3(1.),uB,clamp(cB,0.,1.));\n' +
    ' vec2 vv=gl_FragCoord.xy/uRes-.5;col*=1.-.12*dot(vv,vv);gl_FragColor=vec4(col,1.);}';

  function createRiso(root, ctx) {
    var A = ctx.actions || {};
    var RM = !!ctx.reducedMotion;
    var uid = 'rp' + Math.floor(Math.random() * 1e9).toString(36);
    var dead = false, paused = false;
    var timers = [];
    function later(fn, ms) { var t = setTimeout(function () { timers = timers.filter(function (x) { return x !== t; }); if (!dead) fn(); }, ms); timers.push(t); return t; }
    function call(name) {
      var args = [].slice.call(arguments, 1);
      try { if (typeof A[name] === 'function') return A[name].apply(A, args); } catch (e) { console.warn('[riso-poster] action ' + name, e); }
    }

    ctx.injectStyle('theme-' + ID, CSS);
    root.innerHTML = template(uid);
    // [二改] 搜索章的透明点击区（不跟着海报缩放，见样式里的说明）
    var hintHit = document.createElement('button');
    hintHit.type = 'button'; hintHit.className = 'rp-hint-hit'; hintHit.setAttribute('aria-label', '搜索'); hintHit.title = '点这里搜索';
    root.appendChild(hintHit);
    if (RM) root.classList.add('rp-rm');
    var $ = function (s) { return root.querySelector(s); };
    var sheet = typeof homeThemeListSheet === 'function' ? homeThemeListSheet(root.parentNode || root, {
      variant: 'riso', ctx: ctx,
      keepOpenFor: function (t) { return !!(t && t.closest && E && E.lineBtns && E.lineBtns.some(function (b) { return b === t || b.contains(t); })); }
    }) : null;
    var E = {
      cv: $('.rp-gl'), stages: [].slice.call(root.querySelectorAll('.rp-stage')), speck: $('.rp-speck'),
      hint: $('.rp-hint'), dw: $('.dw'), tm: $('.tm'), datecn: $('.datecn'), hlHit: $('.hl-hit'), hlTag: $('.hl-hit .tag'), headSub: $('.head-sub'),
      luhL: $('.luh-l'), luhR: $('.luh-r'), lis: [].slice.call(root.querySelectorAll('.lineup li')),
      src: $('.sa-h .src'), acts: $('.acts'),
      tkMin: $('.tk-min'), tkNo: $('.tk-no'), tkSeat: $('.tk-seat'), tkBig: $('.tk-big'), tkSub: $('.tk-sub'),
      nx: $('.nx'), nxT: $('.nx-t'), nxA: $('.nx-a'), nxD: $('.nx-d'), colo: $('.colo'),
      ns: $('.np .ns'), nt: $('.np .nt'), prev: $('.rp-g.prev'), next: $('.rp-g.nxt'),
      like: $('.rp-g.heart'), lyr: $('.rp-g.lyr'), ink: $('.rp-ink'), inkEm: $('.rp-ink em'), dots: $('.rp-ink .dots'), nextq: $('.rp-nextq'), nextqB: $('.rp-nextq b'),
      tear: $('.rp-tear'), used: $('.rp-tear .used'), cut: $('.rp-tear .cut'), tag: $('.rp-tear .tag'), mark: $('.rp-heartmark'), peek: $('.rp-peek'),
      tCur: $('.t-cur'), tDur: $('.t-dur'), qt: $('.times .qt'), vhit: $('.rp-vhit'), vt: $('.rp-vhit .vt'), sticker: $('.sticker'), stRing: $('.st-ring'), stT: $('.st-t'), stS: $('.st-s'), stG: $('.st-g'),
      veil: $('.rp-veil'), flyer: $('.rp-flyer'), stamps: $('.rp-stamps'), ph: $('.rp-ph'), qin: $('.rp-qin'), go: $('.rp-go'), modes: $('.rp-modes'),
      sugL: $('.rp-sug .l'), sugR: $('.rp-sug .r'), f1: $('.rp-ffoot .f1'),
    };
    E.lineBtns = E.lis.map(function (li) { return li.querySelector('button'); });
    function txt(el, s) { s = s == null ? '' : String(s); if (el && el.textContent !== s) el.textContent = s; }
    function attr(el, k, v) { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); }

    // ---------- 调色 / 套准 ----------
    var palIdx = 0, pal = PAL[0];
    var cur = { a: hex(pal.a), b: hex(pal.b), c: hex(pal.c), p: hex(pal.p) };
    var REST = { A: [1.6, -1.1], B: [-1.2, 1.3], C: [2.4, 2.1] };
    var off = { A: REST.A.slice(), B: REST.B.slice(), C: REST.C.slice() };
    var flash = 0, staticDirty = true;
    function applyCSS() {
      root.style.setProperty('--ia', pal.a); root.style.setProperty('--ib', pal.b);
      root.style.setProperty('--ic', pal.c); root.style.setProperty('--paper', pal.p);
      txt(E.colo, 'RISO · 3 INKS · ' + pal.name + ' · 157 GSM');
    }
    function applyOff() {
      ['A', 'B', 'C'].forEach(function (p) {
        var l = p.toLowerCase();
        root.style.setProperty('--' + l + 'x', off[p][0].toFixed(1) + 'px');
        root.style.setProperty('--' + l + 'y', off[p][1].toFixed(1) + 'px');
      });
      staticDirty = true;
    }

    // ---------- 尺寸 ----------
    var S = 1, OX = 0, OY = 0, DPR = 1, VW = 0, VH = 0, titleTop = 158;
    var gl = null, flat = false;
    try { gl = E.cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false }); } catch (_e) { gl = null; }
    var pc = document.createElement('canvas'), px = pc.getContext('2d');
    // [歌词位] 竖排歌词单独画在这张（红 = 粉版），好让它自己抖
    var vc = document.createElement('canvas'), vx = vc.getContext('2d'), vJit = [0, 0], vShakeT = 0;
    // 退回 2D 平面印刷：没有 WebGL，或着色器编译 / 上下文恢复失败时都走这里
    function useFlat() {
      if (flat) return;
      flat = true; ready = false;
      pc.className = 'rp-flat';
      if (E.cv.parentNode) E.cv.parentNode.replaceChild(pc, E.cv);
    }
    if (!gl) useFlat();

    function measureRoot(w, h) {
      VW = root.clientWidth || w || window.innerWidth;
      VH = root.clientHeight || h || window.innerHeight;
    }
    function placeHintHit() {
      if (!E.hint || !hintHit) return;
      var rr = root.getBoundingClientRect(), hr = E.hint.getBoundingClientRect();
      if (!hr.width) return;
      var padX = 16, padY = 12;
      hintHit.style.left = Math.round(hr.left - rr.left - padX) + 'px';
      hintHit.style.top = Math.round(Math.max(0, hr.top - rr.top - padY)) + 'px';
      hintHit.style.width = Math.round(hr.width + padX * 2) + 'px';
      hintHit.style.height = Math.round(hr.bottom - rr.top + padY - Math.max(0, hr.top - rr.top - padY)) + 'px';
    }
    function layout(w, h) {
      measureRoot(w, h);
      S = Math.min(VW / W0, VH / H0); OX = (VW - W0 * S) / 2; OY = (VH - H0 * S) / 2;
      var tr = 'translate(' + OX.toFixed(2) + 'px,' + OY.toFixed(2) + 'px) scale(' + S.toFixed(5) + ')';
      E.stages.forEach(function (s) { s.style.transform = tr; });
      // 左边缘的票根摞：跟着歌单栏的起始高度走（主页上歌单栏从 y≈172 开始）
      var K = Math.max(0.9, Math.min(1.6, S)), PT = Math.max(172, Math.round(VH * 0.21));
      E.peek.style.transform = 'translate(0,' + Math.round(PT + (VH - PT) * 0.26) + 'px) scale(' + K.toFixed(4) + ')';
      DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      // 左上角拉绳区（屏幕 x<90, y<150）要留空：标题顶部按当前缩放推算
      titleTop = Math.round(Math.max(132, Math.min(196, 158 / S)));
      E.stages.forEach(function (st) { st.style.setProperty('--tt', titleTop + 'px'); });
      titleCache = null;
      placeHintHit();
      var cw = Math.max(1, Math.round(VW * DPR)), ch = Math.max(1, Math.round(VH * DPR));
      if (!flat) { E.cv.width = cw; E.cv.height = ch; }
      pc.width = cw; pc.height = ch;
      if (!flat) { vc.width = cw; vc.height = ch; } else { vc.width = vc.height = 1; }
      drawPlates();
      if (gl && ready) { gl.viewport(0, 0, cw, ch); sizeFBO(); }
      if (speckStale()) scheduleSpeck();
    }

    // ---------- 印版：R=粉 A，G=蓝 B，B=黄 C ----------
    var model = null, titleCache = null, plateState = null;
    function regMark(x, y) { px.lineWidth = 1.6; px.beginPath(); px.arc(x, y, 8, 0, 7); px.moveTo(x - 14, y); px.lineTo(x + 14, y); px.moveTo(x, y - 14); px.lineTo(x, y + 14); px.stroke(); }
    function fitText(t, maxW) { var w = px.measureText(t).width; if (w > maxW) px.scale(maxW / w, 1); px.fillText(t, 0, 0); }

    // 竖排海报字：逗号顿号换成一格空白，句末标点去掉（竖着印的横排标点很别扭）
    function vertPunct(t) { return String(t).trim().replace(/[，、；：,;:]\s*/g, '\u3000').replace(/[。．.！!？?…～~]+/g, '\u3000').replace(/\u3000+$/, '').replace(/\s+$/, ''); }
    function lyricInfo() {
      // 提前 0.15 秒换上下一句（和这个主题换句动画的长短配好，开唱时新句已经显示出来）
      var o = { lead: 0.15 };
      try { if (ctx.lyric) return ctx.lyric(o); if (typeof homeThemeLyric === 'function') return homeThemeLyric(o); } catch (_e) { }
      return null;
    }
    function plateData() {
      var m = model || {}, now = m.now, c = m.clock || {};
      var title = now ? now.title : '今晚还没有节目';
      var mon = Number(c.month) || 1, day = Number(c.day) || 1;
      var wd = WD_CN.indexOf(c.weekday);
      var tag = MON_EN[(mon - 1 + 12) % 12] + ' ' + day + (wd >= 0 ? ' · ' + WD_EN[wd] : '');
      var parts = splitTitle(title);
      var vert;
      var L = lyricInfo(), vk = '';
      if (!now) vert = 'NO SHOW YET · ' + tag + ' · STAGE OPEN';
      else if (L && (L.state === 'line' || L.state === 'paused') && L.text) { vert = CJK_RE.test(L.text) ? vertPunct(L.text) : String(L.text).trim().toUpperCase(); vk = 'ly'; }
      else if (m.quote && m.quote.text) { vert = vertPunct(m.quote.text); vk = 'q'; }
      else if (parts.sub) vert = parts.sub.toUpperCase();
      else if (!CJK_RE.test(title)) vert = title.toUpperCase();
      else vert = 'ONE NIGHT ONLY · ' + tag;
      var artist = now ? (now.artist || '未知歌手') : (m.login && m.login.any ? '选一首 · 开场' : '登录 · 开场');
      // 叠印数字：取日期的末位（整十日取十位），像海报上的场次号
      var digit = day % 10 ? String(day % 10) : String(Math.floor(day / 10) || 1);
      return { title: title, vert: vert, vk: vk, artist: artist, date: mon + '.' + day, digit: digit, empty: !now, artistLatin: !CJK_RE.test(artist) };
    }

    function drawVertical(text, x, y0, L) {
      var fs0 = 58;
      function runsOf(t) {
        var runs = [];
        Array.from(t).forEach(function (ch) {
          var cj = CJK_RE.test(ch), last = runs[runs.length - 1];
          if (last && last.cjk === cj) last.t += ch; else runs.push({ cjk: cj, t: ch });
        });
        return runs;
      }
      function len(runs, fs) {
        var tot = 0;
        runs.forEach(function (r) {
          if (r.cjk) tot += Array.from(r.t).length * fs * 0.92;
          else { px.font = '700 ' + fs + 'px ' + DISP; tot += px.measureText(r.t).width; }
        });
        return tot;
      }
      var runs = runsOf(text), fs = fs0, tot = len(runs, fs), sq = 1;
      var k = L / tot;
      if (k >= 1) { fs = Math.min(64, fs0 * k); tot = len(runs, fs); }
      else if (k >= 0.72) sq = k;
      else {
        sq = 0.72; fs = Math.max(34, fs0 * k / 0.72); tot = len(runs, fs);
        var chars = Array.from(text);
        while (tot * sq > L && chars.length > 3) { chars.pop(); runs = runsOf(chars.join('').replace(/[\s·]+$/, '') + '…'); tot = len(runs, fs); }
      }
      px.save(); px.translate(x, y0); px.rotate(Math.PI / 2); px.scale(sq, 1);
      var cx = 0;
      runs.forEach(function (r) {
        if (r.cjk) {
          px.font = '900 ' + (fs * 0.84).toFixed(1) + 'px ' + HEI;
          Array.from(r.t).forEach(function (ch) {
            px.save(); px.translate(cx + fs * 0.46, -fs * 0.37); px.scale(1 / sq, sq); px.rotate(-Math.PI / 2);
            px.textAlign = 'center'; px.textBaseline = 'middle'; px.fillText(ch, 0, 0); px.restore();
            cx += fs * 0.92;
          });
        } else {
          px.font = '700 ' + fs + 'px ' + DISP; px.textAlign = 'left'; px.textBaseline = 'alphabetic';
          px.fillText(r.t, cx, 0); cx += px.measureText(r.t).width;
        }
      });
      px.restore();
    }

    function drawArtist(name, latinTag) {
      // 横幅（黄版底条）上的主演名：先缩字号，再横向压缩，最后省略
      var maxW = 420, fs = 44;
      px.font = '900 ' + fs + 'px ' + HEI;
      var w = px.measureText(name).width;
      if (w > maxW) { fs = Math.max(28, fs * maxW / w); px.font = '900 ' + fs + 'px ' + HEI; w = px.measureText(name).width; }
      var sq = 1;
      if (w > maxW) { sq = Math.max(0.8, maxW / w); }
      var shown = name;
      if (w * sq > maxW) {
        var ch = Array.from(name);
        while (ch.length > 1 && px.measureText(ch.join('') + '…').width * sq > maxW) ch.pop();
        shown = ch.join('').replace(/[\s/·]+$/, '') + '…';
        w = px.measureText(shown).width;
      }
      px.save(); px.translate(1130, 340 - (44 - fs) * 0.28); px.scale(sq, 1); px.fillText(shown, 0, 0); px.restore();
      var used = w * sq;
      if (latinTag && used + 20 + 150 < maxW + 10) {
        px.font = '700 30px ' + DISP;
        px.fillText(latinTag, 1130 + used + 16, 338);
      }
    }

    function drawVert(text, doUpload) {
      if (flat || !vc.width) return;
      var keep = px; px = vx;
      try {
        px.setTransform(1, 0, 0, 1, 0, 0); px.globalCompositeOperation = 'source-over';
        px.fillStyle = '#000'; px.fillRect(0, 0, vc.width, vc.height);
        px.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
        px.fillStyle = '#ff0000'; px.textBaseline = 'alphabetic'; px.textAlign = 'left';
        drawVertical(text, 1040, 68, 804);
        px.setTransform(1, 0, 0, 1, 0, 0);
      } finally { px = keep; }
      if (doUpload) uploadV();
    }
    // 换一句：只有竖排歌词这一版抖一下再归位（别的版、整张海报都不动）
    function shakeV() {
      if (vShakeT) { clearInterval(vShakeT); vShakeT = 0; }
      if (RM || paused || flat) { vJit = [0, 0]; staticDirty = true; once(); return; }
      var n = 0;
      vShakeT = setInterval(function () {
        if (dead) { clearInterval(vShakeT); vShakeT = 0; return; }
        n++;
        var amp = n < 7 ? 9 - n : 0;
        vJit = n >= 8 ? [(Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2] : [(Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp];
        if (n >= 8) { clearInterval(vShakeT); vShakeT = 0; }
        staticDirty = true; once();
      }, 46);
    }
    function drawPlates() {
      if (!pc.width) return;
      var d = plateState = plateData();
      if (!titleCache || titleCache.key !== d.title + '|' + titleTop) {
        titleCache = { key: d.title + '|' + titleTop, lay: layoutTitle(d.title, titleTop) };
      }
      var lay = titleCache.lay;
      px.setTransform(1, 0, 0, 1, 0, 0);
      var A_ = '#ff0000', B_ = '#00ff00', C_ = '#0000ff';
      if (flat) {
        px.globalCompositeOperation = 'source-over'; px.fillStyle = pal.p; px.fillRect(0, 0, pc.width, pc.height);
        px.globalCompositeOperation = 'multiply'; A_ = pal.a; B_ = pal.b; C_ = pal.c;
      } else {
        px.globalCompositeOperation = 'source-over'; px.fillStyle = '#000'; px.fillRect(0, 0, pc.width, pc.height);
        px.globalCompositeOperation = 'lighter';
      }
      px.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
      px.textBaseline = 'alphabetic'; px.textAlign = 'left';

      // --- C 黄版：叠印数字、贴纸底、主演横幅 ---
      px.fillStyle = C_; px.strokeStyle = C_;
      px.save(); px.translate(30, 898); px.rotate(-0.12); px.font = '400 620px ' + DISP; px.fillText(d.digit, 0, 0); px.restore();
      px.beginPath(); px.arc(KO[0], KO[1], 80, 0, 7); px.fill();
      px.fillRect(1122, 296, 436, 52);
      regMark(1582, 214); regMark(1578, 880); regMark(22, 448);
      px.fillRect(1034, 46, 12, 12);

      // --- A 粉版：日期、竖排副标题 ---
      px.fillStyle = A_; px.strokeStyle = A_;
      px.font = '700 140px ' + DISP;
      px.save(); px.translate(1116, 262); fitText(d.date, 300); px.restore();
      if (flat) drawVertical(d.vert, 1040, 68, 804); else drawVert(d.vert, false);
      regMark(1582, 214); regMark(1578, 880); regMark(22, 448);
      px.fillRect(1034, 14, 12, 12);

      // --- B 蓝版：巨型标题 + 主演 ---
      px.fillStyle = B_; px.strokeStyle = B_;
      px.save(); px.translate(T_X0, titleTop); px.rotate(-T_TILT);
      lay.lines.forEach(function (ln) {
        px.save(); px.font = lay.font(ln.size.toFixed(1)); px.translate(ln.x, ln.y); px.scale(ln.sx, 1); px.fillText(ln.text, 0, 0); px.restore();
      });
      px.restore();
      drawArtist(d.artist, d.empty ? 'TONIGHT' : (d.artistLatin ? '' : 'HEADLINER'));
      regMark(1582, 214); regMark(1578, 880); regMark(22, 448);
      px.fillRect(1034, 30, 12, 12);
      px.globalCompositeOperation = 'source-over';
      upload();
    }

    // ---------- 纸面斑点（纸从墨层里透出来的针孔） ----------
    var speckUrl = '', speckTimer = 0, speckW = 0, speckH = 0;
    function speckSize() { return [Math.min(1920, Math.ceil(VW)), Math.min(1080, Math.ceil(VH))]; }
    // 遮罩按 100% 拉伸，尺寸变化不大（≤12%）时看不出来，不必重新生成
    function speckStale() {
      if (!speckUrl) return true;
      var s = speckSize();
      return Math.abs(s[0] - speckW) > speckW * 0.12 || Math.abs(s[1] - speckH) > speckH * 0.12;
    }
    function scheduleSpeck() {
      if (speckTimer) clearTimeout(speckTimer);
      speckTimer = setTimeout(function () { speckTimer = 0; if (!dead) makeSpeck(); }, speckUrl ? 180 : 0);
    }
    function makeSpeck() {
      var sz = speckSize(), w = sz[0], h = sz[1];
      if (w < 2 || h < 2) return;
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'), id = x.createImageData(w, h), dd = id.data;
      var G = 48, gw = Math.ceil(w / G) + 2, gh = Math.ceil(h / G) + 2, grid = new Float32Array(gw * gh);
      for (var i = 0; i < grid.length; i++) grid[i] = Math.random();
      for (var y = 0; y < h; y++) {
        var gy = y / G, iy = gy | 0, fy = gy - iy, sy = fy * fy * (3 - 2 * fy);
        for (var xx = 0; xx < w; xx++) {
          var gx = xx / G, ix = gx | 0, fx = gx - ix, sx = fx * fx * (3 - 2 * fx);
          var a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1], cc = grid[(iy + 1) * gw + ix], d2 = grid[(iy + 1) * gw + ix + 1];
          var top = a + (b - a) * sx, n = top + ((cc + (d2 - cc) * sx) - top) * sy;
          var al = 0.07 * n;
          if (Math.random() < 0.035 + 0.07 * n * n) al = 0.35 + 0.5 * Math.random();
          dd[(y * w + xx) * 4 + 3] = al * 255;
        }
      }
      x.putImageData(id, 0, 0);
      c.toBlob(function (blob) {
        if (dead || !blob) return;
        var url = URL.createObjectURL(blob);
        E.speck.style.webkitMaskImage = E.speck.style.maskImage = 'url(' + url + ')';
        E.speck.classList.add('on');
        if (speckUrl) { var old = speckUrl; setTimeout(function () { URL.revokeObjectURL(old); }, 500); }
        speckUrl = url; speckW = w; speckH = h;
      });
    }

    // ---------- WebGL ----------
    var U0 = {}, U1 = {}, U2 = {}, progS = null, progD = null, progSc = null, tex = null, vtex = null, covTex = null, vbuf = null, shaders = [];
    var fbo = [], ftex = [], ready = false;
    var cover = { url: '', has: 0, fit: [0, 0, 1, 1], seed: 0.5, gam: 1, lv: [0, 1], loadId: 0 };
    function sh(t, s) {
      var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); shaders.push(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    }
    function mkProg(fs, names, U) {
      var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      names.forEach(function (n) { U[n] = gl.getUniformLocation(p, n); });
      return p;
    }
    function mkTex() {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function initGL() {
      progS = mkProg(FS_STATIC, ['uRes', 'uSt', 'uTex', 'uVTex', 'oA', 'oB', 'oC', 'oV', 'uMode'], U0);
      progD = mkProg(FS_DYN, ['uRes', 'uSt', 'uS0', 'uS1', 'uSc', 'uT', 'uMOn', 'uFlash', 'uM', 'oA', 'oB', 'oC', 'uA', 'uB', 'uC', 'uP'], U1);
      progSc = mkProg(FS_SCENE, ['uRes', 'uSt', 'uT', 'uHas', 'uSeed', 'uMove', 'uGam', 'uLv', 'uCov', 'uFit'], U2);
      vbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      tex = mkTex(); vtex = mkTex(); covTex = mkTex();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
      for (var i = 0; i < 3; i++) { ftex[i] = mkTex(); fbo[i] = gl.createFramebuffer(); }
      gl.bindTexture(gl.TEXTURE_2D, ftex[2]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SW, SH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[2]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ftex[2], 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      ready = true;
    }
    function sizeFBO() {
      if (!gl || !ready) return;
      for (var i = 0; i < 2; i++) {
        gl.bindTexture(gl.TEXTURE_2D, ftex[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, E.cv.width, E.cv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ftex[i], 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); staticDirty = true;
    }
    function upload() {
      if (!gl || !ready) return;
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pc);
      uploadV();
      staticDirty = true;
    }
    function uploadV() {
      if (!gl || !ready || !vtex) return;
      gl.bindTexture(gl.TEXTURE_2D, vtex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vc);
      staticDirty = true;
    }
    function staticPass() {
      gl.useProgram(progS); gl.viewport(0, 0, E.cv.width, E.cv.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U0.uTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, vtex); gl.uniform1i(U0.uVTex, 1); gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(U0.uRes, E.cv.width, E.cv.height); gl.uniform4f(U0.uSt, OX, OY, S, DPR);
      gl.uniform2fv(U0.oA, off.A); gl.uniform2fv(U0.oB, off.B); gl.uniform2fv(U0.oC, off.C);
      gl.uniform2f(U0.oV, off.A[0] + vJit[0], off.A[1] + vJit[1]);
      for (var i = 0; i < 2; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.uniform1f(U0.uMode, i); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); staticDirty = false;
    }

    // 封面：按 API 要求用 THREE.TextureLoader（crossOrigin=anonymous）取图，再缩到 ≤512 画进自己的纹理
    function loadCover(url) {
      cover.url = url;
      var id = ++cover.loadId;
      if (!url) { setCoverFallback(); return; }
      var done = function (img) {
        if (dead || id !== cover.loadId) return;
        try {
          var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
          if (!iw || !ih) throw new Error('empty image');
          var k = Math.min(1, 512 / Math.max(iw, ih));
          var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(iw * k)); c.height = Math.max(1, Math.round(ih * k));
          var c2 = c.getContext('2d');
          c2.drawImage(img, 0, 0, c.width, c.height);
          // 自动曝光：把封面平均亮度拉到 ~0.6，暗封面不会印成一整块死黑
          var sm = document.createElement('canvas'); sm.width = sm.height = 16;
          var sg = sm.getContext('2d'); sg.drawImage(c, 0, 0, 16, 16);
          var px16 = sg.getImageData(0, 0, 16, 16).data, ls = [];
          for (var q = 0; q < px16.length; q += 4) ls.push((0.3 * px16[q] + 0.59 * px16[q + 1] + 0.11 * px16[q + 2]) / 255);
          ls.sort(function (x, y) { return x - y; });
          var lo = ls[12], hi = ls[243];
          if (hi - lo < 0.25) { var mid = (hi + lo) / 2; lo = Math.max(0, mid - 0.125); hi = Math.min(1, mid + 0.125); }
          cover.lv = [lo, hi];
          var med = Math.min(0.95, Math.max(0.05, (ls[128] - lo) / (hi - lo)));
          cover.gam = Math.max(0.35, Math.min(1.6, Math.log(0.58) / Math.log(med)));
          if (gl && ready) {
            gl.bindTexture(gl.TEXTURE_2D, covTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
          }
          var RA = (CR[2] - CR[0]) / (CR[3] - CR[1]), IA = iw / ih;
          cover.fit = IA > RA ? [(1 - RA / IA) / 2, 0, RA / IA, 1] : [0, (1 - IA / RA) / 2, 1, IA / RA];
          cover.has = 1;
          once();
        } catch (e) { setCoverFallback(); }
      };
      var fail = function () { if (!dead && id === cover.loadId) setCoverFallback(); };
      try {
        if (typeof THREE !== 'undefined' && THREE.TextureLoader) {
          var loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
          loader.load(url, function (t) { var img = t.image; t.dispose(); done(img); }, undefined, fail);
        } else {
          var img = new Image(); img.crossOrigin = 'anonymous';
          img.onload = function () { done(img); }; img.onerror = fail; img.src = url;
        }
      } catch (e) { fail(); }
    }
    function setCoverFallback() { cover.has = 0; once(); }

    // ---------- 渲染循环 ----------
    var sceneT = 7, mouse = [800, 340], mOn = 0, mTarget = 0, playK = 0, t0 = performance.now(), last = t0;
    var playingNow = false;
    function render(now) {
      if (dead) return;
      var t = (now - t0) / 1000, dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      if (RM) { mOn = mTarget; } else mOn += (mTarget - mOn) * Math.min(1, dt * 6);
      playK += ((playingNow ? 1 : 0) - playK) * Math.min(1, dt * 3);
      flash *= Math.pow(0.02, dt);
      var k = RM ? 1 : Math.min(1, dt * 18);
      ['a', 'b', 'c', 'p'].forEach(function (n) { var tg = hex(pal[n]); for (var i = 0; i < 3; i++) cur[n][i] += (tg[i] - cur[n][i]) * k; });
      if (!gl || !ready || gl.isContextLost()) return;
      if (staticDirty) staticPass();
      if (!RM) sceneT += dt * (1 + playK * 1.6);
      gl.useProgram(progSc); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[2]); gl.viewport(0, 0, SW, SH);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, covTex); gl.uniform1i(U2.uCov, 0);
      gl.uniform1f(U2.uT, sceneT); gl.uniform2f(U2.uRes, SW, SH); gl.uniform4f(U2.uSt, OX, OY, S, DPR);
      gl.uniform1f(U2.uHas, cover.has); gl.uniform1f(U2.uGam, cover.gam); gl.uniform2f(U2.uLv, cover.lv[0], cover.lv[1]); gl.uniform1f(U2.uSeed, cover.seed); gl.uniform1f(U2.uMove, RM ? 0 : 1);
      gl.uniform4f(U2.uFit, cover.fit[0], cover.fit[1], cover.fit[2], cover.fit[3]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(progD); gl.viewport(0, 0, E.cv.width, E.cv.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ftex[0]); gl.uniform1i(U1.uS0, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ftex[1]); gl.uniform1i(U1.uS1, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ftex[2]); gl.uniform1i(U1.uSc, 2);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(U1.uRes, E.cv.width, E.cv.height); gl.uniform1f(U1.uT, t); gl.uniform4f(U1.uSt, OX, OY, S, DPR);
      gl.uniform2f(U1.uM, mouse[0], mouse[1]); gl.uniform1f(U1.uMOn, mOn);
      gl.uniform3fv(U1.uA, cur.a); gl.uniform3fv(U1.uB, cur.b); gl.uniform3fv(U1.uC, cur.c); gl.uniform3fv(U1.uP, cur.p);
      gl.uniform2fv(U1.oA, off.A); gl.uniform2fv(U1.oB, off.B); gl.uniform2fv(U1.oC, off.C);
      gl.uniform1f(U1.uFlash, flash);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    var raf = 0, lastR = 0, onceRaf = 0;
    function loop(now) { raf = 0; if (dead || paused) return; if (now - lastR > 30) { lastR = now; render(now); } raf = requestAnimationFrame(loop); }
    function start() { if (dead || paused) return; if (RM) { once(); return; } if (!raf) raf = requestAnimationFrame(loop); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; if (onceRaf) cancelAnimationFrame(onceRaf); onceRaf = 0; }
    // 静态模式（reduced motion / 暂停后切换状态）下合并成下一帧只画一次
    function once() {
      if (dead || paused || raf) return;
      if (flat) return;
      if (!onceRaf) onceRaf = requestAnimationFrame(function (n) { onceRaf = 0; last = n; render(n); });
    }

    // ---------- 重新套印：换墨色 + 套准抖动 ----------
    var rpTimer = 0;
    function reprint(i, force) {
      if (i === palIdx && !force) return;
      palIdx = i;
      if (rpTimer) { clearInterval(rpTimer); rpTimer = 0; }
      if (RM || paused) {
        pal = PAL[i]; applyCSS();
        if (flat) drawPlates();
        once(); return;
      }
      var n = 0; flash = 1;
      rpTimer = setInterval(function () {
        if (dead) { clearInterval(rpTimer); rpTimer = 0; return; }
        n++;
        var amp = n < 7 ? 9 - n : 0;
        ['A', 'B', 'C'].forEach(function (p) {
          off[p][0] = REST[p][0] * (1 + Math.random() * 0.8) + (Math.random() - 0.5) * 2 * amp;
          off[p][1] = REST[p][1] * (1 + Math.random() * 0.8) + (Math.random() - 0.5) * 2 * amp;
        });
        if (n === 3) { pal = PAL[palIdx]; applyCSS(); if (flat) drawPlates(); }
        if (n >= 8) {
          clearInterval(rpTimer); rpTimer = 0;
          ['A', 'B', 'C'].forEach(function (p) { off[p][0] = REST[p][0] + (Math.random() - 0.5) * 1.4; off[p][1] = REST[p][1] + (Math.random() - 0.5) * 1.4; });
        }
        applyOff(); once();
      }, 46);
    }
    // 一次网点套色抖动（按播放、盖章、喜欢时）
    function jolt(k) { if (dead || paused) return; flash = Math.max(flash, k || 0.6); once(); }
    function finishReprint() {
      if (!rpTimer) return;
      clearInterval(rpTimer); rpTimer = 0;
      pal = PAL[palIdx]; applyCSS();
      ['A', 'B', 'C'].forEach(function (p) { off[p] = REST[p].slice(); });
      applyOff();
    }

    // ---------- 节目单 ----------
    var lineup = [];
    function lineupDefs(m) {
      var n = m.now, lib = m.library || {}, daily = m.daily || {}, disc = m.discover || {}, radio = m.radio || {}, login = m.login || {};
      var recentN = (m.recent || []).length;
        // [二改 2026-09-28] 音乐库 / 发现 / 电台：右侧抽出节目单，「曲目」就在条目下面展开（不再跳到左边的歌单面板）
      var libItem = { t: '音乐库', e: 'LIBRARY', m: lib.label || '本地音乐', tip: (lib.playlistCount ? lib.playlistCount + ' 张歌单 · ' : '') + (lib.label || ''), a: function () { if (sheet && login.any) sheet.open('lib'); else call('openLibrary'); } };
      var dailyItem = { t: '每日推荐', e: 'DAILY', m: daily.count ? '今日 ' + daily.count + ' 首' : (daily.label || '每日推荐'), tip: daily.label || '', a: function () { call('playDaily', 0); } };
      var recentItem = { t: '最近播放', e: 'RECENT', m: recentN ? recentN + ' 首' : '还没有记录', a: function () { call('playRecent', 0); } };
      var discItem = { t: disc.label || '发现', e: 'DISCOVER', m: disc.sub || '', dim: disc.available === false, a: function () { if (sheet && disc.available !== false) sheet.open('find'); else call('openDiscover'); } };
      var radioItem = { t: radio.label || '电台', e: 'RADIO', m: radio.sub || '', dim: radio.available === false, a: function () { if (sheet && radio.available !== false) sheet.open('radio'); else call('openRadio'); } };
      if (n) {
        return [
          { t: '继续播放', e: 'CONTINUE', m: (n.playing ? '正在播放 ' : '停在 ') + fmt(n.position), a: function () { call('resume'); } },
          libItem, dailyItem, recentItem, discItem, radioItem,
        ];
      }
      var opener = login.any
        ? { t: '今晚开场', e: 'OPENER', m: daily.count ? '每日推荐 · ' + daily.count + ' 首' : (daily.label || ''), a: function () { call('playDaily', 0); } }
        : { t: '登录开场', e: 'LOGIN', m: '网易云 · QQ 音乐', a: function () { call('openLogin'); } };
      return [
        opener,
        { t: '导入本地', e: 'IMPORT', m: '本地音乐文件', a: function () { call('importLocal'); } },
        libItem,
        login.any ? recentItem : dailyItem,
        discItem, radioItem,
      ];
    }
    function renderLineup(m) {
      lineup = lineupDefs(m);
      E.lis.forEach(function (li, i) {
        var it = lineup[i], b = E.lineBtns[i];
        txt(b.querySelector('.t'), it.t); txt(b.querySelector('.e'), it.e); txt(b.querySelector('.m'), it.m);
        attr(b, 'title', it.t + ' · ' + (it.tip || it.m));
        li.classList.toggle('dim', !!it.dim);
      });
    }

    // ---------- 为你挑选 ----------
    var actsSig = null, pickItems = [];
    function renderActs(m) {
      var p = m.picks || { items: [] }, items = (p.items || []).slice(0, 4);
      var mode = m.now || items.length ? 'picks' : (m.login && m.login.any ? 'wait' : 'login');
      var sig = mode + '|' + items.map(function (t) { return t.key + '/' + t.title + '/' + t.artist; }).join('|');
      txt(E.src, p.label && items.length ? '来源 · ' + p.label : '');
      attr(E.src, 'title', p.label || '');
      if (sig === actsSig) return;
      actsSig = sig; pickItems = items;
      var html = '';
      if (items.length) {
        items.forEach(function (t, i) {
          html += '<button type="button" data-i="' + i + '" title="' + esc(t.title + ' — ' + t.artist) + '">' + esc(t.title) + '<span>' + esc(t.artist) + '</span></button>';
          if (i < items.length - 1) html += '<i class="sep">✶</i>';
          if (i === 1) html += '<br>';
        });
      } else if (mode === 'login') {
        html = '<div class="hint">登录后，这里会排上为你挑选的暖场曲目。</div>' +
          '<button type="button" class="go" data-go="login">登录网易云 / QQ →</button><i class="sep">✶</i><button type="button" class="go" data-go="import">导入本地 →</button>';
      } else {
        html = '<div class="hint">今天的暖场曲目还在排练。</div><button type="button" class="go" data-go="daily">去每日推荐 →</button>';
      }
      E.acts.innerHTML = html;
    }

    // ---------- update ----------
    var lastPlaying = null, lastKey = null, posFrac = 0, hasDur = false, lastLiked = null, remain = false, dragFrac = null;
    // 换一句歌词 = 粉版重印一遍（带套色抖动）
    function checkPlates() {
      var pd = plateData();
      var psig = [pd.title, pd.artist, pd.date, pd.digit].join('\u0001');
      if (!plateState || psig !== [plateState.title, plateState.artist, plateState.date, plateState.digit].join('\u0001')) {
        // 换歌 / 换日期：整张重印（原来的效果）
        drawPlates();
        if (lastKey !== null) reprint(palIdx, true);
      } else if (pd.vert !== plateState.vert) {
        // 只换了一句歌词：只重画竖排这一版，只有它抖
        plateState.vert = pd.vert; plateState.vk = pd.vk;
        if (flat) drawPlates(); else { drawVert(pd.vert, true); shakeV(); }
      }
      syncVhit(pd);
    }
    var vhitKind = null;
    function syncVhit(pd) {
      var L = pd.vk === 'ly' ? lyricInfo() : null;
      if (vhitKind !== pd.vk + '|' + (L && L.state)) {
        vhitKind = pd.vk + '|' + (L && L.state);
        txt(E.vt, pd.vk === 'ly' ? (L && L.state === 'paused' ? '停在这句 · ' : '此刻 · ') + '进入播放页 →' : (pd.vk === 'q' ? '每日一句 · 换一句 ↻' : ''));
      }
      attr(E.vhit, 'aria-label', (pd.vk === 'ly' ? '此刻的歌词：' : '每日一句：') + pd.vert);
      E.vhit.style.display = pd.vk ? '' : 'none';
      // 下方那行小字：歌词有翻译就放翻译；每日一句已经在竖排里了，这里空着
      var model_ = model || {}, q = model_.quote || {};
      var sub = pd.vk === 'ly' ? (L && L.translation ? '「' + L.translation + '」' : '') : (pd.vk === 'q' ? '' : (q.text ? '「' + q.text + '」' : ''));
      txt(E.qt, sub);
      attr(E.qt, 'title', pd.vk ? '' : (q.text ? (q.source ? q.source + ' · ' : '') + '点一下换一句' : ''));
    }
    function update(m) {
      if (dead || !m) return;
      model = m;
      var now = m.now, c = m.clock || {}, empty = !now;
      root.classList.toggle('rp-empty', empty);

      // 时间 / 日期
      var wd = WD_CN.indexOf(c.weekday);
      txt(E.dw, wd >= 0 ? WD_EN[wd] : '');
      txt(E.tm, c.time || '');
      txt(E.datecn, cnNum(c.month) + '月' + cnNum(c.day) + '日 · ' + (c.weekday || '') + ' · ' + sessionName(c.time));

      // 印版（标题 / 主演 / 日期 / 竖排字）只在内容变化时重画
      checkPlates();
      var key = now ? now.key : '';
      if (key !== lastKey) {
        cover.seed = hashStr(now ? now.title + '|' + now.artist : 'empty');
      }
      lastKey = key;
      var cov = now && now.cover ? String(now.cover) : '';
      if (cov !== cover.url || (!cov && cover.has)) loadCover(cov);

      // 主演横幅 / 专辑行
      if (now) {
        attr(E.hlHit, 'title', '搜索 ' + now.artist);
        txt(E.hlTag, 'SEARCH →');
        // 时长未知（≤0）时不显示，免得出现"单曲 · 0:00"
        var durS = Number(now.duration) > 0 ? fmt(now.duration) : '';
        var tail = (durS ? ' · ' + durS : '') + (now.providerLabel ? ' · ' + now.providerLabel : '');
        var head = (now.album ? '专辑 《' + now.album + '》' : '单曲') + tail;
        if (E.headSub._v !== head) {
          E.headSub._v = head;
          E.headSub.innerHTML = now.album
            ? '专辑 <em>《' + esc(now.album) + '》</em>' + esc(tail)
            : esc(head);
        }
      } else {
        attr(E.hlHit, 'title', m.login && m.login.any ? '从每日推荐开场' : '登录网易云 / QQ 音乐');
        txt(E.hlTag, m.login && m.login.any ? 'PLAY →' : 'LOGIN →');
        var hs = m.login && m.login.any ? '选一首歌开场 · 或导入本地音乐' : '连接网易云 / QQ 音乐，或导入本地音乐 · 今晚的海报由你来印';
        if (E.headSub._v !== hs) { E.headSub._v = hs; E.headSub.textContent = hs; }
      }
      txt(E.luhL, empty ? 'LINEUP · 开场前准备' : 'LINEUP · 今晚节目单');
      renderLineup(m);
      renderActs(m);

      // 票根
      var td = m.today || {};
      txt(E.tkMin, td.minutes || 0);
      txt(E.tkNo, 'Nº ' + String(c.month || 0).padStart(2, '0') + String(c.day || 0).padStart(2, '0'));
      txt(E.tkSeat, 'SEAT ' + (td.count || 0) + ' 首');
      if (td.count) {
        txt(E.tkBig, td.topArtist ? '最常听 ' + td.topArtist : '今日已听');
        txt(E.tkSub, '· ' + td.count + ' 首 · ' + (td.minutes || 0) + ' 分钟');
      } else {
        txt(E.tkBig, empty ? '今天还没开场' : '今天刚开场');
        txt(E.tkSub, '· 0 首 · 0 分钟');
      }
      var nx = m.next;
      if (nx) {
        txt(E.nxT, nx.title); txt(E.nxA, nx.artist); txt(E.nxD, nx.duration ? fmt(nx.duration) : '');
        attr(E.nx, 'title', '下一首：' + nx.title + ' — ' + nx.artist);
      } else if (empty) {
        txt(E.nxT, m.login && m.login.any ? '去每日推荐' : '登录后排上节目'); txt(E.nxA, ''); txt(E.nxD, '');
        attr(E.nx, 'title', m.login && m.login.any ? '播放每日推荐' : '登录');
      } else {
        txt(E.nxT, '队列到头了'); txt(E.nxA, '去每日推荐'); txt(E.nxD, '');
        attr(E.nx, 'title', '播放每日推荐');
      }

      // 播放控件：贴纸是唯一的播放键
      var playing = !!(now && now.playing);
      playingNow = playing;
      if (playing !== lastPlaying) {
        E.stG.innerHTML = playing ? IC_ST_PAUSE : IC_ST_PLAY;
        E.sticker.classList.toggle('fast', playing);
        if (lastPlaying !== null) { E.sticker.classList.remove('hit'); void E.sticker.offsetWidth; E.sticker.classList.add('hit'); jolt(0.6); }
        lastPlaying = playing;
      }
      txt(E.ns, empty ? 'NO SHOW · 暂无节目' : (playing ? 'NOW PLAYING · 正在播放' : 'PAUSED · 已暂停'));
      txt(E.nt, now ? now.artist + ' — ' + now.title : (m.login && m.login.any ? '选一首歌开场' : '登录后开始今晚的节目'));
      var liked = !!(now && now.liked);
      E.like.classList.toggle('on', liked);
      attr(E.like, 'title', liked ? '取消喜欢' : '喜欢');
      E.lyr.classList.toggle('on', !!m.lyricsOn);
      attr(E.lyr, 'title', m.lyricsOn ? '主页歌词：开（点一下只显示每日一句）' : '主页歌词：关（点一下显示此刻的歌词）');
      txt(E.nextqB, m.next ? m.next.title : (now ? '队列到头了' : '还没有节目'));
      // 喜欢 = 在封面右下角盖一枚 LOVED 心形章（切歌时不重盖，只在状态变化时）
      if (liked !== lastLiked) {
        E.mark.innerHTML = heartMarkSVG(String(c.month || 1).padStart(2, '0') + '.' + String(c.day || 1).padStart(2, '0'));
        E.mark.classList.remove('on', 'off');
        if (liked) { void E.mark.offsetWidth; E.mark.classList.add('on'); if (lastLiked !== null) jolt(0.7); }
        else if (lastLiked) E.mark.classList.add('off');
        lastLiked = liked;
      }
      syncVolume();

      var dur = now ? Number(now.duration) || 0 : 0, pos = now ? Math.max(0, Number(now.position) || 0) : 0;
      hasDur = dur > 0;
      posFrac = hasDur ? Math.min(1, pos / dur) : 0;
      renderTear();
      syncVhit(plateData());

      // 贴纸
      if (now) {
        txt(E.stT, fmt(pos)); txt(E.stS, playing ? '播放中' : '继续');
        txt(E.stRing, 'NOW ON NOT BLIND · 正在播放 · NOT BLIND · 继续 ·');
        attr(E.sticker, 'title', (playing ? '暂停' : '继续播放') + '（长按：从头再印一遍）');
      } else {
        txt(E.stT, 'GO'); txt(E.stS, m.login && m.login.any ? '开场' : '登录');
        txt(E.stRing, 'NO SHOW YET · 今晚待开场 · NOT BLIND · 等你 ·');
        attr(E.sticker, 'title', m.login && m.login.any ? '开始播放' : '登录');
      }
    }

    // ---------- 交互 ----------
    E.lineBtns.forEach(function (b, i) {
      b.addEventListener('mouseenter', function () { reprint(i); });
      b.addEventListener('focus', function () { reprint(i); });
      b.addEventListener('click', function () {
        E.lis.forEach(function (l) { l.classList.remove('on'); });
        E.lis[i].classList.add('on');
        if (lineup[i]) lineup[i].a();
      });
    });
    E.acts.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-i')) {
        [].forEach.call(E.acts.querySelectorAll('button[data-i]'), function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        call('playPick', Number(b.getAttribute('data-i')) || 0);
      } else {
        var g = b.getAttribute('data-go');
        if (g === 'login') call('openLogin'); else if (g === 'import') call('importLocal'); else call('playDaily', 0);
      }
    });
    E.nx.addEventListener('click', function () {
      var m = model || {};
      if (m.next) call('next');
      else if (!m.now && !(m.login && m.login.any)) call('openLogin');
      else call('playDaily', 0);
    });
    E.hlHit.addEventListener('click', function () {
      var m = model || {};
      if (m.now) call('search', m.now.artist || '');
      else if (m.login && m.login.any) call('playDaily', 0);
      else call('openLogin');
    });
    root.querySelector('.title-hit').addEventListener('click', function () { var m = model || {}; if (m.now) call('openImmersive'); else call('resume'); });
    E.prev.addEventListener('click', function () { call('prev'); });
    E.next.addEventListener('click', function () { call('next'); });
    E.like.addEventListener('click', function () { call('toggleLike'); });
    E.lyr.addEventListener('click', function () { call('toggleLyrics'); });
    E.nextq.addEventListener('click', function () { openPanelTab('queue'); });
    E.peek.addEventListener('click', function () { openPanelTab('queue'); });
    E.hint.addEventListener('click', function () { openSearch(); });
    hintHit.addEventListener('click', function (e) { e.stopPropagation(); openSearch(); });
    hintHit.addEventListener('pointerenter', function () { E.hint.classList.add('hov'); placeHintHit(); });
    hintHit.addEventListener('pointerleave', function () { E.hint.classList.remove('hov'); });
    later(placeHintHit, 60); later(placeHintHit, 600);
    function openPanelTab(tab) {
      // 宿主没有给主题开歌单栏的动作：用软件已有的全局函数
      try { if (typeof openPlaylistPanelTab === 'function') openPlaylistPanelTab(tab); else call('openLibrary'); } catch (e) { console.warn('[riso-poster] panel', e); }
    }
    // 贴纸印章：点 = 播放 / 暂停；长按 = 从头再印一遍
    var lp = 0, lpFired = false;
    function stickerAct() {
      var m = model || {};
      if (m.now) { if (m.now.playing) call('togglePlay'); else call('resume'); }
      else if (m.login && m.login.any) call('resume');
      else call('openLogin');
    }
    E.sticker.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      lpFired = false; clearTimeout(lp);
      lp = later(function () {
        var m = model || {};
        if (!m.now || !hasDur) return;
        lpFired = true; call('seek', 0); jolt(1);
        if (ctx.toast) ctx.toast('长按 · 从头再印一遍');
      }, 650);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { E.sticker.addEventListener(ev, function () { clearTimeout(lp); }); });
    E.sticker.addEventListener('click', function () { if (lpFired) { lpFired = false; return; } stickerAct(); });
    E.sticker.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); stickerAct(); } });
    E.sticker.setAttribute('aria-label', '播放 / 暂停（长按从头播放）');
    E.qt.addEventListener('click', function () { if (!(plateState && plateState.vk)) call('nextQuote'); });
    E.vhit.addEventListener('click', function () { var k = plateState && plateState.vk; if (k === 'ly') call('openImmersive'); else if (k === 'q') call('nextQuote'); });
    var vPoll = setInterval(function () { if (!dead && !paused && model) checkPlates(); }, 100);
    timers.push(vPoll);
    E.tCur.addEventListener('click', function () { remain = !remain; renderTear(); });

    // 撕票虚线：拖剪刀 = 调进度
    function renderTear() {
      var m = model || {}, now = m.now, dur = now ? Number(now.duration) || 0 : 0, pos = now ? Math.max(0, Number(now.position) || 0) : 0;
      var f = dragFrac != null ? dragFrac : posFrac;
      var pct = (f * 100).toFixed(2) + '%';
      if (E.used.style.width !== pct) { E.used.style.width = pct; E.cut.style.left = pct; }
      E.tear.classList.toggle('off', !hasDur);
      attr(E.tear, 'aria-valuenow', String(Math.round(f * 100)));
      var shown = dragFrac != null ? dragFrac * dur : pos;
      txt(E.tCur, !now ? '--:--' : (remain && hasDur ? '-' + fmt(dur - shown) : fmt(shown)));
      txt(E.tDur, hasDur ? fmt(dur) : '--:--');
    }
    function tearFrac(e) { var r = E.tear.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1))); }
    function durNow() { var m = model || {}; return m.now ? Number(m.now.duration) || 0 : 0; }
    function tagAt(f) { E.tag.style.left = (f * 100).toFixed(2) + '%'; txt(E.tag, fmt(f * durNow())); }
    E.tear.addEventListener('pointermove', function (e) {
      if (!hasDur) return;
      if (dragFrac != null) { dragFrac = tearFrac(e); renderTear(); }
      tagAt(dragFrac != null ? dragFrac : tearFrac(e));
    });
    E.tear.addEventListener('pointerdown', function (e) {
      if (!hasDur || e.button) return;
      try { E.tear.setPointerCapture(e.pointerId); } catch (_e) { }
      E.tear.classList.add('drag');
      dragFrac = tearFrac(e); renderTear(); tagAt(dragFrac);
    });
    function endDrag() { if (dragFrac == null) return; var f = dragFrac; dragFrac = null; E.tear.classList.remove('drag'); posFrac = f; renderTear(); call('seek', f); }
    E.tear.addEventListener('pointerup', endDrag); E.tear.addEventListener('pointercancel', endDrag);
    E.tear.addEventListener('keydown', function (e) {
      if (!hasDur) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); call('seek', Math.max(0, Math.min(1, posFrac + (e.key === 'ArrowLeft' ? -0.02 : 0.02)))); }
    });

    // 墨量 = 音量。宿主模型里还没有音量：读 / 写软件已有的全局 targetVolume / setVolume
    var vol = 0.8, volT = 0, volTouched = 0, hasVol = false;
    var dotEls = [];
    (function () { var h = ''; for (var i = 0; i < 10; i++) { var sz = 3 + i * 0.75; h += '<i style="width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px"></i>'; } E.dots.innerHTML = h; dotEls = [].slice.call(E.dots.children); })();
    function readVolume() {
      var m = model || {};
      if (typeof m.volume === 'number') return m.volume;
      try { if (typeof targetVolume === 'number') return targetVolume; } catch (_e) { }
      return null;
    }
    function setVolUI() {
      root.style.setProperty('--vol', vol.toFixed(3));
      var n = Math.round(vol * 10);
      dotEls.forEach(function (d, i) { d.classList.toggle('on', i < n); });
      txt(E.inkEm, hasVol ? Math.round(vol * 100) + '%' : '—');
      E.ink.classList.toggle('nov', !hasVol);
      attr(E.ink, 'aria-valuenow', String(Math.round(vol * 100)));
    }
    function syncVolume() {
      if (performance.now() - volTouched < 1500) return;
      var v = readVolume();
      hasVol = v != null;
      if (hasVol) vol = Math.max(0, Math.min(1, v));
      setVolUI();
    }
    function writeVolume(v) {
      if (typeof A.setVolume === 'function') { call('setVolume', v); return; }
      try { if (typeof setVolume === 'function') setVolume(v, true); } catch (e) { console.warn('[riso-poster] volume', e); }
    }
    function onWheel(e) {
      if (!near || searchOpen || !hasVol || e.ctrlKey) return;
      e.preventDefault();
      vol = Math.max(0, Math.min(1, vol + (e.deltaY < 0 ? 0.04 : -0.04)));
      volTouched = performance.now();
      setVolUI();
      E.ink.classList.remove('live'); void E.ink.offsetWidth; E.ink.classList.add('live');
      clearTimeout(volT); volT = later(function () { writeVolume(Math.round(vol * 100) / 100); }, 140);
    }
    root.addEventListener('wheel', onWheel, { passive: false });

    // [二改 2026-09-28] 墨量也能点、能拖（反馈：原来只能滚轮调，点了拖了都没反应）
    //   按在那排墨点上：按到哪就是多少，按住左右拖跟着变，边拖边改（每 60ms 写一次），松手再写一次准的；
    //   键盘：←→ / ↑↓ 每次 5%，Home / End 到 0 / 100%。只在墨点那一小段上按才算（按到"墨量"两个字上不动，免得一下拉满）
    var inkDrag = null, inkLastWrite = 0;
    function volFromX(x) {
      var r = (inkDrag && inkDrag.rect) || E.dots.getBoundingClientRect();
      if (!r.width) return vol;
      var pad = 5;   // .dots 左右各放宽 5px 的点击区
      return Math.max(0, Math.min(1, (x - r.left - pad) / Math.max(1, r.width - pad * 2)));
    }
    function inkApply(v, final) {
      vol = Math.max(0, Math.min(1, v));
      volTouched = performance.now();
      setVolUI();
      clearTimeout(volT);
      var now = performance.now();
      if (final || now - inkLastWrite > 60) { inkLastWrite = now; writeVolume(Math.round(vol * 100) / 100); }
      else volT = later(function () { inkLastWrite = performance.now(); writeVolume(Math.round(vol * 100) / 100); }, 60);
    }
    E.ink.addEventListener('pointerdown', function (e) {
      if (!hasVol || e.button !== 0) return;
      var r = E.dots.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right) return;
      e.preventDefault(); e.stopPropagation();
      inkDrag = { id: e.pointerId, rect: r };   // 拖动过程中按按下那一刻的位置算
      try { E.ink.setPointerCapture(e.pointerId); } catch (_e) { }
      E.ink.classList.add('drag');
      E.ink.classList.remove('live'); void E.ink.offsetWidth; E.ink.classList.add('live');
      inkApply(volFromX(e.clientX), false);
    });
    E.ink.addEventListener('pointermove', function (e) {
      if (!inkDrag || e.pointerId !== inkDrag.id) return;
      e.preventDefault();
      inkApply(volFromX(e.clientX), false);
    });
    function inkEnd(e) {
      if (!inkDrag || (e && e.pointerId !== inkDrag.id)) return;
      inkDrag = null;
      E.ink.classList.remove('drag');
      try { E.ink.releasePointerCapture(e.pointerId); } catch (_e) { }
      inkApply(vol, true);
    }
    E.ink.addEventListener('pointerup', inkEnd);
    E.ink.addEventListener('pointercancel', inkEnd);
    E.ink.addEventListener('click', function (e) { e.stopPropagation(); });
    E.ink.addEventListener('keydown', function (e) {
      if (!hasVol) return;
      var k = e.key, v = null;
      if (k === 'ArrowRight' || k === 'ArrowUp') v = vol + 0.05;
      else if (k === 'ArrowLeft' || k === 'ArrowDown') v = vol - 0.05;
      else if (k === 'Home') v = 0;
      else if (k === 'End') v = 1;
      if (v == null) return;
      e.preventDefault(); e.stopPropagation();
      inkApply(Math.round(v * 20) / 20, true);
    });

    // 靠近播放器才浮现上一首 / 下一首 / 墨量 / 喜欢 / 歌词
    var near = false, pointerNear = false;
    function setNear(v) { if (v === near) return; near = v; root.classList.toggle('rp-near', v); }
    function ctlFocused() { var a = document.activeElement; return !!(a && a !== document.body && (E.tear === a || E.sticker === a || (a.closest && a.closest('.rp-ctl')))); }
    root.addEventListener('focusin', function () { setNear(pointerNear || ctlFocused()); });
    root.addEventListener('focusout', function () { later(function () { setNear(pointerNear || ctlFocused()); }, 0); });

    // 印刷用的小纹理：油墨颗粒（遮罩）、纸面针孔、纸纤维。只生成一次
    function makeTextures() {
      var seed = 0.4127 * 2147483646 + 1;
      var r = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      function grid(w, G) {
        var gw = Math.ceil(w / G) + 2, g = new Float32Array(gw * gw);
        for (var i = 0; i < g.length; i++) g[i] = r();
        return function (x, y) {
          var gx = x / G, gy = y / G, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
          fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
          var a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
          var t = a + (b - a) * fx; return t + ((c + (d - c) * fx) - t) * fy;
        };
      }
      var W = 220, c1 = document.createElement('canvas'), c2 = document.createElement('canvas');
      c1.width = c1.height = c2.width = c2.height = W;
      var g1 = c1.getContext('2d'), g2 = c2.getContext('2d'), d1 = g1.createImageData(W, W), d2 = g2.createImageData(W, W);
      var n1 = grid(W, 22), n2 = grid(W, 6);
      for (var y = 0; y < W; y++) for (var x = 0; x < W; x++) {
        var k = (y * W + x) * 4, n = n1(x, y), mm = n2(x, y);
        var a = 0.8 + 0.2 * n - 0.16 * Math.max(0, mm - 0.62) * 4;
        var pin = r() < 0.03 + 0.06 * (1 - n) * (1 - n);
        if (pin) a = 0.1 + r() * 0.3;
        d1.data[k + 3] = Math.max(0, Math.min(1, a)) * 255;
        d2.data[k + 3] = (pin ? 0.7 + r() * 0.3 : (r() < 0.02 ? 0.25 : 0)) * 255;
      }
      g1.putImageData(d1, 0, 0); g2.putImageData(d2, 0, 0);
      var f = document.createElement('canvas'); f.width = f.height = 300;
      var fg = f.getContext('2d'); fg.lineCap = 'round';
      for (var i = 0; i < 360; i++) {
        var fx = r() * 300, fy = r() * 300, an = r() * Math.PI, l = 3 + r() * 16;
        fg.strokeStyle = 'rgba(90,72,40,' + (0.05 + r() * 0.1).toFixed(3) + ')'; fg.lineWidth = 0.5 + r() * 0.8;
        fg.beginPath(); fg.moveTo(fx, fy); fg.quadraticCurveTo(fx + Math.cos(an) * l * 0.5 + (r() - 0.5) * 4, fy + Math.sin(an) * l * 0.5 + (r() - 0.5) * 4, fx + Math.cos(an) * l, fy + Math.sin(an) * l); fg.stroke();
      }
      for (i = 0; i < 1400; i++) { fg.fillStyle = 'rgba(80,60,30,' + (r() * 0.06).toFixed(3) + ')'; fg.fillRect(r() * 300, r() * 300, 1, 1); }
      root.style.setProperty('--rp-grain', 'url(' + c1.toDataURL('image/png') + ')');
      root.style.setProperty('--rp-pin', 'url(' + c2.toDataURL('image/png') + ')');
      root.style.setProperty('--rp-fiber', 'url(' + f.toDataURL('image/png') + ')');
    }
    try { makeTextures(); } catch (e) { console.warn('[riso-poster] textures', e); }

    // ---------- 盖章搜索 ----------
    var searchOpen = false, composing = false, compBase = '', sMode = 'song';
    E.modes.innerHTML = SEARCH_MODES.map(function (md) { return '<button type="button" class="rp-mode" data-m="' + md.id + '" style="--mc:' + md.c[0] + ';--mt:' + md.c[1] + '"><i></i>' + md.label + '</button>'; }).join('') + '<span class="hint"></span>';
    function renderModes() {
      [].forEach.call(E.modes.querySelectorAll('.rp-mode'), function (b) { b.classList.toggle('on', b.getAttribute('data-m') === sMode); });
      var md = SEARCH_MODES.filter(function (x) { return x.id === sMode; })[0];
      txt(E.modes.querySelector('.hint'), '来源 · ' + (sMode === 'song' ? '全部平台' : md.label));
    }
    renderModes();
    E.modes.addEventListener('click', function (e) { var b = e.target.closest('.rp-mode'); if (!b) return; sMode = b.getAttribute('data-m'); renderModes(); E.qin.focus(); });
    function suggestions() {
      // 从今晚的节目里挑几个能直接盖的词：正在播的歌手、接下来、最近、为你挑选（去重）
      var m = model || {}, out = [], seen = {};
      function add(v) { v = String(v || '').trim(); if (!v || v.length > 18 || seen[v.toLowerCase()]) return; seen[v.toLowerCase()] = 1; out.push(v); }
      if (m.now) add(m.now.artist);
      if (m.next) add(m.next.artist);
      (m.recent || []).forEach(function (t) { add(t.artist); });
      ((m.picks && m.picks.items) || []).forEach(function (t) { add(t.artist); });
      if (m.now) add(m.now.album);
      return out.slice(0, 6);
    }
    function history() {
      try { if (typeof readSearchHistory === 'function') return (readSearchHistory() || []).slice(0, 6); } catch (_e) { }
      return [];
    }
    function stampBtn(v, i, cls) { return '<button type="button" class="rp-rstamp ' + (cls || '') + '" style="--r:' + ((hashStr(v) - 0.5) * 6).toFixed(1) + 'deg" data-q="' + esc(v) + '" title="' + esc(v) + '">' + esc(v) + '</button>'; }
    function renderSug() {
      var hs = history(), sg = suggestions();
      E.sugL.innerHTML = '<div class="lbl"><span>RECENT · 最近搜过</span><span>' + (hs.length ? String(hs.length).padStart(2, '0') : '') + '</span></div>' +
        (hs.length ? '<div class="rp-rst">' + hs.map(function (v, i) { return stampBtn(v, i, ''); }).join('') + '</div>'
          : '<p class="rp-note">拼音打字时先用<em>铅笔</em>打草稿，选好字才<em>盖章</em>。回车开印。</p>');
      E.sugR.innerHTML = '<div class="lbl"><span>TONIGHT · 从今晚的节目里挑</span></div>' +
        (sg.length ? '<div class="rp-rst">' + sg.map(function (v, i) { return stampBtn(v, i, 'b'); }).join('') + '</div>'
          : '<p class="rp-note">回车就开印：结果会在软件的<em>搜索面板</em>里展开。<br>Tab 换平台，Esc 擦掉重来。</p>');
      var c = (model && model.clock) || {};
      txt(E.f1, 'HANDBILL Nº ' + String(c.month || 0).padStart(2, '0') + String(c.day || 0).padStart(2, '0') + ' · ' + (E.qin.value.trim() ? '待印「' + E.qin.value.trim() + '」' : '等你落下第一个字'));
    }
    [E.sugL, E.sugR].forEach(function (col) { col.addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (b) setQuery(b.getAttribute('data-q')); }); });
    function openSearch() {
      if (dead) return;
      if (searchOpen) { E.qin.focus({ preventScroll: true }); return; }
      searchOpen = true; root.classList.add('rp-search'); setNear(false);
      renderSug();
      E.qin.focus({ preventScroll: true });
      jolt(0.35);
    }
    function closeSearch() {
      if (!searchOpen) return;
      searchOpen = false; root.classList.remove('rp-search');
      if (document.activeElement === E.qin) E.qin.blur();
    }
    function clearQuery() { E.qin.value = ''; renderStamps('', ''); }
    function submitSearch() {
      var q = E.qin.value.trim();
      if (!q) return;
      closeSearch();
      if (sMode !== 'song' && typeof A.search === 'function' && A.search.length >= 2) call('search', q, sMode);
      else if (sMode !== 'song' && typeof runHomeSearch === 'function') { try { runHomeSearch(q, sMode); } catch (e) { console.warn('[riso-poster] search', e); } }
      else call('search', q);
      later(clearQuery, 400);
    }
    E.veil.addEventListener('pointerdown', function () { closeSearch(); });
    root.querySelector('.rp-qline').addEventListener('click', function (e) { if (e.target === E.go) return; E.qin.focus(); });
    E.go.addEventListener('click', submitSearch);
    // 盖章：只给新增的字盖章，旧字不动
    function renderStamps(val, draft) {
      var chars = Array.from(val), kids = [].slice.call(E.stamps.children);
      kids.forEach(function (k) { if (k.classList.contains('draft')) k.remove(); });
      kids = [].slice.call(E.stamps.children);
      var p = 0; while (p < kids.length && p < chars.length && kids[p].getAttribute('data-c') === chars[p]) p++;
      for (var i = kids.length - 1; i >= p; i--) kids[i].remove();
      var frag = document.createDocumentFragment();
      for (i = p; i < chars.length; i++) {
        var sp = document.createElement('span'); sp.className = 'rp-ch new'; sp.textContent = chars[i]; sp.setAttribute('data-c', chars[i]);
        var h1 = hashStr(chars[i] + i), h2 = hashStr(i + chars[i]), h3 = hashStr(i + 'r' + chars[i]);
        sp.style.setProperty('--r', ((h1 - 0.5) * 7).toFixed(1) + 'deg');
        sp.style.webkitMaskPosition = sp.style.maskPosition = Math.floor(h1 * 180) + 'px ' + Math.floor(h2 * 180) + 'px';
        sp.style.opacity = (0.86 + h1 * 0.14).toFixed(2);
        sp.style.rotate = ((h3 - 0.5) * 3).toFixed(1) + 'deg';
        if (i - p > 0) sp.style.animationDelay = ((i - p) * 0.035).toFixed(3) + 's';
        frag.appendChild(sp);
      }
      E.stamps.appendChild(frag);
      Array.from(draft || '').forEach(function (ch) { var d = document.createElement('span'); d.className = 'rp-ch draft'; d.textContent = ch; E.stamps.appendChild(d); });
      E.ph.style.display = chars.length || draft ? 'none' : '';
      var n = chars.length + Array.from(draft || '').length;
      var fs = n > 9 ? (n > 13 ? '38px' : '50px') : '';
      [].forEach.call(E.stamps.children, function (ch) { if (!ch.classList.contains('draft')) ch.style.fontSize = fs; });
      E.go.classList.toggle('off', !chars.length);
      if (chars.length > p) jolt(0.18);
      if (searchOpen) { var c = (model && model.clock) || {}; txt(E.f1, 'HANDBILL Nº ' + String(c.month || 0).padStart(2, '0') + String(c.day || 0).padStart(2, '0') + ' · ' + (val.trim() ? '待印「' + val.trim() + '」 · 回车开印' : '等你落下第一个字')); }
    }
    function setQuery(v) { E.qin.value = v; renderStamps(v, ''); E.qin.focus(); }
    // 输入法组字：拼音先用"铅笔"写成草稿，不响应回车；选定字后才盖章
    E.qin.addEventListener('compositionstart', function () { composing = true; compBase = E.qin.value; });
    E.qin.addEventListener('compositionupdate', function (e) { renderStamps(compBase || '', e.data || ''); });
    E.qin.addEventListener('compositionend', function () { composing = false; renderStamps(E.qin.value, ''); });
    E.qin.addEventListener('input', function (e) { if (composing || e.isComposing) return; renderStamps(E.qin.value, ''); });
    E.qin.addEventListener('keydown', function (e) {
      e.stopPropagation(); // 输入时不要触发宿主的快捷键
      if (composing || e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.preventDefault(); if (E.qin.value) clearQuery(); else closeSearch(); }
      else if (e.key === 'Enter') { e.preventDefault(); submitSearch(); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        var ids = SEARCH_MODES.map(function (x) { return x.id; }), k = ids.indexOf(sMode);
        sMode = ids[(k + (e.shiftKey ? ids.length - 1 : 1)) % ids.length]; renderModes();
      }
    });
    E.qin.addEventListener('keyup', function (e) { e.stopPropagation(); });
    E.qin.addEventListener('blur', function () { later(function () { if (searchOpen && !E.qin.value && document.activeElement !== E.qin && !(document.activeElement && E.flyer.contains(document.activeElement))) closeSearch(); }, 160); });
    // 在主页上直接打字 = 搜索（Spotlight 式）。捕获阶段先拦下，免得单字母快捷键（K 回正镜头等）抢走
    function visibleNow() {
      if (dead || paused || !root.isConnected || !root.offsetWidth) return false;
      var pg = document.body && document.body.getAttribute('data-hth-page');
      return pg !== 'stage';
    }
    function onKey(e) {
      if (!visibleNow() || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      var tg = e.target, tag = tg && tg.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (tg && tg.isContentEditable)) return;
      if (tg && tg.nodeType === 1 && tg !== document.body && tg !== document.documentElement && !root.contains(tg)) return;
      if (e.key === 'Escape' && searchOpen) { e.preventDefault(); e.stopPropagation(); closeSearch(); return; }
      // [二改] 不再"直接打字就开始搜索"：要先点左上角的「搜索」章打开搜索框
    }
    window.addEventListener('keydown', onKey, true);
    // 鼠标 → 网点放大镜
    function onMove(e) {
      var r = root.getBoundingClientRect();
      mouse = [(e.clientX - r.left - OX) / S, (e.clientY - r.top - OY) / S];
      var inside = mouse[0] > CR[0] - 18 && mouse[0] < CR[2] + 50 && mouse[1] > CR[1] - 20 && mouse[1] < CR[3] + 18;
      mTarget = inside ? 1 : 0.25;
      if (RM) once();
      pointerNear = mouse[0] > 570 && mouse[0] < 1062 && mouse[1] > 640 && mouse[1] < 900 && !searchOpen;
      setNear(pointerNear || ctlFocused());
    }
    function onLeave() { mTarget = 0; if (RM) once(); pointerNear = false; setNear(ctlFocused()); }
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);

    // WebGL 上下文丢失 / 恢复
    function onLost(e) { e.preventDefault(); ready = false; stop(); }
    function onRestored() {
      if (dead) return;
      try { shaders = []; initGL(); sizeFBO(); upload(); var u = cover.url; cover.url = ''; loadCover(u); start(); once(); } catch (err) {
        console.warn('[riso-poster] restore', err);
        dropGL(); useFlat(); drawPlates();
      }
    }
    // 放弃 WebGL：摘掉监听、释放上下文
    function dropGL() {
      if (!gl) return;
      E.cv.removeEventListener('webglcontextlost', onLost); E.cv.removeEventListener('webglcontextrestored', onRestored);
      try { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (_e) { }
      gl = null; ready = false;
    }
    if (gl) { E.cv.addEventListener('webglcontextlost', onLost); E.cv.addEventListener('webglcontextrestored', onRestored); }

    // ---------- 启动 ----------
    // 着色器编译失败时改用 2D 平面版，不然海报是一片空白
    if (gl) { try { initGL(); } catch (err) { console.warn('[riso-poster] GL init', err); dropGL(); useFlat(); } }
    applyOff(); applyCSS();
    try { model = ctx.model ? ctx.model() : null; } catch (_e) { model = null; }
    layout();
    if (model) update(model);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (dead) return; titleCache = null; drawPlates(); once(); });
    }
    start(); once();

    return {
      update: update,
      back: function () { return !!(sheet && sheet.close()); },
      resize: function (w, h) { if (dead) return; layout(w, h); once(); },
      pause: function () {
        if (dead || paused) return;
        paused = true; stop(); finishReprint(); closeSearch(); setNear(false);
        if (speckTimer) { clearTimeout(speckTimer); speckTimer = 0; }
        root.classList.add('rp-paused');
      },
      resume: function () {
        if (dead || !paused) return;
        paused = false; root.classList.remove('rp-paused');
        last = performance.now();
        measureRoot();
        if (Math.round(VW * DPR) !== (flat ? pc.width : E.cv.width) || Math.round(VH * DPR) !== (flat ? pc.height : E.cv.height)) layout();
        // 暂停时可能把还没跑的斑点生成取消了，这里补上
        if (speckStale()) scheduleSpeck();
        start(); once();
      },
      destroy: function () {
        if (dead) return;
        dead = true; stop();
        if (sheet) { sheet.destroy(); sheet = null; }
        if (rpTimer) clearInterval(rpTimer); rpTimer = 0;
        if (vShakeT) clearInterval(vShakeT); vShakeT = 0;
        if (speckTimer) clearTimeout(speckTimer); speckTimer = 0;
        timers.forEach(clearTimeout); timers = [];
        cover.loadId++;
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerleave', onLeave);
        root.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKey, true);
        if (gl) {
          E.cv.removeEventListener('webglcontextlost', onLost); E.cv.removeEventListener('webglcontextrestored', onRestored);
          try {
            if (!gl.isContextLost()) {
              ftex.concat([tex, vtex, covTex]).forEach(function (t) { if (t) gl.deleteTexture(t); });
              fbo.forEach(function (f) { if (f) gl.deleteFramebuffer(f); });
              [progS, progD, progSc].forEach(function (p) { if (p) gl.deleteProgram(p); });
              shaders.forEach(function (s) { gl.deleteShader(s); });
              if (vbuf) gl.deleteBuffer(vbuf);
            }
            var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
          } catch (_e) { }
          gl = null;
        }
        if (speckUrl) { URL.revokeObjectURL(speckUrl); speckUrl = ''; }
        pc.width = pc.height = 0; vc.width = vc.height = 0;
        root.classList.remove('rp-paused', 'rp-rm', 'rp-empty', 'rp-near', 'rp-search');
        ['--rp-grain', '--rp-pin', '--rp-fiber', '--vol', '--ia', '--ib', '--ic', '--paper', '--ax', '--ay', '--bx', '--by', '--cx', '--cy'].forEach(function (k) { root.style.removeProperty(k); });
        root.innerHTML = '';
      },
    };
  }

  // ---------------- 播放页背景：深蓝油墨底 + 错版的粉/黄网点，纸纤维颗粒（3D 粒子叠在上面） ----------------
  var BACKDROP = {
    css: [
      '#hth-backdrop.hbd-riso-poster{background:radial-gradient(120% 90% at 30% 20%,rgba(30,44,92,.92),rgba(14,20,46,.95) 55%,rgba(8,11,26,.97))}',
      '#hth-backdrop.hbd-riso-poster .hbd-dots{position:absolute;left:-20%;top:-20%;width:140%;height:140%;will-change:transform}',
      '#hth-backdrop.hbd-riso-poster .hbd-dots.p{background-image:radial-gradient(circle,rgba(255,61,154,.34) 0 1.3px,transparent 1.9px);background-size:10px 10px;-webkit-mask-image:radial-gradient(38% 42% at 70% 36%,#000,transparent 72%);mask-image:radial-gradient(38% 42% at 70% 36%,#000,transparent 72%);animation:hbd-rp-a 90s ease-in-out infinite alternate}',
      '#hth-backdrop.hbd-riso-poster .hbd-dots.y{background-image:radial-gradient(circle,rgba(255,217,46,.22) 0 1.2px,transparent 1.8px);background-size:12px 12px;transform:rotate(15deg);-webkit-mask-image:radial-gradient(34% 40% at 30% 70%,#000,transparent 72%);mask-image:radial-gradient(34% 40% at 30% 70%,#000,transparent 72%);animation:hbd-rp-b 110s ease-in-out infinite alternate}',
      '#hth-backdrop.hbd-riso-poster .hbd-fiber{position:absolute;inset:0;opacity:.07;mix-blend-mode:screen;background-size:300px 300px}',
      '#hth-backdrop.hbd-riso-poster .hbd-edge{position:absolute;inset:0;box-shadow:inset 0 0 160px rgba(0,0,0,.55)}',
      '@keyframes hbd-rp-a{from{transform:translate3d(-2%,-1%,0)}to{transform:translate3d(3%,2%,0)}}',
      '@keyframes hbd-rp-b{from{transform:rotate(15deg) translate3d(2%,1%,0)}to{transform:rotate(15deg) translate3d(-3%,-2%,0)}}',
      '@media (prefers-reduced-motion:reduce){#hth-backdrop.hbd-riso-poster .hbd-dots{animation:none}}',
    ].join('\n'),
    html: '<div class="hbd-dots y"></div><div class="hbd-dots p"></div><div class="hbd-fiber"></div><div class="hbd-edge"></div>',
    build: function (box) {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 300;
        var g = c.getContext('2d');
        var seed = 99173, r = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        g.fillStyle = '#000'; g.fillRect(0, 0, 300, 300);
        g.lineCap = 'round';
        for (var i = 0; i < 420; i++) {
          var x = r() * 300, y = r() * 300, a = r() * Math.PI, l = 3 + r() * 14;
          g.strokeStyle = 'rgba(241,234,219,' + (0.2 + r() * 0.5).toFixed(2) + ')'; g.lineWidth = 0.5 + r() * 0.7;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
        }
        var el = box.querySelector('.hbd-fiber'); if (el) el.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
      } catch (_e) { }
    },
  };

  registerHomeTheme({
    id: ID,
    name: '孔版海报',
    cordColor: 'rgba(42,76,156,.88)',
    cordGlow: 'rgba(255,61,154,.38)',
    backdrop: BACKDROP,
    chrome: 'light',
    create: createRiso,
  });
})();
