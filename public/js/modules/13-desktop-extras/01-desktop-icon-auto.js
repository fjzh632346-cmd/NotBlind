;
// ============================================================
// [二改] 完整桌面模式 · 桌面图标
// 2026-09-28 用户反馈：新用户一进桌面背景，桌面图标就"没了"，以为出错了。
// 现在默认：进桌面背景后图标照常显示；想藏起来就在右上角「桌面控制」里关掉「显示桌面图标」，
// 这个选择会记住（NB_DESKTOP_ICONS_PREF_KEY），下次进桌面背景的编辑状态照你上次选的来。
// - 编辑（能操作 Not Blind）：按记住的选择（默认显示）
// - 背景（右上角锁定 / 最小化成纯背景 / 退出）：图标自动回来
// 第一次进桌面背景时有一条小提示告诉用户在哪藏图标（23-newbie-tips-extra.js）。
// ============================================================
var NB_DESKTOP_ICONS_PREF_KEY = 'notblind-desktop-icons-hidden-v1';
function desktopIconsHiddenPref() {
  try { return localStorage.getItem(NB_DESKTOP_ICONS_PREF_KEY) === '1'; } catch (_) { return false; }
}
function setDesktopIconsHiddenPref(hidden) {
  try { localStorage.setItem(NB_DESKTOP_ICONS_PREF_KEY, hidden ? '1' : '0'); } catch (_) { }
}
var desktopIconAuto = {
  mode: '',          // 'edit' | 'background' | ''
  manual: false,
  retryTimer: 0,
  fails: 0           // 原生层还没准备好（INACTIVE 等）时已重试的次数
};
var DESKTOP_ICON_AUTO_RETRY = [400, 1000, 2000];

function desktopIconAutoNoteManual(wantVisible) {
  desktopIconAuto.manual = true;
  // 在编辑状态下手动开 / 关图标：记下来，下次进来照这个来
  if (typeof wantVisible === 'boolean' && desktopIconAuto.mode === 'edit') setDesktopIconsHiddenPref(!wantVisible);
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
  // 编辑状态：默认显示图标，用户在「桌面控制」里关过就按记住的藏起来；背景状态：总是显示
  var wantVisible = mode !== 'edit' || !desktopIconsHiddenPref();
  // 等右上角控制器和状态都稳定一下再动图标
  desktopIconAutoClearRetry();
  desktopIconAuto.retryTimer = setTimeout(function () {
    desktopIconAuto.retryTimer = 0;
    if (desktopIconAuto.mode !== mode) return;
    desktopIconAutoApply(wantVisible, 0);
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
