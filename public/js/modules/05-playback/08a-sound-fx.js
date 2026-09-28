// ============================================================
// Sound FX — 10-band EQ, stereo width, room reverb.
// Every playback deck ends in one shared bus per AudioContext:
//   deck gain → bus input ─┬─ bypass ────────────────────────────┬→ destination
//                          └─ preamp → EQ ×10 → width ─┬ dry ─┐   │
//                                                      └ verb ┴ limiter → fx
// Switching on/off crossfades bypass ↔ fx, so it never clicks.
// The analysers sit before the deck gain, so visuals are unaffected.
// ============================================================
(function () {
  var STORE_KEY = 'notblind.soundFx.v1';
  var BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  var BAND_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
  var MAX_DB = 12;
  var PRESETS = [
    { id: 'flat', name: '原声', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], width: 0, reverb: 0 },
    { id: 'pop', name: '流行', bands: [-1, 0, 1.5, 3, 2.5, 0.5, -0.5, 1, 2, 2.5], width: 0.1, reverb: 0 },
    { id: 'rock', name: '摇滚', bands: [4, 3.5, 2, 0, -1, -0.5, 1.5, 3, 3.5, 3.5], width: 0.15, reverb: 0 },
    { id: 'vocal', name: '人声', bands: [-2, -1.5, -1, 0.5, 2, 3, 3, 2, 0.5, -0.5], width: 0, reverb: 0.04 },
    { id: 'bass', name: '重低音', bands: [6, 5.5, 4.5, 2.5, 0.5, 0, 0, 0, 0, 0], width: 0, reverb: 0 },
    { id: 'electronic', name: '电子', bands: [4.5, 4, 1.5, 0, -1.5, 0.5, 0, 1.5, 3.5, 4], width: 0.25, reverb: 0 },
    { id: 'classical', name: '古典', bands: [2.5, 2, 1, 0, 0, 0, -0.5, 0.5, 1.5, 2.5], width: 0.2, reverb: 0.1 },
    { id: 'live', name: '现场', bands: [0, 1, 1.5, 1, 0, 0.5, 1, 1.5, 1, 0.5], width: 0.35, reverb: 0.28 },
    { id: 'wide', name: '全景', bands: [1, 1, 0.5, 0, 0, 0, 0.5, 1, 1.5, 1.5], width: 0.75, reverb: 0.14 },
    { id: 'night', name: '夜听', bands: [1.5, 1.5, 1, 0, 0, -0.5, -1.5, -2.5, -3, -3.5], width: 0, reverb: 0.03 }
  ];

  var state = readState();
  var buses = [];
  var ui = null;

  function clamp(v, lo, hi) { v = Number(v); if (!isFinite(v)) v = 0; return Math.min(hi, Math.max(lo, v)); }
  function presetById(id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return null; }
  function defaultState() { return { enabled: false, preset: 'flat', bands: PRESETS[0].bands.slice(), width: 0, reverb: 0 }; }

  function readState() {
    var s = defaultState();
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        s.enabled = !!raw.enabled;
        s.preset = typeof raw.preset === 'string' ? raw.preset : 'flat';
        if (Array.isArray(raw.bands) && raw.bands.length === BANDS.length) s.bands = raw.bands.map(function (v) { return clamp(v, -MAX_DB, MAX_DB); });
        s.width = clamp(raw.width, 0, 1);
        s.reverb = clamp(raw.reverb, 0, 1);
      }
    } catch (e) { }
    return s;
  }
  var saveTimer = 0;
  function saveState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = 0;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { }
    }, 180);
  }

  // ---------- audio ----------
  function buildImpulse(ctx) {
    var rate = ctx.sampleRate || 48000;
    var seconds = 2.3;
    var len = Math.floor(rate * seconds);
    var pre = Math.floor(rate * 0.014);
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      var lp = 0;
      var seed = ch ? 0x9e3779b9 : 0x85ebca6b;
      for (var i = pre; i < len; i++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        var n = ((seed >>> 0) / 4294967296) * 2 - 1;
        var t = (i - pre) / rate;
        // Tail darkens over time like a real room: the low-pass closes as it decays.
        var k = 0.62 - 0.5 * Math.min(1, t / seconds);
        lp += k * (n - lp);
        var early = t < 0.08 && ((i * 7 + ch * 13) % 997) < 9 ? 0.6 : 0;
        d[i] = (lp + early * n) * Math.exp(-t * 3.1);
      }
    }
    return buf;
  }

  function createBus(ctx) {
    var bus = { ctx: ctx };
    bus.input = ctx.createGain();
    bus.bypass = ctx.createGain();
    bus.fx = ctx.createGain();
    bus.preamp = ctx.createGain();
    bus.filters = BANDS.map(function (f, i) {
      var node = ctx.createBiquadFilter();
      node.type = i === 0 ? 'lowshelf' : (i === BANDS.length - 1 ? 'highshelf' : 'peaking');
      node.frequency.value = f;
      if (node.type === 'peaking') node.Q.value = 1.41;
      node.gain.value = 0;
      return node;
    });
    // Width (mid/side). Upmix mono first so a mono podcast is not left on one side.
    bus.widthIn = ctx.createGain();
    bus.widthIn.channelCount = 2;
    bus.widthIn.channelCountMode = 'explicit';
    bus.widthIn.channelInterpretation = 'speakers';
    bus.splitter = ctx.createChannelSplitter(2);
    bus.merger = ctx.createChannelMerger(2);
    bus.ll = ctx.createGain(); bus.rr = ctx.createGain(); bus.lr = ctx.createGain(); bus.rl = ctx.createGain();
    bus.dry = ctx.createGain();
    bus.wet = ctx.createGain();
    bus.wet.gain.value = 0;
    bus.limiter = ctx.createDynamicsCompressor();
    bus.limiter.threshold.value = -0.6;
    bus.limiter.knee.value = 0;
    bus.limiter.ratio.value = 20;
    bus.limiter.attack.value = 0.002;
    bus.limiter.release.value = 0.14;

    bus.input.connect(bus.bypass);
    bus.bypass.connect(ctx.destination);
    bus.input.connect(bus.preamp);
    var prev = bus.preamp;
    bus.filters.forEach(function (node) { prev.connect(node); prev = node; });
    prev.connect(bus.widthIn);
    bus.widthIn.connect(bus.splitter);
    bus.splitter.connect(bus.ll, 0); bus.splitter.connect(bus.lr, 0);
    bus.splitter.connect(bus.rr, 1); bus.splitter.connect(bus.rl, 1);
    bus.ll.connect(bus.merger, 0, 0); bus.rl.connect(bus.merger, 0, 0);
    bus.rr.connect(bus.merger, 0, 1); bus.lr.connect(bus.merger, 0, 1);
    bus.merger.connect(bus.dry);
    bus.dry.connect(bus.limiter);
    try {
      bus.convolver = ctx.createConvolver();
      bus.convolver.normalize = true;
      bus.convolver.buffer = buildImpulse(ctx);
      bus.merger.connect(bus.convolver);
      bus.convolver.connect(bus.wet);
      bus.wet.connect(bus.limiter);
    } catch (e) { bus.convolver = null; }
    bus.limiter.connect(bus.fx);
    bus.fx.connect(ctx.destination);
    applyToBus(bus, true);
    return bus;
  }

  function setParam(param, value, ctx, instant) {
    if (!param) return;
    try {
      if (instant) { param.cancelScheduledValues(0); param.value = value; return; }
      param.cancelScheduledValues(ctx.currentTime);
      param.setTargetAtTime(value, ctx.currentTime, 0.03);
    } catch (e) { try { param.value = value; } catch (_) { } }
  }

  function applyToBus(bus, instant) {
    var ctx = bus.ctx;
    if (!ctx || ctx.state === 'closed') return;
    var maxBoost = 0;
    state.bands.forEach(function (db, i) {
      if (db > maxBoost) maxBoost = db;
      setParam(bus.filters[i].gain, db, ctx, instant);
    });
    var w = 1 + state.width * 0.9;
    var a = (1 + w) / 2, b = (1 - w) / 2;
    setParam(bus.ll.gain, a, ctx, instant); setParam(bus.rr.gain, a, ctx, instant);
    setParam(bus.lr.gain, b, ctx, instant); setParam(bus.rl.gain, b, ctx, instant);
    // Headroom: boosts are pulled back a little so the limiter rarely has to work.
    var preampDb = -maxBoost * 0.55;
    setParam(bus.preamp.gain, Math.pow(10, preampDb / 20), ctx, instant);
    setParam(bus.dry.gain, (1 - state.reverb * 0.3) / (1 + (w - 1) * 0.3), ctx, instant);
    setParam(bus.wet.gain, bus.convolver ? state.reverb * 0.6 : 0, ctx, instant);
    // "On" but perfectly flat is routed through bypass too: bit-for-bit untouched.
    var active = state.enabled && !isNeutral();
    setParam(bus.bypass.gain, active ? 0 : 1, ctx, instant);
    setParam(bus.fx.gain, active ? 1 : 0, ctx, instant);
  }

  function applyAll() {
    buses = buses.filter(function (bus) { return bus.ctx && bus.ctx.state !== 'closed'; });
    buses.forEach(function (bus) { applyToBus(bus, false); });
  }

  window.notblindSoundFxOutput = function (ctx) {
    if (!ctx) return null;
    if (ctx.__notblindSoundFxBus && ctx.__notblindSoundFxBus.input) return ctx.__notblindSoundFxBus.input;
    try {
      var bus = createBus(ctx);
      ctx.__notblindSoundFxBus = bus;
      buses.push(bus);
      return bus.input;
    } catch (e) {
      console.warn('sound fx bus unavailable:', e && (e.message || e));
      return ctx.destination;
    }
  };

  // Audio runs straight from the <audio> element (capture fallback): EQ cannot reach it.
  function fxReachable() {
    try {
      if (typeof audioReady !== 'undefined' && audioReady && typeof gainNode !== 'undefined' && !gainNode) return false;
    } catch (e) { }
    return true;
  }

  // ---------- state changes ----------
  function isNeutral() {
    return state.bands.every(function (v) { return Math.abs(v) < 0.05; }) && state.width < 0.01 && state.reverb < 0.01;
  }
  function setEnabled(on) {
    state.enabled = !!on;
    applyAll(); saveState(); render();
    if (state.enabled && !fxReachable() && typeof showToast === 'function') showToast('当前歌曲走直出通道，音效从下一首开始生效');
  }
  function applyPreset(id) {
    var p = presetById(id);
    if (!p) return;
    state.preset = p.id;
    state.bands = p.bands.slice();
    state.width = p.width;
    state.reverb = p.reverb;
    if (!state.enabled && p.id !== 'flat') state.enabled = true;
    applyAll(); saveState(); render();
  }
  function markCustom() {
    state.preset = 'custom';
    if (!state.enabled && !isNeutral()) state.enabled = true;
  }
  function setBand(i, db) {
    db = Math.round(clamp(db, -MAX_DB, MAX_DB) * 2) / 2;
    if (state.bands[i] === db) return;
    state.bands[i] = db;
    markCustom();
    applyAll(); saveState(); render();
    showReadout(i);
  }
  var readoutTimer = 0;
  function showReadout(i) {
    if (!ui || !ui.readout) return;
    var db = state.bands[i];
    ui.readout.textContent = BAND_LABELS[i] + 'Hz  ' + (db > 0 ? '+' : '') + db.toFixed(1) + ' dB';
    ui.readout.classList.add('show');
    if (readoutTimer) clearTimeout(readoutTimer);
    readoutTimer = setTimeout(function () { readoutTimer = 0; ui.readout.classList.remove('show'); }, 1100);
  }
  function setSpace(key, v) {
    state[key] = clamp(v, 0, 1);
    markCustom();
    applyAll(); saveState(); render();
  }

  // ---------- UI ----------
  function currentName() {
    var p = presetById(state.preset);
    return p ? p.name : '自定义';
  }

  function curvePath(w, h) {
    // Smooth curve through the band points (Catmull-Rom → Bézier).
    var pts = state.bands.map(function (db, i) {
      return [(i + 0.5) * (w / BANDS.length), h / 2 - (db / MAX_DB) * (h / 2 - 6)];
    });
    pts.unshift([0, pts[0][1]]);
    pts.push([w, pts[pts.length - 1][1]]);
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  function buildUi() {
    var wrap = document.getElementById('sound-fx-control');
    var pop = document.getElementById('sound-fx-popover');
    if (!wrap || !pop) return null;
    var html = '';
    html += '<div class="sfx-head"><span class="sfx-title">音效</span><strong class="sfx-name" data-sfx-name></strong>'
      + '<button type="button" class="sfx-switch" data-sfx-switch role="switch" aria-label="音效开关"><i></i></button></div>';
    html += '<div class="sfx-presets" data-sfx-presets>';
    PRESETS.forEach(function (p) { html += '<button type="button" data-sfx-preset="' + p.id + '">' + p.name + '</button>'; });
    html += '</div>';
    html += '<div class="sfx-eq" data-sfx-eq><svg class="sfx-curve" viewBox="0 0 300 118" preserveAspectRatio="none" aria-hidden="true">'
      + '<line x1="0" y1="59" x2="300" y2="59" class="sfx-zero"></line><path class="sfx-fill" data-sfx-fill></path><path class="sfx-line" data-sfx-line></path></svg>';
    BANDS.forEach(function (f, i) {
      html += '<div class="sfx-band" data-sfx-band="' + i + '" tabindex="0" role="slider" aria-label="' + BAND_LABELS[i] + 'Hz" aria-valuemin="-12" aria-valuemax="12">'
        + '<span class="sfx-track"><span class="sfx-thumb"></span></span><em>' + BAND_LABELS[i] + '</em></div>';
    });
    html += '<span class="sfx-readout" data-sfx-readout></span></div>';
    html += '<div class="fade-control-row sfx-row"><label for="sfx-width">环绕</label><input id="sfx-width" type="range" min="0" max="100" step="1" data-sfx-space="width" aria-label="环绕宽度"><span data-sfx-val="width"></span></div>';
    html += '<div class="fade-control-row sfx-row"><label for="sfx-reverb">混响</label><input id="sfx-reverb" type="range" min="0" max="100" step="1" data-sfx-space="reverb" aria-label="混响"><span data-sfx-val="reverb"></span></div>';
    html += '<div class="sfx-foot"><span class="sfx-note" data-sfx-note></span><button type="button" class="sfx-reset" data-sfx-reset>重置</button></div>';
    pop.innerHTML = html;
    return {
      wrap: wrap, pop: pop,
      btn: document.getElementById('sound-fx-btn'),
      name: pop.querySelector('[data-sfx-name]'),
      sw: pop.querySelector('[data-sfx-switch]'),
      presets: Array.prototype.slice.call(pop.querySelectorAll('[data-sfx-preset]')),
      bands: Array.prototype.slice.call(pop.querySelectorAll('[data-sfx-band]')),
      line: pop.querySelector('[data-sfx-line]'),
      fill: pop.querySelector('[data-sfx-fill]'),
      width: pop.querySelector('[data-sfx-space="width"]'),
      reverb: pop.querySelector('[data-sfx-space="reverb"]'),
      widthVal: pop.querySelector('[data-sfx-val="width"]'),
      reverbVal: pop.querySelector('[data-sfx-val="reverb"]'),
      note: pop.querySelector('[data-sfx-note]'),
      eq: pop.querySelector('[data-sfx-eq]'),
      readout: pop.querySelector('[data-sfx-readout]')
    };
  }

  function render() {
    if (!ui) return;
    var on = state.enabled;
    ui.wrap.classList.toggle('fx-on', on);
    if (ui.btn) {
      ui.btn.classList.toggle('active', on && !isNeutral());
      ui.btn.title = on ? '音效：' + currentName() : '音效（已关闭）';
      ui.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    ui.pop.classList.toggle('is-off', !on);
    ui.name.textContent = on ? currentName() : '已关闭';
    ui.sw.classList.toggle('on', on);
    ui.sw.setAttribute('aria-checked', on ? 'true' : 'false');
    ui.presets.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sfx-preset') === state.preset); });
    ui.bands.forEach(function (el, i) {
      var db = state.bands[i];
      el.style.setProperty('--sfx-pos', (0.5 - db / (MAX_DB * 2)).toFixed(4));
      el.setAttribute('aria-valuenow', String(db));
      el.title = BAND_LABELS[i] + 'Hz  ' + (db > 0 ? '+' : '') + db + ' dB（双击归零）';
      el.classList.toggle('boost', db > 0.05);
      el.classList.toggle('cut', db < -0.05);
    });
    var d = curvePath(300, 118);
    ui.line.setAttribute('d', d);
    ui.fill.setAttribute('d', d + ' L300 59 L0 59 Z');
    if (document.activeElement !== ui.width) ui.width.value = Math.round(state.width * 100);
    if (document.activeElement !== ui.reverb) ui.reverb.value = Math.round(state.reverb * 100);
    ui.widthVal.textContent = Math.round(state.width * 100) + '%';
    ui.reverbVal.textContent = Math.round(state.reverb * 100) + '%';
    ui.note.textContent = on && !fxReachable() ? '当前歌曲走直出，下一首生效' : '';
  }

  function bandFromPointer(el, clientY) {
    var track = el.querySelector('.sfx-track');
    var r = track.getBoundingClientRect();
    var t = clamp((clientY - r.top) / Math.max(1, r.height), 0, 1);
    return (0.5 - t) * MAX_DB * 2;
  }

  function bindUi() {
    ui.btn && ui.btn.addEventListener('click', function (e) { e.stopPropagation(); toggleSoundFxPanel(); });
    ['click', 'pointerdown', 'mousedown', 'dblclick', 'contextmenu'].forEach(function (type) {
      ui.pop.addEventListener(type, function (e) { e.stopPropagation(); });
    });
    ui.pop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeSoundFxPanel(); if (ui.btn) ui.btn.focus(); }
      e.stopPropagation();
    });
    ui.pop.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    ui.sw.addEventListener('click', function () { setEnabled(!state.enabled); });
    ui.presets.forEach(function (b) {
      b.addEventListener('click', function () { applyPreset(b.getAttribute('data-sfx-preset')); });
    });
    ui.pop.querySelector('[data-sfx-reset]').addEventListener('click', function () { applyPreset('flat'); });
    ui.bands.forEach(function (el, i) {
      var dragging = false;
      el.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        dragging = true;
        try { el.setPointerCapture(e.pointerId); } catch (_) { }
        el.classList.add('dragging');
        setBand(i, bandFromPointer(el, e.clientY));
        e.preventDefault();
      });
      el.addEventListener('pointermove', function (e) { if (dragging) setBand(i, bandFromPointer(el, e.clientY)); });
      function end() { dragging = false; el.classList.remove('dragging'); }
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('dblclick', function () { setBand(i, 0); showReadout(i); });
      el.addEventListener('wheel', function (e) {
        e.preventDefault();
        setBand(i, state.bands[i] + (e.deltaY < 0 ? 0.5 : -0.5));
      }, { passive: false });
      el.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 3 : 0.5;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setBand(i, state.bands[i] + step); e.preventDefault(); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setBand(i, state.bands[i] - step); e.preventDefault(); }
        else if (e.key === '0' || e.key === 'Home') { setBand(i, 0); e.preventDefault(); }
      });
    });
    [ui.width, ui.reverb].forEach(function (input) {
      var key = input.getAttribute('data-sfx-space');
      input.addEventListener('input', function () { setSpace(key, Number(input.value) / 100); });
      input.addEventListener('wheel', function (e) {
        e.preventDefault();
        var v = clamp(Number(input.value) + (e.deltaY < 0 ? 2 : -2), 0, 100);
        input.value = v;
        setSpace(key, v / 100);
      }, { passive: false });
    });
    ['volume-control', 'lyric-timing-control'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('pointerenter', closeSoundFxPanel);
    });
    document.addEventListener('pointerdown', function (e) {
      if (!ui.wrap.classList.contains('open')) return;
      if (ui.wrap.contains(e.target)) return;
      closeSoundFxPanel();
    }, true);
  }

  function toggleSoundFxPanel(force) {
    if (!ui) return;
    var open = typeof force === 'boolean' ? force : !ui.wrap.classList.contains('open');
    if (open) {
      try { if (typeof closeVolumePanel === 'function') closeVolumePanel(true); } catch (e) { }
      render();
    }
    ui.wrap.classList.toggle('open', open);
  }
  function closeSoundFxPanel() { toggleSoundFxPanel(false); }
  window.toggleSoundFxPanel = toggleSoundFxPanel;
  window.closeSoundFxPanel = closeSoundFxPanel;
  window.notblindSoundFxState = function () { return JSON.parse(JSON.stringify(state)); };

  function init() {
    ui = buildUi();
    if (!ui) return;
    bindUi();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
