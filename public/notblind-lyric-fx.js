/* ============================================================
 * [二改] Not Blind · 平面歌词（notblind-lyric-fx.js）
 * 播放页效果的第二类：不用 3D 舞台，整屏一张会动的歌词画面。
 *   连星成词（星图） · 网点（孔版） · 回声大字（回声） · 光斑（午后窗影）
 * 「视觉 › 播放页效果」里切换「3D 舞台 / 平面歌词」；平面歌词可以「跟随主页主题」。
 * 这个文件由 build.py 从预览项目打包（源码在 D:\music\首页概念稿\播放页歌词动效\源码），
 * 改效果请改源码再打包。纯 WebGL / Canvas，不依赖 three.js。
 * [二改 2026-09-28] 这几处是直接改在这个打包文件里的，源码目录还没同步（重新打包前要先搬过去）：
 *   NBFX.lyricScale()（歌词大小跟设置里的「歌词大小」fx.lyricScale）+ 四个效果排主行时乘上它 + 接入层 loop 里发现变了就重排；
 *   接入层 initialMode()：新用户默认平面歌词。（另一处直接改动：shelfShowing() 里的 NBFlatShelf，见平面歌单）
 * ============================================================ */
;

/* ------------------------------------------------------------
 * 底座 nbfx-core
 * ------------------------------------------------------------ */
try {
/* ============================================================
 * Not Blind · Stage Lyric FX core  (nbfx-core.js)
 * 播放页「歌词动效」共用底座：注册表 + 文字排版/遮罩 + 迷你 WebGL + 颜色工具
 * 预览页和以后装进软件都用这一份。无依赖（three.js 可选，由各效果自己决定）。
 * ============================================================ */
(function (global) {
  'use strict';
  var NBFX = global.NBFX || {};
  global.NBFX = NBFX;

  /* ---------------- registry ---------------- */
  NBFX.list = NBFX.list || [];
  NBFX.byId = NBFX.byId || {};
  NBFX.register = function (def) {
    if (!def || !def.id || typeof def.create !== 'function') throw new Error('NBFX.register: bad def');
    if (NBFX.byId[def.id]) { var i = NBFX.list.indexOf(NBFX.byId[def.id]); if (i >= 0) NBFX.list.splice(i, 1); }
    NBFX.byId[def.id] = def;
    NBFX.list.push(def);
    return def;
  };

  /* ---------------- math ---------------- */
  var M = NBFX.math = {
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    smooth: function (e0, e1, x) { var t = M.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); },
    damp: function (cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); },
    hash: function (n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); },
    // deterministic PRNG
    rng: function (seed) {
      var s = (seed >>> 0) || 1;
      return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    },
    strHash: function (str) { var h = 2166136261; str = String(str || ''); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
    easeOutCubic: function (t) { t = M.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); },
    easeInOutCubic: function (t) { t = M.clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    easeOutBack: function (t, k) { t = M.clamp(t, 0, 1); k = k == null ? 1.4 : k; var c3 = k + 1; return 1 + c3 * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2); }
  };

  /* ---------------- color ---------------- */
  var C = NBFX.color = {
    hex2rgb: function (hex) {
      hex = String(hex || '#000').replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
      var n = parseInt(hex.slice(0, 6), 16) || 0;
      return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    },
    rgb2hex: function (r) { function h(v) { v = Math.round(M.clamp(v, 0, 1) * 255).toString(16); return v.length < 2 ? '0' + v : v; } return '#' + h(r[0]) + h(r[1]) + h(r[2]); },
    mix: function (a, b, t) { return [M.lerp(a[0], b[0], t), M.lerp(a[1], b[1], t), M.lerp(a[2], b[2], t)]; },
    lum: function (r) { return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]; },
    css: function (r, a) { return 'rgba(' + Math.round(r[0] * 255) + ',' + Math.round(r[1] * 255) + ',' + Math.round(r[2] * 255) + ',' + (a == null ? 1 : a) + ')'; },
    rgb2hsl: function (r) {
      var mx = Math.max(r[0], r[1], r[2]), mn = Math.min(r[0], r[1], r[2]), h = 0, s = 0, l = (mx + mn) / 2;
      if (mx !== mn) { var d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
        if (mx === r[0]) h = (r[1] - r[2]) / d + (r[1] < r[2] ? 6 : 0); else if (mx === r[1]) h = (r[2] - r[0]) / d + 2; else h = (r[0] - r[1]) / d + 4; h /= 6; }
      return [h, s, l];
    },
    hsl2rgb: function (h) {
      var s = h[1], l = h[2], hh = h[0];
      if (!s) return [l, l, l];
      function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
      var q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      return [f(p, q, hh + 1 / 3), f(p, q, hh), f(p, q, hh - 1 / 3)];
    }
  };

  /* ---------------- fonts ---------------- */
  NBFX.fonts = {
    sans: '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC",sans-serif',
    serif: '"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","思源宋体","STZhongsong","华文中宋","Songti SC","SimSun","宋体",serif',
    mono: '"Cascadia Mono",Consolas,"JetBrains Mono","Microsoft YaHei UI",monospace',
    kai: '"LXGW WenKai","KaiTi","楷体","STKaiti","Kaiti SC","Noto Serif SC","Noto Serif CJK SC",serif'
  };
  /* 等网络字体（按 unicode-range 分片加载）把要用到的字都取回来，再去画字形纹理 */
  NBFX.fontsReady = function (text) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var sample = '回声星图窗影孔版Aa' + (text || '');
    var probes = ['400 20px ' + NBFX.fonts.sans, '700 20px ' + NBFX.fonts.sans, '900 20px ' + NBFX.fonts.sans,
      '400 20px ' + NBFX.fonts.serif, '600 20px ' + NBFX.fonts.serif, '900 20px ' + NBFX.fonts.serif, '400 20px ' + NBFX.fonts.mono];
    var all = Promise.all(probes.map(function (p) { return document.fonts.load(p, sample).catch(function () {}); })).then(function () {});
    return Promise.race([all, new Promise(function (r) { setTimeout(r, 6000); })]);
  };
  /* [二改 2026-09-28] 歌词大小：和 3D 歌词用同一个「歌词大小」（fx.lyricScale，0.35–1.65，默认 1）。
   * 各效果排主行歌词时：字号上限 × s；s < 1 时排版框也跟着缩（长句一样变小）；
   * s > 1 时放宽高度上限（长句会折成两三行、字变大），宽度不超出原来的安全区。
   * 接入层发现数值变了会让当前效果按新大小重排一次（等于窗口尺寸没变的 resize）。 */
  NBFX.lyricScale = function () {
    var v = 1;
    try { if (typeof fx !== 'undefined' && fx && Number(fx.lyricScale) > 0) v = Number(fx.lyricScale); } catch (e) { }
    if (typeof global.__nbLfxScale === 'number' && global.__nbLfxScale > 0) v = global.__nbLfxScale;   // 预览台 / 测试用
    if (!isFinite(v)) v = 1;
    return v < 0.35 ? 0.35 : v > 1.65 ? 1.65 : v;
  };

  /* ---------------- text: layout + mask ---------------- */
  var measureCanvas = null;
  function mctx() { if (!measureCanvas) measureCanvas = document.createElement('canvas').getContext('2d'); return measureCanvas; }
  var T = NBFX.text = {};
  T.isCJK = function (ch) { var c = ch.charCodeAt(0); return (c >= 0x2E80 && c <= 0x9FFF) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFF00 && c <= 0xFFEF) || (c >= 0x3000 && c <= 0x303F); };
  T.fontCss = function (size, weight, family, style) { return (style ? style + ' ' : '') + (weight || 700) + ' ' + size + 'px ' + (family || NBFX.fonts.sans); };
  /* measure every char with letterSpacing (em) */
  T.measureChars = function (text, size, weight, family, spacingEm, style) {
    var ctx = mctx(); ctx.font = T.fontCss(size, weight, family, style);
    var out = [], x = 0, ls = (spacingEm || 0) * size;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i]; var w = ctx.measureText(ch).width;
      out.push({ ch: ch, x: x, w: w, i: i });
      x += w + ls;
    }
    return { chars: out, width: Math.max(0, x - ls) };
  };
  /* split text into ≤maxLines rows, prefer spaces/punctuation, balanced */
  T.wrap = function (text, maxLines, measureFn, maxWidth) {
    text = String(text || '');
    if (measureFn(text) <= maxWidth || maxLines <= 1) return [{ s: 0, e: text.length }];
    var best = null;
    function cost(parts) { var ws = parts.map(function (p) { return measureFn(text.slice(p.s, p.e)); }); var mx = Math.max.apply(null, ws); return mx + (mx > maxWidth ? 1e6 : 0) + (Math.max.apply(null, ws) - Math.min.apply(null, ws)) * 0.35; }
    function isBreak(i) { var a = text[i - 1], b = text[i]; if (!a || !b) return false; if (b === ' ' || a === ' ') return 2; if (/[，,。.！!？?、；;：:]/.test(a)) return 2; if (T.isCJK(a) || T.isCJK(b)) return 1; return 0; }
    for (var n = 2; n <= maxLines; n++) {
      // candidate break combos (greedy search over each break near ideal)
      var cands = [];
      for (var i = 1; i < text.length; i++) { var q = isBreak(i); if (q) cands.push({ i: i, q: q }); }
      if (!cands.length) break;
      var target = text.length / n, parts = [], s = 0;
      for (var k = 1; k < n; k++) {
        var ideal = target * k, pick = null, bd = 1e9;
        cands.forEach(function (c) { if (c.i <= s) return; var d = Math.abs(c.i - ideal) - (c.q === 2 ? target * 0.35 : 0); if (d < bd) { bd = d; pick = c.i; } });
        if (pick == null) break;
        parts.push({ s: s, e: pick }); s = pick;
      }
      parts.push({ s: s, e: text.length });
      parts = parts.map(function (p) { var a = p.s, b = p.e; while (a < b && text[a] === ' ') a++; while (b > a && text[b - 1] === ' ') b--; return { s: a, e: b }; }).filter(function (p) { return p.e > p.s; });
      var c = cost(parts);
      if (!best || c < best.c) best = { c: c, parts: parts };
      if (c < 1e6) break;
    }
    return best ? best.parts : [{ s: 0, e: text.length }];
  };
  /* Fit text into box: returns layout with rows & per-char positions (in CSS px, relative to box top-left)
   * opts: {maxWidth, maxHeight, size (max), minSize, weight, family, spacing(em), lineHeight(em), maxLines, align:'center'|'left'|'right'} */
  T.layout = function (text, opts) {
    opts = opts || {};
    text = String(text || '').replace(/\s+/g, ' ').trim();
    var weight = opts.weight || 700, fam = opts.family || NBFX.fonts.sans, sp = opts.spacing || 0, lh = opts.lineHeight || 1.18;
    var maxW = opts.maxWidth || 1000, maxH = opts.maxHeight || 1e9, size = opts.size || 96, minSize = opts.minSize || 18, maxLines = opts.maxLines || 2;
    var rows, measured;
    for (var guard = 0; guard < 40; guard++) {
      var mf = function (s) { return T.measureChars(s, size, weight, fam, sp, opts.style).width; };
      var parts = T.wrap(text, maxLines, mf, maxW);
      rows = parts.map(function (p) { var m = T.measureChars(text.slice(p.s, p.e), size, weight, fam, sp, opts.style); return { s: p.s, e: p.e, width: m.width, chars: m.chars }; });
      var widest = Math.max.apply(null, rows.map(function (r) { return r.width; }));
      var totalH = size * lh * rows.length;
      if ((widest <= maxW && totalH <= maxH) || size <= minSize) break;
      var k = Math.min(maxW / Math.max(1, widest), maxH / Math.max(1, totalH));
      size = Math.max(minSize, Math.floor(size * Math.min(0.96, k * 0.995)));
    }
    var chars = [];
    var width = 0;
    rows.forEach(function (r, ri) {
      var off = opts.align === 'left' ? 0 : opts.align === 'right' ? (maxW - r.width) : (maxW - r.width) / 2;
      r.x = off; r.y = ri * size * lh; r.baseline = r.y + size * 0.88;
      r.chars.forEach(function (c) { c.i = r.s + c.i; c.x += off; c.row = ri; c.y = r.y; c.baseline = r.baseline; chars.push(c); });
      width = Math.max(width, r.width);
    });
    return { text: text, size: size, weight: weight, family: fam, spacing: sp, lineHeight: lh, style: opts.style, rows: rows, chars: chars, width: width, boxWidth: maxW, height: rows.length * size * lh, ascent: size * 0.88 };
  };
  /* Render layout to a canvas mask.
   * R = glyph coverage, G = char index + 1 (cell rect, 0 = none), B = row index*40, A = 1 inside cells.
   * opts: {scale (px per css px), pad (css px), stroke (css px, optional extra outline in R), cellPad}
   * returns {canvas, width, height (device px), scale, pad, layout} */
  T.renderMask = function (layout, opts) {
    opts = opts || {};
    var sc = opts.scale || 1, pad = opts.pad == null ? 16 : opts.pad;
    var W = Math.ceil((layout.boxWidth + pad * 2) * sc), H = Math.ceil((layout.height + pad * 2) * sc);
    var cv = opts.canvas || document.createElement('canvas');
    cv.width = Math.max(2, W); cv.height = Math.max(2, H);
    var ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(sc, 0, 0, sc, pad * sc, pad * sc);
    var lhPx = layout.size * layout.lineHeight;
    // cells
    ctx.globalCompositeOperation = 'source-over';
    layout.chars.forEach(function (c) {
      var idx = Math.min(254, c.i + 1);
      ctx.fillStyle = 'rgb(0,' + idx + ',' + Math.min(255, c.row * 40) + ')';
      var gap = layout.spacing * layout.size;
      ctx.fillRect(c.x - gap / 2 - 0.5, c.y, c.w + gap + 1, lhPx);
    });
    // glyphs additive into R
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgb(255,0,0)';
    ctx.font = T.fontCss(layout.size, layout.weight, layout.family, layout.style);
    ctx.textBaseline = 'alphabetic';
    layout.chars.forEach(function (c) { if (c.ch !== ' ') ctx.fillText(c.ch, c.x, c.baseline); });
    if (opts.stroke) { ctx.strokeStyle = 'rgb(255,0,0)'; ctx.lineWidth = opts.stroke; ctx.lineJoin = 'round'; layout.chars.forEach(function (c) { if (c.ch !== ' ') ctx.strokeText(c.ch, c.x, c.baseline); }); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { canvas: cv, width: cv.width, height: cv.height, scale: sc, pad: pad, layout: layout };
  };
  /* plain white-on-transparent glyph canvas (for Canvas2D compositing effects) */
  T.renderPlain = function (layout, opts) {
    opts = opts || {};
    var sc = opts.scale || 1, pad = opts.pad == null ? 16 : opts.pad;
    var cv = opts.canvas || document.createElement('canvas');
    cv.width = Math.max(2, Math.ceil((layout.boxWidth + pad * 2) * sc)); cv.height = Math.max(2, Math.ceil((layout.height + pad * 2) * sc));
    var ctx = cv.getContext('2d');
    ctx.setTransform(sc, 0, 0, sc, pad * sc, pad * sc);
    ctx.clearRect(-pad, -pad, cv.width, cv.height);
    ctx.font = T.fontCss(layout.size, layout.weight, layout.family, layout.style);
    ctx.fillStyle = opts.color || '#fff';
    layout.chars.forEach(function (c) { if (c.ch !== ' ') ctx.fillText(c.ch, c.x, c.baseline); });
    if (opts.stroke) { ctx.strokeStyle = opts.strokeColor || opts.color || '#fff'; ctx.lineWidth = opts.stroke; ctx.lineJoin = 'round'; layout.chars.forEach(function (c) { if (c.ch !== ' ') ctx.strokeText(c.ch, c.x, c.baseline); }); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { canvas: cv, width: cv.width, height: cv.height, scale: sc, pad: pad, layout: layout };
  };

  /* ---------------- lyric timing helpers ---------------- */
  var L = NBFX.lyric = {};
  /* float count of chars sung at time t (uses word timing when present) */
  L.charPos = function (line, t) {
    if (!line) return 0;
    var n = String(line.text || '').length;
    if (line.words && line.words.length) {
      var pos = 0;
      for (var i = 0; i < line.words.length; i++) {
        var w = line.words[i];
        if (t < w.t) break;
        if (t >= w.t + w.d) pos = w.c1; else { pos = w.c0 + (w.c1 - w.c0) * (t - w.t) / w.d; break; }
      }
      return Math.min(n, pos);
    }
    var dur = Math.max(0.6, (line.duration || 4) * 0.82);
    return Math.min(n, Math.max(0, (t - line.t) / dur * n));
  };
  /* 提前量：正常播放时，下一句开唱前 sec 秒就把它当成"当前行"（charPos=0），
   * 让换行动画在开唱前做完。用法：frame(f){ f = NBFX.lyric.lead(f, 0.5); ... } */
  L.lead = function (f, sec) {
    var ly = f && f.lyric;
    if (!ly || !f.playing || !ly.next || ly.idx < -1 || !(sec > 0)) return f;
    var dtn = ly.next.t - ly.songTime;
    if (!(dtn > 0 && dtn < sec)) return f;
    var ni = ly.idx + 1;
    var nl = Object.assign({}, ly, { idx: ni, line: ly.next, prev: ly.line, next: (ly.lines && ly.lines[ni + 1]) || null,
      lineTime: -dtn, progress: 0, charPos: 0, held: false, changed: false, fallback: null, leadIn: dtn });
    return Object.assign({}, f, { lyric: nl });
  };
  L.findIndex = function (lines, t) {
    if (!lines || !lines.length) return -1;
    var lo = 0, hi = lines.length - 1, ans = -1, target = t + 0.05;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if ((lines[mid].t || 0) <= target) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  };

  /* ---------------- mini WebGL ---------------- */
  var G = NBFX.gl = {};
  G.QUAD_VS = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }';
  G.create = function (canvas, opts) {
    opts = opts || {};
    var attrs = { alpha: opts.alpha !== false, premultipliedAlpha: opts.premultipliedAlpha !== false, antialias: !!opts.antialias, depth: false, stencil: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: 'high-performance' };
    var gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) return null;
    gl.getExtension('OES_standard_derivatives');
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl._quad = buf;
    return gl;
  };
  G.program = function (gl, vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var log = gl.getShaderInfoLog(s); console.error(log + '\n' + src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n')); throw new Error('shader compile: ' + log); }
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs || G.QUAD_VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    var uni = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); var name = info.name.replace(/\[0\]$/, ''); uni[name] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: uni, gl: gl };
  };
  /* set uniforms by value type: number→1f, [a,b]→2f, [a,b,c]→3f, [4]→4f, {tex,unit}→sampler, Float32Array(len>4) → 1fv */
  G.use = function (prog, uniforms) {
    var gl = prog.gl; gl.useProgram(prog.p);
    for (var k in uniforms) {
      var loc = prog.u[k]; if (loc == null) continue; var v = uniforms[k];
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (v && v.tex) { gl.activeTexture(gl.TEXTURE0 + (v.unit || 0)); gl.bindTexture(gl.TEXTURE_2D, v.tex); gl.uniform1i(loc, v.unit || 0); }
      else if (v && v.int != null) gl.uniform1i(loc, v.int);
      else if (v && v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else if (v && v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
      else if (v && v.length === 4 && !(v instanceof Float32Array)) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
      else if (v && v.length) gl.uniform1fv(loc, v);
    }
  };
  G.drawQuad = function (gl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl._quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  G.texture = function (gl, source, opts) {
    opts = opts || {};
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    var filt = opts.nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mipmap ? gl.LINEAR_MIPMAP_LINEAR : filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    var wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (source) G.upload(gl, t, source, opts);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    return t;
  };
  G.upload = function (gl, tex, source, opts) {
    opts = opts || {};
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flipY ? 1 : 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, opts.premultiply ? 1 : 0);
    if (source.data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (opts.mipmap) gl.generateMipmap(gl.TEXTURE_2D);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  };
  /* render target */
  G.target = function (gl, w, h, opts) {
    opts = opts || {};
    var tex = G.texture(gl, null, opts);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb: fb, tex: tex, w: w, h: h };
  };
  G.bindTarget = function (gl, tgt, W, H) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, tgt ? tgt.fb : null);
    gl.viewport(0, 0, tgt ? tgt.w : W, tgt ? tgt.h : H);
  };
  G.destroy = function (gl) {
    try { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {}
  };

  /* ---------------- canvas helpers ---------------- */
  NBFX.canvas = function (host, cls, opts) {
    opts = opts || {};
    var c = document.createElement('canvas');
    c.className = cls || '';
    c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;' + (opts.css || '');
    host.el.appendChild(c);
    return c;
  };
  /* tileable value-noise / grain canvas */
  NBFX.noiseCanvas = function (size, seed, octaves) {
    size = size || 256; var r = M.rng(seed || 7), cv = document.createElement('canvas'); cv.width = cv.height = size;
    var ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
    for (var i = 0; i < size * size; i++) { var v = r() * 255; d[i * 4] = v; d[i * 4 + 1] = r() * 255; d[i * 4 + 2] = r() * 255; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return cv;
  };
})(typeof window !== 'undefined' ? window : globalThis);
} catch (nbLyricFxLoadErr) { try { console.error("[平面歌词] 载入失败：底座 nbfx-core", nbLyricFxLoadErr); } catch (_e) { } }

/* ------------------------------------------------------------
 * 星图 · 连星成词 (star-constellation)
 * ------------------------------------------------------------ */
try {
/* ============================================================
 * 星图 · 连星成词 CONSTELLATION   (star-constellation.js)
 * 每一行歌词被写成一个"星座"：字形 → 骨架细化（Zhang-Suen）→ 端点/交叉点/拐点成星，
 * 骨架折线（Douglas-Peucker 简化）成星座连线。唱到的字像笔一样描出来、星依次点亮；
 * 唱完的一行融进星空，跟着周日旋转慢慢转走、变暗，成为普通的星。
 * 背景：银河（一次烘焙）+ 细碎暗星（着色器）+ 亮星点（GL points）、气辉光罩、山脊树影、
 * 极淡的赤经赤纬网格与等宽小字注记。整个天空绕北天极（画面左上）逆时针极慢地转。
 * ============================================================ */
(function () {
  'use strict';
  var NBFX = typeof window !== 'undefined' ? window.NBFX : null;
  if (!NBFX) return;
  var M = NBFX.math;
  var DEG = Math.PI / 180, TAU = Math.PI * 2;
  var IVORY = [0.925, 0.902, 0.847], GOLD = [0.80, 0.67, 0.44];
  var CJK_RE = /[⺀-鿿豈-﫿　-〿＀-￯]/;
  var SKY_RATE = 0.2 * DEG;          // 周日旋转（延时摄影式放慢）：每秒 0.2°
  var KICK = 8 * DEG;                // 唱完的行被天空"接走"时额外多转的角度
  var LAT = 40;                      // 观测地纬度（决定星图比例尺）

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hash1(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise1(x, seed) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); var a = hash1(i + seed * 57.31), b = hash1(i + 1 + seed * 57.31); return a + (b - a) * u; }
  function fbm1(x, seed, oct) { var s = 0, a = 0.5, n = 0; for (var k = 0; k < oct; k++) { s += a * vnoise1(x, seed + k * 13.7); n += a; x *= 2.03; a *= 0.5; } return s / n; }
  function rgba(c, a) { return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function starColor(t) { // 0 暖(K/M) → 0.5 白 → 1 冷(B/A)
    var warm = [1.0, 0.74, 0.52], mid = [1.0, 0.96, 0.9], cool = [0.70, 0.80, 1.0];
    return t < 0.5 ? mix3(warm, mid, t * 2) : mix3(mid, cool, (t - 0.5) * 2);
  }

  /* =====================================================================
   * 字形骨架：渲染 → 二值化 → Zhang-Suen 细化 → 图（端点/交叉点/链）→ 去毛刺 → DP 简化
   * 结果以 em 为单位（x 从字的起笔原点、y 从基线），按字缓存。
   * ===================================================================== */
  var SK_SIZE = 96, SK_WEIGHT = 400;
  var skCache = {}, skCanvas = null, skCtx = null;
  var NDX = [0, 1, 1, 1, 0, -1, -1, -1], NDY = [-1, -1, 0, 1, 1, 1, 0, -1];
  // 8 邻域图案 → 邻居之间的 8 连通分量数（用来判断"楼梯角"冗余像素）
  var COMP8 = (function () {
    var t = new Uint8Array(256);
    for (var m = 0; m < 256; m++) {
      var seen = 0, comps = 0;
      for (var a = 0; a < 8; a++) {
        if (!((m >> a) & 1) || ((seen >> a) & 1)) continue;
        comps++; var st = [a]; seen |= 1 << a;
        while (st.length) {
          var k = st.pop();
          for (var b = 0; b < 8; b++) {
            if (!((m >> b) & 1) || ((seen >> b) & 1)) continue;
            if (Math.max(Math.abs(NDX[k] - NDX[b]), Math.abs(NDY[k] - NDY[b])) === 1) { seen |= 1 << b; st.push(b); }
          }
        }
      }
      t[m] = comps;
    }
    return t;
  })();
  function nbMask(img, i, w) { var m = 0; for (var k = 0; k < 8; k++) if (img[i + NDY[k] * w + NDX[k]]) m |= 1 << k; return m; }
  function zhangSuen(img, w, h) {
    var del = [], changed = true, guard = 0;
    while (changed && guard++ < 60) {
      changed = false;
      for (var pass = 0; pass < 2; pass++) {
        del.length = 0;
        for (var y = 1; y < h - 1; y++) {
          for (var x = 1; x < w - 1; x++) {
            var i = y * w + x; if (!img[i]) continue;
            var p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1], p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
            var B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
            var A = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) + (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) +
              (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) + (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
            if (A !== 1) continue;
            if (pass === 0) { if (p2 * p4 * p6 || p4 * p6 * p8) continue; }
            else { if (p2 * p4 * p8 || p2 * p6 * p8) continue; }
            del.push(i);
          }
        }
        if (del.length) { changed = true; for (var d = 0; d < del.length; d++) img[del[d]] = 0; }
      }
    }
    // 去掉楼梯角（N&E / E&S / S&W / W&N 同时存在且拿掉不影响连通）
    for (var yy = 1; yy < h - 1; yy++) for (var xx = 1; xx < w - 1; xx++) {
      var j = yy * w + xx; if (!img[j]) continue;
      var n = img[j - w], e = img[j + 1], s = img[j + w], ww = img[j - 1];
      if (!((n && e) || (e && s) || (s && ww) || (ww && n))) continue;
      var mk = nbMask(img, j, w), cnt = 0; for (var q = 0; q < 8; q++) cnt += (mk >> q) & 1;
      if (cnt >= 2 && COMP8[mk] === 1) img[j] = 0;
    }
  }
  function plen(p) { var s = 0; for (var i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; }
  function dpSimplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    var keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    var stack = [[0, pts.length - 1]];
    while (stack.length) {
      var sg = stack.pop(), a = sg[0], b = sg[1], ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
      var dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), md = -1, mi = -1;
      for (var i = a + 1; i < b; i++) {
        var d = L < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L;
        if (d > md) { md = d; mi = i; }
      }
      if (md > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    var out = []; for (var k = 0; k < pts.length; k++) if (keep[k]) out.push(pts[k]);
    return out;
  }
  function extractGraph(img, w, h, S) {
    var N = w * h, deg = new Uint8Array(N), i, k;
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      i = y * w + x; if (!img[i]) continue;
      var d = 0; for (k = 0; k < 8; k++) if (img[i + NDY[k] * w + NDX[k]]) d++;
      deg[i] = d;
    }
    var cl = new Int32Array(N); for (i = 0; i < N; i++) cl[i] = -1;
    var nodes = [];
    function addNode(pix, type) { var sx = 0, sy = 0; pix.forEach(function (p) { sx += p % w; sy += (p / w) | 0; cl[p] = nodes.length; }); nodes.push({ x: sx / pix.length + 0.5, y: sy / pix.length + 0.5, pix: pix, type: type }); return nodes.length - 1; }
    for (i = 0; i < N; i++) {
      if (!img[i] || deg[i] === 2 || cl[i] >= 0) continue;
      if (deg[i] >= 3) { // 交叉点像素团
        var pix = [i], q = [i]; cl[i] = -2;
        while (q.length) { var c = q.pop(); for (k = 0; k < 8; k++) { var r = c + NDY[k] * w + NDX[k]; if (img[r] && deg[r] >= 3 && cl[r] === -1) { cl[r] = -2; pix.push(r); q.push(r); } } }
        addNode(pix, 'j');
      } else addNode([i], deg[i] === 1 ? 'e' : 'd');
    }
    var vis = new Uint8Array(N), edges = [], pair = {};
    function trace(ni, p, q0) {
      var path = [[nodes[ni].x, nodes[ni].y]], prev = p, cur = q0, endN = -1, guard = 0;
      while (guard++ < 8000) {
        vis[cur] = 1; path.push([cur % w + 0.5, ((cur / w) | 0) + 0.5]);
        var nxt = -1, hit = -1;
        for (var kk = 0; kk < 8; kk++) {
          var r = cur + NDY[kk] * w + NDX[kk];
          if (!img[r] || r === prev) continue;
          if (cl[r] >= 0) hit = cl[r]; else if (!vis[r]) nxt = r;
        }
        if (hit >= 0 && (hit !== ni || path.length > 4)) { endN = hit; break; }
        if (nxt < 0) break;
        prev = cur; cur = nxt;
      }
      if (endN < 0) { // 断在链中间（极少）：补一个端点
        var last = path[path.length - 1];
        if (path.length < 4) return;
        endN = nodes.length; nodes.push({ x: last[0], y: last[1], pix: [], type: 'e' });
      } else path.push([nodes[endN].x, nodes[endN].y]);
      if (endN === ni && path.length < 6) return;
      edges.push({ a: ni, b: endN, path: path });
    }
    var n0 = nodes.length;
    for (var ni = 0; ni < n0; ni++) {
      nodes[ni].pix.forEach(function (p) {
        for (var kk = 0; kk < 8; kk++) {
          var q = p + NDY[kk] * w + NDX[kk];
          if (!img[q] || cl[q] === ni) continue;
          if (cl[q] >= 0) { var a = Math.min(ni, cl[q]), b = Math.max(ni, cl[q]), key = a + '_' + b; if (!pair[key]) { pair[key] = 1; edges.push({ a: a, b: b, path: [[nodes[a].x, nodes[a].y], [nodes[b].x, nodes[b].y]] }); } continue; }
          if (vis[q]) continue;
          trace(ni, p, q);
        }
      });
    }
    // 没有节点的闭环（如 O）：随便挑一个像素当节点
    for (i = 0; i < N; i++) {
      if (!img[i] || vis[i] || cl[i] >= 0 || deg[i] !== 2) continue;
      var nn = addNode([i], 'c');
      for (k = 0; k < 8; k++) { var r2 = i + NDY[k] * w + NDX[k]; if (img[r2] && !vis[r2] && cl[r2] < 0) { trace(nn, i, r2); break; } }
    }
    // 去毛刺 + 合并二度交叉点
    function degs() { nodes.forEach(function (n) { n.deg = 0; }); edges.forEach(function (e) { if (e.dead) return; nodes[e.a].deg++; nodes[e.b].deg++; }); }
    var spur = S * 0.10;
    for (var it = 0; it < 3; it++) {
      degs();
      edges.forEach(function (e) {
        if (e.dead) return; var L = plen(e.path), da = nodes[e.a].deg, db = nodes[e.b].deg;
        if (e.a !== e.b && ((da === 1 && db >= 3) || (db === 1 && da >= 3)) && L < spur) e.dead = true;
        else if (da === 1 && db === 1 && L < S * 0.03) e.dead = true;
      });
      degs();
      for (var nj = 0; nj < nodes.length; nj++) {
        var nd = nodes[nj]; if (nd.deg !== 2) continue;
        var es = edges.filter(function (e) { return !e.dead && (e.a === nj || e.b === nj); });
        if (es.length !== 2) continue;
        var e1 = es[0], e2 = es[1];
        var p1 = e1.a === nj ? e1.path.slice().reverse() : e1.path.slice(), s1 = e1.a === nj ? e1.b : e1.a;
        var p2 = e2.b === nj ? e2.path.slice().reverse() : e2.path.slice(), s2 = e2.b === nj ? e2.a : e2.b;
        e1.dead = e2.dead = true;
        edges.push({ a: s1, b: s2, path: p1.concat(p2.slice(1)) });
        nd.deg = 0; nd.merged = true;
      }
    }
    degs();
    return { nodes: nodes, edges: edges.filter(function (e) { return !e.dead; }) };
  }
  function glyphSkeleton(ch) {
    if (skCache[ch]) return skCache[ch];
    var S = SK_SIZE, font = SK_WEIGHT + ' ' + S + 'px ' + NBFX.fonts.sans;
    if (!skCanvas) { skCanvas = document.createElement('canvas'); skCtx = skCanvas.getContext('2d', { willReadFrequently: true }); }
    skCtx.font = font;
    var adv = skCtx.measureText(ch).width, pad = Math.ceil(S * 0.14);
    var base = Math.round(pad + S * 0.92), w = Math.ceil(adv + pad * 2), h = Math.ceil(base + S * 0.3 + pad);
    skCanvas.width = w; skCanvas.height = h;
    skCtx.font = font; skCtx.fillStyle = '#fff'; skCtx.textBaseline = 'alphabetic';
    skCtx.clearRect(0, 0, w, h); skCtx.fillText(ch, pad, base);
    var data = skCtx.getImageData(0, 0, w, h).data, img = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) img[i] = data[i * 4 + 3] > 118 ? 1 : 0;
    for (var x = 0; x < w; x++) { img[x] = 0; img[(h - 1) * w + x] = 0; }
    for (var y = 0; y < h; y++) { img[y * w] = 0; img[y * w + w - 1] = 0; }
    zhangSuen(img, w, h);
    var g = extractGraph(img, w, h, S);
    // 星 = 节点 + DP 拐点，距离很近的合并
    var stars = [], mergeR = S * 0.05, eps = S * 0.03;
    function starAt(x, y, t) {
      for (var k = 0; k < stars.length; k++) { var s = stars[k]; if (Math.hypot(s.x - x, s.y - y) < mergeR) { if (t > s.t) { s.t = t; s.x = x; s.y = y; } return k; } }
      stars.push({ x: x, y: y, t: t }); return stars.length - 1;
    }
    function ntype(n) { return n.deg >= 3 ? 2 : n.deg <= 1 ? 1 : 0; }
    var polys = [];
    g.edges.forEach(function (e) {
      var sp = dpSimplify(e.path, eps), idx = [];
      for (var k = 0; k < sp.length; k++) {
        var t = k === 0 ? ntype(g.nodes[e.a]) : k === sp.length - 1 ? ntype(g.nodes[e.b]) : 0;
        var si = starAt(sp[k][0], sp[k][1], t);
        if (!idx.length || idx[idx.length - 1] !== si) idx.push(si);
      }
      if (idx.length >= 2) polys.push(idx);
    });
    g.nodes.forEach(function (n) { if (n.type === 'd' || (n.deg === 0 && !n.merged && n.pix.length)) starAt(n.x, n.y, 1); });
    // 转 em 坐标
    stars.forEach(function (s) { s.x = (s.x - pad) / S; s.y = (s.y - base) / S; });
    // 笔顺近似：起点取靠上（横画取靠左），先上后下、先左后右
    var P = polys.map(function (idx) {
      var a = stars[idx[0]], b = stars[idx[idx.length - 1]];
      var dx = b.x - a.x, dy = b.y - a.y;
      var flip = Math.abs(dy) < Math.abs(dx) * 0.4 ? dx < 0 : dy < 0;
      if (flip) idx = idx.slice().reverse();
      var s0 = stars[idx[0]], L = 0, cum = [0];
      for (var k = 1; k < idx.length; k++) { L += Math.hypot(stars[idx[k]].x - stars[idx[k - 1]].x, stars[idx[k]].y - stars[idx[k - 1]].y); cum.push(L); }
      return { idx: idx, len: L, cum: cum, key: Math.round((s0.y + 1) / 0.14) * 10 + s0.x };
    }).filter(function (p) { return p.len > 0.004; });
    P.sort(function (a, b) { return a.key - b.key; });
    var total = 0; P.forEach(function (p) { total += p.len; });
    var acc = 0;
    P.forEach(function (p) {
      p.s = total ? 0.55 * acc / total : 0; p.e = Math.min(1, p.s + 0.45 + 0.55 * (total ? p.len / total : 1));
      acc += p.len;
      for (var k = 0; k < p.idx.length; k++) { var s = stars[p.idx[k]], th = p.s + (p.e - p.s) * (p.len ? p.cum[k] / p.len : 0); s.th = s.th == null ? th : Math.min(s.th, th); }
    });
    stars.forEach(function (s) { if (s.th == null) s.th = 0.5; });
    var res = { stars: stars, polys: P, adv: adv / S };
    skCache[ch] = res;
    return res;
  }

  /* =====================================================================
   * 着色器
   * ===================================================================== */
  var NOISE = [
    'float h11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }',
    'float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }',
    'vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }',
    'float vnoise2(vec2 x){ vec2 i=floor(x); vec2 f=fract(x); f=f*f*(3.-2.*f);',
    '  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }',
    'float fbm2(vec2 p){ float a=.5, s=0.; for(int i=0;i<6;i++){ s+=a*vnoise2(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s/0.985; }',
    'float fbm8(vec2 p){ float a=.5, s=0.; for(int i=0;i<8;i++){ s+=a*vnoise2(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s/0.996; }',
    'float ridged2(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ float n = 1.-abs(vnoise2(p)*2.-1.); s+=a*n*n; p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s; }'
  ].join('\n');

  // 银河：天空坐标（相对天极，CSS px）一次烘焙，之后每帧旋转采样
  var MW_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform float uR; uniform float uH; uniform vec2 uBandP; uniform vec2 uBandDir; uniform float uBandW; uniform float uCoreAlong; uniform float uMW; uniform float uSeed;',
    NOISE,
    'void main(){',
    '  vec2 s = vec2(vUv.x, 1.0 - vUv.y)*2.0*uR - uR;',
    '  vec2 q = s/uH;',
    '  vec2 dir = normalize(uBandDir); vec2 perp = vec2(-dir.y, dir.x);',
    '  vec2 rel = q - uBandP;',
    '  float along = dot(rel, dir);',
    '  float across = dot(rel, perp) + 0.05*sin(along*2.3+uSeed) + 0.05*(fbm2(vec2(along*1.3, uSeed))-0.5);',
    '  float w = uBandW*(0.8+0.4*fbm2(vec2(along*0.9+4.0, 2.0)));',
    '  float core = exp(-pow((along-uCoreAlong)/0.7, 2.0));',
    '  float prof = exp(-across*across/(w*w));',
    '  float wide = exp(-across*across/(w*w*5.0));',
    '  vec2 bq = vec2(along, across)*3.0 + uSeed;',
    '  float cl = fbm2(bq); float cl2 = fbm2(bq*3.1+3.0); float cl3 = fbm8(bq*8.0+7.0);',
    '  float mw = prof*(0.10 + 1.6*pow(cl, 3.0))*(0.5+0.9*core);',
    '  mw *= 0.35 + 1.1*cl2*cl2;',
    '  mw *= 0.6 + 0.8*cl3;',
    '  mw += wide*0.035*(0.4+cl);',
    '  vec2 dq = vec2(along*4.0, across*8.0);',
    '  dq += 2.2*vec2(fbm2(dq*0.4+1.0), fbm2(dq*0.4+8.0));',
    '  float fil = smoothstep(0.50, 0.95, ridged2(dq*0.9 + uSeed*1.3));',
    '  float fil2 = smoothstep(0.55, 0.9, ridged2(dq*2.3 + 11.0));',
    '  float riftC = 0.35*w*(fbm2(vec2(along*1.6, 9.0))-0.5)*2.0;',
    '  float riftW = w*(0.12 + 0.30*fbm2(vec2(along*2.2, 3.0)));',
    '  vec2 rq = vec2(along*5.0, across*9.0); rq += 1.5*vec2(fbm2(rq*0.5), fbm2(rq*0.5+4.0));',
    '  float rift = exp(-pow((across-riftC)/riftW, 2.0)) * smoothstep(0.35, 0.7, fbm8(rq+5.0));',
    '  float dust = clamp(fil*prof*0.7 + fil2*prof*0.35 + rift*0.85*prof, 0., 0.96);',
    '  vec3 cWarm = vec3(1.0, 0.80, 0.60), cCool = vec3(0.62, 0.72, 1.0);',
    '  vec3 mwc = mix(cCool, cWarm, clamp(core*0.6 + 0.35*cl2 - 0.15, 0., 1.));',
    '  vec3 col = mwc*mw*uMW*(1.0 - dust);',
    '  col += vec3(0.05,0.03,0.015)*fil*prof*(1.-rift)*uMW*0.25;',
    '  float hii = smoothstep(0.74, 0.92, fbm2(bq*1.9+17.0))*prof*(1.-dust);',
    '  col += vec3(0.55,0.14,0.20)*hii*0.06*uMW;',
    '  float bgn = fbm2(q*1.4+uSeed);',
    '  col += mix(vec3(0.0010,0.0015,0.0034), vec3(0.0024,0.0033,0.0072), bgn);',
    '  col = 1.0 - exp(-col*1.1);',
    '  col = pow(col, vec3(0.5));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  // 每帧合成：旋转采样银河 + 暗星（天空坐标里的哈希格子）+ 气辉/光罩 + 歌词星云 + 暗角
  var COMP_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uMW; uniform float uMWR; uniform float uMWOn;',
    'uniform vec2 uView; uniform vec2 uPole; uniform float uAng; uniform float uTime; uniform float uDpr;',
    'uniform float uHorY; uniform float uBass; uniform float uTw; uniform vec3 uTint; uniform vec3 uAir;',
    'uniform sampler2D uGlow; uniform vec4 uGB; uniform vec2 uGT; uniform sampler2D uInt; uniform float uGA;',
    'uniform sampler2D uGlow2; uniform vec4 uGB2; uniform float uGA2; uniform float uGR2;',
    NOISE,
    'float gLow;',
    'vec3 dust(vec2 w, float cell, float thr, float gain, float seed){',
    '  vec2 id = floor(w/cell); vec2 r = h22(id+seed);',
    '  if(r.x < thr) return vec3(0.);',
    '  vec2 o = (0.15+0.7*h22(id*1.37+seed+7.1))*cell;',
    '  float d = length(w - (id*cell+o))*uDpr;',
    '  float m = (0.22 + 0.78*pow(h21(id+seed*3.7), 3.0))*gain;',
    '  float tw = 1.0 + (0.25+uTw)*(0.35+1.4*gLow)*sin(uTime*(1.3+4.0*r.y) + r.y*60.0);',
    '  vec3 c = mix(vec3(1.0,0.80,0.62), vec3(0.74,0.84,1.0), h21(id*2.1+seed));',
    '  c = mix(c, vec3(1.0), 0.45);',
    '  return c*m*max(tw,0.0)*exp(-d*d/0.62);',
    '}',
    'vec3 lyricGlow(vec2 p, sampler2D tex, vec4 box, float a, float sungAll, bool live){',
    '  vec2 gp = (p - box.xy)/box.zw;',
    '  if(gp.x <= 0.0 || gp.y <= 0.0 || gp.x >= 1.0 || gp.y >= 1.0 || a < 0.002) return vec3(0.0, 0.0, 0.0);',
    '  vec4 g = texture2D(tex, gp);',
    '  float sung = sungAll, boost = 0.0;',
    '  if(live){',
    '    vec2 tc = (floor(gp*uGT)+0.5)/uGT;',
    '    float gi = floor(texture2D(tex, tc).g*255.0 + 0.5) - 1.0;',
    '    if(gi >= 0.0){ vec4 it = texture2D(uInt, vec2((gi+0.5)/128.0, 0.5)); sung = it.r; boost = it.g; } else sung = 0.0;',
    '  }',
    '  return vec3(g.r, g.b, (0.10 + 0.90*sung + 0.8*boost))*vec3(a, a, 1.0);',
    '}',
    'void main(){',
    '  vec2 p = vec2(vUv.x, 1.0 - vUv.y)*uView;',
    '  vec2 d = p - uPole;',
    '  float c = cos(-uAng), s = sin(-uAng);',
    '  vec2 w = vec2(c*d.x - s*d.y, s*d.x + c*d.y);',
    '  vec2 muv = (w + uMWR)/(2.0*uMWR);',
    '  vec3 col = texture2D(uMW, vec2(muv.x, 1.0 - muv.y)).rgb;',
    '  col = mix(vec3(0.045,0.052,0.075), col, uMWOn);',
    '  float up = max(uHorY - p.y, 0.0)/uView.y;',
    '  gLow = exp(-up/0.12);',
    '  col *= (1.0 + 0.06*uBass)*(1.0 - 0.45*gLow);',
    '  float mwl = dot(col, vec3(0.3,0.5,0.2));',
    '  vec3 st = dust(w, 3.2, 0.955 - mwl*0.9, 0.34, 1.0) + dust(w, 6.5, 0.905 - mwl*0.6, 0.55, 2.0) + dust(w, 13.0, 0.87, 0.85, 3.0);',
    '  col += st*(1.0 - 0.6*gLow);',
    // 气辉（地平线上方一层淡青绿，更高一点暗红）+ 远处小镇的暖色光罩
    '  float wave = 1.0 + 0.35*sin(p.x/uView.y*14.0 + 3.0*vnoise2(vec2(p.x/uView.y*2.5, up*6.0)) + up*50.0);',
    '  vec3 air = uAir*exp(-up/0.075)*wave*(1.0 + 0.12*uBass) + vec3(0.024,0.010,0.012)*exp(-pow((up-0.21)/0.07,2.0));',
    '  float dome = exp(-pow((p.x/uView.x - 0.80)/0.20, 2.0));',
    '  air += vec3(0.10,0.058,0.030)*dome*exp(-up/0.085)*(1.0 + 0.08*uBass);',
    '  col += air;',
    // 歌词星云：字形周围极淡的柔光，外圈先压暗天空（帮助阅读）
    '  vec3 g1 = lyricGlow(p, uGlow, uGB, uGA, 1.0, true);',
    '  vec2 d2 = p - uPole; float c2 = cos(-uGR2), s2 = sin(-uGR2);',
    '  vec2 p2 = uPole + vec2(c2*d2.x - s2*d2.y, s2*d2.x + c2*d2.y);',
    '  vec3 g2 = lyricGlow(p2, uGlow2, uGB2, uGA2, 1.0, false);',
    '  float veil = clamp(g1.x*(0.10 + 0.20*min(g1.z, 1.0)), 0.0, 0.5);',
    '  col *= 1.0 - veil;',
    '  float neb = 0.55 + 0.9*vnoise2(p/uView.y*9.0 + vec2(uTime*0.02, 0.0))*vnoise2(p/uView.y*23.0 - 3.0);',
    '  col += uTint*((g1.x*0.07 + g1.y*0.15)*g1.z + (g2.x*0.05 + g2.y*0.10)*g2.z)*neb;',
    '  vec2 vq = vUv - vec2(0.5, 0.56); vq.x *= uView.x/uView.y;',
    '  col *= 1.0 - 0.42*smoothstep(0.5, 1.3, length(vq));',
    '  col += (h21(gl_FragCoord.xy + fract(uTime)*91.0) - 0.5)/255.0;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var STAR_VS = [
    'attribute vec2 aPos; attribute vec4 aInfo; attribute vec3 aCol;',
    'uniform vec2 uView; uniform vec2 uPole; uniform float uAng; uniform float uDpr; uniform float uTime; uniform float uTw; uniform float uHorY;',
    'uniform vec3 uPtr; uniform vec4 uVeil; uniform float uFade;',
    'varying vec3 vCol; varying float vB; varying float vS;',
    'void main(){',
    '  float c = cos(uAng), s = sin(uAng);',
    '  vec2 p = uPole + vec2(c*aPos.x - s*aPos.y, s*aPos.x + c*aPos.y);',
    '  gl_Position = vec4(p.x/uView.x*2.0-1.0, 1.0-p.y/uView.y*2.0, 0.0, 1.0);',
    '  float low = smoothstep(uHorY - uView.y*0.32, uHorY, p.y);',
    '  float amp = aInfo.w*(1.0 + 2.4*low)*(0.7 + 1.4*uTw);',
    '  float tw = 1.0 + amp*(0.55*sin(uTime*(1.7+aInfo.z*3.1)+aInfo.z*40.0) + 0.45*sin(uTime*(3.3+aInfo.z*2.3)+aInfo.z*13.0));',
    '  vec2 dp = p - uPtr.xy; float near = uPtr.z*exp(-dot(dp,dp)/(2.0*90.0*90.0));',
    '  vec2 vv = (p - uVeil.xy)/uVeil.zw; float veil = 1.0 - 0.55*exp(-dot(vv,vv)*1.6);',
    '  vB = aInfo.y*max(tw, 0.15)*(1.0 - 0.62*low)*(1.0 + 1.3*near)*veil*uFade;',
    '  if(p.y > uHorY + 60.0) vB = 0.0;',
    '  vS = aInfo.x*uDpr*(1.0 + 0.25*near);',
    '  gl_PointSize = vS;',
    '  vCol = aCol;',
    '}'
  ].join('\n');
  var STAR_FS = [
    'precision mediump float;',
    'varying vec3 vCol; varying float vB; varying float vS;',
    'void main(){',
    '  vec2 d = (gl_PointCoord - 0.5)*vS; float r = length(d);',
    '  float core = exp(-r*r/(2.0*0.62*0.62));',
    '  float rn = r/(vS*0.5);',
    '  float glow = exp(-rn*6.5)*0.32;',
    '  float fade = 1.0 - smoothstep(0.7, 1.0, rn);',
    '  gl_FragColor = vec4((mix(vCol, vec3(1.0), 0.55)*core + vCol*glow)*vB*fade, 0.0);',
    '}'
  ].join('\n');

  /* =====================================================================
   * 2D 精灵（星芒 / 光晕）
   * ===================================================================== */
  function makeSprite(size, fn) { var c = document.createElement('canvas'); c.width = c.height = size; fn(c.getContext('2d'), size); return c; }
  function haloSprite(col) {
    return makeSprite(64, function (g, n) {
      var r = n / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.07, rgba(col, 0.55)); gr.addColorStop(0.22, rgba(col, 0.14));
      gr.addColorStop(0.5, rgba(col, 0.035)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    });
  }
  var SPR = null;
  function sprites() {
    if (SPR) return SPR;
    SPR = {};
    SPR.core = makeSprite(32, function (g, n) {
      var r = n / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.28, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    });
    SPR.cool = haloSprite([0.80, 0.87, 1.0]);
    SPR.warm = haloSprite([1.0, 0.88, 0.74]);
    // 衍射星芒：细十字，沿长度高斯衰减（克制）
    SPR.spike = makeSprite(160, function (g, n) {
      var r = n / 2;
      [[1, 0], [0, 1]].forEach(function (d) {
        var gr = d[0] ? g.createLinearGradient(0, r, n, r) : g.createLinearGradient(r, 0, r, n);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(235,240,255,0.10)'); gr.addColorStop(0.46, 'rgba(245,248,255,0.55)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.54, 'rgba(245,248,255,0.55)'); gr.addColorStop(0.7, 'rgba(235,240,255,0.10)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        if (d[0]) g.fillRect(0, r - 0.8, n, 1.6); else g.fillRect(r - 0.8, 0, 1.6, n);
      });
    });
    return SPR;
  }

  /* =====================================================================
   * 效果实例
   * ===================================================================== */
  function create(host) {
    var el = host.el;
    el.style.background = '#03050a';
    var cvGL = NBFX.canvas(host, 'sc-gl');
    var cv2 = NBFX.canvas(host, 'sc-lyr');
    var cvR = NBFX.canvas(host, 'sc-ridge', { css: 'pointer-events:none' });
    var ctx = cv2.getContext('2d'), rctx = cvR.getContext('2d');
    var W = host.width || window.innerWidth, H = host.height || window.innerHeight, DPR = Math.min(host.dpr || 1, 1.5);
    var GLS = 1;
    var spr = sprites();
    var tintSpr = null, tintKey = '';
    var destroyed = false;

    /* ---------- 状态 ---------- */
    var geo = {};
    var skyT = 0, skyAng = 0, now = 0;
    var pal = { tint: [0.62, 0.72, 0.95], sec: [0.5, 0.7, 0.9] }, palInit = false;
    var au = { bass: 0, tw: 0 };
    var live = null, leaving = [], meteors = [];
    var lastMeteor = -20, nextSporadic = 14 + Math.random() * 12;
    var ptr = { x: -9999, y: -9999, on: 0, target: 0 };
    var heldAmt = 0, frameAcc = 0;
    var prewarmQ = [];

    /* ---------- GL ---------- */
    var gl = null, P = {}, mw = null, mwPend = null, mwJobs = [], mwOn = 0, starBuf = null, intTex = null, blankTex = null, glLost = false;
    var intData = new Uint8Array(128 * 4);
    function initGL() {
      gl = NBFX.gl.create(cvGL, { alpha: false, premultipliedAlpha: false });
      if (!gl) return;
      try {
        P.mw = NBFX.gl.program(gl, null, MW_FS);
        P.comp = NBFX.gl.program(gl, null, COMP_FS);
        P.star = NBFX.gl.program(gl, STAR_VS, STAR_FS);
        P.star.aInfo = gl.getAttribLocation(P.star.p, 'aInfo');
        P.star.aCol = gl.getAttribLocation(P.star.p, 'aCol');
      } catch (e) { console.error('[star-constellation]', e); gl = null; return; }
      intTex = NBFX.gl.texture(gl, null, { nearest: true });
      gl.bindTexture(gl.TEXTURE_2D, intTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, intData);
      blankTex = NBFX.gl.texture(gl, null, {});
      mw = null; mwPend = null; mwJobs = []; mwOn = 0; starBuf = null;
    }
    function onLost(e) { e.preventDefault(); glLost = true; }
    function onRestored() { glLost = false; initGL(); planBake(); buildStars(); if (live) live.glowTex = null; leaving.forEach(function (l) { l.glowTex = null; }); }
    cvGL.addEventListener('webglcontextlost', onLost, false);
    cvGL.addEventListener('webglcontextrestored', onRestored, false);
    initGL();

    /* ---------- 几何 ---------- */
    function computeGeo() {
      var g = {};
      g.pole = [Math.max(120, W * 0.125), H * 0.125];
      g.cx = W * 0.5; g.cy = H * 0.42;
      // [二改] 歌词大小（NBFX.lyricScale）：字号 × s；调小时框也缩，调大时放宽高度（长句折行变大）
      var us = NBFX.lyricScale ? NBFX.lyricScale() : 1, box = Math.min(1, us);
      g.maxW = Math.min(W * 0.74, H * 1.75) * box; g.maxH = Math.min(H * 0.45 * us, H * 0.6);
      g.size = clamp(H * 0.135, 40, 210) * us; g.minSize = Math.max(14, Math.max(20, H * 0.048) * us);
      g.horY = H * 0.80;
      // 星图尺度：北纬 40°（北京）面朝正北，天极高度 40°，正下方地平线处赤纬 +50°
      g.S = (g.horY - g.pole[1]) / (2 * Math.tan((90 - LAT) / 2 * DEG));
      var far = 0;
      [[0, 0], [W, 0], [0, H], [W, H]].forEach(function (c) { far = Math.max(far, Math.hypot(c[0] - g.pole[0], c[1] - g.pole[1])); });
      g.R = far + 60;
      geo = g;
    }
    function planBake() {
      if (!gl) return;
      var maxT = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096, 4096);
      var T = Math.max(256, Math.min(maxT, Math.round(geo.R * 2 * 0.5)));
      if (mwPend) { gl.deleteTexture(mwPend.tgt.tex); gl.deleteFramebuffer(mwPend.tgt.fb); }
      mwPend = { tgt: NBFX.gl.target(gl, T, T), R: geo.R, H: H };
      var n = Math.max(6, Math.ceil(T * T / 4.5e5));
      mwJobs = [];
      for (var i = 0; i < n; i++) mwJobs.push([Math.floor(T * i / n), Math.floor(T * (i + 1) / n)]);
    }
    function runBake() {
      if (!gl || !mwPend || !mwJobs.length) return;
      var jb = mwJobs.shift(), t = mwPend.tgt;
      NBFX.gl.bindTarget(gl, t);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(0, jb[0], t.w, jb[1] - jb[0]);
      NBFX.gl.use(P.mw, { uR: mwPend.R, uH: mwPend.H, uBandP: [-0.26, 0.27], uBandDir: [0.947, -0.321], uBandW: 0.125, uCoreAlong: 0.75, uMW: 0.46, uSeed: 2.7 });
      NBFX.gl.drawQuad(gl);
      gl.disable(gl.SCISSOR_TEST);
      NBFX.gl.bindTarget(gl, null, cvGL.width, cvGL.height);
      if (!mwJobs.length) {
        if (mw) { gl.deleteTexture(mw.tgt.tex); gl.deleteFramebuffer(mw.tgt.fb); }
        mw = mwPend; mwPend = null;
      }
    }
    function buildStars() {
      if (!gl) return;
      var r = M.rng(0x51a7c0), R = geo.R, list = [];
      var n = clamp(Math.round(Math.PI * R * R / (1600 * 900) * 1250), 1400, 5200);
      var bd = [0.947, -0.321], bp = [-0.26 * H, 0.27 * H], perp = [0.321, 0.947];
      for (var i = 0; i < n; i++) {
        var x, y;
        if (r() < 0.26) { var al = (r() * 2 - 1) * R, ac = ((r() + r() + r()) / 3 - 0.5) * 0.30 * H; x = bp[0] + bd[0] * al + perp[0] * ac; y = bp[1] + bd[1] * al + perp[1] * ac; }
        else { var a = r() * TAU, rr = R * Math.sqrt(r()); x = Math.cos(a) * rr; y = Math.sin(a) * rr; }
        var m = Math.pow(r(), 7.0);
        var tc = r(); tc = tc < 0.18 ? tc * 1.2 : tc < 0.8 ? 0.35 + (tc - 0.18) * 0.35 : 0.6 + (tc - 0.8) * 2;
        list.push([x, y, 4.5 + m * 15, 0.09 + m * 1.35, r(), 0.05 + 0.09 * r()].concat(starColor(clamp(tc, 0, 1))));
      }
      // 勾陈一（北极星）：离天极 0.7°
      var pr = geo.S * 2 * Math.tan(0.35 * DEG);
      list.push([pr * 0.6, pr * 0.8, 17, 1.05, 0.37, 0.05].concat(starColor(0.42)));
      var pos = new Float32Array(list.length * 2), inf = new Float32Array(list.length * 4), col = new Float32Array(list.length * 3);
      list.forEach(function (s, k) { pos[k * 2] = s[0]; pos[k * 2 + 1] = s[1]; inf.set(s.slice(2, 6), k * 4); col.set(s.slice(6, 9), k * 3); });
      if (starBuf) { gl.deleteBuffer(starBuf.p); gl.deleteBuffer(starBuf.i); gl.deleteBuffer(starBuf.c); }
      starBuf = { p: gl.createBuffer(), i: gl.createBuffer(), c: gl.createBuffer(), n: list.length };
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuf.p); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuf.i); gl.bufferData(gl.ARRAY_BUFFER, inf, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuf.c); gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW);
    }

    /* ---------- 山脊树影（静态，一次画好） ---------- */
    var ridgeNear = null;
    function ridgeY(x, L) { var u = x / H; return H * (L.base + L.amp * (fbm1(u * L.sc, L.seed, 5) - 0.5) + L.amp * 0.4 * (Math.abs(fbm1(u * L.sc * 2.3, L.seed + 4, 4) - 0.5) * 2 - 0.4)); }
    function drawRidge() {
      cvR.width = Math.round(W * DPR); cvR.height = Math.round(H * DPR);
      var g = rctx; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
      var LAY = [
        { base: 0.792, amp: 0.040, sc: 1.5, seed: 9, top: [0.052, 0.060, 0.080], bot: [0.030, 0.034, 0.046] },
        { base: 0.812, amp: 0.050, sc: 1.2, seed: 1, top: [0.030, 0.034, 0.044], bot: [0.016, 0.018, 0.024] },
        { base: 0.846, amp: 0.036, sc: 2.0, seed: 5, top: [0.012, 0.013, 0.017], bot: [0.006, 0.007, 0.009], trees: true }
      ];
      LAY.forEach(function (L, li) {
        var step = 2, ys = [], mn = H;
        for (var x = -step; x <= W + step; x += step) { var y = ridgeY(x, L); ys.push([x, y]); if (y < mn) mn = y; }
        if (li === 2) ridgeNear = ys;
        g.beginPath(); g.moveTo(-10, H + 10);
        ys.forEach(function (p) { g.lineTo(p[0], p[1]); });
        g.lineTo(W + 10, H + 10); g.closePath();
        var gr = g.createLinearGradient(0, mn, 0, mn + H * 0.12);
        gr.addColorStop(0, rgba(L.top, 1)); gr.addColorStop(1, rgba(L.bot, 1));
        g.fillStyle = gr; g.fill();
        // 山脊上沿一丝天光
        g.strokeStyle = rgba(mix3(L.top, [0.3, 0.34, 0.4], 0.35), li === 0 ? 0.35 : 0.18); g.lineWidth = 0.6;
        g.beginPath(); ys.forEach(function (p, k) { if (k) g.lineTo(p[0], p[1] + 0.4); else g.moveTo(p[0], p[1] + 0.4); }); g.stroke();
        if (li === 1) { // 远处小镇的灯
          var rl = M.rng(77);
          for (var k = 0; k < 40; k++) {
            var lx = W * (0.62 + rl() * 0.34), ly = ridgeY(lx, L) + H * (0.006 + rl() * 0.02), a = 0.25 + rl() * 0.5;
            if (rl() < 0.5) continue;
            g.fillStyle = 'rgba(255,196,140,' + a.toFixed(2) + ')'; g.beginPath(); g.arc(lx, ly, 0.55 + rl() * 0.5, 0, TAU); g.fill();
          }
        }
        if (L.trees) {
          var cw = H * 0.0105, n = Math.ceil(W / cw) + 4;
          g.fillStyle = rgba(L.top, 1);
          for (var c = -2; c < n; c++) {
            var r1 = hash1(c * 3.17 + 11), r2 = hash1(c * 7.31 + 3), clus = smooth(0.42, 0.62, fbm1(c * 0.027, 21, 3));
            if (r1 > 0.78 * clus) continue;
            var cx = (c + 0.5 + (r2 - 0.5) * 0.7) * cw, ht = H * (0.014 + 0.028 * hash1(c * 1.93 + 5)), by = ridgeY(cx, L) + H * 0.004;
            var tiers = 5 + Math.floor(r2 * 3);
            g.beginPath(); g.moveTo(cx - cw * 0.08, by);
            for (var k2 = 0; k2 <= tiers; k2++) { var u = k2 / tiers, hw = cw * 0.6 * (1 - u) * (k2 % 2 ? 0.62 : 1); g.lineTo(cx - Math.max(hw, cw * 0.05), by - ht * u); }
            g.lineTo(cx, by - ht * 1.04);
            for (var k3 = tiers; k3 >= 0; k3--) { var u2 = k3 / tiers, hw2 = cw * 0.6 * (1 - u2) * (k3 % 2 ? 0.62 : 1); g.lineTo(cx + Math.max(hw2, cw * 0.05), by - ht * u2); }
            g.lineTo(cx + cw * 0.08, by); g.closePath(); g.fill();
          }
        }
      });
      // 近景颗粒
      var rn = M.rng(5);
      for (var i = 0; i < 900; i++) { var x2 = rn() * W, y2 = H * 0.84 + rn() * H * 0.16; g.fillStyle = 'rgba(255,255,255,' + (rn() * 0.018).toFixed(3) + ')'; g.fillRect(x2, y2, 1, 1); }
    }

    /* ---------- 歌词"星座" ---------- */
    function makeGlow(L) {
      // R = 宽柔光（星云）、B = 紧柔光、G = 字序号+1（加宽的格子），整张不透明，免得预乘损失
      var lay = L.lay, sc = 0.5, pad = lay.size * 0.62, k = lay.size;
      var cw = Math.max(4, Math.ceil((lay.boxWidth + pad * 2) * sc)), ch = Math.max(4, Math.ceil((lay.height + pad * 2) * sc));
      var c = document.createElement('canvas'); c.width = cw; c.height = ch;
      var g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
      g.setTransform(sc, 0, 0, sc, pad * sc, pad * sc);
      var gap = lay.spacing * k, lh = k * lay.lineHeight;
      // 格子铺满整张图（行首/行尾、首行上方、末行下方都往外延伸；空格沿用前一个字），免得柔光在格子边缘断开
      var ext = pad, nRows = lay.rows.length, prevI = 0;
      lay.rows.forEach(function (row, ri) {
        var y0 = row.y - (ri === 0 ? ext : 0), y1 = row.y + lh + (ri === nRows - 1 ? ext : 0);
        row.chars.forEach(function (cc, ci) {
          var id = cc.ch === ' ' ? prevI : cc.i; prevI = id;
          var x0 = ci === 0 ? -ext : cc.x - gap / 2 - 0.5, x1 = ci === row.chars.length - 1 ? lay.boxWidth + ext : cc.x + cc.w + gap / 2 + 0.5;
          g.fillStyle = 'rgb(0,' + Math.min(254, id + 1) + ',0)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
        });
      });
      g.globalCompositeOperation = 'lighter';
      g.font = NBFX.text.fontCss(k, 700, NBFX.fonts.sans);
      g.textBaseline = 'alphabetic';
      var hasFilter = typeof g.filter === 'string';
      [[0.20, 'rgb(255,0,0)', 2], [0.045, 'rgb(0,0,255)', 1]].forEach(function (b) {
        g.filter = hasFilter ? 'blur(' + (k * b[0] * sc).toFixed(1) + 'px)' : 'none';
        g.fillStyle = b[1];
        for (var rep = 0; rep < b[2]; rep++) lay.chars.forEach(function (cc) { if (cc.ch !== ' ') g.fillText(cc.ch, cc.x, cc.baseline); });
      });
      g.filter = 'none'; g.globalCompositeOperation = 'source-over';
      L.glowCanvas = c;
      L.glowBox = [L.ox - pad, L.oy - pad, cw / sc, ch / sc];
      L.glowTS = [cw, ch];
      L.glowTex = null;
    }
    function glowTex(L) {
      if (!gl || !L.glowCanvas) return null;
      if (!L.glowTex) { L.glowTex = NBFX.gl.texture(gl, L.glowCanvas, {}); }
      return L.glowTex;
    }
    function freeLine(L) { if (L.glowTex && gl) { try { gl.deleteTexture(L.glowTex); } catch (e) {} } L.glowTex = null; L.glowCanvas = null; }

    function makeLine(text, key, meta) {
      var latin = !CJK_RE.test(text);
      var disp = latin ? text.toUpperCase() : text;
      var isTitle = !!meta.title;
      var lay = NBFX.text.layout(disp, {
        maxWidth: isTitle ? geo.maxW * 0.8 : geo.maxW, maxHeight: isTitle ? geo.maxH * 0.62 : geo.maxH,
        size: isTitle ? geo.size * 1.12 : geo.size, minSize: geo.minSize, weight: SK_WEIGHT, family: NBFX.fonts.sans,
        spacing: latin ? 0.09 : 0.17, lineHeight: latin ? 1.3 : 1.36, maxLines: 3, align: 'center'
      });
      var ox = geo.cx - lay.boxWidth / 2, oy = (isTitle ? geo.cy - H * 0.03 : geo.cy) - lay.height / 2;
      var rr = M.rng(M.strHash(key + text) || 1);
      var L = { key: key, text: disp, lay: lay, ox: ox, oy: oy, size: lay.size, chars: [], stars: [], polys: [], born: now, title: isTitle,
        idx: meta.idx, total: meta.total, tr: meta.tr || '', artist: meta.artist || '', album: meta.album || '', latin: latin,
        minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
      lay.chars.forEach(function (c) {
        if (c.ch === ' ') return;
        var g = glyphSkeleton(c.ch), k = lay.size, gx = ox + c.x, gy = oy + c.baseline;
        var chr = { i: c.i, ch: c.ch, draw: 0, stars: [], polys: [], boost: 0 };
        var base = L.stars.length;
        g.stars.forEach(function (s) {
          var st = { x: gx + s.x * k, y: gy + s.y * k, t: s.t, th: s.th, ci: c.i, chr: chr, seed: rr(), lit: 0, fl: 0, flared: false, boost: 0,
            delay: 0.12 + rr() * 0.6, warm: rr() < 0.3 };
          L.stars.push(st); chr.stars.push(st);
          if (st.x < L.minX) L.minX = st.x; if (st.x > L.maxX) L.maxX = st.x; if (st.y < L.minY) L.minY = st.y; if (st.y > L.maxY) L.maxY = st.y;
        });
        g.polys.forEach(function (pl) {
          var pts = pl.idx.map(function (si) { return L.stars[base + si]; });
          chr.polys.push({ pts: pts, s: pl.s, e: pl.e, len: pl.len * k, cum: pl.cum.map(function (v) { return v * k; }) });
        });
        L.chars.push(chr);
      });
      if (!L.stars.length) { L.minX = geo.cx - 10; L.maxX = geo.cx + 10; L.minY = geo.cy - 10; L.maxY = geo.cy + 10; }
      makeGlow(L);
      return L;
    }
    function release(L) {
      if (!L || L.leaving) return;
      L.leaving = true; L.relT = now; L.relAng = skyAng;
      // 记下被替换那一刻的显现程度（快速连换时，没来得及出现的行不能在离开时闪一下）
      var age = now - L.born; L.relApp = smooth(0.15, 0.9, age); L.relLine = smooth(0.3, 1.15, age); L.relAge = age;
      leaving.push(L);
      // 只保留最近的一张星云纹理
      for (var i = 0; i < leaving.length - 1; i++) freeLine(leaving[i]);
      // 连续快速换行：更早的几行加速淡出
      var n = leaving.length;
      leaving.forEach(function (l, k) { if (k < n - 1 && !l.kill && now - l.relT < 2.5) l.kill = now; });
      if (leaving.length > 5) { var old = leaving.shift(); freeLine(old); }
    }
    function lineKey(ly, track) {
      if (ly.idx >= 0 && ly.line && String(ly.line.text || '').trim()) return 'L' + ly.idx + ':' + ly.line.text;
      return 'T:' + (ly.fallback || (track && track.title) || '');
    }
    function syncLine(f) {
      var ly = f.lyric, key = lineKey(ly, f.track);
      if (live && key === live.key) return;
      if (live) release(live);
      if (ly.idx >= 0 && ly.line && String(ly.line.text || '').trim()) {
        live = makeLine(String(ly.line.text), key, { idx: ly.idx, total: ly.lines.length, tr: ly.line.translation });
      } else {
        var title = ly.fallback || (f.track && f.track.title) || '';
        live = title ? makeLine(title, key, { title: true, artist: f.track && f.track.artist, album: f.track && f.track.album }) : null;
      }
      // 预热下一行的字形
      var nx = ly.next || (ly.idx < 0 && ly.lines && ly.lines[0]);
      if (nx && nx.text) { var tx = CJK_RE.test(nx.text) ? nx.text : String(nx.text).toUpperCase(); prewarmQ = tx.split('').filter(function (c) { return c !== ' ' && !skCache[c]; }); }
    }

    /* ---------- 流星 ---------- */
    function radiant() { return [-0.35 * W, -0.55 * H]; }
    function spawnMeteor(p, user) {
      var R = radiant(), dx = p[0] - R[0], dy = p[1] - R[1], dl = Math.hypot(dx, dy) || 1, dir = [dx / dl, dy / dl];
      var sc = H / 900, speed = (user ? 980 : 760 + Math.random() * 380) * sc;
      var back = user ? 0.2 * H : 0;
      meteors.push({ p0: [p[0] - dir[0] * back, p[1] - dir[1] * back], dir: dir, speed: speed, len: (user ? 210 : 110 + Math.random() * 140) * sc,
        life: user ? 0.95 : 0.45 + Math.random() * 0.45, bright: user ? 1.25 : 0.5 + Math.pow(Math.random(), 2) * 0.7, t: 0, seed: Math.random() * 100, prev: null });
      lastMeteor = now;
    }
    function menv(m) { var u = m.t / m.life; return Math.pow(Math.sin(Math.PI * Math.min(1, u)), 0.6) * (0.85 + 0.15 * Math.sin(m.t * 60 + m.seed)); }
    function lightByMeteor(a, b, stars, rot) {
      var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, rad = 30 * H / 900;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], x = s.x, y = s.y;
        if (rot) { var q = rot(x, y); x = q[0]; y = q[1]; }
        var t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), px = a[0] + dx * t - x, py = a[1] + dy * t - y;
        if (px * px + py * py < rad * rad) { s.boost = 1; if (s.chr) s.chr.boost = 1; }
      }
    }

    /* ---------- 旋转 ---------- */
    function rotFn(ang) {
      var c = Math.cos(ang), s = Math.sin(ang), px = geo.pole[0], py = geo.pole[1];
      return function (x, y) { var dx = x - px, dy = y - py; return [px + c * dx - s * dy, py + s * dx + c * dy]; };
    }
    function leaveAng(L) { var tau = now - L.relT; return (skyAng - L.relAng) - KICK * M.easeOutCubic(clamp(tau / 3.6, 0, 1)); }
    function raDec(x, y) {
      var dx = x - geo.pole[0], dy = y - geo.pole[1], c = Math.cos(-skyAng), s = Math.sin(-skyAng);
      var wx = c * dx - s * dy, wy = s * dx + c * dy, r = Math.hypot(wx, wy);
      var dec = 90 - 2 * Math.atan(r / (2 * geo.S)) / DEG;
      var ra = ((Math.atan2(wy, wx) / TAU * 24 + 30) % 24 + 24) % 24;
      return [ra, dec];
    }
    function fmtRA(h) { var hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return (hh < 10 ? '0' : '') + hh + 'h' + (mm < 10 ? '0' : '') + mm + 'm'; }
    function fmtDec(d) { var s = d < 0 ? '−' : '+', a = Math.abs(d), dd = Math.floor(a), mm = Math.floor((a - dd) * 60); return s + dd + '°' + (mm < 10 ? '0' : '') + mm + '′'; }

    /* ---------- 绘制：2D ---------- */
    function spacedText(g, text, x, y, sp, align) {
      var ws = [], tot = 0;
      for (var i = 0; i < text.length; i++) { var w = g.measureText(text[i]).width; ws.push(w); tot += w + (i < text.length - 1 ? sp : 0); }
      var cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
      for (var k = 0; k < text.length; k++) { g.fillText(text[k], cx, y); cx += ws[k] + sp; }
      return tot;
    }
    function drawGrid(g) {
      var p = geo.pole, S = geo.S, far = geo.R;
      g.save();
      g.lineWidth = 0.6; g.strokeStyle = rgba(IVORY, 0.05);
      g.beginPath();
      var decs = [80, 70, 60, 50, 40, 30];
      decs.forEach(function (d) { var r = S * 2 * Math.tan((90 - d) / 2 * DEG); if (r > far) return; g.moveTo(p[0] + r, p[1]); g.arc(p[0], p[1], r, 0, TAU); });
      for (var h = 0; h < 24; h += 2) { var a = (h / 24) * TAU - 30 / 24 * TAU + skyAng, ca = Math.cos(a), sa = Math.sin(a); g.moveTo(p[0] + ca * 40, p[1] + sa * 40); g.lineTo(p[0] + ca * far, p[1] + sa * far); }
      g.stroke();
      // 刻度标注（极淡）
      g.font = '500 ' + Math.round(clamp(H * 0.0125, 10, 14)) + 'px ' + NBFX.fonts.mono;
      g.fillStyle = rgba(GOLD, 0.30); g.textBaseline = 'middle';
      var la = 118 * DEG;
      decs.forEach(function (d) { var r = S * 2 * Math.tan((90 - d) / 2 * DEG), x = p[0] + Math.cos(la) * r, y = p[1] + Math.sin(la) * r; if (x < 70 || x > W - 40 || y < 20 || y > geo.horY - 30) return; g.fillText('+' + d + '°', x + 5, y); });
      var r60 = S * 2 * Math.tan(15 * DEG);
      for (var h2 = 0; h2 < 24; h2 += 2) {
        var a2 = (h2 / 24) * TAU - 30 / 24 * TAU + skyAng, x2 = p[0] + Math.cos(a2) * r60, y2 = p[1] + Math.sin(a2) * r60;
        if (x2 < 70 || x2 > W - 40 || y2 < 18 || y2 > geo.horY - 30 || (x2 > W - 320 && y2 < 130)) continue;
        if (live && x2 > live.minX - 40 && x2 < live.maxX + 40 && y2 > live.minY - 40 && y2 < live.maxY + 40) continue;
        g.fillText((h2 < 10 ? '0' : '') + h2 + 'h', x2 + 4, y2 - 7);
      }
      // 北天极
      g.strokeStyle = rgba(IVORY, 0.28); g.lineWidth = 0.7;
      g.beginPath(); g.arc(p[0], p[1], 5.5, 0, TAU);
      g.moveTo(p[0] - 13, p[1]); g.lineTo(p[0] - 8, p[1]); g.moveTo(p[0] + 8, p[1]); g.lineTo(p[0] + 13, p[1]);
      g.moveTo(p[0], p[1] - 13); g.lineTo(p[0], p[1] - 8); g.moveTo(p[0], p[1] + 8); g.lineTo(p[0], p[1] + 13);
      g.stroke();
      g.fillStyle = rgba(GOLD, 0.5); g.textBaseline = 'alphabetic';
      g.fillText('NCP', p[0] + 18, p[1] - 6);
      g.fillStyle = rgba(IVORY, 0.26);
      g.font = '400 ' + Math.round(clamp(H * 0.012, 10, 13)) + 'px ' + NBFX.fonts.serif;
      spacedText(g, '北天极 · 勾陈一', p[0] + 18, p[1] + 12, 2, 'left');
      g.restore();
    }
    function starSprite(g, img, x, y, r, a) { if (a < 0.004 || r < 0.2) return; g.globalAlpha = a; g.drawImage(img, x - r, y - r, r * 2, r * 2); }
    function lineColor(a) { return rgba(mix3(IVORY, pal.sec, 0.16), a); }
    // 画一行：lineA = 连线整体透明度，starF(s) → 星的亮度参数
    function drawConstellation(g, L, o) {
      var rot = o.rot, k = L.size, sc = k / 120;
      var undrawn = new Path2D(), drawn = new Path2D(), tips = [];
      L.chars.forEach(function (c) {
        c.polys.forEach(function (pl) {
          var loc = o.full ? 1 : clamp((c.draw - pl.s) / Math.max(1e-3, pl.e - pl.s), 0, 1), cut = loc * pl.len;
          var pts = pl.pts, n = pts.length;
          var P0 = rot ? rot(pts[0].x, pts[0].y) : [pts[0].x, pts[0].y];
          var inDrawn = cut > 0;
          if (inDrawn) drawn.moveTo(P0[0], P0[1]); else undrawn.moveTo(P0[0], P0[1]);
          for (var j = 1; j < n; j++) {
            var P1 = rot ? rot(pts[j].x, pts[j].y) : [pts[j].x, pts[j].y];
            var c0 = pl.cum[j - 1], c1 = pl.cum[j];
            if (cut >= c1) drawn.lineTo(P1[0], P1[1]);
            else if (cut <= c0) { if (inDrawn) { undrawn.moveTo(P0[0], P0[1]); inDrawn = false; } undrawn.lineTo(P1[0], P1[1]); }
            else {
              var u = (cut - c0) / Math.max(1e-6, c1 - c0), mx = P0[0] + (P1[0] - P0[0]) * u, my = P0[1] + (P1[1] - P0[1]) * u;
              drawn.lineTo(mx, my); undrawn.moveTo(mx, my); undrawn.lineTo(P1[0], P1[1]); inDrawn = false;
              if (loc < 1) tips.push([mx, my]);
            }
            P0 = P1;
          }
        });
      });
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (o.undrawnA > 0.003) { g.globalAlpha = 1; g.strokeStyle = lineColor(o.undrawnA); g.lineWidth = Math.max(0.8, 1.0 * sc); g.stroke(undrawn); }
      if (o.drawnA > 0.003) {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = rgba(mix3(pal.tint, IVORY, 0.35), o.drawnA * 0.10); g.lineWidth = Math.max(2.5, 4.2 * sc); g.stroke(drawn);
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = lineColor(o.drawnA); g.lineWidth = Math.max(1.0, 1.35 * sc); g.stroke(drawn);
      }
      // 星
      g.globalCompositeOperation = 'lighter';
      var tint = tintSpr || spr.cool;
      for (var i = 0; i < L.stars.length; i++) {
        var s = L.stars[i], q = rot ? rot(s.x, s.y) : [s.x, s.y], f = o.starF(s);
        if (f.a < 0.004) continue;
        var tf = s.t === 2 ? 1 : s.t === 1 ? 0.8 : 0.55;
        // 暗星（未唱）
        var dimA = f.dim * (0.30 + 0.25 * tf);
        starSprite(g, spr.core, q[0], q[1], Math.max(1.4, 2.2 * sc), dimA * f.a);
        if (s.boost > 0.02) { // 流星掠过：星亮一下
          starSprite(g, tint, q[0], q[1], k * 0.16 * (0.6 + 0.4 * s.boost), s.boost * f.a * 0.8);
          starSprite(g, spr.core, q[0], q[1], Math.max(1.8, 2.6 * sc), s.boost * f.a);
          if (tf > 0.6) starSprite(g, spr.spike, q[0], q[1], k * 0.2 * (0.6 + 0.4 * s.boost), s.boost * f.a * 0.5);
        }
        if (f.lit > 0.01) {
          var tw = 1 + f.tw * (0.55 * Math.sin(now * (1.3 + s.seed * 2.4) + s.seed * 40) + 0.45 * Math.sin(now * (2.9 + s.seed * 1.7) + s.seed * 11));
          var la = f.lit * f.a * tw;
          starSprite(g, s.warm ? spr.warm : tint, q[0], q[1], k * (0.06 + 0.07 * tf * tf) * (1 + 0.5 * s.boost), la * (0.5 + 0.35 * tf));
          starSprite(g, spr.core, q[0], q[1], Math.max(1.6, (1.9 + 1.5 * tf) * sc), la);
          if (s.fl > 0.02 && tf > 0.6) starSprite(g, spr.spike, q[0], q[1], k * (0.16 + 0.07 * tf) * (0.55 + 0.45 * s.fl), s.fl * f.a * 0.55);
        }
      }
      // 笔尖
      for (var t = 0; t < tips.length; t++) { starSprite(g, tint, tips[t][0], tips[t][1], k * 0.09, 0.9 * o.drawnA); starSprite(g, spr.core, tips[t][0], tips[t][1], 2.2 * Math.max(1, sc), o.drawnA); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    function drawLive(g, L, ly, track) {
      var age = now - L.born;
      var appear = smooth(0.15, 0.9, age), lineAppear = smooth(0.3, 1.15, age);
      var hold = 1 - 0.28 * heldAmt;
      drawConstellation(g, L, {
        rot: null, full: false,
        undrawnA: 0.23 * lineAppear, drawnA: 0.66 * hold * appear,
        starF: function (s) {
          var a = smooth(s.delay, s.delay + 0.45, age);
          return { a: a, dim: 1, lit: s.lit * hold, tw: 0.07 + 0.2 * au.tw };
        }
      });
      drawNotes(g, L, 1, null, ly, track);
    }
    function drawLeaving(g, L) {
      var tau = now - L.relT, ang = leaveAng(L), rot = rotFn(ang);
      var kill = L.kill ? clamp(1 - (now - L.kill) / 0.45, 0, 1) : 1;
      var lineA = Math.pow(1 - smooth(0.0, 0.75, tau), 1.6) * kill;
      var toSky = smooth(0.0, 0.9, tau), gone = 1 - smooth(13, 21, tau);
      g.save();
      drawConstellation(g, L, {
        rot: rot, full: false, undrawnA: 0.23 * L.relLine * lineA, drawnA: 0.62 * L.relApp * lineA,
        starF: function (s) {
          var app = smooth(s.delay, s.delay + 0.45, L.relAge);
          // 融进星空：拐点星很快隐去，端点/交叉点留下约一半，亮度随机成普通的星
          var keep = s.t === 0 ? 0 : s.seed < 0.5 ? 1 : 0;
          var lvl = keep * (s.t === 2 ? 0.26 : 0.19) * (0.45 + 1.1 * s.seed);
          return { a: gone * (L.kill ? Math.max(kill, 0.55) : 1), dim: (1 - toSky) * app, lit: M.lerp(Math.max(s.lit * app, L.title ? app : 0), lvl, toSky), tw: 0.08 + 0.18 * au.tw + 0.1 * toSky };
        }
      });
      g.restore();
      var na = (1 - smooth(0, 0.7, tau)) * kill;
      if (na > 0.01) {
        g.save();
        var p = geo.pole; g.translate(p[0], p[1]); g.rotate(ang); g.translate(-p[0], -p[1]);
        drawNotes(g, L, na, true);
        g.restore();
      }
    }
    // 星表注记：行号/赤经赤纬、翻译、标题态的歌手
    function drawNotes(g, L, a, frozen, ly, track) {
      var age = now - L.born, noteA = a * smooth(0.5, 1.5, age);
      if (noteA < 0.01) return;
      var fs = Math.round(clamp(H * 0.014, 11, 17)), mono = NBFX.fonts.mono;
      var x0 = L.minX, y0 = L.minY - H * 0.045;
      g.save();
      g.textBaseline = 'alphabetic';
      if (!L.title) {
        if (!frozen) { var rd = raDec((L.minX + L.maxX) / 2, (L.minY + L.maxY) / 2); L.note = 'LYR ' + (L.idx + 1 < 10 ? '0' : '') + (L.idx + 1) + ' / ' + L.total + '   α ' + fmtRA(rd[0]) + '   δ ' + fmtDec(rd[1]); }
        g.font = '500 ' + fs + 'px ' + mono; g.fillStyle = rgba(GOLD, 0.58 * noteA);
        spacedText(g, L.note || '', x0 + 16, y0, fs * 0.12, 'left');
        g.strokeStyle = rgba(GOLD, 0.30 * noteA); g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(x0, y0 - fs * 0.35); g.lineTo(x0 + 10, y0 - fs * 0.35); g.stroke();
        // 间奏
        if (!frozen && heldAmt > 0.01) {
          g.fillStyle = rgba(IVORY, 0.42 * heldAmt * noteA);
          g.font = '400 ' + fs + 'px ' + mono;
          spacedText(g, '— INTERLUDE · 间奏 —', (L.minX + L.maxX) / 2, L.maxY + H * (L.tr ? 0.135 : 0.075), fs * 0.2, 'center');
        }
      }
      var ty = L.maxY + H * 0.07;
      if (L.tr) {
        var tfs = Math.round(clamp(H * 0.027, 14, 34));
        g.font = '400 ' + tfs + 'px ' + NBFX.fonts.serif; g.fillStyle = rgba(IVORY, 0.76 * noteA);
        var tw = spacedText(g, L.tr, (L.minX + L.maxX) / 2, ty, tfs * 0.16, 'center');
        var cx = (L.minX + L.maxX) / 2, yy = ty - tfs * 0.36;
        g.strokeStyle = rgba(GOLD, 0.34 * noteA); g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(cx - tw / 2 - 18, yy); g.lineTo(cx - tw / 2 - 58, yy); g.moveTo(cx + tw / 2 + 18, yy); g.lineTo(cx + tw / 2 + 58, yy); g.stroke();
        g.font = '500 ' + Math.round(fs * 0.85) + 'px ' + mono; g.fillStyle = rgba(GOLD, 0.40 * noteA);
        spacedText(g, 'TRANSL.', cx - tw / 2 - 58, yy - fs * 0.6, fs * 0.1, 'left');
      }
      if (L.title) {
        var afs = Math.round(clamp(H * 0.03, 15, 38));
        g.font = '400 ' + afs + 'px ' + NBFX.fonts.serif; g.fillStyle = rgba(IVORY, 0.8 * noteA);
        spacedText(g, L.artist || '', (L.minX + L.maxX) / 2, ty + afs * 0.2, afs * 0.5, 'center');
        g.font = '500 ' + fs + 'px ' + mono; g.fillStyle = rgba(GOLD, 0.5 * noteA);
        var sub = (L.album ? L.album + '  ·  ' : '') + (ly && ly.lines && ly.lines.length ? 'PRELUDE · 前奏' : 'INSTRUMENTAL · 纯音乐');
        spacedText(g, sub, (L.minX + L.maxX) / 2, ty + afs * 1.5, fs * 0.16, 'center');
        g.font = '500 ' + fs + 'px ' + mono; g.fillStyle = rgba(GOLD, 0.45 * noteA);
        spacedText(g, 'CAT. 00  ·  NOW PLAYING', x0 + 16, y0, fs * 0.12, 'left');
        g.strokeStyle = rgba(GOLD, 0.30 * noteA); g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(x0, y0 - fs * 0.35); g.lineTo(x0 + 10, y0 - fs * 0.35); g.stroke();
      }
      g.restore();
    }
    function drawMeteors(g) {
      if (!meteors.length) return;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      meteors.forEach(function (m) {
        var e = menv(m) * m.bright;
        var hd = [m.p0[0] + m.dir[0] * m.speed * m.t, m.p0[1] + m.dir[1] * m.speed * m.t];
        var tl = Math.min(m.len, m.speed * m.t), tail = [hd[0] - m.dir[0] * tl, hd[1] - m.dir[1] * tl];
        var gr = g.createLinearGradient(tail[0], tail[1], hd[0], hd[1]);
        gr.addColorStop(0, 'rgba(255,226,196,0)'); gr.addColorStop(0.7, 'rgba(255,226,196,' + (0.22 * e).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(232,240,255,' + Math.min(1, 0.9 * e).toFixed(3) + ')');
        g.strokeStyle = gr; g.lineWidth = 3.4; g.globalAlpha = 0.16; g.beginPath(); g.moveTo(tail[0], tail[1]); g.lineTo(hd[0], hd[1]); g.stroke();
        g.globalAlpha = 1; g.lineWidth = 1.1; g.beginPath(); g.moveTo(tail[0], tail[1]); g.lineTo(hd[0], hd[1]); g.stroke();
        starSprite(g, spr.cool, hd[0], hd[1], 9, Math.min(1, e));
      });
      g.globalAlpha = 1; g.restore();
    }

    /* ---------- GL 绘制 ---------- */
    function drawGL(f) {
      if (!gl || glLost) return;
      if (mwJobs.length) runBake();
      NBFX.gl.bindTarget(gl, null, cvGL.width, cvGL.height);
      gl.disable(gl.BLEND);
      var lg = live ? glowTex(live) : null;
      var lv = null; for (var i = leaving.length - 1; i >= 0; i--) { if (leaving[i].glowCanvas && !leaving[i].kill) { lv = leaving[i]; break; } }
      var lgTex = lv ? glowTex(lv) : null;
      var liveA = live ? smooth(0, 1.2, now - live.born) * (1 - 0.2 * heldAmt) : 0;
      var lvA = lv ? (1 - smooth(0, 0.9, now - lv.relT)) : 0;
      if (lg) { gl.bindTexture(gl.TEXTURE_2D, intTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, intData); }
      NBFX.gl.use(P.comp, {
        uMW: { tex: mw ? mw.tgt.tex : blankTex, unit: 0 }, uMWR: mw ? mw.R : geo.R, uMWOn: mwOn,
        uView: [W, H], uPole: geo.pole, uAng: skyAng, uTime: now % 1000, uDpr: DPR * GLS,
        uHorY: geo.horY, uBass: au.bass, uTw: au.tw, uTint: pal.tint, uAir: mix3([0.036, 0.070, 0.054], pal.tint, 0.12),
        uGlow: { tex: lg || blankTex, unit: 1 }, uGB: live ? live.glowBox : [0, 0, 1, 1], uGT: live ? live.glowTS : [1, 1], uInt: { tex: intTex, unit: 2 }, uGA: lg ? liveA : 0,
        uGlow2: { tex: lgTex || blankTex, unit: 3 }, uGB2: lv ? lv.glowBox : [0, 0, 1, 1], uGA2: lgTex ? lvA : 0, uGR2: lv ? leaveAng(lv) : 0
      });
      NBFX.gl.drawQuad(gl);
      if (starBuf) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        var veil = live ? [(live.minX + live.maxX) / 2, (live.minY + live.maxY) / 2, Math.max(60, (live.maxX - live.minX) * 0.62), Math.max(50, (live.maxY - live.minY) * 0.75)] : [-9999, -9999, 1, 1];
        NBFX.gl.use(P.star, { uView: [W, H], uPole: geo.pole, uAng: skyAng, uDpr: DPR * GLS, uTime: now % 1000, uTw: au.tw, uHorY: geo.horY, uPtr: [ptr.x, ptr.y, ptr.on], uVeil: veil, uFade: 1 });
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuf.p); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuf.i); gl.enableVertexAttribArray(P.star.aInfo); gl.vertexAttribPointer(P.star.aInfo, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuf.c); gl.enableVertexAttribArray(P.star.aCol); gl.vertexAttribPointer(P.star.aCol, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, starBuf.n);
        gl.disableVertexAttribArray(P.star.aInfo); gl.disableVertexAttribArray(P.star.aCol);
        gl.disable(gl.BLEND);
      }
    }

    /* ---------- 每帧 ---------- */
    function frame(f) {
      if (destroyed) return;
      f = NBFX.lyric.lead(f, 0.55);   // 提前量：开唱前新行的暗星已经浮现
      var dt = clamp(f.dt || 0.016, 0, 0.1);
      now = f.t;
      // 暂停时降到 30fps，天空仍在慢慢转、星仍在闪
      frameAcc += dt;
      if (!f.playing && frameAcc < 1 / 31) return;
      var fdt = frameAcc; frameAcc = 0;
      // 调色板（平滑过渡）
      var p = f.palette;
      if (p) {
        var tgtT = mix3(mix3(p.accentRgb, p.secondaryRgb, 0.5), [0.7, 0.78, 0.95], 0.35), tgtS = p.secondaryRgb;
        var tl = 0.2126 * tgtT[0] + 0.7152 * tgtT[1] + 0.0722 * tgtT[2]; tgtT = tgtT.map(function (v) { return v * 0.62 / Math.max(0.2, tl); });
        if (!palInit) { pal.tint = tgtT.slice(); pal.sec = tgtS.slice(); palInit = true; }
        var kp = 1 - Math.exp(-fdt * 2.2);
        pal.tint = mix3(pal.tint, tgtT, kp); pal.sec = mix3(pal.sec, tgtS, kp);
        var key = pal.tint.map(function (v) { return Math.round(v * 24); }).join(',');
        if (key !== tintKey) { tintKey = key; tintSpr = haloSprite(mix3(pal.tint, [1, 1, 1], 0.45)); }
      }
      // 音乐
      var A = f.audio || {}, play = f.playing ? 1 : 0;
      au.bass = M.damp(au.bass, (A.bass || 0) * play, 5, fdt);
      au.tw = M.damp(au.tw, clamp(((A.treble || 0) - 0.06) * 2.2, 0, 1) * play, 4, fdt);
      var tro = 0; if (A.onset) { for (var b = 40; b < 64; b++) tro += A.onset[b]; }
      // 天空
      skyT += fdt * (f.playing ? 1 : 0.5); skyAng = -skyT * SKY_RATE;
      if (mw && mwOn < 1) mwOn = Math.min(1, mwOn + fdt / 1.6);
      ptr.on = M.damp(ptr.on, ptr.target, 3, fdt);
      // 歌词
      syncLine(f);
      if (prewarmQ.length) { glyphSkeleton(prewarmQ.shift()); if (prewarmQ.length) glyphSkeleton(prewarmQ.shift()); }
      var ly = f.lyric;
      heldAmt = M.damp(heldAmt, live && !live.title && ly.held && ly.lineTime - (ly.line ? ly.line.duration : 0) > 1.0 ? 1 : 0, 2.5, fdt);
      if (live) {
        var age = now - live.born;
        for (var n = 0; n < intData.length; n++) intData[n] = 0;
        live.chars.forEach(function (c, ci) {
          var target = live.title ? clamp((age - 0.4 - ci * 0.32) / 0.9, 0, 1) : clamp(ly.charPos - c.i, 0, 1);
          if (!live.title && target < c.draw - 0.02) c.draw = target;
          else c.draw = Math.min(target, c.draw + fdt / 0.4);
          c.boost *= Math.exp(-fdt * 2.5);
          if (c.i < 128) { intData[c.i * 4] = Math.round(c.draw * 255); intData[c.i * 4 + 1] = Math.round(clamp(c.boost, 0, 1) * 255); }
        });
        live.stars.forEach(function (s) {
          var on = s.chr.draw >= s.th - 1e-4 ? 1 : 0;
          if (on && !s.flared) { s.flared = true; s.fl = 1; }
          if (!on && s.flared && s.chr.draw < 0.01) { s.flared = false; }
          s.lit = M.damp(s.lit, on, 12, fdt);
          s.fl *= Math.exp(-fdt * 2.0);
          s.boost *= Math.exp(-fdt * 1.6);
        });
      }
      leaving.forEach(function (L) { L.stars.forEach(function (s) { s.boost *= Math.exp(-fdt * 1.6); s.fl *= Math.exp(-fdt * 2.0); }); });
      leaving = leaving.filter(function (L) { var dead = now - L.relT > 21.5 || (L.kill && now - L.kill > 0.5); if (dead) freeLine(L); return !dead; });
      // 流星：高频起音偶尔一颗 + 零星的偶发流星
      if (f.playing) {
        nextSporadic -= fdt;
        if (tro > 0.5 && now - lastMeteor > 9 && Math.random() < 0.25) spawnMeteor([W * (0.3 + Math.random() * 0.6), H * (0.06 + Math.random() * 0.35)], false);
        if (nextSporadic <= 0) { spawnMeteor([W * (0.3 + Math.random() * 0.6), H * (0.05 + Math.random() * 0.4)], false); nextSporadic = 18 + Math.random() * 22; }
      }
      meteors.forEach(function (m) {
        m.t += fdt;
        var hd = [m.p0[0] + m.dir[0] * m.speed * m.t, m.p0[1] + m.dir[1] * m.speed * m.t];
        if (m.prev && menv(m) > 0.2) {
          if (live) lightByMeteor(m.prev, hd, live.stars, null);
          leaving.forEach(function (L) { lightByMeteor(m.prev, hd, L.stars, rotFn(leaveAng(L))); });
        }
        m.prev = hd;
      });
      meteors = meteors.filter(function (m) { return m.t < m.life; });
      // 画
      drawGL(f);
      var g = ctx;
      g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
      drawGrid(g);
      leaving.forEach(function (L) { drawLeaving(g, L); });
      if (live) drawLive(g, live, ly, f.track);
      drawMeteors(g);
    }

    function resize(w, h, dpr) {
      W = Math.max(2, w); H = Math.max(2, h); DPR = Math.min(dpr || 1, 1.5);
      GLS = W * H * DPR * DPR > 2.6e6 ? Math.sqrt(2.6e6 / (W * H * DPR * DPR)) : 1;   // 超大屏时 GL 层稍降分辨率
      cvGL.width = Math.round(W * DPR * GLS); cvGL.height = Math.round(H * DPR * GLS);
      cv2.width = Math.round(W * DPR); cv2.height = Math.round(H * DPR);
      computeGeo();
      drawRidge();
      if (gl) { planBake(); buildStars(); }
      // 行按新尺寸重建（保留描字进度）
      if (live) {
        var old = live; freeLine(old);
        var nl = makeLine(old.title ? old.text : old.text, old.key, { idx: old.idx, total: old.total, tr: old.tr, title: old.title, artist: old.artist, album: old.album });
        nl.born = old.born; nl.chars.forEach(function (c, i) { if (old.chars[i]) c.draw = old.chars[i].draw; });
        nl.stars.forEach(function (s) { s.lit = s.chr.draw >= s.th ? 1 : 0; s.flared = s.lit > 0; });
        live = nl;
      }
      leaving.forEach(freeLine); leaving = [];
    }
    function pointer(type, x, y) {
      if (type === 'move') { ptr.x = x; ptr.y = y; ptr.target = 1; }
      if (type === 'down') { ptr.x = x; ptr.y = y; spawnMeteor([x, y], true); }
    }
    function onFonts() { skCache = {}; }
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onFonts);
    function destroy() {
      destroyed = true;
      if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', onFonts);
      cvGL.removeEventListener('webglcontextlost', onLost); cvGL.removeEventListener('webglcontextrestored', onRestored);
      if (live) freeLine(live); leaving.forEach(freeLine);
      live = null; leaving = []; meteors = [];
      if (gl) NBFX.gl.destroy(gl);
      gl = null;
      [cvGL, cv2, cvR].forEach(function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.width = c.height = 1; });
    }
    resize(W, H, DPR);
    return { resize: resize, frame: frame, pointer: pointer, destroy: destroy };
  }

  NBFX.register({
    id: 'star-constellation', theme: 'star',
    name: '连星成词', en: 'CONSTELLATION',
    desc: '唱到的字连成星座',
    hint: '点一下夜空，放一颗流星划过歌词',
    icon: '<path d="M4 6.5 9 5l1.5 5.5L6 14M10.5 10.5 16 9l3 4.5M16 9l1-4M6 14l2.5 5 7-1.5"/><circle cx="4" cy="6.5" r=".9"/><circle cx="10.5" cy="10.5" r="1.1"/><circle cx="16" cy="9" r="1.1"/><circle cx="8.5" cy="19" r=".9"/>',
    create: create
  });
})();
} catch (nbLyricFxLoadErr) { try { console.error("[平面歌词] 载入失败：星图 · 连星成词 (star-constellation)", nbLyricFxLoadErr); } catch (_e) { } }

/* ------------------------------------------------------------
 * 孔版 · 网点 (riso-halftone)
 * ------------------------------------------------------------ */
try {
/* ============================================================
 * 孔版 RISO · B. 网点 HALFTONE
 * 整个画面是一张两色网点印刷品：封面按两种真实 Riso 油墨分色（15° / 75° 两个网角，
 * 叠出玫瑰斑），歌词由网点“长”出来——未唱是细网点，唱到的字网点胀大连成实心；
 * 换行时实心字散回网点、退成底色，新一行从网点里一颗颗冒出来。
 * 音乐：一道频谱波从左往右拂过网点，低音让整张图的网点轻轻呼吸（字保持稳定）。
 * 交互：按住画面出现一枚“数纱镜”，放大看网点和纸纤维。
 * 渲染：单个全屏片元着色器；文字只在换行时画进 canvas 当纹理。
 * ============================================================ */
(function () {
  'use strict';
  var M = NBFX.math, CL = NBFX.color;

  var INK = {
    'FLUO PINK': '#ff48b0', 'MEDIUM BLUE': '#3255a4', 'FEDERAL BLUE': '#3d5588', 'ORANGE': '#ff6c2f',
    'HUNTER GREEN': '#407060', 'TEAL': '#00838a', 'PURPLE': '#765ba7', 'BRIGHT RED': '#f15060',
    'BLACK': '#2a2727', 'BURGUNDY': '#914e72', 'FLUO ORANGE': '#ff7477', 'SUNFLOWER': '#ffb511'
  };
  // a = 画面主色版（15°）  b = 字 / 暗部版（75°）
  var SETS = [
    { h: 215, a: 'FLUO PINK', b: 'MEDIUM BLUE' },
    { h: 14, a: 'ORANGE', b: 'FEDERAL BLUE' },
    { h: 150, a: 'FLUO PINK', b: 'HUNTER GREEN' },
    { h: 278, a: 'FLUO PINK', b: 'PURPLE' },
    { h: 48, a: 'SUNFLOWER', b: 'TEAL' },
    { h: 185, a: 'FLUO ORANGE', b: 'TEAL' },
    { h: 330, a: 'FLUO PINK', b: 'BURGUNDY' }
  ];
  var MONO = { a: 'BRIGHT RED', b: 'BLACK' };
  function pickSet(pal) {
    var hs = CL.rgb2hsl(pal.accentRgb), hs2 = CL.rgb2hsl(pal.secondaryRgb);
    if (hs[1] < 0.16 && hs2[1] < 0.16) return MONO;
    var h = (hs[1] >= 0.16 ? hs[0] : hs2[0]) * 360, best = SETS[0], bd = 1e9;
    SETS.forEach(function (s) { var d = Math.abs(((h - s.h) % 360 + 540) % 360 - 180); if (d < bd) { bd = d; best = s; } });
    return best;
  }
  var CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;
  var wordSeg = null;
  try { if (typeof Intl !== 'undefined' && Intl.Segmenter) wordSeg = new Intl.Segmenter('zh', { granularity: 'word' }); } catch (e) { wordSeg = null; }
  function pad2(n) { n = Math.max(0, n | 0); return n < 10 ? '0' + n : '' + n; }

  /* ---------- 排版：1–3 行、左对齐，优先在空格 / 标点 / 词边界断行 ---------- */
  function layoutBlock(text, maxW, maxH, sMax) {
    text = String(text || '');
    var latin = !CJK.test(text);
    var disp = latin ? text.toUpperCase() : text;
    var fam = NBFX.fonts.sans, wt = 900;
    var sq = latin ? 0.86 : 1, ls = latin ? 0.01 : -0.02, lh = latin ? 1.0 : 1.1;
    var m = NBFX.text.measureChars(disp, 100, wt, fam, ls);
    var n = disp.length, ws = null;
    if (wordSeg && !latin) { ws = {}; try { var it = wordSeg.segment(disp)[Symbol.iterator](), r; while (!(r = it.next()).done) ws[r.value.index] = 1; } catch (e) { ws = null; } }
    var P = /[，,。.！!？?、；;：:]/, cands = [];
    for (var i = 1; i < n; i++) {
      var a = disp[i - 1], b = disp[i], q = 0;
      if (a === ' ' && b !== ' ') q = P.test(disp[i - 2] || '') ? 4 : latin ? 3 : 3.5;
      else if (b === ' ') q = 0;
      else if (P.test(a)) q = 4;
      else if (!latin && CJK.test(a) && CJK.test(b)) q = ws ? (ws[i] ? 2 : 1) : 1.5;
      if (q) cands.push({ i: i, q: q });
    }
    function rowOf(s0, e0) { while (s0 < e0 && disp[s0] === ' ') s0++; while (e0 > s0 && disp[e0 - 1] === ' ') e0--; return { s: s0, e: e0 }; }
    function rowW(r) { if (r.e <= r.s) return 0; var c0 = m.chars[r.s], c1 = m.chars[r.e - 1]; return (c1.x + c1.w - c0.x) * sq; }
    var best = null;
    function evalRows(bs) {
      var rows = [], s0 = 0, qual = 1;
      for (var k = 0; k <= bs.length; k++) {
        var e0 = k < bs.length ? bs[k].i : n;
        rows.push(rowOf(s0, e0)); s0 = e0;
        if (k < bs.length) qual *= bs[k].q >= 4 ? 1.3 : bs[k].q >= 3.5 ? 1.04 : bs[k].q >= 3 ? 1 : bs[k].q >= 2 ? 0.92 : bs[k].q >= 1.5 ? 0.86 : 0.74;
      }
      var nr = rows.length, size = Math.min(sMax, maxH / (nr * lh)), wmin = 1e9, wmax = 0, orphan = 1;
      for (k = 0; k < nr; k++) {
        var w = rowW(rows[k]) / 100; if (w <= 0) return;
        size = Math.min(size, maxW / w);
        wmin = Math.min(wmin, w); wmax = Math.max(wmax, w);
        if (nr > 1 && rows[k].e - rows[k].s <= 1) orphan *= 0.55;
        if (latin && nr > 1 && rows[k].e - rows[k].s <= 3) orphan *= 0.8;
      }
      var pref = nr === 2 && n >= 8 ? 1.04 : nr === 3 ? 0.96 : 1;
      var score = size * qual * orphan * pref * (0.86 + 0.14 * wmin / wmax);
      if (!best || score > best.score) best = { score: score, rows: rows, size: size };
    }
    evalRows([]);
    for (var x = 0; x < cands.length; x++) {
      evalRows([cands[x]]);
      for (var y = x + 1; y < cands.length; y++) evalRows([cands[x], cands[y]]);
    }
    var size = Math.floor(best.size), rows = best.rows, chars = [], width = 0;
    rows.forEach(function (r, k) {
      var base = m.chars[r.s] ? m.chars[r.s].x : 0;
      for (var i = r.s; i < r.e; i++) {
        var c = m.chars[i], cx = (c.x - base) * size / 100 * sq, cw = c.w * size / 100 * sq;
        chars.push({ ch: text[i], disp: disp[i], i: i, x: cx, w: cw, row: k, y: k * lh * size, baseline: k * lh * size + size * 0.88 });
        width = Math.max(width, cx + cw);
      }
    });
    return { size: size, lh: lh, sq: sq, family: fam, weight: wt, chars: chars, rows: rows.length, width: width, height: rows.length * lh * size };
  }

  /* 遮罩：R=字形  G=字序号+1（0 = 附属小字：翻译 / 歌手，按实心印）  B=字内横向 0→1 */
  function renderMask(cv, blk, sc) {
    var pad = blk.pad;
    cv.width = Math.max(2, Math.ceil((blk.w + pad * 2) * sc));
    cv.height = Math.max(2, Math.ceil((blk.h + pad * 2) * sc));
    var x = cv.getContext('2d'), lay = blk.lay;
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height);
    x.setTransform(sc, 0, 0, sc, pad * sc, pad * sc);
    var rowH = lay.lh * lay.size, gap = lay.size * 0.04;
    lay.chars.forEach(function (c) {
      var id = Math.min(254, c.i + 1), g = x.createLinearGradient(c.x, 0, c.x + c.w, 0);
      g.addColorStop(0, 'rgb(0,' + id + ',0)'); g.addColorStop(1, 'rgb(0,' + id + ',255)');
      x.fillStyle = g; x.fillRect(c.x - gap, c.y, c.w + gap * 2, rowH);
    });
    x.globalCompositeOperation = 'lighter'; x.fillStyle = '#f00'; x.textBaseline = 'alphabetic';
    x.font = lay.weight + ' ' + lay.size + 'px ' + lay.family;
    lay.chars.forEach(function (c) {
      if (c.ch === ' ') return;
      x.setTransform(sc * lay.sq, 0, 0, sc, (pad + c.x) * sc, (pad + c.baseline) * sc);
      x.fillText(c.disp, 0, 0);
    });
    x.setTransform(sc, 0, 0, sc, pad * sc, pad * sc);
    (blk.subs || []).forEach(function (s) {
      x.font = s.font; try { x.letterSpacing = s.ls || '0px'; } catch (e) {}
      x.fillText(s.text, s.x, s.y);
    });
    try { x.letterSpacing = '0px'; } catch (e) {}
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over';
    return cv;
  }

  /* ---------- 纸：R=纤维亮度  G=平滑斑驳（兼作噪声）  B=细颗粒 ---------- */
  function tileNoise(size, cells, rnd) {
    var n = cells, g = new Float32Array(n * n), out = new Float32Array(size * size);
    for (var i = 0; i < n * n; i++) g[i] = rnd();
    for (var y = 0; y < size; y++) {
      var gy = y / size * n, iy = gy | 0, fy = gy - iy; fy = fy * fy * (3 - 2 * fy);
      var r0 = (iy % n) * n, r1 = ((iy + 1) % n) * n;
      for (var x = 0; x < size; x++) {
        var gx = x / size * n, ix = gx | 0, fx = gx - ix; fx = fx * fx * (3 - 2 * fx);
        var x0 = ix % n, x1 = (ix + 1) % n;
        var a = g[r0 + x0] + (g[r0 + x1] - g[r0 + x0]) * fx, b = g[r1 + x0] + (g[r1 + x1] - g[r1 + x0]) * fx;
        out[y * size + x] = a + (b - a) * fy;
      }
    }
    return out;
  }
  // 纸纹理只生成一次，整个会话复用（切换效果时不再卡顿）
  var PAPER = null;
  function paperCanvas() { if (!PAPER) PAPER = makePaper(1024, 90210); return PAPER; }
  function makePaper(size, seed) {
    var rnd = M.rng(seed), cv = document.createElement('canvas'); cv.width = cv.height = size;
    var fc = document.createElement('canvas'); fc.width = fc.height = size;
    var fx = fc.getContext('2d');
    fx.fillStyle = 'rgb(128,128,128)'; fx.fillRect(0, 0, size, size); fx.lineCap = 'round';
    for (var i = 0; i < 1900; i++) {
      var x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI, len = 6 + Math.pow(rnd(), 2) * 50, bend = (rnd() - 0.5) * 0.9;
      var light = rnd() < 0.7, v = light ? 150 + rnd() * 45 : 84 + rnd() * 28;
      fx.strokeStyle = 'rgba(' + (v | 0) + ',' + (v | 0) + ',' + (v | 0) + ',' + (0.25 + rnd() * 0.45).toFixed(2) + ')';
      fx.lineWidth = 0.6 + rnd() * 1.2;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var px = x + ox * size, py = y + oy * size;
        if (px < -60 || px > size + 60 || py < -60 || py > size + 60) continue;
        fx.beginPath(); fx.moveTo(px, py);
        fx.quadraticCurveTo(px + Math.cos(a + bend) * len * 0.5, py + Math.sin(a + bend) * len * 0.5, px + Math.cos(a) * len, py + Math.sin(a) * len);
        fx.stroke();
      }
    }
    for (i = 0; i < 300; i++) { var v2 = 60 + rnd() * 50; fx.fillStyle = 'rgba(' + (v2 | 0) + ',' + (v2 | 0) + ',' + (v2 | 0) + ',' + (0.3 + rnd() * 0.5).toFixed(2) + ')'; fx.beginPath(); fx.arc(rnd() * size, rnd() * size, 0.5 + rnd() * 1.3, 0, 7); fx.fill(); }
    var fd = fx.getImageData(0, 0, size, size).data;
    var mA = tileNoise(size, 10, rnd), gA = tileNoise(size, 40, rnd), gB = tileNoise(size, 128, rnd);
    var ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
    for (var k = 0; k < size * size; k++) {
      d[k * 4] = M.clamp(128 + (fd[k * 4] / 255 - 0.5) * 300 + (mA[k] - 0.5) * 24, 0, 255);
      d[k * 4 + 1] = M.clamp((gA[k] * 0.6 + gB[k] * 0.4) * 255, 0, 255);
      d[k * 4 + 2] = rnd() * 255;
      d[k * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* ---------- 着色器 ---------- */
  var FS = [
    'precision highp float;',
    'uniform vec2 uRes, uCss; uniform float uSc, uT, uBass, uCell, uSweep, uSweepW, uInter;',
    'uniform sampler2D uPaper, uCover, uBins, uDeco, uHalo, uM0, uM1, uM2;',
    'uniform vec3 uPaperCol, uInkA, uInkB;',
    'uniform vec4 uR0, uR1, uR2, uS0, uS1, uS2, uCov, uLoupe, uWedge;',
    'uniform vec2 uOA, uOB;',
    'uniform vec3 uLev;',
    'float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }',
    'bool inb(vec2 u){ return u.x > 0.0 && u.y > 0.0 && u.x < 1.0 && u.y < 1.0; }',
    'mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }',
    // 调幅网点：给定网角 / 网线，返回网点场 f（1=网点中心）与抗锯齿宽度
    'vec2 spot(vec2 q, float ang, float cell, float zs, out vec2 cid){',
    '  vec2 r = rot(ang)*q/cell;',
    '  cid = floor(r + 0.5);',
    '  vec2 cs = cos(6.28318*r), sn = sin(6.28318*r);',
    '  return vec2(0.5 + 0.25*(cs.x + cs.y), 1.5708*length(sn)/(cell*uSc*zs) + 0.02);',
    '}',
    'float dotInk(vec2 f, float tone, float rough){',
    '  float th = 1.0 - tone + rough;',
    '  return smoothstep(th - f.y, th + f.y, f.x)*step(0.012, tone);',
    '}',
    // 一行歌词的网点色调（蓝版）：未唱细网点 → 唱到胀大成实心；换行时散开 / 生长
    'float lyricTone(sampler2D Mk, vec4 R, vec4 S, vec2 p, vec2 cid, float hc){',
    '  if (S.w < 0.5) return 0.0;',
    '  vec2 u = (p - vec2(0.0, S.z*S.z*uCell*1.6) - R.xy)/R.zw;',
    '  if (!inb(u)) return 0.0;',
    '  vec4 m = texture2D(Mk, u);',
    '  float g = smoothstep(0.3, 0.7, m.r);',
    '  float id = floor(m.g*255.0 + 0.5) - 1.0;',
    '  float s = id < -0.5 ? 1.0 : smoothstep(0.0, 1.0, (S.x - id)*1.5 - m.b*0.5);',
    '  float tone = id < -0.5 ? 1.6 : mix(0.34, 1.42, s);',
    // 生长：每个网点在随机时刻冒出来；散开：实心先碎回网点，再按随机顺序缩没
    '  float gin = clamp(S.y*2.0 - hc*0.9, 0.0, 1.0);',
    '  float gout = 1.0 - smoothstep(0.0, 1.0, S.z*1.9 - hc*0.55);',
    '  tone *= gin*gout;',
    '  return g*tone;',
    '}',
    'void main(){',
    '  vec2 p0 = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y)/uSc;',
    // 数纱镜：镜片内把坐标按放大倍率收拢
    '  vec2 p = p0; float zs = 1.0; float ld = length(p0 - uLoupe.xy); float lr = uLoupe.z*uLoupe.w;',
    '  if (uLoupe.w > 0.01 && ld < lr) { zs = 3.4; p = uLoupe.xy + (p0 - uLoupe.xy)/zs; }',
    '  vec4 P = texture2D(uPaper, p/512.0);',
    '  vec4 Pm = texture2D(uPaper, p.yx/2300.0 + 0.27);',
    '  vec2 wob = (vec2(texture2D(uPaper, p/97.0).g, texture2D(uPaper, p.yx/89.0 + 0.5).g) - 0.5)*1.4;',
    '  vec2 pa = p - uOA + wob, pb = p - uOB - wob;',
    // 封面 → 两色分色（按油墨在对数空间里最小二乘），提亮暗部，别印成一片黑
    '  vec2 cuv = uCov.xy + (p - uCss*0.5)/(max(uCss.x, uCss.y)*uCov.z);',
    '  vec3 c = texture2D(uCover, vec2(cuv.x, cuv.y)).rgb;',
    // 双色调：粉版吃中间调和暗部，蓝版只进最深的暗部；整体做成老印刷品常见的椭圆网点晕边
    // 自动色阶：按这张封面的明暗分布拉开、再把平均亮度调到一半左右 —— 很黑的封面不会印成一片，很白的也有层次
    '  float Lm = pow(clamp((dot(c, vec3(0.3, 0.59, 0.11)) - uLev.x)/uLev.y, 0.0, 1.0), uLev.z);',
    '  float vg = smoothstep(0.66, 0.26, length((p/uCss - vec2(0.55, 0.47))*vec2(1.08, 1.32)));',
    '  float tA = 0.74*pow(1.0 - Lm, 0.85)*vg;',
    '  float tB = 0.58*smoothstep(0.55, 0.02, Lm)*vg;',
    // 音乐：频谱波从左往右拂过（每一列按对应频段），低音呼吸
    '  float bx = clamp(p.x/uCss.x, 0.0, 1.0);',
    '  float bin = texture2D(uBins, vec2(0.01 + bx*0.98, 0.5)).r;',
    '  float dx = (p.x - uSweep)/uSweepW;',
    '  float env = exp(-dx*dx);',
    '  float mdl = 1.0 + uBass*0.12 + env*bin*0.8;',
    // 字周围挖空一圈（让字站得住）
    '  vec3 hl = texture2D(uHalo, p/uCss).rgb;',
    '  float ko = max(max(hl.r*uS0.w*(1.0 - uS0.z)*min(1.0, uS0.y*2.0), hl.g*uS1.w*(1.0 - uS1.z)*min(1.0, uS1.y*2.0)), hl.b*uS2.w*(1.0 - uS2.z)*min(1.0, uS2.y*2.0));',
    '  ko = smoothstep(0.0, 0.62, ko);',
    '  tA *= (1.0 - 0.97*ko)*mdl; tB *= (1.0 - 0.97*ko)*mdl;',
    // 两个版的网点
    '  vec2 cidA, cidB;',
    '  vec2 fA = spot(pa, 0.2618, uCell, zs, cidA);',
    '  vec2 fB = spot(pb, 1.309, uCell, zs, cidB);',
    '  float hcB = h21(cidB);',
    '  float tl = max(max(lyricTone(uM0, uR0, uS0, pb, cidB, hcB), lyricTone(uM1, uR1, uS1, pb, cidB, hcB)), lyricTone(uM2, uR2, uS2, pb, cidB, hcB));',
    '  float tBf = max(tB*(1.0 - smoothstep(0.0, 0.3, tl)), tl);',
    // 网点边缘毛糙：孔版的网点不是完美圆
    '  float rgh = (P.g - 0.5)*0.12 + (P.b - 0.5)*0.12 + (P.r - 0.5)*0.08;',
    '  float jA = 1.0 + (h21(cidA + 11.3) - 0.5)*0.2, jB = 1.0 + (hcB - 0.5)*0.16;',
    '  float kA = dotInk(fA, tA*jA, rgh);',
    '  float kB = dotInk(fB, tBf*jB, -rgh*0.8 + (Pm.g - 0.5)*0.04);',
    // 梯尺（左下）：两个版各 10 级
    '  vec2 wq = (p - uWedge.xy)/uWedge.zw;',
    '  if (wq.x > 0.0 && wq.x < 1.0 && wq.y > 0.0 && wq.y < 1.0) {',
    '    float st = (floor(wq.x*10.0) + 1.0)/10.0;',
    '    float gapx = step(0.08, fract(wq.x*10.0));',
    '    if (wq.y < 0.44) kA = max(kA, dotInk(fA, st*1.06, 0.0)*gapx);',
    '    else if (wq.y > 0.56) kB = max(kB, dotInk(fB, st*1.06, 0.0)*gapx);',
    '  }',
    // 版面小字 / 裁切线（实地）
    '  vec4 D = texture2D(uDeco, p/uCss + wob*0.0003);',
    '  kA = max(kA, D.r);',
    '  kB = max(kB, max(D.g, D.b*uInter));',
    // 油墨颗粒：浓淡斑驳 + 针孔
    '  float g2 = texture2D(uPaper, p.yx/512.0 + 0.41).b;',
    '  float iA = kA*(0.82 + 0.18*P.g)*(1.0 - 0.7*smoothstep(0.86, 0.99, P.b));',
    '  float iB = kB*(0.85 + 0.15*Pm.g)*(1.0 - 0.7*smoothstep(0.86, 0.99, g2));',
    '  vec3 col = uPaperCol*(1.0 + (P.r - 0.5)*0.26 + (P.b - 0.5)*0.035)*(0.985 + 0.03*Pm.g);',
    '  col *= mix(vec3(1.0), uInkA, clamp(iA, 0.0, 1.0));',
    '  col *= mix(vec3(1.0), uInkB, clamp(iB, 0.0, 1.0));',
    // 数纱镜：镜筒、刻度、高光、投影
    '  if (uLoupe.w > 0.01) {',
    '    float rr = ld/lr;',
    '    if (rr < 1.0) {',
    '      col *= 1.0 - 0.18*smoothstep(0.7, 1.0, rr);',
    '      vec2 lq = (p0 - uLoupe.xy)/lr;',
    '      float tick = step(abs(lq.y - 0.56), 0.004*3.4) * step(abs(lq.x), 0.62);',
    '      float tk = fract((lq.x + 1.0)*lr/10.0);',
    '      float ticks = step(tk, 0.12) * step(lq.y, 0.56) * step(0.56 - (mod(floor((lq.x + 1.0)*lr/10.0), 5.0) < 0.5 ? 0.09 : 0.05), lq.y) * step(abs(lq.x), 0.62);',
    '      col = mix(col, vec3(0.08, 0.07, 0.07), clamp(tick + ticks, 0.0, 1.0)*0.85);',
    '      col += vec3(0.07)*smoothstep(0.5, 0.0, length(lq - vec2(-0.45, -0.5)))*0.6;',
    '    } else {',
    '      float ring = smoothstep(1.0, 1.005, rr)*(1.0 - smoothstep(1.0 + 14.0/lr, 1.0 + 15.0/lr, rr));',
    '      vec2 nn = normalize(p0 - uLoupe.xy);',
    '      vec3 metal = vec3(0.13, 0.12, 0.115)*(0.8 + 0.5*max(0.0, dot(nn, vec2(-0.6, -0.8))));',
    '      col = mix(col*(1.0 - 0.35*exp(-(ld - lr)/16.0)*uLoupe.w), metal, ring);',
    '    }',
    '  }',
    '  vec2 v = p0/uCss - 0.5;',
    '  col *= 1.03 - 0.14*dot(v, v);',
    '  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)))*43758.5453) - 0.5)/255.0;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  NBFX.register({
    id: 'riso-halftone', theme: 'riso', name: '网点', en: 'HALFTONE',
    desc: '歌词由网点长出、连成实心',
    hint: '按住画面：数纱镜放大看网点',
    icon: '<circle cx="6" cy="6" r="1"/><circle cx="12" cy="6" r="1.8"/><circle cx="18" cy="6" r="2.6"/><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="2.6"/><circle cx="18" cy="12" r="3.2"/><circle cx="6" cy="18" r="2.6"/><circle cx="12" cy="18" r="3.2"/><circle cx="18" cy="18" r="3.6"/>',
    create: function (host) {
      var cv = NBFX.canvas(host, 'riso-ht');
      var gl = NBFX.gl.create(cv, { alpha: false, premultipliedAlpha: false });
      var W = host.width || innerWidth, H = host.height || innerHeight, DPR = host.dpr || 1, SC = 1;
      var dead = false;
      if (!gl) {
        var c2 = cv.getContext('2d');
        return {
          resize: function (w, h, d) { W = w; H = h; cv.width = w * d; cv.height = h * d; c2.setTransform(d, 0, 0, d, 0, 0); },
          frame: function (f) {
            c2.fillStyle = '#f1eadb'; c2.fillRect(0, 0, W, H);
            var t = f.lyric.line ? f.lyric.line.text : (f.lyric.fallback || '');
            var lay = NBFX.text.layout(t, { maxWidth: W * 0.75, size: H * 0.16, weight: 900, maxLines: 3 });
            c2.font = '900 ' + lay.size + 'px ' + NBFX.fonts.sans; c2.fillStyle = '#3255a4';
            lay.chars.forEach(function (c) { c2.fillText(c.ch, W * 0.1 + c.x, H * 0.3 + c.baseline); });
          },
          pointer: function () {}, destroy: function () { if (cv.parentNode) cv.parentNode.removeChild(cv); }
        };
      }
      var prog = NBFX.gl.program(gl, null, FS);
      var texPaper = NBFX.gl.texture(gl, paperCanvas(), { repeat: true, mipmap: true });
      var covCv = document.createElement('canvas'), covOld = document.createElement('canvas'), covNew = document.createElement('canvas');
      covCv.width = covCv.height = covOld.width = covOld.height = covNew.width = covNew.height = 256;
      var texCover = NBFX.gl.texture(gl, null), coverRef = null, coverMix = 1;
      var levOld = [0.03, 0.8, 1], levNew = [0.03, 0.8, 1];
      // 封面的明暗分布 → [起点, 跨度, gamma]
      function coverLevels(cv2) {
        try {
          var d = cv2.getContext('2d').getImageData(0, 0, 256, 256).data, ls = [];
          for (var i = 0; i < d.length; i += 4 * 7) ls.push((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255);
          ls.sort(function (a, b) { return a - b; });
          var lo = ls[Math.floor(ls.length * 0.04)], hi = ls[Math.floor(ls.length * 0.96)];
          var rg = Math.max(0.22, hi - lo), mid = (lo + hi) / 2;
          lo = M.clamp(mid - rg / 2, 0, 1 - rg);
          var sum = 0; for (var k = 0; k < ls.length; k++) sum += M.clamp((ls[k] - lo) / rg, 0, 1);
          var mean = M.clamp(sum / ls.length, 0.03, 0.97);
          return [lo, rg, M.clamp(Math.log(0.52) / Math.log(mean), 0.45, 2.4)];
        } catch (e) { return [0.03, 0.8, 1]; }
      }
      var binsData = new Uint8Array(64 * 4), texBins = NBFX.gl.texture(gl, null);
      var decoCv = document.createElement('canvas'), texDeco = NBFX.gl.texture(gl, null);
      var haloCv = document.createElement('canvas'), texHalo = NBFX.gl.texture(gl, null);
      var slots = [0, 1, 2].map(function () { return { cv: document.createElement('canvas'), tex: NBFX.gl.texture(gl, null), blk: null, t0: -99, dis: -1, cp: 0, on: false, key: '' }; });
      var cur = -1, curKey = '', lastF = null, now = 0;
      var inkSet = null, ink = { a: [1, .3, .7], b: [.2, .33, .64] }, inkT = null;
      var paperCol = CL.hex2rgb('#f3ecde');
      var reg = { A: [1.6, -1.2], B: [-1.1, 1.3] };
      var loupe = { x: -999, y: -999, tx: -999, ty: -999, a: 0, on: false };
      var inter = 0, sweep = 0, needDraw = 3;

      function geom() {
        var left = Math.max(96, W * 0.075), right = W - Math.max(110, W * 0.085);
        var top = Math.max(150, H * 0.2), bottom = H - 110 - Math.max(92, H * 0.13);
        return { left: left, right: right, top: top, bottom: bottom };
      }
      function cellSize() { return M.clamp(H / 118, 5.5, 11); }

      /* ---------- 版面小字：R=主色版  G=字版  B=“间奏”标签（字版，按需淡入） ---------- */
      function drawDeco(info) {
        decoCv.width = Math.max(2, Math.round(W * SC)); decoCv.height = Math.max(2, Math.round(H * SC));
        var x = decoCv.getContext('2d'), g = geom();
        x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over';
        x.fillStyle = '#000'; x.fillRect(0, 0, decoCv.width, decoCv.height);
        x.setTransform(SC, 0, 0, SC, 0, 0); x.globalCompositeOperation = 'lighter';
        var A = '#f00', B = '#0f0', I = '#00f', mono = NBFX.fonts.mono, sans = NBFX.fonts.sans;
        function ls(v) { try { x.letterSpacing = v; } catch (e) {} }
        x.textBaseline = 'alphabetic';
        // 裁切线（两个版都印，套准误差会露出来）
        var m = 30;
        [A, B].forEach(function (col) {
          x.strokeStyle = col; x.lineWidth = 1.1;
          [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(function (c) {
            if (c[0] > W - 320 && c[1] < 120) return; // 右上灵动岛区域不画
            x.beginPath(); x.moveTo(c[0] - c[2] * 18, c[1]); x.lineTo(c[0] - c[2] * 4, c[1]); x.moveTo(c[0], c[1] - c[3] * 18); x.lineTo(c[0], c[1] - c[3] * 4); x.stroke();
          });
        });
        // 左上：校样说明（软件顶部正中有搜索框，这里的字不越过屏幕中线左边约 300px）
        var L = g.left, u = M.clamp(H / 900, 0.8, 1.3), maxHW = Math.max(200, W / 2 - 300 - L);
        function fit(str) { str = String(str); if (x.measureText(str).width <= maxHW) return str; while (str.length > 1 && x.measureText(str + '…').width > maxHW) str = str.slice(0, -1); return str + '…'; }
        ls('2.5px'); x.fillStyle = B; x.font = '700 ' + Math.round(12 * u) + 'px ' + mono;
        x.fillText(fit('HALFTONE PROOF · 网点校样 · 2 INKS'), L, 58 * u);
        ls('1px'); x.font = '900 ' + Math.round(19 * u) + 'px ' + sans;
        var head = fit(info.title + (info.artist ? '  —  ' + info.artist : ''));
        x.fillText(head, L, 58 * u + 30 * u);
        var tw = x.measureText(head).width;
        x.fillStyle = A; x.font = '700 ' + Math.round(12 * u) + 'px ' + mono; ls('2px');
        if (tw + 18 + x.measureText(info.lineTag).width <= maxHW + 40) x.fillText(info.lineTag, L + tw + 18, 58 * u + 29 * u);
        // “间奏”标签（B 通道）
        x.fillStyle = I; x.font = '900 ' + Math.round(15 * u) + 'px ' + sans; ls('3px');
        x.fillText('间奏 · INTERLUDE · · ·', L, 58 * u + 58 * u);
        // 右缘竖排
        x.save(); x.fillStyle = B; x.translate(W - 38, 150); x.rotate(Math.PI / 2);
        x.font = '700 ' + Math.round(11 * u) + 'px ' + mono; ls('4px');
        x.fillText('NOT BLIND PRESS · PROOF 校样 · ' + info.lpi + ' LPI · 157 GSM · ' + info.album, 0, 0);
        x.restore();
        // 左下：梯尺标签
        var wd = info.wedge;
        x.fillStyle = B; x.font = '700 ' + Math.round(11 * u) + 'px ' + mono; ls('2px');
        x.fillText('A 15°', wd[0] - 50 * u, wd[1] + wd[3] * 0.42);
        x.fillText('B 75°', wd[0] - 50 * u, wd[1] + wd[3] * 1.0);
        // 两种油墨的名字标在色条右边
        x.fillStyle = A; x.fillText(info.inkA, wd[0] + wd[2] + 14 * u, wd[1] + wd[3] * 0.42);
        x.fillStyle = B; x.fillText(info.inkB, wd[0] + wd[2] + 14 * u, wd[1] + wd[3] * 1.0);
        x.fillText('10  20  30  40  50  60  70  80  90  100%', wd[0], wd[1] + wd[3] + 18 * u);
        ls('0px');
        x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over';
        NBFX.gl.upload(gl, texDeco, decoCv);
      }
      function decoInfo(f) {
        var ly = f.lyric, tr = f.track || {}, g = geom(), u = M.clamp(H / 900, 0.8, 1.3);
        var lpi = 65;
        var ww = Math.min(300, W * 0.2) * u;
        return {
          inkA: inkSet ? inkSet.a : '', inkB: inkSet ? inkSet.b : '', title: String(tr.title || ly.fallback || ''), artist: String(tr.artist || ''), album: String(tr.album || ''),
          lineTag: ly.idx >= 0 ? 'LINE ' + pad2(ly.idx + 1) + ' / ' + pad2((ly.lines || []).length) : (ly.lines && ly.lines.length ? 'INTRO · 前奏' : 'INSTRUMENTAL · 纯音乐'),
          lpi: lpi, wedge: [g.left + 50 * u, H - 110 - 62 * u, ww, 24 * u]
        };
      }

      /* ---------- 新一行 ---------- */
      function buildLine(f, key) {
        var ly = f.lyric, tr = f.track || {}, line = ly.idx >= 0 ? ly.line : null, g = geom();
        var text = line ? line.text : (ly.fallback || tr.title || '');
        var maxW = g.right - g.left, areaH = g.bottom - g.top;
        // [二改] 歌词大小（NBFX.lyricScale）：字号上限 × s；调小时排版区也缩；翻译等小字跟着轻一点变
        var us = NBFX.lyricScale ? NBFX.lyricScale() : 1, box = Math.min(1, us);
        var subFs = Math.round(M.clamp(H * 0.03, 17, 32) * M.clamp(us, 0.75, 1.3));
        var extra = (line && line.translation) ? subFs * 2.2 : (!line ? subFs * 2.6 : 0);
        var sMax = Math.min(H * (line ? 0.19 : 0.21), W * 0.14) * us;
        var lay = layoutBlock(text, maxW * box, (areaH - extra) * box, sMax);
        var pad = Math.ceil(lay.size * 0.1) + 8;
        var blk = { lay: lay, pad: pad, w: lay.width, h: lay.height + extra, subs: [] };
        if (line && line.translation) {
          blk.subs.push({ text: line.translation, font: '700 ' + subFs + 'px ' + NBFX.fonts.sans, ls: (subFs * 0.08).toFixed(1) + 'px', x: 4, y: lay.height + subFs * 1.6 });
        } else if (!line) {
          blk.subs.push({ text: String(tr.artist || ''), font: '900 ' + Math.round(subFs * 1.25) + 'px ' + NBFX.fonts.sans, ls: '3px', x: 4, y: lay.height + subFs * 1.7 });
          blk.subs.push({ text: ((tr.album ? '《' + tr.album + '》 · ' : '') + (ly.lines && ly.lines.length ? 'NOW PLAYING · 前奏' : 'INSTRUMENTAL · 纯音乐')), font: '700 ' + Math.round(subFs * 0.55) + 'px ' + NBFX.fonts.mono, ls: '3px', x: 6, y: lay.height + subFs * 2.55 });
        }
        blk.w = Math.max(blk.w, W * 0.5);
        var by = g.top + Math.max(0, areaH - blk.h) * 0.5;
        // 挑一个槽：优先用最早散完的
        var pick = -1, oldest = 1e9;
        for (var i = 0; i < 3; i++) { if (i === cur) continue; var s = slots[i]; var t = s.on ? s.dis : -1e9; if (!s.on) { pick = i; break; } if (t < oldest) { oldest = t; pick = i; } }
        if (cur >= 0) { slots[cur].dis = now; }
        var sl = slots[pick];
        sl.blk = blk; sl.t0 = now; sl.dis = -1; sl.on = true; sl.key = key; sl.cp = line ? ly.charPos : 1e4; sl.title = !line;
        renderMask(sl.cv, blk, SC);
        NBFX.gl.upload(gl, sl.tex, sl.cv);
        sl.rect = [g.left - pad, by - pad, sl.cv.width / SC, sl.cv.height / SC];
        cur = pick; curKey = key; needDraw = 3;
        drawHalo();
        drawDeco(decoInfo(f));
      }
      // 低分辨率的模糊字形（每个槽一个通道），用来把字周围的底图挖淡
      function drawHalo() {
        var k = 0.25, hw = Math.max(2, Math.round(W * k)), hh = Math.max(2, Math.round(H * k));
        haloCv.width = hw; haloCv.height = hh;
        var x = haloCv.getContext('2d');
        x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.filter = 'none';
        x.fillStyle = '#000'; x.fillRect(0, 0, hw, hh);
        x.globalCompositeOperation = 'lighter'; x.textBaseline = 'alphabetic';
        slots.forEach(function (s, i) {
          if (!s.on || !s.rect) return;
          var r = s.rect, blk = s.blk, lay = blk.lay, pad = blk.pad, bl = Math.max(2, lay.size * 0.22 * k);
          var col = i === 0 ? '255,0,0' : i === 1 ? '0,255,0' : '0,0,255';
          // 整块歌词后面先挖一个很淡的“窗”，再按字形挖深
          try { x.filter = 'blur(' + (bl * 2.2).toFixed(1) + 'px)'; } catch (e) {}
          x.setTransform(1, 0, 0, 1, 0, 0);
          x.fillStyle = 'rgba(' + col + ',0.42)';
          x.fillRect((r[0] + pad * 0.5) * k, (r[1] + pad * 0.6) * k, (lay.width + pad) * k, (blk.h + pad * 0.8) * k);
          try { x.filter = 'blur(' + bl.toFixed(1) + 'px)'; } catch (e) {}
          x.fillStyle = 'rgb(' + col + ')';
          x.font = lay.weight + ' ' + lay.size + 'px ' + lay.family;
          lay.chars.forEach(function (c) {
            if (c.ch === ' ') return;
            x.setTransform(k * lay.sq, 0, 0, k, (r[0] + pad + c.x) * k, (r[1] + pad + c.baseline) * k);
            x.fillText(c.disp, 0, 0);
          });
          x.setTransform(k, 0, 0, k, (r[0] + pad) * k, (r[1] + pad) * k);
          (blk.subs || []).forEach(function (sb) { x.font = sb.font; x.fillText(sb.text, sb.x, sb.y); });
          x.filter = 'none';
        });
        x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over';
        NBFX.gl.upload(gl, texHalo, haloCv);
      }
      function lineKey(f) {
        var ly = f.lyric, tr = f.track || {};
        if (ly.idx >= 0 && ly.line) return 'L|' + ly.idx + '|' + ly.line.t + '|' + ly.line.text;
        return 'T|' + (ly.fallback || tr.title || '') + '|' + (tr.artist || '');
      }
      function updateCover(f) {
        if (f.cover && f.cover !== coverRef) {
          var first = !coverRef;
          coverRef = f.cover;
          var o = covOld.getContext('2d'); o.clearRect(0, 0, 256, 256); o.drawImage(covCv, 0, 0);
          var n = covNew.getContext('2d'); n.clearRect(0, 0, 256, 256);
          try { n.filter = 'blur(2px)'; } catch (e) {}
          n.drawImage(f.cover, -8, -8, 272, 272); n.filter = 'none';
          levOld = levNow(); levNew = coverLevels(covNew);
          coverMix = first ? 1 : 0;
          if (first) { o.drawImage(covNew, 0, 0); }
          blendCover();
        } else if (coverMix < 1) { coverMix = Math.min(1, coverMix + f.dt / 1.2); blendCover(); }
      }
      function levNow() { var k = M.smooth(0, 1, coverMix); return [M.lerp(levOld[0], levNew[0], k), M.lerp(levOld[1], levNew[1], k), M.lerp(levOld[2], levNew[2], k)]; }
      function blendCover() {
        var c = covCv.getContext('2d');
        c.globalAlpha = 1; c.drawImage(covOld, 0, 0);
        c.globalAlpha = M.smooth(0, 1, coverMix); c.drawImage(covNew, 0, 0); c.globalAlpha = 1;
        NBFX.gl.upload(gl, texCover, covCv);
        needDraw = 2;
      }

      var drift = 0;
      function frame(f) {
        f = NBFX.lyric.lead(f, 0.5);   // 提前量：开唱前新行网点已经长出来
        lastF = f; now = f.t;
        var dt = Math.min(0.05, f.dt || 0.016);
        var set = pickSet(f.palette);
        if (set !== inkSet) {
          var first = !inkSet; inkSet = set; inkT = { a: CL.hex2rgb(INK[set.a]), b: CL.hex2rgb(INK[set.b]) };
          if (first) ink = { a: inkT.a.slice(), b: inkT.b.slice() }; else if (cur >= 0) drawDeco(decoInfo(f));
        }
        ['a', 'b'].forEach(function (k) { for (var i = 0; i < 3; i++) ink[k][i] = M.damp(ink[k][i], inkT[k][i], 3, dt); });
        updateCover(f);
        var key = lineKey(f);
        if (key !== curKey) buildLine(f, key);
        var c = slots[cur];
        if (c && !c.title) c.cp = f.lyric.charPos;
        // 散完的槽关掉
        slots.forEach(function (s) { if (s.on && s.dis >= 0 && now - s.dis > 0.6) { s.on = false; drawHalo(); } });
        // 频谱：64 段写进 1 像素高的纹理
        for (var i = 0; i < 64; i++) binsData[i * 4] = Math.min(255, f.audio.bins[i] * 255) | 0;
        NBFX.gl.upload(gl, texBins, { data: binsData, width: 64, height: 1 });
        // 频谱波：每两小节从左扫到右
        if (f.playing) { sweep += dt / 2.6; drift += dt; }
        var sweepX = ((sweep % 1) * 1.3 - 0.15) * W;
        inter = M.damp(inter, f.lyric.held && f.lyric.idx >= 0 ? 1 : 0, 3, dt);
        // 数纱镜
        loupe.a = M.damp(loupe.a, loupe.on ? 1 : 0, loupe.on ? 9 : 7, dt);
        loupe.x = M.damp(loupe.x, loupe.tx, 16, dt); loupe.y = M.damp(loupe.y, loupe.ty, 16, dt);
        var busy = f.playing || needDraw > 0 || loupe.a > 0.002 && Math.abs(loupe.a - (loupe.on ? 1 : 0)) > 0.002 || Math.abs(loupe.x - loupe.tx) + Math.abs(loupe.y - loupe.ty) > 0.3 || f.audio.bass > 0.01 || coverMix < 1;
        slots.forEach(function (s) { if (s.on && (now - s.t0 < 1.2 || s.dis >= 0)) busy = true; });
        if (Math.abs(ink.a[0] - inkT.a[0]) + Math.abs(ink.b[2] - inkT.b[2]) > 0.002) busy = true;
        if (Math.abs(inter - (f.lyric.held ? 1 : 0)) > 0.01) busy = true;
        if (needDraw > 0) needDraw--;
        if (!busy) return;
        var dec = decoInfo(f);
        var u = {
          uRes: [cv.width, cv.height], uCss: [W, H], uSc: SC, uT: now, uBass: f.playing ? f.audio.bass : 0, uCell: cellSize(),
          uSweep: sweepX, uSweepW: W * 0.12, uInter: inter,
          uPaper: { tex: texPaper, unit: 0 }, uCover: { tex: texCover, unit: 1 }, uBins: { tex: texBins, unit: 2 }, uDeco: { tex: texDeco, unit: 3 }, uHalo: { tex: texHalo, unit: 4 },
          uPaperCol: paperCol, uInkA: ink.a, uInkB: ink.b, uOA: reg.A, uOB: reg.B,
          uCov: [0.5 + 0.02 * Math.sin(drift * 0.05), 0.47 + 0.015 * Math.cos(drift * 0.041), 1.08, 0], uLev: levNow(),
          uLoupe: [loupe.x, loupe.y, M.clamp(H * 0.14, 90, 170), loupe.a], uWedge: dec.wedge
        };
        slots.forEach(function (s, i) {
          u['uM' + i] = { tex: s.tex, unit: 5 + i };
          u['uR' + i] = s.rect || [-9999, -9999, 1, 1];
          var grow = M.clamp((now - s.t0 - 0.14) / 0.62, 0, 1), dis = s.dis >= 0 ? M.clamp((now - s.dis) / 0.5, 0, 1) : 0;
          u['uS' + i] = [s.cp, grow, dis, s.on ? 1 : 0];
        });
        NBFX.gl.bindTarget(gl, null, cv.width, cv.height);
        NBFX.gl.use(prog, u);
        NBFX.gl.drawQuad(gl);
      }

      return {
        resize: function (w, h, dpr) {
          W = w; H = h; DPR = dpr || 1;
          SC = Math.max(0.6, Math.min(DPR, Math.sqrt(2.8e6 / Math.max(1, w * h))));
          cv.width = Math.max(2, Math.round(w * SC)); cv.height = Math.max(2, Math.round(h * SC));
          needDraw = 3;
          if (lastF) { slots.forEach(function (s) { s.on = false; }); cur = -1; buildLine(lastF, lineKey(lastF)); slots[cur].t0 = -99; }
        },
        frame: function (f) { if (!dead) frame(f); },
        pointer: function (type, x, y) {
          if (type === 'down') { loupe.on = true; loupe.tx = x; loupe.ty = y; if (loupe.a < 0.05) { loupe.x = x; loupe.y = y; } }
          else if (type === 'move') { if (loupe.on) { loupe.tx = x; loupe.ty = y; } }
          else if (type === 'up') loupe.on = false;
          needDraw = 2;
        },
        destroy: function () {
          dead = true;
          try { NBFX.gl.destroy(gl); } catch (e) {}
          if (cv.parentNode) cv.parentNode.removeChild(cv);
          slots = [];
        }
      };
    }
  });
})();
} catch (nbLyricFxLoadErr) { try { console.error("[平面歌词] 载入失败：孔版 · 网点 (riso-halftone)", nbLyricFxLoadErr); } catch (_e) { } }

/* ------------------------------------------------------------
 * 回声 · 回声大字 (echo-type)
 * ------------------------------------------------------------ */
try {
/* ============================================================
 * Not Blind · 播放页歌词动效 · 回声 ECHO
 * A. 回声大字 ECHO TYPE（3D）
 * 当前这一行用超粗大字放在中间；上下各 5 层空心描边的同一行字在纵深里依次后退、变淡、略错开（回声）。
 * 唱到一个字：主行里这个字从空心被抹成实心灰绿，然后它的回声一层一层被点亮成朱红再退回。
 * 换行：回声先收拢进主行 → 换字 → 再荡开。回声层间距固定，不跟节拍动。
 * 背景「随封面」：封面大幅模糊、缓慢转动、压暗降饱和 + 细颗粒；音乐只推背光和颗粒。
 * 纯 WebGL（NBFX.gl）：文字只在换行时画进一张纹理（R 实心 / G 描边 / B 柔光），每个字一个四边形。
 * ============================================================ */
(function () {
  'use strict';
  var M = NBFX.math;
  var LEAD = 0.45;       // 提前多少秒开始换行
  var INK = [0xdf / 255, 0xe3 / 255, 0xdc / 255], HOT = [1, 0x4a / 255, 0x1c / 255], MATTE = [0x14 / 255, 0x12 / 255, 0x11 / 255];
  var NE = 5;          // 每侧回声层数
  var MAXC = 64;       // 记录逐字点亮时间的上限（着色器数组）
  var NEVER = 1e4, LONGAGO = -1e4;

  /* ---------------- 着色器 ---------------- */
  var BG_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uC0, uC1;',
    'uniform float uMix, uRot, uTime, uBass, uTreb;',
    'uniform vec2 uRes, uCtr;',
    'uniform vec3 uMatte, uGlow, uInk, uTint;',
    'uniform vec4 uRip[3];',
    'uniform float uRipOn, uScrimA;',
    'uniform vec4 uScrim;',
    'float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'void main(){',
    '  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;',
    '  vec2 c = (px - uRes * 0.5) / uRes.y;',
    '  float cs = cos(uRot), sn = sin(uRot);',
    '  vec2 q = mat2(cs, sn, -sn, cs) * c * 0.5 + 0.5;',
    // 封面（已预先模糊）旋转放大铺满
    '  vec3 cv = mix(texture2D(uC0, q).rgb, texture2D(uC1, q).rgb, uMix);',
    '  float l = dot(cv, vec3(0.2126, 0.7152, 0.0722));',
    '  cv = mix(cv, uTint * l * 1.7, 0.45);',                           // 高光别发灰：亮处染上封面主色
    '  cv = mix(vec3(dot(cv, vec3(0.2126, 0.7152, 0.0722))), cv, 0.85);',
    '  cv = cv / (1.0 + cv * 1.8);',                                    // 压高光（太阳那种亮斑别太亮）
    '  vec2 d = (px - uCtr) / uRes.y;',
    '  float g = exp(-(d.x * d.x * 1.1 + d.y * d.y * 3.2));',
    '  vec3 col = uMatte * 0.5 + cv * (0.34 + 0.34 * g);',              // 边缘更接近哑光黑，中间透出封面色
    // 主字背后一团很淡的背光（低音轻微呼吸）
    '  col += uGlow * g * (0.13 + 0.05 * uBass);',
    '  vec2 sq = max(abs(px - uScrim.xy) - uScrim.zw, 0.0);',
    '  col *= 1.0 - uScrimA * exp(-dot(sq, sq) / (uRes.y * uRes.y * 0.0045));',
    // 暗角
    '  float v = length(c * vec2(0.8, 1.05));',
    '  col *= 1.0 - 0.62 * smoothstep(0.3, 1.0, v);',
    // 点击的回声圈
    '  float ring = 0.0;',
    '  if (uRipOn > 0.5) for (int i = 0; i < 3; i++) {',
    '    vec4 r = uRip[i]; float age = uTime - r.z;',
    '    if (age > 0.0 && age < 2.6) {',
    '      float dist = length(px - r.xy);',
    '      for (int j = 0; j < 3; j++) {',
    '        float a2 = age - float(j) * 0.16;',
    '        if (a2 > 0.0) {',
    '          float rad = a2 * uRes.y * 0.95;',
    '          float w = exp(-pow((dist - rad) / 1.1, 2.0));',
    '          ring += w * exp(-a2 * 1.5) * r.w * (0.30 - float(j) * 0.08);',
    '        }',
    '      }',
    '    }',
    '  }',
    '  col += uInk * ring;',
    // 颗粒
    '  float gr = h12(gl_FragCoord.xy + fract(uTime * 7.13) * vec2(113.0, 71.0)) - 0.5;',
    '  col += gr * (0.034 + 0.01 * uTreb);',
    '  gl_FragColor = vec4(max(col, 0.0), 1.0);',
    '}'
  ].join('\n');

  var TX_VS = [
    'precision highp float;',
    'attribute vec2 aPos;',      // 相对文字块左上角（CSS px）
    'attribute vec2 aUV;',
    'attribute vec4 aInfo;',     // 字序号(-1=译文), 字内横向 0..1, 字中心 x, y
    'uniform vec2 uRes, uOrigin;',
    'uniform vec3 uCam;',        // 相机 x, y, 透视距离
    'uniform vec3 uLay;',        // z, 横移, 竖移
    'uniform vec2 uLay2;',       // 层号 k（0=主行）, 是否主行
    'uniform float uTime, uDelay;',
    'uniform float uSung[' + MAXC + '];',
    'uniform vec4 uRip[3];',
    'uniform vec2 uPing;',
    'varying vec2 vUV; varying vec3 vInfo; varying float vFlash; varying vec2 vScr; varying float vRing;',
    'void main(){',
    '  float ci = aInfo.x, k = uLay2.x, isMain = uLay2.y;',
    '  vec3 p = vec3(uOrigin + aPos + uLay.yz, uLay.x);',
    '  vec2 cc = uOrigin + aInfo.zw + uLay.yz;',
    '  float ring = 0.0;',
    '  for (int i = 0; i < 3; i++) {',
    '    vec4 r = uRip[i]; float age = uTime - r.z;',
    '    if (age > 0.0 && age < 2.6) {',
    '      vec2 d = cc - r.xy; float dist = length(d) + 0.001;',
    '      float rad = age * uRes.y * 0.95;',
    '      float w = exp(-pow((dist - rad) / (uRes.y * 0.11), 2.0)) * exp(-age * 1.5) * r.w;',
    '      p.xy += d / dist * w * mix(20.0, 5.0, isMain);',
    '      p.z -= w * 110.0 * (1.0 - isMain);',
    '      ring = max(ring, w);',
    '    }',
    '  }',
    '  float s = uCam.z / (uCam.z - p.z);',
    '  vec2 scr = uCam.xy + (p.xy - uCam.xy) * s;',
    '  if (ci < -0.5 && isMain < 0.5) scr = vec2(-9999.0);',   // 译文只在主行
    '  vScr = scr;',
    '  gl_Position = vec4(scr.x / uRes.x * 2.0 - 1.0, 1.0 - scr.y / uRes.y * 2.0, 0.0, 1.0);',
    '  vUV = aUV; vInfo = vec3(ci, aInfo.y, s);',
    '  float fl = 0.0;',
    '  if (ci > -0.5) {',
    '    int idx = int(min(ci, ' + (MAXC - 1) + '.0) + 0.5);',
    '    float dt = uTime - uSung[idx] - k * uDelay;',
    '    fl = dt > 0.0 ? (1.0 - exp(-dt * 26.0)) * exp(-dt * 3.6) : 0.0;',
    '  }',
    '  float pd = uTime - uPing.x - k * uDelay * 1.8;',
    '  fl = max(fl, pd > 0.0 ? (1.0 - exp(-pd * 16.0)) * exp(-pd * 2.6) * uPing.y : 0.0);',
    '  vFlash = fl; vRing = ring;',
    '}'
  ].join('\n');

  var TX_FS = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes;',
    'uniform float uCP, uTime;',
    'uniform vec4 uLook;',      // 透明度, 是否主行, 景深模糊(mip 偏移), 实心系数
    'uniform vec3 uInk, uHot, uHaze;',
    'uniform vec2 uFade;',      // 回声上/下渐隐边界（CSS px）
    'uniform vec4 uBand;',      // 主行所在的横带（上, 下, 柔边, 强度）：回声从主行"背后"滑出来，不和主行叠在一起
    'varying vec2 vUV; varying vec3 vInfo; varying float vFlash; varying vec2 vScr; varying float vRing;',
    'void main(){',
    '  float ci = vInfo.x, lx = vInfo.y;',
    '  vec3 g = texture2D(uTex, vUV, uLook.z).rgb;',
    '  float fill = g.r, strk = g.g, glow = g.b;',
    '  vec3 col; float a;',
    '  if (uLook.y > 0.5) {',
    '    if (ci < -0.5) { a = fill * 0.78; col = uInk * a; }',
    '    else {',
    '      float prog = uCP - ci;',
    '      float e = 0.16;',
    '      float q = prog * (1.0 + 2.0 * e) - e;',
    '      float sung = smoothstep(lx - e, lx + e, q) * uLook.w;',
    '      float front = exp(-pow((q - lx) / 0.075, 2.0)) * smoothstep(0.0, 0.08, prog) * (1.0 - smoothstep(0.92, 1.0, prog));',
    '      float aU = max(fill * 0.2, strk * 0.8);',
    '      float aS = max(fill, strk);',
    '      a = mix(aU, aS, sung);',
    '      col = mix(uInk, uHot, front * 0.7 * fill) * a;',
    '      col += uInk * glow * 0.05 * sung;',
    '      col += uHot * glow * front * 0.10;',
    '    }',
    '    a *= uLook.x; col *= uLook.x;',
    '  } else {',
    '    float sungE = smoothstep(ci + 0.2, ci + 0.8, uCP);',
    '    float fl = clamp(vFlash + vRing * 0.8, 0.0, 1.0);',
    '    float base = strk * uLook.x * (0.55 + 0.45 * sungE);',
    '    float aa = base * (1.0 + fl * 0.9);',
    '    col = mix(uHaze, uHot, fl) * aa + uHot * glow * fl * 0.16 * uLook.x;',
    '    a = aa;',
    '    float fy = smoothstep(uFade.x, uFade.x + uRes.y * 0.13, vScr.y) * (1.0 - smoothstep(uFade.y - uRes.y * 0.2, uFade.y, vScr.y));',
    '    float inB = smoothstep(uBand.x - uBand.z, uBand.x + uBand.z, vScr.y) * (1.0 - smoothstep(uBand.y - uBand.z, uBand.y + uBand.z, vScr.y));',
    '    fy *= 1.0 - inB * uBand.w;',
    '    col *= fy; a *= fy;',
    '  }',
    '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
    '}'
  ].join('\n');

  /* ---------------- 小工具 ---------------- */
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function pow2(n) { var p = 64; while (p < n) p *= 2; return p; }
  function mk(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function isLatin(s) { var n = 0, l = 0; for (var i = 0; i < s.length; i++) { if (s[i] === ' ') continue; n++; if (s.charCodeAt(i) < 0x250) l++; } return n > 0 && l / n > 0.6; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function tc(sec) { sec = Math.max(0, sec || 0); var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = Math.floor(sec) % 60, fr = Math.floor((sec % 1) * 30); return pad2(h) + ':' + pad2(m) + ':' + pad2(s) + ':' + pad2(fr); }
  function dampArr(cur, tgt, rate, dt) { for (var i = 0; i < 3; i++) cur[i] = M.damp(cur[i], tgt[i], rate, dt); }
  function desat(c, k) { var l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return [M.lerp(l, c[0], k), M.lerp(l, c[1], k), M.lerp(l, c[2], k)]; }

  /* 排版：自己挑断行（1–3 行），优先在空格/标点处断、各行等长、字号尽量大；输出格式同 NBFX.text.layout */
  function smartLayout(text, o) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    var n = text.length, ms = NBFX.text.measureChars(text, 100, o.weight, o.family, o.spacing);
    var ws = ms.chars.map(function (c) { return c.w; }), ls = o.spacing * 100, hasSp = text.indexOf(' ') > 0;
    function trim(a, b) { while (a < b && text[a] === ' ') a++; while (b > a && text[b - 1] === ' ') b--; return [a, b]; }
    function rw(a, b) { var t = trim(a, b); if (t[1] <= t[0]) return 0; var w = 0; for (var i = t[0]; i < t[1]; i++) w += ws[i]; return w + ls * (t[1] - t[0] - 1); }
    var cands = [];
    for (var i = 1; i < n; i++) {
      var a = text[i - 1], b = text[i];
      if (b === ' ') cands.push({ i: i, q: 2 });
      else if (a !== ' ' && /[，,。.！!？?、；;：:]/.test(a)) cands.push({ i: i, q: 2 });
      else if (a !== ' ' && NBFX.text.isCJK(a) && NBFX.text.isCJK(b)) cands.push({ i: i, q: 1 });
    }
    var best = null, byN = {};
    function consider(br) {
      var bd = [0].concat(br, [n]), mx = 0, mn = 1e9, pen = 1, w0 = 0, w1 = 0;
      for (var k = 0; k < bd.length - 1; k++) { var w = rw(bd[k], bd[k + 1]); if (w <= 0) return; mx = Math.max(mx, w); mn = Math.min(mn, w); if (k === 0) w0 = w; else if (k === 1) w1 = w; }
      var nr = bd.length - 1;
      if (nr === 2 && w0 >= w1) pen *= 1.01;   // 一样平衡时，让上面一行长一点
      var size = Math.min(o.maxFs, o.maxW / mx * 100 * 0.985, nr === 1 ? 1e9 : (nr === 2 ? o.maxH2 : o.maxH3) / (nr * o.lh));
      for (var j = 0; j < br.length; j++) {
        for (var c = 0; c < cands.length; c++) if (cands[c].i === br[j] && cands[c].q === 1) pen *= hasSp ? 0.68 : 0.92;
        if (/[，,。.！!？?、；;：:]/.test(text[br[j] - 1] || '')) pen *= 1.15;   // 在标点后断行更自然
      }
      var score = size * pen * (nr > 1 ? 0.7 + 0.3 * mn / mx : 1) * (nr === 1 ? 1.12 : nr === 2 ? 1 : 0.93);
      var cand = { score: score, size: size, br: br.slice() };
      if (!best || score > best.score) best = cand;
      if (!byN[nr] || score > byN[nr].score) byN[nr] = cand;
    }
    consider([]);
    for (var x = 0; x < cands.length; x++) {
      consider([cands[x].i]);
      if (n > 12) for (var y = x + 1; y < cands.length; y++) consider([cands[x].i, cands[y].i]);
    }
    // 行数规则：一行放得下（字号够大）就一行；否则两行；实在不行才三行
    if (o.minSingle) {
      if (byN[1] && byN[1].size >= o.minSingle) best = byN[1];
      else if (byN[2] && byN[2].size >= o.min2) best = byN[2];
      else best = byN[3] || byN[2] || byN[1];
    }
    var size = Math.max(10, Math.floor(best.size)), bd2 = [0].concat(best.br, [n]), lsPx = o.spacing * size;
    var rows = [], chars = [], width = 0;
    for (var r = 0; r < bd2.length - 1; r++) {
      var t = trim(bd2[r], bd2[r + 1]), rc = [], cx = 0;
      for (var q = t[0]; q < t[1]; q++) { var cw = ws[q] * size / 100; rc.push({ ch: text[q], x: cx, w: cw, i: q }); cx += cw + lsPx; }
      var rwid = Math.max(0, cx - lsPx), off = (o.maxW - rwid) / 2, ry = r * size * o.lh;
      rc.forEach(function (c) { c.x += off; c.row = r; c.y = ry; c.baseline = ry + size * 0.88; chars.push(c); });
      rows.push({ s: t[0], e: t[1], width: rwid, chars: rc, x: off, y: ry, baseline: ry + size * 0.88 });
      width = Math.max(width, rwid);
    }
    return { text: text, size: size, weight: o.weight, family: o.family, spacing: o.spacing, lineHeight: o.lh, rows: rows, chars: chars, width: width, boxWidth: o.maxW, height: rows.length * size * o.lh, ascent: size * 0.88 };
  }

  NBFX.register({
    id: 'echo-type', theme: 'echo', name: '回声大字', en: 'ECHO TYPE',
    desc: '唱到的字一层层传出回声',
    hint: '点一下画面：从那里荡开一圈回声，字会被推一下',
    icon: '<path d="M4 12h16"/><path d="M6 8.2h12M6 15.8h12" opacity=".55"/><path d="M8.5 4.6h7M8.5 19.4h7" opacity=".3"/>',
    create: function (host) {
      var el = host.el;
      var cv = NBFX.canvas(host, 'nbfx-echo-type');
      var gl = NBFX.gl.create(cv, { alpha: false, antialias: false });
      var W = host.width || innerWidth, H = host.height || innerHeight, dpr = Math.min(1.5, host.dpr || 1);

      /* ---------- 角标（DOM，清晰省事） ---------- */
      var MONO = NBFX.fonts.mono;
      var hud = mk('div', 'position:absolute;inset:0;pointer-events:none;color:#dfe3dc;font:500 11px/1.5 ' + MONO + ';letter-spacing:.22em;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision');
      var brk1 = mk('i', 'position:absolute;left:62px;top:24px;width:14px;height:14px;border-left:1.5px solid rgba(223,227,220,.55);border-top:1.5px solid rgba(223,227,220,.55)');
      var brand = mk('div', 'position:absolute;left:86px;top:30px;color:rgba(223,227,220,.72)', 'NOT BLIND');
      var brk2 = mk('i', 'position:absolute;right:30px;top:118px;width:14px;height:14px;border-right:1.5px solid rgba(223,227,220,.55);border-top:1.5px solid rgba(223,227,220,.55)');
      var tcBox = mk('div', 'position:absolute;right:52px;top:124px;text-align:right');
      var tcEl = mk('div', 'font-size:12px;letter-spacing:.16em;color:rgba(223,227,220,.86);font-variant-numeric:tabular-nums', 'TC 00:00:00:00');
      var bpmEl = mk('div', 'font-size:10.5px;letter-spacing:.2em;color:rgba(223,227,220,.5);margin-top:4px', '— BPM');
      tcBox.appendChild(tcEl); tcBox.appendChild(bpmEl);
      var np = mk('div', 'position:absolute;left:72px;bottom:134px;display:flex;align-items:center;gap:12px;max-width:40vw');
      var npCv = mk('canvas', 'width:40px;height:40px;border-radius:3px;box-shadow:0 0 0 1px rgba(223,227,220,.14);flex:0 0 auto');
      npCv.width = npCv.height = 80;
      var npTx = mk('div', 'min-width:0;display:flex;flex-direction:column;gap:3px');
      var npT = mk('div', 'font:700 13px/1.2 ' + NBFX.fonts.sans + ';letter-spacing:.06em;color:rgba(223,227,220,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis');
      var npA = mk('div', 'font-size:10px;letter-spacing:.18em;color:rgba(223,227,220,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis');
      npTx.appendChild(npT); npTx.appendChild(npA); np.appendChild(npCv); np.appendChild(npTx);
      [brk1, brand, brk2, tcBox, np].forEach(function (e) { hud.appendChild(e); });
      el.appendChild(hud);

      if (!gl) {
        var warn = mk('div', 'position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);color:#dfe3dc;font:900 48px ' + NBFX.fonts.sans, '');
        el.appendChild(warn);
        return {
          resize: function () {}, pointer: function () {},
          frame: function (f) { var tx = f.lyric.line ? f.lyric.line.text : (f.lyric.fallback || ''); if (warn.textContent !== tx) warn.textContent = tx; },
          destroy: function () { if (hud.parentNode) hud.parentNode.removeChild(hud); if (warn.parentNode) warn.parentNode.removeChild(warn); if (cv.parentNode) cv.parentNode.removeChild(cv); }
        };
      }

      var G = NBFX.gl;
      var maxTex = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048);
      var pBg = G.program(gl, null, BG_FS);
      var pTx = G.program(gl, TX_VS, TX_FS);
      var aUV = gl.getAttribLocation(pTx.p, 'aUV'), aInfo = gl.getAttribLocation(pTx.p, 'aInfo');

      /* ---------- 封面：预先模糊成小图，换封面时交叉淡入 ---------- */
      var covCv = document.createElement('canvas'); covCv.width = covCv.height = 128;
      var covCtx = covCv.getContext('2d');
      var covTex = [G.texture(gl, null), G.texture(gl, null)], covFront = 0, covMix = 1, lastCover = null;
      function blurCover(src) {
        covCtx.filter = 'none'; covCtx.fillStyle = '#141211'; covCtx.fillRect(0, 0, 128, 128);
        covCtx.filter = 'blur(7px)';
        covCtx.drawImage(src, -20, -20, 168, 168);
        covCtx.filter = 'none';
      }
      function setCover(src) {
        if (!src || src === lastCover) return;
        var first = !lastCover; lastCover = src;
        blurCover(src);
        var slot = first ? covFront : 1 - covFront;
        G.upload(gl, covTex[slot], covCv);
        if (first) { G.upload(gl, covTex[1 - slot], covCv); covMix = 1; }
        else { covFront = slot; covMix = 0; }
        // 左下小封面
        var c2 = npCv.getContext('2d'); c2.drawImage(src, 0, 0, 80, 80);
      }

      /* ---------- 文字：排版 → 画进纹理 → 每字一个四边形 ---------- */
      var paintCv = document.createElement('canvas'), paintCtx = paintCv.getContext('2d');
      var cache = [];      // {key, ...res}
      function fitMain(text) {
        var lat = isLatin(text), len = text.length;
        // [二改] 歌词大小（NBFX.lyricScale）：字号 × s；调小时框也缩，调大时放宽两行 / 三行的高度上限
        var us = NBFX.lyricScale ? NBFX.lyricScale() : 1, box = Math.min(1, us);
        return smartLayout(text, {
          maxW: Math.min(W * 0.86, W - 2 * 110) * box, maxFs: Math.min(H * (len <= 5 ? 0.2 : 0.18), W * 0.14) * us,
          maxH2: Math.min(H * 0.26 * us, H * 0.4), maxH3: Math.min(H * 0.32 * us, H * 0.5), minSingle: H * 0.085 * us, min2: H * 0.07 * us,
          weight: 900, family: NBFX.fonts.sans, spacing: lat ? 0 : 0.02, lh: 1.16
        });
      }
      function build(key, text, sub, isTitle) {
        var L = fitMain(text), fs = L.size;
        var maxW = L.boxWidth;
        var subL = null;
        if (sub) {
          var ss = M.clamp(H * 0.024, 13, 28) * M.clamp(NBFX.lyricScale ? NBFX.lyricScale() : 1, 0.75, 1.3);
          subL = isTitle
            ? NBFX.text.layout(sub, { maxWidth: maxW, size: Math.round(ss * 0.72), minSize: 10, weight: 500, family: NBFX.fonts.mono, spacing: 0.42, lineHeight: 1.3, maxLines: 1 })
            : NBFX.text.layout(sub, { maxWidth: maxW, size: Math.round(ss), minSize: 11, weight: 500, family: NBFX.fonts.sans, spacing: 0.06, lineHeight: 1.3, maxLines: 2 });
        }
        var pad = Math.ceil(fs * 0.08 + 10);
        var subGap = subL ? fs * (isTitle ? 0.34 : 0.28) : 0;
        var mainH = L.height, subY = mainH + subGap;
        var totH = subL ? subY + subL.height : mainH;
        var wCss = maxW + pad * 2, hCss = totH + pad * 2;
        var s = Math.min(dpr, maxTex / wCss, maxTex / hCss);
        var cw = pow2(Math.ceil(wCss * s)), ch = pow2(Math.ceil(hCss * s));
        var sw = M.clamp(fs * 0.011, 1.2, 2.6), blur = Math.max(3, fs * 0.05);
        // 画：R=实心 G=描边 B=柔光
        paintCv.width = cw; paintCv.height = ch;
        var c = paintCtx;
        c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.filter = 'none';
        c.fillStyle = '#000'; c.fillRect(0, 0, cw, ch);
        c.setTransform(s, 0, 0, s, pad * s, pad * s);
        c.globalCompositeOperation = 'lighter'; c.textBaseline = 'alphabetic';
        c.font = NBFX.text.fontCss(L.size, L.weight, L.family);
        c.filter = 'blur(' + (blur * s).toFixed(1) + 'px)'; c.fillStyle = 'rgb(0,0,255)';
        L.chars.forEach(function (q) { if (q.ch !== ' ') c.fillText(q.ch, q.x, q.baseline); });
        c.filter = 'none'; c.fillStyle = 'rgb(255,0,0)';
        L.chars.forEach(function (q) { if (q.ch !== ' ') c.fillText(q.ch, q.x, q.baseline); });
        c.strokeStyle = 'rgb(0,255,0)'; c.lineWidth = sw; c.lineJoin = 'round';
        L.chars.forEach(function (q) { if (q.ch !== ' ') c.strokeText(q.ch, q.x, q.baseline); });
        if (subL) {
          c.font = NBFX.text.fontCss(subL.size, subL.weight, subL.family); c.fillStyle = 'rgb(255,0,0)';
          subL.chars.forEach(function (q) { if (q.ch !== ' ') c.fillText(q.ch, q.x, subY + q.baseline); });
        }
        c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
        var tex = G.texture(gl, paintCv, { mipmap: true });
        paintCv.width = paintCv.height = 1;   // 画完就还掉这块大画布
        // 四边形：同一行里相邻字的格子首尾相接（不重叠，柔光不会叠两遍）
        var v = [], n = text.length, grp = new Array(n);
        function uv(x, y) { return [(x + pad) * s / cw, (y + pad) * s / ch]; }
        function quad(x0, y0, x1, y1, ci, cx0, cw0, ccx, ccy) {
          var lx0 = (x0 - cx0) / Math.max(1, cw0), lx1 = (x1 - cx0) / Math.max(1, cw0);
          var u0 = uv(x0, y0), u1 = uv(x1, y1);
          var P = [[x0, y0, u0[0], u0[1], lx0], [x1, y0, u1[0], u0[1], lx1], [x0, y1, u0[0], u1[1], lx0], [x0, y1, u0[0], u1[1], lx0], [x1, y0, u1[0], u0[1], lx1], [x1, y1, u1[0], u1[1], lx1]];
          P.forEach(function (p) { v.push(p[0], p[1], p[2], p[3], ci, p[4], ccx, ccy); });
        }
        var lhPx = L.size * L.lineHeight, cells = [];
        L.rows.forEach(function (r, ri) {
          var top = ri === 0 ? -pad : r.y - L.size * 0.03, bot = ri === L.rows.length - 1 ? L.height + pad : r.y + lhPx - L.size * 0.03;
          r.chars.forEach(function (q, k) {
            var prev = r.chars[k - 1], next = r.chars[k + 1];
            var x0 = prev ? (prev.x + prev.w + q.x) / 2 : r.x - pad;
            var x1 = next ? (q.x + q.w + next.x) / 2 : r.x + r.width + pad;
            quad(x0, top, x1, bot, q.i, q.x, q.w, q.x + q.w / 2, r.y + L.size * 0.5);
            cells.push([q.i, x0, x1, Math.max(0, top), Math.min(L.height, bot)]);
          });
        });
        if (subL) quad(-pad * 0.5, subY - 4, maxW + pad * 0.5, subY + subL.height + pad * 0.5, -1, 0, 1, maxW / 2, subY + subL.height / 2);
        // 英文按单词点亮回声（一个词一起亮），中文按字
        var start = 0;
        for (var i = 0; i < n; i++) { if (i === 0 || text[i - 1] === ' ' || !/[A-Za-z0-9'’]/.test(text[i]) || !/[A-Za-z0-9'’]/.test(text[i - 1])) start = i; grp[i] = start; }
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
        return { key: key, text: text, n: n, tex: tex, buf: buf, count: v.length / 8, fs: fs, boxW: maxW, mainH: mainH, subH: subL ? subGap + subL.height : 0, isTitle: isTitle, grp: grp, cells: cells, nr: L.rows.length, tw: L.width };
      }
      function freeRes(r) { if (!r) return; gl.deleteTexture(r.tex); gl.deleteBuffer(r.buf); }
      function getRes(key, text, sub, isTitle) {
        for (var i = 0; i < cache.length; i++) if (cache[i].key === key) { var r = cache[i]; cache.splice(i, 1); cache.push(r); return r; }
        var nr = build(key, text, sub, isTitle);
        cache.push(nr);
        while (cache.length > 4) { var old = cache.shift(); if (old === shown) { cache.push(old); if (cache.length <= 4) break; continue; } freeRes(old); }
        return nr;
      }
      function clearCache() { cache.forEach(freeRes); cache = []; shown = null; }

      /* ---------- 状态 ---------- */
      var shown = null, shownIdx = -2, spread = 0, spreadV = 0;
      var sungT = new Float32Array(MAXC), ping = [-99, 0], lastPing = -99, rips = new Float32Array(12), ripN = 0;
      for (var z = 0; z < 12; z++) rips[z] = z % 4 === 2 ? -99 : 0;
      var cam = [W / 2, H / 2], camT = [W / 2, H / 2], ptr = { x: -1, y: -1, inside: false, lastMove: -9 };
      var palDark = [0.05, 0.05, 0.05], palMid = [0.2, 0.2, 0.2], palSec = [0.5, 0.5, 0.5], palInit = false;
      var time = 0, lastHud = -1, bpmKicks = [], bpmVal = 0, lastKickT = -9, lastRender = -1, lastSwapT = -9, prebuilt = true, keepSpread = false;
      var blockCtr = [W / 2, H / 2], offU = [0], offD = [0], bgRot = 0, bgRotV = 0.035;

      function keyFor(f) {
        var ly = f.lyric;
        // 提前一点点换：换行动画做完时，新的一行正好开唱
        var nx = ly.idx >= 0 ? ly.next : (ly.lines && ly.lines.length ? ly.lines[0] : null);
        if (nx && nx.text && f.playing && nx.t - (f.track.position || 0) < LEAD && nx.t - (f.track.position || 0) > -0.05) {
          var ni = ly.idx + 1;
          return { key: 'L' + ni + ':' + nx.text, text: norm(nx.text), sub: nx.translation || '', title: false, idx: ni };
        }
        if (ly.idx >= 0 && ly.line) return { key: 'L' + ly.idx + ':' + ly.line.text, text: norm(ly.line.text), sub: ly.line.translation || '', title: false, idx: ly.idx };
        var t = ly.fallback || f.track.title || 'Not Blind';
        var sub = [f.track.artist, f.track.album].filter(Boolean).join(' · ');
        return { key: 'T:' + t + '|' + sub, text: norm(t), sub: sub, title: true, idx: -1 };
      }
      function resetSung(cp, res) {
        for (var i = 0; i < MAXC; i++) sungT[i] = NEVER;
        if (!res) return;
        for (var j = 0; j < Math.min(MAXC, res.n); j++) if (cp >= res.grp[j] + 0.35) sungT[j] = LONGAGO;
      }
      function curCP(f) {
        if (!shown) return 0;
        if (shown.isTitle) return shown.n + 1;
        if (shownIdx > f.lyric.idx) return 0;   // 提前亮出来的下一行：还没开唱
        if (shownIdx === f.lyric.idx && f.lyric.line && shown.key === 'L' + f.lyric.idx + ':' + f.lyric.line.text) return f.lyric.held ? shown.n + 1 : f.lyric.charPos;
        return shown.n + 1;   // 旧行：全部唱完
      }
      function addRipple(x, y, amp) {
        var i = (ripN++ % 3) * 4;
        rips[i] = x; rips[i + 1] = y; rips[i + 2] = time; rips[i + 3] = amp;
      }

      /* ---------- 每帧 ---------- */
      function frame(f) {
        var dt = Math.min(0.05, f.dt || 0.016);
        time += dt;
        if (typeof document !== 'undefined' && document.hidden) return;
        var au = f.audio, P = f.palette;
        // 调色：平滑追随封面色
        if (!palInit) { palDark = P.darkRgb.slice(); palMid = P.midRgb.slice(); palSec = P.secondaryRgb.slice(); palInit = true; }
        dampArr(palDark, P.darkRgb, 1.6, dt); dampArr(palMid, P.midRgb, 1.6, dt); dampArr(palSec, P.secondaryRgb, 1.6, dt);
        setCover(f.cover);
        covMix = Math.min(1, covMix + dt / 1.6);
        bgRotV = M.damp(bgRotV, f.playing ? 0.035 : 0.01, 1.5, dt); bgRot += bgRotV * dt;   // 封面慢慢转；暂停时慢下来（不跳）
        // BPM：踢鼓间隔的中位数（折到 70–180）
        if (au.kick) {
          if (time - lastKickT < 2.2) { var iv = time - lastKickT; var b = 60 / iv; while (b < 70) b *= 2; while (b > 180) b /= 2; bpmKicks.push(b); if (bpmKicks.length > 24) bpmKicks.shift(); }
          lastKickT = time;
          if (bpmKicks.length >= 6) {
            var srt = bpmKicks.slice().sort(function (a, c) { return a - c; }), med = srt[srt.length >> 1], sum = 0, cnt = 0;
            srt.forEach(function (v) { if (Math.abs(v - med) < med * 0.06) { sum += v; cnt++; } });
            bpmVal = cnt ? sum / cnt : med;
          }
        }

        // 歌词 → 目标
        var want = keyFor(f);
        var pending = !shown || shown.key !== want.key;
        var target = pending ? 0 : 1;
        var om = pending ? 17 : 6.2;                    // 收拢快、荡开慢（临界阻尼弹簧）
        var acc = om * om * (target - spread) - 2 * om * spreadV;
        spreadV += acc * dt; spread += spreadV * dt;
        if (spread < 0) { spread = 0; spreadV = Math.max(0, spreadV); }
        if (spread > 1.02) { spread = 1.02; spreadV = Math.min(0, spreadV); }
        if (pending && (spread < 0.05 || !shown)) {
          var quiet = keepSpread && !shown;          // 窗口尺寸变了：原地重排，不重播换行动画
          keepSpread = false;
          shown = getRes(want.key, want.text, want.sub, want.title);
          shownIdx = want.idx;
          if (quiet) { pending = false; spread = Math.max(spread, 0.999); spreadV = 0; }
          else { spread = Math.min(spread, 0.05); spreadV = 0; }
          resetSung(want.title ? 999 : (f.lyric.idx === want.idx ? f.lyric.charPos : 0), shown);
          if (want.title) for (var q = 0; q < MAXC; q++) sungT[q] = LONGAGO;
          if (!quiet) { ping[0] = time + 0.1; ping[1] = 0.32; lastPing = time; lastSwapT = time; }
          prebuilt = false;
        }
        // 荡开之后，趁空把下一行的纹理先画好（换行时不卡）
        if (!pending && !prebuilt && spread > 0.95 && time - lastSwapT > 0.6) {
          prebuilt = true;
          var ni = shownIdx + 1, nx = f.lyric.lines && f.lyric.lines[ni];
          if (nx && nx.text) getRes('L' + ni + ':' + nx.text, norm(nx.text), nx.translation || '', false);
        }
        var cp = curCP(f);
        // 逐字点亮时间（英文按词）
        if (shown && !pending) {
          for (var ci = 0; ci < Math.min(MAXC, shown.n); ci++) {
            var gs = shown.grp[ci];
            if (sungT[ci] === NEVER && cp >= gs + 0.35) sungT[ci] = time;
            else if (sungT[ci] !== NEVER && cp < gs + 0.2 && !shown.isTitle && time - sungT[ci] > 1.5) sungT[ci] = NEVER;   // 往回拖（点出来的那一下先让它亮完）
          }
        }
        // 待机：前奏标题态 / 间奏 / 暂停 —— 每隔几秒一道安静的回声
        var idle = !f.playing || (shown && shown.isTitle) || f.lyric.held;
        var idleGap = f.playing ? 4.6 : 6.5;
        if (idle && !pending && spread > 0.9 && time - lastPing > idleGap) { ping[0] = time; ping[1] = f.playing ? 0.42 : 0.3; lastPing = time; }

        // 相机：鼠标视差 + 很慢的漂移
        var cx0 = W / 2, cy0 = blockCtr[1];
        var px = ptr.inside && time - ptr.lastMove < 8 ? (ptr.x / W - 0.5) : 0, py = ptr.inside && time - ptr.lastMove < 8 ? (ptr.y / H - 0.5) : 0;
        camT[0] = cx0 + px * W * 0.14 + Math.sin(time * 0.13) * W * 0.012;
        camT[1] = cy0 + py * H * 0.12 + Math.cos(time * 0.11) * H * 0.012;
        cam[0] = M.damp(cam[0], camT[0], 2.2, dt); cam[1] = M.damp(cam[1], camT[1], 2.2, dt);

        // 暂停且静止时少画几帧
        var still = !f.playing && !pending && spread > 0.98 && time - ping[0] > 3 && time - rips[2] > 3 && time - rips[6] > 3 && time - rips[10] > 3;
        if (still && time - lastRender < 1 / 24) { updHud(f); return; }
        lastRender = time;
        render(f, cp, au);
        updHud(f);
      }

      function render(f, cp, au) {
        var cw = cv.width, ch = cv.height;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, cw, ch);
        gl.disable(gl.BLEND);
        var tl = Math.max(0.05, 0.2126 * palMid[0] + 0.7152 * palMid[1] + 0.0722 * palMid[2]);
        var tint = [palMid[0] / tl, palMid[1] / tl, palMid[2] / tl].map(function (v) { return Math.min(2.2, v); });
        var glow = desat([palMid[0] * 0.7 + palSec[0] * 0.3, palMid[1] * 0.7 + palSec[1] * 0.3, palMid[2] * 0.7 + palSec[2] * 0.3], 0.8);
        G.use(pBg, {
          uC0: { tex: covTex[1 - covFront], unit: 0 }, uC1: { tex: covTex[covFront], unit: 1 }, uMix: covMix,
          uRot: bgRot, uTime: time, uBass: au.bass, uTreb: au.treble,
          uRes: [W, H], uCtr: blockCtr, uMatte: MATTE, uGlow: glow, uInk: INK, uTint: tint
        });
        if (shown) {   // 主块背后一层很淡的暗底，让它一眼就是最前面那一层
          gl.uniform4f(pBg.u.uScrim, W / 2, blockCtr[1], shown.tw / 2 + shown.fs * 0.15, (shown.mainH + shown.subH) / 2);
          gl.uniform1f(pBg.u.uScrimA, 0.26 * M.clamp(spread, 0, 1));
        } else gl.uniform1f(pBg.u.uScrimA, 0);
        gl.uniform4fv(pBg.u.uRip, rips);
        gl.uniform1f(pBg.u.uRipOn, (time - rips[2] < 2.7 || time - rips[6] < 2.7 || time - rips[10] < 2.7) ? 1 : 0);
        G.drawQuad(gl);
        if (!shown) return;

        // 文字层
        var r = shown;
        var sp = M.clamp(spread, 0, 1.02);
        var ox = Math.round((W / 2 - r.boxW / 2) * dpr) / dpr;
        var cy = (H - 110) * 0.49 + 6;
        var oy = Math.round((cy - (r.mainH + r.subH) / 2) * dpr) / dpr;   // 主行 + 译文 整块居中
        blockCtr[0] = W / 2; blockCtr[1] = cy;
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(pTx.p);
        gl.bindBuffer(gl.ARRAY_BUFFER, r.buf);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
        gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 32, 8);
        gl.enableVertexAttribArray(aInfo); gl.vertexAttribPointer(aInfo, 4, gl.FLOAT, false, 32, 16);
        var U = pTx.u;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.tex); gl.uniform1i(U.uTex, 0);
        gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uOrigin, ox, oy);
        var D = H * 1.25, gapZ = D * 0.24;     // 每往后一层约缩到 0.8 倍（朝画面中心的透视）
        gl.uniform3f(U.uCam, cam[0], cam[1], D);
        gl.uniform1f(U.uTime, time); gl.uniform1f(U.uDelay, 0.095);
        gl.uniform1fv(U.uSung, sungT);
        gl.uniform4fv(U.uRip, rips);
        gl.uniform2f(U.uPing, ping[0], ping[1]);
        gl.uniform1f(U.uCP, cp);
        gl.uniform3fv(U.uInk, INK); gl.uniform3fv(U.uHot, HOT);
        var haze = [M.lerp(INK[0], palSec[0], 0.22), M.lerp(INK[1], palSec[1], 0.22), M.lerp(INK[2], palSec[2], 0.22)];
        gl.uniform3fv(U.uHaze, haze);
        gl.uniform2f(U.uFade, H * 0.03, H - 110 - H * 0.01);
        gl.uniform4f(U.uBand, oy - r.fs * 0.02, oy + r.mainH + r.subH, r.fs * 0.05, 0.92);
        // 回声层 = 整块歌词的复制：一整块一整块往外排，块与块之间留出明显的空（比行距大得多），
        // 越往后越小、越淡、越糊；间距固定，不跟节拍。多行的块只显示 1–2 层。
        var nVis = r.nr >= 3 ? 1 : r.nr === 2 ? 2 : NE;
        var halfH = r.mainH / 2, G0 = Math.max(r.fs * (r.nr > 1 ? 0.6 : 0.45), H * 0.042), acc = (r.mainH + r.subH) / 2 + G0;
        for (var kk = 1; kk <= NE; kk++) {
          var sk = D / (D + kk * gapZ), cc = acc + sk * halfH;
          offU[kk] = -cc / sk + r.subH / 2; offD[kk] = cc / sk + r.subH / 2;
          acc = cc + sk * (halfH + G0);
        }
        var held = f.lyric.held && !r.isTitle;
        var echoA = held ? 0.8 : 1;
        var mainZ = -H * 0.05 * (1 - Math.min(1, sp));
        for (var k = nVis; k >= 1; k--) {
          for (var d = -1; d <= 1; d += 2) {
            var z = mainZ - k * gapZ * sp;
            var offY = (d > 0 ? offD[k] : offU[k]) * sp;
            var offX = (Math.sin(time * 0.31 + k * 1.3 + d * 0.9) * 0.7 + (k % 2 ? 0.5 : -0.5) * d) * k * 3.2 * sp;
            // 近的层先出现、远的层后出现（像声音一圈圈传出去），挤在一起的那一瞬间不显乱
            var a = 0.62 * Math.pow(0.64, k - 1) * echoA * M.smooth(0.3 + k * 0.07, 0.8 + k * 0.04, sp);
            gl.uniform3f(U.uLay, z, offX, offY);
            gl.uniform2f(U.uLay2, k, 0);
            gl.uniform4f(U.uLook, a, 0, 0.35 + k * 0.5, 1);
            gl.drawArrays(gl.TRIANGLES, 0, r.count);
          }
        }
        // 主行：收拢时先"空掉"成描边，换字后再被唱满
        var mainA = 0.38 + 0.62 * M.smooth(0.0, 0.4, sp);
        var fillMul = M.smooth(0.08, 0.7, sp);
        gl.uniform3f(U.uLay, mainZ, 0, 0);
        gl.uniform2f(U.uLay2, 0, 1);
        gl.uniform4f(U.uLook, mainA * (held ? 0.92 : 1), 1, 0, fillMul);
        gl.drawArrays(gl.TRIANGLES, 0, r.count);
        gl.disableVertexAttribArray(aUV); gl.disableVertexAttribArray(aInfo);
        gl.disable(gl.BLEND);
      }

      var lastTitle = '', lastArtist = '';
      function updHud(f) {
        if (time - lastHud < 0.066) return;
        lastHud = time;
        tcEl.textContent = 'TC ' + tc(f.track.position);
        bpmEl.textContent = (bpmVal ? Math.round(bpmVal) : '—') + ' BPM · ' + (f.track.source || '本地');
        if (f.track.title !== lastTitle) { lastTitle = f.track.title; npT.textContent = f.track.title || ''; }
        var ar = [f.track.artist, f.track.album].filter(Boolean).join(' · ');
        if (ar !== lastArtist) { lastArtist = ar; npA.textContent = ar; }
      }

      // 网络字体晚到时：原地重画一遍文字纹理
      function onFonts() { keepSpread = !!shown && spread > 0.9; clearCache(); }
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onFonts);

      return {
        resize: function (w, h, d) {
          W = w; H = h; dpr = Math.min(1.5, d || 1);
          cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
          keepSpread = !!shown && spread > 0.9;
          clearCache();
          blockCtr = [W / 2, (H - 110) * 0.49 + 6];
          cam = [W / 2, blockCtr[1]];
        },
        frame: frame,
        pointer: function (type, x, y) {
          ptr.x = x; ptr.y = y; ptr.inside = true; ptr.lastMove = time;
          if (type === 'down') {
            addRipple(x, y, 1);
            // 点中主行里的字：这个字再传一次回声
            if (shown && !shown.isTitle) {
              var ox = W / 2 - shown.boxW / 2, oy = blockCtr[1] - (shown.mainH + shown.subH) / 2;
              var lx0 = x - ox, ly0 = y - oy;
              shown.cells.forEach(function (c) {
                if (lx0 >= c[1] && lx0 < c[2] && ly0 >= c[3] && ly0 < c[4] && c[0] < MAXC) sungT[c[0]] = time;   // 点中的字：它的回声再传一遍
              });
            }
          }
        },
        destroy: function () {
          if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', onFonts);
          clearCache();
          try { gl.deleteTexture(covTex[0]); gl.deleteTexture(covTex[1]); gl.deleteProgram(pBg.p); gl.deleteProgram(pTx.p); } catch (e) {}
          G.destroy(gl);
          if (hud.parentNode) hud.parentNode.removeChild(hud);
          if (cv.parentNode) cv.parentNode.removeChild(cv);
          paintCv.width = paintCv.height = 0; covCv.width = covCv.height = 0;
        }
      };
    }
  });
})();
} catch (nbLyricFxLoadErr) { try { console.error("[平面歌词] 载入失败：回声 · 回声大字 (echo-type)", nbLyricFxLoadErr); } catch (_e) { } }

/* ------------------------------------------------------------
 * 午后窗影 · 光斑 (window-komorebi)
 * ------------------------------------------------------------ */
try {
/* ============================================================
 * 窗影 · 光斑 SUNLIT WALL  (window-komorebi.js)
 * 午后的灰泥墙：倾斜的窗格光斑 + 摇曳的树叶影子 + 光束里的灰尘。
 * 歌词用衬线大字"写在墙上"，和墙一起被同一束光照亮（凹刻 + 墨色）。
 * 一小块水杯反光（焦散光斑）跟着唱到的字走；已唱的字墨色洇深。
 * 换行：一片云遮住太阳，旧字的墨退回墙里 → 换字 → 阳光回来，新墨渗出。
 * 渲染：墙面法线/反照率只在 resize 时烘焙；窗光+树叶在半分辨率算；
 *       合成在全分辨率（文字清晰），文字纹理只在换行时重画。
 * ============================================================ */
(function () {
  'use strict';
  var NBFX = window.NBFX;
  if (!NBFX) return;
  var M = NBFX.math, C = NBFX.color, TX = NBFX.text, G = NBFX.gl;

  /* ---------------- 着色器 ---------------- */
  var NOISE = [
    'float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),u.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x),u.y);}',
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}'
  ].join('\n');

  // 墙面烘焙：RG=法线 B=凹坑(cavity) A=反照率起伏。p 以 CSS 像素/900 为单位，颗粒大小与分辨率无关
  var FS_BAKE = [
    'precision highp float;uniform vec2 uRes;uniform float uScale;', NOISE,
    'float Hh(vec2 p){',
    '  vec2 w=vec2(fbm(p*1.1+1.3),fbm(p*1.1+7.7));',
    '  float broad=fbm(p*2.2+w*1.4);',
    '  float trowel=fbm(vec2(p.x*6.+w.x*5.,p.y*3.6+w.y*4.));',
    '  float sweep=fbm(rot(.5)*p*vec2(14.,3.)+w*3.);',
    '  float fine=vn(p*190.)*.45+vn(p*420.)*.55;',
    '  float pits=smoothstep(.84,.95,vn(p*260.+3.7));',
    '  return broad*.010+trowel*.0050+sweep*.0020+fine*.00012-pits*.00008;}',
    'void main(){',
    '  vec2 p=gl_FragCoord.xy/uScale/900.; float e=1./(uScale*900.);',
    '  float h=Hh(p),hx=Hh(p+vec2(e,0.)),hy=Hh(p+vec2(0.,e));',
    '  vec2 n=-(vec2(hx-h,hy-h)/e);',
    '  vec2 r1=rot(.6)*p, r2=rot(-.95)*p;',
    '  float fib=smoothstep(.88,.98,vn(vec2(r1.x*520.,r1.y*34.)))+smoothstep(.88,.98,vn(vec2(r2.x*520.,r2.y*34.)+9.));',
    '  float alb=.5+(fbm(p*2.6+4.)-.5)*.45+(vn(p*60.)-.5)*.08-fib*.18;',
    '  float cav=clamp(.5+(vn(p*150.)-.5)*.7-smoothstep(.80,.93,vn(p*210.+3.7))*.45,0.,1.);',
    '  gl_FragColor=vec4(clamp(n*.5+.5,0.,1.),cav,clamp(alb,0.,1.));}'
  ].join('\n');

  // 窗光（半分辨率）：R=阳光可见度(窗格×树叶×树枝×云) G=窗口外扩的柔光(雾气/反射) B=窗框本身
  var FS_LIGHT = [
    'precision highp float;',
    'uniform vec2 uRes;uniform float uPh,uW,uCanopy,uCloud,uCloudT,uAsp;',
    'uniform vec2 uO,uSq,uUV;uniform vec4 uWi;uniform vec4 uGust;uniform vec2 uCss;uniform vec4 uMo[16];',
    NOISE,
    'float sband(float x,float c,float w,float s){return smoothstep(c-w-s,c-w+s,x)*(1.-smoothstep(c+w-s,c+w+s,x));}',
    'float winM(vec2 q,vec2 s){',
    '  s*=mix(.65,1.6,clamp(q.y,0.,1.));',
    '  vec2 a=smoothstep(-s,s,q)*smoothstep(-s,s,1.-q); float m=a.x*a.y;',
    '  if(m<.001) return 0.;',
    '  m*=1.-sband(q.x,.5,.021,s.x);',
    '  m*=1.-sband(q.y,.66,.018,s.y);',
    '  float up=smoothstep(.64,.68,q.y);',
    '  m*=1.-sband(q.x,.25,.007,s.x)*up; m*=1.-sband(q.x,.75,.007,s.x)*up;',
    '  m*=1.-sband(q.y,.33,.007,s.y)*(1.-up);',
    '  return m;}',
    'float leafS(vec2 p,float len,float wid,float e){float x=p.x/len; if(x<0.||x>1.) return 0.; float hw=wid*pow(sin(3.14159*pow(x,.75)),.9)*(1.-.2*x); return 1.-smoothstep(hw-e,hw+e,abs(p.y));}',
    'float twig(vec2 z,float ph,float w){',
    '  vec2 base=vec2(uUV.x*1.03,uUV.y*1.06);',
    '  float sw=sin(ph*1.2)*(.025+.07*w)+sin(ph*2.7+1.)*.012*(.3+w);',
    '  if(length(z-base)>.5) return 0.;',
    '  vec2 d=rot(sw)*(z-base); vec2 dir=normalize(vec2(-.82,-.5)); float e=.0045+.004*w;',
    '  float t=clamp(dot(d,dir),0.,.40); float bwid=mix(.0045,.0012,t/.40);',
    '  float m=1.-smoothstep(bwid-e*.4,bwid+e,length(d-dir*t));',
    '  float ba=atan(dir.y,dir.x);',
    '  for(int i=0;i<8;i++){float fi=float(i); float tt=.05+fi*.047; vec2 c=dir*tt;',
    '    float side=mod(fi,2.)*2.-1.;',
    '    float ang=ba+side*(.8+.18*sin(fi*3.1))+sin(ph*(1.9+fi*.37)+fi*1.3)*.13*(.25+w);',
    '    vec2 lp=rot(-ang)*(d-c);',
    '    m=max(m,leafS(lp,.05+.014*sin(fi*1.7+1.),.0155+.003*cos(fi),e));}',
    '  return m;}',
    'float leaves(vec2 q,float ph,float w){',
    '  float cov=smoothstep(.05,.85,q.x*.6+q.y*.75+uCanopy);',
    '  vec2 sway=vec2(sin(ph*1.1+q.y*2.3)+.5*sin(ph*2.3+q.x*4.),cos(ph*.9+q.x*1.7))*(.008+.022*w);',
    '  vec2 z=q*uUV;',
    '  float n=fbm(z*vec2(5.2,5.2)+sway*4.+vec2(0.,ph*.02));',
    '  float gap=smoothstep(.50,.64,n+(1.-cov)*.45);',
    '  float fl=0.;',
    '  for(int L=0;L<2;L++){ float sc=L==0?24.:15.; vec2 g=rot(.7+float(L)*1.9)*z*sc+sway*(12.+float(L)*4.)+float(L)*13.7; vec2 id=floor(g),f=fract(g);',
    '  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j));vec2 c=id+o+float(L)*31.;',
    '    float h=h12(c),h2=h12(c+17.3),h3=h12(c+5.1);',
    '    vec2 pt=o+.5+(vec2(h3,h2)-.5)*.5+.22*vec2(sin(h*6.28+ph*(.5+h2)),cos(h2*6.28+ph*(.4+h)))*(.3+.7*w);',
    '    float r=(.16+.24*h2)*(L==0?1.:.8); float d=length(f-pt);',
    '    float disc=(1.-smoothstep(r*.3,r,d))*(.8+.2*smoothstep(r*.9,r*.5,d));',
    '    fl=max(fl,disc*step(L==0?.55:.72,h)*(.45+.55*h3));}}',
    '  float sh=mix(1.,gap*.92+.04,cov);',
    '  return max(sh,fl*cov*.95);}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uRes;',
    '  mat2 Wi=mat2(uWi.x,uWi.y,uWi.z,uWi.w);',
    '  vec2 q=Wi*(uv-uO);',
    // 阵风：从点击处扩散开的一圈，经过的地方叶子被吹得更乱
    '  float gw=0.;',
    '  if(uGust.w>.001){ float r=length((uv-uGust.xy)*vec2(uAsp,1.)); gw=uGust.w*exp(-pow((r-uGust.z)/.26,2.)); }',
    '  float w=uW+gw*1.7, ph=uPh+gw*1.6;',
    '  vec2 soft=uSq*(1.+uCloud*2.4);',
    '  float win=winM(q,soft); float vis=win;',
    '  if(win>.001){ vis*=leaves(q,ph,w); vis*=1.-twig(q*uUV,ph,w)*.9; }',
    // 云遮日：光变散，影子变淡、变软
    '  vis=mix(vis,win*.72,uCloud*.55);',
    '  vec2 sq=uSq*7.; vec2 aa=smoothstep(-sq,sq,q)*smoothstep(-sq,sq,1.-q); float glow=aa.x*aa.y;',
    '  float cl=1.-uCloud*(.58+.42*fbm(uv*vec2(1.6*uAsp,1.6)+vec2(uCloudT*.32,uCloudT*.07)));',
    // 光束里的灰尘（虚焦的小亮点），在半分辨率里算更省
    '  vec2 p=vec2(uv.x,1.-uv.y)*uCss; float mo=0.;',
    '  for(int i=0;i<16;i++){ vec4 m=uMo[i]; if(m.w>.002){ float d=length(p-m.xy); float r=m.z;',
    '    mo+=m.w*(1.-smoothstep(r*.45,r,d))*(.72+.28*smoothstep(r,r*.6,d)); } }',
    '  gl_FragColor=vec4(vis*cl,glow*cl,mo,1.);}'
  ].join('\n');

  // 合成（全分辨率）：墙 + 墨字（凹刻法线 + 已唱/未唱）+ 阳光/天光/台灯/反光焦散 + 灰尘 + 胶片颗粒
  var FS_COMP = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform vec2 uCss;uniform float uT;',
    'uniform sampler2D uBake,uLight,uInk;',
    'uniform vec4 uInkR;uniform vec2 uInkPx;uniform float uCharN,uCharPos,uInkVis,uHasInk,uRelief;',
    'uniform vec3 uSunC,uSkyC,uLampC,uL,uInkC,uSpotC,uWallC;',
    'uniform float uSunI,uAmb,uLampI,uHaze,uFill,uExpo;',
    'uniform vec3 uLampP;uniform vec4 uSpot;uniform float uSpotPh;',
    'float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    // 水面焦散（经典可平铺写法的精简版）
    'float caus(vec2 p,float t){',
    '  vec2 i=p; float c=1.; float inten=.0065;',
    '  for(int n=0;n<4;n++){ float tt=t*(1.-(3.5/float(n+1)));',
    '    i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));',
    '    c+=1./length(vec2(p.x/(sin(i.x+tt)/inten),p.y/(cos(i.y+tt)/inten))); }',
    '  c/=4.; c=1.17-pow(c,1.4); return clamp(pow(abs(c),7.),0.,2.);}',
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}',
    // 一块水杯反光：边缘不规则地轻轻晃，边上一圈亮，里面是水波焦散的亮纹
    'vec2 spotS(vec2 d,float t){',
    '  d+=.06*vec2(sin(d.y*3.1+t*1.3),cos(d.x*2.7-t*1.1));',
    '  float r=length(d); float a=atan(d.y,d.x);',
    '  float edge=.92+.06*sin(a*3.+t*.9)+.03*sin(a*5.-t*1.4);',
    '  float env=1.-smoothstep(edge*.35,edge,r);',
    '  float net=caus(d*3.0+vec2(-250.),t);',
    '  float ln=smoothstep(.12,.62,net)*(.7+.4*sin(a+2.2));',
    '  return vec2(env,env*ln);}',
    'vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}',
    'void main(){',
    '  vec2 uv=vUv; vec2 p=vec2(uv.x,1.-uv.y)*uCss;',
    '  vec4 bk=texture2D(uBake,uv); vec3 n=vec3(bk.xy*2.-1.,1.);',
    '  vec4 lt=texture2D(uLight,uv); float vis=lt.r;',
    '  float inkA=0.,wet=0.,sungA=0.;',
    '  vec2 tuv=(p-uInkR.xy)/uInkR.zw;',
    '  if(uHasInk>.5&&tuv.x>0.&&tuv.x<1.&&tuv.y>0.&&tuv.y<1.){',
    '    vec4 ik=texture2D(uInk,tuv);',
    '    float gx=texture2D(uInk,tuv+vec2(uInkPx.x,0.)).g-texture2D(uInk,tuv-vec2(uInkPx.x,0.)).g;',
    '    float gy=texture2D(uInk,tuv-vec2(0.,uInkPx.y)).g-texture2D(uInk,tuv+vec2(0.,uInkPx.y)).g;',
    // 墨渗入/退回墙里：沿笔画中心 + 纸纹先后出现
    '    float qq=ik.g*.62+bk.w*.22+bk.z*.16+ik.r*.12;',
    '    float th=1.08-uInkVis*1.3;',
    '    float rev=smoothstep(th-.07,th+.07,qq);',
    '    float isMain=step(.6/255.,ik.b);',
    '    float P=(ik.b*255.-1.)*uCharN/253.;',
    '    float sk=smoothstep(P-.15,P+.5,uCharPos);',
    '    float sungK=mix(1.,sk,isMain);',
    '    float age=uCharPos-P;',
    '    float a=mix(.70,mix(.66,.98,sungK),isMain);',
    '    float bleed=isMain*sungK*smoothstep(0.,2.6,age)*smoothstep(.04,.55,ik.g)*(1.-ik.r)*(.07+.10*bk.w);',
    '    inkA=clamp(ik.r*a*(.88+.2*bk.z)+bleed,0.,1.)*rev;',
    '    sungA=isMain*sk*ik.r*rev;',
    '    wet=isMain*ik.r*(1.-smoothstep(0.,1.8,age))*step(-.2,age)*rev;',
    '    n.xy+=vec2(gx,gy)*uRelief*mix(1.,.5,sungK*isMain)*rev;',
    '  }',
    '  n=normalize(n);',
    '  vec3 L=normalize(uL); float ndl=max(dot(n,L),0.)/max(L.z,.18);',
    '  vec3 wallA=uWallC*(.94+.10*bk.w);',
    '  vec3 inkC=uInkC*(.9+.2*bk.w);',
    '  vec3 alb=mix(wallA,inkC,inkA);',
    '  float sp=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),18.)*inkA*(.05+wet*.35);',
    '  vec3 direct=uSunC*uSunI*vis*(ndl+sp*4.);',
    '  float cav=mix(.93,1.03,bk.z);',
    '  vec3 amb=uSkyC*uAmb*(.92+.08*n.y)*cav;',
    '  amb*=mix(1.,.84,smoothstep(.55,1.,uv.y))*mix(1.06,1.,smoothstep(0.,.35,uv.y));',
    '  amb+=uSunC*uSunI*lt.g*.05;',
    // 读字的"补光"：文字区域附近的墙略亮一点点（很淡，像对面白墙的反光）
    '  vec2 fc2=(p-(uInkR.xy+uInkR.zw*.5))/(uInkR.zw*.5+vec2(160.,120.));',
    '  amb+=uSkyC*uFill*exp(-dot(fc2,fc2)*1.6);',
    '  vec3 lamp=vec3(0.);',
    '  if(uLampI>.001){ vec2 lp=vec2(p.x-uLampP.x,uLampP.y-p.y); float D=uLampP.z; float rr=sqrt(lp.x*lp.x+D*D);',
    '    float edge=rr*.56; float lit=smoothstep(edge-6.,edge+90.,lp.y);',
    '    float fall=D*D*1.8/(dot(lp,lp)+D*D);',
    '    vec3 Ld=normalize(vec3(-lp,D*.8)); float nd=max(dot(n,Ld),0.)/max(Ld.z,.25);',
    '    lamp=uLampC*uLampI*(lit*fall*nd*1.5+fall*.18); }',
    // 水杯反光：跟着唱到的字走的一小块焦散亮斑
    '  vec3 spotL=vec3(0.),spotG=vec3(0.),dmod=vec3(1.);',
    '  if(uSpot.w>.002){ vec2 d=(p-uSpot.xy)/uSpot.z; d=rot(-.2)*d; d*=vec2(.8,1.2);',
    '    if(dot(d,d)<1.6){',
    '      vec2 s0=spotS(d*1.01,uSpotPh),s1=spotS(d,uSpotPh),s2=spotS(d*.988,uSpotPh);',
    '      vec3 ln=vec3(s0.y,s1.y,s2.y); float env=s1.x;',
    '      spotL=uSpotC*uSpot.w*(env*.2+ln*1.15)*(.55+.45*ndl)*(1.-inkA*.8);',
    // 在阳光里：焦散把光重新分配——包络里稍暗、亮纹更亮，所以在亮处也看得出
    '      dmod=1.-uSpot.w*env*.45+uSpot.w*ln*1.05*(1.-inkA*.6);',
    '      vec3 Ls=normalize(vec3(.25,-.7,.45)); float gl2=pow(max(dot(n,Ls),0.),6.);',
    '      spotG=uSpotC*uSpot.w*inkA*(env*.1+ln)*(.05+2.2*gl2); } }',
    '  vec3 col=alb*(direct*dmod+amb+lamp+spotL)+spotG*.35;',
    // 半影边缘的一点暖色（真实照片里阳光边缘偏暖）
    '  col+=alb*uSunC*uSunI*vis*(1.-vis)*vec3(.10,.035,-.03);',
    '  col+=uSunC*uSunI*uHaze*lt.g*.055;',
    '  col+=uSunC*lt.b;',
    '  float vg=uv.x*(1.-uv.x)*uv.y*(1.-uv.y)*16.; col*=mix(.62,1.,pow(clamp(vg,0.,1.),.3));',
    '  col=aces(col*uExpo); col=pow(col,vec3(1./2.2));',
    '  col+=(h12(gl_FragCoord.xy+fract(uT*7.)*91.)-.5)*.022;',
    '  gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  /* ---------------- 一天里的光（关键帧，沿用主页"午后窗影"） ----------------
   * 屏幕归一化坐标 y 向上。O=窗影左下角，U=沿窗宽，V=沿窗高。 */
  var KF = [
    { h: 0, sunC: [.52, .64, 1.0], sunI: .50, skyC: [.10, .12, .20], amb: .34, O: [.52, .44], U: [.30, .05], V: [.12, .44], L: [-.5, -.5, .55], soft: .016, lamp: 1, haze: .35, can: .05 },
    { h: 4.6, sunC: [.52, .64, 1.0], sunI: .40, skyC: [.12, .14, .22], amb: .34, O: [.52, .46], U: [.30, .05], V: [.12, .44], L: [-.5, -.5, .55], soft: .016, lamp: .75, haze: .3, can: .05 },
    { h: 6, sunC: [.95, .80, .74], sunI: .55, skyC: [.62, .63, .72], amb: .55, O: [.34, .34], U: [.52, .08], V: [.18, .52], L: [-.9, .3, .28], soft: .013, lamp: .15, haze: .9, can: 0 },
    { h: 7, sunC: [1.0, .89, .72], sunI: 1.30, skyC: [.74, .76, .83], amb: .58, O: [.30, .30], U: [.50, .07], V: [.16, .52], L: [-.85, .35, .32], soft: .013, lamp: 0, haze: .9, can: 0 },
    { h: 9.5, sunC: [1.0, .94, .85], sunI: 1.40, skyC: [.78, .77, .77], amb: .62, O: [.30, .24], U: [.44, .04], V: [.10, .46], L: [-.7, .5, .4], soft: .012, lamp: 0, haze: .7, can: .05 },
    { h: 13, sunC: [1.0, .94, .84], sunI: 1.55, skyC: [.79, .76, .72], amb: .62, O: [.27, .15], U: [.42, .03], V: [.07, .53], L: [-.45, .75, .45], soft: .011, lamp: 0, haze: .55, can: .08 },
    { h: 16, sunC: [1.0, .83, .60], sunI: 1.35, skyC: [.76, .70, .64], amb: .60, O: [.14, .16], U: [.62, .12], V: [.22, .40], L: [-.85, .3, .3], soft: .013, lamp: 0, haze: .9, can: .04 },
    { h: 18, sunC: [1.0, .55, .24], sunI: 1.25, skyC: [.60, .53, .48], amb: .54, O: [.02, .14], U: [.78, .16], V: [.30, .36], L: [-.95, .15, .22], soft: .016, lamp: 0, haze: 1.15, can: 0 },
    { h: 19.2, sunC: [.90, .42, .32], sunI: .22, skyC: [.30, .30, .44], amb: .45, O: [.20, .30], U: [.55, .12], V: [.22, .40], L: [-.8, .1, .3], soft: .016, lamp: .6, haze: .5, can: 0 },
    { h: 20.5, sunC: [.52, .64, 1.0], sunI: .44, skyC: [.11, .13, .21], amb: .34, O: [.52, .44], U: [.30, .05], V: [.12, .44], L: [-.5, -.5, .55], soft: .016, lamp: 1, haze: .35, can: .05 },
    { h: 24, sunC: [.52, .64, 1.0], sunI: .50, skyC: [.10, .12, .20], amb: .34, O: [.52, .44], U: [.30, .05], V: [.12, .44], L: [-.5, -.5, .55], soft: .016, lamp: 1, haze: .35, can: .05 }
  ];
  function mixv(a, b, t) { if (typeof a === 'number') return M.lerp(a, b, t); return a.map(function (x, i) { return M.lerp(x, b[i], t); }); }
  function lightAt(h) {
    h = ((h % 24) + 24) % 24; var i = 0;
    while (i < KF.length - 2 && KF[i + 1].h <= h) i++;
    var a = KF[i], b = KF[i + 1], t = (h - a.h) / (b.h - a.h); t = t * t * (3 - 2 * t);
    var o = {}; for (var k in a) { if (k !== 'h') o[k] = mixv(a[k], b[k], t); }
    return o;
  }

  var SERIF = NBFX.fonts.serif;
  var CN = '〇一二三四五六七八九';
  function cnNum(n) { n = Math.max(0, n | 0); if (n < 10) return CN[n]; if (n < 20) return '十' + (n % 10 ? CN[n % 10] : ''); if (n < 100) return CN[(n / 10) | 0] + '十' + (n % 10 ? CN[n % 10] : ''); return String(n); }
  function isLatin(s) { var l = 0, c = 0; for (var i = 0; i < s.length; i++) { if (/[A-Za-z]/.test(s[i])) l++; else if (TX.isCJK(s[i])) c++; } return l > c * 2; }

  /* 英文长句优先在逗号处折行（"Say it once, / it comes back twice"），其余交给底座的均衡折行 */
  function smartLayout(text, opts) {
    var L = TX.layout(text, opts);
    if (L.rows.length !== 2 || !isLatin(L.text)) return L;
    var t = L.text, m = /[,;:!?] /.exec(t);
    if (!m) return L;
    var cut = m.index + 2, ratio = cut / t.length;
    if (ratio < 0.25 || ratio > 0.75) return L;
    var o = {}; for (var k in opts) o[k] = opts[k];
    o.maxLines = 1; o.size = L.size;
    var a = TX.layout(t.slice(0, m.index + 1), o), b = TX.layout(t.slice(cut), o);
    var size = Math.min(a.size, b.size);
    if (size < L.size * 0.9) return L;
    o.size = size; o.minSize = size;
    a = TX.layout(t.slice(0, m.index + 1), o); b = TX.layout(t.slice(cut), o);
    var lh = size * L.lineHeight, chars = a.chars.slice();
    b.chars.forEach(function (c) { chars.push({ ch: c.ch, x: c.x, w: c.w, i: c.i + cut, row: 1, y: lh, baseline: lh + size * 0.88 }); });
    var r1 = b.rows[0]; r1 = { s: r1.s + cut, e: r1.e + cut, width: r1.width, chars: r1.chars, x: r1.x, y: lh, baseline: lh + size * 0.88 };
    return { text: t, size: size, weight: L.weight, family: L.family, spacing: L.spacing, lineHeight: L.lineHeight, style: L.style,
      rows: [a.rows[0], r1], chars: chars, width: Math.max(a.width, b.width), boxWidth: L.boxWidth, height: 2 * lh, ascent: size * 0.88 };
  }

  NBFX.register({
    id: 'window-komorebi', theme: 'window',
    name: '光斑', en: 'SUNLIT WALL',
    desc: '窗格光斑里，歌词写在墙上',
    hint: '点一下墙面：一阵风吹过窗外的树',
    icon: '<path d="M4 19 8.5 5H20l-4.5 14z"/><path d="M6.2 12h11.6M14.2 5l-4.5 14"/><path d="M15.5 17.5c1.8-.4 3.6-2 4-4.6-2.3.1-3.9 1.7-4 4.6z"/>',
    create: function (host) {
      var cv = NBFX.canvas(host, 'nbfx-window-komorebi');
      var gl = G.create(cv, { alpha: false, premultipliedAlpha: false });
      var W = host.width || innerWidth, H = host.height || innerHeight, dpr = host.dpr || 1;
      var rs = 1, bw = 2, bh = 2, lw = 2, lh = 2;
      var ctx2d = null, P_BAKE, P_LIGHT, P_COMP, bakeT = null, lightT = null, inkTex = null;
      var dead = false;

      if (gl) {
        try {
          P_BAKE = G.program(gl, null, FS_BAKE);
          P_LIGHT = G.program(gl, null, FS_LIGHT);
          P_COMP = G.program(gl, null, FS_COMP);
          inkTex = G.texture(gl, null);
        } catch (e) { console.warn('[window-komorebi] GL init failed', e); G.destroy(gl); gl = null; }
      }
      if (!gl) {
        // 兜底：没有 WebGL 时用 2D 画一面暖墙 + 字（保证可用）
        cv.remove(); cv = NBFX.canvas(host, 'nbfx-window-komorebi-2d'); ctx2d = cv.getContext('2d');
      }

      /* ---------- 状态 ---------- */
      var S = {
        hour: null, wind: .1, phase: 0, cloud: 0, cloudT: 0, t: 0,
        gust: null, spot: { x: W * .3, y: H * .45, vx: 0, vy: 0, a: 0, ph: 0 },
        pal: null, inkVis: 0, shownKey: null, shown: null, desired: null, fadeIn: false
      };
      var motes = []; (function () { var r = M.rng(11); for (var i = 0; i < 16; i++) motes.push({ x: r(), y: r(), d: r(), s: r(), o: r() * 6.28, vx: 0, vy: 0 }); })();
      var moBuf = new Float32Array(64);
      var inkCv = document.createElement('canvas'), inkCtx = inkCv.getContext('2d', { willReadFrequently: true }); // 放在内存里，上传纹理时不用从显卡读回
      var ink = null; // {rect:[x,y,w,h], px:[1/w,1/h], n, centers:[{x,y}], size}

      /* ---------- 文字内容 ---------- */
      function contentFor(idx, f) {
        var ly = f.lyric, lines = ly.lines || [];
        var tr = f.track || {};
        if (idx >= 0 && lines[idx]) {
          var line = lines[idx];
          var cap = (tr.artist || '') + ' · 《' + (tr.title || '') + '》 · ' + cnNum(idx + 1) + ' / ' + cnNum(lines.length);
          return { key: 'L' + idx + '|' + line.text, idx: idx, main: String(line.text || '').replace(/\s+/g, ' ').trim(), sec: line.translation || '', cap: cap, isLine: true };
        }
        var title = ly.fallback || tr.title || '';
        var sec = (tr.artist || '') + (tr.album ? ' · 《' + tr.album + '》' : '');
        return { key: 'T|' + title + '|' + sec, idx: -1, main: title, sec: sec, cap: lines.length ? '前 奏' : '纯 音 乐', isLine: false };
      }

      /* ---------- 文字纹理：R=字形 G=模糊字形(凹刻高度) B=逐字进度编码 ---------- */
      function buildInk(ct) {
        var u = Math.min(W / 1600, H / 900);
        var left = Math.max(56 + 40, Math.round(W * 0.08));
        var boxW = Math.max(280, W - left - Math.max(60, W * 0.1));
        var base = M.clamp(Math.min(W * 0.058, H * 0.104), 30, 156);
        var latin = isLatin(ct.main);
        var nChars = ct.main.length;
        // [二改] 歌词大小（NBFX.lyricScale）：字号 × s；调小时框也缩，调大时放宽高度上限
        var us = NBFX.lyricScale ? NBFX.lyricScale() : 1, box = Math.min(1, us);
        var size = base * (ct.isLine ? (nChars <= 7 ? 1.12 : 1) : 1.06) * us;
        var lay = smartLayout(ct.main || ' ', { maxWidth: boxW * box, maxHeight: Math.min(H * 0.4 * us, H * 0.52), size: size, minSize: Math.max(14, Math.max(20, base * 0.5) * us), weight: 500, family: SERIF, spacing: latin ? 0.01 : 0.06, lineHeight: latin ? 1.2 : 1.28, maxLines: 3, align: 'left' });
        var capSize = M.clamp(base * 0.16, 11, 22);
        var secSize = M.clamp(lay.size * 0.34, 14, 44);
        var capLay = ct.cap ? TX.layout(ct.cap, { maxWidth: boxW, size: capSize, minSize: 10, weight: 400, family: SERIF, spacing: 0.26, maxLines: 1, align: 'left' }) : null;
        var secLay = ct.sec ? TX.layout(ct.sec, { maxWidth: boxW, size: secSize, minSize: 12, weight: 400, family: SERIF, spacing: 0.1, lineHeight: 1.45, maxLines: 2, align: 'left' }) : null;
        var anchor = H * 0.47;
        var mainTop = anchor - lay.height / 2;
        var capTop = mainTop - capSize * 2.4;
        var secTop = mainTop + lay.height + secSize * 0.5;
        var bottom = secLay ? secTop + secLay.height : mainTop + lay.height;
        var maxBottom = H - 110 - 18;
        if (bottom > maxBottom) { var dy = bottom - maxBottom; mainTop -= dy; capTop -= dy; secTop -= dy; bottom -= dy; }
        if (capTop < 120) { var dy2 = Math.min(120 - capTop, Math.max(0, maxBottom - bottom)); mainTop += dy2; capTop += dy2; secTop += dy2; bottom += dy2; }
        var blur = Math.max(1.2, lay.size * 0.024), pad = Math.ceil(blur * 3 + 8);
        var rx = left - pad, ry = capTop - pad, rw = boxW + pad * 2, rh = bottom - capTop + pad * 2;
        var tw = Math.max(2, Math.ceil(rw * rs)), th = Math.max(2, Math.ceil(rh * rs));
        inkCv.width = tw; inkCv.height = th;
        var g = inkCtx;
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.filter = 'none';
        g.fillStyle = '#000'; g.fillRect(0, 0, tw, th);
        g.globalCompositeOperation = 'lighter';
        g.setTransform(rs, 0, 0, rs, (left - rx) * rs, (mainTop - ry) * rs);
        // B：逐字格子里的渐变，编码"这个位置是第几个字的第几成" → 着色器里和 charPos 比
        var n = Math.max(1, lay.text.length), lhPx = lay.size * lay.lineHeight, gap = lay.spacing * lay.size;
        var rowsChars = {};
        lay.chars.forEach(function (c) { (rowsChars[c.row] = rowsChars[c.row] || []).push(c); });
        Object.keys(rowsChars).forEach(function (k) {
          var arr = rowsChars[k];
          arr.forEach(function (c, j) {
            var x0 = j === 0 ? c.x - gap / 2 - lay.size * 0.08 : c.x - gap / 2;
            var x1 = j < arr.length - 1 ? arr[j + 1].x - gap / 2 : c.x + c.w + gap / 2 + lay.size * 0.08;
            var v0 = 1 + c.i * 253 / n, v1 = 1 + (c.i + 1) * 253 / n;
            var gr = g.createLinearGradient(x0, 0, x1, 0);
            gr.addColorStop(0, 'rgb(0,0,' + v0.toFixed(2) + ')'); gr.addColorStop(1, 'rgb(0,0,' + v1.toFixed(2) + ')');
            g.fillStyle = gr; g.fillRect(x0, c.y - lay.size * 0.06, x1 - x0, lhPx + lay.size * 0.08);
          });
        });
        function drawLay(L, ox, oy, color, bl) {
          if (!L) return;
          g.save();
          g.setTransform(rs, 0, 0, rs, (ox - rx) * rs, (oy - ry) * rs);
          g.filter = bl ? 'blur(' + (bl * rs).toFixed(2) + 'px)' : 'none';
          g.font = TX.fontCss(L.size, L.weight, L.family, L.style);
          g.textBaseline = 'alphabetic'; g.fillStyle = color;
          L.chars.forEach(function (c) { if (c.ch !== ' ') g.fillText(c.ch, c.x, c.baseline); });
          g.restore();
        }
        drawLay(lay, left, mainTop, 'rgb(255,0,0)', 0);
        drawLay(capLay, left, capTop, 'rgb(255,0,0)', 0);
        drawLay(secLay, left, secTop, 'rgb(255,0,0)', 0);
        drawLay(lay, left, mainTop, 'rgb(0,255,0)', blur);
        drawLay(capLay, left, capTop, 'rgb(0,200,0)', Math.max(0.8, capSize * 0.05));
        drawLay(secLay, left, secTop, 'rgb(0,220,0)', Math.max(0.9, secSize * 0.04));
        g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.setTransform(1, 0, 0, 1, 0, 0);
        if (gl) G.upload(gl, inkTex, inkCv);
        var centers = lay.chars.map(function (c) { return { x: left + c.x + c.w / 2, y: mainTop + c.y + lay.size * 0.47, row: c.row, w: c.w }; });
        ink = { rect: [rx, ry, rw, rh], px: [1 / tw, 1 / th], n: n, centers: centers, size: lay.size, main: lay, left: left, mainTop: mainTop, capTop: capTop, secTop: secTop, capLay: capLay, secLay: secLay };
      }

      /* ---------- 尺寸 ---------- */
      function killTarget(t) { if (t && gl) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }
      function resize(w, h, d) {
        W = Math.max(2, w); H = Math.max(2, h); dpr = d || 1;
        rs = Math.min(dpr, 1.5); var maxPx = 2.3e6; if (W * H * rs * rs > maxPx) rs = Math.sqrt(maxPx / (W * H));
        bw = Math.max(2, Math.round(W * rs)); bh = Math.max(2, Math.round(H * rs));
        cv.width = bw; cv.height = bh;
        if (!gl) return;
        lw = Math.max(2, Math.round(bw * 0.5)); lh = Math.max(2, Math.round(bh * 0.5));
        killTarget(bakeT); killTarget(lightT);
        bakeT = G.target(gl, bw, bh); lightT = G.target(gl, lw, lh);
        G.bindTarget(gl, bakeT); G.use(P_BAKE, { uRes: [bw, bh], uScale: rs }); G.drawQuad(gl);
        G.bindTarget(gl, null, bw, bh);
        if (S.shown) buildInk(S.shown);
      }

      /* ---------- 每帧 ---------- */
      var OUT_DUR = 0.34, IN_DUR = 0.75;
      function frame(f) {
        if (dead) return;
        if (gl ? !bakeT : cv.width < 3) resize(W, H, dpr);
        var dt = Math.min(0.05, f.dt || 0.016); S.t += dt;
        var ly = f.lyric, A = f.audio || {};
        // 时段（平滑过渡，跨 24 点走短路）
        var hr = f.hour == null ? 15 : f.hour;
        if (S.hour == null) S.hour = hr;
        var dh = hr - S.hour; if (dh > 12) dh -= 24; if (dh < -12) dh += 24;
        S.hour = (((S.hour + dh * Math.min(1, dt * 2.2)) % 24) + 24) % 24;
        var LT = lightAt(S.hour);
        var night = LT.lamp > .5;
        // 封面取色（只借一点）
        var pal = f.palette;
        if (!S.pal) S.pal = { dark: pal.darkRgb.slice(), sec: pal.secondaryRgb.slice(), sun: pal.sunRgb.slice(), mid: pal.midRgb.slice() };
        ['dark', 'sec', 'sun', 'mid'].forEach(function (k) { var src = pal[{ dark: 'darkRgb', sec: 'secondaryRgb', sun: 'sunRgb', mid: 'midRgb' }[k]]; for (var i = 0; i < 3; i++) S.pal[k][i] = M.damp(S.pal[k][i], src[i], 2.5, dt); });
        // 风 = 音乐能量（慢慢跟随）；暂停时几乎无风
        var windT = f.playing ? 0.12 + (A.energy || 0) * 0.95 + (A.bass || 0) * 0.15 : 0.03;
        if (S.gust) { S.gust.t += dt; windT += 0.5 * Math.exp(-S.gust.t * 1.3); if (S.gust.t > 4) S.gust = null; }
        S.wind = M.damp(S.wind, windT, f.playing ? 1.4 : 0.6, dt);
        S.phase += dt * (0.22 + S.wind * 1.6);

        /* --- 换行调度：淡出（云来）→ 换字 → 淡入（云走） --- */
        var cur = contentFor(ly.idx, f);
        var want = cur;
        // 提前量：云来→换字在开唱前完成，开唱时新字已经浮出来
        if (f.playing && ly.next) {
          var tn = ly.next.t - (ly.songTime != null ? ly.songTime : (f.track ? f.track.position : 0));
          if (tn > 0 && tn < OUT_DUR + 0.3) want = contentFor(ly.idx + 1, f);
        }
        S.desired = want;
        if (!S.shown) { S.shown = want; S.shownKey = want.key; buildInk(want); S.inkVis = 0; S.cloud = 0.6; S.spot.row = null; }
        if (S.desired.key !== S.shownKey) {
          S.inkVis = Math.max(0, S.inkVis - dt / OUT_DUR);
          if (S.inkVis <= 0) { S.shown = S.desired; S.shownKey = S.desired.key; buildInk(S.shown); S.spot.row = null; S.spot.a = 0; }
        } else {
          S.inkVis = Math.min(1, S.inkVis + dt / IN_DUR);
        }
        var cloudT = 1 - M.easeInOutCubic(S.inkVis);
        // 间奏 / 标题态：太阳偶尔被薄云轻轻遮一下（很慢的呼吸）
        if (ly.held || ly.idx < 0 || !f.playing) cloudT = Math.max(cloudT, 0.22 * (0.5 - 0.5 * Math.cos(S.t * 6.283 / 11)));
        S.cloud = M.damp(S.cloud, cloudT, 9, dt);
        S.cloudT += dt;

        /* --- 已唱进度（显示的行不一定是当前行） --- */
        var sh = S.shown, charPos;
        if (!sh.isLine) charPos = 999;
        else if (sh.idx === ly.idx) charPos = ly.charPos;
        else charPos = sh.idx > ly.idx ? 0 : 999;
        var singing = sh.isLine && sh.idx === ly.idx && !ly.held && ly.charPos > 0.02 && ly.charPos < (ink ? ink.n : 99) + 0.5;

        /* --- 反光焦散：弹簧跟随正在唱的字 --- */
        var sp = S.spot, tx, ty, ta = 0;
        if (ink && ink.centers.length) {
          if (sh.isLine && sh.idx === ly.idx) {
            var cp = M.clamp(ly.charPos - 0.5, 0, ink.centers.length - 1);
            var c0 = Math.floor(cp), c1 = Math.min(ink.centers.length - 1, c0 + 1), k = cp - c0;
            var A0 = ink.centers[c0], A1 = ink.centers[c1];
            if (A0.row !== A1.row) { k = 0; }
            tx = M.lerp(A0.x, A1.x, k); ty = M.lerp(A0.y, A1.y, k);
            ta = singing ? 1 : (ly.held ? 0.45 : 0.25);
            if (ly.held) {
              // 间奏：光斑离开字，在右边的墙上慢慢游荡
              var last = ink.centers[ink.centers.length - 1];
              tx = last.x + ink.size * (1.2 + 0.9 * Math.sin(S.t * 0.11)); ty = last.y + ink.size * (0.6 * Math.sin(S.t * 0.07 + 1));
            }
            // 换到下一排：光斑先暗下去再在新位置出现（像杯子被挪了一下），不横穿整行字
            if (sp.row == null) sp.row = A0.row;
            if (A0.row !== sp.row && !ly.held) { ta = 0; if (sp.a < 0.06) { sp.row = A0.row; sp.x = tx; sp.y = ty; sp.vx = sp.vy = 0; } }
          } else {
            // 标题态：光斑慢慢在标题上游走
            var nC = ink.centers.length, wob = (Math.sin(S.t * 0.13) * 0.5 + 0.5) * (nC - 1);
            var i0 = Math.floor(wob), i1 = Math.min(nC - 1, i0 + 1);
            tx = M.lerp(ink.centers[i0].x, ink.centers[i1].x, wob - i0); ty = M.lerp(ink.centers[i0].y, ink.centers[i1].y, wob - i0) - ink.size * 0.1;
            ta = sh.isLine ? 0 : 0.55;
          }
          tx += Math.sin(S.t * 1.3) * ink.size * 0.05 + Math.sin(S.t * 2.9 + 1) * ink.size * 0.025;
          ty += Math.cos(S.t * 1.1) * ink.size * 0.04;
          if (sp.a < 0.01 && ta > 0) { sp.x = tx; sp.y = ty; sp.vx = sp.vy = 0; }
          var kS = 34, dS = 10.5;
          sp.vx += ((tx - sp.x) * kS - sp.vx * dS) * dt; sp.vy += ((ty - sp.y) * kS - sp.vy * dS) * dt;
          sp.x += sp.vx * dt; sp.y += sp.vy * dt;
        }
        if (!f.playing) ta *= 0.45;
        sp.a = M.damp(sp.a, ta * S.inkVis, ta > sp.a ? 3.2 : 7, dt);
        sp.ph += dt * (0.5 + S.wind * 0.9);

        if (!gl) { draw2d(f, charPos); return; }

        /* --- 窗几何 --- */
        var O = LT.O, U = LT.U, V = LT.V, asp = W / H;
        var det = U[0] * V[1] - U[1] * V[0];
        var Wi = [V[1] / det, -U[1] / det, -V[0] / det, U[0] / det];
        var Ul = Math.hypot(U[0] * asp, U[1]), Vl = Math.hypot(V[0] * asp, V[1]);
        var gust = S.gust ? [S.gust.x, S.gust.y, S.gust.t * 0.55, Math.exp(-S.gust.t * 0.9)] : [0, 0, 0, 0];

        // 灰尘：只有在光束里才看得见；高音让它闪
        var MO = moBuf, u = Math.min(W / 1600, H / 900), treb = A.treble || 0;
        for (var i = 0; i < motes.length; i++) {
          var m = motes[i];
          m.x += (0.004 * (m.s - 0.5) + m.vx) * dt; m.y += (-0.0035 * (0.3 + m.s) + m.vy) * dt;
          m.vx *= Math.exp(-dt * 0.8); m.vy *= Math.exp(-dt * 0.8);
          var x = ((m.x + Math.sin(S.t * 0.21 + m.o) * 0.012) % 1 + 1) % 1, yU = ((1 - m.y + Math.cos(S.t * 0.17 + m.o) * 0.01) % 1 + 1) % 1;
          var ux = x - O[0], uy = yU - O[1];
          var qx = (V[1] * ux - V[0] * uy) / det, qy = (-U[1] * ux + U[0] * uy) / det;
          var beam = M.smooth(-0.12, 0.12, qx) * M.smooth(-0.12, 0.12, 1 - qx) * M.smooth(-0.12, 0.12, qy) * M.smooth(-0.12, 0.12, 1 - qy);
          var tw = 0.6 + 0.4 * Math.sin(S.t * (0.6 + m.s) + m.o) + treb * 0.9 * (0.5 + 0.5 * Math.sin(S.t * (9 + m.s * 7) + m.o * 3));
          MO[i * 4] = x * W; MO[i * 4 + 1] = (1 - yU) * H; MO[i * 4 + 2] = (2 + (1 - m.d) * 9) * Math.max(0.72, u);
          MO[i * 4 + 3] = beam * LT.sunI * (0.14 + 0.3 * m.d) * tw * (night ? 0.3 : 1) * (1 - S.cloud * 0.7);
        }

        // pass 1：窗光（半分辨率）
        G.bindTarget(gl, lightT);
        G.use(P_LIGHT, { uRes: [lw, lh], uPh: S.phase, uW: S.wind, uCanopy: LT.can + 0.22, uCloud: S.cloud * (night ? 0.5 : 1), uCloudT: S.cloudT, uAsp: asp,
          uO: O, uSq: [LT.soft / Ul, LT.soft / Vl], uUV: [Ul, Vl], uWi: Wi, uGust: gust, uCss: [W, H] });
        gl.uniform4fv(P_LIGHT.u.uMo, MO);
        G.drawQuad(gl);

        // pass 2：合成
        G.bindTarget(gl, null, bw, bh);
        var inkC = C.mix([0.03, 0.023, 0.019], C.mix(S.pal.dark, S.pal.mid, 0.3), 0.12);
        var spotC = C.mix(C.mix(night ? [1.0, 0.72, 0.45] : LT.sunC, [1.0, 0.8, 0.55], 0.3), S.pal.sun, 0.2);
        var spotI = night ? 0.7 : M.clamp(LT.sunI * 0.75, 0.5, 1) * (1 - S.cloud * 0.75);
        var wallC = C.mix([0.80, 0.748, 0.672], S.pal.sun, 0.03);
        G.use(P_COMP, {
          uCss: [W, H], uT: S.t,
          uBake: { tex: bakeT.tex, unit: 0 }, uLight: { tex: lightT.tex, unit: 1 }, uInk: { tex: inkTex, unit: 2 },
          uInkR: ink ? ink.rect : [0, 0, 1, 1], uInkPx: ink ? ink.px : [1, 1], uCharN: ink ? ink.n : 1, uCharPos: charPos,
          uInkVis: S.inkVis, uHasInk: ink ? 1 : 0, uRelief: 0.5,
          uSunC: LT.sunC, uSkyC: LT.skyC, uLampC: [1.0, 0.60, 0.30], uL: LT.L, uInkC: inkC, uSpotC: spotC, uWallC: wallC,
          uSunI: LT.sunI, uAmb: LT.amb, uLampI: LT.lamp, uHaze: LT.haze, uExpo: night ? 1.1 : 0.98, uFill: night ? 0.55 : 0.10,
          uLampP: [W * 0.34, H * 1.08, 230 * Math.max(0.75, u)],
          uSpot: [sp.x, sp.y, (ink ? ink.size : 80) * 0.78, sp.a * spotI], uSpotPh: sp.ph
        });
        G.drawQuad(gl);
      }

      /* ---------- 2D 兜底 ---------- */
      function draw2d(f, charPos) {
        var g = ctx2d; g.setTransform(rs, 0, 0, rs, 0, 0);
        g.fillStyle = '#c9c0b3'; g.fillRect(0, 0, W, H);
        if (!ink) return;
        var L = ink.main; g.font = TX.fontCss(L.size, L.weight, L.family);
        L.chars.forEach(function (c) { g.fillStyle = charPos > c.i + 0.5 ? 'rgba(30,24,20,.95)' : 'rgba(30,24,20,.45)'; g.fillText(c.ch, ink.left + c.x, ink.mainTop + c.baseline); });
      }

      /* ---------- 交互：点墙面 → 一阵风 ---------- */
      function pointer(type, x, y) {
        if (type !== 'down') return;
        S.gust = { x: x / W, y: 1 - y / H, t: 0 };
        motes.forEach(function (m) {
          var dx = m.x - x / W, dy = m.y - y / H, d = Math.sqrt(dx * dx + dy * dy) + 0.05;
          var k = Math.exp(-d * 4) * 0.12; m.vx += dx / d * k; m.vy += dy / d * k - 0.01;
        });
      }

      function destroy() {
        dead = true;
        if (gl) { killTarget(bakeT); killTarget(lightT); if (inkTex) gl.deleteTexture(inkTex); G.destroy(gl); gl = null; }
        inkCv.width = inkCv.height = 1;
        if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
      }

      return { resize: resize, frame: frame, pointer: pointer, destroy: destroy,
        _dbg: function () { return { inkVis: S.inkVis, cloud: S.cloud, shown: S.shownKey, desired: S.desired && S.desired.key, hour: S.hour, ink: ink ? { n: ink.n, rect: ink.rect } : null }; } };
    }
  });
})();
} catch (nbLyricFxLoadErr) { try { console.error("[平面歌词] 载入失败：午后窗影 · 光斑 (window-komorebi)", nbLyricFxLoadErr); } catch (_e) { } }

/* ------------------------------------------------------------
 * 接入层 NotBlindLyricFx
 * ------------------------------------------------------------ */
try {
/* ============================================================
 * 平面歌词 · 接进软件的那一层（NotBlindLyricFx）
 *
 * 播放页有两类效果：
 *   「3D 舞台」原来的粒子 + 立体歌词（默认）
 *   「平面歌词」整屏一张会动的歌词画面，3D 舞台整个休眠
 * 选择存在 localStorage：
 *   notblind-lyricfx-mode-v1    '2d' = 平面歌词，其它 = 3D 舞台
 *   notblind-lyricfx-choice-v1  'follow'（跟随主页主题，默认）或某个效果 id
 *
 * 图层：#nb-lyricfx 放在 3D 画布（#canvas-container）下面。平面歌词接管时，
 * 3D 画布只在侧边书架露出来时画书架，其余时间是空的（透明），所以书架照样能用。
 * 主循环（11-main-loop.js）问 coversScene()，是 true 就只做音频分析、书架和桌面歌词，
 * 然后调 renderScene() 画书架或清空画布。
 * 平面歌词自己用一个 requestAnimationFrame 循环画；被主页主题盖住时停下，
 * 盖住超过 45 秒就把效果销毁（释放显存），回到播放页再重建。
 * ============================================================ */
(function () {
  'use strict';
  var NBFX = window.NBFX;
  if (!NBFX) return;
  var M = NBFX.math, CL = NBFX.color;

  var MODE_KEY = 'notblind-lyricfx-mode-v1';
  var CHOICE_KEY = 'notblind-lyricfx-choice-v1';
  var ORDER = ['star-constellation', 'riso-halftone', 'echo-type', 'window-komorebi'];
  var FOLLOW = { 'star-atlas': 'star-constellation', 'riso-poster': 'riso-halftone', 'echo': 'echo-type', 'afternoon': 'window-komorebi' };
  var FOLLOW_FALLBACK = 'echo-type';
  var THEME_OF_FX = { 'star-constellation': '星图', 'riso-halftone': '孔版', 'echo-type': '回声', 'window-komorebi': '午后窗影' };
  var FADE_3D_MS = 520;          // 3D → 平面：3D 画布淡出
  var REVEAL_3D_MS = 620;        // 平面 → 3D：3D 画布淡入
  var SWAP_MS = 820;             // 平面效果之间交叉淡化（新的淡入 .7s）
  var COVER_DESTROY_MS = 45000;  // 被主页盖住多久后销毁效果

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function toast(msg) { if (typeof showToast === 'function') { try { showToast(msg); } catch (e) { } } }
  function hasBody(c) { return !!(document.body && document.body.classList.contains(c)); }
  function bodyCls(c, on) { if (document.body && document.body.classList.contains(c) !== !!on) document.body.classList.toggle(c, !!on); }

  // [二改 2026-09-28] 新用户：播放页默认就是「跟随主页主题」的平面歌词，和主页一个风格；
  // 用过以前版本的老用户不变（还是 3D 舞台）。只在第一次判断，判断完就记下来，以后以记下的为准。
  // 老用户的痕迹：这些键只会在用过一阵之后才写（这个文件执行时，新装的软件里它们都还不存在）
  var USED_BEFORE_KEYS = ['notblind-onboard-v1', 'notblind-usage-v1', 'mineradio-visual-guide-seen-v4', 'mineradio-last-playback-v1',
    'mineradio-listen-stats-v1', 'mineradio-listen-rollup-v2', 'mineradio-home-theme-v1'];
  function initialMode() {
    var saved = lsGet(MODE_KEY);
    if (saved === '2d' || saved === '3d') return saved;
    var usedBefore = USED_BEFORE_KEYS.some(function (k) { return lsGet(k) != null; });
    var m = usedBefore ? '3d' : '2d';
    lsSet(MODE_KEY, m);
    return m;
  }

  var S = {
    mode: initialMode(),
    choice: ORDER.indexOf(lsGet(CHOICE_KEY)) >= 0 ? lsGet(CHOICE_KEY) : 'follow',
    root: null, active: null, dying: [],
    phase: 'off',        // off | prep（等效果画出头两帧）| in（3D 画布淡出）| on | out（3D 画布淡回）
    phaseAt: 0,
    covers: false,       // 3D 舞台是否在休眠
    needClear: false, cleared: false, shelfDrawn: false,
    raf: 0, poll: 0, coveredAt: 0, destroyedByCover: false,
    lastT: 0, clock: 0, listeners: []
  };

  /* ---------------- 效果清单 ---------------- */
  function defs() { return ORDER.map(function (id) { return NBFX.byId[id]; }).filter(Boolean); }
  function homeThemeId() {
    try { if (typeof homeThemeHost !== 'undefined' && homeThemeHost) return homeThemeHost.pending || homeThemeHost.current || ''; } catch (e) { }
    return lsGet('mineradio-home-theme-v1') || '';
  }
  function homeThemeName(id) {
    try {
      var list = typeof homeThemeRegistry !== 'undefined' ? homeThemeRegistry : [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    } catch (e) { }
    return '';
  }
  function followTarget() { return FOLLOW[homeThemeId()] || FOLLOW_FALLBACK; }
  function resolveId() { var id = S.choice === 'follow' ? followTarget() : S.choice; return NBFX.byId[id] ? id : FOLLOW_FALLBACK; }

  /* ---------------- 页面状态 ---------------- */
  function coveredByHome() {
    try {
      if (typeof homeThemeHost !== 'undefined' && homeThemeHost && homeThemeHost.visible && homeThemeHost.current !== 'classic' && homeThemeHost.instance) return true;
    } catch (e) { }
    return false;
  }
  function splashCovers() { return hasBody('splash-active') && !hasBody('splash-revealing'); }
  function stageVisible() { return !splashCovers() && !coveredByHome() && !document.hidden; }
  function isWallpaper() { return hasBody('desktop-wallpaper-mode'); }
  // 清晰度：最高 1.5 倍；当桌面背景时 1.25 倍；连续几秒掉到 32 帧以下就降到 1 倍（这次打开期间不再升回去）
  function dprNow() { var d = window.devicePixelRatio || 1; return Math.min(d, S.dprCapped ? 1 : (isWallpaper() ? 1.25 : 1.5)); }
  function applyResize() {
    var w = window.innerWidth, h = window.innerHeight, d = dprNow();
    [S.active].concat(S.dying).forEach(function (a) {
      if (!a || !a.inst || !a.inst.resize) return;
      a.host.width = w; a.host.height = h; a.host.dpr = d;
      try { a.inst.resize(w, h, d); } catch (err) { console.error(err); }
    });
  }

  /* ---------------- 音频：64 段对数频谱 + 起音 + 鼓点 ---------------- */
  var NB = 64;
  var A = { bins: new Float32Array(NB), raw: new Float32Array(NB), prev: new Float32Array(NB), onset: new Float32Array(NB), fluxAvg: new Float32Array(NB),
    bass: 0, mid: 0, treble: 0, energy: 0, beat: 0, kick: false, lowAvg: 0.05, lastKick: -9, t: 0 };
  var fft = null;
  function readSpectrum(playing) {
    var an = typeof analyser !== 'undefined' ? analyser : null;
    if (!an || !playing) { for (var j = 0; j < NB; j++) A.raw[j] *= 0.9; return; }
    var n = an.frequencyBinCount;
    if (!fft || fft.length !== n) fft = new Uint8Array(n);
    try { an.getByteFrequencyData(fft); } catch (e) { return; }
    var sr = (an.context && an.context.sampleRate) || 44100;
    for (var i = 0; i < NB; i++) {
      var f0 = 32 * Math.pow(16000 / 32, i / NB), f1 = 32 * Math.pow(16000 / 32, (i + 1) / NB);
      var k0 = Math.floor(f0 / (sr / 2) * n), k1 = Math.max(k0 + 1, Math.ceil(f1 / (sr / 2) * n));
      var m = 0; for (var k = k0; k < k1 && k < n; k++) if (fft[k] > m) m = fft[k];
      A.raw[i] = M.clamp(Math.pow(m / 255, 1.6) * 1.15, 0, 1);
    }
  }
  function stepAudio(dt, playing) {
    A.t += dt;
    readSpectrum(playing);
    var low = 0;
    for (var i = 0; i < NB; i++) {
      var x = A.raw[i];
      var fl = Math.max(0, x - A.prev[i]); A.prev[i] = x;
      A.fluxAvg[i] += (fl - A.fluxAvg[i]) * Math.min(1, dt * 3);
      A.onset[i] = Math.max(0, fl - A.fluxAvg[i] * 1.6);
      A.bins[i] += (x - A.bins[i]) * (x > A.bins[i] ? Math.min(1, dt * 40) : Math.min(1, dt * 7));
      if (i < 6) low += fl;
    }
    function avg(a, b) { var s = 0; for (var q = a; q < b; q++) s += A.bins[q]; return s / (b - a); }
    A.bass = avg(0, 7); A.mid = avg(7, 29); A.treble = avg(29, 64); A.energy = avg(0, 64);
    A.kick = false;
    var thr = A.lowAvg * 1.8 + 0.08;
    if (playing && low > thr && A.t - A.lastKick > 0.22) { A.kick = true; A.lastKick = A.t; A.beat = 1; }
    A.lowAvg += (low - A.lowAvg) * Math.min(1, dt * 2);
    A.beat *= Math.exp(-dt * 6);
  }

  /* ---------------- 歌词：从软件读，去掉作词作曲行，按设置决定带不带翻译 ---------------- */
  var CREDIT = /^\s*(作词|作曲|编曲|词|曲|制作人|制作|监制|混音|母带|和声|和音|吉他|贝斯|鼓|键盘|弦乐|录音|录音室|出品|发行|企划|策划|统筹|演唱|原唱|OP|SP|Lyrics?|Music|Composer|Arranger|Producer)\s*[:：]/i;
  var lc = { src: null, len: -1, first: '', tr: '', out: [] };
  function translationOn() {
    try {
      var m = typeof normalizeLyricTranslationMode === 'function' ? normalizeLyricTranslationMode(fx && fx.lyricTranslationMode) : String((typeof fx !== 'undefined' && fx && fx.lyricTranslationMode) || 'off');
      return m !== 'off';
    } catch (e) { return false; }
  }
  function cleanLines() {
    var src = (typeof lyricsLines !== 'undefined' && lyricsLines) || [];
    var tr = translationOn() ? '1' : '0';
    var first = src.length ? String(src[0].text || '') + '|' + src[0].t : '';
    if (src === lc.src && src.length === lc.len && first === lc.first && tr === lc.tr) return lc.out;
    lc.src = src; lc.len = src.length; lc.first = first; lc.tr = tr;
    var out = [];
    var fallbackOnly = false;
    try { fallbackOnly = typeof lyricsAreFallbackTitleOnly === 'function' && src.length && lyricsAreFallbackTitleOnly(src); } catch (e) { }
    if (!fallbackOnly) {
      for (var i = 0; i < src.length; i++) {
        var l = src[i] || {};
        if (l.fallback) continue;
        var hasWords = !!(l.words && l.words.length);
        var text = hasWords ? String(l.text || '') : String(l.text || '').replace(/\s+/g, ' ').trim();
        if (!text.trim()) continue;
        try { if (typeof isNoLyricText === 'function' && isNoLyricText(text.trim())) continue; } catch (e) { }
        if (CREDIT.test(text)) continue;
        try { if (typeof isLyricCreditLineText === 'function' && isLyricCreditLineText(text.trim())) continue; } catch (e) { }
        var trs = tr === '1' ? String(l.translation || '').replace(/\s+/g, ' ').trim() : '';
        if (trs === text.trim()) trs = '';
        out.push({ t: Number(l.t) || 0, text: text, translation: trs, duration: Number(l.duration) || 0, words: hasWords ? l.words : null, charCount: text.length, source: l.source || '' });
      }
      out.sort(function (a, b) { return a.t - b.t; });
      for (var k = 0; k < out.length; k++) {
        var nx = out[k + 1];
        var gap = nx ? nx.t - out[k].t : 5;
        if (!(out[k].duration > 0)) out[k].duration = M.clamp(gap, 0.45, 12);
        else out[k].duration = M.clamp(Math.min(out[k].duration, Math.max(0.45, gap)), 0.45, 12);
      }
    }
    lc.out = out;
    return out;
  }
  function lyricTime() {
    var t = 0;
    try {
      t = typeof stageLyricPlaybackSeconds === 'function' ? stageLyricPlaybackSeconds() : (audio && audio.currentTime) || 0;
      if (typeof getAdjustedLyricPlaybackTime === 'function') t = getAdjustedLyricPlaybackTime(t);
    } catch (e) { try { t = audio.currentTime || 0; } catch (e2) { t = 0; } }
    return Number(t) || 0;
  }
  function songTime() { try { return (audio && Number(audio.currentTime)) || 0; } catch (e) { return 0; } }
  function isPlaying() {
    try { return !!(audio && audio.src && !audio.paused && !audio.ended); } catch (e) { return false; }
  }

  /* ---------------- 歌曲信息 ---------------- */
  var trk = { song: undefined, at: 0, info: null };
  function trackInfo(pos) {
    var song = null, now = performance.now();
    try { song = typeof homeThemeCurrentSong === 'function' ? homeThemeCurrentSong() : (playQueue && playQueue[currentIdx]); } catch (e) { song = null; }
    if (song !== trk.song || now - trk.at > 2000 || !trk.info) {
      var t = null;
      try { t = song && typeof homeThemeTrack === 'function' ? homeThemeTrack(song) : null; } catch (e) { t = null; }
      if (t) trk.info = { title: t.title, artist: t.artist, album: t.album, source: t.providerLabel || '本地', duration: t.duration || 0 };
      else if (song) trk.info = { title: String(song.name || song.title || ''), artist: String(song.artist || ''), album: String(song.album && song.album.name || song.album || ''), source: '本地', duration: 0 };
      else trk.info = { title: '', artist: '', album: '', source: '', duration: 0 };
      trk.song = song; trk.at = now;
    }
    var i = trk.info, dur = i.duration;
    try { if (audio && isFinite(audio.duration) && audio.duration > 0) dur = audio.duration; } catch (e) { }
    return { title: i.title, artist: i.artist, album: i.album, source: i.source, duration: dur, position: pos };
  }

  /* ---------------- 封面取色 → 效果用的一套颜色 ---------------- */
  function parseColor(s) {
    if (!s) return null;
    s = String(s).trim();
    var m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (m) return [m[1] / 255, m[2] / 255, m[3] / 255].map(function (v) { return M.clamp(v, 0, 1); });
    if (/^#[0-9a-f]{3,8}$/i.test(s)) return CL.hex2rgb(s);
    return null;
  }
  function hsl(rgb, sMin, sMax, lMin, lMax) {
    var h = CL.rgb2hsl(rgb);
    return CL.hsl2rgb([h[0], M.clamp(h[1], sMin, sMax), M.clamp(h[2], lMin, lMax)]);
  }
  var DEFAULT_PAL = { bg: '#0a1420', dark: '#07101a', mid: '#1d4e7a', primary: '#e6eef5', secondary: '#7fb6e6', accent: '#4a8fe7', sun: '#e8f1f7' };
  function palObj(p) {
    var o = {};
    ['bg', 'dark', 'mid', 'primary', 'secondary', 'accent', 'sun'].forEach(function (k) {
      var v = p[k];
      if (typeof v === 'string') { o[k] = v; o[k + 'Rgb'] = CL.hex2rgb(v); }
      else { o[k + 'Rgb'] = v; o[k] = CL.rgb2hex(v); }
    });
    return o;
  }
  var palCache = { src: undefined, key: '', out: palObj(DEFAULT_PAL) };
  function paletteNow() {
    var cp = null;
    try { cp = (typeof stageLyrics !== 'undefined' && stageLyrics && stageLyrics.coverPalette) || null; } catch (e) { cp = null; }
    var key = cp ? [cp.rawAreaPrimary, cp.rawPrimary, cp.rawAreaAccent, cp.rawAccent, cp.rawAreaLight, cp.rawLight, cp.rawAreaBase, cp.rawDark, cp.coverIsMonochrome].join('|') : '';
    if (cp === palCache.src && key === palCache.key) return palCache.out;
    palCache.src = cp; palCache.key = key;
    if (!cp || !hasCover()) { palCache.out = palObj(DEFAULT_PAL); return palCache.out; }
    var main = parseColor(cp.rawAreaPrimary || cp.rawPrimary || cp.primary) || [0.3, 0.45, 0.6];
    var acc = parseColor(cp.rawAreaAccent || cp.rawAccent || cp.highlight) || main;
    var light = parseColor(cp.rawAreaLight || cp.rawLight || cp.highlight) || main;
    var darkc = parseColor(cp.rawAreaBase || cp.rawDark || cp.rawAverage) || main;
    var mono = !!cp.coverIsMonochrome, sc = mono ? 0 : 1;
    palCache.out = palObj({
      bg: hsl(darkc, 0, mono ? 0.08 : 0.45, 0.075, 0.075),
      dark: hsl(darkc, 0, mono ? 0.08 : 0.5, 0.05, 0.05),
      mid: hsl(main, 0.25 * sc, mono ? 0.1 : 0.72, 0.22, 0.38),
      primary: hsl(light, 0, 0.3, 0.93, 0.93),
      secondary: hsl(main, 0.3 * sc, mono ? 0.1 : 0.78, 0.62, 0.74),
      accent: hsl(acc, 0.45 * sc, mono ? 0.12 : 0.92, 0.5, 0.62),
      sun: hsl(light, 0, mono ? 0.1 : 0.55, 0.92, 0.92)
    });
    return palCache.out;
  }
  function hasCover() {
    try { return !!(typeof uniforms !== 'undefined' && uniforms.uHasCover && uniforms.uHasCover.value > 0.5 && typeof coverTex !== 'undefined' && coverTex && coverTex.image && coverTex.image.width); } catch (e) { return false; }
  }
  var fbCover = { key: '', cv: null };
  function coverNow(pal) {
    if (hasCover()) return coverTex.image;
    var key = pal.dark + pal.mid + pal.secondary + pal.sun;
    if (fbCover.key === key && fbCover.cv) return fbCover.cv;
    var S2 = 256, cv = document.createElement('canvas'); cv.width = cv.height = S2;
    var c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, S2);
    g.addColorStop(0, pal.dark); g.addColorStop(0.58, pal.mid); g.addColorStop(0.64, pal.secondary); g.addColorStop(1, pal.dark);
    c.fillStyle = g; c.fillRect(0, 0, S2, S2);
    var rg = c.createRadialGradient(S2 * 0.62, S2 * 0.46, 4, S2 * 0.62, S2 * 0.46, S2 * 0.5);
    rg.addColorStop(0, pal.sun); rg.addColorStop(0.3, pal.secondary); rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.5; c.fillStyle = rg; c.fillRect(0, 0, S2, S2); c.globalAlpha = 1;
    fbCover.key = key; fbCover.cv = cv;
    return cv;
  }

  /* ---------------- 一帧的数据 ---------------- */
  function hourNow() {
    if (window.__nbLfxHour != null) return Number(window.__nbLfxHour) || 0;   // 测试用
    var d = new Date(); return d.getHours() + d.getMinutes() / 60;
  }
  var lyState = { idx: -99, lines: null };
  var pointer = { x: -1, y: -1, down: false, inside: false };
  function buildFrame(dt) {
    var playing = isPlaying();
    stepAudio(dt, playing);
    var lines = cleanLines();
    var lt = lyricTime(), st = songTime();
    var idx = NBFX.lyric.findIndex(lines, lt);
    var line = idx >= 0 ? lines[idx] : null;
    if (lines !== lyState.lines) { lyState.lines = lines; lyState.idx = -99; }
    var changed = idx !== lyState.idx; lyState.idx = idx;
    var tr = trackInfo(st);
    var title = tr.title || 'Not Blind';
    var lineT = line ? lt - line.t : 0;
    var pal = paletteNow();
    return {
      t: S.clock, dt: dt, playing: playing, audio: A,
      lyric: {
        lines: lines, idx: idx, line: line, prev: idx > 0 ? lines[idx - 1] : null, next: lines[idx + 1] || null,
        lineTime: lineT, progress: line ? M.clamp(lineT / Math.max(0.3, line.duration), 0, 1) : 0,
        charPos: line ? NBFX.lyric.charPos(line, lt) : 0,
        held: line ? lineT > line.duration : false,
        changed: changed, songTime: lt,
        fallback: !lines.length ? title : (idx < 0 ? title : null)
      },
      track: tr, palette: pal, cover: coverNow(pal), hour: hourNow(),
      pointer: pointer
    };
  }

  /* ---------------- 图层 ---------------- */
  function ensureRoot() {
    if (S.root && S.root.parentNode) return S.root;
    var el = document.getElementById('nb-lyricfx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nb-lyricfx';
      el.setAttribute('aria-hidden', 'true');
      var cc = document.getElementById('canvas-container');
      if (cc && cc.parentNode) cc.parentNode.insertBefore(el, cc);
      else (document.getElementById('desktop-window-shell') || document.body).appendChild(el);
    }
    S.root = el;
    return el;
  }
  function makeHost(el) {
    return { el: el, width: window.innerWidth, height: window.innerHeight, dpr: dprNow(), fonts: NBFX.fonts, NBFX: NBFX,
      seek: function (sec) { try { if (typeof commitProgressSeek === 'function') commitProgressSeek(Math.max(0, sec), isPlaying()); else audio.currentTime = Math.max(0, sec); } catch (e) { } },
      lyricLines: cleanLines };
  }
  function mount(id, instant) {
    var def = NBFX.byId[id];
    if (!def) return false;
    var root = ensureRoot();
    var el = document.createElement('div');
    el.className = 'nb-lfx-layer' + (instant ? ' on' : '');  // 不是立即显示的：等它真的画了两帧再淡入（loop 里）
    el.dataset.fx = id;
    root.appendChild(el);
    var host = makeHost(el), inst = null;
    try { inst = def.create(host); } catch (e) { console.error('[平面歌词] 创建失败', id, e); }
    if (!inst) { if (el.parentNode) el.parentNode.removeChild(el); return false; }
    try { if (inst.resize) inst.resize(host.width, host.height, host.dpr); } catch (e) { console.error(e); }
    S.active = { id: id, def: def, inst: inst, el: el, host: host, born: performance.now(), frames: 0, shownAt: instant ? performance.now() : 0 };
    return true;
  }
  // 换效果：旧的保持不动，新的在上面淡入，淡入完再把旧的拆掉（中间不会发暗）
  function retire(a) {
    if (!a) return;
    a.retiredAt = performance.now();
    S.dying.push(a);
  }
  function kill(a) {
    try { if (a.inst && a.inst.destroy) a.inst.destroy(); } catch (e) { console.error(e); }
    if (a.el && a.el.parentNode) a.el.parentNode.removeChild(a.el);
  }
  function killAll() {
    if (S.active) { kill(S.active); S.active = null; }
    S.dying.forEach(kill); S.dying = [];
  }

  /* ---------------- 进入 / 退出 / 换效果 ---------------- */
  function setPhase(p) { S.phase = p; S.phaseAt = performance.now(); }
  function enter() {
    if (!mount(resolveId(), true)) { failBack(); return; }
    bodyCls('nb-lfx-live', true);
    bodyCls('nb-lfx-snap3d', false);
    bodyCls('nb-lfx-reveal3d', false);
    bodyCls('nb-lfx-hide3d', false);
    setPhase('prep');   // 平面歌词先在 3D 画布下面画起来，画好了再让 3D 淡出
    S.covers = false; S.cleared = false;
    startLoop();
  }
  function exit() {
    S.covers = false;
    bodyCls('nb-lfx-on', false);
    bodyCls('nb-lfx-light', false);
    if (S.phase === 'off') return;
    // 3D 画布先瞬间透明，等 3D 舞台画出第一帧，再慢慢淡回来盖住平面歌词
    bodyCls('nb-lfx-hide3d', false);
    bodyCls('nb-lfx-reveal3d', false);
    bodyCls('nb-lfx-snap3d', true);
    setPhase('out');
    S.revealAt = 0;
    try { S.outFrame = renderer.info.render.frame; } catch (e) { S.outFrame = -1; }
    if (typeof wakeMainLoopFromBackground === 'function') { try { wakeMainLoopFromBackground(); } catch (e) { } }
    startLoop();
  }
  function finishOff() {
    killAll();
    bodyCls('nb-lfx-live', false); bodyCls('nb-lfx-hide3d', false); bodyCls('nb-lfx-snap3d', false); bodyCls('nb-lfx-reveal3d', false); bodyCls('nb-lfx-on', false); bodyCls('nb-lfx-light', false);
    setPhase('off');
    S.covers = false; S.destroyedByCover = false;
    stopLoop();
  }
  function swapTo(id) {
    if (!S.active || S.active.id === id) return;
    var old = S.active;
    S.active = null;
    if (!mount(id, false)) { S.active = old; toast('这个平面歌词没能打开'); return; }
    retire(old);
  }
  function failBack() {
    toast('平面歌词在这台电脑上打不开，先换回 3D 舞台');
    S.mode = '3d'; lsSet(MODE_KEY, '3d');
    finishOff();
    notify();
  }
  function sync() {
    var want = S.mode === '2d';
    if (want) {
      if (S.phase === 'off') { if (stageVisible()) enter(); else startPoll(); }
      else if (S.phase === 'prep' && S.active && S.active.id !== resolveId()) { killAll(); setPhase('off'); enter(); }
      else if (S.phase === 'out') {
        // 正在退回 3D 时又切回来：直接重新进入
        killAll(); setPhase('off'); if (stageVisible()) enter(); else startPoll();
      } else if (S.active && S.active.id !== resolveId()) {
        // 正在播放页上：交叉淡化换过去；被主页盖着：先不动，回到播放页时（pollTick）直接换
        if (stageVisible() && S.raf) swapTo(resolveId());
      }
      else if (!S.active && S.destroyedByCover && stageVisible()) { S.destroyedByCover = false; if (!mount(resolveId(), true)) failBack(); }
    } else if (S.phase === 'prep') finishOff();
    else if (S.phase === 'in' || S.phase === 'on') exit();
    notify();
  }

  /* ---------------- 浅色画面：底部控制条、搜索框换成深色底，免得白字看不清 ---------------- */
  // 网点是纸面，永远是浅的；光斑白天是被太阳晒着的墙，入夜后台灯的光正好打在底部控制条那一块 —— 两个都按浅色处理
  var toneAt = 0;
  function syncTone(tnow) {
    if (tnow - toneAt < 500) return;
    toneAt = tnow;
    var light = false;
    if (S.phase === 'on' || S.phase === 'in') {
      var id = S.active ? S.active.id : '';
      if (id === 'riso-halftone' || id === 'window-komorebi') light = true;
    }
    bodyCls('nb-lfx-light', light);
  }

  /* ---------------- 主循环（自己的 rAF） ---------------- */
  function startLoop() { stopPoll(); if (!S.raf) { S.lastT = performance.now(); S.raf = requestAnimationFrame(loop); } }
  function stopLoop() { if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; } }
  function startPoll() { if (!S.poll) S.poll = setInterval(pollTick, 250); }
  function stopPoll() { if (S.poll) { clearInterval(S.poll); S.poll = 0; } }
  function pollTick() {
    if (S.mode !== '2d' && S.phase === 'off') { stopPoll(); return; }
    if (S.phase === 'off') { if (stageVisible()) enter(); return; }
    if (S.phase === 'prep' || S.phase === 'in' || S.phase === 'out') { startLoop(); return; }
    if (!coveredByHome() && !splashCovers()) {
      if (!S.active && S.destroyedByCover) { S.destroyedByCover = false; if (!mount(resolveId(), true)) { failBack(); return; } }
      else if (S.active && S.active.id !== resolveId()) { var old = S.active; S.active = null; kill(old); if (!mount(resolveId(), true)) { failBack(); return; } }
      startLoop();
      return;
    }
    if (S.coveredAt && S.active && performance.now() - S.coveredAt > COVER_DESTROY_MS) {
      killAll(); S.destroyedByCover = true;
    }
  }
  function loop(now) {
    S.raf = 0;
    var dt = Math.max(0, Math.min(window.__nbLfxMaxDt || 0.05, (now - S.lastT) / 1000)); S.lastT = now;
    var tnow = performance.now(), elapsed = tnow - S.phaseAt;
    // 阶段推进
    if (S.phase === 'prep' && ((S.active && S.active.frames >= 2) || elapsed > 4000)) { bodyCls('nb-lfx-hide3d', true); setPhase('in'); elapsed = 0; }
    if (S.phase === 'in' && elapsed > FADE_3D_MS) { setPhase('on'); S.covers = true; S.needClear = true; S.cleared = false; bodyCls('nb-lfx-on', true); }
    if (S.phase === 'on' && S.cleared && hasBody('nb-lfx-hide3d')) { bodyCls('nb-lfx-hide3d', false); }
    if (S.phase === 'out') {
      // 等 3D 舞台真的画出新的一帧（renderer.info.render.frame 变了）再开始淡回来
      var drawn = true;
      try { drawn = S.outFrame < 0 || renderer.info.render.frame !== S.outFrame; } catch (e) { drawn = true; }
      if (!S.revealAt && ((drawn && elapsed > 40) || elapsed > 1500)) { bodyCls('nb-lfx-snap3d', false); bodyCls('nb-lfx-reveal3d', true); S.revealAt = tnow; }
      if (S.revealAt && tnow - S.revealAt > REVEAL_3D_MS + 60) { finishOff(); return; }
    }
    // 被主页主题 / 启动页盖住：停下，交给轮询
    if (S.phase === 'on' && (coveredByHome() || splashCovers())) {
      if (!S.coveredAt) S.coveredAt = performance.now();
      if (performance.now() - S.coveredAt > 600) { startPoll(); return; }
    } else S.coveredAt = 0;
    S.clock += dt;
    S.fpsN = (S.fpsN || 0) + 1;
    if (!S.fpsAt) S.fpsAt = tnow;
    if (tnow - S.fpsAt > 1000) {
      S.fps = Math.round(S.fpsN * 1000 / (tnow - S.fpsAt)); S.fpsN = 0; S.fpsAt = tnow;
      S.slow = (S.phase === 'on' && S.fps < 32 && !isWallpaper() && !document.hidden) ? (S.slow || 0) + 1 : 0;
      if (S.slow >= 4 && !S.dprCapped && S.active && S.active.host.dpr > 1.01) { S.dprCapped = true; applyResize(); }
    }
    syncTone(tnow);
    // [二改] 「歌词大小」（fx.lyricScale）变了：拖动停下 0.15 秒后让效果按新大小原地重排一次
    var lsc = NBFX.lyricScale ? NBFX.lyricScale() : 1;
    if (S.lyricScale == null) S.lyricScale = lsc;
    else if (Math.abs(lsc - S.lyricScale) > 1e-4) { S.lyricScale = lsc; S.lyricScaleAt = tnow; }
    if (S.lyricScaleAt && tnow - S.lyricScaleAt > 150) { S.lyricScaleAt = 0; applyResize(); }
    var f = null, A0 = S.active;
    // 新效果画好两帧才淡入；淡入完（或等太久）再拆旧的
    if (A0 && !A0.shownAt && A0.frames >= 2) { A0.el.classList.add('on'); A0.shownAt = tnow; }
    for (var i = S.dying.length - 1; i >= 0; i--) {
      var dz = S.dying[i];
      if (!A0 || (A0.shownAt && tnow - A0.shownAt > SWAP_MS) || tnow - dz.retiredAt > 6000) { kill(dz); S.dying.splice(i, 1); }
    }
    if (A0 || S.dying.length) {
      f = buildFrame(dt);
      runFrame(A0, f);
      for (var j = 0; j < S.dying.length; j++) runFrame(S.dying[j], f);
    }
    S.raf = requestAnimationFrame(loop);
  }
  function runFrame(a, f) {
    if (!a || !a.inst || !a.inst.frame) return;
    var t0 = performance.now();
    try { a.inst.frame(f); a.frames++; a.ms = (a.ms || 0) * 0.9 + (performance.now() - t0) * 0.1; }
    catch (e) {
      console.error('[平面歌词] 画面出错', a.id, e);
      a.inst.frame = null;
      if (a === S.active) setTimeout(failBack, 0);
    }
  }

  /* ---------------- 主循环调用：3D 画布这一帧怎么画 ---------------- */
  function shelfShowing() {
    try {
      // [二改] 平面歌词时右键改开平面歌单（21-flat-shelf.js），3D 书架不再露出来
      if (window.NBFlatShelf && NBFlatShelf.replacing && NBFlatShelf.replacing()) return false;
      if (typeof shelfManager === 'undefined' || !shelfManager || !shelfManager.getMode || shelfManager.getMode() === 'off') return false;
      if (shelfManager.hasOpenContent && shelfManager.hasOpenContent()) return true;
      if (typeof shelfPinnedOpen !== 'undefined' && shelfPinnedOpen) return true;
      if (typeof shelfAlwaysVisible === 'function' && shelfAlwaysVisible()) return true;
      if (typeof shelfPreviewIsVisible === 'function' && shelfPreviewIsVisible()) return true;
      if (typeof shelfVisibility !== 'undefined' && shelfVisibility > 0.01) return true;
    } catch (e) { }
    return false;
  }
  function topOf(o, scene) { while (o && o.parent && o.parent !== scene) o = o.parent; return o && o.parent === scene ? o : null; }
  var keep = [];
  function shelfObjects(scene) {
    keep.length = 0;
    try {
      var cards = shelfManager.getCards ? shelfManager.getCards() : null;
      if (cards && cards.length) { var g = topOf(cards[0].mesh, scene); if (g) keep.push(g); }
      var cl = shelfManager.getContentList ? shelfManager.getContentList() : null;
      var rows = cl && cl.getRows ? cl.getRows() : null;
      if (rows && rows.length) { var g2 = topOf(rows[0].mesh, scene); if (g2 && keep.indexOf(g2) < 0) keep.push(g2); }
      for (var i = 0; i < scene.children.length; i++) { var o = scene.children[i]; if (o.isPoints && o.renderOrder === 49 && keep.indexOf(o) < 0) keep.push(o); }
    } catch (e) { }
    return keep;
  }
  var hid = [];
  function renderScene(renderer, scene, camera) {
    if (!renderer) return;
    var show = shelfShowing();
    if (show) {
      var k = shelfObjects(scene);
      hid.length = 0;
      for (var i = 0; i < scene.children.length; i++) { var o = scene.children[i]; if (o.visible && k.indexOf(o) < 0) { o.visible = false; hid.push(o); } }
      try { renderer.render(scene, camera); } catch (e) { console.error(e); }
      for (var j = 0; j < hid.length; j++) hid[j].visible = true;
      hid.length = 0;
      S.shelfDrawn = true; S.cleared = true; S.needClear = false;
    } else if (S.needClear || S.shelfDrawn || !S.cleared) {
      try { renderer.setRenderTarget && renderer.setRenderTarget(null); renderer.clear(true, true, true); } catch (e) { }
      S.shelfDrawn = false; S.needClear = false; S.cleared = true;
    }
  }

  /* ---------------- 点击 / 按住 / 滚轮 ---------------- */
  function stageTarget(e) {
    try { return typeof renderer !== 'undefined' && renderer && e.target === renderer.domElement; } catch (x) { return false; }
  }
  function overUi(e) { try { return typeof isPointerOverUi === 'function' && isPointerOverUi(e); } catch (x) { return false; } }
  function send(type, e) {
    var a = S.active;
    if (!a || !a.inst || !a.inst.pointer) return;
    try { a.inst.pointer(type, e.clientX, e.clientY, e); } catch (err) { console.error(err); }
  }
  function bindPointer() {
    window.addEventListener('pointerdown', function (e) {
      if (!S.covers || e.button > 0 || !stageTarget(e) || overUi(e) || shelfShowing()) return;
      pointer.down = true; send('down', e);
    }, true);
    window.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX; pointer.y = e.clientY;
      if (!S.covers) return;
      pointer.inside = stageTarget(e) && !overUi(e);
      if (pointer.down || (pointer.inside && !shelfShowing())) send('move', e);
    }, true);
    window.addEventListener('pointerup', function (e) { if (pointer.down) { pointer.down = false; send('up', e); } }, true);
    window.addEventListener('pointercancel', function (e) { if (pointer.down) { pointer.down = false; send('up', e); } }, true);
    // 平面歌词时按住拖动不再转看不见的 3D 舞台（不然切回 3D 时视角是歪的）；书架露出来时照常
    var cc = document.getElementById('canvas-container');
    if (cc) cc.addEventListener('mousedown', function (e) {
      if (S.covers && e.button === 0 && stageTarget(e) && !shelfShowing()) e.stopPropagation();
    }, true);
    // 平面歌词时滚轮不再推拉看不见的 3D 镜头（书架露出来时照常滚书架）
    window.addEventListener('wheel', function (e) {
      if (!S.covers || !stageTarget(e) || shelfShowing()) return;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, { capture: true, passive: false });
    window.addEventListener('resize', applyResize);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && S.phase !== 'off') startLoop(); });
  }

  /* ---------------- 样式 ---------------- */
  function injectCss() {
    if (document.getElementById('nb-lyricfx-css')) return;
    var st = document.createElement('style');
    st.id = 'nb-lyricfx-css';
    st.textContent = [
      '#nb-lyricfx{position:fixed;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#050505;display:none;contain:strict}',
      'body.nb-lfx-live #nb-lyricfx{display:block}',
      '#nb-lyricfx .nb-lfx-layer{position:absolute;inset:0;overflow:hidden;opacity:0;transition:opacity .7s ease}',
      '#nb-lyricfx .nb-lfx-layer.on{opacity:1}',
      'body.nb-lfx-hide3d #canvas-container{opacity:0!important;transition:opacity .5s ease!important}',
      'body.nb-lfx-snap3d #canvas-container{opacity:0!important;transition:none!important}',
      'body.nb-lfx-reveal3d #canvas-container{transition:opacity .6s ease!important}',
      'body.nb-lfx-on #album-bg,body.nb-lfx-on #album-bg-next,body.nb-lfx-on #custom-bg,body.nb-lfx-on #wallpaper-engine-layer{visibility:hidden!important}',
      'body.splash-active:not(.splash-revealing) #nb-lyricfx{visibility:hidden}',
      // 浅色画面（网点、白天的光斑）：底部控制条和搜索框加一层深色底
      'html body.nb-lfx-light #bottom-bar.visible{background:rgba(24,21,19,.74)!important;-webkit-backdrop-filter:blur(14px) saturate(1.15)!important;backdrop-filter:blur(14px) saturate(1.15)!important;box-shadow:0 14px 40px -18px rgba(40,28,16,.55),inset 0 0 0 1px rgba(255,255,255,.10)!important}',
      'html body.nb-lfx-light #search-area.peek #search-box,html body.nb-lfx-light #search-area:focus-within #search-box{background:rgba(24,21,19,.62)!important;-webkit-backdrop-filter:blur(14px)!important;backdrop-filter:blur(14px)!important}',
      'html body.nb-lfx-light #upload-btn,html body.nb-lfx-light #home-btn{background:rgba(24,21,19,.55)!important}',
      'html body.nb-lfx-light #search-mode-tabs button{background:rgba(24,21,19,.5)!important}',
      '@media (prefers-reduced-motion: reduce){#nb-lyricfx .nb-lfx-layer{transition:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------------- 对外 ---------------- */
  function notify() { S.listeners.forEach(function (fn) { try { fn(); } catch (e) { } }); }
  var api = {
    list: function () { return defs().map(function (d) { return { id: d.id, name: d.name, en: d.en, desc: d.desc, hint: d.hint, icon: d.icon, theme: THEME_OF_FX[d.id] || '' }; }); },
    mode: function () { return S.mode; },
    choice: function () { return S.choice; },
    currentId: function () { return resolveId(); },
    followInfo: function () {
      var th = homeThemeId(), id = followTarget(), d = NBFX.byId[id];
      return { themeId: th, themeName: homeThemeName(th), matched: !!FOLLOW[th], fxId: id, fxName: d ? d.name : '' };
    },
    setMode: function (m, quiet) {
      m = m === '2d' ? '2d' : '3d';
      if (m === S.mode) { sync(); return; }
      S.mode = m; lsSet(MODE_KEY, m);
      if (!quiet) toast(m === '2d' ? '播放页换成平面歌词：' + (NBFX.byId[resolveId()] || {}).name : '播放页换回 3D 舞台');
      sync();
    },
    pick: function (choice) {
      choice = choice === 'follow' || ORDER.indexOf(choice) >= 0 ? choice : 'follow';
      var was2d = S.mode === '2d';
      S.choice = choice; lsSet(CHOICE_KEY, choice);
      S.mode = '2d'; lsSet(MODE_KEY, '2d');
      var d = NBFX.byId[resolveId()] || {};
      toast(choice === 'follow' ? '平面歌词跟随主页主题：现在是「' + d.name + '」' : (was2d ? '平面歌词换成「' + d.name + '」' : '播放页换成平面歌词：' + d.name));
      sync();
    },
    coversScene: function () { return S.covers && S.phase === 'on'; },
    renderScene: renderScene,
    onChange: function (fn) { if (typeof fn === 'function') S.listeners.push(fn); },
    sync: sync,
    debug: function () { try { return S.active && S.active.inst && S.active.inst._dbg ? S.active.inst._dbg() : null; } catch (e) { return String(e); } },
    state: function () { return { mode: S.mode, choice: S.choice, phase: S.phase, covers: S.covers, active: S.active && S.active.id, dying: S.dying.length, running: !!S.raf, polling: !!S.poll, destroyedByCover: S.destroyedByCover, fps: S.fps || 0, frameMs: S.active ? Math.round((S.active.ms || 0) * 10) / 10 : 0, light: hasBody('nb-lfx-light') }; }
  };
  window.NotBlindLyricFx = api;

  function boot() {
    injectCss();
    bindPointer();
    // 主页主题换了、跟随模式下要跟着换
    var lastTheme = homeThemeId();
    setInterval(function () {
      var th = homeThemeId();
      if (th !== lastTheme) { lastTheme = th; if (S.mode === '2d' && S.choice === 'follow') sync(); else notify(); }
    }, 700);
    if (S.mode === '2d') sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
} catch (nbLyricFxLoadErr) { try { console.error("[平面歌词] 载入失败：接入层 NotBlindLyricFx", nbLyricFxLoadErr); } catch (_e) { } }
