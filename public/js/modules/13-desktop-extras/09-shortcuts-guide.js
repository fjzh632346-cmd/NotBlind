;
// ============================================================
// [二改 2026-09-27] 快捷键 + 使用引导
//   1. Ctrl+K：四个主页主题通用"打开搜索"（主题里点它自己的搜索入口；播放页打开顶部搜索框）
//   2. 设置里新增「快捷键」页：列出全部快捷键；能改的点一下录新键（沿用原热键系统，存同一份设置）
//   3. 使用引导按默认页（回声）的版式重做：左边一列大字步骤、地平线 + 圆（进度）、圆下面是说明；
//      最后一页是键盘小抄。原 #visual-guide 的卡片不再显示，步骤函数名保持不变（右键回退等照常调用）
// ============================================================
(function () {
  var HOT = '#ff4a1c';
  var HEAVY = '"Source Han Sans SC Heavy","思源黑体 Heavy","Noto Sans SC Black","Noto Sans CJK SC","Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif';
  var UI = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  var THIN = '"Segoe UI Light","Segoe UI","Microsoft YaHei UI Light","Microsoft YaHei UI",sans-serif';
  var MONO = '"Cascadia Mono",Consolas,"Microsoft YaHei UI",monospace';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function typing(t) {
    if (typeof isTypingTarget === 'function') { try { return isTypingTarget(t); } catch (_e) { } }
    return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
  }
  function capturingHotkey() { return typeof hotkeyCaptureState !== 'undefined' && !!hotkeyCaptureState; }

  // ============================================================
  // 1. Ctrl+K = 搜索（所有主题通用）
  // ============================================================
  function openSearchAnywhere() {
    var host = typeof homeThemeHost === 'object' ? homeThemeHost : null;
    if (host && host.visible && host.root) {
      var id = host.current, el = null;
      if (id === 'star-atlas') el = host.root.querySelector('.sx-hint');
      else if (id === 'afternoon') el = host.root.querySelector('.ha-shint');
      else if (id === 'riso-poster') el = host.root.querySelector('.rp-hint-hit') || host.root.querySelector('.rp-hint');
      else if (id === 'echo') {
        var faces = host.root.querySelectorAll('.ec-row .ec-face');
        for (var i = 0; i < faces.length; i++) if (faces[i].textContent === '搜索') { el = faces[i].closest('.ec-row'); break; }
      }
      if (el) { el.click(); return; }
    }
    if (typeof runHomeSearch === 'function') runHomeSearch('');
  }
  window.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.code !== 'KeyK') return;
    if (capturingHotkey() || (typeof visualGuideActive !== 'undefined' && visualGuideActive)) return;
    var t = e.target;
    // 已经在某个搜索框里打字时不重复打开
    if (typing(t) && !(t && t.closest && t.closest('#fx-panel'))) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (typeof toggleNbSettingsSheet === 'function' && typeof nbSheetState === 'object' && nbSheetState.settings) toggleNbSettingsSheet(false);
    openSearchAnywhere();
  }, true);

  // ============================================================
  // 2. 快捷键清单（设置页和引导小抄共用）
  // ============================================================
  // act = 原热键系统里的动作（能改）；keys = 写死的按键（显示用）
  var SK_GROUPS = [
    { t: '播放', rows: [
      { l: '播放 / 暂停', act: 'togglePlay' },
      { l: '上一首', act: 'prevTrack' },
      { l: '下一首', act: 'nextTrack' },
      { l: '音量增加', act: 'volumeUp' },
      { l: '音量降低', act: 'volumeDown' },
      { l: '歌词开 / 关', keys: ['L'] },
      { l: '桌面歌词', act: 'toggleDesktopLyrics' }
    ] },
    { t: '界面', rows: [
      { l: '搜索', keys: ['Ctrl', 'K'], h: '四个主题通用' },
      { l: '回主页', keys: ['Home'] },
      { l: '沉浸模式', keys: ['I'] },
      { l: '全屏', act: 'toggleFullscreen' },
      { l: '打开 / 收起设置', keys: ['P'] },
      { l: '一层层退出', keys: ['Esc'], h: '沉浸 → 全屏 → 弹窗、面板' },
      { l: '回退上一步', keys: ['右键'] }
    ] },
    { t: '播放页镜头', rows: [
      { l: '拉远 / 拉近', keys: ['滚轮'] },
      { l: '镜头回正', keys: ['K'], alt: ['双击画面'] },
      { l: '自由镜头：打开 / 固定', keys: ['Shift', 'R'], h: '固定后滚轮推拉，按 K 回到默认镜头' },
      { l: '自由镜头里移动', keys: ['W', 'A', 'S', 'D'], sep: '/', h: '鼠标转向 · Space / Ctrl 升降 · Q / E 旋转 · Shift 加速' },
      { l: '3D 歌单架翻页', keys: ['[', ']'], alt: ['PageUp', 'PageDown'], sep: '/' }
    ] }
  ];
  function actMeta(k) { return typeof hotkeyActionMeta === 'function' ? hotkeyActionMeta(k) : null; }
  function binding(scope, k) {
    try { return (hotkeySettings && hotkeySettings[scope] && hotkeySettings[scope][k]) || ''; } catch (_e) { return ''; }
  }
  function keyParts(hk) {
    hk = String(hk || '').trim();
    if (!hk) return [];
    return hk.split('+').map(function (p) {
      if (p === 'ArrowLeft') return '←';
      if (p === 'ArrowRight') return '→';
      if (p === 'ArrowUp') return '↑';
      if (p === 'ArrowDown') return '↓';
      if (p === 'Space') return '空格';
      return typeof hotkeyDisplayPart === 'function' ? hotkeyDisplayPart(p) : p;
    });
  }
  function caps(parts, cls, sep) {
    return parts.map(function (p) { return '<kbd class="' + (cls || '') + '">' + esc(p) + '</kbd>'; }).join('<i class="nbk-plus">' + (sep || '+') + '</i>');
  }

  // ---------- 设置 › 快捷键 ----------
  var KEYS_TAB = { key: 'keys', label: '快捷键' };
  try { if (typeof FX_CONSOLE_TABS !== 'undefined' && !FX_CONSOLE_TABS.some(function (t) { return t.key === 'keys'; })) FX_CONSOLE_TABS.splice(FX_CONSOLE_TABS.length - 1, 0, KEYS_TAB); } catch (_e) { }

  function keysPage() {
    var page = document.getElementById('fx-console-page-keys');
    if (page) return page;
    var panel = document.getElementById('fx-panel');
    var tabs = document.getElementById('fx-panel-tabs');
    if (!panel || !tabs) return null;
    // 设置面板已经整理过（新加的页签没赶上）：手动补一个页签和一页
    if (!tabs.querySelector('[data-fx-tab="keys"]')) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.id = 'fx-console-tab-keys'; btn.setAttribute('role', 'tab'); btn.setAttribute('data-fx-tab', 'keys');
      btn.setAttribute('aria-controls', 'fx-console-page-keys'); btn.setAttribute('aria-selected', 'false'); btn.setAttribute('tabindex', '-1');
      btn.textContent = KEYS_TAB.label;
      var sys = tabs.querySelector('[data-fx-tab="system"]');
      tabs.insertBefore(btn, sys || null);
    }
    page = document.createElement('div');
    page.id = 'fx-console-page-keys'; page.className = 'fx-tab-page'; page.setAttribute('data-fx-page', 'keys');
    page.setAttribute('role', 'tabpanel'); page.setAttribute('aria-labelledby', 'fx-console-tab-keys'); page.setAttribute('aria-hidden', 'true');
    var sysPage = document.getElementById('fx-console-page-system');
    panel.insertBefore(page, sysPage || null);
    return page;
  }

  var keysBound = false;
  function renderKeysPage() {
    var page = keysPage();
    if (!page) return;
    var cap = capturingHotkey() ? hotkeyCaptureState : null;
    var dupL = typeof hotkeyDuplicateMap === 'function' ? hotkeyDuplicateMap('local') : {};
    var dupG = typeof hotkeyDuplicateMap === 'function' ? hotkeyDuplicateMap('global') : {};
    var html = '<div class="nbk">';
    html += '<p class="nbk-intro">带 <span class="nbk-edit-mark">可改</span> 的点一下按键，再按新的组合键就换好了；按 Backspace 清空，Esc 取消。</p>';
    SK_GROUPS.forEach(function (g, gi) {
      html += '<div class="nbq-sh nbk-sh"><span class="nbq-no">0' + (gi + 1) + '</span><b>' + esc(g.t) + '</b><i class="nbq-rule"></i></div>';
      g.rows.forEach(function (r) {
        var right;
        if (r.act) {
          var b = binding('local', r.act);
          var isCap = cap && cap.scope === 'local' && cap.action === r.act;
          var meta = actMeta(r.act);
          var bad = b && dupL[b] > 1;
          right = '<button type="button" class="nbk-key' + (isCap ? ' capturing' : '') + (bad ? ' bad' : '') + '" data-nbk-bind="local" data-nbk-act="' + r.act + '" title="点一下，按新的组合键">' +
            (isCap ? '<span class="nbk-wait">按下新组合键…</span>' : (b ? caps(keyParts(b)) : '<span class="nbk-none">未设置</span>')) + '</button>' +
            (meta && b !== (meta.local || '') ? '<button type="button" class="nbk-reset" data-nbk-reset="local" data-nbk-act="' + r.act + '">默认</button>' : '<span class="nbk-reset ph"></span>');
          if (bad) r._warn = '和另一项重复了，两个都不会生效';
        } else {
          right = '<span class="nbk-fixed">' + caps(r.keys, '', r.sep) + (r.alt ? '<i class="nbk-or">或</i>' + caps(r.alt, '', r.sep) : '') + '</span><span class="nbk-reset ph"></span>';
        }
        html += '<div class="nbk-row' + (r.act ? ' editable' : '') + '"><span class="nbk-l"><b>' + esc(r.l) + '</b>' +
          (r._warn ? '<small class="warn">' + esc(r._warn) + '</small>' : (r.h ? '<small>' + esc(r.h) + '</small>' : '')) + '</span>' + right + '</div>';
        r._warn = '';
      });
    });
    // 全局：软件在后台（或当桌面背景）也能用
    html += '<div class="nbq-sh nbk-sh"><span class="nbq-no">0' + (SK_GROUPS.length + 1) + '</span><b>全局 · 软件在后台也能用</b><i class="nbq-rule"></i></div>';
    (typeof HOTKEY_ACTIONS !== 'undefined' ? HOTKEY_ACTIONS : []).forEach(function (a) {
      var b = binding('global', a.key);
      var isCap = cap && cap.scope === 'global' && cap.action === a.key;
      var st = (typeof hotkeyGlobalStatus === 'object' && hotkeyGlobalStatus) ? hotkeyGlobalStatus[a.key] : null;
      var warn = '';
      if (b && dupG[b] > 1) warn = '和另一项重复了';
      else if (b && st && st.ok === false) warn = '被' + ((st.conflict && st.conflict.sourceName) || '系统或其他软件') + '占用';
      html += '<div class="nbk-row editable"><span class="nbk-l"><b>' + esc(a.label) + '</b>' + (warn ? '<small class="warn">' + esc(warn) + '</small>' : (a.key === 'toggleDesktopInteraction' ? '<small>进入 / 退出完整桌面模式</small>' : '')) + '</span>' +
        '<button type="button" class="nbk-key' + (isCap ? ' capturing' : '') + (warn ? ' bad' : '') + '" data-nbk-bind="global" data-nbk-act="' + a.key + '">' +
        (isCap ? '<span class="nbk-wait">按下新组合键…</span>' : (b ? caps(keyParts(b)) : '<span class="nbk-none">未设置</span>')) + '</button>' +
        (b !== (a.global || '') ? '<button type="button" class="nbk-reset" data-nbk-reset="global" data-nbk-act="' + a.key + '">默认</button>' : '<span class="nbk-reset ph"></span>') + '</div>';
    });
    html += '<p class="nbq-foot nbk-foot">在搜索框、输入框里打字时，单键快捷键不会触发。</p>';
    html += '<div class="nbk-foot-links"><button type="button" data-nbk-guide>重新看使用引导</button><button type="button" data-nbk-resetall>全部恢复默认</button></div></div>';
    page.innerHTML = html;
    if (!keysBound) {
      keysBound = true;
      page.addEventListener('click', function (e) {
        var k = e.target.closest && e.target.closest('[data-nbk-bind]');
        if (k && typeof startHotkeyCapture === 'function') {
          e.preventDefault();
          var sc = k.getAttribute('data-nbk-bind'), ac = k.getAttribute('data-nbk-act');
          if (capturingHotkey() && hotkeyCaptureState.action === ac && hotkeyCaptureState.scope === sc) { hotkeyCaptureState = null; renderKeysPage(); return; }
          startHotkeyCapture(ac, sc);
          return;
        }
        var r = e.target.closest && e.target.closest('[data-nbk-reset]');
        if (r && typeof resetHotkeyBinding === 'function') { e.preventDefault(); resetHotkeyBinding(r.getAttribute('data-nbk-act'), r.getAttribute('data-nbk-reset')); return; }
        if (e.target.closest && e.target.closest('[data-nbk-resetall]')) {
          if (typeof getHotkeyDefaults === 'function') {
            hotkeySettings = getHotkeyDefaults();
            if (typeof saveHotkeySettings === 'function') saveHotkeySettings();
            if (typeof registerGlobalHotkeys === 'function') registerGlobalHotkeys();
            renderKeysPage();
            if (typeof showToast === 'function') showToast('快捷键已全部恢复默认');
          }
          return;
        }
        if (e.target.closest && e.target.closest('[data-nbk-guide]')) {
          if (typeof toggleNbSettingsSheet === 'function') toggleNbSettingsSheet(false);
          setTimeout(function () { if (typeof startVisualGuide === 'function') startVisualGuide({ manual: true, source: 'settings' }); }, 220);
        }
      });
    }
  }
  // 录键结束、恢复默认、全局热键检测结果回来时，原系统都会调 renderHotkeySettings —— 顺带刷新这一页
  if (typeof renderHotkeySettings === 'function') {
    var origRenderHK = renderHotkeySettings;
    renderHotkeySettings = function () {
      var r = origRenderHK.apply(this, arguments);
      try { if (document.getElementById('fx-console-page-keys')) renderKeysPage(); } catch (_e) { }
      return r;
    };
  }
  // 页签切换：原函数只认那几页，这里补上「快捷键」
  if (typeof setFxPanelTab === 'function') {
    var origSetTab = setFxPanelTab;
    setFxPanelTab = function (tab) {
      if (tab !== 'keys') {
        if (capturingHotkey()) { hotkeyCaptureState = null; }
        return origSetTab.apply(this, arguments);
      }
      origSetTab.call(this, 'quick');       // 让原函数把别的页收好、记下滚动位置
      var page = keysPage();
      if (!page) return;
      fxPanelTab = 'keys';
      var panel = document.getElementById('fx-panel');
      if (panel) panel.setAttribute('data-active-tab', 'keys');
      document.querySelectorAll('#fx-panel-tabs [data-fx-tab]').forEach(function (btn) {
        var on = btn.getAttribute('data-fx-tab') === 'keys';
        btn.classList.toggle('active', on); btn.setAttribute('aria-selected', on ? 'true' : 'false'); btn.setAttribute('tabindex', on ? '0' : '-1');
      });
      document.querySelectorAll('#fx-panel .fx-tab-page').forEach(function (p) {
        var on = p === page; p.classList.toggle('active', on); p.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      renderKeysPage();
      if (typeof registerGlobalHotkeys === 'function') { try { registerGlobalHotkeys(); } catch (_e) { } }
      if (panel) requestAnimationFrame(function () { panel.scrollTop = 0; });
    };
  }
  // 以前的"热键"小按钮 / 常用页里的"热键"链接：都来这一页
  if (typeof openHotkeySettings === 'function') {
    openHotkeySettings = function () {
      if (typeof toggleNbSettingsSheet === 'function') toggleNbSettingsSheet(true, 'keys');
      else if (typeof setFxPanelTab === 'function') setFxPanelTab('keys');
    };
  }
  // 设置面板每次打开都可能重排：保证页签在
  if (typeof toggleNbSettingsSheet === 'function') {
    var origToggleSettings = toggleNbSettingsSheet;
    toggleNbSettingsSheet = function (force, tab) {
      var r = origToggleSettings.apply(this, arguments);
      try { keysPage(); } catch (_e) { }
      return r;
    };
  }

  var KEYS_CSS = [
    '#fx-console-page-keys .nbk{padding:2px 0 18px}',
    '#fx-console-page-keys .nbk-intro{margin:10px 0 4px;font:12px/1.7 var(--e-ui,' + UI + ');color:var(--e-ink3,rgba(223,227,220,.44))}',
    '#fx-console-page-keys .nbk-edit-mark{font:10.5px/1 var(--e-mono,' + MONO + ');color:var(--e-hot,' + HOT + ');border-bottom:1px solid currentColor;padding-bottom:1px}',
    '#fx-console-page-keys .nbk-row{display:grid;grid-template-columns:minmax(0,1fr) auto 34px;align-items:center;gap:10px;min-height:40px;padding:6px 0;border-bottom:1px solid var(--e-line,rgba(223,227,220,.11))}',
    '#fx-console-page-keys .nbk-l{display:flex;flex-direction:column;gap:3px;min-width:0}',
    '#fx-console-page-keys .nbk-l b{font:400 13px/1.3 var(--e-ui,' + UI + ');color:var(--e-ink,#dfe3dc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#fx-console-page-keys .nbk-l small{font:11px/1.4 var(--e-ui,' + UI + ');color:var(--e-ink3,rgba(223,227,220,.44))}',
    '#fx-console-page-keys .nbk-l small.warn{color:var(--e-hot,' + HOT + ')}',
    '#fx-console-page-keys kbd{display:inline-grid;place-items:center;min-width:24px;height:24px;padding:0 7px;box-sizing:border-box;border:1px solid var(--e-ink4,rgba(223,227,220,.2));border-bottom-width:2px;border-radius:4px;font:11.5px/1 var(--e-mono,' + MONO + ');color:var(--e-ink2,rgba(223,227,220,.72));background:transparent;white-space:nowrap}',
    '#fx-console-page-keys .nbk-plus{font-style:normal;margin:0 3px;font:10px/1 var(--e-mono,' + MONO + ');color:var(--e-ink3,rgba(223,227,220,.44))}',
    '#fx-console-page-keys .nbk-or{font-style:normal;margin:0 7px;font-size:11px;color:var(--e-ink3,rgba(223,227,220,.44))}',
    '#fx-console-page-keys .nbk-fixed{display:inline-flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;opacity:.8}',
    '#fx-console-page-keys .nbk-key{display:inline-flex;align-items:center;justify-content:flex-end;gap:0;min-height:30px;padding:3px 8px;margin:0 -8px 0 0;border:1px dashed transparent;border-radius:6px;background:transparent;cursor:pointer;transition:border-color .2s,background .2s}',
    '#fx-console-page-keys .nbk-key kbd{color:var(--e-ink,#dfe3dc);border-color:var(--e-ink3,rgba(223,227,220,.44))}',
    '#fx-console-page-keys .nbk-key:hover{border-color:var(--e-ink4,rgba(223,227,220,.2))}',
    '#fx-console-page-keys .nbk-key:hover kbd{border-color:var(--e-hot,' + HOT + ')}',
    '#fx-console-page-keys .nbk-key.capturing{border-color:var(--e-hot,' + HOT + ');border-style:solid}',
    '#fx-console-page-keys .nbk-key.bad kbd{border-color:var(--e-hot,' + HOT + ');color:var(--e-hot,' + HOT + ')}',
    '#fx-console-page-keys .nbk-wait{font:12px/1 var(--e-ui,' + UI + ');color:var(--e-hot,' + HOT + ');animation:nbk-blink 1s steps(2) infinite}',
    '@keyframes nbk-blink{50%{opacity:.35}}',
    '#fx-console-page-keys .nbk-none{font:12px/1 var(--e-ui,' + UI + ');color:var(--e-ink3,rgba(223,227,220,.44))}',
    '#fx-console-page-keys .nbk-reset{justify-self:end;border:0;background:transparent;padding:4px 0;font:11px/1 var(--e-ui,' + UI + ');color:var(--e-ink3,rgba(223,227,220,.44));cursor:pointer}',
    '#fx-console-page-keys .nbk-reset:hover{color:var(--e-hot,' + HOT + ')}',
    '#fx-console-page-keys .nbk-reset.ph{visibility:hidden}',
    '#fx-console-page-keys .nbk-foot{margin-top:14px}',
    '#fx-console-page-keys .nbk-foot-links{display:flex;gap:18px;margin-top:6px}',
    '#fx-console-page-keys .nbk-foot-links button{border:0;background:transparent;padding:4px 0;font:12px/1 var(--e-ui,' + UI + ');color:var(--e-ink2,rgba(223,227,220,.72));border-bottom:1px solid var(--e-ink4,rgba(223,227,220,.2));cursor:pointer}',
    '#fx-console-page-keys .nbk-foot-links button:hover{color:var(--e-hot,' + HOT + ');border-color:currentColor}'
  ].join('\n');

  // ============================================================
  // 3. 使用引导：默认页（回声）版式
  // ============================================================
  var GUIDE = [
    { w: '欢迎', en: 'WELCOME', target: 'stage', title: 'Not Blind 是一台看得见的收音机', body: '搜一首歌或者导入本地音乐，封面、歌词、粒子和镜头会跟着音乐一起动。下面几页带你认一下各个地方，很快。' },
    { w: '搜索', en: 'SEARCH', selector: '#search-box', title: '从搜索开始', body: '鼠标移到屏幕最上方会出现搜索框；在主页上点主题里的搜索入口也行。任何时候按 Ctrl + K 都能直接开始搜。本地音乐可以直接拖进窗口。' },
    { w: '播放', en: 'CONTROL', selector: '#bottom-bar', title: '播放控制在最下面', body: '播放、切歌、进度、音质、队列和歌词都在这一条里，鼠标靠近底部就会浮出来。' },
    { w: '歌单', en: 'LIBRARY', selector: '#playlist-panel', title: '左边缘是歌单和队列', body: '鼠标贴着窗口左边停一下，当前队列、我的歌单、我的播客就会滑出来；点图钉可以让它一直开着。' },
    { w: '账号', en: 'ACCOUNT', selector: '#user-btn', title: '登录只是为了同步', body: '右上角小岛上点头像，登录网易云、QQ 音乐等平台，同步歌单和每日推荐。不登录也能搜索播放。' },
    { w: '视觉', en: 'VISUAL', selector: '#nb-visual-btn', title: '「视觉」：换主页、换播放页', body: '挑主页主题（回声、星图、午后窗影、孔版海报）和播放页的粒子效果，点一下就换。主页左上角的拉绳拉一下也能换主题。' },
    { w: '设置', en: 'SETTINGS', selector: '#nb-settings-btn', title: '「设置」：细节都在这里', body: '颜色、歌词、动效、歌单架、性能都能细调，顶部可以直接搜功能。全部快捷键在「设置 › 快捷键」，以后想再看这份引导也在那里。' },
    { w: '键盘', en: 'KEYS', keys: true, title: '键盘小抄', body: '' }
  ];
  var CHEAT = [
    { k: [['空格']], l: '播放 / 暂停' },
    { k: [['←'], ['→']], l: '上一首 / 下一首' },
    { k: [['↑'], ['↓']], l: '音量' },
    { k: [['Ctrl', 'K']], l: '搜索' },
    { k: [['Esc'], ['右键']], l: '退回上一步' },
    { k: [['I']], l: '沉浸模式' },
    { k: [['滚轮']], l: '拉远 / 拉近' },
    { k: [['双击']], l: '镜头回正' }
  ];
  // 小抄里能改的键，按用户现在的设置显示
  function cheatKeys(i) {
    var map = { 0: ['togglePlay'], 1: ['prevTrack', 'nextTrack'], 2: ['volumeUp', 'volumeDown'] };
    if (!map[i]) return CHEAT[i].k;
    var out = map[i].map(function (a) { var b = binding('local', a); return b ? keyParts(b) : null; }).filter(Boolean);
    return out.length ? out : CHEAT[i].k;
  }

  var GUIDE_CSS = [
    '#visual-guide{display:none!important}',
    // 主页主题会把原来的搜索框 / 播放条藏起来；引导讲到它们时临时放出来（引导的遮罩在最上面，只从挖开的洞里看得到）
    'body.home-theme-on.visual-guide-active.nbg-show-bar #bottom-bar{visibility:visible!important;opacity:1!important}',
    'body.home-theme-on.visual-guide-active.nbg-show-search #search-area{visibility:visible!important;opacity:1!important}',
    '#nb-guide{position:fixed;inset:0;z-index:2147483000;display:none;color:#dfe3dc;font-family:' + UI + ';-webkit-font-smoothing:antialiased;user-select:none;-webkit-app-region:no-drag;--ink:#dfe3dc;--ink2:rgba(223,227,220,.66);--ink3:rgba(223,227,220,.42);--ink4:rgba(223,227,220,.16);--hot:' + HOT + '}',
    'body.visual-guide-active #nb-guide{display:block}',
    '#nb-guide.in{animation:nbg-in .5s ease both}',
    '@keyframes nbg-in{from{opacity:0}to{opacity:1}}',
    '#nb-guide svg.nbg-sv{position:absolute;inset:0;width:100%;height:100%;overflow:visible}',
    '#nb-guide .nbg-veil{fill:rgba(20,18,17,.972);fill-rule:evenodd;transition:d .55s cubic-bezier(.2,.8,.2,1)}',
    '#nb-guide .nbg-hz{stroke:rgba(223,227,220,.5);stroke-width:1.2;fill:none;transition:d .6s cubic-bezier(.2,.8,.2,1)}',
    '#nb-guide .nbg-ring{stroke:rgba(223,227,220,.62);stroke-width:1.3;fill:rgba(20,18,17,.55)}',
    '#nb-guide .nbg-in{stroke:rgba(223,227,220,.34);stroke-width:1;fill:none}',
    '#nb-guide .nbg-tick{stroke:rgba(223,227,220,.4);stroke-width:1.2}',
    '#nb-guide .nbg-tick.done{stroke:var(--hot)}',
    '#nb-guide .nbg-arc{stroke:var(--hot);stroke-width:2;fill:none;stroke-linecap:round;transition:stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)}',
    '#nb-guide .nbg-dot{fill:var(--hot);filter:drop-shadow(0 0 6px rgba(255,74,28,.8));transition:cx .7s cubic-bezier(.2,.8,.2,1),cy .7s cubic-bezier(.2,.8,.2,1)}',
    '#nb-guide .nbg-ripple{stroke:rgba(223,227,220,.5);fill:none;stroke-width:1;opacity:0}',
    '#nb-guide .nbg-ripple.go{animation:nbg-rip 1.6s cubic-bezier(.2,.7,.3,1)}',
    '@keyframes nbg-rip{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(1.9)}}',
    '#nb-guide .nbg-lead{stroke:rgba(223,227,220,.45);stroke-width:1;fill:none;stroke-dasharray:3 4;transition:opacity .4s}',
    '#nb-guide .nbg-leaddot{fill:var(--hot)}',
    '#nb-guide .nbg-frame{stroke:rgba(223,227,220,.55);stroke-width:1;fill:none}',
    '#nb-guide .nbg-corner{stroke:var(--hot);stroke-width:2;fill:none;stroke-linecap:square}',
    '#nb-guide .nbg-tgt{transition:opacity .45s}',
    '#nb-guide .nbg-tgt.off{opacity:0}',
    // 左上名字
    '#nb-guide .nbg-brand{position:absolute;left:104px;top:34px;font:300 20px/1 ' + THIN + ';letter-spacing:.16em;color:var(--ink)}',
    '#nb-guide .nbg-brand small{margin-left:16px;font:11px/1 ' + MONO + ';letter-spacing:.2em;color:var(--ink3)}',
    // 左边一列大字 = 步骤
    '#nb-guide .nbg-col{position:absolute;left:96px;top:118px;transition:opacity .45s}',
    '#nb-guide .nbg-col.dim{opacity:.1;pointer-events:none}',
    '#nb-guide .nbg-row{position:relative;display:flex;align-items:center;gap:20px;height:var(--rh);cursor:pointer}',
    '#nb-guide .nbg-idx{font:11px ' + MONO + ';color:var(--ink3);width:20px;align-self:flex-start;margin-top:calc(var(--rh)*.18)}',
    '#nb-guide .nbg-wd{position:relative;font:900 var(--fs)/1 ' + HEAVY + ';letter-spacing:.02em;white-space:nowrap}',
    '#nb-guide .nbg-face{position:relative;color:transparent;-webkit-text-stroke:1.4px rgba(223,227,220,.26);transition:color .35s,-webkit-text-stroke-color .35s}',
    '#nb-guide .nbg-row.past .nbg-face{-webkit-text-stroke-color:rgba(223,227,220,.44)}',
    '#nb-guide .nbg-row:hover .nbg-face{-webkit-text-stroke-color:rgba(223,227,220,.8)}',
    '#nb-guide .nbg-row.on .nbg-face{color:var(--ink);-webkit-text-stroke-color:var(--ink)}',
    '#nb-guide .nbg-echo{position:absolute;left:0;top:0;color:transparent;-webkit-text-stroke:1.2px rgba(223,227,220,.6);opacity:0;pointer-events:none;transition:transform .9s cubic-bezier(.2,.8,.2,1),opacity .9s}',
    '#nb-guide .nbg-row.on .nbg-echo{opacity:calc(.5 - var(--e)*.1);transform:translateX(calc(var(--e)*var(--fs)*.16))}',
    '#nb-guide .nbg-row.on .nbg-echo.e1{-webkit-text-stroke-color:rgba(255,74,28,.7)}',
    '#nb-guide .nbg-en{margin-left:calc(var(--fs)*.6);font:500 11px ' + MONO + ';letter-spacing:.16em;color:var(--hot);opacity:0;transform:translateX(-8px);transition:opacity .3s,transform .35s}',
    '#nb-guide .nbg-row.on .nbg-en{opacity:1;transform:none}',
    // 圆里：下一步
    '#nb-guide .nbg-next{position:absolute;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;border:0;background:transparent;color:var(--ink);display:grid;place-items:center;cursor:pointer;transition:transform .2s,color .2s}',
    '#nb-guide .nbg-next:hover{transform:scale(1.1);color:var(--hot)}',
    '#nb-guide .nbg-next svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}',
    '#nb-guide .nbg-count{position:absolute;transform:translate(-50%,0);font:11px ' + MONO + ';letter-spacing:.14em;color:var(--ink3);white-space:nowrap}',
    // 圆下面：说明（位置同默认页的"正在播放"）
    '#nb-guide .nbg-txt{position:absolute;display:flex;flex-direction:column;gap:9px;transition:opacity .35s,transform .45s cubic-bezier(.2,.8,.2,1)}',
    '#nb-guide .nbg-txt.swap{opacity:0;transform:translateY(8px)}',
    '#nb-guide .nbg-kick{font:11px ' + MONO + ';color:var(--ink3);letter-spacing:.16em;display:flex;align-items:center;gap:8px}',
    '#nb-guide .nbg-kick i{width:6px;height:6px;border-radius:50%;background:var(--hot);box-shadow:0 0 10px var(--hot)}',
    '#nb-guide .nbg-title{font:900 30px/1.2 ' + HEAVY + ';letter-spacing:.02em;color:var(--ink)}',
    '#nb-guide .nbg-body{font:13.5px/1.85 ' + UI + ';color:var(--ink2);letter-spacing:.02em}',
    '#nb-guide .nbg-ctl{display:flex;align-items:center;gap:22px;margin-top:6px}',
    '#nb-guide .nbg-ctl button{border:0;background:transparent;padding:6px 0;font:12.5px/1 ' + UI + ';letter-spacing:.06em;color:var(--ink2);cursor:pointer;position:relative;transition:color .2s}',
    '#nb-guide .nbg-ctl button:hover{color:var(--ink)}',
    '#nb-guide .nbg-ctl button.pri{color:var(--ink)}',
    '#nb-guide .nbg-ctl button.pri::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1.5px;background:var(--hot)}',
    '#nb-guide .nbg-ctl button:disabled{opacity:.3;cursor:default}',
    '#nb-guide .nbg-ctl .sep{width:1px;height:12px;background:var(--ink4)}',
    '#nb-guide .nbg-ctl .skip{margin-left:auto;color:var(--ink3)}',
    '#nb-guide button:focus-visible{outline:1.5px solid var(--hot);outline-offset:3px}',
    // 键盘小抄
    '#nb-guide .nbg-cheat{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 26px;margin:4px 0 2px}',
    '#nb-guide .nbg-cheat.one{grid-template-columns:1fr}',
    '#nb-guide .nbg-ck{display:flex;align-items:center;gap:12px;min-height:38px;border-bottom:1px solid var(--ink4)}',
    '#nb-guide .nbg-ck .ks{flex:none;display:flex;align-items:center;gap:4px;min-width:84px}',
    '#nb-guide .nbg-ck kbd{display:inline-grid;place-items:center;min-width:26px;height:26px;padding:0 7px;box-sizing:border-box;border:1px solid rgba(223,227,220,.42);border-bottom-width:2px;border-radius:4px;font:12px/1 ' + MONO + ';color:var(--ink);white-space:nowrap}',
    '#nb-guide .nbg-ck i{font-style:normal;font:10px ' + MONO + ';color:var(--ink3)}',
    '#nb-guide .nbg-ck span{font-size:13px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#nb-guide .nbg-ck:nth-child(-n+2) kbd{border-color:var(--hot)}',
    '#nb-guide .nbg-more{font-size:12px;color:var(--ink3);margin-top:4px}',
    '#nb-guide .nbg-more b{font-weight:400;color:var(--ink2);border-bottom:1px solid var(--ink4)}',
    '#nb-guide .nbg-hint{position:absolute;right:28px;bottom:22px;font:11px ' + MONO + ';letter-spacing:.12em;color:var(--ink3)}',
    '@media (prefers-reduced-motion:reduce){#nb-guide *{transition:none!important;animation:none!important}}'
  ].join('\n');

  var G = { el: null, sv: null, i: 0, prevTarget: null, raf: 0 };
  var NS = 'http://www.w3.org/2000/svg';
  var NE = 3;
  function ensureGuide() {
    if (G.el) return G.el;
    if (typeof homeThemeInjectStyle === 'function') { homeThemeInjectStyle('nb-guide', GUIDE_CSS); homeThemeInjectStyle('nb-keys-page', KEYS_CSS); }
    var el = document.createElement('div');
    el.id = 'nb-guide';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '使用引导');
    var rows = GUIDE.map(function (s, i) {
      var ech = ''; for (var k = 1; k <= NE; k++) ech += '<span class="nbg-echo e' + k + '" style="--e:' + k + '" aria-hidden="true">' + s.w + '</span>';
      return '<div class="nbg-row" data-i="' + i + '" role="button" tabindex="-1" aria-label="第 ' + (i + 1) + ' 步：' + s.w + '"><span class="nbg-idx">' + String(i + 1).padStart(2, '0') + '</span><div class="nbg-wd"><span class="nbg-face">' + s.w + '</span>' + ech + '</div><span class="nbg-en">' + s.en + '</span></div>';
    }).join('');
    el.innerHTML =
      '<svg class="nbg-sv" aria-hidden="true"><path class="nbg-veil"/><path class="nbg-hz"/>' +
      '<g class="nbg-tgt off"><path class="nbg-lead"/><circle class="nbg-leaddot" r="2.5"/><rect class="nbg-frame" rx="10"/><path class="nbg-corner"/></g>' +
      '<circle class="nbg-ripple"/><circle class="nbg-ring"/><circle class="nbg-in"/><g class="nbg-ticks"></g><circle class="nbg-arc"/><circle class="nbg-dot" r="4"/></svg>' +
      '<div class="nbg-brand">Not Blind<small>使用引导</small></div>' +
      '<div class="nbg-col">' + rows + '</div>' +
      '<button type="button" class="nbg-next" aria-label="下一步"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>' +
      '<div class="nbg-count"></div>' +
      '<div class="nbg-txt"><div class="nbg-kick"><i></i><span></span></div><div class="nbg-title"></div><div class="nbg-body"></div>' +
      '<div class="nbg-ctl"><button type="button" class="prev">← 上一步</button><i class="sep"></i><button type="button" class="pri nx">下一步 →</button><button type="button" class="skip">跳过引导</button></div></div>' +
      '<div class="nbg-hint">← → 翻页 · Esc 结束</div>';
    (document.getElementById('desktop-window-shell') || document.body).appendChild(el);
    G.el = el; G.sv = el.querySelector('svg');
    el.querySelector('.nbg-col').addEventListener('click', function (e) {
      var r = e.target.closest('.nbg-row'); if (!r) return;
      showVisualGuideStep(Number(r.getAttribute('data-i')));
    });
    el.querySelector('.nbg-next').addEventListener('click', function () { nextVisualGuideStep(); });
    el.querySelector('.nbg-ctl .nx').addEventListener('click', function () { nextVisualGuideStep(); });
    el.querySelector('.nbg-ctl .prev').addEventListener('click', function () { if (G.i > 0) showVisualGuideStep(G.i - 1); });
    el.querySelector('.nbg-ctl .skip').addEventListener('click', function () { closeVisualGuide(true); });
    // 引导盖着的时候，其它地方的右键菜单 / 点击都不要漏下去
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return el;
  }
  function svg(sel) { return G.sv.querySelector(sel); }
  function setA(node, attrs) { for (var k in attrs) node.setAttribute(k, attrs[k]); }

  function geom() {
    var W = innerWidth, H = innerHeight;
    var R = Math.round(Math.max(64, Math.min(H * 0.125, W * 0.085)));
    return { W: W, H: H, R: R, cx: Math.round(W * 0.70), slope: -0.03 };
  }
  function hzY(g, x, cy) { return cy + (x - g.cx) * g.slope; }

  function stepRect(step) {
    if (!step || step.target === 'stage' || step.keys) return null;
    var r = null;
    try { r = guideTargetRect(step); } catch (_e) { r = null; }
    if (!r || !(r.width > 0) || !(r.height > 0)) return null;
    // guideTargetRect 找不到时会给一个屏幕正中的占位框 —— 当成没有目标
    if (Math.abs(r.width - 240) < 1 && Math.abs(r.height - 80) < 1 && Math.abs(r.left - (innerWidth / 2 - 120)) < 1) return null;
    var pad = step.selector === '#bottom-bar' ? 8 : 6;
    return { left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad, width: r.width + pad * 2, height: r.height + pad * 2 };
  }
  function hit(a, b) { return a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }

  function layout() {
    if (!G.el || !visualGuideActive) return;
    var g = geom(), W = g.W, H = g.H, R = g.R, step = GUIDE[G.i], el = G.el;
    var tr = stepRect(step);
    // 左列大字
    var col = el.querySelector('.nbg-col');
    var rh = Math.max(40, Math.min(68, Math.floor((H - 118 - 120) / GUIDE.length)));
    col.style.setProperty('--rh', rh + 'px');
    col.style.setProperty('--fs', Math.round(rh * 0.7) + 'px');
    var colBox = { left: 80, top: 110, right: 96 + 44 + rh * 0.7 * 2.2 + 90, bottom: 118 + rh * GUIDE.length };
    col.classList.toggle('dim', !!(tr && hit(tr, colBox)));
    // 说明块：先按默认位置排，量高度，放不下就把圆（和地平线）往上挪
    var txt = el.querySelector('.nbg-txt');
    var left = g.cx - R;
    var maxW = Math.min(step.keys ? 540 : 470, W - left - 36);
    if (maxW < 360) { left = Math.max(36, W - 36 - 360); maxW = W - 36 - left; }
    txt.style.left = left + 'px';
    txt.style.width = maxW + 'px';
    var cheat = txt.querySelector('.nbg-cheat');
    if (cheat) cheat.classList.toggle('one', maxW < 400);
    var th = txt.offsetHeight || 200;
    var cy = Math.round(H * 0.46);
    var bottomLimit = H - 30;
    if (tr && tr.top > H * 0.55) bottomLimit = Math.min(bottomLimit, tr.top - 22);
    var needCy = bottomLimit - th - 30 - R;
    cy = Math.max(R + 70, Math.min(cy, needCy));
    // 目标在右上（小岛、视觉、设置）且圆太高会撞上：往下让
    if (tr && tr.top < H * 0.3 && tr.right > g.cx - R - 20 && cy - R < tr.bottom + 30) cy = Math.min(Math.round(H * 0.46), tr.bottom + 30 + R);
    txt.style.top = (cy + R + 30) + 'px';
    // 遮罩（目标处挖洞）
    var veil = 'M0 0H' + W + 'V' + H + 'H0Z';
    if (tr) {
      var rr = Math.min(12, tr.height / 2, tr.width / 2), x0 = tr.left, y0 = tr.top, x1 = tr.right, y1 = tr.bottom;
      veil += 'M' + (x0 + rr) + ' ' + y0 + 'H' + (x1 - rr) + 'Q' + x1 + ' ' + y0 + ' ' + x1 + ' ' + (y0 + rr) + 'V' + (y1 - rr) + 'Q' + x1 + ' ' + y1 + ' ' + (x1 - rr) + ' ' + y1 +
        'H' + (x0 + rr) + 'Q' + x0 + ' ' + y1 + ' ' + x0 + ' ' + (y1 - rr) + 'V' + (y0 + rr) + 'Q' + x0 + ' ' + y0 + ' ' + (x0 + rr) + ' ' + y0 + 'Z';
    }
    svg('.nbg-veil').setAttribute('d', veil);
    // 地平线：从左到右，穿过圆心（圆里那一段不画）
    var yl = hzY(g, 0, cy), yr = hzY(g, W, cy);
    var hx0 = g.cx - R, hx1 = g.cx + R;
    svg('.nbg-hz').setAttribute('d', 'M0 ' + yl.toFixed(1) + 'L' + hx0 + ' ' + hzY(g, hx0, cy).toFixed(1) + 'M' + hx1 + ' ' + hzY(g, hx1, cy).toFixed(1) + 'L' + W + ' ' + yr.toFixed(1));
    setA(svg('.nbg-ring'), { cx: g.cx, cy: cy, r: R });
    setA(svg('.nbg-in'), { cx: g.cx, cy: cy, r: Math.round(R * 0.34) });
    var rip = svg('.nbg-ripple'); setA(rip, { cx: g.cx, cy: cy, r: R }); rip.style.transformOrigin = g.cx + 'px ' + cy + 'px';
    // 进度弧（从 12 点顺时针）+ 每一步一个刻度
    var n = GUIDE.length, C = 2 * Math.PI * (R + 9);
    var arc = svg('.nbg-arc');
    setA(arc, { cx: g.cx, cy: cy, r: R + 9, transform: 'rotate(-90 ' + g.cx + ' ' + cy + ')' });
    arc.style.strokeDasharray = C.toFixed(1) + ' ' + C.toFixed(1);
    arc.style.strokeDashoffset = (C * (1 - (G.i + 1) / n)).toFixed(1);
    var ang = -Math.PI / 2 + 2 * Math.PI * (G.i + 1) / n;
    setA(svg('.nbg-dot'), { cx: (g.cx + Math.cos(ang) * (R + 9)).toFixed(1), cy: (cy + Math.sin(ang) * (R + 9)).toFixed(1) });
    var ticks = '';
    for (var k = 0; k < n; k++) {
      var a = -Math.PI / 2 + 2 * Math.PI * (k + 1) / n, c = Math.cos(a), s = Math.sin(a);
      ticks += '<line class="nbg-tick' + (k <= G.i ? ' done' : '') + '" x1="' + (g.cx + c * (R + 4)).toFixed(1) + '" y1="' + (cy + s * (R + 4)).toFixed(1) + '" x2="' + (g.cx + c * (R + 14)).toFixed(1) + '" y2="' + (cy + s * (R + 14)).toFixed(1) + '"/>';
    }
    svg('.nbg-ticks').innerHTML = ticks.replace(/<line/g, '<line xmlns="' + NS + '"');
    var nx = el.querySelector('.nbg-next'); nx.style.left = g.cx + 'px'; nx.style.top = cy + 'px';
    var cnt = el.querySelector('.nbg-count'); cnt.style.left = g.cx + 'px'; cnt.style.top = (cy - R - 38) + 'px';
    cnt.textContent = String(G.i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
    // 目标框 + 从圆引过去的细线
    var tg = svg('.nbg-tgt');
    if (tr) {
      setA(svg('.nbg-frame'), { x: tr.left, y: tr.top, width: tr.width, height: tr.height });
      var L = Math.min(12, tr.width / 3, tr.height / 3), x0c = tr.left, y0c = tr.top, x1c = tr.right, y1c = tr.bottom;
      svg('.nbg-corner').setAttribute('d', 'M' + x0c + ' ' + (y0c + L) + 'V' + y0c + 'H' + (x0c + L) + 'M' + (x1c - L) + ' ' + y0c + 'H' + x1c + 'V' + (y0c + L) +
        'M' + x1c + ' ' + (y1c - L) + 'V' + y1c + 'H' + (x1c - L) + 'M' + (x0c + L) + ' ' + y1c + 'H' + x0c + 'V' + (y1c - L));
      var tx = Math.max(tr.left, Math.min(g.cx, tr.right)), ty = Math.max(tr.top, Math.min(cy, tr.bottom));
      var dx = tx - g.cx, dy = ty - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var sx = g.cx + dx / d * (R + 16), sy = cy + dy / d * (R + 16);
      var lead = svg('.nbg-lead');
      if (d > R + 40) {
        // 折一下：先沿圆的方向走一段，再横 / 竖着接到目标
        var mx = Math.abs(dx) > Math.abs(dy) ? sx : tx, my = Math.abs(dx) > Math.abs(dy) ? ty : sy;
        lead.setAttribute('d', 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + 'L' + mx.toFixed(1) + ' ' + my.toFixed(1) + 'L' + tx.toFixed(1) + ' ' + ty.toFixed(1));
        lead.style.opacity = '';
      } else lead.style.opacity = '0';
      setA(svg('.nbg-leaddot'), { cx: tx.toFixed(1), cy: ty.toFixed(1) });
      tg.classList.remove('off');
    } else tg.classList.add('off');
  }
  function scheduleLayout() {
    layout();
    requestAnimationFrame(layout);
    setTimeout(layout, 200);
    setTimeout(layout, 650);   // 歌单栏、播放条滑出来要一会儿
  }

  function renderText() {
    var step = GUIDE[G.i], el = G.el, n = GUIDE.length;
    el.querySelector('.nbg-kick span').textContent = String(G.i + 1).padStart(2, '0') + ' / ' + step.en;
    el.querySelector('.nbg-title').textContent = step.title;
    var body = el.querySelector('.nbg-body');
    if (step.keys) {
      body.innerHTML = '<div class="nbg-cheat">' + CHEAT.map(function (c, i) {
        var ks = cheatKeys(i).map(function (grp) { return grp.map(function (p) { return '<kbd>' + esc(p) + '</kbd>'; }).join('<i>+</i>'); }).join('<i>/</i>');
        return '<div class="nbg-ck"><span class="ks">' + ks + '</span><span>' + esc(c.l) + '</span></div>';
      }).join('') + '</div><div class="nbg-more">全部快捷键、改键：<b>设置 › 快捷键</b></div>';
    } else body.textContent = step.body;
    el.querySelector('.nbg-ctl .prev').disabled = G.i === 0;
    el.querySelector('.nbg-ctl .nx').textContent = G.i === n - 1 ? '开始用 →' : '下一步 →';
    el.querySelector('.nbg-ctl .skip').style.display = G.i === n - 1 ? 'none' : '';
    el.querySelector('.nbg-next').setAttribute('aria-label', G.i === n - 1 ? '完成引导' : '下一步');
    Array.prototype.forEach.call(el.querySelectorAll('.nbg-row'), function (r, i) {
      r.classList.toggle('on', i === G.i); r.classList.toggle('past', i < G.i);
    });
  }

  // ---------- 接管原引导的几个函数（名字不变，别处照常调用） ----------
  if (typeof visualGuideSteps !== 'undefined') {
    visualGuideSteps = GUIDE.map(function (s) { return { target: s.target, selector: s.selector, kicker: s.en, title: s.title, body: s.body }; });
  }
  showVisualGuideStep = function (index) {
    ensureGuide();
    var n = GUIDE.length;
    var prevI = G.i;
    G.i = Math.max(0, Math.min(n - 1, index | 0));
    try { visualGuideStep = G.i; } catch (_e) { }
    var step = GUIDE[G.i];
    document.body.classList.toggle('nbg-show-bar', step.selector === '#bottom-bar');
    document.body.classList.toggle('nbg-show-search', step.selector === '#search-box');
    try { prepareVisualGuideStep(step.keys || step.target === 'stage' ? {} : step); } catch (_e) { }
    var txt = G.el.querySelector('.nbg-txt');
    if (G.el._shown && prevI !== G.i) {
      txt.classList.add('swap');
      setTimeout(function () { renderText(); txt.classList.remove('swap'); scheduleLayout(); }, 180);
      var rip = svg('.nbg-ripple'); rip.classList.remove('go'); void rip.getBoundingClientRect(); rip.classList.add('go');
    } else { renderText(); }
    G.el._shown = true;
    scheduleLayout();
  };
  positionVisualGuideStep = function () { layout(); };
  nextVisualGuideStep = function () {
    if (G.i >= GUIDE.length - 1) { closeVisualGuide(true); return; }
    showVisualGuideStep(G.i + 1);
  };
  if (typeof closeVisualGuide === 'function') {
    var origClose = closeVisualGuide;
    closeVisualGuide = function (markSeen) {
      var r = origClose.apply(this, arguments);
      if (G.el) { G.el._shown = false; G.el.classList.remove('in'); }
      document.body.classList.remove('nbg-show-bar', 'nbg-show-search');
      return r;
    };
  }
  if (typeof startVisualGuide === 'function') {
    var origStart = startVisualGuide;
    startVisualGuide = function (opts) {
      ensureGuide();
      G.i = 0; G.el._shown = false;
      G.el.classList.remove('in'); void G.el.offsetWidth; G.el.classList.add('in');
      return origStart.apply(this, arguments);
    };
  }
  // 引导开着时：← → / 回车 / 空格翻页，Esc 结束；别的键不漏给播放器
  window.addEventListener('keydown', function (e) {
    if (typeof visualGuideActive === 'undefined' || !visualGuideActive || !G.el) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'Enter' || k === ' ' || k === 'PageDown') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) nextVisualGuideStep(); return; }
    if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); e.stopImmediatePropagation(); if (G.i > 0) showVisualGuideStep(G.i - 1); return; }
    if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeVisualGuide(true); return; }
    if (k === 'Tab') return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey) { e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('resize', function () { if (typeof visualGuideActive !== 'undefined' && visualGuideActive) scheduleLayout(); });

  // 样式早点装上（设置页也要用）
  function boot() { if (typeof homeThemeInjectStyle === 'function') { homeThemeInjectStyle('nb-guide', GUIDE_CSS); homeThemeInjectStyle('nb-keys-page', KEYS_CSS); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
