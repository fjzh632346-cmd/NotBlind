// ============================================================
// Home themes · 就地展开曲目 + 通用列表抽屉
// [二改 2026-09-28] 反馈：主页"发现 / 音乐库"里点「曲目」，打开的却是左边的歌单面板。
// 现在点「曲目」就在这一条下面展开它的歌（再点一次收起），点其中一首就从这首开始播整张。
// - homeThemePeekController：给主题自己的列表用（回声的抽屉、北斗天穹的推近页）
// - homeThemeListSheet：午后窗影、孔版海报没有自己的列表，用这个抽屉列出 音乐库 / 发现 / 电台
// 数据和播放都走 homeThemeActions，主题不直接碰平台接口。
// ============================================================

var HOME_THEME_PEEK_LIMIT = 100;
var homeThemePeekCache = Object.create(null);

function homeThemePeekKey(item) {
  return item ? String(item.key || ((item.provider || '') + ':' + (item.id || ''))) : '';
}

// 读一张歌单 / 榜单的前一页曲目（5 分钟内复用）
function homeThemePeekTracks(item) {
  var key = homeThemePeekKey(item);
  if (!key) return Promise.reject(new Error('NO_ITEM'));
  var hit = homeThemePeekCache[key];
  if (hit && hit.done && Date.now() - hit.at < 5 * 60 * 1000) return Promise.resolve(hit);
  if (hit && hit.promise) return hit.promise;
  var entry = { at: Date.now(), done: false, raw: [], tracks: [], total: 0, hasMore: false, nextOffset: 0, playlist: null };
  if (Array.isArray(item.songs) && item.songs.length) {
    entry.raw = item.songs.slice();
    entry.total = entry.raw.length;
    entry.nextOffset = entry.raw.length;
    entry.tracks = entry.raw.map(homeThemeTrack).filter(Boolean);
    entry.done = true;
    homeThemePeekCache[key] = entry;
    return Promise.resolve(entry);
  }
  if (!item.id || typeof fetchPlaylistTracksPage !== 'function') return Promise.reject(new Error('NO_PLAYLIST'));
  entry.promise = Promise.resolve(fetchPlaylistTracksPage(item.provider, item.id, { offset: 0, limit: HOME_THEME_PEEK_LIMIT }, { timeoutMs: 16000 }))
    .then(function (r) {
      var raw = (r && r.tracks) || [];
      entry.raw = raw;
      entry.tracks = raw.map(homeThemeTrack).filter(Boolean);
      entry.total = Math.max(raw.length, Number(r && (r.total || (r.playlist && r.playlist.trackCount))) || Number(item.count) || 0);
      entry.nextOffset = Math.max(Number(r && r.nextOffset) || 0, raw.length);
      entry.hasMore = !!(r && r.hasMore) || entry.total > raw.length;
      entry.playlist = r && r.playlist || null;
      entry.error = raw.length ? '' : String(r && (r.message || r.error) || '');
      entry.done = true;
      entry.at = Date.now();
      delete entry.promise;
      return entry;
    }, function (e) {
      delete homeThemePeekCache[key];
      throw e;
    });
  homeThemePeekCache[key] = entry;
  return entry.promise;
}

// 从展开列表里的第 index 首开始播放整张（后面的歌照常按页接上）
function homeThemePlayPeek(item, index) {
  var entry = homeThemePeekCache[homeThemePeekKey(item)];
  index = Math.max(0, Number(index) || 0);
  if (!entry || !entry.done || !entry.raw.length) return homeThemeActions.playPlaylist(item);
  if (Array.isArray(item.songs) && item.songs.length) return homeThemePlayList(entry.raw, index, item.title || '');
  var id = typeof playlistPanelProviderId === 'function' ? playlistPanelProviderId(item.provider, item.id) : item.id;
  homeThemeLeaveHome();
  return Promise.resolve(loadPlaylistIntoQueueById(id, true, item.title || '', {
    seedTracks: entry.raw,
    startIndex: Math.min(index, entry.raw.length - 1),
    total: entry.total,
    nextOffset: entry.nextOffset,
    hasMore: entry.hasMore,
    playlist: entry.playlist,
  })).catch(function (e) { console.warn('[HomeTheme] play peek', e); });
}

if (typeof homeThemeActions === 'object' && homeThemeActions) {
  homeThemeActions.peekPlaylist = homeThemePeekTracks;
  homeThemeActions.playPlaylistFrom = homeThemePlayPeek;
}

function homeThemePeekEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
function homeThemePeekFmt(sec) {
  sec = Math.max(0, Math.round(Number(sec) || 0));
  if (!sec) return '';
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

var HOME_THEME_PEEK_CSS = [
  '.hp-peek{list-style:none;display:block!important;cursor:default!important;padding:2px 0 12px!important;margin:0!important;border-bottom:1px solid var(--hp-line,rgba(128,128,128,.18));background:none!important;animation:hpPeekIn .26s ease both}',
  '@keyframes hpPeekIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}',
  '.hp-peek-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0 8px 14px;font-size:11px;letter-spacing:.06em;color:var(--hp-dim,rgba(128,128,128,.9))}',
  '.hp-peek-hd button{font:inherit;letter-spacing:inherit;color:var(--hp-ink,inherit)!important;background:none;border:1px solid var(--hp-line,rgba(128,128,128,.3));border-radius:999px;padding:3px 11px;cursor:pointer;white-space:nowrap;transition:border-color .2s,color .2s}',
  '.hp-peek-hd button:hover{border-color:var(--hp-hot,currentColor);color:var(--hp-hot,inherit)}',
  '.hp-peek-rows{max-height:min(46vh,440px);overflow-y:auto;overscroll-behavior:contain;margin-left:14px;padding-left:10px;border-left:1px solid var(--hp-line,rgba(128,128,128,.25));scrollbar-width:thin;scrollbar-color:var(--hp-line,rgba(128,128,128,.3)) transparent}',
  '.hp-peek-row{display:grid;grid-template-columns:24px minmax(0,1fr) auto;column-gap:10px;align-items:center;width:100%;box-sizing:border-box;padding:8px 6px;margin:0;border:0;border-radius:4px;background:none;text-align:left;font:inherit;color:var(--hp-ink,inherit)!important;cursor:pointer;transition:background .15s;mix-blend-mode:normal}',
  '.hp-peek-row:hover,.hp-peek-row:focus-visible{background:var(--hp-hover,rgba(128,128,128,.12));outline:none}',
  '.hp-peek-n{font-size:10px;opacity:.55;font-variant-numeric:tabular-nums}',
  '.hp-peek-m{min-width:0;display:flex;flex-direction:column;gap:4px;line-height:1.25}',
  '.hp-peek-t{font-size:13px;color:var(--hp-ink,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .15s}',
  '.hp-peek-a{font-size:11px;color:var(--hp-dim,rgba(128,128,128,.9));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.hp-peek-d{font-size:10px;color:var(--hp-dim,rgba(128,128,128,.9));font-variant-numeric:tabular-nums}',
  '.hp-peek-row:hover .hp-peek-t{color:var(--hp-hot,inherit)}',
  '.hp-peek-msg{padding:10px 0 4px 14px;font-size:12px;color:var(--hp-dim,rgba(128,128,128,.9))}',
  '.hp-peek-more{padding:8px 0 0 24px;font-size:11px;color:var(--hp-dim,rgba(128,128,128,.9))}',
  '.hp-open{border-color:var(--hp-hot,currentColor)!important;color:var(--hp-hot,inherit)!important;opacity:1!important}',
].join('\n');

function homeThemeEnsurePeekStyle() {
  if (document.getElementById('hp-peek-style')) return;
  var st = document.createElement('style');
  st.id = 'hp-peek-style';
  st.textContent = HOME_THEME_PEEK_CSS + '\n' + HOME_THEME_SHEET_CSS;
  document.head.appendChild(st);
}

function homeThemePeekBodyHtml(entry, item) {
  var tracks = entry.tracks || [];
  if (!tracks.length) {
    return '<div class="hp-peek-msg">' + homeThemePeekEsc(entry.error || '这张歌单暂时没有可播放的歌') + '</div>';
  }
  var total = Math.max(entry.total || 0, tracks.length);
  var hd = '<div class="hp-peek-hd"><span>' + (total > tracks.length ? '前 ' + tracks.length + ' 首 · 共 ' + total + ' 首' : '共 ' + tracks.length + ' 首') + ' · 点一首从那里开始播</span>' +
    '<button type="button" data-peek-all="1">播放全部</button></div>';
  var rows = tracks.map(function (t, j) {
    return '<button type="button" class="hp-peek-row" data-peek-i="' + j + '" title="从这首开始播放">' +
      '<span class="hp-peek-n">' + String(j + 1).padStart(2, '0') + '</span>' +
      '<span class="hp-peek-m"><span class="hp-peek-t">' + homeThemePeekEsc(t.title) + '</span><span class="hp-peek-a">' + homeThemePeekEsc(t.artist) + '</span></span>' +
      '<span class="hp-peek-d">' + homeThemePeekFmt(t.duration) + '</span></button>';
  }).join('');
  var more = total > tracks.length ? '<div class="hp-peek-more">其余 ' + (total - tracks.length) + ' 首，播放时会自动接在后面</div>' : '';
  return hd + '<div class="hp-peek-rows">' + rows + '</div>' + more;
}

// 给一个列表（ol / ul）加上"就地展开曲目"：
//   opts.list        列表元素，或返回列表元素的函数（重绘后调 restore() 就能恢复展开）
//   opts.itemOf(li)  返回这一行对应的歌单 item（没有就返回 null）
//   opts.rowSel      行选择器，默认 'li[data-i]'
//   opts.btnOf(li)   返回这一行的「曲目」按钮（用来标记展开状态，可选）
//   opts.label       按钮原文，用于展开时改成"收起"
function homeThemePeekController(opts) {
  homeThemeEnsurePeekStyle();
  var rowSel = opts.rowSel || 'li[data-i]';
  var openKey = '', openItem = null, peekEl = null, token = 0;
  // 列表元素可以是固定的，也可以每次重绘都换新的（传一个取元素的函数）
  function L() { return typeof opts.list === 'function' ? opts.list() : opts.list; }

  function findRow(key) {
    var list = L(); if (!list) return null;
    var rows = list.querySelectorAll(rowSel);
    for (var i = 0; i < rows.length; i++) {
      var it = opts.itemOf(rows[i]);
      if (it && homeThemePeekKey(it) === key) return rows[i];
    }
    return null;
  }
  function markBtn(row, on) {
    var b = row && opts.btnOf ? opts.btnOf(row) : null;
    if (!b) return;
    b.classList.toggle('hp-open', !!on);
    if (opts.label) b.textContent = on ? '收起' : opts.label;
    b.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  function detach() {
    if (peekEl && peekEl.parentNode) peekEl.parentNode.removeChild(peekEl);
    peekEl = null;
  }
  function close() {
    if (!openKey) return false;
    var row = findRow(openKey);
    markBtn(row, false);
    detach();
    openKey = ''; openItem = null; token++;
    return true;
  }
  function build(row, item) {
    detach();
    peekEl = document.createElement('li');
    peekEl.className = 'hp-peek';
    peekEl.setAttribute('data-peek-for', homeThemePeekKey(item));
    peekEl.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var all = ev.target.closest('[data-peek-all]');
      if (all) { homeThemePlayPeek(item, 0); if (opts.onPlay) opts.onPlay(); return; }
      var r = ev.target.closest('[data-peek-i]');
      if (r) { homeThemePlayPeek(item, Number(r.getAttribute('data-peek-i')) || 0); if (opts.onPlay) opts.onPlay(); }
    });
    // 展开区里的滚动 / 指针事件不要让主题当成"点到外面"或拖拽
    ['pointerdown', 'pointerover', 'pointerout', 'wheel'].forEach(function (t) { peekEl.addEventListener(t, function (ev) { ev.stopPropagation(); }, { passive: true }); });
    row.parentNode.insertBefore(peekEl, row.nextSibling);
    markBtn(row, true);
    var entry = homeThemePeekCache[homeThemePeekKey(item)];
    if (entry && entry.done) { peekEl.innerHTML = homeThemePeekBodyHtml(entry, item); return; }
    peekEl.innerHTML = '<div class="hp-peek-msg">正在读取曲目…</div>';
    var my = ++token;
    homeThemePeekTracks(item).then(function (e) {
      if (my !== token || !peekEl) return;
      peekEl.innerHTML = homeThemePeekBodyHtml(e, item);
    }, function (err) {
      if (my !== token || !peekEl) return;
      console.warn('[HomeTheme] peek', err);
      peekEl.innerHTML = '<div class="hp-peek-msg">曲目读取失败，稍后再点一次试试</div>';
    });
  }
  function toggle(row) {
    var item = row ? opts.itemOf(row) : null;
    if (!item) return;
    var key = homeThemePeekKey(item);
    if (openKey === key) { close(); return; }
    close();
    openKey = key; openItem = item;
    build(row, item);
    try { if (peekEl && peekEl.scrollIntoView) peekEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_e) { }
  }
  // 列表重绘之后调用：把展开的那一条接回去
  function restore() {
    if (!openKey) return;
    var list = L();
    if (peekEl && peekEl.isConnected && list && list.contains(peekEl)) return;
    var row = findRow(openKey);
    // 列表可能只是暂时变空（刷新数据的一瞬间）：记住展开的是哪一条，等它回来再接上
    if (!row) { peekEl = null; token++; return; }
    build(row, opts.itemOf(row) || openItem);
  }
  return { toggle: toggle, close: close, restore: restore, isOpen: function () { return !!openKey; } };
}

// ---------- 通用列表抽屉（午后窗影 / 孔版海报） ----------
var HOME_THEME_SHEET_CSS = [
  '.hp-sheet{position:absolute;top:0;right:0;bottom:0;width:min(440px,42vw);min-width:320px;z-index:40;box-sizing:border-box;display:flex;flex-direction:column;padding:96px 30px 28px;transform:translateX(104%);visibility:hidden;transition:transform .5s cubic-bezier(.2,.8,.2,1),visibility 0s .5s;pointer-events:auto;user-select:none;-webkit-user-select:none}',
  '.hp-sheet.on{transform:none;visibility:visible;transition:transform .5s cubic-bezier(.2,.8,.2,1)}',
  '.hp-sheet-idx{font-size:11px;letter-spacing:.14em;color:var(--hp-dim)}',
  '.hp-sheet h2{margin:10px 0 6px;font-size:40px;line-height:1.05;font-weight:900;letter-spacing:.04em;color:var(--hp-ink)}',
  '.hp-sheet-meta{font-size:12px;line-height:1.6;color:var(--hp-dim);padding-right:70px}',
  '.hp-sheet-x{position:absolute;top:96px;right:30px;font-size:11px;letter-spacing:.08em;color:var(--hp-dim)!important;background:none;border:1px solid var(--hp-line);border-radius:4px;padding:4px 8px;cursor:pointer}',
  '.hp-sheet-x:hover{color:var(--hp-ink);border-color:var(--hp-hot)}',
  '.hp-sheet ol{list-style:none;margin:20px 0 0;padding:0 6px 0 0;overflow-y:auto;flex:1;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--hp-line) transparent}',
  '.hp-sheet li.hp-row{display:grid;grid-template-columns:40px minmax(0,1fr) auto;column-gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--hp-line);cursor:pointer}',
  '.hp-sheet li.hp-row.nc{grid-template-columns:26px minmax(0,1fr) auto}',
  '.hp-sheet .hp-c{width:40px;height:40px;background-size:cover;background-position:center}',
  '.hp-sheet .hp-n{font-size:11px;color:var(--hp-dim);font-variant-numeric:tabular-nums}',
  '.hp-sheet .hp-m{min-width:0;display:flex;flex-direction:column;gap:2px}',
  '.hp-sheet .hp-t{font-size:14px;color:var(--hp-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .2s}',
  '.hp-sheet .hp-a{font-size:11px;color:var(--hp-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.hp-sheet li.hp-row:hover .hp-t{color:var(--hp-hot)}',
  '.hp-sheet .hp-v{font-size:11px;color:var(--hp-dim)!important;background:none;border:1px solid var(--hp-line);border-radius:999px;padding:2px 9px;cursor:pointer;opacity:0;transition:opacity .2s,color .2s,border-color .2s;white-space:nowrap}',
  '.hp-sheet li.hp-row:hover .hp-v,.hp-sheet .hp-v:focus-visible{opacity:1}',
  '.hp-sheet .hp-v:hover{color:var(--hp-ink);border-color:var(--hp-hot)}',
  '.hp-sheet-empty{margin-top:24px;font-size:13px;line-height:1.8;color:var(--hp-dim)}',
  '.hp-sheet-foot{margin-top:14px;display:flex;flex-wrap:wrap;gap:10px}',
  '.hp-sheet-foot button{font-size:12px;color:var(--hp-ink)!important;background:none;border:1px solid var(--hp-line);border-radius:999px;padding:6px 12px;cursor:pointer;transition:border-color .2s}',
  '.hp-sheet-foot button:hover{border-color:var(--hp-hot)}',
  // 午后窗影：钉在墙上的一张米色卡纸，宋体，赭红点缀
  '.hp-sheet--afternoon{--hp-ink:#2a221b;--hp-dim:rgba(42,34,27,.55);--hp-line:rgba(42,34,27,.16);--hp-hot:#9b3b25;--hp-hover:rgba(155,59,37,.07);background:#efe7d8;box-shadow:-24px 0 60px rgba(40,28,16,.28);border-left:1px solid rgba(42,34,27,.12);font-family:"SimSun","宋体","STSong","Noto Serif CJK SC",serif}',
  '.hp-sheet--afternoon h2{font-weight:400;letter-spacing:.3em;font-size:34px}',
  '.hp-sheet--afternoon .hp-c{border-radius:2px;box-shadow:2px 3px 6px rgba(40,28,16,.22)}',
  // 孔版海报：节目单纸面，蓝色油墨，粉色套印错位
  '.hp-sheet--riso{--hp-ink:#2a4c9c;--hp-dim:rgba(42,76,156,.62);--hp-line:rgba(42,76,156,.22);--hp-hot:#ff3d9a;--hp-hover:rgba(255,217,46,.35);background:#f1eadb;border-left:3px solid #2a4c9c;box-shadow:-6px 0 0 rgba(255,61,154,.55);font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif}',
  '.hp-sheet--riso h2{text-shadow:2px 1.5px 0 rgba(255,61,154,.55)}',
  '.hp-sheet--riso .hp-c{mix-blend-mode:multiply;filter:grayscale(.2) contrast(1.1)}',
  '.hp-sheet--riso .hp-sheet-x,.hp-sheet--riso .hp-v,.hp-sheet--riso .hp-sheet-foot button{border-width:1.5px;font-weight:700}',
].join('\n');

var HOME_THEME_SHEET_KINDS = {
  lib: { idx: '01', title: '音乐库' },
  find: { idx: '02', title: '发现' },
  radio: { idx: '03', title: '电台' },
};

// homeThemeListSheet(host, { variant, ctx }) → { open(kind), close(), isOpen(), destroy() }
function homeThemeListSheet(host, options) {
  homeThemeEnsurePeekStyle();
  options = options || {};
  var ctx = options.ctx || {};
  var A = ctx.actions || homeThemeActions;
  var el = document.createElement('aside');
  el.className = 'hp-sheet hp-sheet--' + (options.variant || 'plain');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="hp-sheet-idx"></div><h2></h2><div class="hp-sheet-meta"></div><button type="button" class="hp-sheet-x">关闭 Esc</button><ol></ol><div class="hp-sheet-foot"></div>';
  host.appendChild(el);
  var ol = el.querySelector('ol');
  var kind = '', items = [], sig = '', unsub = null;

  function model() { try { return (ctx.model ? ctx.model() : buildHomeThemeModel()); } catch (_e) { return null; } }
  function coverStyle(it) {
    var fb = 'linear-gradient(135deg,rgba(128,128,128,.35),rgba(128,128,128,.12))';
    return 'background-image:' + (it.cover ? 'url("' + String(it.cover).replace(/"/g, '%22') + '"),' : '') + fb;
  }
  function listOf(m, k) {
    if (!m) return [];
    if (k === 'lib') return (m.library && m.library.items) || [];
    if (k === 'find') return (m.discover && m.discover.items) || [];
    if (k === 'radio') return (m.radio && m.radio.items) || [];
    return [];
  }
  function render(force) {
    var m = model();
    var list = listOf(m, kind);
    var nextSig = kind + '|' + list.map(function (it) { return it.key + '|' + it.title + '|' + (it.sub || ''); }).join('\n');
    if (!force && nextSig === sig) return;
    sig = nextSig;
    items = list;
    var def = HOME_THEME_SHEET_KINDS[kind] || { idx: '', title: '' };
    el.querySelector('.hp-sheet-idx').textContent = def.idx + ' / 03';
    el.querySelector('h2').textContent = (kind === 'find' && m && m.discover && m.discover.label) || (kind === 'radio' && m && m.radio && m.radio.label) || def.title;
    var meta = kind === 'lib'
      ? ((m && m.library && m.library.label) || '') + (m && m.library ? ' · ' + (m.library.playlistCount || 0) + ' 张歌单' : '')
      : kind === 'find' ? (m && m.discover && m.discover.sub) || '' : (m && m.radio && m.radio.sub) || '';
    el.querySelector('.hp-sheet-meta').textContent = meta;
    var scroll = ol.scrollTop;
    var old = el.querySelector('.hp-sheet-empty'); if (old) old.remove();
    if (!list.length) {
      ol.innerHTML = '';
      var em = document.createElement('div'); em.className = 'hp-sheet-empty';
      em.textContent = m && m.login && m.login.any ? (homeThemeData.platformLoading ? '正在读取平台内容…' : '这里暂时还没有内容。') : '登录音乐平台之后，这里会列出你的内容。';
      el.insertBefore(em, el.querySelector('.hp-sheet-foot'));
    } else if (kind === 'radio') {
      ol.innerHTML = list.map(function (it, i) {
        return '<li class="hp-row nc" data-i="' + i + '"><span class="hp-n">' + String(i + 1).padStart(2, '0') + '</span><span class="hp-m"><span class="hp-t">' + homeThemePeekEsc(it.title) + '</span><span class="hp-a">' + homeThemePeekEsc(it.sub || '') + '</span></span><span></span></li>';
      }).join('');
    } else {
      ol.innerHTML = list.map(function (it, i) {
        return '<li class="hp-row" data-i="' + i + '"><span class="hp-c" style=\'' + coverStyle(it) + '\'></span><span class="hp-m"><span class="hp-t">' + homeThemePeekEsc(it.title) + '</span><span class="hp-a">' + homeThemePeekEsc(it.sub || '') + (it.providerLabel && String(it.sub || '').indexOf(it.providerLabel) < 0 ? ' · ' + homeThemePeekEsc(it.providerLabel) : '') + '</span></span>' +
          '<button type="button" class="hp-v" data-view="' + i + '" aria-expanded="false">曲目</button></li>';
      }).join('');
    }
    ol.scrollTop = scroll;
    peek.restore();
    var foot = el.querySelector('.hp-sheet-foot'); foot.innerHTML = '';
    var btns = [];
    if (!(m && m.login && m.login.any)) btns.push(['去登录', function () { A.openLogin && A.openLogin(); }]);
    else if (kind === 'lib') btns.push(['在软件里打开音乐库', function () { close(); A.openLibrary && A.openLibrary(); }]);
    else if (kind === 'find') btns.push(['平台推荐', function () { close(); A.openDiscover && A.openDiscover(); }]);
    else if (kind === 'radio' && list.length) btns.push(['开始收听 · ' + list[0].title, function () { A.playRadio && A.playRadio(list[0]); }]);
    btns.forEach(function (b) { var x = document.createElement('button'); x.type = 'button'; x.textContent = b[0]; x.onclick = b[1]; foot.appendChild(x); });
  }
  var peek = homeThemePeekController({
    list: ol,
    rowSel: 'li.hp-row',
    itemOf: function (li) { return items[Number(li.getAttribute('data-i'))] || null; },
    btnOf: function (li) { return li.querySelector('.hp-v'); },
    label: '曲目',
  });
  ol.addEventListener('click', function (ev) {
    var v = ev.target.closest('[data-view]');
    var li = ev.target.closest('li.hp-row'); if (!li) return;
    if (v) { ev.stopPropagation(); peek.toggle(li); return; }
    var it = items[Number(li.getAttribute('data-i'))]; if (!it) return;
    if (kind === 'radio') A.playRadio && A.playRadio(it);
    else A.playPlaylist && A.playPlaylist(it);
  });
  el.querySelector('.hp-sheet-x').addEventListener('click', function () { close(); });
  // 抽屉里的操作不要被主题当成"点墙 / 拖拽 / 打字"
  ['pointerdown', 'pointermove', 'wheel', 'keydown', 'keyup'].forEach(function (t) {
    el.addEventListener(t, function (ev) {
      if (t === 'keydown' && ev.key === 'Escape') { ev.preventDefault(); close(); }
      ev.stopPropagation();
    }, { passive: t !== 'keydown' });
  });
  function onOutside(ev) {
    if (!kind) return;
    if (el.contains(ev.target)) return;
    if (options.keepOpenFor && options.keepOpenFor(ev.target)) return;
    close();
  }
  function onKey(ev) { if (kind && ev.key === 'Escape' && !ev.defaultPrevented) { ev.preventDefault(); ev.stopPropagation(); close(); } }
  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKey, true);

  function open(k) {
    if (!HOME_THEME_SHEET_KINDS[k]) return;
    if (kind === k) { close(); return; }
    if (kind) peek.close();
    kind = k; sig = '';
    render(true);
    ol.scrollTop = 0;
    el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
    if (!unsub && typeof onHomeThemeModel === 'function') unsub = onHomeThemeModel(function () { if (kind) render(false); });
    if (k !== 'lib' && typeof homeThemeLoadPlatformDiscover === 'function') { try { homeThemeLoadPlatformDiscover(false); } catch (_e) { } }
    if (options.onToggle) options.onToggle(true, k);
  }
  function close() {
    if (!kind) return false;
    peek.close();
    kind = '';
    el.classList.remove('on'); el.setAttribute('aria-hidden', 'true');
    if (unsub) { unsub(); unsub = null; }
    if (options.onToggle) options.onToggle(false, '');
    return true;
  }
  function destroy() {
    close();
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  return { open: open, close: close, destroy: destroy, isOpen: function () { return !!kind; }, kind: function () { return kind; } };
}
