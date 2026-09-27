;
// ============================================================
// [二改] 右上角单独一个「设为桌面背景 / 回到窗口」按钮
// 和设置里的「完整桌面模式」开关、快捷键走同一条路（applyWallpaperModeState）。
// ============================================================
(function () {
  var ICON_ENTER = '<svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' +
    '<rect x="3" y="4" width="18" height="12.5" rx="1.8"/><path d="M8.5 20h7M12 16.5V20"/>' +
    '<path d="M6.5 13.5l3.6-3.8 2.6 2.5 1.8-1.7 3 3"/><circle cx="15.6" cy="7.7" r="1.1"/></svg>';
  var ICON_EXIT = '<svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' +
    '<rect x="3" y="4" width="18" height="12.5" rx="1.8"/><path d="M8.5 20h7M12 16.5V20"/>' +
    '<path d="M9 12.8l6-5.6M10.6 7.2H15v4.4"/></svg>';
  var busy = false;

  function api() {
    return window.desktopWindow && window.desktopWindow.isDesktop ? window.desktopWindow : null;
  }
  function enabledNow() {
    var st = typeof desktopWallpaperRuntimeState !== 'undefined' ? desktopWallpaperRuntimeState : {};
    return !!(st.enabled === true || st.active === true);
  }

  function injectStyle() {
    if (document.getElementById('desktop-bg-btn-style')) return;
    var el = document.createElement('style');
    el.id = 'desktop-bg-btn-style';
    el.textContent = [
      '#desktop-bg-btn{position:relative}',
      '#desktop-bg-btn svg{transition:transform .35s cubic-bezier(.2,.8,.2,1)}',
      '#desktop-bg-btn:hover svg{transform:scale(1.08)}',
      '#desktop-bg-btn.is-on{color:rgba(255,255,255,.92)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.34),0 0 16px rgba(170,215,255,.22)!important}',
      '#desktop-bg-btn[aria-busy="true"]{opacity:.55;pointer-events:none}',
      '#desktop-bg-btn[aria-busy="true"] svg{animation:desktop-bg-btn-pulse .9s ease-in-out infinite}',
      '@keyframes desktop-bg-btn-pulse{50%{opacity:.35}}'
    ].join('');
    document.head.appendChild(el);
  }

  function render() {
    var btn = document.getElementById('desktop-bg-btn');
    if (!btn) return;
    var st = typeof desktopWallpaperRuntimeState !== 'undefined' ? desktopWallpaperRuntimeState : {};
    var on = enabledNow();
    var pending = busy || st.attaching === true;
    // [二改][流畅度] 每 0.5 秒刷一次，只在真的变了时才写属性（写同样的值也会叫醒盯着这个按钮的灵动岛等观察者）
    function attr(name, value) { if (btn.getAttribute(name) !== value) btn.setAttribute(name, value); }
    btn.classList.toggle('is-on', on);
    attr('aria-pressed', on ? 'true' : 'false');
    attr('aria-busy', pending ? 'true' : 'false');
    var hide = st.supported === false;
    if (btn.hidden !== hide) btn.hidden = hide;
    var label = on ? '回到窗口' : '设为桌面背景';
    attr('title', label);
    attr('aria-label', label);
    var want = on ? 'exit' : 'enter';
    if (btn.getAttribute('data-icon') !== want) {
      btn.innerHTML = on ? ICON_EXIT : ICON_ENTER;
      btn.setAttribute('data-icon', want);
    }
  }

  function toggle(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (busy || typeof applyWallpaperModeState !== 'function' || typeof fx === 'undefined') return;
    var next = !enabledNow();
    busy = true;
    render();
    fx.wallpaperMode = next;
    if (typeof updateFxInputs === 'function') updateFxInputs();
    Promise.resolve(applyWallpaperModeState(true)).then(function (result) {
      if (result && result.ok !== true && typeof showToast === 'function') {
        var why = typeof desktopWallpaperErrorLabel === 'function' ? desktopWallpaperErrorLabel(result.error) : '';
        showToast((next ? '设为桌面背景失败' : '回到窗口失败') + (why ? ' · ' + why : ''));
      }
    }).catch(function () { }).then(function () {
      busy = false;
      render();
    });
  }

  function mount() {
    if (!api() || document.getElementById('desktop-bg-btn')) return;
    var host = document.getElementById('top-right');
    if (!host) return;
    injectStyle();
    var btn = document.createElement('button');
    btn.id = 'desktop-bg-btn';
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.addEventListener('click', toggle);
    var before = document.getElementById('home-btn');
    host.insertBefore(btn, before || host.firstChild);
    render();
    // 状态由主进程推过来，这里跟着刷新图标
    setInterval(render, 500);
    // 锁定软件操作时，主进程发现光标进了右上角，就把右上角控制器亮出来，方便点"解锁"
    var a = api();
    if (a && typeof a.onDesktopLockZone === 'function') {
      a.onDesktopLockZone(function (payload) {
        if (payload && payload.inside) {
          if (typeof setDesktopModeControlPeek === 'function') setDesktopModeControlPeek(true);
          if (typeof cancelDesktopModeControlPeekHide === 'function') cancelDesktopModeControlPeekHide();
        } else if (typeof scheduleDesktopModeControlPeekHide === 'function') {
          scheduleDesktopModeControlPeekHide(700);
        }
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
