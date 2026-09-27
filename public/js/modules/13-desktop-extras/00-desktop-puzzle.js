;
// ============================================================
// [二改] 完整桌面模式 · 拼图过场
// - 进入：Not Blind 挂到桌面后先整块藏起来，拼图块从屏幕外飞回原位，
//   每落稳一块，就在那一块的形状里露出真实画面。
// - 退出：先拍下当前画面，换成一整张拼好的拼图，再一块块松动、散落、
//   淡出，露出原本的桌面，最后才真正退出桌面模式。
// 主进程通过 window.__mineradioDesktopPuzzle 调用（见 desktop/main.js
// runDesktopPuzzleStep）。任何一步出错都直接放行，不影响模式切换本身。
// ============================================================
(function () {
  var MASK_VAR = '--dpz-mask';
  var st = {
    snapshot: null,       // 进入前拍的窗口画面（HTMLImageElement）
    pieces: null,
    overlay: null,
    ctx: null,
    raf: 0,
    token: 0,
    dpr: 1,
    W: 0,
    H: 0,
    resolveRun: null,
    outPromise: null,
    // 兜底：rAF 被暂停（窗口被当成不可见）时，到点强制收尾，不让真实画面一直藏着
    inSafetyMs: 5000,
    outSafetyMs: 4000
  };

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
  }
  function desktopApi() {
    return window.desktopWindow && window.desktopWindow.isDesktop ? window.desktopWindow : null;
  }
  function injectStyle() {
    if (document.getElementById('dpz-style')) return;
    var el = document.createElement('style');
    el.id = 'dpz-style';
    el.textContent = [
      // 过场期间把真实画面整体藏起来（只改透明度，不再用逐块遮罩——那会让整屏反复重绘，卡顿、出现棋盘格）
      'body.dpz-masking #desktop-window-shell{opacity:0!important;transition:none!important;animation:none!important}',
      'body.dpz-revealing #desktop-window-shell{transition:opacity .38s ease!important}',
      '#dpz-overlay{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483000;pointer-events:none;display:block;transition:opacity .38s ease}',
      '#dpz-overlay.dpz-fade{opacity:0}'
    ].join('');
    document.head.appendChild(el);
  }

  function viewport() {
    return {
      W: Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1)),
      H: Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1))
    };
  }

  // ---------- 真实画面的藏 / 显 ----------
  function setMask() {
    document.body.classList.remove('dpz-revealing');
    document.body.classList.add('dpz-masking');
  }
  function clearMask() {
    document.body.classList.remove('dpz-masking', 'dpz-revealing');
  }
  // 拼完以后：真实画面淡入、拼图层淡出，同时进行
  function revealLive() {
    return new Promise(function (resolve) {
      var body = document.body;
      body.classList.add('dpz-revealing');
      void (document.getElementById('desktop-window-shell') || body).offsetWidth;
      body.classList.remove('dpz-masking');
      if (st.overlay) st.overlay.classList.add('dpz-fade');
      setTimeout(function () { body.classList.remove('dpz-revealing'); resolve(); }, 420);
    });
  }

  // ---------- 拼图形状 ----------
  // 单位边：x 沿边 0→1，y 朝外为正；凸起高 0.25。左右对称，两块共用一条边时形状严丝合缝。
  var KNOB = [
    ['L', 0.36, 0],
    ['C', 0.40, 0, 0.41, 0.04, 0.39, 0.09],
    ['C', 0.36, 0.17, 0.42, 0.25, 0.50, 0.25],
    ['C', 0.58, 0.25, 0.64, 0.17, 0.61, 0.09],
    ['C', 0.59, 0.04, 0.60, 0, 0.64, 0],
    ['L', 1, 0]
  ];
  function r1(n) { return Math.round(n * 10) / 10; }
  function edgeCommands(ax, ay, bx, by, sign) {
    var dx = bx - ax, dy = by - ay;
    var L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L;
    var nx = uy, ny = -ux; // 顺时针走时的外法线
    var len = Math.min(L, 1e9);
    function pt(x, y) {
      var yy = y * sign;
      return r1(ax + ux * x * len + nx * yy * len) + ' ' + r1(ay + uy * x * len + ny * yy * len);
    }
    if (!sign) return ' L' + r1(bx) + ' ' + r1(by);
    var out = '';
    for (var i = 0; i < KNOB.length; i++) {
      var k = KNOB[i];
      if (k[0] === 'L') out += ' L' + pt(k[1], k[2]);
      else out += ' C' + pt(k[1], k[2]) + ' ' + pt(k[3], k[4]) + ' ' + pt(k[5], k[6]);
    }
    return out;
  }

  function buildPieces(W, H) {
    var target = W >= 2200 ? 300 : (W >= 1500 ? 265 : 220);
    var cols = Math.max(4, Math.min(11, Math.round(W / target)));
    var rows = Math.max(3, Math.min(8, Math.round(H / (W / cols))));
    var cw = W / cols, ch = H / rows;
    // 共享边的凸起方向：+1 = 凸向右 / 下
    var vEdge = [], hEdge = [];
    for (var r = 0; r < rows; r++) {
      vEdge[r] = [];
      for (var c = 0; c < cols - 1; c++) vEdge[r][c] = Math.random() < 0.5 ? 1 : -1;
    }
    for (var r2 = 0; r2 < rows - 1; r2++) {
      hEdge[r2] = [];
      for (var c2 = 0; c2 < cols; c2++) hEdge[r2][c2] = Math.random() < 0.5 ? 1 : -1;
    }
    var knobMax = 0.25 * Math.max(cw, ch) + 2;
    var list = [];
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var x0 = col * cw, y0 = row * ch, x1 = x0 + cw, y1 = y0 + ch;
        var sTop = row > 0 ? -hEdge[row - 1][col] : 0;
        var sRight = col < cols - 1 ? vEdge[row][col] : 0;
        var sBottom = row < rows - 1 ? hEdge[row][col] : 0;
        var sLeft = col > 0 ? -vEdge[row][col - 1] : 0;
        var d = 'M' + r1(x0) + ' ' + r1(y0) +
          edgeCommands(x0, y0, x1, y0, sTop) +
          edgeCommands(x1, y0, x1, y1, sRight) +
          edgeCommands(x1, y1, x0, y1, sBottom) +
          edgeCommands(x0, y1, x0, y0, sLeft) + ' Z';
        var bx = Math.max(0, x0 - knobMax), by = Math.max(0, y0 - knobMax);
        var bw = Math.min(W, x1 + knobMax) - bx, bh = Math.min(H, y1 + knobMax) - by;
        list.push({
          col: col, row: row, d: d,
          cx: x0 + cw / 2, cy: y0 + ch / 2,
          bx: bx, by: by, bw: bw, bh: bh,
          sprite: null, shadow: null,
          landed: false, flash: 0
        });
      }
    }
    return { list: list, cols: cols, rows: rows, cw: cw, ch: ch };
  }

  // ---------- 贴图：每块预先画好（画面 + 立体边 + 投影） ----------
  var PAD = 28;
  function drawCover(ctx, img, W, H) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var s = Math.max(W / iw, H / ih);
    var dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  function makeSprites(pz, img, W, H, dpr) {
    // 先把整张画面按屏幕尺寸铺好，再逐块裁
    var full = document.createElement('canvas');
    full.width = Math.round(W * dpr); full.height = Math.round(H * dpr);
    var fctx = full.getContext('2d');
    fctx.scale(dpr, dpr);
    if (img) drawCover(fctx, img, W, H);
    else {
      var g = fctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#1d2433'); g.addColorStop(1, '#0b0e16');
      fctx.fillStyle = g; fctx.fillRect(0, 0, W, H);
    }
    pz.list.forEach(function (p) {
      var sw = Math.ceil((p.bw + PAD * 2) * dpr), sh = Math.ceil((p.bh + PAD * 2) * dpr);
      var path = new Path2D(p.d);
      var sp = document.createElement('canvas');
      sp.width = sw; sp.height = sh;
      var c = sp.getContext('2d');
      c.scale(dpr, dpr);
      c.translate(PAD - p.bx, PAD - p.by);
      c.save();
      c.clip(path);
      // 只从整张画面里裁这一块的外接框（已含凸起），不再每块都画整屏——4K 下快很多
      var sx0 = Math.max(0, Math.floor(p.bx * dpr)), sy0 = Math.max(0, Math.floor(p.by * dpr));
      var sx1 = Math.min(full.width, Math.ceil((p.bx + p.bw) * dpr)), sy1 = Math.min(full.height, Math.ceil((p.by + p.bh) * dpr));
      if (sx1 > sx0 && sy1 > sy0) c.drawImage(full, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 / dpr, sy0 / dpr, (sx1 - sx0) / dpr, (sy1 - sy0) / dpr);
      // 立体边：左上一道亮、右下一道暗
      c.lineJoin = 'round';
      c.translate(-0.8, -0.8);
      c.strokeStyle = 'rgba(255,255,255,.34)'; c.lineWidth = 1.6; c.stroke(path);
      c.translate(1.6, 1.6);
      c.strokeStyle = 'rgba(0,0,0,.42)'; c.lineWidth = 1.8; c.stroke(path);
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,.10)'; c.lineWidth = 0.8; c.stroke(path);
      p.sprite = sp;

      // 投影：在 1/4 大小的小画布上做模糊，画的时候再放大，几乎不花时间
      var q = 0.25;
      var sd = document.createElement('canvas');
      sd.width = Math.max(1, Math.ceil(sw * q / dpr)); sd.height = Math.max(1, Math.ceil(sh * q / dpr));
      var s2 = sd.getContext('2d');
      s2.scale(q, q);
      s2.translate(PAD - p.bx, PAD - p.by + 8);
      s2.filter = 'blur(3px)';
      s2.fillStyle = 'rgba(0,0,0,.5)';
      s2.fill(path);
      p.shadow = sd;
    });
    // [二改][内存] 整屏底图裁完就不用了，立刻把像素还掉（4K 下一张就是几十 MB）
    full.width = full.height = 0;
  }

  function ensureOverlay() {
    injectStyle();
    var v = viewport();
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    var cv = st.overlay;
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'dpz-overlay';
      cv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cv);
      st.overlay = cv;
    }
    cv.classList.remove('dpz-fade'); // 进场刚淡出就退出时，复用的画布还带着淡出态，散落会看不见
    cv.width = Math.round(v.W * dpr); cv.height = Math.round(v.H * dpr);
    st.ctx = cv.getContext('2d');
    st.dpr = dpr; st.W = v.W; st.H = v.H;
    return cv;
  }
  function removeOverlay() {
    if (st.overlay && st.overlay.parentNode) st.overlay.parentNode.removeChild(st.overlay);
    // [二改][内存] 画布宽高清零 = 立刻释放像素内存；不清的话要等垃圾回收，
    // 反复进出桌面模式时几百 MB 的拼图块会堆在内存里
    if (st.overlay) { st.overlay.width = st.overlay.height = 0; }
    st.overlay = null; st.ctx = null;
  }
  function releasePieces() {
    var pz = st.pieces;
    if (pz && pz.list) {
      pz.list.forEach(function (p) {
        if (p.sprite) { p.sprite.width = p.sprite.height = 0; p.sprite = null; }
        if (p.shadow) { p.shadow.width = p.shadow.height = 0; p.shadow = null; }
      });
    }
    st.pieces = null;
    st.snapshot = null;
  }
  function stopRun() {
    st.token += 1;
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
    if (st.resolveRun) { var r = st.resolveRun; st.resolveRun = null; r({ ok: false, interrupted: true }); }
  }

  // 画一块：p 的中心从原位平移 (tx,ty)，绕中心转 rot，缩放 sc
  function drawPiece(ctx, p, tx, ty, rot, sc, alpha, lift) {
    var dpr = st.dpr;
    var ox = p.bx - PAD, oy = p.by - PAD;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(p.cx + tx, p.cy + ty);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.translate(-p.cx, -p.cy);
    var sw = p.sprite.width / dpr, sh = p.sprite.height / dpr;
    if (!p.sprite.width) return;
    if (lift > 0.01) {
      ctx.globalAlpha = alpha * Math.min(1, lift);
      ctx.drawImage(p.shadow, ox, oy + 4 * lift, sw, sh);
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(p.sprite, ox, oy, sw, sh);
    ctx.restore();
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) { var c1 = 1.35, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }
  function captureFrame() {
    var api = desktopApi();
    if (!api || typeof api.captureDesktopPuzzleFrame !== 'function') return Promise.resolve(null);
    return Promise.resolve(api.captureDesktopPuzzleFrame()).then(function (res) {
      return res && res.ok && res.dataUrl ? loadImage(res.dataUrl) : null;
    }).catch(function () { return null; });
  }
  function nextFrame() { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---------- 进入 ----------
  function prepareIn() {
    stopRun();
    if (reducedMotion()) return Promise.resolve({ ok: false, skipped: 'reduced-motion' });
    var token = st.token;
    return captureFrame().then(function (img) {
      // 截图回来得太晚：主进程已超时并 cancel / reset 过了，就别再把画面藏起来
      if (token !== st.token) return { ok: false, interrupted: true };
      st.snapshot = img;
      injectStyle();
      setMask(); // 挂上桌面那一刻什么都不露，只看到原本的桌面
      return { ok: true, snapshot: !!img };
    });
  }

  // 跑一段动画，外面套一个定时兜底：到点还没结束就调 onTimeout 收尾
  function withSafety(run, ms, onTimeout) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        var r;
        try { r = onTimeout(); } catch (_) { r = { ok: false, forced: true }; }
        resolve(r);
      }, ms);
      function settle(r) { if (done) return; done = true; clearTimeout(timer); resolve(r); }
      run().then(settle, function (error) { settle({ ok: false, error: String(error && error.message || error) }); });
    });
  }
  // 停掉当前这一轮（不回调 resolveRun，由兜底自己 resolve）
  function abandonRun() {
    st.token += 1;
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
    st.resolveRun = null;
  }
  // 进场兜底：直接露出真实画面、拿掉拼图层
  function forceFinishIn(token) {
    if (token !== st.token) return { ok: false, interrupted: true };
    abandonRun();
    finishIn();
    return { ok: true, forced: true };
  }

  function playIn() {
    if (!document.body.classList.contains('dpz-masking')) return Promise.resolve({ ok: false, skipped: true });
    stopRun();
    var token = st.token;
    return withSafety(function () { return runIn(token); }, st.inSafetyMs, function () { return forceFinishIn(token); });
  }
  function runIn(token) {
    // 等布局换成全屏、第一帧画出来
    return wait(140).then(nextFrame).then(function () {
      if (token !== st.token) return { ok: false, interrupted: true };
      ensureOverlay();
      var W = st.W, H = st.H;
      var pz = buildPieces(W, H);
      makeSprites(pz, st.snapshot, W, H, st.dpr);
      st.pieces = pz;
      var diag = Math.sqrt(W * W + H * H);
      var cx0 = W / 2, cy0 = H / 2;
      var maxDelay = 820, dur = 640;
      // 从中心往外一圈圈落，外加一点随机
      pz.list.forEach(function (p) {
        var dx = p.cx - cx0, dy = p.cy - cy0;
        var dist = Math.sqrt(dx * dx + dy * dy) / (diag / 2);
        var ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.1;
        var far = diag * (0.42 + Math.random() * 0.35);
        p.fromX = Math.cos(ang) * far;
        p.fromY = Math.sin(ang) * far;
        p.fromRot = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.9);
        p.delay = dist * maxDelay * 0.7 + Math.random() * maxDelay * 0.3;
        p.landed = false; p.flash = 0;
      });
      var start = performance.now();
      return new Promise(function (resolve) {
        st.resolveRun = resolve;
        function frame(now) {
          if (token !== st.token) return;
          var ctx = st.ctx;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, st.overlay.width, st.overlay.height);
          var t = now - start;
          var allDone = true;
          for (var i = 0; i < pz.list.length; i++) {
            var p = pz.list[i];
            var k = clamp01((t - p.delay) / dur);
            if (k <= 0) { allDone = false; continue; }
            if (k < 1) {
              allDone = false;
              var e = easeOutCubic(k);
              var s = 1 + 0.08 * (1 - easeOutBack(k));
              var lift = 1 - k;
              drawPiece(ctx, p, p.fromX * (1 - e), p.fromY * (1 - e), p.fromRot * (1 - e), s, clamp01(k * 3.2), lift);
            } else if (!p.landed) {
              p.landed = true; p.flash = now;
            }
            if (p.landed) {
              drawPiece(ctx, p, 0, 0, 0, 1, 1, 0);
              var f = 1 - clamp01((now - p.flash) / 320);
              if (f > 0) {
                allDone = false;
                ctx.save();
                ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * f).toFixed(3) + ')';
                ctx.lineWidth = 1.4;
                ctx.stroke(new Path2D(p.d));
                ctx.restore();
              }
            }
          }
          if (allDone) {
            st.raf = 0;
            st.resolveRun = null;
            revealLive().then(function () {
              if (token === st.token) finishIn();
              resolve({ ok: true });
            });
            return;
          }
          st.raf = requestAnimationFrame(frame);
        }
        st.raf = requestAnimationFrame(frame);
      });
    }).catch(function (error) {
      if (token === st.token) finishIn();
      return { ok: false, error: String(error && error.message || error) };
    });
  }
  function finishIn() {
    clearMask();
    var shell = document.getElementById('desktop-window-shell');
    if (shell && shell.style && shell.style.opacity === '0') shell.style.opacity = '';
    removeOverlay();
    releasePieces();
  }
  function cancel() {
    stopRun();
    finishIn();
    return Promise.resolve({ ok: true });
  }

  // ---------- 退出 ----------
  function playOut() {
    // 连按两次退出时，第二次直接等第一次的动画，不重新拍一张"已经藏起来"的画面
    if (st.outPromise) return st.outPromise;
    stopRun();
    var token = st.token;
    // 兜底：到点不管动画走到哪都放行（遮罩 / 拼图层留给随后的 reset 收拾）
    var p = withSafety(function () { return playOutInner(token); }, st.outSafetyMs, function () {
      if (token === st.token) abandonRun();
      return { ok: true, forced: true };
    });
    var q = p.then(function (r) { if (st.outPromise === q) st.outPromise = null; return r; });
    st.outPromise = q;
    return q;
  }
  function playOutInner(token) {
    if (reducedMotion()) return Promise.resolve({ ok: false, skipped: 'reduced-motion' });
    // 散落时把桌面图标先还回来，碎片落下去正好露出完整的桌面
    try {
      if (typeof setDesktopIconsVisibility === 'function' && typeof desktopIconsAreVisible === 'function'
        && !desktopIconsAreVisible(desktopWallpaperRuntimeState)) {
        setDesktopIconsVisibility(true, null, { quiet: true });
      }
    } catch (_) { }
    return captureFrame().then(function (img) {
      if (token !== st.token) return { ok: false, interrupted: true };
      if (!img) return { ok: false, error: 'capture-failed' };
      ensureOverlay();
      var W = st.W, H = st.H;
      var pz = buildPieces(W, H);
      makeSprites(pz, img, W, H, st.dpr);
      st.pieces = pz;
      // 第一帧：拼好的整张图原地盖上，下一帧再把真实画面藏掉，不会闪
      var ctx = st.ctx;
      pz.list.forEach(function (p) { drawPiece(ctx, p, 0, 0, 0, 1, 1, 0); });
      return nextFrame().then(function () {
        if (token !== st.token) return { ok: false, interrupted: true };
        setMask();
        var cols = pz.cols, rows = pz.rows;
        pz.list.forEach(function (p) {
          // 从底下几排先塌，越往上越晚；每块随机往两边甩、带一点上弹
          var rowK = (rows - 1 - p.row) / Math.max(1, rows - 1);
          p.delay = 160 + rowK * 360 + Math.random() * 260 + Math.abs(p.col - (cols - 1) / 2) / cols * 80;
          p.vx = (Math.random() - 0.5) * 2 * (140 + Math.random() * 360) + (p.cx - W / 2) * 0.35;
          p.vy = -(80 + Math.random() * 260);
          p.vr = (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 4.2);
          p.life = 820 + Math.random() * 260;
          p.wob = (Math.random() - 0.5) * 0.06;
        });
        var G = 2600; // 像素/秒²
        var start = performance.now();
        return new Promise(function (resolve) {
          st.resolveRun = resolve;
          function frame(now) {
            if (token !== st.token) return;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, st.overlay.width, st.overlay.height);
            var t = now - start;
            var alive = false;
            for (var i = 0; i < pz.list.length; i++) {
              var p = pz.list[i];
              // 松动：整体轻轻浮起、微微错位
              var loosen = clamp01(t / 160);
              if (t < p.delay) {
                alive = true;
                drawPiece(ctx, p, 0, -3 * loosen, p.wob * loosen, 1 + 0.015 * loosen, 1, 0.5 * loosen);
                continue;
              }
              var s = (t - p.delay) / 1000;
              var k = (t - p.delay) / p.life;
              if (k >= 1) continue;
              alive = true;
              var x = p.vx * s;
              var y = -3 + p.vy * s + 0.5 * G * s * s;
              var alpha = 1 - clamp01((k - 0.45) / 0.55);
              drawPiece(ctx, p, x, y, p.wob + p.vr * s, 1.015 - 0.12 * k, alpha, 0.5 + 0.5 * clamp01(k * 4));
            }
            if (!alive || t > 2600) {
              st.raf = 0;
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, st.overlay.width, st.overlay.height);
              st.resolveRun = null;
              resolve({ ok: true });
              return;
            }
            st.raf = requestAnimationFrame(frame);
          }
          st.raf = requestAnimationFrame(frame);
        });
      });
    }).catch(function (error) {
      return { ok: false, error: String(error && error.message || error) };
    });
  }

  // 桌面模式切换落定后调用：动画没在跑就把一切复原（真实画面重新露出来）
  function reset() {
    var body = document.body;
    stopRun();
    // 切回窗口后让 3D 画面按新尺寸重新分配、立刻补画几帧
    try {
      if (typeof renderPowerState !== 'undefined' && renderPowerState) renderPowerState.mode = '';
      if (typeof recoverVisualsAfterBackground === 'function') recoverVisualsAfterBackground('desktop-mode-exit');
      if (typeof wakeMainLoopFromBackground === 'function') wakeMainLoopFromBackground();
    } catch (_) { }
    removeOverlay();
    releasePieces();
    var wasMasked = !!(body && body.classList.contains('dpz-masking'));
    finishIn(); // 不管之前是什么状态，一律把真实画面还回来
    if (wasMasked) {
      var rm = false;
      try { rm = typeof desktopWindowReducedMotion === 'function' && desktopWindowReducedMotion(); } catch (_) { }
      if (!rm) {
        body.classList.add('desktop-window-restoring');
        setTimeout(function () { body.classList.remove('desktop-window-restoring'); }, 300);
      }
    }
    // 退出失败（还停在桌面编辑态）时，散落前强制显示的桌面图标要重新按自动规则藏起来
    setTimeout(function () {
      try { if (typeof desktopIconAutoRecheck === 'function') desktopIconAutoRecheck('puzzle-reset'); } catch (_) { }
    }, 350);
    return Promise.resolve({ ok: true });
  }

  window.__mineradioDesktopPuzzle = {
    prepareIn: prepareIn,
    playIn: playIn,
    playOut: playOut,
    cancel: cancel,
    reset: reset,
    _cfg: st, // 调试 / 测试用：可改 inSafetyMs、outSafetyMs
    // 调试用：不进桌面模式，直接在窗口里预览一遍（控制台里调用）
    preview: function () {
      return captureFrame().then(function (img) {
        st.snapshot = img; injectStyle(); setMask();
        return playIn();
      }).then(function () { return wait(500); }).then(playOut).then(reset);
    }
  };
})();
