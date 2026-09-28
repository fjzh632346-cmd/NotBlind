;
// ============================================================
// [二改 2026-09-28] 几条"新变化"小提示 —— 和新手引导同一套卡片（挂在 22-onboarding.js 的 nbRegisterTip 上）
//   1. desktop-icons：第一次进桌面背景（能操作软件的状态）时，指着右上角的小按钮告诉用户桌面图标在哪藏。
//      进桌面背景后图标现在默认照常显示（01-desktop-icon-auto.js）。这一条老用户也会看到（forLegacy）。
//   2. stage-flat：新用户的播放页默认是跟随主页主题的平面歌词 —— 说明这是什么，想要 3D 舞台 / 调歌词大小去哪
//      （卡片上有「打开视觉」按钮，直接打开视觉面板并滚到「03 播放页效果」）。
//   3. lfx-kind：看过上一条之后，在视觉面板里、还是平面歌词时，指着「3D 舞台」那格说点这里换。
//   另外：原来讲 3D 镜头操作（滚轮拉远拉近、双击回正）的 stage 提示，只在 3D 舞台时才出；
//   换成 3D 舞台之后第一次回到播放页，它就接着出来，算是"换到 3D"这一步的后半段引导。
// ============================================================
(function () {
  if (window.__nbTipsExtra) return;
  window.__nbTipsExtra = true;

  function bodyHas(c) { return !!(document.body && document.body.classList.contains(c)); }
  function lfx() { return window.NotBlindLyricFx || null; }
  function flatMode() { var a = lfx(); try { return !!(a && a.mode() === '2d'); } catch (_e) { return false; } }
  function flatShowing() {
    var a = lfx();
    try { var st = a && a.state(); return !!(st && st.mode === '2d' && (st.phase === 'on' || st.phase === 'in')); } catch (_e) { return false; }
  }
  function flatName() {
    var a = lfx();
    try {
      var id = a.currentId(), list = a.list();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    } catch (_e) { }
    return '平面歌词';
  }
  function iconsHiddenPref() {
    try { return typeof desktopIconsHiddenPref === 'function' && desktopIconsHiddenPref(); } catch (_e) { return false; }
  }

  // ---------- 桌面背景：提示指着右上角的小按钮时，别让按钮自己缩回去 ----------
  // 右上角控制器平时是隐形的，鼠标靠近才"探出来"（desktop-mode-control-peek）；提示期间让它一直探着
  var HOLD = { on: false, until: 0, timer: 0 };
  function holding() { return HOLD.on || Date.now() < HOLD.until; }
  function dockEditable() { return bodyHas('desktop-wallpaper-mode') && bodyHas('desktop-wallpaper-interactive') && !bodyHas('desktop-software-locked'); }
  function wrapPeek() {
    if (typeof setDesktopModeControlPeek !== 'function' || setDesktopModeControlPeek.__nbTip) return;
    var orig = setDesktopModeControlPeek;
    var wrapped = function (peek) {
      if (peek !== true && holding() && dockEditable()) return;   // 切到背景 / 退出时照常收起
      return orig.apply(this, arguments);
    };
    wrapped.__nbTip = true;
    setDesktopModeControlPeek = wrapped;
  }
  function peekOn(ms) {
    wrapPeek();
    if (ms) HOLD.until = Math.max(HOLD.until, Date.now() + ms);
    try { if (typeof setDesktopModeControlPeek === 'function') setDesktopModeControlPeek(true); } catch (_e) { }
    clearTimeout(HOLD.timer);
    if (ms) HOLD.timer = setTimeout(function () { if (!HOLD.on) peekRelease(); }, ms + 80);
  }
  function peekRelease() {
    HOLD.on = false; HOLD.until = 0; clearTimeout(HOLD.timer); HOLD.timer = 0;
    try { if (typeof scheduleDesktopModeControlPeekHide === 'function') scheduleDesktopModeControlPeekHide(900); } catch (_e) { }
  }
  function shieldReport() {
    try { if (typeof scheduleDesktopIconShieldReport === 'function') scheduleDesktopIconShieldReport(false); } catch (_e) { }
  }
  // 桌面背景里，提示卡片那块也要挡住桌面图标的点击（不然点「知道了」会点到桌面上）
  try {
    if (typeof DESKTOP_ICON_SHIELD_TARGETS !== 'undefined' && Array.isArray(DESKTOP_ICON_SHIELD_TARGETS) &&
      !DESKTOP_ICON_SHIELD_TARGETS.some(function (t) { return t.selector === '#nb-tip.on'; })) {
      DESKTOP_ICON_SHIELD_TARGETS.push({ selector: '#nb-tip.on', kind: 'guide' });
    }
  } catch (_e) { }

  function boot(n) {
    if (typeof window.nbRegisterTip !== 'function' || !window.nbTipKit) {
      if ((n || 0) < 40) setTimeout(function () { boot((n || 0) + 1); }, 250);
      return;
    }
    var K = window.nbTipKit;
    function onStage() {
      return K.hasTrack() && !K.has('empty-home-active') && !K.has('home-theme-on') && !K.sheet('visual') && !K.sheet('settings');
    }

    // 原来的 stage 提示讲的是 3D 镜头：只在 3D 舞台时出
    var stage = typeof window.nbGetTip === 'function' ? window.nbGetTip('stage') : null;
    if (stage && !stage.__nbFlatAware) {
      var stageWhen = stage.when;
      stage.when = function () { return !flatMode() && stageWhen(); };
      stage.__nbFlatAware = true;
    }

    // ---------- 1. 桌面图标在哪藏 ----------
    window.nbRegisterTip({
      key: 'desktop-icons', kick: 'DESKTOP · 桌面背景',
      forLegacy: true, allowDesktop: true, allowImmersive: true, delay: 1600,
      when: function () { return dockEditable() && !iconsHiddenPref(); },
      prepare: function () { peekOn(4200); },
      onStart: function () { HOLD.on = true; peekOn(0); shieldReport(); },
      onEnd: function () { peekRelease(); shieldReport(); },
      anchor: function () {
        var h = document.getElementById('desktop-mode-control-handle');
        if (K.visibleRect(h)) return h;
        // 还是隐形的：先让它探出来，下一轮再指（淡入要 0.2 秒）
        if (h && dockEditable()) peekOn(2600);
        return null;
      },
      title: '桌面图标可以藏起来',
      body: '进桌面背景时图标照常显示。想让画面干净些：点右上角这个按钮，关掉<em>「显示桌面图标」</em>，下次进来会记住。平时它是隐形的，鼠标移到屏幕右上角就会出来。',
      clickAnchorDismiss: true, closeWhenGone: true, clampOk: true,
      dur: 18000
    }, 'settings');

    // ---------- 2. 播放页是跟随主题的平面歌词 ----------
    window.nbRegisterTip({
      key: 'stage-flat', kick: 'STAGE · 播放页',
      when: function () { return flatShowing() && onStage(); },
      allowImmersive: true, delay: 2200,
      anchor: null,
      title: function () { return '播放页：「' + flatName() + '」平面歌词'; },
      body: '它跟着主页主题换样子。想要能拖动转视角的<em> 3D 舞台</em>，或者调<em>歌词大小</em>，都在右上角「视觉」里；<kbd>I</kbd> 收起全部界面，<kbd>Esc</kbd> 或右键退回上一步。',
      action: { label: '打开视觉', run: function () { if (typeof openNbVisualSheet === 'function') openNbVisualSheet('stage'); } },
      dur: 17000
    }, 'stage');

    // ---------- 3. 视觉面板里：点这里换成 3D 舞台 ----------
    window.nbRegisterTip({
      key: 'lfx-kind', kick: 'STAGE · 换成 3D',
      when: function () { return K.sheet('visual') && flatMode() && K.seen('stage-flat'); },
      anchor: K.q('#nb-visual .nbv-kind [data-nb-act="kind-3d"]'), side: 'left',
      delay: 600,
      title: '点这里换成 3D 舞台',
      body: '粒子和立体歌词：拖动画面转视角，滚轮拉远拉近，双击镜头回正。想回到平面歌词，再点右边那一格；下面的滑条调歌词大小，两种都管用。',
      clickAnchorDismiss: true, closeWhenGone: true,
      dur: 16000
    }, 'visual');
  }
  boot(0);

  // 卡片上的动作按钮（「打开视觉」）
  (function style() {
    if (document.getElementById('nb-tips-extra-css')) return;
    var st = document.createElement('style');
    st.id = 'nb-tips-extra-css';
    st.textContent = [
      '#nb-tip .a .act{padding:5px 11px;border-radius:4px;background:#ff4a1c;color:#fff;font-weight:600;border-bottom:0;transition:background .2s,transform .2s}',
      '#nb-tip .a .act:hover{background:#ff6a42;color:#fff}',
      '#nb-tip .a .act:active{transform:scale(.96)}',
      '#nb-tip .a .act[hidden]{display:none}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  })();
})();
