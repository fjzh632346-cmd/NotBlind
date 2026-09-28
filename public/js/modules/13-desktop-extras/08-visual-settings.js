;
// ============================================================
// [二改 2026-09-26] 右上角「视觉」「设置」两个面板 —— 替代原来的 DIY 玩家模式
//   视觉：挑主页主题（回声 / 星图 / 午后窗影 / 孔版海报）+ 播放页的粒子视觉预设 + 我的存档
//   设置：原来的视觉控制台（界面 / 歌词 / 动效 / 歌单架 / 系统），点开常驻，
//         不再靠鼠标移到右下角弹出；× / Esc / 右键 / 再点一次「设置」收起
// 入口：灵动岛上的「视觉」「设置」；没有灵动岛时是标题栏里原来的 DIY / ? 按钮（已改名）；
//       键盘 P = 设置。
// [二改 第二轮] 视觉面板加「播放」一节：桌面歌词开关、进入播放页时直接沉浸；
//   设置加「常用」首页（画质、律动、歌词大小、翻译、自动续播…的快捷副本，改的还是原控件）；
//   两个面板和设置里的控件整体换成回声主页的样子（哑光深底、灰绿字、朱红点缀、细线、等宽编号）。
//   在主页点播放不再跳播放页，只有点正在播放的歌名（或「去播放页看看」）才进 —— nbEnterStage()。
// 旧逻辑都没删：#preset-grid、#user-archive-grid 只是从控制台里挪到视觉面板，
//   setPreset / 存档 / 主题切换还是原来的函数。
// [二改 2026-09-27] 「播放页效果」分两类：3D 舞台（原来的粒子视觉）/ 平面歌词（notblind-lyric-fx.js）。
//   顶上一个两段开关直接切换播放页用哪一类；平面歌词第一张卡是「跟随主页主题」。
// ============================================================
var nbSheetState = { visual: false, settings: false, booted: false, lastFocus: null };

var NB_THEME_META = {
  'echo': { en: 'ECHO', desc: '黑白线条 · 地平线与回响' },
  'star-atlas': { en: 'STAR ATLAS', desc: '北斗天穹 · 静谧星空' },
  'afternoon': { en: 'AFTERNOON', desc: '午后窗影 · 墙上的光随时间走' },
  'fm-dial': { en: 'FM DIAL', desc: '收音机刻度 · 换台模糊换字' },
  'riso-poster': { en: 'RISO', desc: '孔版印刷 · 撞色海报' }
};

function nbHas(cls) { return !!(document.body && document.body.classList.contains(cls)); }
function nbEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nbReducedMotion() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
function nbHomeActive() { return nbHas('empty-home-active'); }

// 面板顶在灵动岛展开后的下沿再往下 10px（岛挂在标题栏 / #top-right 时高度不同）
function nbPlaceSheets() {
  var top = 64;
  var slot = document.getElementById('mri-slot');
  if (slot && slot.isConnected) {
    var r = slot.getBoundingClientRect();
    if (r.height > 0 && r.top < 200) top = Math.round(r.top + 48 + 10);
  } else {
    var tr = document.getElementById('desktop-titlebar');
    if (tr && getComputedStyle(tr).display !== 'none') top = Math.round(tr.getBoundingClientRect().bottom + 10);
  }
  top = Math.max(44, Math.min(120, top));
  document.documentElement.style.setProperty('--nb-sheet-top', top + 'px');
}

function nbSyncBodyFlags() {
  document.body.classList.toggle('nb-visual-open', !!nbSheetState.visual);
  document.body.classList.toggle('nb-settings-open', !!nbSheetState.settings);
  ['diy-mode-btn', 'fullscreen-diy-btn'].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) { b.classList.toggle('on', !!nbSheetState.visual); b.setAttribute('aria-pressed', nbSheetState.visual ? 'true' : 'false'); }
  });
  var g = document.getElementById('visual-guide-btn');
  if (g) g.classList.toggle('on', !!nbSheetState.settings);
  if (window.MRTopIsland && typeof window.MRTopIsland.refresh === 'function') window.MRTopIsland.refresh();
}

/* ---------- 主题皮肤：面板、引导、提示条跟着当前主页主题换 ----------
   和左侧歌单栏的皮肤同一个依据：body[data-home-theme]（02-panel-skins.js 维护，主页和播放页都有）。
   午后窗影分白天 / 入夜：主页上跟主题自己的深浅（hth-chrome-light），播放页上一律用入夜那套（背后是深色舞台）。 */
var NB_SKIN_CLASSES = ['nb-sk-echo', 'nb-sk-star', 'nb-sk-aw-day', 'nb-sk-aw-night', 'nb-sk-riso'];
var nbSkinNow = '';
function nbSkinKey() {
  var b = document.body;
  var th = b.getAttribute('data-home-theme') || '';
  if (!th) { try { th = (typeof homeThemeHost !== 'undefined' && homeThemeHost && homeThemeHost.current) || ''; } catch (_) { th = ''; } }
  var onHome = b.getAttribute('data-hth-page') ? b.getAttribute('data-hth-page') === 'home' : nbHas('home-theme-on');
  if (th === 'star-atlas') return 'nb-sk-star';
  if (th === 'riso-poster') return 'nb-sk-riso';
  if (th === 'afternoon' || th === 'fm-dial') return (onHome && nbHas('hth-chrome-light')) ? 'nb-sk-aw-day' : 'nb-sk-aw-night';
  return 'nb-sk-echo';
}
function nbSyncSkin() {
  if (!document.body) return;
  var k = nbSkinKey();
  if (k === nbSkinNow && document.body.classList.contains(k)) return;
  nbSkinNow = k;
  NB_SKIN_CLASSES.forEach(function (c) { if (c !== k && document.body.classList.contains(c)) document.body.classList.remove(c); });
  if (!document.body.classList.contains(k)) document.body.classList.add(k);
  var light = k === 'nb-sk-aw-day' || k === 'nb-sk-riso';
  if (document.body.classList.contains('nb-sk-light') !== light) document.body.classList.toggle('nb-sk-light', light);
}

/* ---------- 视觉面板 ---------- */
function nbVisualThemeCards() {
  var list = (typeof homeThemeRegistry !== 'undefined' && homeThemeRegistry) ? homeThemeRegistry : [];
  var cur = (typeof homeThemeHost !== 'undefined' && homeThemeHost) ? (homeThemeHost.pending || homeThemeHost.current) : '';
  return list.map(function (t, i) {
    var meta = NB_THEME_META[t.id] || { en: String(t.id || '').toUpperCase(), desc: '' };
    var on = t.id === cur;
    return '<button type="button" class="nbv-theme' + (on ? ' on' : '') + '" data-nb-theme="' + nbEsc(t.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '" style="--i:' + i + '">' +
      '<span class="nbv-thumb nbv-thumb-' + nbEsc(t.id) + '"><img src="assets/visual-sheet/theme-' + nbEsc(t.id) + '.webp" alt="" draggable="false" loading="lazy" onerror="this.remove()"><i class="nbv-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.5 3.5 7.5-8"/></svg></i></span>' +
      '<span class="nbv-tname">' + nbEsc(t.name) + '<em>' + nbEsc(meta.en) + '</em></span>' +
      (meta.desc ? '<span class="nbv-tdesc">' + nbEsc(meta.desc) + '</span>' : '') +
      '</button>';
  }).join('');
}

function nbBuildVisualSheet() {
  var el = document.getElementById('nb-visual');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'nb-visual';
  el.className = 'nb-sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '视觉');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<header class="nbv-head">' +
      '<div class="nbv-titles"><div class="nbv-title">视觉</div><div class="nbv-sub">VISUAL · 主页主题 · 播放页效果</div></div>' +
      '<button type="button" class="nb-x" data-nb-act="close" aria-label="关闭视觉面板" title="关闭（Esc）"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"/></svg></button>' +
    '</header>' +
    '<div class="nbv-body">' +
      '<section class="nbv-sec" data-nb-sec="home">' +
        '<div class="nbv-sh"><span class="nbv-no">01</span><b>主页主题</b><i class="nbv-rule"></i><small>左上角拉绳也能换</small></div>' +
        '<div class="nbv-themes" role="group" aria-label="主页主题"></div>' +
        '<div class="nbv-hint" data-nb-hint="home" hidden><span>主题在主页显示</span><button type="button" data-nb-act="go-home">去主页看看<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>' +
      '</section>' +
      '<section class="nbv-sec" data-nb-sec="play">' +
        '<div class="nbv-sh"><span class="nbv-no">02</span><b>播放</b><i class="nbv-rule"></i><small>常开的几个开关</small></div>' +
        '<div class="nbv-switches">' +
          '<button type="button" class="nb-sw-row" data-nb-act="sw-desktop-lyrics" role="switch" aria-checked="false"><span class="nb-sw-txt"><b>桌面歌词</b><small>歌词浮在 Windows 桌面最上层</small></span><i class="nb-sw" aria-hidden="true"></i></button>' +
          '<button type="button" class="nb-sw-row" data-nb-act="sw-stage-immersive" role="switch" aria-checked="false"><span class="nb-sw-txt"><b>进入播放页直接沉浸</b><small>点歌名进播放页时，界面自动收起</small></span><i class="nb-sw" aria-hidden="true"></i></button>' +
          // [二改] 主页歌词位（03-home-lyric.js）
          '<button type="button" class="nb-sw-row" data-nb-act="sw-home-lyric" role="switch" aria-checked="true"><span class="nb-sw-txt"><b>主页显示歌词</b><small>放歌时，主页那句话换成此刻的歌词；当桌面背景时也一样</small></span><i class="nb-sw" aria-hidden="true"></i></button>' +
          // [二改 2026-09-28] 原来这里还有「当桌面背景时也显示」从属开关；用户要求窗口和桌面背景用同一个开关，已去掉
        '</div>' +
      '</section>' +
      '<section class="nbv-sec" data-nb-sec="stage">' +
        '<div class="nbv-sh"><span class="nbv-no">03</span><b>播放页效果</b><i class="nbv-rule"></i><small class="nbv-count"></small></div>' +
        // [二改] 两类效果：3D 舞台 / 平面歌词
        '<div class="nbv-kind" role="radiogroup" aria-label="播放页效果类型" hidden>' +
          '<button type="button" role="radio" data-nb-act="kind-3d" aria-checked="true"><b>3D 舞台</b><small>粒子和立体歌词，可以拖动转视角</small></button>' +
          '<button type="button" role="radio" data-nb-act="kind-2d" aria-checked="false"><b>平面歌词</b><small>整屏一张会动的歌词画面</small></button>' +
        '</div>' +
        // [二改 2026-09-28] 歌词大小：3D 歌词、平面歌词共用（改的就是设置里原来的「歌词大小」滑条 #fx-lyricscale）
        '<div class="nbv-size" hidden><span class="nbv-size-l"><b>歌词大小</b><small>3D / 平面歌词共用</small></span><input type="range" aria-label="歌词大小"><output class="nbv-size-o"></output></div>' +
        '<div class="nbv-hint" data-nb-hint="stage" hidden><span>效果在播放页显示</span><button type="button" data-nb-act="go-stage">去播放页看看<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>' +
        '<div class="nbv-presets"></div>' +
        '<div class="nbv-lfx" hidden></div>' +
      '</section>' +
      '<section class="nbv-sec nbv-fold" data-nb-sec="archive">' +
        '<button type="button" class="nbv-sh nbv-fold-head" data-nb-act="fold" aria-expanded="false"><span class="nbv-no">04</span><b>我的存档</b><i class="nbv-rule"></i><small>整套视觉参数存一份</small><svg class="nbv-arrow" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>' +
        '<div class="nbv-fold-body"><div class="nbv-archives"></div></div>' +
      '</section>' +
      '<button type="button" class="nbv-more" data-nb-act="open-settings"><span>想细调颜色、粒子、歌词？</span><b>打开设置<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></b></button>' +
    '</div>';
  var fxPanel = document.getElementById('fx-panel');
  var parent = (fxPanel && fxPanel.parentNode) || document.getElementById('desktop-window-shell') || document.body;
  parent.insertBefore(el, fxPanel ? fxPanel.nextSibling : null);

  el.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-nb-act],[data-nb-theme],[data-nb-lfx]') : null;
    if (!t || !el.contains(t)) return;
    var theme = t.getAttribute('data-nb-theme');
    if (theme) { nbPickTheme(theme); return; }
    var lfx = t.getAttribute('data-nb-lfx');
    if (lfx) { nbPickLyricFx(lfx); return; }
    var act = t.getAttribute('data-nb-act');
    if (act === 'close') closeNbVisualSheet(true);
    else if (act === 'kind-3d' || act === 'kind-2d') nbSetStageKind(act === 'kind-2d' ? '2d' : '3d');
    else if (act === 'go-home') nbGoHome(true);
    else if (act === 'go-stage') nbEnterStage('visual-sheet');
    else if (act === 'sw-desktop-lyrics') { var dl = document.getElementById('t-desktopLyrics'); if (dl) dl.click(); setTimeout(nbSyncSwitches, 40); }
    else if (act === 'sw-stage-immersive') { nbSetStageImmersivePref(!nbStageImmersivePref()); nbSyncSwitches(); }
    else if (act === 'sw-home-lyric') { if (typeof nbSetHomeLyricPref === 'function') nbSetHomeLyricPref(!nbHomeLyricPref()); nbSyncSwitches(); }
    else if (act === 'sw-home-lyric-desk') {
      if (t.getAttribute('aria-disabled') === 'true') { if (typeof showToast === 'function') showToast('先打开「主页显示歌词」'); return; }
      if (typeof nbSetHomeLyricDesktopPref === 'function') nbSetHomeLyricDesktopPref(!nbHomeLyricDesktopPref());
      nbSyncSwitches();
    }
    else if (act === 'open-settings') { closeNbVisualSheet(false); toggleNbSettingsSheet(true, 'motion'); }
    else if (act === 'fold') {
      var sec = t.closest('.nbv-fold');
      var open = !sec.classList.contains('open');
      sec.classList.toggle('open', open);
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  });
  // [二改 2026-09-28] 歌词大小滑条 → 设置里原来的 #fx-lyricscale（触发它自己的 input / change：存档、3D 歌词、平面歌词都跟着变）
  el.addEventListener('input', function (e) {
    var r = e.target && e.target.closest ? e.target.closest('.nbv-size input[type=range]') : null;
    var src = r && document.getElementById('fx-lyricscale');
    if (!src) return;
    src.value = r.value;
    src.dispatchEvent(new Event('input', { bubbles: true }));
    nbSyncLyricSize();
  });
  el.addEventListener('change', function (e) {
    var r = e.target && e.target.closest ? e.target.closest('.nbv-size input[type=range]') : null;
    var src = r && document.getElementById('fx-lyricscale');
    if (src) src.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // 在主页点了播放页效果：不把人拽走，只把"去播放页看看"亮一下
  el.addEventListener('click', function (e) {
    var card = e.target && e.target.closest ? e.target.closest('.preset-card') : null;
    if (!card || !el.contains(card)) return;
    setTimeout(nbSyncVisualHints, 30);
    if (nbHomeActive()) nbPulse(el.querySelector('[data-nb-hint=stage]'));
  });
  nbAdoptVisualBlocks();
  return el;
}

// 把视觉预设 / 用户存档从暂存处（09-console-workspace.js 挪过去的）接到视觉面板里
function nbAdoptVisualBlocks() {
  var el = document.getElementById('nb-visual');
  if (!el) return;
  var grid = document.getElementById('preset-grid');
  var box = el.querySelector('.nbv-presets');
  if (grid && box && grid.parentNode !== box) box.appendChild(grid);
  var arch = document.getElementById('user-archive-grid');
  var abox = el.querySelector('.nbv-archives');
  if (arch && abox && arch.parentNode !== abox) abox.appendChild(arch);
}

function nbPulse(node) {
  if (!node || node.hidden) return;
  node.classList.remove('nb-pulse');
  void node.offsetWidth;
  node.classList.add('nb-pulse');
}

function nbSyncVisualHints() {
  var el = document.getElementById('nb-visual');
  if (!el) return;
  var home = nbHomeActive();
  var hh = el.querySelector('[data-nb-hint=home]');
  var hs = el.querySelector('[data-nb-hint=stage]');
  if (hh) hh.hidden = home;
  if (hs) hs.hidden = !home;
  var count = el.querySelectorAll('#preset-grid .preset-card').length;
  var c = el.querySelector('.nbv-count');
  var lfxApi = window.NotBlindLyricFx;
  if (c) c.textContent = lfxApi && lfxApi.mode() === '2d' ? lfxApi.list().length + ' 种平面歌词' : (count ? count + ' 种粒子视觉' : '');
}

function refreshNbVisualSheet() {
  var el = document.getElementById('nb-visual');
  if (!el) return;
  var box = el.querySelector('.nbv-themes');
  if (box) {
    var html = nbVisualThemeCards();
    if (box.__nbHtml !== html) {
      var had = box.contains(document.activeElement) ? document.activeElement.getAttribute('data-nb-theme') : '';
      box.innerHTML = html; box.__nbHtml = html;
      if (had) { var f = box.querySelector('[data-nb-theme="' + had + '"]'); if (f) f.focus({ preventScroll: true }); }
    }
  }
  nbAdoptVisualBlocks();
  nbSyncLyricFx();
  nbSyncLyricSize();
  nbSyncVisualHints();
  nbSyncSwitches();
  nbFixPresetHighlight();
}

function nbSyncLyricSize() {
  var el = document.getElementById('nb-visual');
  if (!el) return;
  var row = el.querySelector('.nbv-size');
  var src = document.getElementById('fx-lyricscale');
  if (!row) return;
  row.hidden = !src;
  if (!src) return;
  var r = row.querySelector('input[type=range]');
  if (r) {
    if (r.min !== src.min) r.min = src.min;
    if (r.max !== src.max) r.max = src.max;
    if (r.step !== src.step) r.step = src.step;
    if (document.activeElement !== r || r.value !== src.value) r.value = src.value;
    nbPaintRange(r);
  }
  var o = row.querySelector('.nbv-size-o');
  var v = parseFloat(src.value);
  if (o) o.textContent = isFinite(v) ? Math.round(v * 100) + '%' : '';
}

/* ---------- 播放页效果：3D 舞台 / 平面歌词（notblind-lyric-fx.js） ---------- */
function nbLyricFxThumb(id) {
  return '<img src="assets/visual-sheet/lyricfx-' + nbEsc(id) + '.webp" alt="" draggable="false" loading="lazy" onerror="this.remove()">';
}
function nbLyricFxHtml() {
  var api = window.NotBlindLyricFx;
  if (!api) return '';
  var choice = api.choice(), fi = api.followInfo(), list = api.list();
  var followOn = choice === 'follow';
  var followSub = fi.matched ? '主页是「' + (fi.themeName || '') + '」→ ' + fi.fxName : '这个主页主题没有对应的，先用「' + fi.fxName + '」';
  var html = '<button type="button" class="nbv-follow' + (followOn ? ' on' : '') + '" data-nb-lfx="follow" aria-pressed="' + (followOn ? 'true' : 'false') + '">' +
    '<span class="nbv-thumb nbv-follow-thumb">' + nbLyricFxThumb(fi.fxId) + '</span>' +
    '<span class="nbv-follow-txt"><b>跟随主页主题</b><small>' + nbEsc(followSub) + '</small></span>' +
    '<i class="nbv-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.5 3.5 7.5-8"/></svg></i>' +
    '</button>';
  html += '<div class="nbv-lfx-grid">' + list.map(function (d, i) {
    var on = !followOn && choice === d.id;
    var viaFollow = followOn && fi.fxId === d.id;
    return '<button type="button" class="nbv-theme nbv-lfx-card' + (on ? ' on' : '') + (viaFollow ? ' via' : '') + '" data-nb-lfx="' + nbEsc(d.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '" title="' + nbEsc(d.hint || '') + '" style="--i:' + i + '">' +
      '<span class="nbv-thumb">' + nbLyricFxThumb(d.id) + '<i class="nbv-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.5 3.5 7.5-8"/></svg></i>' + (d.theme ? '<em class="nbv-lfx-tag">' + nbEsc(d.theme) + '</em>' : '') + '</span>' +
      '<span class="nbv-tname">' + nbEsc(d.name) + '<em>' + nbEsc(d.en || '') + '</em></span>' +
      '<span class="nbv-tdesc">' + nbEsc(d.desc || '') + '</span>' +
      '</button>';
  }).join('') + '</div>';
  var cur = null, cid = api.currentId();
  list.forEach(function (d) { if (d.id === cid) cur = d; });
  if (cur && cur.hint) html += '<div class="nbv-lfx-tip"><span>小提示</span>' + nbEsc(cur.hint) + '</div>';
  return html;
}
function nbSyncLyricFx() {
  var el = document.getElementById('nb-visual');
  if (!el) return;
  var api = window.NotBlindLyricFx;
  var kind = el.querySelector('.nbv-kind'), box = el.querySelector('.nbv-lfx'), presets = el.querySelector('.nbv-presets');
  if (!api) { if (kind) kind.hidden = true; if (box) box.hidden = true; if (presets) presets.hidden = false; return; }
  var is2d = api.mode() === '2d';
  if (kind) {
    kind.hidden = false;
    kind.classList.toggle('is-2d', is2d);
    Array.prototype.forEach.call(kind.querySelectorAll('[data-nb-act]'), function (b) {
      var on = (b.getAttribute('data-nb-act') === 'kind-2d') === is2d;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  if (presets) presets.hidden = is2d;
  if (box) {
    box.hidden = !is2d;
    if (is2d) {
      var html = nbLyricFxHtml();
      if (box.__nbHtml !== html) {
        var had = box.contains(document.activeElement) ? document.activeElement.getAttribute('data-nb-lfx') : '';
        box.innerHTML = html; box.__nbHtml = html;
        if (had) { var f = box.querySelector('[data-nb-lfx="' + had + '"]'); if (f) f.focus({ preventScroll: true }); }
      }
    }
  }
}
function nbSetStageKind(kind) {
  var api = window.NotBlindLyricFx;
  if (!api) return;
  api.setMode(kind);
  nbSyncLyricFx();
  nbSyncVisualHints();
  if (nbHomeActive()) nbPulse(document.querySelector('#nb-visual [data-nb-hint=stage]'));
}
function nbPickLyricFx(id) {
  var api = window.NotBlindLyricFx;
  if (!api) return;
  api.pick(id);
  nbSyncLyricFx();
  nbSyncVisualHints();
  if (nbHomeActive()) nbPulse(document.querySelector('#nb-visual [data-nb-hint=stage]'));
}

/* ---------- 播放：桌面歌词 / 进入播放页直接沉浸 ---------- */
var NB_STAGE_IMMERSIVE_KEY = 'notblind-stage-immersive-v1';
function nbStageImmersivePref() {
  try { return localStorage.getItem(NB_STAGE_IMMERSIVE_KEY) === '1'; } catch (_) { return false; }
}
function nbSetStageImmersivePref(on) {
  try { localStorage.setItem(NB_STAGE_IMMERSIVE_KEY, on ? '1' : '0'); } catch (_) { }
  if (typeof showToast === 'function') showToast(on ? '进入播放页时会直接沉浸' : '进入播放页时保留界面');
}
function nbSyncSwitches() {
  var el = document.getElementById('nb-visual');
  if (!el) return;
  var dl = document.getElementById('t-desktopLyrics');
  var a = el.querySelector('[data-nb-act=sw-desktop-lyrics]');
  if (a) {
    a.setAttribute('aria-checked', dl && dl.classList.contains('on') ? 'true' : 'false');
    a.hidden = !dl;
  }
  var b = el.querySelector('[data-nb-act=sw-stage-immersive]');
  if (b) b.setAttribute('aria-checked', nbStageImmersivePref() ? 'true' : 'false');
  var c = el.querySelector('[data-nb-act=sw-home-lyric]');
  var hlOn = typeof nbHomeLyricPref === 'function' && nbHomeLyricPref();
  if (c) { c.hidden = typeof nbHomeLyricPref !== 'function'; c.setAttribute('aria-checked', hlOn ? 'true' : 'false'); }
  var d = el.querySelector('[data-nb-act=sw-home-lyric-desk]');
  if (d) {
    d.hidden = typeof nbHomeLyricDesktopPref !== 'function';
    d.setAttribute('aria-checked', hlOn && typeof nbHomeLyricDesktopPref === 'function' && nbHomeLyricDesktopPref() ? 'true' : 'false');
    d.setAttribute('aria-disabled', hlOn ? 'false' : 'true');
  }
}

// 主页还没播过歌时，舞台临时用的是开场星河；视觉面板里高亮"播放时会用的那个"预设
function nbFixPresetHighlight() {
  try {
    if (typeof startupVisualPreviewActive === 'undefined' || !startupVisualPreviewActive) return;
    if (typeof playbackVisualPreset !== 'number') return;
    document.querySelectorAll('#nb-visual .preset-card').forEach(function (c) {
      c.classList.toggle('active', Number(c.dataset.preset) === playbackVisualPreset);
    });
  } catch (_) { }
}

// 进入播放页：点正在播放的歌名 / 「去播放页看看」。是否直接沉浸看开关。
function nbCurrentSong() {
  try { return (typeof currentIdx === 'number' && currentIdx >= 0 && playQueue && playQueue[currentIdx]) || null; } catch (_) { return null; }
}
function nbEnterStage(reason) {
  if (typeof dismissHomePage === 'function') dismissHomePage({ reason: reason || 'enter-stage' });
  else if (typeof homeThemeLeaveHome === 'function') homeThemeLeaveHome();
  if (typeof forcePlaybackControlsInteractive === 'function') { try { forcePlaybackControlsInteractive(); } catch (_) { } }
  if (nbStageImmersivePref() && nbCurrentSong() && typeof setImmersiveMode === 'function') {
    setTimeout(function () { setImmersiveMode(true); }, 60);
  }
  setTimeout(nbSyncVisualHints, 60);
  setTimeout(nbSyncVisualHints, 600);
}

function nbPickTheme(id) {
  if (typeof setHomeTheme !== 'function') return;
  setHomeTheme(id, { animate: true });
  refreshNbVisualSheet();
  if (!nbHomeActive()) nbPulse(document.querySelector('#nb-visual [data-nb-hint=home]'));
}

// 去主页 / 回播放页：点右上角原来的主页按钮（开关同一个）
function nbGoHome(wantHome) {
  if (nbHomeActive() === !!wantHome) return;
  var b = document.getElementById('home-btn');
  if (b) b.click();
  else if (wantHome && typeof goHome === 'function') goHome();
  setTimeout(nbSyncVisualHints, 60);
  setTimeout(nbSyncVisualHints, 600);
}

function openNbVisualSheet(focusSection) {
  if (typeof visualGuideActive !== 'undefined' && visualGuideActive) return;
  var el = nbBuildVisualSheet();
  if (nbSheetState.settings) toggleNbSettingsSheet(false);
  refreshNbVisualSheet();
  if (!nbSheetState.visual) nbSheetState.lastFocus = document.activeElement;
  nbSheetState.visual = true;
  nbPlaceSheets();
  el.classList.remove('nb-closing');
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  if (el.inert !== undefined) el.inert = false;
  nbSyncBodyFlags();
  var body = el.querySelector('.nbv-body');
  // [二改 2026-09-28] 在播放页打开：直接滚到「03 播放页效果」；在主页打开：回到最上面的「01 主页主题」
  if (!focusSection) focusSection = nbHomeActive() ? 'home' : 'stage';
  if (focusSection && body) {
    var sec = el.querySelector('[data-nb-sec="' + (focusSection === 'home' ? 'home' : focusSection) + '"]');
    // offsetTop 是相对 #nb-visual 量的（面板头也算在里面），要减掉滚动区自己的 offsetTop 才是滚动区里的位置
    if (sec) requestAnimationFrame(function () {
      var y = sec.offsetParent === body ? sec.offsetTop : sec.offsetTop - body.offsetTop;
      body.scrollTop = Math.max(0, y - 8);
    });
  }
}

function closeNbVisualSheet(refocus) {
  var el = document.getElementById('nb-visual');
  if (!nbSheetState.visual || !el) return false;
  nbSheetState.visual = false;
  el.classList.remove('show');
  el.setAttribute('aria-hidden', 'true');
  if (el.contains(document.activeElement)) document.activeElement.blur();
  if (el.inert !== undefined) el.inert = true;
  nbSyncBodyFlags();
  if (refocus && nbSheetState.lastFocus && nbSheetState.lastFocus.focus && document.contains(nbSheetState.lastFocus)) {
    try { nbSheetState.lastFocus.focus({ preventScroll: true }); } catch (_) { }
  }
  return true;
}

function toggleNbVisualSheet() {
  if (nbSheetState.visual) closeNbVisualSheet(true);
  else openNbVisualSheet();
}

/* ---------- 设置面板（原视觉控制台 #fx-panel） ---------- */
function nbDecorateSettingsPanel() {
  var panel = document.getElementById('fx-panel');
  if (!panel || panel.__nbDecorated) return panel;
  panel.__nbDecorated = true;
  panel.classList.add('nb-sheet', 'nb-settings');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '设置');
  var head = panel.querySelector('.fx-head');
  if (head && !head.querySelector('.nb-x')) {
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'nb-x';
    x.setAttribute('aria-label', '关闭设置');
    x.title = '关闭（Esc）';
    x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"/></svg>';
    x.addEventListener('click', function () { toggleNbSettingsSheet(false); });
    head.appendChild(x);
  }
  var title = panel.querySelector('.fx-title');
  if (title) title.textContent = '设置';
  var sub = panel.querySelector('.fx-sub');
  if (sub) sub.textContent = 'SETTINGS · 细节调整';
  return panel;
}

function toggleNbSettingsSheet(force, tab) {
  var panel = nbDecorateSettingsPanel();
  if (!panel) return;
  var want = force === undefined || force === null ? !nbSheetState.settings : !!force;
  if (peekTimers && peekTimers.fx) { clearTimeout(peekTimers.fx); peekTimers.fx = null; }
  if (want) {
    if (typeof visualGuideActive !== 'undefined' && visualGuideActive) return;
    if (typeof immersiveMode !== 'undefined' && immersiveMode) return;
    if (nbSheetState.visual) closeNbVisualSheet(false);
    if (!nbSheetState.settings) nbSheetState.lastFocus = document.activeElement;
    nbSheetState.settings = true;
    nbPlaceSheets();
    fxPanelPinned = false;
    panel.classList.remove('peek', 'closing', 'nb-closing');
    panel.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');
    if (typeof organizeFxPanel === 'function' && !panel._fxConsoleWorkspaceOrganized) organizeFxPanel();
    nbBuildQuickPage();
    if (tab && typeof setFxPanelTab === 'function') setFxPanelTab(tab);
    nbQuickSync();
    nbPaintRanges(panel);
    var fab = document.getElementById('fx-fab');
    if (fab) fab.classList.add('active');
    if (typeof repositionFxFloatingPanels === 'function') requestAnimationFrame(repositionFxFloatingPanels);
  } else {
    var wasOpen = nbSheetState.settings || panel.classList.contains('show') || panel.classList.contains('peek');
    nbSheetState.settings = false;
    panel.classList.remove('show', 'peek');
    panel.setAttribute('aria-hidden', 'true');
    if (wasOpen && panel.contains(document.activeElement)) document.activeElement.blur();
    if (typeof closeFxConsolePopovers === 'function') closeFxConsolePopovers();
    ['color-lab-pop', 'cover-color-pop'].forEach(function (id) {
      var p = document.getElementById(id);
      if (p && p.classList.contains('show')) {
        var fn = id === 'color-lab-pop' ? window.closeColorLab : window.closeCoverColorPicker;
        if (typeof fn === 'function') { try { fn(); } catch (_) { } }
      }
    });
    var fabOff = document.getElementById('fx-fab');
    if (fabOff) fabOff.classList.remove('active');
    if (wasOpen && force === false && nbSheetState.lastFocus && document.contains(nbSheetState.lastFocus) && nbSheetState.lastFocus.closest && nbSheetState.lastFocus.closest('#mri-slot')) {
      try { nbSheetState.lastFocus.focus({ preventScroll: true }); } catch (_) { }
    }
  }
  nbSyncBodyFlags();
}

function closeNbSheets() {
  closeNbVisualSheet(false);
  if (nbSheetState.settings) toggleNbSettingsSheet(false);
}

/* ---------- 设置 › 常用：最常改的几项的快捷副本 ----------
   每一行都连着原来的控件：点开关 = 点原开关，拖滑条 = 改原滑条并触发它的 input / change，
   分段按钮 = 点原按钮。原控件在后面几页里照旧，搜索、撤销、历史都不受影响。 */
var NB_QUICK = [
  { sec: '画面' },
  { kind: 'seg', src: 'performance-quality-seg', label: '画质', hint: '越高越清晰，也越吃显卡' },
  { kind: 'range', src: 'fx-intensity', label: '律动强度', hint: '画面跟着音乐动的幅度' },
  { kind: 'toggle', src: 't-cinema', label: '电影镜头', hint: '鼓点来时镜头轻轻晃一下' },
  { kind: 'toggle', src: 't-backgroundStarRiver', label: '背景星河', hint: '播放页后面的星空粒子' },
  { sec: '歌词' },
  { kind: 'range', src: 'fx-lyricscale', label: '歌词大小' },
  { kind: 'seg', src: 'lyric-display-mode-seg', label: '显示几行' },
  { kind: 'seg', src: 'lyric-translation-mode-seg', label: '翻译' },
  { sec: '习惯' },
  { kind: 'toggle', src: 't-startupAutoplay', label: '打开软件接着放', hint: '从上次停下的地方继续' },
  { kind: 'seg', src: 'close-behavior-seg', label: '点关闭按钮时' },
  { kind: 'links', items: [
    { label: '播放输出设备', run: function () { if (typeof openAudioOutputWorkflowPanel === 'function') openAudioOutputWorkflowPanel(); else setFxPanelTab('system'); } },
    { label: '热键', run: function () { var b = document.getElementById('hotkey-settings-btn'); if (b) b.click(); } },
    { label: '使用引导', run: function () { toggleNbSettingsSheet(false); if (typeof startVisualGuide === 'function') startVisualGuide({ manual: true }); } },
    { label: '重新显示小提示', run: function () { if (typeof window.resetNbTips === 'function') { window.resetNbTips(); if (typeof showToast === 'function') showToast('小提示已重新打开，走到对应的地方会再出现'); } } },
    { label: '给作者反馈', run: function () { if (typeof window.openNbFeedback === 'function') window.openNbFeedback(); } }
  ] }
];

function nbQuickPage() { return document.getElementById('fx-console-page-quick'); }

function nbBuildQuickPage() {
  var page = nbQuickPage();
  if (!page || page.__nbQuick) return page;
  page.__nbQuick = true;
  var html = '<div class="nbq">';
  var secNo = 0;
  NB_QUICK.forEach(function (it, i) {
    if (it.sec) {
      secNo++;
      html += '<div class="nbq-sh"><span class="nbq-no">' + (secNo < 10 ? '0' : '') + secNo + '</span><b>' + nbEsc(it.sec) + '</b><i class="nbq-rule"></i></div>';
      return;
    }
    var src = it.src ? document.getElementById(it.src) : null;
    if (it.src && !src) return; // 原控件不在（比如浏览器里没有某项）就不放
    var lab = '<span class="nbq-l"><b>' + nbEsc(it.label) + '</b>' + (it.hint ? '<small>' + nbEsc(it.hint) + '</small>' : '') + '</span>';
    if (it.kind === 'toggle') {
      html += '<button type="button" class="nb-sw-row nbq-row" role="switch" aria-checked="false" data-nbq="' + i + '">' + lab.replace('nbq-l', 'nb-sw-txt') + '<i class="nb-sw" aria-hidden="true"></i></button>';
    } else if (it.kind === 'range') {
      html += '<div class="nbq-row nbq-range" data-nbq="' + i + '">' + lab + '<input type="range" aria-label="' + nbEsc(it.label) + '"><output class="nbq-o"></output></div>';
    } else if (it.kind === 'seg') {
      var btns = Array.prototype.slice.call(src.querySelectorAll('button'));
      html += '<div class="nbq-row nbq-segrow" data-nbq="' + i + '">' + lab + '<div class="nbq-seg" role="group" aria-label="' + nbEsc(it.label) + '">' +
        btns.map(function (b, k) { return '<button type="button" data-k="' + k + '">' + nbEsc((b.textContent || '').trim()) + '</button>'; }).join('') + '</div></div>';
    } else if (it.kind === 'links') {
      html += '<div class="nbq-links" data-nbq="' + i + '">' + it.items.map(function (l, k) { return '<button type="button" data-k="' + k + '">' + nbEsc(l.label) + '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>'; }).join('') + '</div>';
    }
  });
  html += '<p class="nbq-foot">其余设置在后面几页，也可以在上面直接搜。</p></div>';
  page.innerHTML = html;

  page.addEventListener('click', function (e) {
    var row = e.target.closest && e.target.closest('[data-nbq]');
    if (!row || !page.contains(row)) return;
    var it = NB_QUICK[Number(row.getAttribute('data-nbq'))];
    if (!it) return;
    var src = it.src ? document.getElementById(it.src) : null;
    if (it.kind === 'toggle' && src) { src.click(); }
    else if (it.kind === 'seg' && src) {
      var b = e.target.closest('button[data-k]');
      var orig = b && src.querySelectorAll('button')[Number(b.getAttribute('data-k'))];
      if (orig) orig.click();
    } else if (it.kind === 'links') {
      var l = e.target.closest('button[data-k]');
      if (l && it.items[Number(l.getAttribute('data-k'))]) it.items[Number(l.getAttribute('data-k'))].run();
    }
    setTimeout(nbQuickSync, 30);
    setTimeout(nbQuickSync, 300);
  });
  page.addEventListener('input', function (e) {
    var row = e.target.closest && e.target.closest('.nbq-range');
    if (!row) return;
    var it = NB_QUICK[Number(row.getAttribute('data-nbq'))];
    var src = it && document.getElementById(it.src);
    if (!src) return;
    src.value = e.target.value;
    src.dispatchEvent(new Event('input', { bubbles: true }));
    nbQuickSyncRow(row, it);
  });
  page.addEventListener('change', function (e) {
    var row = e.target.closest && e.target.closest('.nbq-range');
    if (!row) return;
    var it = NB_QUICK[Number(row.getAttribute('data-nbq'))];
    var src = it && document.getElementById(it.src);
    if (src) src.dispatchEvent(new Event('change', { bubbles: true }));
  });
  nbQuickSync();
  return page;
}

function nbQuickSyncRow(row, it) {
  var src = it && it.src ? document.getElementById(it.src) : null;
  if (!src) return;
  if (it.kind === 'toggle') row.setAttribute('aria-checked', src.classList.contains('on') ? 'true' : 'false');
  else if (it.kind === 'seg') {
    var orig = src.querySelectorAll('button');
    Array.prototype.forEach.call(row.querySelectorAll('.nbq-seg button'), function (b, k) {
      var on = !!(orig[k] && (orig[k].classList.contains('active') || orig[k].getAttribute('aria-pressed') === 'true'));
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  } else if (it.kind === 'range') {
    var r = row.querySelector('input[type=range]');
    if (r) {
      if (r.min !== src.min) r.min = src.min;
      if (r.max !== src.max) r.max = src.max;
      if (r.step !== src.step) r.step = src.step;
      if (document.activeElement !== r || r.value !== src.value) r.value = src.value;
      nbPaintRange(r);
    }
    var out = src.parentElement && src.parentElement.querySelector('output');
    var o = row.querySelector('.nbq-o');
    if (o) o.textContent = out ? out.textContent : src.value;
  }
}

function nbQuickSync() {
  var page = nbQuickPage();
  if (!page || !page.__nbQuick) return;
  Array.prototype.forEach.call(page.querySelectorAll('[data-nbq]'), function (row) {
    nbQuickSyncRow(row, NB_QUICK[Number(row.getAttribute('data-nbq'))]);
  });
}

// 滑条的"已拖到哪"用一段亮线表示（回声风格的细线轨道），值存进 --nb-p
function nbPaintRange(r) {
  var min = parseFloat(r.min) || 0, max = parseFloat(r.max), v = parseFloat(r.value);
  if (!isFinite(max) || max === min) max = min + 100;
  if (!isFinite(v)) v = min;
  r.style.setProperty('--nb-p', (Math.max(0, Math.min(1, (v - min) / (max - min))) * 100).toFixed(2) + '%');
}
function nbPaintRanges(root) {
  if (!root) return;
  Array.prototype.forEach.call(root.querySelectorAll('input[type=range]'), nbPaintRange);
}

/* ---------- 样式 ---------- */
var NB_SHEET_STYLE = [
  // ===== 主题皮肤：两个面板、使用引导、底部提示条都读这组变量 =====
  // body.nb-sk-echo（默认）/ nb-sk-star / nb-sk-aw-day / nb-sk-aw-night / nb-sk-riso，由 nbSyncSkin() 按当前主页主题和页面切换
  'body{--sk-bg1:rgba(22,20,19,.975);--sk-bg2:rgba(20,18,17,.985);--sk-solid:#141211;--sk-pop:#1a1816;--sk-ink:#dfe3dc;--sk-ink-rgb:223,227,220;--sk-hot:#ff4a1c;--sk-hot-rgb:255,74,28;--sk-hot-ink:#fff;--sk-shadow-rgb:0,0,0;',
  '--sk-title:"Segoe UI Light","Segoe UI","Microsoft YaHei UI Light","Microsoft YaHei UI",sans-serif;--sk-title-w:300;--sk-title-ls:.16em;--sk-ui:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif;--sk-mono:"Cascadia Mono",Consolas,"Microsoft YaHei UI",monospace;',
  '--sk-radius:16px;--sk-texture:none;--sk-blur:18px;--sk-panel-shadow:0 30px 70px -30px rgba(0,0,0,.9),inset 0 0 0 1px rgba(223,227,220,.12);--sk-toast-shadow:0 16px 36px -16px rgba(0,0,0,.85),inset 0 0 0 1px rgba(223,227,220,.14);--sk-toast-radius:10px}',
  // 星图：夜空深蓝、象牙白字、星光金，衬线大标题，面板里有几粒星尘
  'body.nb-sk-star{--sk-bg1:rgba(9,12,24,.9);--sk-bg2:rgba(5,7,16,.94);--sk-solid:#070a14;--sk-pop:#0b0f1e;--sk-ink:#ece6d8;--sk-ink-rgb:236,230,216;--sk-hot:#dcb46c;--sk-hot-rgb:220,180,108;--sk-hot-ink:#140f05;',
  '--sk-title:"Source Han Serif SC","Noto Serif SC","Noto Serif CJK SC","Songti SC","STSong","SimSun",serif;--sk-title-w:400;--sk-title-ls:.34em;--sk-radius:12px;--sk-blur:22px;',
  '--sk-texture:radial-gradient(1px 1px at 14% 22%,rgba(236,230,216,.6),transparent 70%),radial-gradient(1px 1px at 81% 9%,rgba(236,230,216,.5),transparent 70%),radial-gradient(1.4px 1.4px at 66% 38%,rgba(255,236,200,.55),transparent 70%),radial-gradient(1px 1px at 27% 71%,rgba(214,226,255,.45),transparent 70%),radial-gradient(1px 1px at 90% 83%,rgba(236,230,216,.4),transparent 70%),radial-gradient(1px 1px at 48% 93%,rgba(236,230,216,.35),transparent 70%),linear-gradient(118deg,transparent 32%,rgba(150,165,215,.05) 50%,transparent 68%);',
  '--sk-panel-shadow:0 30px 80px -30px rgba(0,0,0,.95),inset 0 0 0 1px rgba(220,180,108,.2);--sk-toast-shadow:0 16px 40px -16px rgba(0,0,0,.9),inset 0 0 0 1px rgba(220,180,108,.3);--sk-toast-radius:999px}',
  // 午后窗影 · 白天：被太阳晒着的纸墙，米色哑光、暖墨字、赭红，楷体标题
  'body.nb-sk-aw-day{--sk-bg1:rgba(238,230,215,.97);--sk-bg2:rgba(229,220,204,.985);--sk-solid:#ebe2d1;--sk-pop:#f1e9da;--sk-ink:#2b241d;--sk-ink-rgb:43,36,29;--sk-hot:#9b3b25;--sk-hot-rgb:155,59,37;--sk-hot-ink:#fff8ef;--sk-shadow-rgb:80,56,30;',
  '--sk-title:"KaiTi","楷体","STKaiti","AR PL UKai CN","Noto Serif CJK SC",serif;--sk-title-w:400;--sk-title-ls:.22em;--sk-mono:Georgia,"Noto Serif CJK SC","DejaVu Serif",serif;--sk-radius:8px;--sk-blur:10px;',
  '--sk-texture:linear-gradient(128deg,rgba(255,238,196,.45),rgba(255,238,196,0) 38%),repeating-linear-gradient(0deg,rgba(60,44,28,.018) 0 1px,rgba(0,0,0,0) 1px 3px);',
  '--sk-panel-shadow:0 26px 54px -26px rgba(80,56,30,.6),0 2px 6px -2px rgba(80,56,30,.22),inset 0 0 0 1px rgba(60,44,28,.14);--sk-toast-shadow:0 14px 30px -14px rgba(80,56,30,.55),inset 0 0 0 1px rgba(60,44,28,.16);--sk-toast-radius:4px}',
  // 午后窗影 · 入夜 / 播放页：暖深色，像关了灯的房间，一点窗外的暖光
  'body.nb-sk-aw-night{--sk-bg1:rgba(35,31,33,.955);--sk-bg2:rgba(27,24,26,.97);--sk-solid:#1f1c1f;--sk-pop:#29252a;--sk-ink:#efe5d4;--sk-ink-rgb:239,229,212;--sk-hot:#e08a6c;--sk-hot-rgb:224,138,108;--sk-hot-ink:#1c120c;',
  '--sk-title:"KaiTi","楷体","STKaiti","AR PL UKai CN","Noto Serif CJK SC",serif;--sk-title-w:400;--sk-title-ls:.22em;--sk-mono:Georgia,"Noto Serif CJK SC","DejaVu Serif",serif;--sk-radius:8px;',
  '--sk-texture:radial-gradient(120% 55% at 92% 0%,rgba(255,196,140,.08),rgba(255,196,140,0) 62%);',
  '--sk-panel-shadow:0 30px 70px -30px rgba(0,0,0,.9),inset 0 0 0 1px rgba(239,229,212,.12);--sk-toast-radius:4px}',
  // 孔版海报：印刷纸、联邦蓝油墨、荧光粉，套印错位的粉色投影 + 网点
  'body.nb-sk-riso{--sk-bg1:rgba(242,235,220,.99);--sk-bg2:rgba(237,229,212,.995);--sk-solid:#f2ebdc;--sk-pop:#f6f0e3;--sk-ink:#2a4c9c;--sk-ink-rgb:42,76,156;--sk-hot:#ff3d9a;--sk-hot-rgb:255,61,154;--sk-hot-ink:#fff;--sk-shadow-rgb:42,76,156;',
  '--sk-title:"Microsoft YaHei UI","Microsoft YaHei","Noto Sans CJK SC",sans-serif;--sk-title-w:900;--sk-title-ls:.1em;--sk-mono:Consolas,"DejaVu Sans Mono",monospace;--sk-radius:3px;--sk-blur:0px;',
  '--sk-texture:radial-gradient(rgba(42,76,156,.075) .8px,rgba(0,0,0,0) 1.3px) 0 0/5px 5px;',
  '--sk-panel-shadow:5px 5px 0 rgba(255,61,154,.9),inset 0 0 0 1.5px rgba(42,76,156,.9);--sk-toast-shadow:3px 3px 0 rgba(255,61,154,.9),inset 0 0 0 1.5px rgba(42,76,156,.9);--sk-toast-radius:2px}',
  // 两个面板共用：右上角、灵动岛正下方，哑光深底，从岛的位置弹出来
  // 配色、字体全部取自回声主页：var(--sk-solid) 底、var(--sk-ink) 灰绿字、var(--sk-hot) 朱红、等宽编号、细线
  '.nb-sheet{--nb-ink:var(--sk-ink);--nb-ink2:rgba(var(--sk-ink-rgb),.66);--nb-ink3:rgba(var(--sk-ink-rgb),.42);--nb-ink4:rgba(var(--sk-ink-rgb),.16);--nb-line:rgba(var(--sk-ink-rgb),.12);--nb-hover:rgba(var(--sk-ink-rgb),.06);--nb-bg1:var(--sk-bg1);--nb-bg2:var(--sk-bg2);--nb-acc:var(--sk-hot);',
  '  --nb-spring:cubic-bezier(.2,1.18,.3,1);--nb-sans:var(--sk-ui);--nb-num:var(--sk-mono);--nb-thin:var(--sk-title)}',
  '#nb-visual{position:fixed;z-index:18;top:var(--nb-sheet-top,64px);right:16px;bottom:auto;width:min(420px,calc(100vw - 32px));max-height:calc(100% - var(--nb-sheet-top,64px) - 22px);display:flex;flex-direction:column;box-sizing:border-box;',
  '  border-radius:var(--sk-radius);color:var(--nb-ink);font:13px/1.5 var(--nb-sans);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none;-webkit-app-region:no-drag;',
  '  background:var(--sk-texture),linear-gradient(180deg,var(--nb-bg1),var(--nb-bg2));-webkit-backdrop-filter:blur(var(--sk-blur)) saturate(1.2);backdrop-filter:blur(var(--sk-blur)) saturate(1.2);',
  '  box-shadow:var(--sk-panel-shadow);',
  '  opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-10px) scale(.965);transform-origin:calc(100% - 90px) -12px;',
  '  transition:opacity .18s ease,transform .42s var(--nb-spring),visibility 0s linear .2s}',
  '#nb-visual.show{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition:opacity .2s ease,transform .5s var(--nb-spring),visibility 0s}',
  '#nb-visual *,#nb-visual *::before,#nb-visual *::after{box-sizing:border-box}',
  '#nb-visual button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:left}',
  '#nb-visual button:focus{outline:none}',
  '#nb-visual button:focus-visible{outline:2px solid var(--nb-acc);outline-offset:2px}',
  '#nb-visual svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}',
  '.nbv-head{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 16px 12px 22px;flex:none}',
  '.nbv-title{font:var(--sk-title-w) 22px/1.1 var(--nb-thin);letter-spacing:var(--sk-title-ls);color:var(--nb-ink)}',
  '.nbv-sub{margin-top:8px;font:10.5px/1 var(--nb-num);letter-spacing:.14em;color:var(--nb-ink3)}',
  '.nb-sheet .nb-x{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;color:var(--nb-ink2);transition:background .16s,color .16s,transform .3s var(--nb-spring);flex:none;padding:0}',
  '.nb-sheet .nb-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}',
  '.nb-sheet .nb-x:hover{background:var(--nb-hover);color:var(--nb-ink)}',
  '.nb-sheet .nb-x:active{transform:scale(.88)}',
  '.nbv-body{overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:2px 18px 18px;scrollbar-width:thin;scrollbar-color:rgba(var(--sk-ink-rgb),.18) transparent;min-height:0}',
  '.nbv-body::-webkit-scrollbar{width:6px}.nbv-body::-webkit-scrollbar-thumb{background:rgba(var(--sk-ink-rgb),.16);border-radius:3px}',
  '.nbv-sec{padding:10px 0 12px}',
  '.nbv-sh{display:flex;align-items:center;gap:9px;width:100%;padding:4px 4px 10px;color:var(--nb-ink2)}',
  '.nbv-sh .nbv-no{font:10.5px/1 var(--nb-num);letter-spacing:.06em;color:var(--nb-acc)}',
  '.nbv-sh b{font-size:13.5px;font-weight:600;color:var(--nb-ink);letter-spacing:.06em;white-space:nowrap}',
  '.nbv-sh .nbv-rule{flex:1;height:1px;background:var(--nb-line);min-width:12px}',
  '.nbv-sh small{font-size:11px;color:var(--nb-ink3);white-space:nowrap}',
  // 主题卡片
  '.nbv-themes{display:grid;grid-template-columns:1fr 1fr;gap:12px 10px}',
  '#nb-visual .nbv-theme{display:flex;flex-direction:column;gap:2px;padding:0 0 4px;border-radius:14px;min-width:0;transition:transform .35s var(--nb-spring)}',
  '#nb-visual .nbv-theme:active{transform:scale(.97)}',
  '.nbv-thumb{position:relative;display:block;aspect-ratio:16/9;border-radius:12px;overflow:hidden;margin-bottom:6px;background:var(--sk-solid);box-shadow:inset 0 0 0 1px var(--nb-line);transition:box-shadow .2s ease}',
  '.nbv-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform .6s cubic-bezier(.2,.8,.2,1),filter .3s ease;filter:saturate(.92) brightness(.92)}',
  '.nbv-thumb::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(var(--sk-ink-rgb),.06);pointer-events:none}',
  '.nbv-theme:hover .nbv-thumb img{transform:scale(1.045);filter:none}',
  '.nbv-theme:hover .nbv-thumb{box-shadow:inset 0 0 0 1px rgba(var(--sk-ink-rgb),.24)}',
  '.nbv-theme.on .nbv-thumb{box-shadow:0 0 0 2px var(--nb-acc),0 10px 26px -12px var(--nb-acc)}',
  '.nbv-theme.on .nbv-thumb img{filter:none}',
  '.nbv-check{position:absolute;right:7px;top:7px;width:20px;height:20px;border-radius:10px;background:var(--nb-acc);color:var(--sk-hot-ink);display:grid;place-items:center;opacity:0;transform:scale(.4);transition:opacity .16s ease,transform .38s var(--nb-spring)}',
  '.nbv-check svg{width:13px!important;height:13px!important;stroke-width:2.4!important}',
  '.nbv-theme.on .nbv-check{opacity:1;transform:none}',
  '.nbv-tname{display:flex;align-items:baseline;gap:7px;padding:0 3px;font-size:13.5px;font-weight:600;color:var(--nb-ink);white-space:nowrap}',
  '.nbv-tname em{font:500 9.5px/1 var(--nb-num);letter-spacing:.16em;color:var(--nb-ink3);font-style:normal}',
  '.nbv-theme.on .nbv-tname em{color:var(--nb-acc)}',
  '.nbv-tdesc{padding:0 3px;font-size:11px;color:var(--nb-ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  // 提示条
  '.nbv-hint{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 0;padding:7px 8px 7px 12px;border-radius:12px;background:rgba(var(--sk-ink-rgb),.04);box-shadow:inset 0 0 0 1px var(--nb-line);font-size:11.5px;color:var(--nb-ink2)}',
  '.nbv-hint[hidden]{display:none}',
  '.nbv-sec[data-nb-sec=stage] .nbv-hint{margin:0 0 10px}',
  '#nb-visual .nbv-hint button{display:inline-flex;align-items:center;gap:2px;padding:4px 6px 4px 10px;border-radius:9px;color:var(--nb-ink);font-size:11.5px;transition:background .15s}',
  '#nb-visual .nbv-hint button:hover{background:var(--nb-hover)}',
  '.nbv-hint.nb-pulse{animation:nbv-pulse 1.1s ease}',
  '@keyframes nbv-pulse{0%{box-shadow:inset 0 0 0 1px var(--nb-line)}25%{box-shadow:inset 0 0 0 1px var(--nb-acc),0 0 0 4px rgba(var(--sk-hot-rgb),.14)}100%{box-shadow:inset 0 0 0 1px var(--nb-line)}}',
  // 预设卡片：沿用原来的卡片，只把网格收成两列，去掉外框
  '#nb-visual .preset-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin:0!important;padding:0!important}',
  '#nb-visual .preset-card{margin:0!important;min-width:0}',
  // [二改] 播放页效果类型：3D 舞台 / 平面歌词（两段开关，底下一道滑块）
  '.nbv-kind{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:0;margin:0 0 12px;padding:3px;border-radius:13px;background:rgba(var(--sk-ink-rgb),.045);box-shadow:inset 0 0 0 1px var(--nb-line)}',
  '.nbv-kind[hidden]{display:none}',
  '.nbv-kind::before{content:"";position:absolute;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);border-radius:10px;background:rgba(var(--sk-ink-rgb),.09);box-shadow:inset 0 0 0 1px rgba(var(--sk-hot-rgb),.55),0 6px 16px -10px rgba(var(--sk-hot-rgb),.6);transition:transform .42s var(--nb-spring)}',
  '.nbv-kind.is-2d::before{transform:translateX(100%)}',
  '#nb-visual .nbv-kind button{position:relative;z-index:1;display:flex;flex-direction:column;gap:2px;padding:8px 11px 9px;border-radius:10px;min-width:0;transition:color .2s}',
  '#nb-visual .nbv-kind button b{font-size:13px;font-weight:600;color:var(--nb-ink2);letter-spacing:.04em;transition:color .2s}',
  '#nb-visual .nbv-kind button small{font-size:10.5px;color:var(--nb-ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '#nb-visual .nbv-kind button[aria-checked=true] b{color:var(--nb-ink)}',
  '#nb-visual .nbv-kind button:not([aria-checked=true]):hover b{color:var(--nb-ink)}',
  '.nbv-presets[hidden],.nbv-lfx[hidden]{display:none}',
  // [二改 2026-09-28] 歌词大小（3D / 平面共用）：细线滑条，和设置面板一个样子
  '.nbv-size{display:grid;grid-template-columns:minmax(0,118px) minmax(0,1fr) 42px;align-items:center;gap:12px;margin:-2px 0 12px;padding:4px 4px 12px;border-bottom:1px solid var(--nb-line)}',
  '.nbv-size[hidden]{display:none}',
  '.nbv-size-l{display:flex;flex-direction:column;gap:2px;min-width:0}',
  '.nbv-size-l b{font-size:13px;font-weight:500;color:var(--nb-ink)}',
  '.nbv-size-l small{font-size:10.5px;color:var(--nb-ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.nbv-size-o{font:11px/1 var(--nb-num);color:var(--nb-ink3);text-align:right;letter-spacing:.02em}',
  '#nb-visual .nbv-size input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:18px;margin:0;background:transparent;cursor:pointer}',
  '#nb-visual .nbv-size input[type=range]::-webkit-slider-runnable-track{height:1px;border:0;background:linear-gradient(90deg,var(--nb-ink2) 0,var(--nb-ink2) var(--nb-p,50%),var(--nb-ink4) var(--nb-p,50%),var(--nb-ink4) 100%)}',
  '#nb-visual .nbv-size input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:11px;height:11px;margin-top:-5px;border-radius:50%;border:1.5px solid var(--nb-ink);background:var(--sk-solid);transition:transform .25s var(--nb-spring),border-color .15s,background .15s}',
  '#nb-visual .nbv-size input[type=range]:hover::-webkit-slider-thumb{transform:scale(1.25)}',
  '#nb-visual .nbv-size input[type=range]:active::-webkit-slider-thumb,#nb-visual .nbv-size input[type=range]:focus-visible::-webkit-slider-thumb{border-color:var(--nb-acc);background:var(--nb-acc);transform:scale(1.25)}',
  '#nb-visual .nbv-size input[type=range]:focus{outline:none}',
  // 平面歌词：跟随主页主题（横条）+ 四张卡
  '#nb-visual .nbv-follow{position:relative;display:flex;align-items:center;gap:12px;width:100%;margin:0 0 12px;padding:6px 40px 6px 6px;border-radius:14px;box-shadow:inset 0 0 0 1px var(--nb-line);transition:background .16s,box-shadow .2s,transform .35s var(--nb-spring)}',
  '#nb-visual .nbv-follow:hover{background:var(--nb-hover)}',
  '#nb-visual .nbv-follow:active{transform:scale(.985)}',
  '#nb-visual .nbv-follow.on{box-shadow:inset 0 0 0 1.5px var(--nb-acc),0 10px 26px -16px var(--nb-acc)}',
  '#nb-visual .nbv-follow .nbv-thumb{width:84px;flex:none;margin:0;border-radius:9px}',
  '.nbv-follow-txt{display:flex;flex-direction:column;gap:3px;min-width:0}',
  '.nbv-follow-txt b{font-size:13.5px;font-weight:600;color:var(--nb-ink);letter-spacing:.04em}',
  '.nbv-follow-txt small{font-size:11px;color:var(--nb-ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '#nb-visual .nbv-follow .nbv-check{top:50%;right:12px;margin-top:-10px}',
  '#nb-visual .nbv-follow.on .nbv-check{opacity:1;transform:none}',
  '.nbv-lfx-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 10px}',
  '.nbv-lfx-tag{position:absolute;left:7px;bottom:6px;padding:2px 6px;border-radius:6px;font:500 9.5px/1.3 var(--nb-sans);font-style:normal;letter-spacing:.08em;color:rgba(255,255,255,.86);background:rgba(0,0,0,.42);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}',
  '.nbv-lfx-card.via .nbv-thumb{box-shadow:0 0 0 1.5px rgba(var(--sk-hot-rgb),.45)}',
  '.nbv-lfx-card.via .nbv-tname em{color:rgba(var(--sk-hot-rgb),.8)}',
  '.nbv-lfx-tip{margin:12px 0 0;padding:8px 12px;border-radius:12px;background:rgba(var(--sk-ink-rgb),.04);box-shadow:inset 0 0 0 1px var(--nb-line);font-size:11.5px;color:var(--nb-ink2);line-height:1.5}',
  '.nbv-lfx-tip span{margin-right:8px;font:10.5px/1 var(--nb-num);letter-spacing:.1em;color:var(--nb-acc)}',
  '#nb-visual.show .nbv-lfx-card{animation:nbv-in .5s var(--nb-spring) both;animation-delay:calc(var(--i,0)*35ms + 40ms)}',
  // 存档折叠
  '.nbv-fold .nbv-fold-head{cursor:pointer;border-radius:10px;transition:color .15s}',
  '.nbv-fold .nbv-fold-head:hover b{color:var(--sk-hot-ink)}',
  '.nbv-arrow{color:var(--nb-ink3);transition:transform .35s var(--nb-spring)}',
  '.nbv-fold.open .nbv-arrow{transform:rotate(180deg)}',
  '.nbv-fold-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .38s cubic-bezier(.2,.8,.2,1)}',
  '.nbv-fold.open .nbv-fold-body{grid-template-rows:1fr}',
  '.nbv-fold-body>.nbv-archives{min-height:0;overflow:hidden}',
  '.nbv-fold.open .nbv-fold-body>.nbv-archives{overflow:visible}',
  '#nb-visual .user-archive-grid{margin:0!important}',
  // 去设置
  '#nb-visual .nbv-more{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:6px;padding:12px 12px 12px 14px;border-radius:14px;font-size:12px;color:var(--nb-ink3);box-shadow:inset 0 0 0 1px var(--nb-line);transition:background .15s,color .15s}',
  '#nb-visual .nbv-more b{display:inline-flex;align-items:center;gap:3px;font-weight:600;color:var(--nb-ink)}',
  '#nb-visual .nbv-more:hover{background:var(--nb-hover);color:var(--nb-ink2)}',
  '#nb-visual .nbv-more:hover b svg{transform:translateX(2px)}',
  '#nb-visual .nbv-more b svg{transition:transform .3s var(--nb-spring)}',
  // 打开时卡片依次落下
  '#nb-visual.show .nbv-theme{animation:nbv-in .5s var(--nb-spring) both;animation-delay:calc(var(--i,0)*35ms + 40ms)}',
  '@keyframes nbv-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',

  // ---- 设置面板：原控制台换位置和外壳，里面的控件样式不动 ----
  'html body #fx-panel.nb-settings{top:var(--nb-sheet-top,64px)!important;bottom:22px!important;right:16px!important;left:auto!important;width:min(460px,calc(100vw - 32px))!important;height:auto!important;max-height:none!important;',
  '  border-radius:22px!important;background:linear-gradient(180deg,var(--sk-bg1),var(--sk-bg2))!important;border:0!important;',
  '  box-shadow:0 30px 70px -26px rgba(var(--sk-shadow-rgb),.85),0 2px 10px -4px rgba(var(--sk-shadow-rgb),.5),inset 0 0 0 1px rgba(var(--sk-ink-rgb),.12)!important;',
  '  opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-10px) scale(.975)!important;transform-origin:calc(100% - 40px) -12px;animation:none!important;',
  '  transition:opacity .18s ease,transform .42s cubic-bezier(.2,1.18,.3,1),visibility 0s linear .2s!important;-webkit-app-region:no-drag}',
  'html body #fx-panel.nb-settings.show{opacity:1;visibility:visible;pointer-events:auto;transform:none!important;transition:opacity .2s ease,transform .5s cubic-bezier(.2,1.18,.3,1),visibility 0s!important}',
  'html body #fx-panel.nb-settings.peek:not(.show){opacity:0;visibility:hidden;pointer-events:none}',
  '#fx-panel.nb-settings .fx-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}',
  '#fx-panel.nb-settings .fx-head>div:first-child{flex:1;min-width:0}',
  '#fx-panel.nb-settings .fx-title{font-size:19px!important;font-weight:600!important;letter-spacing:.08em!important;color:var(--sk-ink)!important}',
  '#fx-panel.nb-settings .fx-sub{letter-spacing:.1em!important;color:rgba(var(--sk-ink-rgb),.38)!important;text-transform:none!important}',
  '#fx-panel.nb-settings .fx-head .nb-x{order:9;margin:-4px -6px 0 0}',
  '#fx-panel.nb-settings .fx-head .nb-x{background:none;border:0;cursor:pointer}',
  '#fx-panel .nb-help-row button{flex:1}',
  'html body #fx-panel.nb-settings .fx-seg.nb-help-row{border-bottom:0!important;margin:4px 0 10px!important}',
  'html body #fx-panel.nb-settings .fx-seg.nb-help-row button{flex:none!important;height:30px!important;padding:0 14px!important;border:1px solid var(--e-ink4)!important;border-radius:999px!important;color:var(--e-ink2)!important}',
  'html body #fx-panel.nb-settings .fx-seg.nb-help-row button:hover{color:var(--e-ink)!important;border-color:rgba(var(--sk-ink-rgb),.4)!important}',
  'html body #fx-panel.nb-settings .fx-seg.nb-help-row button::after{display:none}',
  // 使用引导的卡片换成和两个面板一样的哑光深底、朱红点缀（内容已按新界面重写）
  '#visual-guide .visual-guide-card{border-radius:18px!important;border:0!important;padding:18px 18px 14px!important;background:linear-gradient(180deg,var(--sk-bg1),var(--sk-bg2))!important;box-shadow:0 30px 70px -26px rgba(var(--sk-shadow-rgb),.9),inset 0 0 0 1px rgba(var(--sk-ink-rgb),.13)!important}',
  '#visual-guide .visual-guide-card::before,#visual-guide .visual-guide-card::after{display:none!important}',
  '#visual-guide .visual-guide-kicker{color:var(--sk-hot)!important;letter-spacing:.18em!important;font-weight:600!important;opacity:1!important}',
  '#visual-guide .visual-guide-title{color:var(--sk-ink)!important;letter-spacing:.02em}',
  '#visual-guide .visual-guide-body{color:rgba(var(--sk-ink-rgb),.66)!important}',
  '#visual-guide .visual-guide-hint{background:none!important;border:0!important;box-shadow:none!important;padding:8px 0 2px!important;color:rgba(var(--sk-ink-rgb),.34)!important;font-size:11px!important}',
  '#visual-guide .visual-guide-actions button{border-radius:11px!important;background:rgba(var(--sk-ink-rgb),.06)!important;border:0!important;box-shadow:inset 0 0 0 1px rgba(var(--sk-ink-rgb),.12)!important;color:rgba(var(--sk-ink-rgb),.8)!important}',
  '#visual-guide .visual-guide-actions button.primary{background:var(--sk-hot)!important;box-shadow:none!important;color:var(--sk-hot-ink)!important}',
  '#visual-guide .visual-guide-progress{color:rgba(var(--sk-ink-rgb),.4)!important;font-variant-numeric:tabular-nums}',
  '#visual-guide .visual-guide-ring{border:1.5px solid rgba(var(--sk-ink-rgb),.85)!important;box-shadow:0 0 0 6px rgba(var(--sk-hot-rgb),.14),0 0 36px rgba(var(--sk-hot-rgb),.22)!important}',
  // DIY 的入口都不要了：右下角视觉按钮、它的自动隐藏小箭头
  '#fx-fab,#fx-fab-hide-btn{display:none!important}',
  // 主页主题一排按钮已挪到视觉面板
  '#fx-panel #home-theme-seg{display:none!important}',
  'body.immersive-mode #nb-visual{opacity:0!important;visibility:hidden!important;pointer-events:none!important}',
  'html.startup-fast-skip-preload body.splash-active #nb-visual{display:none}',
  '@media (max-height:620px){html body #fx-panel.nb-settings{bottom:12px!important}}',
  // ---- 开关：一条细线 + 一个圆（回声主页的地平线和圆），开 = 圆滑到右边、填朱红 ----
  '.nb-sheet .nb-sw-row{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;padding:11px 2px;border:0;border-radius:0;background:none;color:var(--nb-ink);cursor:pointer;text-align:left;font:inherit;border-top:1px solid var(--nb-line)}',
  '.nb-sheet .nb-sw-row:first-child{border-top:0}',
  '.nb-sheet .nb-sw-row[hidden]{display:none}',
  '.nb-sw-txt{display:flex;flex-direction:column;gap:2px;min-width:0}',
  '.nb-sw-txt b{font-size:13px;font-weight:500;color:var(--nb-ink2);transition:color .2s}',
  '.nb-sw-txt small{font-size:11px;color:var(--nb-ink3)}',
  '.nb-sw-row[aria-checked=true] .nb-sw-txt b{color:var(--nb-ink)}',
  '.nb-sw{position:relative;flex:none;width:30px;height:14px}',
  '.nb-sw::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--nb-ink4);transition:background .25s}',
  '.nb-sw::after{content:"";position:absolute;left:0;top:50%;width:11px;height:11px;margin-top:-5.5px;border-radius:50%;box-sizing:border-box;border:1.5px solid var(--nb-ink3);background:var(--sk-solid);transition:left .45s var(--nb-spring),background .2s,border-color .2s,box-shadow .3s}',
  '.nb-sw-row:hover .nb-sw::after{border-color:var(--nb-ink)}',
  '.nb-sw-row[aria-checked=true] .nb-sw::before{background:var(--nb-ink2)}',
  '.nb-sw-row[aria-checked=true] .nb-sw::after{left:19px;background:var(--nb-acc);border-color:var(--nb-acc);box-shadow:0 0 10px rgba(var(--sk-hot-rgb),.45)}',
  '.nb-sheet .nb-sw-row:focus-visible{outline:1.5px solid var(--nb-acc);outline-offset:2px}',
  // [二改] 从属开关：缩进、和上一行连在一起；上一行关着时变灰
  '.nb-sheet .nb-sw-row.nb-sw-sub{border-top:0;padding:2px 2px 11px 16px;position:relative}',
  '.nb-sheet .nb-sw-row.nb-sw-sub::before{content:"";position:absolute;left:3px;top:0;bottom:16px;width:1px;background:var(--nb-line)}',
  '.nb-sheet .nb-sw-row.nb-sw-sub .nb-sw-txt b{font-size:.94em}',
  '.nb-sheet .nb-sw-row.nb-sw-sub[aria-disabled=true]{opacity:.4;cursor:default}',
  '.nbv-switches{margin-top:-2px}',
  // ---- 视觉面板里的预设卡片：收成回声那种细线框，选中 = 朱红细框 ----
  '#nb-visual .preset-card{background:rgba(var(--sk-ink-rgb),.025)!important;border:1px solid var(--nb-line)!important;border-radius:12px!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  '#nb-visual .preset-card:hover{border-color:rgba(var(--sk-ink-rgb),.26)!important}',
  '#nb-visual .preset-card.active{border-color:var(--nb-acc)!important;box-shadow:0 0 0 1px var(--nb-acc),0 10px 26px -14px rgba(var(--sk-hot-rgb),.7)!important;background:rgba(var(--sk-hot-rgb),.04)!important}',
  '#nb-visual .preset-card .pc-name{color:var(--nb-ink)!important}',
  '#nb-visual .preset-card .pc-desc{color:var(--nb-ink3)!important}',
  '#nb-visual .preset-card::before,#nb-visual .preset-card::after{opacity:.55}',
  // ================= 设置面板：整体换成回声主页的样子 =================
  'html body #fx-panel.nb-settings{--e-ink:var(--sk-ink);--e-ink2:rgba(var(--sk-ink-rgb),.66);--e-ink3:rgba(var(--sk-ink-rgb),.42);--e-ink4:rgba(var(--sk-ink-rgb),.16);--e-line:rgba(var(--sk-ink-rgb),.11);--e-hot:var(--sk-hot);--e-bg:var(--sk-solid);',
  '--e-mono:var(--sk-mono);--e-thin:var(--sk-title);--e-ui:var(--sk-ui);',
  '--fc-accent:var(--sk-hot);--fc-accent-rgb:var(--sk-hot-rgb);',
  'border-radius:var(--sk-radius)!important;background:var(--sk-texture),var(--sk-bg1)!important;box-shadow:var(--sk-panel-shadow)!important;',
  'backdrop-filter:blur(var(--sk-blur))!important;-webkit-backdrop-filter:blur(var(--sk-blur))!important;padding:22px 22px 30px!important;color:var(--e-ink);font-family:var(--e-ui);',
  'scrollbar-width:thin!important;scrollbar-color:rgba(var(--sk-ink-rgb),.16) transparent!important}',
  'html body #fx-panel.nb-settings::-webkit-scrollbar{width:6px}',
  'html body #fx-panel.nb-settings::-webkit-scrollbar-thumb{background:rgba(var(--sk-ink-rgb),.16)!important;border-radius:3px}',
  'html body #fx-panel.nb-settings::before,html body #fx-panel.nb-settings::after{display:none!important}',
  // 头
  'html body #fx-panel.nb-settings .fx-head{margin:0!important;padding:0 0 16px!important;border:0!important;background:none!important;align-items:flex-start}',
  'html body #fx-panel.nb-settings .fx-title{font:var(--sk-title-w) 22px/1.1 var(--e-thin)!important;letter-spacing:var(--sk-title-ls)!important;color:var(--e-ink)!important}',
  'html body #fx-panel.nb-settings .fx-sub{margin-top:8px!important;font:10.5px/1 var(--e-mono)!important;letter-spacing:.14em!important;color:var(--e-ink3)!important}',
  'html body #fx-panel.nb-settings .fx-head-actions{margin-left:auto;align-self:center}',
  // 通用按钮：细线胶囊
  'html body #fx-panel.nb-settings .fx-mini-btn{height:28px!important;min-height:0!important;padding:0 12px!important;border:1px solid var(--e-ink4)!important;border-radius:999px!important;background:transparent!important;color:var(--e-ink2)!important;font:12px/26px var(--e-ui)!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;letter-spacing:.02em;transition:border-color .18s,color .18s,background .18s}',
  'html body #fx-panel.nb-settings .fx-mini-btn:hover:not(:disabled){border-color:rgba(var(--sk-ink-rgb),.4)!important;color:var(--e-ink)!important}',
  'html body #fx-panel.nb-settings .fx-mini-btn:disabled{opacity:.35}',
  'html body #fx-panel.nb-settings .fx-mini-btn::before,html body #fx-panel.nb-settings .fx-mini-btn::after{display:none!important}',
  // 搜索 + 页签：贴顶，底色和面板一样，下面一条细线
  'html body #fx-panel.nb-settings .fx-console-toolbar{top:-22px!important;margin:0 -22px 6px!important;padding:4px 22px 0!important;border:0!important;border-bottom:1px solid var(--e-line)!important;border-radius:0!important;background:var(--sk-bg1)!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  'html body #fx-panel.nb-settings .fx-console-search-row{min-height:36px!important;padding:0 0 0 2px!important;border:0!important;border-bottom:1px solid var(--e-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;transition:border-color .2s}',
  'html body #fx-panel.nb-settings .fx-console-search-row:focus-within{border-bottom-color:var(--e-hot)!important}',
  'html body #fx-panel.nb-settings .fx-console-search-icon{color:var(--e-ink3)!important;font-size:17px!important}',
  'html body #fx-panel.nb-settings .fx-console-search{color:var(--e-ink)!important;font:13px/1 var(--e-ui)!important;caret-color:var(--e-hot)}',
  'html body #fx-panel.nb-settings .fx-console-search::placeholder{color:var(--e-ink3)!important}',
  'html body #fx-panel.nb-settings .fx-console-tool-btn{border:0!important;background:transparent!important;color:var(--e-ink3)!important;font:11px/1 var(--e-ui)!important;height:26px!important;border-radius:13px!important}',
  'html body #fx-panel.nb-settings .fx-console-tool-btn:hover:not(:disabled),html body #fx-panel.nb-settings .fx-console-tool-btn[aria-expanded=true]{color:var(--e-ink)!important;background:rgba(var(--sk-ink-rgb),.06)!important}',
  'html body #fx-panel.nb-settings .fx-panel-tabs{counter-reset:nbtab;margin:6px 0 0!important;gap:0!important;border:0!important;background:transparent!important}',
  'html body #fx-panel.nb-settings .fx-panel-tabs button{counter-increment:nbtab;position:relative;flex:1 0 auto!important;min-width:0!important;height:40px!important;padding:0 4px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:var(--e-ink3)!important;font:12.5px/1 var(--e-ui)!important;letter-spacing:.06em;transition:color .2s}',
  'html body #fx-panel.nb-settings .fx-panel-tabs button::before{content:counter(nbtab,decimal-leading-zero);display:inline-block;margin-right:5px;font:9.5px/1 var(--e-mono);color:var(--e-ink4);vertical-align:1px;transition:color .2s}',
  'html body #fx-panel.nb-settings .fx-panel-tabs button::after{content:"";position:absolute;left:50%;bottom:-1px;width:22px;height:1.5px;margin-left:-11px;background:var(--e-hot);transform:scaleX(0);transition:transform .4s cubic-bezier(.2,1.18,.3,1)}',
  'html body #fx-panel.nb-settings .fx-panel-tabs button:hover{color:var(--e-ink2)!important}',
  'html body #fx-panel.nb-settings .fx-panel-tabs button.active{color:var(--e-ink)!important}',
  'html body #fx-panel.nb-settings .fx-panel-tabs button.active::before{color:var(--e-hot)}',
  'html body #fx-panel.nb-settings .fx-panel-tabs button.active::after{transform:scaleX(1)}',
  'html body #fx-panel.nb-settings .fx-console-popover{background:var(--sk-pop)!important;border:1px solid rgba(var(--sk-ink-rgb),.14)!important;border-radius:12px!important;box-shadow:0 24px 50px -20px rgba(var(--sk-shadow-rgb),.9)!important}',
  // 分组：不要卡片，改成一条细线分隔 + 等宽编号 + 加号/减号
  'html body #fx-panel.nb-settings .fx-tab-page{counter-reset:nbgrp}',
  'html body #fx-panel.nb-settings .fx-console-group{counter-increment:nbgrp;margin:0!important;border:0!important;border-top:1px solid var(--e-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}',
  'html body #fx-panel.nb-settings .fx-tab-page .fx-console-group:first-child{border-top:0!important}',
  'html body #fx-panel.nb-settings .fx-console-group::before,html body #fx-panel.nb-settings .fx-console-group::after{display:none!important}',
  'html body #fx-panel.nb-settings .fx-console-group .fx-console-group-head{min-height:54px!important;padding:14px 2px!important;background:transparent!important;border:0!important;box-shadow:none!important;gap:12px;align-items:center}',
  'html body #fx-panel.nb-settings .fx-console-group .fx-console-group-head::before{content:counter(nbgrp,decimal-leading-zero);flex:none;width:18px;align-self:flex-start;margin-top:3px;font:10.5px/1 var(--e-mono);color:var(--e-ink4);transition:color .2s}',
  'html body #fx-panel.nb-settings .fx-console-group.open .fx-console-group-head::before{color:var(--e-hot)}',
  'html body #fx-panel.nb-settings .fx-fold-title{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}',
  'html body #fx-panel.nb-settings .fx-fold-title strong{font:500 14px/1.2 var(--e-ui)!important;letter-spacing:.06em!important;color:var(--e-ink2)!important;transition:color .2s}',
  'html body #fx-panel.nb-settings .fx-fold-title small{font:11px/1.4 var(--e-ui)!important;color:var(--e-ink3)!important;letter-spacing:.02em}',
  'html body #fx-panel.nb-settings .fx-console-group-head:hover .fx-fold-title strong,html body #fx-panel.nb-settings .fx-console-group.open .fx-fold-title strong{color:var(--e-ink)!important}',
  'html body #fx-panel.nb-settings .fx-console-group-head .arrow{position:relative;flex:none;width:11px;height:11px;font-size:0!important;color:transparent!important;transform:none!important}',
  'html body #fx-panel.nb-settings .fx-console-group-head .arrow::before,html body #fx-panel.nb-settings .fx-console-group-head .arrow::after{content:"";position:absolute;left:0;right:0;top:5px;height:1.2px;background:var(--e-ink3);transition:transform .35s cubic-bezier(.2,1.18,.3,1),background .2s}',
  'html body #fx-panel.nb-settings .fx-console-group-head .arrow::after{transform:rotate(90deg)}',
  'html body #fx-panel.nb-settings .fx-console-group.open .fx-console-group-head .arrow::after{transform:rotate(0)}',
  'html body #fx-panel.nb-settings .fx-console-group-head:hover .arrow::before,html body #fx-panel.nb-settings .fx-console-group-head:hover .arrow::after{background:var(--e-ink)}',
  'html body #fx-panel.nb-settings .fx-console-group .fx-console-group-body{padding:0 2px 18px 32px!important;background:transparent!important}',
  'html body #fx-panel.nb-settings .fx-section-label{font:10.5px/1 var(--e-mono)!important;letter-spacing:.12em!important;color:var(--e-ink3)!important;margin:14px 0 6px!important}',
  // 滑条：一条 1px 细线，已拖过的部分亮一些，圆点是空心小圆
  'html body #fx-panel.nb-settings .fx-slider,html body #fx-panel.nb-settings .nbq-range{display:grid!important;grid-template-columns:minmax(76px,96px) minmax(0,1fr) 44px 22px!important;gap:10px!important;min-height:38px!important;margin:0!important;padding:7px 0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  'html body #fx-panel.nb-settings .fx-slider::before,html body #fx-panel.nb-settings .fx-slider::after{display:none!important}',
  'html body #fx-panel.nb-settings .fx-slider label{font:12.5px/1.3 var(--e-ui)!important;color:var(--e-ink2)!important;letter-spacing:.02em!important}',
  'html body #fx-panel.nb-settings .fx-slider:hover label,html body #fx-panel.nb-settings .fx-slider:focus-within label{color:var(--e-ink)!important}',
  'html body #fx-panel.nb-settings input[type=range]{-webkit-appearance:none!important;appearance:none!important;height:18px!important;margin:0!important;background:transparent!important;cursor:pointer;accent-color:var(--e-hot)}',
  'html body #fx-panel.nb-settings input[type=range]::-webkit-slider-runnable-track{height:1px;border:0;background:linear-gradient(90deg,var(--e-ink2) 0,var(--e-ink2) var(--nb-p,50%),var(--e-ink4) var(--nb-p,50%),var(--e-ink4) 100%)}',
  'html body #fx-panel.nb-settings input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:11px;height:11px;margin-top:-5px;border-radius:50%;border:1.5px solid var(--e-ink);background:var(--sk-solid);box-shadow:none;transition:transform .25s cubic-bezier(.2,1.25,.3,1),border-color .15s,background .15s}',
  'html body #fx-panel.nb-settings input[type=range]:hover::-webkit-slider-thumb{transform:scale(1.25)}',
  'html body #fx-panel.nb-settings input[type=range]:active::-webkit-slider-thumb,html body #fx-panel.nb-settings input[type=range]:focus-visible::-webkit-slider-thumb{border-color:var(--e-hot);background:var(--e-hot);transform:scale(1.25)}',
  'html body #fx-panel.nb-settings input[type=range]:focus{outline:none}',
  'html body #fx-panel.nb-settings .fx-slider output,html body #fx-panel.nb-settings .nbq-o{font:11px/1 var(--e-mono)!important;color:var(--e-ink3)!important;text-align:right;letter-spacing:.02em}',
  'html body #fx-panel.nb-settings .fx-reset-one{width:22px!important;height:22px!important;padding:0!important;border:0!important;border-radius:11px!important;background:transparent!important;box-shadow:none!important;color:var(--e-ink4)!important;display:grid;place-items:center}',
  'html body #fx-panel.nb-settings .fx-reset-one svg{width:12px;height:12px}',
  'html body #fx-panel.nb-settings .fx-reset-one:hover{color:var(--e-ink)!important;background:rgba(var(--sk-ink-rgb),.06)!important}',
  // 开关（原 fx-toggle）：和视觉面板一样，细线 + 圆
  'html body #fx-panel.nb-settings .fx-toggle-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:0 18px!important;margin:2px 0 8px!important}',
  'html body #fx-panel.nb-settings .fx-toggle{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px;min-height:38px!important;padding:8px 0!important;margin:0!important;border:0!important;border-bottom:1px solid var(--e-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;color:var(--e-ink2)!important;cursor:pointer}',
  'html body #fx-panel.nb-settings .fx-toggle::before,html body #fx-panel.nb-settings .fx-toggle::after{display:none!important}',
  'html body #fx-panel.nb-settings .fx-toggle span:first-child{font:12.5px/1.3 var(--e-ui)!important;color:var(--e-ink2)!important;white-space:normal!important}',
  'html body #fx-panel.nb-settings .fx-toggle.on span:first-child{color:var(--e-ink)!important}',
  'html body #fx-panel.nb-settings .fx-toggle .dot{position:relative!important;flex:none;width:26px!important;height:12px!important;border-radius:0!important;background:transparent!important;border:0!important;box-shadow:none!important;transform:none!important;margin:0!important}',
  'html body #fx-panel.nb-settings .fx-toggle .dot::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--e-ink4);transition:background .25s}',
  'html body #fx-panel.nb-settings .fx-toggle .dot::after{content:"";position:absolute;left:0;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;box-sizing:border-box;border:1.5px solid var(--e-ink3);background:var(--sk-solid);transition:left .45s cubic-bezier(.2,1.18,.3,1),background .2s,border-color .2s,box-shadow .3s}',
  'html body #fx-panel.nb-settings .fx-toggle:hover .dot::after{border-color:var(--e-ink)}',
  'html body #fx-panel.nb-settings .fx-toggle.on .dot::before{background:var(--e-ink2)}',
  'html body #fx-panel.nb-settings .fx-toggle.on .dot::after{left:16px;background:var(--e-hot);border-color:var(--e-hot);box-shadow:0 0 9px rgba(var(--sk-hot-rgb),.45)}',
  'html body #fx-panel.nb-settings .fx-dev-badge{font:9.5px/1 var(--e-mono)!important;color:var(--e-hot)!important;background:transparent!important;border:1px solid rgba(var(--sk-hot-rgb),.4)!important;border-radius:3px!important;padding:2px 4px!important}',
  // 分段按钮：文字 + 底线，选中那一段下面一道朱红
  'html body #fx-panel.nb-settings .fx-seg,html body #fx-panel.nb-settings .nbq-seg{display:flex!important;flex-wrap:wrap;gap:0!important;margin:6px 0 12px!important;padding:0!important;border:0!important;border-bottom:1px solid var(--e-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  'html body #fx-panel.nb-settings .fx-seg::before,html body #fx-panel.nb-settings .fx-seg::after{display:none!important}',
  'html body #fx-panel.nb-settings .fx-seg button,html body #fx-panel.nb-settings .nbq-seg button{position:relative;flex:1 1 0!important;min-width:0!important;height:34px!important;padding:0 6px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:var(--e-ink3)!important;font:12.5px/1 var(--e-ui)!important;letter-spacing:.02em;white-space:nowrap;cursor:pointer;transition:color .2s}',
  'html body #fx-panel.nb-settings .fx-seg button::after,html body #fx-panel.nb-settings .nbq-seg button::after{content:"";position:absolute;left:22%;right:22%;bottom:-1px;height:1.5px;background:var(--e-hot);transform:scaleX(0);transition:transform .4s cubic-bezier(.2,1.18,.3,1)}',
  'html body #fx-panel.nb-settings .fx-seg button:hover,html body #fx-panel.nb-settings .nbq-seg button:hover{color:var(--e-ink2)!important}',
  'html body #fx-panel.nb-settings .fx-seg button.active,html body #fx-panel.nb-settings .nbq-seg button.active{color:var(--e-ink)!important}',
  'html body #fx-panel.nb-settings .fx-seg button.active::after,html body #fx-panel.nb-settings .nbq-seg button.active::after{transform:scaleX(1)}',
  'html body #fx-panel.nb-settings .nb-help-row button{flex:none!important;padding:0 14px!important}',
  // 颜色行 / 字体 / 色块 / 各种小面板：去掉玻璃卡片，改细线
  'html body #fx-panel.nb-settings .lyric-color-row{margin:0!important;padding:9px 0!important;min-height:44px;border:0!important;border-bottom:1px solid var(--e-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  'html body #fx-panel.nb-settings .lyric-color-row::before,html body #fx-panel.nb-settings .lyric-color-row::after{display:none!important}',
  'html body #fx-panel.nb-settings .fx-color-row-label{font:12.5px/1.3 var(--e-ui)!important;color:var(--e-ink2)!important}',
  'html body #fx-panel.nb-settings .fx-color-row-label small{font:10.5px/1.4 var(--e-mono)!important;color:var(--e-ink3)!important;letter-spacing:.04em}',
  'html body #fx-panel.nb-settings .lyric-color-picker{border-radius:50%!important;box-shadow:0 0 0 1px var(--e-ink4)!important}',
  'html body #fx-panel.nb-settings .fx-font-grid button{border:1px solid var(--e-ink4)!important;border-radius:999px!important;background:transparent!important;box-shadow:none!important;color:var(--e-ink2)!important;font-size:12px!important}',
  'html body #fx-panel.nb-settings .fx-font-grid button.active{border-color:var(--e-hot)!important;color:var(--e-ink)!important;background:rgba(var(--sk-hot-rgb),.06)!important}',
  'html body #fx-panel.nb-settings .sonic-audio-monitor,html body #fx-panel.nb-settings .audio-output-section,html body #fx-panel.nb-settings .cache-storage-panel,html body #fx-panel.nb-settings .memory-status-chip,html body #fx-panel.nb-settings .gesture-settings-card,html body #fx-panel.nb-settings .lyric-glitch-controls{background:transparent!important;border:1px solid var(--e-line)!important;border-radius:10px!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  'html body #fx-panel.nb-settings .fx-actions{margin-top:10px!important;justify-content:flex-start!important}',
  'html body #fx-panel.nb-settings .fx-search-hit{outline-color:var(--e-hot)!important}',
  // ---- 设置 › 常用 ----
  '.nbq{padding:4px 0 6px}',
  '.nbq-sh{display:flex;align-items:center;gap:10px;margin:18px 0 2px;color:var(--e-ink2)}',
  '.nbq-sh:first-child{margin-top:8px}',
  '.nbq-no{font:10.5px/1 var(--e-mono);color:var(--e-hot);letter-spacing:.06em}',
  '.nbq-sh b{font:500 14px/1 var(--e-ui);letter-spacing:.1em;color:var(--e-ink)}',
  '.nbq-rule{flex:1;height:1px;background:var(--e-line)}',
  '.nbq-row{display:flex;align-items:center;justify-content:space-between;gap:14px}',
  'html body #fx-panel.nb-settings .nbq .nb-sw-row{border-top:0;border-bottom:1px solid var(--e-line);padding:12px 2px}',
  '.nbq-l,.nbq .nb-sw-txt{display:flex;flex-direction:column;gap:3px;min-width:0}',
  '.nbq-l b,.nbq .nb-sw-txt b{font:500 13px/1.25 var(--e-ui);color:var(--e-ink2)}',
  '.nbq-l small,.nbq .nb-sw-txt small{font:11px/1.35 var(--e-ui);color:var(--e-ink3)}',
  '.nbq .nb-sw-row[aria-checked=true] .nb-sw-txt b{color:var(--e-ink)}',
  'html body #fx-panel.nb-settings .nbq-range{grid-template-columns:minmax(0,120px) minmax(0,1fr) 44px!important;padding:12px 2px!important;border-bottom:1px solid var(--e-line)!important}',
  '.nbq-segrow{flex-direction:column;align-items:stretch;gap:6px;padding:12px 2px 0}',
  'html body #fx-panel.nb-settings .nbq-seg{margin:0!important}',
  '.nbq-links{display:flex;flex-wrap:wrap;gap:8px;padding:16px 0 4px}',
  'html body #fx-panel.nb-settings .nbq-links button{display:inline-flex;align-items:center;gap:4px;height:30px;padding:0 10px 0 14px;border:1px solid var(--e-ink4);border-radius:999px;background:transparent;color:var(--e-ink2);font:12px/1 var(--e-ui);cursor:pointer;transition:border-color .18s,color .18s}',
  'html body #fx-panel.nb-settings .nbq-links button svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transition:transform .3s cubic-bezier(.2,1.18,.3,1)}',
  'html body #fx-panel.nb-settings .nbq-links button:hover{border-color:rgba(var(--sk-ink-rgb),.4);color:var(--e-ink)}',
  'html body #fx-panel.nb-settings .nbq-links button:hover svg{transform:translateX(2px)}',
  '.nbq-foot{margin:18px 0 0;font:11px/1.5 var(--e-ui);color:var(--e-ink3)}',
  '.nbq .nb-sw{position:relative;flex:none;width:30px;height:14px}',
  '.nbq .nb-sw::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--e-ink4);transition:background .25s}',
  '.nbq .nb-sw::after{content:"";position:absolute;left:0;top:50%;width:11px;height:11px;margin-top:-5.5px;border-radius:50%;box-sizing:border-box;border:1.5px solid var(--e-ink3);background:var(--sk-solid);transition:left .45s cubic-bezier(.2,1.18,.3,1),background .2s,border-color .2s,box-shadow .3s}',
  '.nbq .nb-sw-row:hover .nb-sw::after{border-color:var(--e-ink)}',
  '.nbq .nb-sw-row[aria-checked=true] .nb-sw::before{background:var(--e-ink2)}',
  '.nbq .nb-sw-row[aria-checked=true] .nb-sw::after{left:19px;background:var(--e-hot);border-color:var(--e-hot);box-shadow:0 0 10px rgba(var(--sk-hot-rgb),.45)}',
  'html body #fx-panel.nb-settings .nbq button.nb-sw-row{display:flex;width:100%;background:none;border-left:0;border-right:0;border-top:0;border-radius:0;cursor:pointer;text-align:left;font:inherit;color:inherit}',
  // ===== 各主题的小细节 =====
  'body.nb-sk-star #nb-visual .nbv-title,body.nb-sk-star #fx-panel.nb-settings .fx-title{text-shadow:0 0 18px rgba(255,236,200,.28)}',
  'body.nb-sk-star #fx-panel.nb-settings .fx-fold-title strong,body.nb-sk-star .nbq-sh b,body.nb-sk-star .nbv-sh b{font-family:var(--sk-title)!important;font-weight:400!important;letter-spacing:.14em!important}',
  'body.nb-sk-star .nb-sheet .nb-sw-row[aria-checked=true] .nb-sw::after,body.nb-sk-star #fx-panel.nb-settings .fx-toggle.on .dot::after{box-shadow:0 0 12px rgba(255,226,170,.8),0 0 2px #fff}',
  'body.nb-sk-aw-day #fx-panel.nb-settings .fx-fold-title strong,body.nb-sk-aw-night #fx-panel.nb-settings .fx-fold-title strong,body.nb-sk-aw-day .nbq-sh b,body.nb-sk-aw-night .nbq-sh b,body.nb-sk-aw-day .nbv-sh b,body.nb-sk-aw-night .nbv-sh b{font-family:var(--sk-title)!important;font-weight:400!important;font-size:15px!important;letter-spacing:.12em!important}',
  'body.nb-sk-aw-day #fx-panel.nb-settings .fx-panel-tabs button::before,body.nb-sk-aw-night #fx-panel.nb-settings .fx-panel-tabs button::before{font-style:italic}',
  'body.nb-sk-riso #nb-visual .nbv-title,body.nb-sk-riso #fx-panel.nb-settings .fx-title{text-shadow:2px 1.5px 0 rgba(255,61,154,.6)}',
  'body.nb-sk-riso #fx-panel.nb-settings .fx-panel-tabs button.active,body.nb-sk-riso #fx-panel.nb-settings .fx-seg button.active,body.nb-sk-riso #fx-panel.nb-settings .nbq-seg button.active{background:linear-gradient(rgba(255,217,46,0) 52%,rgba(255,217,46,.85) 52%,rgba(255,217,46,.85) 86%,rgba(255,217,46,0) 86%)!important}',
  'body.nb-sk-riso .nbq-sh b,body.nb-sk-riso .nbv-sh b,body.nb-sk-riso #fx-panel.nb-settings .fx-fold-title strong{font-weight:900!important}',
  'body.nb-sk-riso #nb-visual .nbv-theme.on .nbv-thumb{box-shadow:0 0 0 2px var(--sk-hot),4px 4px 0 rgba(42,76,156,.85)}',
  'body.nb-sk-riso #nb-visual .preset-card.active{box-shadow:0 0 0 1px var(--sk-hot),3px 3px 0 rgba(42,76,156,.85)!important}',
  // 浅色皮肤（午后白天 / 孔版）：原控制台里没被重画的文字统一换成墨色，封面取色、调色两个小弹窗保持原样
  'html body.nb-sk-light #fx-panel.nb-settings :where(.fx-console-group-body *:not(.color-lab-pop,.color-lab-pop *,.cover-color-pop,.cover-color-pop *,.cover-color-loupe)){color:rgba(var(--sk-ink-rgb),.72)!important;text-shadow:none!important}',
  'html body.nb-sk-light #fx-panel.nb-settings :where(.fx-console-group-body) :where(.audio-output-item,.cache-storage-row,.memory-action-row button,.gesture-settings-card *){background-color:transparent!important}',
  'html body.nb-sk-light #fx-panel.nb-settings .fx-console-search::-webkit-search-cancel-button{filter:none}',
  'body.nb-sk-light #nb-visual .preset-card{background:rgba(var(--sk-ink-rgb),.035)!important}',
  'body.nb-sk-light #nb-visual .preset-card::before,body.nb-sk-light #nb-visual .preset-card::after{display:none!important}',
  'body.nb-sk-light #nb-visual .preset-card .pc-icon{color:rgba(var(--sk-ink-rgb),.6)!important;filter:none!important;opacity:1!important}',
  'body.nb-sk-light #nb-visual .preset-card .pc-name *,body.nb-sk-light #nb-visual .preset-card .pc-desc *{color:inherit!important;text-shadow:none!important}',
  'body.nb-sk-light #nb-visual .nbv-thumb{background:rgba(var(--sk-ink-rgb),.08)}',
  // 选择后的提示（屏幕上方那条 toast）：跟着主题换
  'html body #toast{background:var(--sk-texture),var(--sk-pop)!important;color:var(--sk-ink)!important;border:0!important;border-radius:var(--sk-toast-radius)!important;box-shadow:var(--sk-toast-shadow)!important;backdrop-filter:blur(var(--sk-blur))!important;-webkit-backdrop-filter:blur(var(--sk-blur))!important;font:13px/1.45 var(--sk-ui)!important;letter-spacing:.04em!important;padding:10px 18px 10px 32px!important;min-height:0!important}',
  'html body #toast::before{content:"";position:absolute;left:15px;top:50%;width:7px;height:7px;margin-top:-3.5px;border-radius:50%;background:var(--sk-hot);box-shadow:0 0 10px rgba(var(--sk-hot-rgb),.7)}',
  'html body #toast::after{display:none!important}',
  'html body.nb-sk-star #toast{font-family:var(--sk-title)!important;letter-spacing:.12em!important;padding-left:34px!important}',
  'html body.nb-sk-star #toast::before{width:11px;height:11px;margin-top:-5.5px;left:14px;border-radius:0;clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);box-shadow:none;background:#ffe6b0;filter:drop-shadow(0 0 4px rgba(255,226,170,.9))}',
  'html body.nb-sk-aw-day #toast,html body.nb-sk-aw-night #toast{font-family:var(--sk-title)!important;font-size:14px!important;letter-spacing:.08em!important}',
  'html body.nb-sk-aw-day #toast::before,html body.nb-sk-aw-night #toast::before{width:10px;height:10px;margin-top:-5px;border-radius:1px;box-shadow:none;transform:rotate(45deg) scale(.8)}',
  'html body.nb-sk-riso #toast{font-weight:700!important;letter-spacing:.06em!important}',
  'html body.nb-sk-riso #toast::before{border-radius:0;width:9px;height:9px;margin-top:-4.5px;box-shadow:1.5px 1.5px 0 #ffd92e;transform:rotate(12deg)}',
  '@media (prefers-reduced-motion: reduce){#nb-visual,#nb-visual *,html body #fx-panel.nb-settings{transition-duration:.001ms!important;animation-duration:.001ms!important;animation-delay:0s!important}}'
].join('\n');

/* ---------- 启动 ---------- */
(function bootNbVisualSettings() {
  function mount() {
    if (nbSheetState.booted || !document.body) return;
    nbSheetState.booted = true;
    var st = document.createElement('style');
    st.id = 'nb-sheet-style';
    st.textContent = NB_SHEET_STYLE;
    document.head.appendChild(st);

    nbDecorateSettingsPanel();
    var panel = document.getElementById('fx-panel');
    if (panel && !panel.classList.contains('show')) panel.setAttribute('aria-hidden', 'true');
    nbBuildVisualSheet();
    var vis = document.getElementById('nb-visual');
    if (vis && vis.inert !== undefined) vis.inert = true;
    refreshNbVisualSheet();
    nbSyncBodyFlags();
    // [二改] 平面歌词：换了模式 / 效果 / 主页主题（跟随时）→ 面板跟着刷新
    if (window.NotBlindLyricFx && NotBlindLyricFx.onChange) NotBlindLyricFx.onChange(function () { if (nbSheetState.visual) { nbSyncLyricFx(); nbSyncVisualHints(); } });
    addEventListener('resize', function () { if (nbSheetState.visual || nbSheetState.settings) nbPlaceSheets(); }, { passive: true });

    // 常用页 + 细线滑条的进度
    nbBuildQuickPage();
    if (panel) {
      panel.addEventListener('input', function (e) {
        if (e.target && e.target.type === 'range') nbPaintRange(e.target);
      }, true);
      panel.addEventListener('click', function () {
        requestAnimationFrame(function () { nbPaintRanges(panel); nbQuickSync(); });
      });
      nbPaintRanges(panel);
    }
    // 原开关 / 分段按钮被别处改了（热键、撤销、另一处的同名开关）时，常用页和视觉面板的开关跟着变
    if (typeof MutationObserver === 'function') {
      var srcObs = new MutationObserver(function () {
        if (nbSheetState.settings) nbQuickSync();
        if (nbSheetState.visual) nbSyncSwitches();
      });
      var ids = ['t-desktopLyrics'];
      NB_QUICK.forEach(function (it) { if (it.src && it.kind !== 'range') ids.push(it.src); });
      ids.forEach(function (id) {
        var n = document.getElementById(id);
        if (n) srcObs.observe(n, { attributes: true, attributeFilter: ['class', 'aria-pressed'], subtree: true });
      });
    }
    // 预设卡片的高亮：主页还没播过歌时高亮"播放时会用的那个"
    if (typeof window.refreshPresetGrid === 'function' && !window.refreshPresetGrid.__nb) {
      var origRefresh = window.refreshPresetGrid;
      var wrappedRefresh = function () { var r = origRefresh.apply(this, arguments); nbFixPresetHighlight(); return r; };
      wrappedRefresh.__nb = true;
      window.refreshPresetGrid = wrappedRefresh;
    }

    // 桌面背景模式：面板区域也要挡住桌面图标的点击
    try {
      if (typeof DESKTOP_ICON_SHIELD_TARGETS !== 'undefined' && Array.isArray(DESKTOP_ICON_SHIELD_TARGETS) &&
        !DESKTOP_ICON_SHIELD_TARGETS.some(function (t) { return t.selector === '#nb-visual.show'; })) {
        DESKTOP_ICON_SHIELD_TARGETS.push({ selector: '#nb-visual.show', kind: 'fx-panel' });
      }
    } catch (_) { }
    // 3D 场景 / 唱片架的指针判断把视觉面板当成 UI
    try { if (typeof UI_HIT_SELECTOR === 'string' && UI_HIT_SELECTOR.indexOf('#nb-visual') < 0) UI_HIT_SELECTOR += ',#nb-visual'; } catch (_) { }
    // 右键回退：视觉面板排在"视觉控制台（设置）"前面
    try {
      if (typeof RIGHT_CLICK_BACK_STEPS !== 'undefined' && Array.isArray(RIGHT_CLICK_BACK_STEPS) &&
        !RIGHT_CLICK_BACK_STEPS.some(function (s) { return s[0] === '视觉'; })) {
        var at = -1;
        RIGHT_CLICK_BACK_STEPS.forEach(function (s, i) { if (s[0] === '视觉控制台' && at < 0) at = i; });
        var step = ['视觉', function () { return nbSheetState.visual; }, function () { return closeNbVisualSheet(false); }];
        if (at >= 0) RIGHT_CLICK_BACK_STEPS.splice(at, 0, step); else RIGHT_CLICK_BACK_STEPS.unshift(step);
      }
    } catch (_) { }

    // Esc：先关视觉面板；设置面板在没有更上层的小窗时关掉
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (nbSheetState.visual) {
        e.preventDefault(); e.stopPropagation();
        closeNbVisualSheet(true);
        return;
      }
      if (!nbSheetState.settings) return;
      var ae = document.activeElement;
      if (ae && ae.id === 'fx-console-search' && ae.value) return; // 搜索框自己先清空
      var busy = document.querySelector('#color-lab-pop.show,#cover-color-pop.show,#hotkey-modal.show,.modal-mask.show,#wallpaper-engine-modal.show,#wallpaper-engine-details-drawer.show,#audio-output-workflow-modal.show,#background-crop-modal.show,#local-beat-modal.show');
      if (busy) return;
      var pop = document.querySelector('#fx-console-search-results:not([hidden]),#fx-console-history:not([hidden])');
      if (pop) { e.preventDefault(); e.stopPropagation(); if (typeof closeFxConsolePopovers === 'function') closeFxConsolePopovers(); return; }
      e.preventDefault(); e.stopPropagation();
      toggleNbSettingsSheet(false);
    }, true);

    // 点面板外面：视觉面板收起
    // [二改 2026-09-28] 设置面板也一样：左键点到面板外面任何地方就收起（反馈：不想非得点 × / 按 Esc）。
    // 面板自己弹出的取色、快捷键、壁纸等小窗 / 弹窗里的点击不算"外面"。
    document.addEventListener('pointerdown', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (nbSheetState.visual) {
        if (!t.closest('#nb-visual,#mri-slot,#diy-mode-btn,#fullscreen-diy-btn,#visual-guide,.modal-mask,#toast')) closeNbVisualSheet(false);
      }
      if (nbSheetState.settings && e.button === 0) {
        if (t.closest('#fx-panel,[id^="fx-"],#mri-slot,#visual-guide,.modal-mask,#toast,#color-lab-pop,#cover-color-pop,#hotkey-modal,#wallpaper-engine-modal,#wallpaper-engine-details-drawer,#audio-output-workflow-modal,#background-crop-modal,#local-beat-modal,#custom-lyric-modal,[role="dialog"],[role="listbox"],[role="menu"]')) return;
        toggleNbSettingsSheet(false);
      }
    }, true);

    // 进出主页时刷新"去主页 / 去播放页"提示；沉浸模式、引导开始时收起面板
    new MutationObserver(function () {
      nbSyncSkin();
      if (nbSheetState.visual) nbSyncVisualHints();
      if ((nbHas('immersive-mode') || nbHas('visual-guide-active')) && (nbSheetState.visual || nbSheetState.settings)) closeNbSheets();
    }).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-home-theme', 'data-hth-page'] });
    nbSyncSkin();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);
})();
