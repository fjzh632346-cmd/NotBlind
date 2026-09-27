// ============================================================
// Home theme · 午后窗影（Komorebi）
// 一面被阳光照着的墙：窗影、叶影随真实时间移动（早上斜长、正午短、傍晚橙红、夜里只剩台灯和月光）。
// 墙上的字和照片都被同一束光照着（文字层用 multiply 叠在光照画布上；大字歌名直接刻进墙面的法线里）。
// - 入口 = 墙上的展签；为你挑选 = 钉在墙上的小照片；进度 = 晾衣线上的木夹子（可拖）
// - 直接打字 = 把字"投"在墙上，回车交给软件自己的搜索
// - 调试：window.__hthForcedHour = 15 （数字，0~24）强制时段；删掉 / 设为 null 回到真实时间
// ============================================================
(function () {
  'use strict';
  var ID = 'afternoon';

  var SERIF = '"SimSun","宋体","STSong","Noto Serif CJK SC","Source Han Serif SC",serif';
  var KAI = '"KaiTi","楷体","STKaiti","AR PL UKai CN","Noto Serif CJK SC",serif';
  var LATIN = 'Georgia,"Noto Serif CJK SC","DejaVu Serif",serif';

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function fmt(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function rng(seed) { var s = (seed % 2147483646) + 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- 一天里的光（关键帧）。坐标：屏幕归一化，y 向上。O=窗影左下角，U=沿窗宽，V=沿窗高，S=物体影子方向 ----------
  var KF = [
    { h: 0, sunC: [.52, .64, 1.0], sunI: .50, skyC: [.10, .12, .20], amb: .30, O: [.50, .44], U: [.30, .05], V: [.12, .44], S: [.50, .72], L: [-.5, -.5, .55], pen: .07, soft: .016, lamp: 1, haze: .35, can: .05 },
    { h: 4.6, sunC: [.52, .64, 1.0], sunI: .38, skyC: [.12, .14, .22], amb: .30, O: [.50, .46], U: [.30, .05], V: [.12, .44], S: [.50, .72], L: [-.5, -.5, .55], pen: .07, soft: .016, lamp: .7, haze: .3, can: .05 },
    { h: 6, sunC: [.95, .78, .74], sunI: .45, skyC: [.62, .62, .70], amb: .55, O: [.34, .36], U: [.52, .08], V: [.18, .52], S: [.95, -.5], L: [-.9, .3, .28], pen: .06, soft: .012, lamp: .15, haze: .9, can: .0 },
    { h: 7, sunC: [1.0, .91, .80], sunI: 1.30, skyC: [.74, .75, .80], amb: .60, O: [.30, .30], U: [.50, .07], V: [.16, .52], S: [.85, -.55], L: [-.85, .35, .32], pen: .05, soft: .013, lamp: 0, haze: .85, can: 0 },
    { h: 9.5, sunC: [1.0, .94, .85], sunI: 1.40, skyC: [.78, .77, .76], amb: .64, O: [.30, .22], U: [.44, .04], V: [.10, .46], S: [.6, -.7], L: [-.7, .5, .4], pen: .045, soft: .012, lamp: 0, haze: .7, can: .05 },
    { h: 13, sunC: [1.0, .96, .90], sunI: 1.55, skyC: [.80, .77, .72], amb: .62, O: [.27, .13], U: [.42, .03], V: [.07, .53], S: [.3, -.85], L: [-.45, .75, .45], pen: .04, soft: .011, lamp: 0, haze: .55, can: .08 },
    { h: 16, sunC: [1.0, .83, .60], sunI: 1.35, skyC: [.76, .70, .64], amb: .60, O: [.14, .16], U: [.62, .12], V: [.22, .40], S: [1.1, -.6], L: [-.85, .3, .3], pen: .05, soft: .013, lamp: 0, haze: .9, can: .04 },
    { h: 18, sunC: [1.0, .55, .24], sunI: 1.25, skyC: [.60, .53, .48], amb: .54, O: [.02, .14], U: [.78, .16], V: [.30, .36], S: [1.6, -.45], L: [-.95, .15, .22], pen: .06, soft: .016, lamp: 0, haze: 1.15, can: 0 },
    { h: 19.2, sunC: [.90, .42, .32], sunI: .20, skyC: [.30, .30, .44], amb: .45, O: [.20, .30], U: [.55, .12], V: [.22, .40], S: [.9, .3], L: [-.8, .1, .3], pen: .07, soft: .016, lamp: .55, haze: .5, can: 0 },
    { h: 20.5, sunC: [.52, .64, 1.0], sunI: .42, skyC: [.11, .13, .21], amb: .30, O: [.50, .44], U: [.30, .05], V: [.12, .44], S: [.50, .72], L: [-.5, -.5, .55], pen: .07, soft: .016, lamp: 1, haze: .35, can: .05 },
    { h: 24, sunC: [.52, .64, 1.0], sunI: .50, skyC: [.10, .12, .20], amb: .30, O: [.50, .44], U: [.30, .05], V: [.12, .44], S: [.50, .72], L: [-.5, -.5, .55], pen: .07, soft: .016, lamp: 1, haze: .35, can: .05 }
  ];
  function mixv(a, b, t) { if (typeof a === 'number') return lerp(a, b, t); return a.map(function (x, i) { return lerp(x, b[i], t); }); }
  function lightAt(h) {
    h = ((h % 24) + 24) % 24; var i = 0; while (i < KF.length - 2 && KF[i + 1].h <= h) i++;
    var a = KF[i], b = KF[i + 1], t = (h - a.h) / (b.h - a.h); t = t * t * (3 - 2 * t); var o = {};
    for (var k in a) { if (k !== 'h') o[k] = mixv(a[k], b[k], t); }
    return o;
  }
  function realHour() { var d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; }
  function forcedHour() { var v = window.__hthForcedHour; return (typeof v === 'number' && isFinite(v)) ? ((v % 24) + 24) % 24 : null; }
  function hourNow() { var f = forcedHour(); return f != null ? f : realHour(); }
  function avg3(c) { return (c[0] + c[1] + c[2]) / 3; }
  function nightOf(LT) { return (LT.amb * avg3(LT.skyC) + LT.sunI * 0.12) < 0.22; }
  function phaseWord(h) { return h < 5 ? '深夜' : h < 8 ? '清晨' : h < 11 ? '上午' : h < 13 ? '正午' : h < 17 ? '午后' : h < 19.3 ? '黄昏' : h < 23 ? '入夜' : '深夜'; }
  var CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function cnNum(n) { n = n | 0; if (n <= 10) return CN[n]; if (n < 20) return '十' + (n % 10 ? CN[n % 10] : ''); return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : ''); }

  // ---------- 纸纹（程序生成，全模块共用一张） ----------
  var NOISE_URL = '';
  function noiseUrl() {
    if (NOISE_URL) return NOISE_URL;
    try {
      var c = document.createElement('canvas'); c.width = c.height = 160; var g = c.getContext('2d');
      var im = g.createImageData(160, 160), d = im.data, r = rng(99);
      for (var i = 0; i < d.length; i += 4) { var v = 238 + (r() - 0.5) * 22; d[i] = v; d[i + 1] = v - 2; d[i + 2] = v - 6; d[i + 3] = 255; }
      g.putImageData(im, 0, 0);
      g.globalAlpha = 0.07; g.strokeStyle = '#6b5a44';
      for (var k = 0; k < 60; k++) { var x = r() * 160, y = r() * 160, a = r() * Math.PI, l = 4 + r() * 10; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 2, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.lineWidth = 0.6; g.stroke(); }
      NOISE_URL = c.toDataURL();
    } catch (_e) { NOISE_URL = ''; }
    return NOISE_URL;
  }

  // ---------- 蓝晒（cyanotype）叶片：没有封面 / 封面加载失败时的兜底 ----------
  var cyCache = {}, cyKeys = [];
  function cyano(seedStr, size) {
    size = size || 160; var key = seedStr + '|' + size;
    var c = document.createElement('canvas'); c.width = c.height = size; var g = c.getContext('2d');
    if (cyCache[key]) { g.drawImage(cyCache[key], 0, 0); return c; }
    var r = rng(hash(seedStr)), S = size;
    g.fillStyle = '#eee6d6'; g.fillRect(0, 0, S, S);
    g.save(); g.beginPath(); var m = S * 0.06;
    for (var i = 0; i <= 40; i++) {
      var t = i / 40, x, y;
      if (t < 0.25) { x = m + t * 4 * (S - 2 * m); y = m + (r() - 0.5) * S * 0.03; }
      else if (t < 0.5) { x = S - m + (r() - 0.5) * S * 0.03; y = m + (t - 0.25) * 4 * (S - 2 * m); }
      else if (t < 0.75) { x = S - m - (t - 0.5) * 4 * (S - 2 * m); y = S - m + (r() - 0.5) * S * 0.03; }
      else { x = m + (r() - 0.5) * S * 0.03; y = S - m - (t - 0.75) * 4 * (S - 2 * m); }
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.clip();
    var gr = g.createLinearGradient(0, 0, S * 0.3, S); gr.addColorStop(0, '#24508a'); gr.addColorStop(1, '#12305f'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (var b = 0; b < 14; b++) { var bx = r() * S, by = r() * S, br = S * (0.1 + r() * 0.35); var rg = g.createRadialGradient(bx, by, 0, bx, by, br); rg.addColorStop(0, r() < 0.5 ? 'rgba(70,120,190,.25)' : 'rgba(5,20,50,.28)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, S, S); }
    var kind = r(), nStem = 1 + Math.floor(r() * 3);
    for (var s = 0; s < nStem; s++) {
      var x0 = S * (0.15 + r() * 0.7), y0 = S * 0.95, ang = -Math.PI / 2 + (r() - 0.5) * 0.9, len = S * (0.55 + r() * 0.35);
      var blur = r() < 0.35; g.save(); if (blur) g.filter = 'blur(' + (S * 0.012).toFixed(1) + 'px)';
      g.strokeStyle = 'rgba(240,246,255,.9)'; g.fillStyle = 'rgba(238,244,255,' + (blur ? 0.7 : 0.92) + ')'; g.lineWidth = S * 0.008;
      var cx = x0 + Math.cos(ang) * len * 0.5 + (r() - 0.5) * S * 0.2, cy = y0 + Math.sin(ang) * len * 0.5, ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
      var nl = kind < 0.5 ? 7 + Math.floor(r() * 6) : 4 + Math.floor(r() * 3);
      for (var l = 1; l <= nl; l++) {
        var t2 = l / (nl + 1), px = (1 - t2) * (1 - t2) * x0 + 2 * (1 - t2) * t2 * cx + t2 * t2 * ex, py = (1 - t2) * (1 - t2) * y0 + 2 * (1 - t2) * t2 * cy + t2 * t2 * ey;
        for (var side = -1; side <= 1; side += 2) {
          if (kind >= 0.5 && r() < 0.3) continue;
          var la = ang + side * (kind < 0.5 ? 1.1 : 0.7) + (r() - 0.5) * 0.3, ll = S * (kind < 0.5 ? 0.06 + 0.05 * (1 - t2) : 0.12 + r() * 0.1), lw = ll * (kind < 0.5 ? 0.28 : 0.36);
          g.save(); g.translate(px, py); g.rotate(la); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ll * 0.5, -lw, ll, 0); g.quadraticCurveTo(ll * 0.5, lw, 0, 0); g.fill();
          g.strokeStyle = 'rgba(40,80,140,.35)'; g.lineWidth = S * 0.003; g.beginPath(); g.moveTo(0, 0); g.lineTo(ll * 0.9, 0); g.stroke(); g.restore();
        }
      }
      if (kind >= 0.5) { g.save(); g.translate(ex, ey); g.rotate(ang); g.beginPath(); var tl = S * 0.14; g.moveTo(0, 0); g.quadraticCurveTo(tl * 0.5, -tl * 0.3, tl, 0); g.quadraticCurveTo(tl * 0.5, tl * 0.3, 0, 0); g.fill(); g.restore(); }
      g.restore();
    }
    g.restore();
    var im = g.getImageData(0, 0, S, S), d = im.data; for (var j = 0; j < d.length; j += 4) { var n = (r() - 0.5) * 18; d[j] += n; d[j + 1] += n; d[j + 2] += n; } g.putImageData(im, 0, 0);
    var keep = document.createElement('canvas'); keep.width = keep.height = S; keep.getContext('2d').drawImage(c, 0, 0);
    cyCache[key] = keep; cyKeys.push(key);
    if (cyKeys.length > 24) delete cyCache[cyKeys.shift()];
    return c;
  }

  // ---------- 样式 ----------
  var P = '.hth-afternoon ';
  var CSS = [
    '.hth-afternoon{background:#cfc6b8}',
    P + '.ha{position:absolute;inset:0;overflow:hidden;isolation:isolate;--u:1;',
    '  --ink:#2a221b;--ink2:rgba(42,34,27,.66);--ink3:rgba(42,34,27,.40);--ink4:rgba(42,34,27,.2);',
    '  --blend:multiply;--objb:1;--sx:6px;--sy:4px;--accent:#9b3b25;',
    '  font-family:' + SERIF + ';color:var(--ink);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none;',
    '  background:radial-gradient(90% 70% at 38% 58%,#e9dfcd,#cbbfad 70%,#b3a795)}',
    P + '.ha *{box-sizing:border-box}',
    P + 'button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:inherit;letter-spacing:inherit;-webkit-tap-highlight-color:transparent;box-shadow:none;border-radius:0;min-width:0;min-height:0}',
    P + '.ha-wall{position:absolute;inset:0;width:100%;height:100%;display:block}',
    // 没有 WebGL：墙面用 CSS 画一束斜光（字仍然用 multiply 叠上去）
    P + '.ha.nogl .ha-wall{display:none}',
    P + '.ha.nogl::before{content:"";position:absolute;left:18%;top:26%;width:46%;height:52%;transform:skewX(-22deg) rotate(-6deg);background:radial-gradient(closest-side,rgba(255,244,222,.75),rgba(255,244,222,0));filter:blur(18px)}',
    P + '.ha.nogl.night{background:radial-gradient(70% 60% at 22% 0%,#5b4632,#2a2320 55%,#16141a)}',
    P + '.ha.nogl.night::before{opacity:.12}',
    // 夜里：墙暗了，字换浅色、不再相乘；被台灯 / 月光照到的那几块（.litz）用深墨
    P + '.ha.night{--ink:rgba(240,228,208,.92);--ink2:rgba(236,224,204,.66);--ink3:rgba(236,224,204,.42);--ink4:rgba(236,224,204,.2);--blend:normal;--accent:#e3906a}',
    P + '.ha.night .litz,' + P + '.ha.night .litz *{--ink:#2b2017;--ink2:rgba(43,32,23,.8);--ink3:rgba(43,32,23,.56);--ink4:rgba(43,32,23,.3)}',
    P + '.ha.night .dimz,' + P + '.ha.night .dimz *{--ink:rgba(240,228,208,.92);--ink2:rgba(236,224,204,.66);--ink3:rgba(236,224,204,.42);--ink4:rgba(236,224,204,.2)}',
    // 墙面文字层：整层以 multiply 叠在光照上 → 字也被同一束光照亮（.ha 自己成叠层，画布在同一层里，不能再包一层隔离）
    P + '.ha-ink{position:absolute;inset:0;mix-blend-mode:var(--blend);pointer-events:none;transition:opacity .45s cubic-bezier(.3,.7,.3,1)}',
    P + '.ha-ink>*{pointer-events:auto}',
    P + '.ha-ink>.np{pointer-events:none}',
    P + '.ha.searching .ha-ink{opacity:.12}',
    P + '.ha.searching .ha-ink *{pointer-events:none!important}',
    P + '.ha.searching .ha-clock,' + P + '.ha.searching .ha-picks{opacity:0;transition:opacity .3s}',
    P + '.ha-glow{position:absolute;inset:0;mix-blend-mode:screen;pointer-events:none}',
    P + '.ha-q{position:absolute;left:-9999px;top:0;width:10px;height:10px;opacity:0;border:0;padding:0;pointer-events:none}',
    // 左上：时间（避开拉绳区）
    P + '.ha-clock{position:absolute;left:calc(var(--u)*128px);top:calc(var(--u)*50px);line-height:1;white-space:nowrap}',
    P + '.ha-clock .t{font-family:' + LATIN + ';font-size:calc(var(--u)*28px);letter-spacing:.02em;color:var(--ink);font-style:italic}',
    P + '.ha-clock .d{display:block;margin-top:calc(var(--u)*9px);font-size:calc(var(--u)*12.5px);letter-spacing:.32em;color:var(--ink2)}',
    // 顶部：搜索提示
    P + '.ha-shint{position:absolute;left:50%;top:calc(var(--u)*56px);transform:translateX(-50%);font-size:calc(var(--u)*13px);letter-spacing:.28em;color:var(--ink3);display:flex;align-items:center;gap:calc(var(--u)*10px);white-space:nowrap;padding:6px 10px;transition:color .25s,opacity .3s}',
    P + '.ha-shint svg{width:calc(var(--u)*13px);height:calc(var(--u)*13px);flex:none}',
    P + '.ha-shint:hover{color:var(--ink)}',
    P + '.ha-shint{-webkit-app-region:no-drag;cursor:pointer}',
    P + '.ha-shint .caret{display:inline-block;width:1px;height:1.1em;background:currentColor;animation:ha-blink 1.1s steps(1) infinite}',
    P + '.ha.idle .ha-shint .caret,' + P + '.ha.paused *{animation-play-state:paused!important}',
    '@keyframes ha-blink{50%{opacity:0}}',
    // 主角：播放块
    P + '.ha-pl{position:absolute;left:calc(var(--u)*128px);bottom:calc(var(--u)*184px)}',
    P + '.ha-st{font-size:calc(var(--u)*12.5px);letter-spacing:.34em;color:var(--ink3);margin-bottom:calc(var(--u)*14px);white-space:nowrap}',
    P + '.ha-st b{font-weight:400;color:var(--ink2)}',
    P + '.ha-st button{letter-spacing:.34em;color:var(--ink2);border-bottom:1px solid transparent;transition:color .2s,border-color .2s}',
    P + '.ha-st button:hover{color:var(--ink);border-bottom-color:var(--ink3)}',
    P + '.ha-ttl{margin:0;font-weight:400;font-family:' + SERIF + ';color:transparent;line-height:1.16;cursor:pointer;position:relative;white-space:nowrap;letter-spacing:.04em;outline:none}',
    P + '.ha.nogl .ha-ttl,' + P + '.ha-ttl.nog{color:var(--ink)}',
    P + '.ha-ttl .ln{display:block}',
    P + '.ha-ttl::after{content:"";position:absolute;left:0;bottom:-.06em;height:1px;width:0;background:var(--ink3);transition:width .5s cubic-bezier(.3,.8,.2,1)}',
    P + '.ha-ttl.can:hover::after,' + P + '.ha-ttl.can:focus-visible::after{width:100%}',
    P + '.ha-ttl .imm{position:absolute;left:100%;top:.2em;margin-left:.5em;font-size:calc(var(--u)*11px);letter-spacing:.3em;color:var(--ink3);opacity:0;transition:opacity .3s;white-space:nowrap;writing-mode:vertical-rl;font-family:' + SERIF + '}',
    P + '.ha-ttl:hover .imm,' + P + '.ha-ttl:focus-visible .imm{opacity:1}',
    P + '.ha-meta{margin-top:calc(var(--u)*14px);font-size:calc(var(--u)*16px);letter-spacing:.2em;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + '.ha-meta i{font-style:normal;color:var(--ink3);font-size:.8em;letter-spacing:.3em;margin-left:.6em}',
    P + '.ha-meta .inv{color:var(--ink);border-bottom:1px solid var(--ink3);padding-bottom:2px;margin-right:1.4em;letter-spacing:.2em;transition:border-color .2s,color .2s}',
    P + '.ha-meta .inv:hover{border-bottom-color:var(--ink);color:var(--accent)}',
    P + '.ha-meta .hint{display:block;margin-top:calc(var(--u)*12px);font-family:' + KAI + ';font-size:calc(var(--u)*14px);letter-spacing:.14em;color:var(--ink3)}',
    // 晾衣线 = 进度
    P + '.ha-thr{position:relative;margin-top:calc(var(--u)*18px);height:calc(var(--u)*34px);cursor:ew-resize;touch-action:none}',
    P + '.ha-thr svg{position:absolute;left:0;top:0;overflow:visible}',
    P + '.ha-thr .tm{position:absolute;left:100%;top:calc(var(--u)*5px);margin-left:calc(var(--u)*16px);font-family:' + LATIN + ';font-size:calc(var(--u)*13px);color:var(--ink3);white-space:nowrap;letter-spacing:.06em;cursor:pointer;padding:2px 4px;transition:color .2s}',
    P + '.ha-thr .tm:hover{color:var(--ink)}',
    P + '.ha-thr .bub{position:absolute;top:calc(var(--u)*-18px);font-family:' + LATIN + ';font-size:calc(var(--u)*12px);color:var(--ink);transform:translateX(-50%);opacity:0;transition:opacity .15s;white-space:nowrap;pointer-events:none}',
    P + '.ha-thr:hover .bub,' + P + '.ha-thr.drag .bub{opacity:1}',
    P + '.ha-thr path.a{stroke:var(--ink);transition:stroke-width .2s}',
    P + '.ha-thr path.b{stroke:var(--ink3);transition:stroke-width .2s}',
    P + '.ha-thr circle{fill:var(--ink2)}',
    P + '.ha-thr:hover path,' + P + '.ha-thr.drag path{stroke-width:1.9}',
    P + '.ha-thr .peg{cursor:grab}',
    P + '.ha-thr.drag .peg{cursor:grabbing}',
    // 控件：靠近才浮现
    P + '.ha-ctrl{position:absolute;left:0;top:100%;margin-top:calc(var(--u)*8px);display:flex;align-items:center;gap:calc(var(--u)*22px);white-space:nowrap;opacity:0;transform:translateY(-4px);transition:opacity .35s ease,transform .45s cubic-bezier(.2,1.3,.3,1);pointer-events:none}',
    P + '.ha-pl.near .ha-ctrl{opacity:1;transform:none}',
    P + '.ha.nearing .ha-labels{opacity:.45}',
    P + '.ha-pl.near .ha-ctrl *{pointer-events:auto}',
    P + '.ha-ctrl .ic{width:calc(var(--u)*30px);height:calc(var(--u)*30px);display:grid;place-items:center;color:var(--ink2);border-radius:50%;transition:color .2s,transform .25s cubic-bezier(.2,1.5,.3,1)}',
    P + '.ha-ctrl .ic:hover{color:var(--ink);transform:scale(1.08)}',
    P + '.ha-ctrl .ic:active{transform:scale(.92)}',
    P + '.ha-ctrl .ic svg{width:62%;height:62%}',
    P + '.ha-ctrl .ic.big{width:calc(var(--u)*40px);height:calc(var(--u)*40px);box-shadow:inset 0 0 0 1px var(--ink3)}',
    P + '.ha-ctrl .ic.big svg{width:40%;height:40%}',
    P + '.ha-ctrl .ci{font-size:calc(var(--u)*16px);width:calc(var(--u)*30px);height:calc(var(--u)*30px);display:grid;place-items:center;color:var(--ink3);position:relative;transition:color .2s,transform .25s cubic-bezier(.2,1.5,.3,1)}',
    P + '.ha-ctrl .ci:hover{color:var(--ink)}',
    P + '.ha-ctrl .ci:active{transform:scale(.9)}',
    P + '.ha-ctrl .ci.on{color:var(--ink)}',
    P + '.ha-ctrl .ci.ly.on::after{content:"";position:absolute;left:22%;right:22%;bottom:2px;height:1px;background:currentColor}',
    P + '.ha-ctrl .lk.on{color:var(--accent)}',
    P + '.ha-ctrl .sep{width:1px;height:calc(var(--u)*14px);background:var(--ink4)}',
    P + '.ha-ctrl .nx{font-size:calc(var(--u)*12.5px);letter-spacing:.2em;color:var(--ink3);max-width:calc(var(--u)*300px);overflow:hidden;text-overflow:ellipsis;transition:color .2s}',
    P + '.ha-ctrl .nx:hover{color:var(--ink)}',
    P + '.ha-ctrl .nx b{font-weight:400;color:var(--ink2)}',
    P + '.ha-ctrl .nx.none{cursor:default}',
    P + '.ha-vol{display:flex;align-items:flex-end;gap:calc(var(--u)*3px);height:calc(var(--u)*14px);padding:0 2px;cursor:pointer}',
    P + '.ha-vol i{display:block;width:1px;background:var(--ink4);height:40%;transition:background .15s,height .2s}',
    P + '.ha-vol i.on{background:var(--ink2)}',
    P + '.ha-vol i:nth-child(5n){height:100%}',
    P + '.ha-vol .vn{font-family:' + LATIN + ';font-size:calc(var(--u)*11px);color:var(--ink3);margin-left:calc(var(--u)*6px);align-self:center;min-width:2em}',
    P + '.ha-pl.vflash .ha-vol i.on{background:var(--ink)}',
    // 右侧：为你挑选 = 墙上钉着的小照片
    P + '.ha-picks{position:absolute;left:60%;top:31%;transition:opacity .3s}',
    P + '.ha-picks .hd{font-size:calc(var(--u)*12px);letter-spacing:.34em;color:var(--ink3);margin-bottom:calc(var(--u)*18px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(var(--u)*460px)}',
    P + '.ha-picks .hd b{font-weight:400;color:var(--ink2)}',
    P + '.ha-picks .prow{display:flex;gap:calc(var(--u)*28px)}',
    P + '.ha-print{width:calc(var(--u)*94px);cursor:pointer;position:relative;display:block}',
    P + '.ha-print .ph{width:100%;aspect-ratio:4/5;background:#f5f0e6;padding:calc(var(--u)*6px) calc(var(--u)*6px) calc(var(--u)*14px);box-shadow:0 0 0 .5px rgba(60,40,20,.22);transition:transform .45s cubic-bezier(.2,1.35,.3,1);filter:brightness(var(--objb))}',
    P + '.ha-print .ph img,' + P + '.ha-print .ph canvas{width:100%;height:100%;object-fit:cover;display:block}',
    P + '.ha-print .pin{position:absolute;left:50%;top:calc(var(--u)*-3px);width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#e9d8a6,#8a6a2c 70%);z-index:2}',
    P + '.ha-print:hover .ph,' + P + '.ha-print:focus-visible .ph{transform:translateY(calc(var(--u)*-3px)) rotate(-1.2deg)}',
    P + '.ha-print .cap{display:block;margin-top:calc(var(--u)*12px);font-size:calc(var(--u)*12.5px);letter-spacing:.12em;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;transition:color .2s}',
    P + '.ha-print .cap i{display:block;font-style:normal;font-size:calc(var(--u)*11px);color:var(--ink3);margin-top:3px;letter-spacing:.2em;overflow:hidden;text-overflow:ellipsis}',
    P + '.ha-print:hover .cap{color:var(--ink)}',
    P + '.ha-picks .ghost{font-family:' + KAI + ';font-size:calc(var(--u)*15px);letter-spacing:.2em;color:var(--ink3);line-height:2;margin-top:calc(var(--u)*150px);white-space:nowrap}',
    // 右：竖排的一句话（楷体）
    P + '.ha-quote{position:absolute;right:calc(var(--u)*72px);top:calc(var(--u)*190px);writing-mode:vertical-rl;font-family:' + KAI + ';font-size:calc(var(--u)*18px);letter-spacing:.42em;color:var(--ink2);cursor:pointer;max-height:calc(100% - var(--u)*400px);max-width:calc(var(--u)*120px);overflow:hidden;line-height:1.9;transition:color .25s}',
    P + '.ha-quote small{font-family:' + SERIF + ';font-size:calc(var(--u)*11px);letter-spacing:.3em;color:var(--ink3);margin-top:1.2em;display:inline-block}',
    P + '.ha-quote:hover{color:var(--ink)}',
    P + '.ha-quote .re{font-family:' + SERIF + ';font-size:calc(var(--u)*11px);color:var(--ink3);opacity:0;transition:opacity .3s;margin-top:1em;display:inline-block;letter-spacing:.3em}',
    P + '.ha-quote:hover .re,' + P + '.ha-quote:focus-visible .re{opacity:1}',
    P + '.ha-quote.flip{animation:ha-qflip .6s ease}',
    // [歌词位] 放歌时这一列写的是当前这句歌词：字大一号、墨色更深，一个字一个字洇出来；暂停时淡一点；没歌词时还是每日一句
    P + '.ha-quote{transition:color .4s,opacity .3s}',
    P + '.ha-quote.ly{top:calc(var(--u)*168px);font-size:calc(var(--u)*25px);letter-spacing:.34em;color:var(--ink);max-height:calc(100% - var(--u)*350px);max-width:calc(var(--u)*150px);line-height:1.75}',
    P + '.ha-quote.ly.pz{color:var(--ink2)}',
    P + '.ha-quote .qt span{transition:opacity .55s ease,filter .7s ease}',
    P + '.ha-quote.pre .qt span{opacity:0;filter:blur(3px)}',
    P + '.ha-quote.fo{opacity:0;transition:opacity .2s}',
    P + '.ha-quote .tr{display:block;font-family:' + SERIF + ';font-size:calc(var(--u)*12.5px);letter-spacing:.28em;color:var(--ink3);line-height:2.2;margin-right:calc(var(--u)*6px)}',
    P + '.ha-quote.ly small{letter-spacing:.34em}',
    P + '.ha-quote.lat .qt{font-family:' + SERIF + ';letter-spacing:.06em}',
    P + '.ha-quote .tr.lat{letter-spacing:.04em}',
    '@keyframes ha-qflip{0%{opacity:1}35%{opacity:0;filter:blur(3px)}100%{opacity:1;filter:none}}',
    // 底部：展签
    P + '.ha-labels{transition:opacity .35s;position:absolute;left:calc(var(--u)*128px);bottom:calc(var(--u)*44px);display:flex;gap:calc(var(--u)*46px)}',
    P + '.ha-lbl{text-align:left;max-width:calc(var(--u)*196px);min-width:0;flex:0 1 auto;position:relative;padding-bottom:calc(var(--u)*6px)}',
    P + '.ha-lbl .n{display:block;font-size:calc(var(--u)*10.5px);letter-spacing:.3em;color:var(--ink3);margin-bottom:calc(var(--u)*7px);transition:color .25s}',
    P + '.ha-lbl b{display:block;font-weight:400;font-size:calc(var(--u)*17px);letter-spacing:.22em;color:var(--ink);white-space:nowrap;transition:transform .35s cubic-bezier(.2,1.4,.3,1)}',
    P + '.ha-lbl span.s{display:block;margin-top:calc(var(--u)*6px);font-size:calc(var(--u)*11.5px);letter-spacing:.1em;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .25s}',
    P + '.ha-lbl::after{content:"";position:absolute;left:0;bottom:0;height:1px;width:0;background:var(--ink2);transition:width .45s cubic-bezier(.3,.8,.2,1)}',
    P + '.ha-lbl:hover::after,' + P + '.ha-lbl:focus-visible::after{width:100%}',
    P + '.ha-lbl:hover b,' + P + '.ha-lbl:focus-visible b{transform:translateX(calc(var(--u)*3px))}',
    P + '.ha-lbl:hover .n,' + P + '.ha-lbl:hover span.s{color:var(--ink2)}',
    P + '.ha-lbl.off b{color:var(--ink3)}',
    P + '.ha-today{position:absolute;right:calc(var(--u)*72px);bottom:calc(var(--u)*50px);text-align:right;font-size:calc(var(--u)*12px);letter-spacing:.24em;color:var(--ink3);line-height:1.9;white-space:nowrap}',
    P + '.ha-today b{font-family:' + LATIN + ';font-weight:400;font-size:calc(var(--u)*20px);color:var(--ink);letter-spacing:.02em;margin:0 .2em}',
    P + '.ha-today em{font-style:normal;color:var(--ink2)}',
    // 搜索时墙上被"投"出来的字
    P + '.ha-proj{position:absolute;left:calc(var(--u)*128px);top:calc(var(--u)*150px);max-width:calc(100% - var(--u)*420px);font-size:calc(var(--u)*46px);letter-spacing:.08em;color:#ffe6bf;white-space:nowrap;overflow:hidden;text-shadow:0 0 18px rgba(255,190,120,.55),0 0 2px rgba(255,236,200,.8);opacity:0;transition:opacity .35s}',
    P + '.ha.searching .ha-proj{opacity:1}',
    P + '.ha-proj span{display:inline-block;animation:ha-focusIn .5s cubic-bezier(.2,.8,.2,1) both}',
    P + '.ha-proj span.na{animation:none}',
    P + '.ha-proj.cmp span.c{border-bottom:1px dashed rgba(255,230,190,.7)}',
    P + '.ha-proj .cur{display:inline-block;width:2px;height:.9em;margin-left:4px;background:#ffe9c9;vertical-align:-.08em;box-shadow:0 0 10px rgba(255,200,130,.9);animation:ha-blink 1.1s steps(1) infinite}',
    P + '.ha-proj .ph0{color:rgba(255,230,195,.5);font-size:.62em;letter-spacing:.3em;vertical-align:.25em;animation:none}',
    P + '.ha-phint{position:absolute;left:calc(var(--u)*132px);top:calc(var(--u)*226px);font-size:calc(var(--u)*13px);letter-spacing:.3em;color:rgba(255,232,200,.7);white-space:nowrap;opacity:0;transition:opacity .35s .1s;text-shadow:0 0 12px rgba(255,190,120,.4)}',
    P + '.ha-phint kbd{font-family:' + LATIN + ';font-size:.95em;color:#fff1db;margin-right:.5em;letter-spacing:.05em}',
    P + '.ha-phint i{font-style:normal;margin:0 1.2em;opacity:.5}',
    P + '.ha.searching .ha-phint{opacity:1}',
    '@keyframes ha-focusIn{from{opacity:0;filter:blur(8px);transform:scale(1.18)}to{opacity:1;filter:none;transform:none}}',
    // 焦点样式：一小团暖光
    P + ':focus{outline:none}',
    P + ':focus-visible{outline:none;box-shadow:0 0 0 1px var(--ink3),0 0 16px 3px rgba(255,208,140,.55);border-radius:3px}',
    '@media (prefers-reduced-motion:reduce){' + P + '*{animation-duration:.01ms!important;transition-duration:.01ms!important}}'
  ].join('\n');

  // ---------- WebGL：墙、窗、叶、光 ----------
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var NOISE = [
    'float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),u.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x),u.y);}',
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}'
  ].join('\n');
  // 墙面（抹灰的起伏、纤维、小坑）只在尺寸变化时烘一次
  var FS_BAKE = ['precision highp float;uniform vec2 uRes;', NOISE,
    'float Hh(vec2 p){',
    '  vec2 w=vec2(fbm(p*1.1+1.3),fbm(p*1.1+7.7));',
    '  float broad=fbm(p*2.2+w*1.4);',
    '  float trowel=fbm(vec2(p.x*6.+w.x*5.,p.y*3.6+w.y*4.));',
    '  float sweep=fbm(rot(.5)*p*vec2(14.,3.)+w*3.);',
    '  float fine=vn(p*190.)*.45+vn(p*420.)*.55;',
    '  float pits=smoothstep(.84,.95,vn(p*260.+3.7));',
    '  return broad*.010+trowel*.0050+sweep*.0020+fine*.00012-pits*.00008;}',
    'void main(){',
    '  vec2 p=gl_FragCoord.xy/uRes.y; float e=1./uRes.y;',
    '  float h=Hh(p),hx=Hh(p+vec2(e,0.)),hy=Hh(p+vec2(0.,e));',
    '  vec2 n=-(vec2(hx-h,hy-h)/e);',
    '  vec2 r1=rot(.6)*p, r2=rot(-.95)*p;',
    '  float fib=smoothstep(.88,.98,vn(vec2(r1.x*520.,r1.y*34.)))+smoothstep(.88,.98,vn(vec2(r2.x*520.,r2.y*34.)+9.));',
    '  float alb=.5+(fbm(p*2.6+4.)-.5)*.45+(vn(p*60.)-.5)*.08-fib*.18;',
    '  float cav=clamp(.5+(vn(p*150.)-.5)*.7-smoothstep(.80,.93,vn(p*210.+3.7))*.45,0.,1.);',
    '  gl_FragColor=vec4(clamp(n*.5+.5,0.,1.),cav,clamp(alb,0.,1.));}'
  ].join('\n');
  var FS_MAIN = ['precision highp float;',
    'uniform vec2 uRes;uniform float uT,uPh,uW,uCurt,uRs,uGhost,uNight;',
    'uniform sampler2D uBake,uInk;',
    'uniform vec3 uSunC,uSkyC,uLampC,uL;uniform float uSunI,uAmb,uLampI,uCanopy,uHaze;',
    'uniform vec2 uO,uSq,uUV,uS;uniform mat2 uWi;uniform float uPen;',
    'uniform vec4 uR[6];uniform float uRD[6];',
    'uniform vec4 uTh;uniform float uThD;',
    'uniform float uInkF,uObjA;uniform vec4 uMo[10];uniform vec4 uBird;uniform vec4 uHeart;uniform vec3 uLampP;uniform vec4 uProj;uniform float uProjI;',
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
    'float curtain(vec2 q,float ph,float w){',
    '  float cx=.07+uCurt*.86+sin(q.y*5.+ph*1.3)*.012*(.3+w);',
    '  float inC=1.-smoothstep(cx-.02,cx+.03,q.x);',
    '  float folds=.42+.22*sin(q.x*62.+sin(q.y*2.4+ph*.7)*1.6)+.08*sin(q.x*23.+1.);',
    '  return mix(1.,folds,inC);}',
    'float sdBox(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}',
    'float dot2(vec2 v){return dot(v,v);}',
    'float sdHeart(vec2 p){p.x=abs(p.x);if(p.y+p.x>1.)return sqrt(dot2(p-vec2(.25,.75)))-sqrt(2.)/4.;return sqrt(min(dot2(p-vec2(0.,1.)),dot2(p-.5*max(p.x+p.y,0.))))*sign(p.x-p.y);}',
    'vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}',
    'void main(){',
    '  vec2 fc=gl_FragCoord.xy; vec2 uv=fc/uRes;',
    '  vec4 bk=texture2D(uBake,uv); vec3 n=vec3(bk.xy*2.-1.,1.);',
    '  vec4 ik=texture2D(uInk,uv); vec2 px=1.5/uRes;',
    '  float gx=texture2D(uInk,uv+vec2(px.x,0.)).g-texture2D(uInk,uv-vec2(px.x,0.)).g;',
    '  float gy=texture2D(uInk,uv+vec2(0.,px.y)).g-texture2D(uInk,uv-vec2(0.,px.y)).g;',
    '  n.xy+=vec2(gx,gy)*.6*uInkF; n=normalize(n);',
    '  vec2 q=uWi*(uv-uO);',
    '  float win=winM(q,uSq); float vis=win;',
    '  if(win>.001){ vis*=leaves(q,uPh,uW); vis*=1.-twig(q*uUV,uPh,uW)*.9; vis*=curtain(q,uPh,uW); }',
    '  float ao=1.;',
    '  for(int i=0;i<6;i++){float d=uRD[i]; if(d>.01){ vec4 r=uR[i]; vec2 hs=r.zw*.5; vec2 c=r.xy+hs;',
    '    float b=d*uPen+1.5*uRs;',
    '    float sd=sdBox(fc-c-uS*d,hs-b*.3);',
    '    vis*=1.-.86*uObjA*(1.-smoothstep(-b,b,sd));',
    '    float sa=sdBox(fc-c-uS*d*.12,hs);',
    '    ao*=1.-.30*uObjA*(1.-smoothstep(-2.*uRs,d*1.2+8.*uRs,sa));}}',
    '  if(uThD>0.){ vec2 pp=fc-uS*uThD; float t=(pp.x-uTh.x)/(uTh.y-uTh.x);',
    '    if(t>0.&&t<1.){ float cy=uTh.z-uTh.w*4.*t*(1.-t); float dd=abs(pp.y-cy); float wd=.8*uRs, bl=uThD*uPen*.7+1.*uRs;',
    '      vis*=1.-.72*(1.-smoothstep(wd,wd+bl,dd)); }',
    '    float t2=(fc.x-uTh.x)/(uTh.y-uTh.x); if(t2>0.&&t2<1.){ float cy2=uTh.z-uTh.w*4.*t2*(1.-t2); ao*=1.-.10*(1.-smoothstep(0.,4.*uRs,abs(fc.y-cy2-2.*uRs))); } }',
    '  if(uBird.w>0.){ vec2 bp=(fc-uBird.xy)/(uBird.z); float fl=sin(uT*14.)*.5;',
    '    float wl=length((rot(.35+fl*.6)*(bp-vec2(-.55,0.)))*vec2(1.,4.4))-.55;',
    '    float wr=length((rot(-.35-fl*.6)*(bp-vec2(.55,0.)))*vec2(1.,4.4))-.55;',
    '    float bd=length(bp*vec2(2.2,1.))-.28; float bs=min(min(wl,wr),bd);',
    '    vis*=1.-uBird.w*.75*(1.-smoothstep(-.15,.35,bs)); }',
    '  vec3 L=normalize(uL); float ndl=max(dot(n,L),0.)/max(L.z,.18);',
    '  vec3 wallA=vec3(.80,.755,.69)*(.94+.10*bk.w);',
    '  wallA+=uGhost*ik.b*vec3(.12,.105,.075);',
    '  float inkA=ik.r*(.80+.28*bk.z); inkA=clamp(inkA,0.,1.)*uInkF;',
    '  vec3 inkC=mix(vec3(.05,.038,.03),vec3(.07,.05,.04),bk.w);',
    '  vec3 alb=mix(wallA,inkC,inkA*.94);',
    '  float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),18.)*inkA*.06;',
    '  vec3 direct=uSunC*uSunI*vis*(ndl+spec*4.);',
    '  float cav=mix(.93,1.03,bk.z);',
    '  vec3 amb=uSkyC*uAmb*(.92+.08*n.y)*cav*ao;',
    '  amb*=mix(1.,.82,smoothstep(.55,1.,uv.y))*mix(1.08,1.,smoothstep(0.,.35,uv.y));',
    '  vec3 lamp=vec3(0.);',
    '  if(uLampI>.001){ vec2 lp=fc-uLampP.xy; float D=uLampP.z; float rr=sqrt(lp.x*lp.x+D*D);',
    '    float edge=rr*.62; float lit=smoothstep(edge-6.*uRs,edge+60.*uRs,lp.y);',
    '    float fall=D*D*1.6/(dot(lp,lp)+D*D);',
    '    vec3 Ld=normalize(vec3(-lp,D*.8)); float nd=max(dot(n,Ld),0.)/max(Ld.z,.25);',
    '    lamp=uLampC*uLampI*(lit*fall*nd*1.5+fall*.16)*ao; }',
    '  vec3 col=alb*(direct+amb+lamp);',
    '  if(uHeart.w>0.){ vec2 hp=(fc-uHeart.xy)/uHeart.z; hp.y+=.5; float hd=sdHeart(hp);',
    '    float hl=(1.-smoothstep(-.05,.12,hd))*uHeart.w; col+=alb*vec3(1.,.84,.62)*hl*(uNight>.5?.9:1.3)*ndl; }',
    '  vec2 sq=uSq*7.; vec2 aa=smoothstep(-sq,sq,q)*smoothstep(-sq,sq,1.-q); float soft=aa.x*aa.y;',
    '  col+=uSunC*uSunI*uHaze*soft*.07;',
    '  for(int i=0;i<10;i++){vec4 m=uMo[i]; if(m.w>.002){ float d=length(fc-m.xy); float r=m.z;',
    '    col+=uSunC*m.w*(1.-smoothstep(r*.55,r,d))*(.7+.3*smoothstep(r,r*.7,d));}}',
    '  if(uProjI>0.){ vec2 pc=uProj.xy+uProj.zw*.5; vec2 pr=(fc-pc)/(uProj.zw*.5+vec2(70.,50.)*uRs); float pm=exp(-dot(pr,pr)*2.2);',
    '    col+=alb*vec3(1.,.9,.76)*pm*uProjI*.42; }',
    '  float vg=uv.x*(1.-uv.x)*uv.y*(1.-uv.y)*16.; col*=mix(.70,1.,pow(clamp(vg,0.,1.),.25));',
    '  col=aces(col*1.08); col=pow(col,vec3(1./2.2));',
    '  col+=(h12(fc+fract(uT*7.)*91.)-.5)*.022;',
    '  gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5.5" width="3" height="13" rx=".6"/><rect x="14" y="5.5" width="3" height="13" rx=".6"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" stroke-linejoin="round"/></svg>';
  var HEART_F = '<svg viewBox="0 0 24 24" width="62%" height="62%" fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  var SVGNS = 'http://www.w3.org/2000/svg';

  function isTypingEl(t) {
    if (!t) return false;
    var tag = String(t.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return !!(t.isContentEditable || (t.closest && t.closest('[contenteditable="true"]')));
  }
  function appOverlayOpen() {
    try { if (typeof hotkeyCaptureState !== 'undefined' && hotkeyCaptureState) return true; } catch (_e) { }
    if (document.querySelector('.modal-mask.show,.hotkey-modal.show,#home-platform-recommend-mask.show')) return true;
    try { if (typeof miniQueueOpen !== 'undefined' && miniQueueOpen) return true; } catch (_e) { }
    try { if (typeof shelfManager !== 'undefined' && shelfManager && shelfManager.hasOpenContent && shelfManager.hasOpenContent()) return true; } catch (_e) { }
    return false;
  }
  // 用户在设置里配的"单键"本地快捷键（比如 F = 全屏）优先于"打字即搜"
  function isConfiguredHotkey(e) {
    try {
      if (typeof hotkeySettings === 'undefined' || !hotkeySettings || !hotkeySettings.local || typeof normalizeHotkeyEvent !== 'function') return false;
      var combo = normalizeHotkeyEvent(e); if (!combo) return false;
      var loc = hotkeySettings.local;
      for (var k in loc) { if (Object.prototype.hasOwnProperty.call(loc, k) && loc[k] === combo) return true; }
    } catch (_e) { }
    return false;
  }

  // ============================================================
  function createAfternoon(root, ctx) {
    ctx.injectStyle('theme-' + ID, CSS);
    var A = ctx.actions || {};
    var RM = !!ctx.reducedMotion;
    var destroyed = false, running = true;
    var cleanups = [];
    function on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); cleanups.push(function () { t.removeEventListener(ev, fn, opt); }); }
    var timers = [];
    function later(fn, ms) { var id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); if (!destroyed) fn(); }, ms); timers.push(id); return id; }

    root.innerHTML =
      '<div class="ha" role="region" aria-label="午后窗影 · 主页">' +
      '<canvas class="ha-wall" aria-hidden="true"></canvas>' +
      '<div class="ha-ink">' +
      '<div class="ha-clock np"><span class="t"></span><span class="d"></span></div>' +
      '<button class="ha-shint" type="button" aria-label="搜索"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5" stroke-linecap="round"/></svg><span>点这里，把想听的写在墙上</span><span class="caret"></span></button>' +
      '<div class="ha-pl">' +
      '<div class="ha-st"></div>' +
      '<h1 class="ha-ttl" tabindex="0"></h1>' +
      '<div class="ha-meta"></div>' +
      '<div class="ha-thr"><svg class="ths"></svg><span class="bub"></span><span class="tm" title="点一下切换 已播 / 剩余"></span></div>' +
      '<div class="ha-ctrl">' +
      '<button class="ic" data-a="prev" type="button" aria-label="上一首"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M17 5L8 12l9 7z" stroke-linejoin="round"/><path d="M6 5v14" stroke-linecap="round"/></svg></button>' +
      '<button class="ic big" data-a="play" type="button" aria-label="播放"></button>' +
      '<button class="ic" data-a="next" type="button" aria-label="下一首"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M7 5l9 7-9 7z" stroke-linejoin="round"/><path d="M18 5v14" stroke-linecap="round"/></svg></button>' +
      '<span class="sep"></span>' +
      '<button class="ci lk" data-a="like" type="button" aria-label="喜欢"></button>' +
      '<button class="ci ly" data-a="lyr" type="button" aria-label="歌词">词</button>' +
      '<span class="ha-vol" title="滚轮调音量 · 点一下设定"></span>' +
      '<span class="sep"></span>' +
      '<button class="nx" data-a="nx" type="button"></button>' +
      '</div></div>' +
      '<div class="ha-picks"></div>' +
      '<div class="ha-quote" tabindex="0" role="button"></div>' +
      '<div class="ha-labels"></div>' +
      '<div class="ha-today np"></div>' +
      '</div>' +
      '<div class="ha-glow"><div class="ha-proj"></div><div class="ha-phint"></div></div>' +
      '<input class="ha-q" tabindex="-1" autocomplete="off" spellcheck="false" aria-label="搜索歌曲、歌手">' +
      '</div>';
    var K = root.querySelector('.ha');
    var q$ = function (s) { return K.querySelector(s); };
    var cv = q$('.ha-wall'), E = {
      clk: q$('.ha-clock .t'), date: q$('.ha-clock .d'), shint: q$('.ha-shint'), pl: q$('.ha-pl'), st: q$('.ha-st'), ttl: q$('.ha-ttl'), meta: q$('.ha-meta'),
      thr: q$('.ha-thr'), ths: q$('.ha-thr .ths'), bub: q$('.ha-thr .bub'), tm: q$('.ha-thr .tm'), ctrl: q$('.ha-ctrl'),
      play: q$('[data-a="play"]'), like: q$('[data-a="like"]'), lyr: q$('[data-a="lyr"]'), nx: q$('[data-a="nx"]'), vol: q$('.ha-vol'),
      picks: q$('.ha-picks'), quote: q$('.ha-quote'), labels: q$('.ha-labels'), today: q$('.ha-today'), proj: q$('.ha-proj'), phint: q$('.ha-phint'), qin: q$('.ha-q')
    };
    var nz = noiseUrl(); if (nz) K.style.setProperty('--noise', 'url(' + nz + ')');

    var M = null;
    try { M = ctx.model(); } catch (_e) { M = null; }
    var W = 1, H = 1, u = 1, rs = 1, bw = 2, bh = 2, ox = 0, oy = 0;
    var lastInput = performance.now();
    function poke() { lastInput = performance.now(); wake(); }

    // ---------- GL ----------
    var gl = null, progBake = null, progMain = null, fbo = null, bakeTex = null, inkTex = null, buf = null, shaders = [], UL = {};
    var inkCv = document.createElement('canvas'), inkG = inkCv.getContext('2d');
    function mkProg(fs) {
      var v = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(v, VS); gl.compileShader(v);
      var f = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f, fs); gl.compileShader(f);
      shaders.push(v, f);
      if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) { console.warn('[午后窗影] shader', gl.getShaderInfoLog(f)); return null; }
      var p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('[午后窗影] link', gl.getProgramInfoLog(p)); gl.deleteProgram(p); return null; }
      return p;
    }
    function initGL() {
      try { gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, premultipliedAlpha: false, powerPreference: 'low-power' }); } catch (_e) { gl = null; }
      if (!gl) return false;
      progBake = mkProg(FS_BAKE); progMain = mkProg(FS_MAIN);
      if (!progBake || !progMain) { releaseGL(); return false; }
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      function tex() { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
      bakeTex = tex(); inkTex = tex(); fbo = gl.createFramebuffer();
      ['uRes', 'uT', 'uPh', 'uW', 'uCurt', 'uRs', 'uGhost', 'uNight', 'uBake', 'uInk', 'uSunC', 'uSkyC', 'uLampC', 'uL', 'uSunI', 'uAmb', 'uLampI', 'uCanopy', 'uHaze', 'uO', 'uSq', 'uUV', 'uS', 'uWi', 'uPen', 'uR', 'uRD', 'uInkF', 'uObjA', 'uTh', 'uThD', 'uMo', 'uBird', 'uHeart', 'uLampP', 'uProj', 'uProjI'].forEach(function (n) {
        UL[n] = gl.getUniformLocation(progMain, n) || gl.getUniformLocation(progMain, n + '[0]');
      });
      return true;
    }
    function releaseGL(lose) {
      if (!gl) return;
      try {
        [bakeTex, inkTex].forEach(function (t) { if (t) gl.deleteTexture(t); });
        if (fbo) gl.deleteFramebuffer(fbo);
        if (buf) gl.deleteBuffer(buf);
        [progBake, progMain].forEach(function (p) { if (p) gl.deleteProgram(p); });
        shaders.forEach(function (s) { gl.deleteShader(s); });
        if (lose) { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
      } catch (_e) { }
      gl = null; bakeTex = inkTex = fbo = buf = progBake = progMain = null; shaders = []; UL = {};
    }
    on(cv, 'webglcontextlost', function (e) { e.preventDefault(); gl = null; K.classList.add('nogl'); });
    function bake() {
      if (!gl) return;
      gl.bindTexture(gl.TEXTURE_2D, bakeTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bakeTex, 0);
      gl.viewport(0, 0, bw, bh); gl.useProgram(progBake); gl.uniform2f(gl.getUniformLocation(progBake, 'uRes'), bw, bh);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    function uploadInk() {
      if (!gl) return; gl.bindTexture(gl.TEXTURE_2D, inkTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inkCv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    // ---------- 光 / 时段 ----------
    var hourTarget = hourNow(), hourCur = hourTarget, hourAnim = false, wasAnim = false, lastPhase = '';
    var LT = lightAt(hourCur), isNight = null;
    function cordTone(night) {
      var cord = document.getElementById('home-theme-cord');
      if (!cord) return;
      cord.style.setProperty('--cord-color', night ? 'rgba(236,228,212,.7)' : 'rgba(60,48,36,.55)');
      cord.style.setProperty('--cord-glow', night ? 'rgba(255,214,160,.35)' : 'rgba(255,236,200,.0)');
    }

    // ---------- 坐标（相对主题根） ----------
    function rel(el) { var r = el.getBoundingClientRect(); return { x: r.left - ox, y: r.top - oy, w: r.width, h: r.height }; }

    // ---------- 版式 ----------
    var titleLines = [], titleSize = 80, titleKey = '';
    function layout() {
      var rr = root.getBoundingClientRect();
      ox = rr.left; oy = rr.top;
      W = Math.max(1, Math.round(rr.width || window.innerWidth)); H = Math.max(1, Math.round(rr.height || window.innerHeight));
      u = Math.max(0.72, Math.min(W / 1600, H / 900)); K.style.setProperty('--u', u.toFixed(4));
      rs = Math.min(window.devicePixelRatio || 1, 1.5); var maxPx = 2.3e6; if (W * H * rs * rs > maxPx) rs = Math.sqrt(maxPx / (W * H));
      var nbw = Math.max(2, Math.round(W * rs)), nbh = Math.max(2, Math.round(H * rs));
      if (nbw !== bw || nbh !== bh || cv.width !== nbw) {
        bw = nbw; bh = nbh; cv.width = bw; cv.height = bh; inkCv.width = bw; inkCv.height = bh;
        bake();
      }
      titleKey = ''; lastSig = '';
      if (M) render();
      wake();
    }
    var measCtx = document.createElement('canvas').getContext('2d');
    function wrapText(text, maxW, wOf) {
      var out = [], cur = ''; var toks = text.match(/[A-Za-z0-9.'’\-]+|\s+|./g) || [];
      toks.forEach(function (t) { if (wOf(cur + t) > maxW && cur) { out.push(cur.replace(/\s+$/, '')); cur = t.replace(/^\s+/, ''); } else cur += t; });
      if (cur) out.push(cur); return out;
    }
    function fitTitle(text, maxW) {
      var maxS = 86 * u, minS = 42 * u;
      for (var s = maxS; s >= minS; s -= 2 * u) {
        measCtx.font = s + 'px ' + SERIF; var ls = 0.04 * s;
        var wOf = function (str) { return measCtx.measureText(str).width + ls * str.length; };
        if (wOf(text) <= maxW) return { size: s, lines: [text] };
        if (s <= 64 * u) { var lines = wrapText(text, maxW, wOf); if (lines.length <= 2) return { size: s, lines: lines }; }
      }
      measCtx.font = minS + 'px ' + SERIF; var ls2 = 0.04 * minS; var wOf2 = function (str) { return measCtx.measureText(str).width + ls2 * str.length; };
      var l = wrapText(text, maxW, wOf2);
      if (l.length > 2) { var second = l[1]; while (second.length > 1 && wOf2(second + '…') > maxW) second = second.slice(0, -1); l = [l[0], second + '…']; }
      return { size: minS, lines: l };
    }
    function renderTitle() {
      var n = M && M.now; var text = n ? n.title : '墙上还没有歌';
      var key = text + '|' + W + '|' + H + '|' + (n ? 1 : 0); if (key === titleKey) return; titleKey = key;
      var maxW = Math.min(W * 0.60 - 128 * u - 24 * u, 980 * u);
      var f = fitTitle(text, maxW); titleSize = f.size; titleLines = f.lines;
      E.ttl.style.fontSize = f.size + 'px';
      E.ttl.innerHTML = f.lines.map(function (l) { return '<span class="ln">' + esc(l) + '</span>'; }).join('') + (n ? '<span class="imm">进入沉浸</span>' : '');
      E.ttl.setAttribute('aria-label', n ? (text + ' · 进入沉浸模式') : text);
      E.ttl.classList.toggle('can', !!n);
      E.ttl.setAttribute('role', n ? 'button' : 'heading');
      E.ttl.tabIndex = n ? 0 : -1;
      drawInk();
    }
    var ghostRects = [];
    function drawInk() {
      if (!gl) return;
      var g = inkG; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, bw, bh);
      var spans = E.ttl.querySelectorAll('.ln');
      g.textBaseline = 'middle';
      var fs = titleSize * rs;
      var hasLS = 'letterSpacing' in g;
      function drawAll(color, blur) {
        g.save(); g.fillStyle = color; g.font = fs + 'px ' + SERIF; if (blur) g.filter = 'blur(' + blur + 'px)';
        if (hasLS) g.letterSpacing = (0.04 * fs) + 'px';
        Array.prototype.forEach.call(spans, function (sp) {
          var r = rel(sp);
          if (hasLS) g.fillText(sp.textContent, r.x * rs, (r.y + r.h / 2) * rs);
          else { var x = r.x * rs; for (var i = 0; i < sp.textContent.length; i++) { var ch = sp.textContent[i]; g.fillText(ch, x, (r.y + r.h / 2) * rs); x += g.measureText(ch).width + 0.04 * fs; } }
        });
        g.restore();
      }
      g.globalCompositeOperation = 'lighter';
      drawAll('rgb(255,0,0)', 0);
      drawAll('rgb(0,255,0)', Math.max(1, 1.6 * rs * u));
      // 空状态：墙上挂过画框留下的浅色印子 + 钉孔
      if (ghostRects.length) {
        g.save(); g.filter = 'blur(' + (1.6 * rs) + 'px)'; g.fillStyle = 'rgb(0,0,255)';
        ghostRects.forEach(function (r) { g.fillRect(r.x * rs, r.y * rs, r.w * rs, r.h * rs); }); g.restore();
        g.fillStyle = 'rgb(150,0,0)'; ghostRects.forEach(function (r) { g.beginPath(); g.arc((r.x + r.w / 2) * rs, (r.y - 2 * u) * rs, 1.4 * rs, 0, 6.3); g.fill(); });
      }
      g.globalCompositeOperation = 'source-over';
      uploadInk(); wake();
    }

    // ---------- 晾衣线（进度） ----------
    var dragF = null, showRemain = false, pegAng = 0, pegVel = 0, thGeom = null, thKey = '';
    var posBase = 0, posAt = 0, posPlaying = false;
    function curPos() {
      var n = M && M.now; if (!n) return 0;
      var p = posBase;
      if (posPlaying) p += (performance.now() - posAt) / 1000;
      return clamp(p, 0, n.duration || p);
    }
    var TH = (function () {
      function el(tag, attrs) { var x = document.createElementNS(SVGNS, tag); for (var k in attrs) x.setAttribute(k, attrs[k]); return x; }
      var c0 = el('circle', { r: 1.6 }), c1 = el('circle', { r: 1.6 });
      var pb = el('path', { 'class': 'b', fill: 'none', 'stroke-width': 1, 'stroke-linecap': 'round' });
      var pa = el('path', { 'class': 'a', fill: 'none', 'stroke-width': 1.15, 'stroke-linecap': 'round' });
      var peg = el('g', { 'class': 'peg' });
      var r1 = el('rect', { fill: '#c9a676' }), r2 = el('rect', { fill: '#b8925f' }), r3 = el('rect', { fill: '#8c8a86' }), hit = el('rect', { x: -10, y: -8, width: 20, height: 30, fill: 'transparent' });
      peg.appendChild(r1); peg.appendChild(r2); peg.appendChild(r3); peg.appendChild(hit);
      [c0, c1, pb, pa, peg].forEach(function (x) { E.ths.appendChild(x); });
      return { c0: c0, c1: c1, pb: pb, pa: pa, peg: peg, r1: r1, r2: r2, r3: r3 };
    })();
    function thrW() { return Math.min(560 * u, W * 0.40); }
    function drawThread(force) {
      var n = M && M.now;
      if (!n) { if (E.thr.style.display !== 'none') E.thr.style.display = 'none'; thGeom = null; return; }
      if (E.thr.style.display) E.thr.style.display = '';
      var w = thrW();
      var f = dragF != null ? dragF : clamp(curPos() / (n.duration || 1), 0, 1);
      var x0 = 4, x1 = w - 4, y = 10 * u, s = 5 * u, h = 34 * u;
      var sizeKey = w.toFixed(1) + '|' + u.toFixed(4);
      if (sizeKey !== thKey) {
        thKey = sizeKey;
        E.thr.style.width = w + 'px';
        E.ths.setAttribute('width', w); E.ths.setAttribute('height', h); E.ths.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        TH.c0.setAttribute('cx', x0); TH.c0.setAttribute('cy', y); TH.c1.setAttribute('cx', x1); TH.c1.setAttribute('cy', y);
        TH.r1.setAttribute('x', -3.4 * u); TH.r1.setAttribute('y', -4 * u); TH.r1.setAttribute('width', 3.2 * u); TH.r1.setAttribute('height', 20 * u); TH.r1.setAttribute('rx', u);
        TH.r2.setAttribute('x', 0.2 * u); TH.r2.setAttribute('y', -4 * u); TH.r2.setAttribute('width', 3.2 * u); TH.r2.setAttribute('height', 20 * u); TH.r2.setAttribute('rx', u);
        TH.r3.setAttribute('x', -3.6 * u); TH.r3.setAttribute('y', 3 * u); TH.r3.setAttribute('width', 7.2 * u); TH.r3.setAttribute('height', 2.2 * u);
        force = true;
      }
      // 二次贝塞尔：控制点在中点，下垂 s
      var cx = (x0 + x1) / 2, cy = y + 2 * s;
      var t = f, ax = lerp(x0, cx, t), ay = lerp(y, cy, t), bx = lerp(cx, x1, t), by = lerp(cy, y, t), px = lerp(ax, bx, t), py = lerp(ay, by, t);
      var slope = Math.atan2(by - ay, bx - ax);
      var pa = (slope * 180 / Math.PI) * 0.6 + pegAng;
      TH.pb.setAttribute('d', 'M' + px.toFixed(2) + ' ' + py.toFixed(2) + ' Q' + bx.toFixed(2) + ' ' + by.toFixed(2) + ' ' + x1 + ' ' + y);
      TH.pa.setAttribute('d', 'M' + x0 + ' ' + y + ' Q' + ax.toFixed(2) + ' ' + ay.toFixed(2) + ' ' + px.toFixed(2) + ' ' + py.toFixed(2));
      TH.peg.setAttribute('transform', 'translate(' + px.toFixed(2) + ' ' + py.toFixed(2) + ') rotate(' + pa.toFixed(2) + ')');
      if (force || !thGeom || frameN % 10 === 0) {
        var r = rel(E.thr);
        thGeom = { x0: r.x + x0, x1: r.x + x1, y: r.y + y, sag: s, rx: r.x, ry: r.y };
      }
      thGeom.px = thGeom.rx + px; thGeom.py = thGeom.ry + py;
      var cur = f * (n.duration || 0);
      var txt = showRemain ? ('−' + fmt((n.duration || 0) - cur)) : (fmt(cur) + ' / ' + fmt(n.duration || 0));
      if (E.tm.textContent !== txt) E.tm.textContent = txt;
    }
    function thrFrac(e) { var r = E.thr.getBoundingClientRect(); return clamp((e.clientX - r.left - 4) / (r.width - 8), 0, 1); }
    var lastDX = 0;
    on(E.thr, 'pointermove', function (e) {
      if (!M || !M.now) return; var f = thrFrac(e);
      E.bub.style.left = (f * (E.thr.offsetWidth - 8) + 4) + 'px'; E.bub.textContent = fmt(f * (M.now.duration || 0));
      if (dragF != null) { lastDX = e.movementX || 0; dragF = f; drawThread(); poke(); }
    });
    on(E.thr, 'pointerdown', function (e) {
      if (!M || !M.now || e.target === E.tm || e.button > 0) return;
      try { E.thr.setPointerCapture(e.pointerId); } catch (_e) { }
      dragF = thrFrac(e); E.thr.classList.add('drag'); drawThread(); poke();
    });
    function endDrag() {
      if (dragF == null) return; var f = dragF; dragF = null; E.thr.classList.remove('drag');
      pegVel += clamp(lastDX, -30, 30) * 1.4;
      if (M && M.now) { posBase = f * (M.now.duration || 0); posAt = performance.now(); }
      try { if (A.seek) A.seek(f); } catch (e) { console.warn('[午后窗影] seek', e); }
      drawThread(true); poke();
    }
    on(E.thr, 'pointerup', endDrag); on(E.thr, 'pointercancel', endDrag);
    on(E.tm, 'click', function (e) { e.stopPropagation(); showRemain = !showRemain; drawThread(); });

    // ---------- 控件 ----------
    function call(name) { var args = [].slice.call(arguments, 1); try { if (typeof A[name] === 'function') return A[name].apply(A, args); } catch (e) { console.warn('[午后窗影] ' + name, e); } }
    on(E.ctrl, 'click', function (e) {
      var b = e.target.closest && e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'play') call('togglePlay');
      else if (a === 'prev') call('prev');
      else if (a === 'next') call('next');
      else if (a === 'lyr') call('toggleLyrics');
      else if (a === 'like') { var was = M && M.now && M.now.liked; call('toggleLike'); if (!was) heartLight(); }
      else if (a === 'nx') {
        if (!M || !M.next) return;
        if (typeof openPlaylistPanelTab === 'function') { try { openPlaylistPanelTab('queue', true); } catch (err) { console.warn(err); } }
        else call('next');
      }
    });
    on(E.ttl, 'click', function () { if (!M || !M.now) return; if (typeof A.openImmersive === 'function') call('openImmersive'); else call('resume'); });
    on(E.ttl, 'keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && M && M.now) { e.preventDefault(); e.stopPropagation(); if (typeof A.openImmersive === 'function') call('openImmersive'); else call('resume'); } });
    // 音量：20 根细刻度，滚轮 / 点一下
    E.vol.innerHTML = new Array(21).join('<i></i>') + '<span class="vn"></span>';
    var volTicks = E.vol.querySelectorAll('i'), volN = E.vol.querySelector('.vn'), volShown = -1;
    function readVol() { try { if (typeof targetVolume === 'number') return clamp(targetVolume, 0, 1); } catch (_e) { } return 0.6; }
    function writeVol(v) { try { if (typeof setVolume === 'function') setVolume(clamp(v, 0, 1), true); } catch (e) { console.warn('[午后窗影] volume', e); } drawVol(); }
    function drawVol() {
      var v = Math.round(readVol() * 100); if (v === volShown) return; volShown = v;
      var onN = Math.round(v / 5);
      Array.prototype.forEach.call(volTicks, function (el, i) { el.classList.toggle('on', i < onN); });
      volN.textContent = v;
    }
    var vT = 0;
    on(E.pl, 'wheel', function (e) {
      if (!M || !M.now) return; e.preventDefault(); e.stopPropagation();
      writeVol(readVol() + (e.deltaY < 0 ? 0.04 : -0.04));
      E.pl.classList.add('near', 'vflash'); K.classList.add('nearing');
      clearTimeout(vT); vT = later(function () { E.pl.classList.remove('vflash'); }, 500); poke();
    }, { passive: false });
    on(E.vol, 'click', function (e) {
      var r = E.vol.getBoundingClientRect(); var span = Math.max(10, r.width - 30 * u);
      writeVol(Math.round(clamp((e.clientX - r.left) / span, 0, 1) * 20) / 20);
    });
    // 靠近才浮现
    var nearT = 0;
    function nearCheck(e) {
      if (!M || !M.now) { E.pl.classList.remove('near'); K.classList.remove('nearing'); return; }
      var r = E.pl.getBoundingClientRect(); var pad = 70 * u;
      var inside = e.clientX - ox > 20 && e.clientX > r.left - pad && e.clientX < r.right + pad + 200 * u && e.clientY > r.top - pad * 0.4 && e.clientY < r.bottom + 70 * u;
      if (inside) { if (nearT) { clearTimeout(nearT); nearT = 0; } E.pl.classList.add('near'); K.classList.add('nearing'); }
      else if (E.pl.classList.contains('near') && !nearT) {
        nearT = later(function () { nearT = 0; if (!E.pl.matches(':focus-within')) { E.pl.classList.remove('near'); K.classList.remove('nearing'); } }, 900);
      }
    }
    on(K, 'pointermove', function (e) { poke(); nearCheck(e); }, { passive: true });
    on(K, 'pointerleave', function () { if (!nearT && E.pl.classList.contains('near')) nearT = later(function () { nearT = 0; if (!E.pl.matches(':focus-within')) { E.pl.classList.remove('near'); K.classList.remove('nearing'); } }, 900); });
    on(E.pl, 'focusin', function () { if (M && M.now) { E.pl.classList.add('near'); K.classList.add('nearing'); } });

    // 喜欢：墙上的一枚光斑变成心形
    var heart = { t: -1, x: 0, y: 0 };
    function heartLight() { var r = rel(E.like); heart = { t: 0, x: r.x + r.w / 2, y: r.y - 8 * u }; wake(); }

    // ---------- 数据 → DOM ----------
    var lastSig = '', rects = [], printLift = [0, 0, 0, 0], printLiftC = [0, 0, 0, 0];
    function setH(el, h) { if (el._h !== h) { el._h = h; el.innerHTML = h; return true; } return false; }
    function setT(el, t) { if (el.textContent !== t) el.textContent = t; }
    function clockText() {
      var f = forcedHour();
      if (f == null) return M.clock.time;
      var hh = Math.floor(f), mm = Math.round((f - hh) * 60); if (!mm) mm = new Date().getMinutes();
      return String(hh).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
    }
    function dateText() { setT(E.date, cnNum(M.clock.month) + '月' + cnNum(M.clock.day) + '日 · ' + M.clock.weekday + ' · ' + phaseWord(hourCur)); }
    function render() {
      if (!M) return;
      var n = M.now;
      setT(E.clk, clockText());
      dateText();
      // 状态行
      var stH = !n ? '<b>还没有正在放的歌</b>' : (n.playing ? '<b>正在播放</b>' + (n.providerLabel ? ' · ' + esc(n.providerLabel) : '') : '<b>已暂停</b> · 停在 ' + fmt(n.position) + ' · <button type="button" data-r="1">继续播放</button>');
      setH(E.st, stH);
      renderTitle();
      if (n) {
        setH(E.meta, esc(n.artist) + (n.album ? ' · 《' + esc(n.album) + '》' : '') + (n.providerLabel ? '<i>' + esc(n.providerLabel) + '</i>' : ''));
        E.meta.style.maxWidth = Math.max(200, Math.min(W * 0.6 - 128 * u, 900 * u)) + 'px';
      } else {
        E.meta.style.maxWidth = '';
        var inv = !M.login.any
          ? '<button class="inv" type="button" data-i="login">登录网易云 / QQ 音乐</button><button class="inv" type="button" data-i="local">导入本地音乐</button><span class="hint">登录之后，今天的推荐会挂到这面墙上。</span>'
          : (M.daily.count ? '<button class="inv" type="button" data-i="daily">放今天的推荐</button><button class="inv" type="button" data-i="local">导入本地音乐</button><span class="hint">挑一首，墙上的光就会跟着它动起来。</span>'
            : '<button class="inv" type="button" data-i="local">导入本地音乐</button><button class="inv" type="button" data-i="lib">打开音乐库</button><span class="hint">挑一首，墙上的光就会跟着它动起来。</span>');
        setH(E.meta, inv);
      }
      // 进度：用模型的位置校准，播放中在两次推送之间自己往前走
      if (n) {
        var p = n.position || 0;
        if (!posPlaying || !n.playing || Math.abs(curPos() - p) > 1.6 || n.key !== render.k) { posBase = p; posAt = performance.now(); }
        else { posBase = curPos(); posAt = performance.now(); posBase += (p - posBase) * 0.2; }
        posPlaying = !!n.playing; render.k = n.key;
      }
      drawThread();
      if (n) {
        setH(E.play, n.playing ? ICON_PAUSE : ICON_PLAY); E.play.setAttribute('aria-label', n.playing ? '暂停' : '播放');
        setH(E.like, n.liked ? HEART_F : HEART); E.like.classList.toggle('on', !!n.liked); E.like.setAttribute('aria-label', n.liked ? '取消喜欢' : '喜欢');
      }
      E.lyr.classList.toggle('on', !!M.lyricsOn); E.lyr.setAttribute('aria-pressed', M.lyricsOn ? 'true' : 'false');
      setH(E.nx, M.next ? '接下来 · <b>' + esc(M.next.title) + '</b> — ' + esc(M.next.artist) : '队列里没有下一首了');
      E.nx.classList.toggle('none', !M.next);
      drawVol();
      var sig = JSON.stringify([M.picks.label, M.picks.items.map(function (t) { return t.key + '|' + t.cover; }), M.quote.text, M.quote.source, M.daily.label, M.daily.count, M.library.label, M.library.playlistCount, M.login.any, M.recent.length, M.today, M.discover.sub, M.discover.available, M.radio.sub, M.radio.available, W, H]);
      if (sig !== lastSig) { lastSig = sig; renderStatic(); }
      if (isNight) inkZones();
    }
    function coverEl(track, size) {
      var seed = (track && (track.title + track.artist)) || 'x';
      if (track && track.cover) {
        var img = new Image(); img.alt = ''; img.decoding = 'async'; img.draggable = false;
        img.onerror = function () { img.onerror = null; if (img.parentNode) img.parentNode.replaceChild(cyano(seed, size), img); };
        img.src = track.cover; return img;
      }
      return cyano(seed, size);
    }
    var quoteKey = '';
    // ---------- [歌词位] 墙上竖排的一句：歌词 / 每日一句 ----------
    var HQ = { key: '', mode: '' };
    function lyricInfo() {
      // 提前 0.55 秒换上下一句（和这个主题换句动画的长短配好，开唱时新句已经显示出来）
      var o = { lead: 0.55 };
      try { if (ctx.lyric) return ctx.lyric(o); if (typeof homeThemeLyric === 'function') return homeThemeLyric(o); } catch (_e) { }
      return null;
    }
    function hqSpans(text) { return Array.from(String(text)).map(function (ch, i) { return '<span style="transition-delay:' + Math.min(600, i * 30) + 'ms">' + esc(ch) + '</span>'; }).join(''); }
    function pollLyric() {
      if (destroyed || !M) return;
      var L = lyricInfo(), isLy = !!(M.now && L && (L.state === 'line' || L.state === 'paused') && L.text);
      var q = M.quote && M.quote.text ? M.quote : null;
      var mode = isLy ? 'ly' : (q ? 'q' : 'none');
      E.quote.classList.toggle('pz', isLy && L.state === 'paused');
      var key = isLy ? 'L' + (L.key || L.text) : (q ? 'Q' + q.text + '|' + q.source : '');
      if (key === HQ.key) return;
      var first = !HQ.key; HQ.key = key; HQ.mode = mode;
      var paint = function () {
        E.quote.classList.toggle('ly', mode === 'ly');
        E.quote.style.display = mode === 'none' ? 'none' : '';
        if (mode === 'none') return;
        var text = String(isLy ? L.text : q.text).trim(), trText = isLy ? String(L.translation || '').trim() : '';
        // 英文句 + 中文翻译：竖排写中文（竖排里最好读），英文原句作旁边的小字
        if (isLy && trText && !/[\u3400-\u9fff]/.test(text) && /[\u3400-\u9fff]/.test(trText)) { var sw = text; text = trText; trText = sw; }
        if (!isLy && text.length > 44) text = text.slice(0, 43) + '…';
        var tail = isLy ? '<small>— 此 刻</small>' : (q.source ? '<small>— ' + esc(q.source) + '</small>' : '');
        var tr = trText ? '<span class="tr' + (/[\u3400-\u9fff]/.test(trText) ? '' : ' lat') + '">' + esc(trText) + '</span>' : '';
        // 按这一列的可用高度定字号：尽量一列写完（最小缩到 19px），实在太长才折成两列
        var lat = !/[\u3400-\u9fff]/.test(text);
        E.quote.classList.toggle('lat', isLy && lat);
        if (isLy) {
          var avail = Math.max(260, H - 350 * u - 40 * u), n = 0;
          Array.from(text).forEach(function (ch) { n += /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/.test(ch) ? 1 : (ch === ' ' ? .3 : .52); });
          var ls = lat ? .06 : .34, fs = 25 * u;
          if (n * fs * (1 + ls) > avail) fs = Math.max(19 * u, avail / (n * (1 + ls)));
          E.quote.style.fontSize = fs.toFixed(1) + 'px';
        } else E.quote.style.fontSize = '';
        E.quote.innerHTML = '<span class="qt">' + hqSpans(text) + '</span>' + tail + '<span class="re">' + (isLy ? '点一下 进播放页' : '点一下 换一句') + '</span>' + tr;
        E.quote.setAttribute('aria-label', (isLy ? '当前歌词：' : '每日一句：') + text + (isLy ? '。点一下进入播放页' : '。点一下换一句'));
        if (!first && !RM) { E.quote.classList.add('pre'); void E.quote.offsetWidth; requestAnimationFrame(function () { E.quote.classList.remove('pre'); }); }
        if (isNight) inkZones();
      };
      if (first || RM) { paint(); return; }
      E.quote.classList.add('fo');
      later(function () { E.quote.classList.remove('fo'); paint(); }, 200);
    }
    function hqAct() { if (HQ.mode === 'ly') { if (typeof A.openImmersive === 'function') call('openImmersive'); } else if (HQ.mode === 'q') call('nextQuote'); }
    on(E.quote, 'click', hqAct);
    on(E.quote, 'keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); hqAct(); } });
    var hqTimer = setInterval(function () { if (running && !destroyed) pollLyric(); }, 100);
    cleanups.push(function () { clearInterval(hqTimer); });
    function renderStatic() {
      // 为你挑选
      var pk = E.picks; pk.innerHTML = '';
      printLift = [0, 0, 0, 0];
      var items = (M.picks && M.picks.items) || [];
      if (items.length) {
        pk.innerHTML = '<div class="hd">为你挑选' + (M.picks.label ? ' · <b>' + esc(M.picks.label) + '</b>' : '') + '</div><div class="prow"></div>';
        var row = pk.querySelector('.prow');
        items.slice(0, 4).forEach(function (t, i) {
          var f = document.createElement('button'); f.type = 'button'; f.className = 'ha-print'; f.setAttribute('aria-label', '播放 ' + t.title + ' — ' + t.artist);
          f.title = t.title + ' — ' + t.artist;
          f.innerHTML = '<span class="pin"></span><span class="ph" style="display:block"></span><span class="cap">' + esc(t.title) + '<i>' + esc(t.artist) + '</i></span>';
          f.querySelector('.ph').appendChild(coverEl(t, 200));
          f.onclick = function () { call('playPick', i); };
          f.onpointerenter = f.onfocus = function () { printLift[i] = 1; wake(); };
          f.onpointerleave = f.onblur = function () { printLift[i] = 0; wake(); };
          row.appendChild(f);
        });
        ghostRects = [];
      } else {
        pk.innerHTML = '<div class="hd">为你挑选</div><div class="ghost">这里原本挂着几首歌。<br>' + (M.login.any ? '等推荐送到，光会把它们照出来。' : '登录之后，光会把它们照出来。') + '</div>';
        var pr = rel(pk); var x0 = pr.x, y0 = pr.y + 30 * u; ghostRects = [];
        for (var i = 0; i < 4; i++) ghostRects.push({ x: x0 + i * (94 + 28) * u, y: y0, w: 94 * u, h: 118 * u });
      }
      // 竖排一句话
      pollLyric();
      // 展签
      var L = [
        { k: '壹', t: '音乐库', s: M.login.any ? (M.library.playlistCount + ' 个歌单 · ' + M.library.label) : '本地音乐 · 点此导入', f: function () { M.login.any ? call('openLibrary') : call('importLocal'); }, on: true },
        { k: '贰', t: '每日推荐', s: M.daily.count ? ('今日 ' + M.daily.count + ' 首 · ' + M.daily.label) : M.daily.label, f: function () { M.daily.count ? call('playDaily', 0) : call('openLogin'); }, on: !!M.daily.count },
        { k: '叁', t: '最近播放', s: M.recent.length ? (M.recent.length + ' 首 · 所有平台') : '还没有记录', f: function () { M.recent.length ? call('playRecent', 0) : call('openLibrary'); }, on: !!M.recent.length },
        { k: '肆', t: '发现', s: M.discover.sub, f: function () { M.discover.available ? call('openDiscover') : call('openLogin'); }, on: !!M.discover.available },
        { k: '伍', t: '电台', s: M.radio.sub, f: function () { M.radio.available ? call('openRadio') : call('openLogin'); }, on: !!M.radio.available }
      ];
      var lb = E.labels; lb.innerHTML = '';
      L.forEach(function (l) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'ha-lbl' + (l.on ? '' : ' off');
        b.innerHTML = '<span class="n">' + l.k + '</span><b>' + l.t + '</b><span class="s">' + esc(l.s) + '</span>';
        b.title = l.t + ' · ' + l.s; b.onclick = l.f; lb.appendChild(b);
      });
      // 今日
      var td = M.today || {};
      E.today.innerHTML = td.count
        ? ('今日聆听<b>' + (td.minutes || 0) + '</b>分钟 ·<b>' + td.count + '</b>首<br>' + (td.topArtist ? '<em>最常听 ' + esc(td.topArtist) + '</em>' : '') + (td.streak ? (td.topArtist ? ' · ' : '') + '连续 ' + td.streak + ' 天' : ''))
        : '今天还没有听歌<br><em>光会一直在这儿等你</em>';
      // 展签不能碰到右下角的统计
      var tr = rel(E.today); var lr = rel(lb);
      lb.style.maxWidth = Math.max(260, tr.x - lr.x - 40 * u) + 'px';
      drawInk();
      collectRects();
      if (isNight) inkZones();
    }
    function collectRects() {
      rects = Array.prototype.map.call(E.picks.querySelectorAll('.ph'), function (el) { return rel(el); });
    }

    // ---------- 搜索（直接打字） ----------
    var qin = E.qin, composing = false, searching = false, shownQ = '', projRect = null, redispatching = false;
    function themeActive() {
      if (destroyed || !running || !root.isConnected) return false;
      try { if (typeof homeThemeHost !== 'undefined' && homeThemeHost && (!homeThemeHost.visible || homeThemeHost.switching || homeThemeHost.instanceId !== ID)) return false; } catch (_e) { }
      return true;
    }
    function openSearch() { if (searching) return; searching = true; K.classList.add('searching'); E.pl.classList.remove('near'); K.classList.remove('nearing'); renderProj(); poke(); }
    function closeSearch() { if (!searching) return; searching = false; K.classList.remove('searching'); if (document.activeElement === qin) { try { qin.blur(); } catch (_e) { } } qin.value = ''; shownQ = ''; E.proj.innerHTML = ''; E.phint.innerHTML = ''; projRect = null; poke(); }
    function focusQ() { if (document.activeElement !== qin) { try { qin.focus({ preventScroll: true }); } catch (_e) { qin.focus(); } } }
    // 主题显示、没有别的东西拿着焦点时，让隐藏的输入框待命（这样中文输入法从第一个键就能组字）
    function canArm() {
      if (!themeActive() || appOverlayOpen()) return false;
      var a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement || a === qin) return true;
      return root.contains(a) && !isTypingEl(a);
    }
    // [二改] 只有点了上面的搜索入口（searching）才让输入框拿焦点；没打开搜索时打字不再自动开始搜索
    function arm() { if (searching && canArm()) focusQ(); }
    function renderProj() {
      var v = qin.value;
      if (!v) {
        E.proj.classList.remove('cmp');
        setH(E.proj, '<span class="ph0">想听什么，就写在这面墙上</span><span class="cur"></span>');
        setH(E.phint, '<kbd>Esc</kbd>收起');
        shownQ = ''; setProj(); return;
      }
      var common = 0; while (common < v.length && common < shownQ.length && v[common] === shownQ[common]) common++;
      var html = '';
      for (var i = 0; i < v.length; i++) html += '<span class="' + (composing ? 'c' : '') + (i < common ? ' na' : '') + '">' + (v[i] === ' ' ? '&nbsp;' : esc(v[i])) + '</span>';
      E.proj.innerHTML = html + '<span class="cur"></span>'; E.proj._h = '';
      E.proj.classList.toggle('cmp', composing); shownQ = v;
      setH(E.phint, composing ? '选好字，再按回车' : '<kbd>↵</kbd>去曲库里找「' + esc(v.trim().slice(0, 24)) + '」<i>·</i><kbd>Esc</kbd>清空');
      setProj();
      // 太长了就往左滚，让光标一直在
      E.proj.scrollLeft = E.proj.scrollWidth;
    }
    function setProj() { var r = rel(E.proj); projRect = { x: r.x, y: r.y, w: Math.max(r.w, 200 * u), h: r.h }; }
    function submitSearch() {
      var q = qin.value.trim(); if (!q) return;
      closeSearch();
      call('search', q);
    }
    on(E.shint, 'click', function () { focusQ(); openSearch(); });
    // 焦点不在输入框（比如刚点过某个按钮）时，按下文字键：接过来，放进墙上的输入框
    on(window, 'keydown', function (e) {
      if (redispatching) return;
      if (!searching) return;   // [二改] 没点开搜索时，按键原样交给软件
      var t = e.target;
      if (t === qin) return;
      if (!themeActive()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingEl(t)) return;
      if (t && t.closest && t.closest('#playlist-panel,#search-area,.mri-slot,.modal-mask,[role="dialog"]')) return;
      if (appOverlayOpen()) return;
      var k = e.key || '';
      var ime = k === 'Process' || e.keyCode === 229;
      var printable = k.length === 1 && k !== ' ';
      if (!printable && !ime) return;
      if (!searching && printable && isConfiguredHotkey(e)) return;
      e.stopPropagation();
      focusQ();
      if (!searching) openSearch();
    }, true);
    // 输入框待命时，不是在打字的按键（空格、方向键、Esc、快捷键组合……）原样转给软件，全局快捷键照常工作
    function forward(e) {
      e.preventDefault(); e.stopPropagation();
      var init = { key: e.key, code: e.code, keyCode: e.keyCode, which: e.which, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, repeat: e.repeat, location: e.location, bubbles: true, cancelable: true, composed: true };
      var ev;
      try { ev = new KeyboardEvent('keydown', init); } catch (_e) { return; }
      try { Object.defineProperty(ev, 'keyCode', { get: function () { return init.keyCode; } }); Object.defineProperty(ev, 'which', { get: function () { return init.which; } }); } catch (_e) { }
      var hadFocus = document.activeElement === qin;
      qin.blur();
      redispatching = true;
      try { document.body.dispatchEvent(ev); } finally { redispatching = false; }
      if (hadFocus && !destroyed) later(arm, 0);
    }
    on(qin, 'keydown', function (e) {
      poke();
      if (e.isComposing || composing || e.keyCode === 229) return;
      var k = e.key || '';
      if (!searching) {
        if (k === 'Tab') return;
        forward(e); return;   // [二改] 没点开搜索：一律转给软件，不再打进墙上
      }
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); if (qin.value) { qin.value = ''; renderProj(); } else closeSearch(); return; }
      if (k === 'Enter') { e.preventDefault(); e.stopPropagation(); submitSearch(); return; }
      if (k === 'Tab') { e.preventDefault(); return; }
      e.stopPropagation();
    });
    on(qin, 'compositionstart', function () { composing = true; if (searching) renderProj(); });
    on(qin, 'compositionupdate', function () { later(renderProj, 0); });
    on(qin, 'compositionend', function () { composing = false; onQ(); });
    on(qin, 'input', function () { if (composing) { renderProj(); return; } onQ(); });
    function onQ() { if (!searching) { qin.value = ''; return; } renderProj(); }
    on(qin, 'blur', function () { later(function () { if (searching && !qin.value && document.activeElement !== qin) closeSearch(); }, 150); });
    // 搜索中点墙面别处 = 收起
    on(K, 'pointerdown', function (e) {
      if (searching && !(e.target.closest && e.target.closest('.ha-shint'))) { closeSearch(); }
    });
    // 鼠标点完东西以后，让输入框重新待命（键盘操作的焦点不动）
    on(K, 'click', function (e) { if (e.detail > 0) later(arm, 0); });
    on(window, 'focus', function () { later(arm, 30); });

    // ---------- 夜里：每块文字看它所在处的光——在台灯光或月光里用深墨，在暗处用浅色 ----------
    function wallLum(x, y) {
      var O = LT.O, U = LT.U, V = LT.V, det = U[0] * V[1] - U[1] * V[0]; var ux = x / W - O[0], uy = 1 - y / H - O[1];
      var qx = (V[1] * ux - V[0] * uy) / det, qy = (-U[1] * ux + U[0] * uy) / det; var s = 0.04;
      var box = smooth(-s, s, qx) * smooth(-s, s, 1 - qx) * smooth(-s, s, qy) * smooth(-s, s, 1 - qy);
      var lpx = x - 0.2 * W, lpy = (H - y) + 0.1 * H, D = 200 * u, rr = Math.sqrt(lpx * lpx + D * D), edge = rr * 0.62;
      var lit = smooth(edge - 6, edge + 60, lpy), fall = D * D * 1.6 / (lpx * lpx + lpy * lpy + D * D);
      return 0.78 * (LT.amb * avg3(LT.skyC) + LT.sunI * box * avg3(LT.sunC) * 0.8 + LT.lamp * (lit * fall * 1.5 + fall * 0.16) * 0.63);
    }
    var ZONES = '.ha-clock,.ha-shint,.ha-st,.ha-meta,.ha-thr,.ha-ctrl,.ha-picks .hd,.ha-print .cap,.ha-quote,.ha-lbl,.ha-today,.ha-picks .ghost';
    var SUBZONES = '.ha-thr .tm,.ha-ctrl .nx';
    function inkZones() {
      var els = K.querySelectorAll(ZONES + ',' + SUBZONES);
      Array.prototype.forEach.call(K.querySelectorAll(SUBZONES), function (el) { el._sub = 1; });
      Array.prototype.forEach.call(els, function (el) {
        if (!isNight || !gl) { el.classList.remove('litz', 'dimz'); return; }
        var r = rel(el); if (!r.w) return;
        var l = (wallLum(r.x + r.w * 0.3, r.y + r.h * 0.5) + wallLum(r.x + r.w * 0.7, r.y + r.h * 0.5)) / 2;
        var lit = l > 0.17;
        el.classList.toggle('litz', lit);
        if (el._sub) el.classList.toggle('dimz', !lit);
      });
    }

    // ---------- 渲染循环 ----------
    var objFade = 0, raf = 0, tLast = 0, phase = 0, wind = 0, energy = 0, curt = 0, focusCur = 0, t0 = performance.now(), frameN = 0, stepT = 0;
    var motes = []; (function () { var r = rng(3); for (var i = 0; i < 10; i++) motes.push({ x: r(), y: r(), d: r(), s: r(), o: r() * 6.28 }); })();
    var bird = { on: 0, t: 0, y: 0, dur: 3, k: 0 }, nextBird = performance.now() + 40000 + Math.random() * 50000;
    var R6 = new Float32Array(24), RD6 = new Float32Array(6), MO = new Float32Array(40), WI = new Float32Array(4);
    function wake() { if (!raf && running && !destroyed && !document.hidden) raf = requestAnimationFrame(frame); }
    function targetFps(now) {
      if (RM) return 0;
      var playing = !!(M && M.now && M.now.playing);
      if (now - lastInput < 2500 || hourAnim || heart.t >= 0 || bird.on || dragF != null || Math.abs(pegVel) > 0.05 || Math.abs(pegAng) > 0.05 || Math.abs(curt - (searching ? 1 : 0)) > 0.01) return 60;
      if (playing) return 30;
      return now - lastInput > 60000 ? 12 : 20;
    }
    function frame(now) {
      raf = 0; if (!running || destroyed || document.hidden) return;
      var fps = targetFps(now);
      if (fps && tLast && now - tLast < 1000 / fps - 2) { raf = requestAnimationFrame(frame); return; }
      var dt = tLast ? Math.min(0.1, (now - tLast) / 1000) : 0.016; tLast = now;
      step(dt, now); draw();
      K.classList.toggle('idle', fps <= 12);
      if (fps) raf = requestAnimationFrame(frame);
    }
    function step(dt, now) {
      var t = (now - t0) / 1000;
      // 音乐 = 风（读不到音频时，用平缓的伪随机能量 + 轻微拍点）
      var playing = !!(M && M.now && M.now.playing);
      var beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 1.53)), 12);
      var target = playing ? (0.38 + 0.25 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1) + 0.22 * beat) : 0.04;
      energy += (target - energy) * Math.min(1, dt * (playing ? 2.2 : 0.6));
      wind = energy; phase += dt * (0.25 + wind * 1.7);
      hourTarget = hourNow();
      var d = hourTarget - hourCur; if (d > 12) d -= 24; if (d < -12) d += 24;
      if (Math.abs(d) > 0.001) {
        if (Math.abs(d) > 0.05) hourAnim = true;
        hourCur += d * (RM ? 1 : Math.min(1, dt * 2.2));
        if (Math.abs(hourTarget - hourCur) < 0.01) { hourCur = hourTarget; hourAnim = false; }
      } else hourAnim = false;
      hourCur = ((hourCur % 24) + 24) % 24;
      if (wasAnim && !hourAnim) later(inkZones, 0);
      wasAnim = hourAnim;
      if (M && phaseWord(hourCur) !== lastPhase) { lastPhase = phaseWord(hourCur); dateText(); }
      LT = lightAt(hourCur);
      if (hourAnim && (frameN % 6 === 0)) inkZones();
      var night = nightOf(LT);
      if (night !== isNight) {
        isNight = night; K.classList.toggle('night', night); cordTone(night);
        later(inkZones, 0);
      }
      var sx = LT.S[0], sy = -LT.S[1]; K.style.setProperty('--sx', (sx * 7 * u).toFixed(1) + 'px'); K.style.setProperty('--sy', (sy * 7 * u).toFixed(1) + 'px');
      K.style.setProperty('--objb', night ? 0.5 : 1);
      curt += ((searching ? 1 : 0) - curt) * Math.min(1, dt * 3.2);
      focusCur += ((searching ? 1 : 0) - focusCur) * Math.min(1, dt * 4);
      objFade = searching ? Math.min(1, objFade + dt / 0.3) : Math.max(0, objFade - dt / 0.35);
      for (var i = 0; i < 4; i++) printLiftC[i] += (printLift[i] - printLiftC[i]) * Math.min(1, dt * 9);
      // 夹子摆动（弹簧）
      var targetAng = playing ? Math.sin(t * 1.7) * wind * 6 : 0;
      pegVel += ((targetAng - pegAng) * 28 - pegVel * 4.2) * dt; pegAng += pegVel * dt * 6;
      if (M && M.now && (Math.abs(pegVel) > 0.02 || playing || Math.abs(pegAng) > 0.02 || dragF != null)) drawThread();
      if (heart.t >= 0) { heart.t += dt; if (heart.t > 1.8) heart.t = -1; }
      if (!bird.on && now > nextBird && !RM) { bird = { on: 1, t: 0, y: 0.45 + Math.random() * 0.35, dur: 2.2 + Math.random() * 1.2, k: Math.random() < 0.7 ? 0 : 1 }; nextBird = now + 45000 + Math.random() * 70000; }
      if (bird.on) { bird.t += dt; if (bird.t > bird.dur) bird.on = 0; }
      stepT = t;
    }
    function draw() {
      frameN++;
      if (!gl) return;
      var t = stepT;
      gl.viewport(0, 0, bw, bh); gl.useProgram(progMain);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bakeTex); gl.uniform1i(UL.uBake, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, inkTex); gl.uniform1i(UL.uInk, 1);
      gl.uniform2f(UL.uRes, bw, bh); gl.uniform1f(UL.uInkF, 1 - focusCur * 0.88); gl.uniform1f(UL.uObjA, clamp(1 - objFade, 0, 1)); gl.uniform1f(UL.uT, t); gl.uniform1f(UL.uPh, phase); gl.uniform1f(UL.uW, wind); gl.uniform1f(UL.uRs, rs);
      gl.uniform1f(UL.uCurt, curt * 0.72); gl.uniform1f(UL.uGhost, ghostRects.length ? 1 : 0); gl.uniform1f(UL.uNight, isNight ? 1 : 0);
      var focusDim = 1 - focusCur * 0.25;
      gl.uniform3fv(UL.uSunC, LT.sunC); gl.uniform1f(UL.uSunI, LT.sunI * focusDim); gl.uniform3fv(UL.uSkyC, LT.skyC); gl.uniform1f(UL.uAmb, LT.amb * (1 - focusCur * 0.42));
      gl.uniform3f(UL.uLampC, 1.0, 0.60, 0.30); gl.uniform1f(UL.uLampI, LT.lamp); gl.uniform1f(UL.uCanopy, LT.can); gl.uniform1f(UL.uHaze, LT.haze);
      gl.uniform3fv(UL.uL, LT.L);
      // 窗影
      var O = LT.O, U = LT.U, V = LT.V, AR = W / H;
      var det = U[0] * V[1] - U[1] * V[0];
      WI[0] = V[1] / det; WI[1] = -U[1] / det; WI[2] = -V[0] / det; WI[3] = U[0] / det;
      gl.uniformMatrix2fv(UL.uWi, false, WI);
      gl.uniform2fv(UL.uO, O);
      var Ul = Math.hypot(U[0] * AR, U[1]), Vl = Math.hypot(V[0] * AR, V[1]);
      gl.uniform2f(UL.uUV, Ul, Vl); gl.uniform2f(UL.uSq, LT.soft / Ul, LT.soft / Vl);
      gl.uniform2f(UL.uS, LT.S[0] * rs, LT.S[1] * rs); gl.uniform1f(UL.uPen, LT.pen);
      // 投影物（照片、夹子）
      R6.fill(0); RD6.fill(0);
      for (var i = 0; i < rects.length && i < 4; i++) { var r = rects[i]; R6[i * 4] = r.x * rs; R6[i * 4 + 1] = (H - r.y - r.h) * rs; R6[i * 4 + 2] = r.w * rs; R6[i * 4 + 3] = r.h * rs; RD6[i] = (9 + printLiftC[i] * 16) * u; }
      if (thGeom && thGeom.px != null) { var pw = 8 * u, ph = 20 * u; R6[16] = (thGeom.px - pw / 2) * rs; R6[17] = (H - thGeom.py - ph + 4 * u) * rs; R6[18] = pw * rs; R6[19] = ph * rs; RD6[4] = 7 * u; }
      gl.uniform4fv(UL.uR, R6); gl.uniform1fv(UL.uRD, RD6);
      if (thGeom && !searching) { gl.uniform4f(UL.uTh, thGeom.x0 * rs, thGeom.x1 * rs, (H - thGeom.y) * rs, thGeom.sag * rs); gl.uniform1f(UL.uThD, 12 * u * rs); } else gl.uniform1f(UL.uThD, 0);
      // 灰尘：只有在光里才看得见
      motes.forEach(function (m, i) {
        var x = ((m.x + t * 0.004 * (m.s - 0.5) + Math.sin(t * 0.21 + m.o) * 0.012) % 1 + 1) % 1, y = ((m.y + t * 0.0035 * (0.3 + m.s) + Math.cos(t * 0.17 + m.o) * 0.01) % 1 + 1) % 1;
        var ux = x - O[0], uy = y - O[1]; var qx = (V[1] * ux - V[0] * uy) / det, qy = (-U[1] * ux + U[0] * uy) / det;
        var beam = smooth(-0.12, 0.12, qx) * smooth(-0.12, 0.12, 1 - qx) * smooth(-0.12, 0.12, qy) * smooth(-0.12, 0.12, 1 - qy);
        var rr = (2 + (1 - m.d) * 9) * u * rs; var tw = 0.6 + 0.4 * Math.sin(t * (0.6 + m.s) + m.o);
        MO[i * 4] = x * bw; MO[i * 4 + 1] = y * bh; MO[i * 4 + 2] = rr; MO[i * 4 + 3] = beam * LT.sunI * (0.18 + 0.36 * m.d) * tw * (1 - focusCur) * (isNight ? 0.3 : 1);
      });
      gl.uniform4fv(UL.uMo, MO);
      if (bird.on) {
        var k = bird.t / bird.dur; var bx = lerp(-0.1, 1.1, k), by = bird.y + Math.sin(k * 3) * 0.03; if (bird.k === 1) { bx = lerp(0.35, 0.95, k) + Math.sin(k * 9) * 0.03; by = lerp(0.95, 0.1, k); }
        gl.uniform4f(UL.uBird, bx * bw, by * bh, (bird.k ? 14 : 26) * u * rs, Math.sin(Math.PI * k) * (bird.k ? 0.9 : 0.8));
      } else gl.uniform4f(UL.uBird, 0, 0, 1, 0);
      if (heart.t >= 0) { var hk = heart.t / 1.8; gl.uniform4f(UL.uHeart, heart.x * rs, (H - heart.y + 10 * u + hk * 56 * u) * rs, (26 + hk * 16) * u * rs, Math.sin(Math.PI * Math.min(1, hk * 1.15))); }
      else gl.uniform4f(UL.uHeart, 0, 0, 1, 0);
      gl.uniform3f(UL.uLampP, 0.2 * bw, -0.10 * bh, 200 * u * rs);
      if (projRect && focusCur > 0.01) { gl.uniform4f(UL.uProj, projRect.x * rs, (H - projRect.y - projRect.h) * rs, projRect.w * rs, projRect.h * rs); gl.uniform1f(UL.uProjI, focusCur * (isNight ? 1.2 : 0.9)); }
      else gl.uniform1f(UL.uProjI, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    on(document, 'visibilitychange', function () {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
      else { tLast = 0; wake(); }
    });

    // ---------- 启动 ----------
    if (!initGL()) K.classList.add('nogl');
    layout();
    step(0.016, performance.now()); draw(); wake();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!destroyed) { titleKey = ''; lastSig = ''; if (M) render(); } });
    later(arm, 60);

    return {
      update: function (model) {
        if (destroyed || !model) return;
        M = model; render();
        if (RM) wake();
      },
      resize: function () { if (destroyed) return; layout(); },
      pause: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf); raf = 0;
        if (searching) closeSearch();
        if (document.activeElement === qin) qin.blur();
        K.classList.add('paused');
      },
      resume: function () {
        if (destroyed) return;
        running = true; tLast = 0; K.classList.remove('paused');
        var rr = root.getBoundingClientRect();
        if (Math.round(rr.width) !== W || Math.round(rr.height) !== H || rr.left !== ox || rr.top !== oy) layout();
        wake(); later(arm, 60);
      },
      back: function () { if (searching) { closeSearch(); return true; } return false; },
      destroy: function () {
        if (destroyed) return;
        destroyed = true; running = false;
        if (raf) cancelAnimationFrame(raf); raf = 0;
        timers.forEach(clearTimeout); timers = [];
        clearTimeout(vT); clearTimeout(nearT);
        if (document.activeElement === qin) qin.blur();
        cleanups.forEach(function (fn) { try { fn(); } catch (_e) { } }); cleanups = [];
        releaseGL(true);
        try { cv.width = cv.height = 1; inkCv.width = inkCv.height = 1; } catch (_e) { }
        root.innerHTML = '';
      }
    };
  }

  // ---------- 播放页背景：3D 舞台后面，一面入夜的墙上很淡的窗影和叶影（随时段换一点色温） ----------
  var BACKDROP = {
    css: [
      '#hth-backdrop.hbd-afternoon{background:radial-gradient(120% 90% at 30% 26%,#2a2420,#171412 55%,#0c0a0a)}',
      '#hth-backdrop.hbd-afternoon .hbd-win{position:absolute;left:-12%;top:-14%;width:124%;height:128%;background-size:100% 100%;opacity:.9;transform-origin:30% 40%;animation:hbd-af-drift 140s ease-in-out infinite alternate;will-change:transform}',
      '#hth-backdrop.hbd-afternoon .hbd-grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:screen;background-size:160px 160px}',
      '#hth-backdrop.hbd-afternoon .hbd-vig{position:absolute;inset:0;background:radial-gradient(120% 95% at 45% 45%,rgba(0,0,0,0) 50%,rgba(0,0,0,.6))}',
      '@keyframes hbd-af-drift{0%{transform:translate3d(0,0,0) rotate(0deg)}100%{transform:translate3d(2.5%,-1.5%,0) rotate(1.2deg)}}',
      '@media (prefers-reduced-motion:reduce){#hth-backdrop.hbd-afternoon .hbd-win{animation:none}}'
    ].join('\n'),
    html: '<div class="hbd-win"></div><div class="hbd-grain"></div><div class="hbd-vig"></div>',
    build: function (box) {
      var h = hourNow(), LT = lightAt(h), night = nightOf(LT);
      // 白天：暖金；夜里：一点点冷的月光
      var col = night ? [150, 170, 215] : [255, Math.round(170 + 60 * LT.sunC[1]), Math.round(110 + 110 * LT.sunC[2])];
      // [二改][切主题更顺] 窗影本来就是糊的，按一半分辨率画（模糊半径、光斑大小跟着减半），画面一样、耗时约为四分之一
      var Wc = 800, Hc = 450, c = document.createElement('canvas'); c.width = Wc; c.height = Hc;
      var g = c.getContext('2d'), r = rng(0xa11e);
      // 平行四边形的窗影（和主页同一个窗）
      var O = [0.30, 0.24], U = [0.44, 0.05], V = [0.12, 0.46];
      function pt(a, b) { return [(O[0] + U[0] * a + V[0] * b) * Wc, (1 - (O[1] + U[1] * a + V[1] * b)) * Hc]; }
      function quad(a0, b0, a1, b1) { var p = [pt(a0, b0), pt(a1, b0), pt(a1, b1), pt(a0, b1)]; g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (var i = 1; i < 4; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); g.fill(); }
      g.filter = 'blur(7px)';
      g.fillStyle = 'rgba(' + col.join(',') + ',' + (night ? 0.07 : 0.085) + ')';
      var panes = [[0.02, 0.02, 0.48, 0.31], [0.52, 0.02, 0.98, 0.31], [0.02, 0.35, 0.48, 0.64], [0.52, 0.35, 0.98, 0.64], [0.02, 0.68, 0.23, 0.98], [0.27, 0.68, 0.48, 0.98], [0.52, 0.68, 0.73, 0.98], [0.77, 0.68, 0.98, 0.98]];
      panes.forEach(function (p) { quad(p[0], p[1], p[2], p[3]); });
      // 叶影：在窗影里挖掉一些圆斑
      g.filter = 'blur(2.5px)';
      g.globalCompositeOperation = 'destination-out';
      for (var i = 0; i < 160; i++) {
        var a = r(), b = r(); if (a * 0.6 + b * 0.75 < 0.6) continue;
        var p = pt(a, b), rad = (4 + r() * 14) * 0.5;
        g.fillStyle = 'rgba(0,0,0,' + (0.25 + r() * 0.4).toFixed(2) + ')'; g.beginPath(); g.ellipse(p[0], p[1], rad * 1.5, rad, r() * 3, 0, 6.3); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      // 光里的几粒亮斑
      g.filter = 'blur(1px)';
      for (var j = 0; j < 26; j++) {
        var q = pt(r(), r()), rr = (3 + r() * 7) * 0.5;
        g.fillStyle = 'rgba(' + col.join(',') + ',' + (0.04 + r() * 0.05).toFixed(2) + ')'; g.beginPath(); g.arc(q[0], q[1], rr, 0, 6.3); g.fill();
      }
      g.filter = 'none';
      var win = box.querySelector('.hbd-win'), grain = box.querySelector('.hbd-grain');
      // 直接放画布，不再编码成 PNG
      if (win) { c.className = 'hbd-cv'; win.innerHTML = ''; win.appendChild(c); }
      var nz = noiseUrl(); if (grain && nz) grain.style.backgroundImage = 'url(' + nz + ')';
    }
  };

  registerHomeTheme({
    id: ID,
    name: '午后窗影',
    cordColor: 'rgba(60,48,36,.55)',
    cordGlow: 'rgba(255,236,200,0)',
    chrome: function () { return nightOf(lightAt(hourNow())) ? 'dark' : 'light'; },
    backdrop: BACKDROP,
    create: createAfternoon
  });
})();
