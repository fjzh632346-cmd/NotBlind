// ============================================================
// 启动动画「Not Blind」（一线 · 灰绿浅色版）
// 浅色底上，一道黑线从右往左、像下坡一样划过；线是一根弦，
// 画完被拨响，波纹一圈圈荡开（可带圆 / 简笔琴键 / 五线谱音符）。
// 点一下：这条黑线从中间张开，里面就是深色的首页。
// 版式、底色由 SPLASH_LAYOUT / SPLASH_PAPER 决定；全部 Canvas 2D。
// 对外接口（dismissSplash / reduceSplashMotion 等）与旧版一致。
// ============================================================

document.body.classList.add('splash-active');
var splashAnimating = true;
var splashCanvas = null, splashCtx = null;
var splashW = 0, splashH = 0;
var splashPixelRatio = 1;
var splashStartedAt = performance.now();
var splashSoundPlayed = false;
var splashAudioCtx = null;
var splashSoundFallbackArmed = false;
var splashTimer = null;
var reduceSplashMotion = false;
var splashReadyToEnter = false;
var splashExitStartedAt = 0;
var splashExitDuration = 1400;
var splashPlucks = [];
var splashRipples = [];
var splashKeys = [];
var splashNotes = [];
var splashPointer = { lastSide: 0, lastAt: 0 };

// ---------- 版式 ----------
// line: 'slope'（右上→左下的缓坡）/ 'flat'（几乎水平、微微下坡）
// circle: 圆的位置与大小；keys: 'hang'（线下挂一小排）/ 'big'（整片琴键铺到底）/ null
// staff: 画完后在上下长出五线谱；notes: 音符落在谱线上
var SPLASH_LAYOUTS = {
  paper: { label: '一线', line: 'slope', circle: { u: .40, r: .105 }, keys: 'hang', staff: false, notes: false, name: [.085, .19] },
  horizon: { label: '地平线', line: 'flat', circle: { u: .30, r: .15 }, keys: null, staff: false, notes: false, name: [.085, .30] },
  staff: { label: '五线谱', line: 'slope', circle: null, keys: null, staff: true, notes: true, name: [.085, .19] },
  keys: { label: '琴键', line: 'flat', circle: { u: .72, r: .045 }, keys: 'big', staff: false, notes: false, name: [.085, .22] }
};
// 底色：线永远是黑色；最后张开时里面是首页的深色
var SPLASH_PAPERS = {
  warm: { label: '宣纸', bg: '#ece7dc', ink: '#161514', soft: 'rgba(22,21,20,' },
  mist: { label: '雾白', bg: '#eceeef', ink: '#15171a', soft: 'rgba(21,23,26,' },
  sage: { label: '灰绿', bg: '#dfe3dc', ink: '#141614', soft: 'rgba(20,22,20,' },
  apricot: { label: '浅杏', bg: '#f1e4d6', ink: '#1a1512', soft: 'rgba(26,21,18,' }
};
var SPLASH_LAYOUT = (typeof window.SPLASH_LAYOUT_NAME === 'string' && SPLASH_LAYOUTS[window.SPLASH_LAYOUT_NAME]) || SPLASH_LAYOUTS.horizon; // 用户选定：地平线
var SPLASH_PAPER = (typeof window.SPLASH_PAPER_NAME === 'string' && SPLASH_PAPERS[window.SPLASH_PAPER_NAME]) || SPLASH_PAPERS.sage; // 用户选定：灰绿

// ---------- 时间线（秒） ----------
var SP_DRAW_START = 0.35;
var SP_DRAW_DUR = 1.25;
var SP_CIRCLE_AT = 1.00;
var SP_CIRCLE_DUR = 0.85;
var SP_PLUCK_AT = 1.70;
var SP_STAFF_AT = 1.55;
var SP_READY_AT = SPLASH_LAYOUT.notes ? 3.3 : 2.9;
var SP_IDLE_RIPPLE = 7.0;
var SP_KEYS_U0 = 0.55, SP_KEYS_U1 = 0.88;

function splashClamp01(v) { return Math.max(0, Math.min(1, v)); }
function splashSmoothstep(a, b, x) { var t = splashClamp01((x - a) / Math.max(1e-4, b - a)); return t * t * (3 - 2 * t); }
function splashEaseOutCubic(t) { t = splashClamp01(t); return 1 - Math.pow(1 - t, 3); }
function splashEaseOutQuart(t) { t = splashClamp01(t); return 1 - Math.pow(1 - t, 4); }
function splashEaseInOut(t) { t = splashClamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function splashEaseInCubic(t) { t = splashClamp01(t); return t * t * t; }
function splashInk(a) { return SPLASH_PAPER.soft + a.toFixed(3) + ')'; }

// ---------- 线的几何（u=0 右端，u=1 左端） ----------
function splashLineX(u) { return splashW * (1.03 - 1.06 * u); }
function splashLineBaseY(u) {
  var s = u * u * (3 - 2 * u);
  if (SPLASH_LAYOUT.line === 'flat') return splashH * (.55 + .07 * (s * .5 + u * .5));
  return splashH * (.30 + .46 * (s * .55 + u * .45));
}
function splashLineOffset(u, t) {
  var y = 0;
  var ends = Math.sin(Math.PI * splashClamp01(u));
  for (var i = 0; i < splashPlucks.length; i++) {
    var p = splashPlucks[i];
    var dt = t - p.t;
    if (dt < 0 || dt > 2.4) continue;
    var env = Math.exp(-dt * p.decay);
    var shape = Math.exp(-Math.pow((u - p.u) / p.w, 2));
    y += p.amp * env * ends * (shape * Math.sin(dt * 34) + .45 * Math.sin(u * 22 - dt * 16) * Math.exp(-Math.pow((u - p.u) / (p.w * 3), 2)));
  }
  return y;
}
function splashLineY(u, t) { return splashLineBaseY(u) + splashLineOffset(u, t); }
function splashDrawHead(t) { return splashEaseInOut((t - SP_DRAW_START) / SP_DRAW_DUR); }
function splashCircleR() { return SPLASH_LAYOUT.circle ? Math.min(splashW, splashH) * SPLASH_LAYOUT.circle.r : 0; }
function splashStaffGap() { return Math.max(11, splashH * .016); }
function splashUAtX(x) { return (splashW * 1.03 - x) / (splashW * 1.06); }

// ---------- 场景元素 ----------
function buildSplashKeys() {
  splashKeys = [];
  if (!SPLASH_LAYOUT.keys) return;
  var pattern = [1, 1, 0, 1, 1, 1, 0];
  var big = SPLASH_LAYOUT.keys === 'big';
  var u0 = big ? -.02 : SP_KEYS_U0, u1 = big ? 1.02 : SP_KEYS_U1;
  var keyLen = big ? Math.max(34, splashW * .028) : Math.max(15, splashW * .0125);
  var n = 0, acc = 0, steps = 600;
  var prevX = splashLineX(u0), prevY = splashLineBaseY(u0);
  for (var i = 1; i <= steps; i++) {
    var u = u0 + (u1 - u0) * i / steps;
    var x = splashLineX(u), y = splashLineBaseY(u);
    acc += Math.hypot(x - prevX, y - prevY);
    prevX = x; prevY = y;
    if (acc >= keyLen) {
      acc = 0;
      splashKeys.push({ u: u, black: false, idx: n });
      if (pattern[n % 7]) splashKeys.push({ u: u, black: true, idx: n });
      n++;
    }
  }
}
function buildSplashNotes() {
  splashNotes = [];
  if (!SPLASH_LAYOUT.notes) return;
  // 一小句旋律：u 位置、谱上高度（半格为单位，0=中线，正数往上）、落下时刻、音高
  var phrase = [
    { u: .30, step: -2, t: 1.95, f: 587.33 },
    { u: .38, step: 0, t: 2.20, f: 739.99 },
    { u: .46, step: 1, t: 2.45, f: 880.00 },
    { u: .54, step: 3, t: 2.70, f: 987.77 },
    { u: .64, step: 1, t: 3.00, f: 880.00, whole: true }
  ];
  phrase.forEach(function (n) { splashNotes.push(n); });
}
function splashNotePos(n, t) {
  var gap = splashStaffGap();
  return { x: splashLineX(n.u), y: splashLineY(n.u, t) - n.step * gap / 2 };
}

// ---------- 绘制 ----------
function traceSplashLine(ctx, u0, u1, t, steps, dy) {
  steps = steps || 200;
  dy = dy || 0;
  for (var i = 0; i <= steps; i++) {
    var u = u0 + (u1 - u0) * i / steps;
    var x = splashLineX(u), y = splashLineY(u, t) + dy;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

function drawSplashLine(ctx, head, t, tension) {
  if (head <= 0) return;
  var steps = Math.max(10, Math.round(260 * head));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 线下一层很淡的影子：像墨落在纸上稍微洇开
  ctx.strokeStyle = splashInk(.06);
  ctx.lineWidth = 7 + tension * 4;
  ctx.beginPath(); traceSplashLine(ctx, -.02, head, t, steps); ctx.stroke();
  ctx.strokeStyle = SPLASH_PAPER.ink;
  ctx.lineWidth = 2.6 + tension * 1.6;
  ctx.beginPath(); traceSplashLine(ctx, -.02, head, t, steps); ctx.stroke();
  ctx.restore();
  // 笔尖：一颗小墨点
  if (head < 1) {
    var hx = splashLineX(head), hy = splashLineY(head, t);
    ctx.fillStyle = SPLASH_PAPER.ink;
    ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, 6.2832); ctx.fill();
  }
}

function drawSplashStaff(ctx, t, alpha) {
  if (!SPLASH_LAYOUT.staff) return;
  var gap = splashStaffGap();
  var offs = [-2, -1, 1, 2];
  ctx.save();
  ctx.lineCap = 'round';
  for (var i = 0; i < offs.length; i++) {
    var p = splashEaseOutCubic((t - SP_STAFF_AT - Math.abs(offs[i]) * .08) / .6);
    if (p <= 0) continue;
    ctx.strokeStyle = splashInk(.55 * alpha);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    traceSplashLine(ctx, -.02, -.02 + 1.04 * p, t, 200, offs[i] * gap);
    ctx.stroke();
  }
  // 谱号位置：左端一条竖线（小节线）
  var pb = splashSmoothstep(SP_STAFF_AT + .4, SP_STAFF_AT + .8, t) * alpha;
  if (pb > 0) {
    ctx.strokeStyle = splashInk(.7 * pb);
    ctx.lineWidth = 1.6;
    var ub = .80, bx = splashLineX(ub), by = splashLineY(ub, t);
    ctx.beginPath(); ctx.moveTo(bx, by - 2 * gap); ctx.lineTo(bx, by + 2 * gap); ctx.stroke();
  }
  ctx.restore();
}

function drawSplashNotes(ctx, t, alpha) {
  if (!splashNotes.length) return;
  var gap = splashStaffGap();
  ctx.save();
  for (var i = 0; i < splashNotes.length; i++) {
    var n = splashNotes[i];
    var dt = t - n.t;
    if (dt < -.25) continue;
    // 从上方落下，落到线上时轻轻一弹
    var fall = dt < 0 ? splashEaseInCubic((dt + .25) / .25) : 1;
    var bounce = dt >= 0 ? Math.exp(-dt * 9) * Math.sin(dt * 30) * 3 : 0;
    var pos = splashNotePos(n, t);
    var y = pos.y - (1 - fall) * 60 - bounce;
    var a = splashSmoothstep(-.25, -.1, dt) * alpha;
    ctx.save();
    ctx.translate(pos.x, y);
    ctx.rotate(-.35);
    ctx.fillStyle = splashInk(a);
    ctx.strokeStyle = splashInk(a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, gap * .62, gap * .43, 0, 0, 6.2832);
    if (n.whole) ctx.stroke(); else ctx.fill();
    ctx.restore();
    if (!n.whole) {
      ctx.strokeStyle = splashInk(a);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(pos.x + gap * .55, y - 1);
      ctx.lineTo(pos.x + gap * .55, y - gap * 3.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSplashCircle(ctx, t, alpha) {
  if (!SPLASH_LAYOUT.circle) return;
  var cu = SPLASH_LAYOUT.circle.u;
  var p = splashEaseOutCubic((t - SP_CIRCLE_AT) / SP_CIRCLE_DUR);
  if (p <= 0) return;
  var cx = splashLineX(cu), cy = splashLineY(cu, t);
  var R = splashCircleR();
  var a0 = Math.atan2(splashLineBaseY(cu - .01) - splashLineBaseY(cu), splashLineX(cu - .01) - splashLineX(cu));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = splashInk(.95 * alpha);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, a0, a0 + p * 6.2832);
  ctx.stroke();
  var p2 = splashEaseOutCubic((t - SP_CIRCLE_AT - .35) / .7);
  if (p2 > 0 && R > 30) {
    ctx.strokeStyle = splashInk(.30 * alpha * p2);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R * .34 * (.6 + .4 * p2), 0, 6.2832);
    ctx.stroke();
  }
  if (p2 > 0) {
    ctx.fillStyle = splashInk(.95 * alpha * p2);
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();
}

function splashRippleMaxR() { return Math.hypot(splashW, splashH) * .62; }
function drawSplashRipples(ctx, t, alpha) {
  ctx.save();
  ctx.lineWidth = 1.2;
  for (var i = 0; i < splashRipples.length; i++) {
    var rp = splashRipples[i];
    for (var k = 0; k < rp.rings; k++) {
      var dt = t - rp.t - k * .22;
      if (dt < 0 || dt > rp.life) continue;
      var r = rp.r0 + (rp.maxR - rp.r0) * splashEaseOutQuart(dt / rp.life);
      var a = rp.strength * (1 - splashSmoothstep(0, rp.life, dt)) * (k === 0 ? .5 : .28) * alpha;
      if (a < .004) continue;
      ctx.strokeStyle = splashInk(a);
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, r, 0, 6.2832);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function splashRippleHitTime(rp, key) {
  var d = Math.hypot(splashLineX(key.u) - rp.x, splashLineBaseY(key.u) - rp.y);
  var target = splashClamp01((d - rp.r0) / (rp.maxR - rp.r0));
  var x = 1 - Math.pow(1 - target, 1 / 4);
  return rp.t + x * rp.life;
}

function drawSplashKeys(ctx, t, head, alpha) {
  if (!splashKeys.length) return;
  var big = SPLASH_LAYOUT.keys === 'big';
  var whiteLen = big ? splashH : Math.max(14, splashH * .026);
  var blackLen = big ? splashH * .18 : whiteLen * .6;
  var blackW = big ? Math.max(12, splashW * .014) : 3.6;
  ctx.save();
  for (var i = 0; i < splashKeys.length; i++) {
    var k = splashKeys[i];
    if (k.u > head) continue;
    var appear = splashSmoothstep(0, .5, t - (SP_DRAW_START + SP_DRAW_DUR * .9) - Math.abs(k.u - .5) * .5);
    if (appear <= 0) continue;
    var press = 0;
    for (var r = 0; r < splashRipples.length; r++) {
      var ht = splashRippleHitTime(splashRipples[r], k);
      var dt = t - ht;
      if (dt >= 0 && dt < 1.2) press = Math.max(press, splashRipples[r].strength * Math.exp(-dt * 3.2));
    }
    var x = splashLineX(k.u), y = splashLineY(k.u, t);
    var sink = press * (big ? 5 : 2.2);
    if (k.black) {
      ctx.fillStyle = splashInk((big ? .9 : .7) * appear * alpha);
      if (big) {
        // 大琴键：按下时黑键上缘浮出一点亮边
        ctx.fillRect(x - blackW / 2, y + 2 + sink, blackW, blackLen * appear);
        if (press > .05) { ctx.fillStyle = SPLASH_PAPER.bg; ctx.globalAlpha = press * .5; ctx.fillRect(x - blackW / 2 + 2, y + 6 + sink, blackW - 4, 2); ctx.globalAlpha = 1; }
      } else {
        ctx.fillRect(x - 1.8, y + 3 + sink, 3.6, blackLen * appear);
      }
    } else {
      ctx.strokeStyle = splashInk(((big ? .28 : .3) + .6 * press) * appear * alpha);
      ctx.lineWidth = big ? 1.2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 3 + sink);
      ctx.lineTo(x, y + 3 + sink + whiteLen * appear);
      ctx.stroke();
      if (big && press > .05) {
        // 白键被按下：键面上浮出一块很淡的影子
        ctx.fillStyle = splashInk(.07 * press * alpha);
        var next = splashKeys[i + 1] && !splashKeys[i + 1].black ? splashKeys[i + 1] : splashKeys[i + 2];
        if (next) ctx.fillRect(x, y + 3, splashLineX(next.u) - x, splashH);
      }
    }
  }
  if (!big) {
    var a2 = splashSmoothstep(SP_DRAW_START + SP_DRAW_DUR, SP_DRAW_START + SP_DRAW_DUR + .6, t) * alpha;
    if (a2 > 0) {
      ctx.strokeStyle = splashInk(.22 * a2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var s = 0; s <= 80; s++) {
        var u = SP_KEYS_U0 + (Math.min(head, SP_KEYS_U1) - SP_KEYS_U0) * s / 80;
        var yy = splashLineY(u, t) + 3 + whiteLen;
        if (s === 0) ctx.moveTo(splashLineX(u), yy); else ctx.lineTo(splashLineX(u), yy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function splashAddRipple(x, y, at, strength, rings, r0, maxR, life) {
  splashRipples.push({ x: x, y: y, t: at, strength: strength, rings: rings, r0: r0, maxR: maxR, life: life });
}

function drawMineradioSplash() {
  if (!splashAnimating || !splashCtx) return;
  requestAnimationFrame(drawMineradioSplash);
  var now = performance.now();
  var t = reduceSplashMotion ? 8 : (now - splashStartedAt) / 1000;
  var ex = splashExitStartedAt ? splashClamp01((now - splashExitStartedAt) / splashExitDuration) : 0;
  var ctx = splashCtx;
  ctx.setTransform(splashPixelRatio, 0, 0, splashPixelRatio, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, splashW, splashH);
  ctx.fillStyle = SPLASH_PAPER.bg;
  ctx.fillRect(0, 0, splashW, splashH);
  // 很淡的暗角，让纸面有一点体积
  var vg = ctx.createRadialGradient(splashW * .5, splashH * .45, splashH * .3, splashW * .5, splashH * .5, Math.hypot(splashW, splashH) * .62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.07)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, splashW, splashH);

  // 待机：隔一阵再荡一圈
  if (!reduceSplashMotion && !ex && t > SP_PLUCK_AT + SP_IDLE_RIPPLE) {
    var n = Math.floor((t - SP_PLUCK_AT) / SP_IDLE_RIPPLE);
    var at = SP_PLUCK_AT + n * SP_IDLE_RIPPLE;
    if (!splashRipples.some(function (r) { return Math.abs(r.t - at) < .01; })) {
      var src = splashRippleSource();
      splashAddRipple(src.x, src.y, at, .55, 1, src.r0, splashRippleMaxR(), 3.4);
      splashPlucks.push({ u: src.u, t: at, amp: 3, w: .10, decay: 3.2 });
      splashPlayIdleNote();
    }
  }

  var head = splashDrawHead(t);
  var fadeScene = 1 - splashSmoothstep(.02, .30, ex);
  var tension = splashSmoothstep(0, .16, ex);
  drawSplashRipples(ctx, t, fadeScene);
  drawSplashKeys(ctx, t, head, fadeScene);
  drawSplashStaff(ctx, t, fadeScene);
  drawSplashNotes(ctx, t, fadeScene);
  drawSplashCircle(ctx, t, fadeScene);
  drawSplashLine(ctx, head, t, tension);

  // 退出：黑线从中间张开，缝里就是首页（深色）
  if (ex > 0) {
    var open = splashEaseInCubic((ex - .14) / .62);
    var half = open * splashH * 1.2;
    if (half > .4) {
      var st = 160, i, pts = [];
      ctx.save();
      ctx.beginPath();
      for (i = 0; i <= st; i++) { var u = -.03 + 1.06 * i / st; ctx.lineTo(splashLineX(u), splashLineBaseY(u) - half); }
      for (i = st; i >= 0; i--) { var u2 = -.03 + 1.06 * i / st; ctx.lineTo(splashLineX(u2), splashLineBaseY(u2) + half); }
      ctx.closePath();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
      // 裂口两边是分开的那条黑线
      ctx.save();
      ctx.strokeStyle = SPLASH_PAPER.ink;
      ctx.lineWidth = 3.4;
      ctx.lineJoin = 'round';
      for (var side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        for (i = 0; i <= st; i++) { var u3 = -.03 + 1.06 * i / st; var yy = splashLineBaseY(u3) + side * half; if (i === 0) ctx.moveTo(splashLineX(u3), yy); else ctx.lineTo(splashLineX(u3), yy); }
        ctx.stroke();
      }
      ctx.restore();
    }
    var through = splashSmoothstep(.72, .98, ex);
    if (through > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,' + through.toFixed(3) + ')';
      ctx.fillRect(0, 0, splashW, splashH);
      ctx.restore();
    }
  }
}

// 波纹从哪儿荡开：有圆就从圆心，否则从最后一个音符 / 线的中段
function splashRippleSource() {
  if (SPLASH_LAYOUT.circle) {
    var cu = SPLASH_LAYOUT.circle.u;
    return { x: splashLineX(cu), y: splashLineBaseY(cu), u: cu, r0: splashCircleR() };
  }
  if (splashNotes.length) {
    var last = splashNotes[splashNotes.length - 1];
    return { x: splashLineX(last.u), y: splashLineBaseY(last.u) - last.step * splashStaffGap() / 2, u: last.u, r0: splashStaffGap() };
  }
  return { x: splashLineX(.5), y: splashLineBaseY(.5), u: .5, r0: 6 };
}

function splashHandlePointer(e) {
  if (!splashCtx || splashExitStartedAt || reduceSplashMotion) return;
  var t = (performance.now() - splashStartedAt) / 1000;
  if (splashDrawHead(t) < 1) return;
  var u = splashClamp01(splashUAtX(e.clientX));
  var side = e.clientY < splashLineBaseY(u) ? -1 : 1;
  if (splashPointer.lastSide && side !== splashPointer.lastSide && performance.now() - splashPointer.lastAt > 160) {
    var speed = Math.min(1, Math.abs(e.movementY || 6) / 18);
    splashPlucks.push({ u: u, t: t, amp: 2.5 + 5 * speed, w: .07, decay: 3.6 });
    if (splashPlucks.length > 12) splashPlucks.shift();
    splashPlayPluck(u, .35 + .5 * speed);
    splashPointer.lastAt = performance.now();
  }
  splashPointer.lastSide = side;
}

function splashSplitWordmark() {
  var el = document.getElementById('splash-name');
  if (!el) return;
  var text = el.getAttribute('data-name') || el.textContent;
  el.textContent = '';
  var base = SPLASH_LAYOUT.notes ? 2.4 : 2.05;
  Array.from(text).forEach(function (ch, i) {
    var s = document.createElement('span');
    s.className = 'splash-char';
    s.textContent = ch;
    s.style.animationDelay = reduceSplashMotion ? '0ms' : Math.round((base + i * .09) * 1000) + 'ms';
    el.appendChild(s);
  });
}

(function initMineradioSplashCanvas() {
  splashCanvas = document.getElementById('splash-canvas');
  if (!splashCanvas) return;
  splashCtx = splashCanvas.getContext('2d');
  var s = document.getElementById('splash');
  if (s) {
    s.style.setProperty('--sp-bg', SPLASH_PAPER.bg);
    s.style.setProperty('--sp-ink', SPLASH_PAPER.ink);
    s.setAttribute('data-layout', Object.keys(SPLASH_LAYOUTS).filter(function (k) { return SPLASH_LAYOUTS[k] === SPLASH_LAYOUT; })[0] || 'paper');
  }
  function resize() {
    // [二改][内存] 开场结束后画布已释放，之后窗口变大小（比如进桌面模式铺满整屏）不再重新分配
    if (!splashAnimating) return;
    splashPixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    splashW = window.innerWidth;
    splashH = window.innerHeight;
    splashCanvas.width = Math.max(1, Math.floor(splashW * splashPixelRatio));
    splashCanvas.height = Math.max(1, Math.floor(splashH * splashPixelRatio));
    buildSplashKeys();
    buildSplashNotes();
    splashRipples = [];
    splashSeedTimeline();
    if (s) {
      s.style.setProperty('--sp-name-x', Math.round(splashW * SPLASH_LAYOUT.name[0]) + 'px');
      s.style.setProperty('--sp-name-y', Math.round(splashH * SPLASH_LAYOUT.name[1]) + 'px');
    }
  }
  resize();
  splashSplitWordmark();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', splashHandlePointer);
  drawMineradioSplash();
})();

// 开场的拨弦与波纹（尺寸变化时按新尺寸重新放）
function splashSeedTimeline() {
  if (!splashPlucks.some(function (p) { return p.seed; })) {
    var pu = SPLASH_LAYOUT.circle ? SPLASH_LAYOUT.circle.u : .5;
    splashPlucks.push({ u: pu, t: SP_PLUCK_AT, amp: 7, w: .16, decay: 2.4, seed: true });
  }
  if (SPLASH_LAYOUT.notes) {
    splashNotes.forEach(function (n, i) {
      var p = splashNotePos(n, n.t);
      splashAddRipple(p.x, p.y, n.t, i === splashNotes.length - 1 ? 1 : .6, i === splashNotes.length - 1 ? 3 : 1,
        splashStaffGap(), i === splashNotes.length - 1 ? splashRippleMaxR() : splashH * .13, i === splashNotes.length - 1 ? 3.4 : 1.2);
      splashPlucks.push({ u: n.u, t: n.t, amp: 2.2, w: .05, decay: 4 });
    });
  } else {
    var src = splashRippleSource();
    splashAddRipple(src.x, src.y, SP_PLUCK_AT, 1, 3, src.r0, splashRippleMaxR(), 3.4);
  }
}
function stopSplashIntroSound() {
  if (!splashAudioCtx) return;
  try { if (splashAudioCtx.close) splashAudioCtx.close(); } catch (e) { }
  splashAudioCtx = null;
}
var splashMaster = null;
function splashTone(freq, when, peak, dur, bright) {
  var ctx = splashAudioCtx;
  if (!ctx || !splashMaster) return;
  var start = Math.max(ctx.currentTime, when);
  // 像钢琴的单音：基频 + 略不整齐的泛音，快起慢落
  [[1, 1], [2.003, .42 * bright], [3.01, .18 * bright], [4.02, .07 * bright]].forEach(function (h) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * h[0], start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak * h[1], start + .006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur / (1 + (h[0] - 1) * .6));
    o.connect(g); g.connect(splashMaster);
    o.start(start); o.stop(start + dur + .05);
  });
}
function splashSetupAudio() {
  var ctx = splashAudioCtx;
  splashMaster = ctx.createGain();
  splashMaster.gain.value = .9;
  var comp = ctx.createDynamicsCompressor();
  // 简单的空间感
  var delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
  delay.delayTime.value = .31; fb.gain.value = .32; wet.gain.value = .26; lp.type = 'lowpass'; lp.frequency.value = 2600;
  splashMaster.connect(comp);
  splashMaster.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(comp);
  comp.connect(ctx.destination);
}
// 五声音阶（D 大调五声），从低到高对应琴键从近到远
var SPLASH_SCALE = [293.66, 329.63, 369.99, 440.00, 493.88, 587.33, 659.25, 739.99, 880.00, 987.77, 1174.66];
function playMineradioIntroSound() {
  if (splashSoundPlayed) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = splashAudioCtx || new AC();
    splashAudioCtx = ctx;
    if (ctx.state === 'suspended' && ctx.resume) {
      ctx.resume().then(function () { if (!splashSoundPlayed) playMineradioIntroSound(); }).catch(function () { });
      if (ctx.state === 'suspended') return;
    }
    splashSoundPlayed = true;
    splashSetupAudio();
    var elapsed = (performance.now() - splashStartedAt) / 1000;
    var base = ctx.currentTime - elapsed; // 动画的 0 秒对应的音频时间
    // 划线的气声：很轻的一道白噪，跟着笔尖从右到左（声像从右到左）
    if (elapsed < SP_DRAW_START + SP_DRAW_DUR) {
      var len = SP_DRAW_DUR + .3;
      var nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
      var d = nb.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.buffer = nb; bp.type = 'bandpass'; bp.Q.value = 2.2;
      var s0 = Math.max(ctx.currentTime, base + SP_DRAW_START);
      bp.frequency.setValueAtTime(5200, s0); bp.frequency.exponentialRampToValueAtTime(1800, s0 + SP_DRAW_DUR);
      g.gain.setValueAtTime(0.0001, s0); g.gain.exponentialRampToValueAtTime(.05, s0 + .25); g.gain.exponentialRampToValueAtTime(0.0001, s0 + SP_DRAW_DUR + .2);
      src.connect(bp); bp.connect(g);
      if (pan) { pan.pan.setValueAtTime(.8, s0); pan.pan.linearRampToValueAtTime(-.8, s0 + SP_DRAW_DUR); g.connect(pan); pan.connect(splashMaster); } else g.connect(splashMaster);
      src.start(s0); src.stop(s0 + len);
    }
    // 拨弦：圆心那一声（低音 D + 高八度）
    splashTone(146.83, base + SP_PLUCK_AT, .20, 4.5, 1);
    splashTone(293.66, base + SP_PLUCK_AT + .004, .12, 3.6, .8);
    if (SPLASH_LAYOUT.notes) {
      // 五线谱：每个音符落到线上时响一声
      splashNotes.forEach(function (n) { splashTone(n.f, base + n.t, n.whole ? .10 : .075, n.whole ? 3.2 : 1.8, .6); });
    } else if (splashKeys.length) {
      // 波纹经过琴键：从近到远依次响起，形成上行琶音
      var rp = splashRipples[0];
      var ks = splashKeys.filter(function (k) { return !k.black; }).map(function (k) { return { k: k, at: splashRippleHitTime(rp, k) }; })
        .sort(function (a, b) { return a.at - b.at; });
      var step = Math.max(1, Math.floor(ks.length / SPLASH_SCALE.length));
      var played = 0;
      for (var q = 0; q < ks.length && played < SPLASH_SCALE.length; q += step) {
        splashTone(SPLASH_SCALE[played], base + ks[q].at, .075 * (1 - played * .05), 2.2, .6);
        played++;
      }
    } else {
      // 只有圆：三圈波纹各带一个音
      [0, .22, .44].forEach(function (d, i) { splashTone([440, 587.33, 739.99][i], base + SP_PLUCK_AT + .35 + d * 1.6, .06, 2.6, .5); });
    }
  } catch (e) { }
}
function splashPlayIdleNote() {
  try {
    if (!splashAudioCtx || splashAudioCtx.state !== 'running' || !splashMaster) return;
    var ctx = splashAudioCtx;
    splashTone(293.66, ctx.currentTime + .01, .06, 3.2, .7);
    splashTone(440.00, ctx.currentTime + .30, .035, 2.6, .5);
  } catch (e) { }
}
function splashPlayPluck(u, vel) {
  try {
    if (!splashAudioCtx || splashAudioCtx.state !== 'running' || !splashMaster) return;
    // 越往左（坡底）音越低，像一根越来越粗的弦
    var idx = Math.round((1 - u) * (SPLASH_SCALE.length - 1));
    splashTone(SPLASH_SCALE[idx], splashAudioCtx.currentTime + .005, .05 * vel, 1.8, .7);
  } catch (e) { }
}
function playMineradioExitSound() {
  try {
    if (!splashAudioCtx || splashAudioCtx.state !== 'running' || !splashMaster) return;
    var ctx = splashAudioCtx, now = ctx.currentTime;
    // 冲过去的风声：带通噪声由低到高
    var nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.2), ctx.sampleRate);
    var d = nb.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = nb; bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(400, now); bp.frequency.exponentialRampToValueAtTime(6000, now + .9);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(.09, now + .7); g.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
    src.connect(bp); bp.connect(g); g.connect(splashMaster);
    src.start(now); src.stop(now + 1.2);
    // 穿过去那一刻：一个明亮的和弦
    [587.33, 739.99, 880.00, 1174.66].forEach(function (f, i) { splashTone(f, now + .78 + i * .025, .06, 2.6, .5); });
  } catch (e) { }
}
function armSplashSoundFallback() {
  if (splashSoundFallbackArmed) return;
  splashSoundFallbackArmed = true;
  function unlock() {
    if (!splashSoundPlayed) playMineradioIntroSound();
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
}

// ---------- 与宿主的衔接（接口与旧版一致） ----------
function releaseStartupFastSkipPreload() {
  if (!document.documentElement.classList.contains('startup-fast-skip-preload')) return false;
  document.body.classList.add('startup-fast-skip-revealing');
  // 秒启动时整页先被隐藏；桌面模式会短暂隐藏并重挂窗口，这里必须同步解除
  document.documentElement.classList.remove('startup-fast-skip-preload');
  setTimeout(function () { document.body.classList.remove('startup-fast-skip-revealing'); }, 520);
  return true;
}

function finishSplashReveal(forceLoad, opts) {
  opts = opts || {};
  markAppPerf('home-revealed');
  if (typeof resumeSavedGestureControl === 'function') {
    setTimeout(function () { resumeSavedGestureControl(opts.reason || 'splash-reveal'); }, opts.fastSkip ? 120 : 260);
  }
  releaseStartupFastSkipPreload();
  requestAnimationFrame(function () {
    var homeShown = updateEmptyHomeVisibility({ forceLoad: forceLoad !== false });
    if (!homeShown && shouldForceEmptyHomeAfterSplash()) {
      homeSuppressed = false;
      homeForcedOpen = true;
      homeShown = updateEmptyHomeVisibility({ forceLoad: forceLoad !== false });
    }
    requestAnimationFrame(function () {
      markStartupHomeReadyForAutoplay(opts.reason || 'splash', opts.fastSkip ? 240 : 100);
      var guideStarted = maybeRunStartupVisualGuide('splash');
      if (!guideStarted && !hasAnyPlatformLogin()) maybeRunStartupLoginGuide('splash');
      else if (!guideStarted && !homeShown) maybeRunStartupLoginGuide('splash');
      setTimeout(maybeShowUploadTipOnce, 5200);
    });
  });
}

// [二改][内存] 开场画布按 2 倍像素铺满屏幕（4K 下三十多 MB），开场结束后一直留着没用；这里还掉
function releaseSplashCanvas() {
  try {
    if (splashCanvas) { splashCanvas.width = 0; splashCanvas.height = 0; }
    splashRipples = [];
  } catch (_) { }
}

function dismissSplash(opts) {
  opts = opts || {};
  var s = document.getElementById('splash');
  if (!s || s.classList.contains('hide') || s.classList.contains('exiting')) return;
  var instant = !!opts.instant;
  markAppPerf(instant ? 'splash-skip' : 'splash-dismiss');
  if (splashTimer) { clearTimeout(splashTimer); splashTimer = null; }
  splashReadyToEnter = false;
  s.classList.remove('ready');
  if (instant) {
    stopSplashIntroSound();
    s.classList.add('hide');
    s.style.display = 'none';
    splashAnimating = false;
    releaseSplashCanvas();
    document.body.classList.remove('splash-active');
    document.body.classList.remove('splash-revealing');
    revealIdleParticles(0, 520);
    finishSplashReveal(true, { fastSkip: true, reason: 'fast-skip' });
    return;
  }
  playMineradioExitSound();
  setTimeout(stopSplashIntroSound, 3200);
  if (typeof shouldUseIdleWallpaperPreview === 'function'
    ? shouldUseIdleWallpaperPreview(true)
    : (typeof shouldShowEmptyHomeAfterSplash === 'function' && shouldShowEmptyHomeAfterSplash())) {
    activateHomeWallpaperPreview();
  }
  // [二改][开场直进主页] 张开之前确认主页主题已经垫在开场页下面（没提前搭好就现在搭），
  // 缝里露出来的就是主页，而不是先闪一下播放页
  if (typeof homeThemeRevealFromSplash === 'function') { try { homeThemeRevealFromSplash(); } catch (_) { } }
  var duration = reduceSplashMotion ? 600 : splashExitDuration;
  splashExitDuration = duration;
  splashExitStartedAt = performance.now();
  s.classList.add('exiting');
  document.body.classList.add('splash-revealing');
  revealIdleParticles(0, reduceSplashMotion ? 520 : 920);
  // 光涌满屏幕的时候，主页在后面就位
  setTimeout(function () {
    document.body.classList.remove('splash-active');
    finishSplashReveal(true, { reason: 'splash-dismiss' });
  }, Math.round(duration * .45));
  setTimeout(function () {
    s.classList.add('hide');
    splashAnimating = false;
    releaseSplashCanvas();
    document.body.classList.remove('splash-revealing');
    if (typeof homeThemeEndSplashPrewarm === 'function') { try { homeThemeEndSplashPrewarm(); } catch (_) { } }
    window.removeEventListener('pointermove', splashHandlePointer);
    if (s && s.parentNode) s.style.display = 'none';
  }, duration + 40);
}

function markSplashReadyToEnter() {
  var s = document.getElementById('splash');
  if (!s || s.classList.contains('hide') || s.classList.contains('exiting')) return;
  markAppPerf('splash-ready');
  splashReadyToEnter = true;
  splashTimer = null;
  s.classList.add('ready');
  s.setAttribute('role', 'button');
  s.setAttribute('tabindex', '0');
  s.setAttribute('aria-label', '点击进入');
  // [二改][开场直进主页] 开场可以点了：趁空闲把主页主题先搭在开场页下面
  if (typeof homeThemePrewarmUnderSplash === 'function') {
    var prewarm = function () {
      if (s.classList.contains('exiting') || s.classList.contains('hide')) return;
      try { homeThemePrewarmUnderSplash(); } catch (_) { }
    };
    if (window.requestIdleCallback) requestIdleCallback(prewarm, { timeout: 300 });
    else setTimeout(prewarm, 60);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var s = document.getElementById('splash');
  if (!s) return;
  markAppPerf('dom-content-loaded');
  if (startupFastSkipPreference) {
    dismissSplash({ instant: true });
    return;
  }
  armSplashSoundFallback();
  if (typeof prewarmHomeWallpaperPreview === 'function') prewarmHomeWallpaperPreview();
  function requestSplashEnter() {
    playMineradioIntroSound();
    if (splashReadyToEnter) dismissSplash();
  }
  s.addEventListener('click', requestSplashEnter);
  document.addEventListener('keydown', function (e) {
    if (!document.body.classList.contains('splash-active')) return;
    if (e.key === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      requestSplashEnter();
    }
  });
  if (reduceSplashMotion) {
    s.classList.add('reduce-motion');
    splashTimer = setTimeout(markSplashReadyToEnter, 650);
    return;
  }
  playMineradioIntroSound();
  splashTimer = setTimeout(markSplashReadyToEnter, Math.max(0, SP_READY_AT * 1000 - (performance.now() - splashStartedAt)));
});
