;
// ============================================================
// [二改] 完整桌面模式 · 编辑态自动藏桌面图标
// - 编辑（能操作 Not Blind）：自动隐藏 Windows 桌面图标，按钮不再被图标压住
// - 背景（右上角锁定 / 最小化成纯背景 / 退出）：图标自动回来
// 手动点了右上角的「显示/隐藏图标」，在切换到下一个状态之前都以手动为准。
// ============================================================
var desktopIconAuto = {
  mode: '',          // 'edit' | 'background' | ''
  manual: false,
  retryTimer: 0,
  fails: 0           // 原生层还没准备好（INACTIVE 等）时已重试的次数
};
var DESKTOP_ICON_AUTO_RETRY = [400, 1000, 2000];

function desktopIconAutoNoteManual() {
  desktopIconAuto.manual = true;
}

function desktopIconAutoClearRetry() {
  if (desktopIconAuto.retryTimer) { clearTimeout(desktopIconAuto.retryTimer); desktopIconAuto.retryTimer = 0; }
}

function desktopIconAutoApply(wantVisible, attempt) {
  desktopIconAutoClearRetry();
  if (desktopIconAuto.manual) return;
  var status = desktopWallpaperRuntimeState || {};
  if (desktopIconsAreVisible(status) === wantVisible) { desktopIconAuto.fails = 0; return; }
  var mode = desktopIconAuto.mode;
  function again(ms, nextAttempt) {
    desktopIconAuto.retryTimer = setTimeout(function () {
      desktopIconAuto.retryTimer = 0;
      // 状态已经变了（切到背景 / 退出 / 手动）就不再追
      if (desktopIconAuto.mode !== mode || desktopIconAuto.manual) return;
      if (typeof fx !== 'undefined' && fx && fx.desktopIconsAutoHide === false) return;
      desktopIconAutoApply(wantVisible, nextAttempt);
    }, ms);
  }
  if (desktopIconVisibilityPending) {
    if ((attempt || 0) < 6) again(260, (attempt || 0) + 1);
    return;
  }
  var res;
  try { res = setDesktopIconsVisibility(wantVisible, null, { quiet: true }); } catch (_) { res = null; }
  Promise.resolve(res).then(function (r) {
    if (r && r.ok === true) { desktopIconAuto.fails = 0; return; }
    if (desktopIconAuto.mode !== mode || desktopIconAuto.manual) return;
    var err = String(r && r.error || '');
    if (err.indexOf('BUSY') >= 0) {
      if ((attempt || 0) < 6) again(260, (attempt || 0) + 1);
      return;
    }
    // 失败（多半是图标层还没准备好）：隔一会儿再试几次；都不行就清掉记录，等下一次状态推送再试
    var n = desktopIconAuto.fails++;
    if (n < DESKTOP_ICON_AUTO_RETRY.length) again(DESKTOP_ICON_AUTO_RETRY[n], 0);
    else { desktopIconAuto.fails = 0; desktopIconAuto.mode = ''; }
  }, function () { });
}

function desktopIconAutoOnStatus(status, enabled, interactive) {
  status = status || {};
  if (!enabled || !interactive) {
    // 纯背景 / 退出时，原生层会把图标还原成进入前的样子，这里只清状态
    desktopIconAutoClearRetry();
    desktopIconAuto.mode = '';
    desktopIconAuto.manual = false;
    desktopIconAuto.fails = 0;
    return;
  }
  var mode = status.softwareInteractionLocked === true ? 'background' : 'edit';
  if (mode === desktopIconAuto.mode) return;
  desktopIconAuto.mode = mode;
  desktopIconAuto.manual = false;
  desktopIconAuto.fails = 0;
  if (fx && fx.desktopIconsAutoHide === false) return;
  // 等右上角控制器和状态都稳定一下再动图标
  desktopIconAutoClearRetry();
  desktopIconAuto.retryTimer = setTimeout(function () {
    desktopIconAuto.retryTimer = 0;
    if (desktopIconAuto.mode !== mode) return;
    desktopIconAutoApply(mode !== 'edit', 0);
  }, 120);
}

// 拼图 reset 后调用：退出没成功、还停在桌面编辑态时，散落前强制显示的图标要按自动规则重新处理
function desktopIconAutoRecheck() {
  var s = (typeof desktopWallpaperRuntimeState !== 'undefined' && desktopWallpaperRuntimeState) || {};
  var b = document.body;
  var enabled = (s.enabled === true || s.active === true) && !!(b && b.classList.contains('desktop-wallpaper-mode'));
  var interactive = s.interactive === true && !!(b && b.classList.contains('desktop-wallpaper-interactive'));
  if (!enabled || !interactive) return;
  desktopIconAuto.mode = '';
  desktopIconAuto.manual = false;
  desktopIconAutoOnStatus(s, true, true);
}
