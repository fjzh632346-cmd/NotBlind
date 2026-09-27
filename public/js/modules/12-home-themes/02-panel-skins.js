// ============================================================
// Home themes · 左侧歌单栏随主题换样子（换肤 + 装饰层）
// - body[data-home-theme]：当前选中的主页主题（主页和播放页都有）
// - body[data-panel-skin]：当前主题注册了歌单栏皮肤时才有，皮肤 CSS 全部挂在它下面
// - body[data-hth-page]：home（主页主题正在显示）/ stage（播放页等其它画面）
// - 皮肤只改外观和加装饰，原来的点击、拖动排序、虚拟列表逻辑都不动
// - 鼠标贴边滑出时先显示「当前队列」（钉住、或从别处指定要看歌单时不改）
// ============================================================

var panelSkinRegistry = Object.create(null);
var panelSkinState = { active: '', observer: null, pending: false, saved: null, bound: false };

// def: {
//   id: 主题 id（和 registerHomeTheme 的 id 一样）
//   css: 字符串，选择器都以 body[data-panel-skin="<id>"] 开头
//   virtual: { queueRowStep, fullPlaylistRender }（可选；列表每行高度变了要告诉虚拟列表）
//   attach(panel), detach(panel)：切到 / 切走这个皮肤时调用（可选）
//   decorate(kind, container, panel)：列表重新渲染后调用，kind = 'queue' | 'playlists' | 'podcasts' | 'head'
//     给元素加装饰时要幂等（同一个元素被调用多次不能重复加）
//   tick()：每秒一次（可选，例如跟着时间换光线）
// }
function registerPanelSkin(def) {
  if (!def || !def.id) return;
  panelSkinRegistry[def.id] = def;
  if (def.css) homeThemeInjectStyle('panel-skin-' + def.id, def.css);
  if (homeThemeHost && homeThemeHost.booted) applyPanelSkin();
}

function panelSkinHour() {
  if (typeof window.__hthForcedHour === 'number') return window.__hthForcedHour;
  var d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

// 按 id / key 取稳定的哈希（同一首歌每次一样）。取位用 >>>，不要用 >>（会得到负数）
function panelSkinHash(str) {
  var h = 2166136261 >>> 0;
  str = String(str || '');
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function panelSkinPanel() { return document.getElementById('playlist-panel'); }

function panelSkinDecorateAll(kinds) {
  var def = panelSkinRegistry[panelSkinState.active];
  if (!def || typeof def.decorate !== 'function') return;
  var panel = panelSkinPanel();
  var map = { queue: 'queue-list', playlists: 'pl-list', podcasts: 'podcast-list' };
  (kinds || ['head', 'queue', 'playlists', 'podcasts']).forEach(function (kind) {
    var el = kind === 'head' ? (panel && panel.querySelector('.playlist-panel-sticky')) : document.getElementById(map[kind]);
    if (!el) return;
    try { def.decorate(kind, el, panel); } catch (e) { console.warn('[PanelSkin] decorate ' + kind, e); }
  });
}

function panelSkinScheduleDecorate() {
  if (panelSkinState.pending) return;
  panelSkinState.pending = true;
  // 在同一帧里、浏览器画出来之前补装饰，避免闪一下原样
  Promise.resolve().then(function () {
    panelSkinState.pending = false;
    panelSkinDecorateAll();
  });
}

function panelSkinApplyVirtual(def) {
  // 先还原上一个皮肤改过的虚拟列表参数
  if (panelSkinState.saved) {
    try {
      QUEUE_VIRTUAL_ROW_STEP = panelSkinState.saved.queueStep;
      PLAYLIST_CARD_VIRTUAL_OVERSCAN_PX = panelSkinState.saved.overscan;
    } catch (_e) { }
    panelSkinState.saved = null;
  }
  var v = def && def.virtual;
  if (!v) return;
  try {
    panelSkinState.saved = { queueStep: QUEUE_VIRTUAL_ROW_STEP, overscan: PLAYLIST_CARD_VIRTUAL_OVERSCAN_PX };
    if (v.queueRowStep) QUEUE_VIRTUAL_ROW_STEP = v.queueRowStep;
    // 歌单排成书架 / 网格时，按行高算的虚拟窗口不准，干脆全部画出来（歌单一般几十个，不费事）
    if (v.fullPlaylistRender) PLAYLIST_CARD_VIRTUAL_OVERSCAN_PX = 1e6;
  } catch (_e) { }
}

function panelSkinRerender() {
  try { if (typeof renderQueuePanel === 'function') renderQueuePanel(); } catch (_e) { }
  try { if (typeof renderUserPlaylistsList === 'function') renderUserPlaylistsList({ preserveScroll: true }); } catch (_e) { }
  try { if (typeof renderMyPodcastCollections === 'function') renderMyPodcastCollections(); } catch (_e) { }
}

function applyPanelSkin() {
  var body = document.body;
  if (!body) return;
  var id = (homeThemeHost && homeThemeHost.current) || '';
  if (id === 'classic') id = '';
  if (id) body.setAttribute('data-home-theme', id); else body.removeAttribute('data-home-theme');
  body.setAttribute('data-hth-page', homeThemeHost && homeThemeHost.visible ? 'home' : 'stage');
  var want = id && panelSkinRegistry[id] ? id : '';
  if (want === panelSkinState.active) return;
  var panel = panelSkinPanel();
  var old = panelSkinRegistry[panelSkinState.active];
  if (old && typeof old.detach === 'function') { try { old.detach(panel); } catch (e) { console.warn('[PanelSkin] detach', e); } }
  panelSkinState.active = want;
  if (want) body.setAttribute('data-panel-skin', want); else body.removeAttribute('data-panel-skin');
  var def = panelSkinRegistry[want];
  panelSkinApplyVirtual(def);
  if (def && typeof def.attach === 'function') { try { def.attach(panel); } catch (e) { console.warn('[PanelSkin] attach', e); } }
  // 换皮肤后按新行高重画一遍列表，再补装饰
  panelSkinRerender();
  panelSkinDecorateAll();
}

(function bootPanelSkins() {
  function observeLists() {
    if (panelSkinState.observer) return;
    var panel = panelSkinPanel();
    if (!panel || typeof MutationObserver !== 'function') return;
    panelSkinState.observer = new MutationObserver(function (records) {
      if (!panelSkinState.active) return;
      // 只关心列表内容被整段重画（childList），自己加装饰引起的变化忽略掉
      for (var i = 0; i < records.length; i++) {
        var t = records[i].target;
        if (t && t.closest && t.closest('[data-skin-deco]')) continue;
        panelSkinScheduleDecorate();
        return;
      }
    });
    panelSkinState.observer.observe(panel, { childList: true, subtree: true });
  }
  function bind() {
    if (panelSkinState.bound) return;
    panelSkinState.bound = true;
    // 主题切换、主页显示 / 隐藏都会走到这两个函数
    if (typeof syncHomeThemeVisibility === 'function') {
      var origSync = syncHomeThemeVisibility;
      syncHomeThemeVisibility = function () {
        var r = origSync.apply(this, arguments);
        try { applyPanelSkin(); } catch (e) { console.warn('[PanelSkin]', e); }
        return r;
      };
    }
    // 鼠标贴边滑出：先显示当前队列。钉住、或者从别处指定要看某一页（preserveTabOnOpen）时不改
    if (typeof preparePlaylistPanelTabOnOpen === 'function') {
      var origPrepare = preparePlaylistPanelTabOnOpen;
      preparePlaylistPanelTabOnOpen = function (panel) {
        try {
          var preserve = !!(panel && panel.dataset && panel.dataset.preserveTabOnOpen === '1');
          if (!preserve && !playlistPanelPinned && playQueue.length && queueViewTab !== 'queue') {
            switchPlaylistTab('queue', { save: false, animate: false, refresh: false });
          }
        } catch (_e) { }
        return origPrepare.apply(this, arguments);
      };
    }
    // 底部播放条的迷你队列也用同一个虚拟列表步长，但它的行高没换肤；画它的时候临时换回原来的步长
    if (typeof renderMiniQueuePanel === 'function') {
      var origMini = renderMiniQueuePanel;
      renderMiniQueuePanel = function () {
        var saved = panelSkinState.saved;
        if (!saved) return origMini.apply(this, arguments);
        var skinStep = QUEUE_VIRTUAL_ROW_STEP;
        QUEUE_VIRTUAL_ROW_STEP = saved.queueStep;
        try { return origMini.apply(this, arguments); } finally { QUEUE_VIRTUAL_ROW_STEP = skinStep; }
      };
    }
    observeLists();
    setInterval(function () {
      if (document.hidden) return;
      var def = panelSkinRegistry[panelSkinState.active];
      if (def && typeof def.tick === 'function') { try { def.tick(panelSkinPanel()); } catch (_e) { } }
    }, 1000);
    applyPanelSkin();
  }
  // 主题宿主在 DOMContentLoaded 后 setTimeout(0) 启动，这里排在它后面
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(bind, 0); });
  else setTimeout(bind, 0);
})();
