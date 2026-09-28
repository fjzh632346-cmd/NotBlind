// ============================================================
// Home themes · 数据层
// 把各平台（网易云 / QQ / 酷狗 / 汽水 / 本地听歌记录）的数据整理成一份统一的"主页模型"，
// 各个主题只读这份模型、只调用这里的动作，不直接碰平台接口。
// 平台缺某项功能时，用其他数据补上，并在 sourceLabel 里注明来源。
// ============================================================

var homeThemeData = {
  qqPool: [],          // 从 QQ 歌单里抽出来的候选歌曲
  qqPoolDay: '',
  qqPoolLoading: false,
  qqPlaylists: [],
  qqUser: null,        // 当前 QQ 池属于哪个 QQ 账号（null = 没有 / 未登录）
  qqLoadSeq: 0,        // 换号 / 退出时 +1，让还在路上的旧账号加载作废
  // 各平台自己的推荐 / 发现 / 电台（/api/discover/platforms），见 homeThemeLoadPlatformDiscover
  platform: null,      // { qq: bundle, netease: bundle, kugou: bundle, qishui: bundle }
  platformDay: '',
  platformSig: '',     // 登录了哪些平台 / 哪个 QQ 号；变了就重新拉
  platformLoading: false,
  platformFailedAt: 0,
  platformSeq: 0,
  listeners: [],
  notifyTimer: 0,
};

function homeThemeDayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function homeThemeSeededShuffle(list, seedText) {
  var seed = 0;
  String(seedText || '').split('').forEach(function (ch) { seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; });
  var rand = function () {
    seed = (seed + 0x6D2B79F5) >>> 0;
    var t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  var out = list.slice();
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}

function homeThemeProviderOf(song) {
  if (!song) return '';
  var p = String(song.provider || song.source || song.type || '').toLowerCase();
  if (p === 'song' || p === 'netease' || p === '163') return 'netease';
  if (p.indexOf('qq') === 0) return 'qq';
  if (p.indexOf('kugou') === 0) return 'kugou';
  if (p.indexOf('qishui') === 0) return 'qishui';
  if (p.indexOf('local') === 0 || song.localKey || song.localPath || song.localFileId) return 'local';
  return p || 'netease';
}

var HOME_THEME_PROVIDER_LABELS = { netease: '网易云', qq: 'QQ 音乐', kugou: '酷狗', qishui: '汽水', local: '本地' };

// 给 WebGL/Canvas 用的封面地址：远程图片统一走本地 /api/cover 代理，避免跨域污染画布。
function homeThemeCoverUrl(song, size) {
  if (!song) return '';
  var raw = '';
  try { raw = typeof songCoverSrc === 'function' ? songCoverSrc(song, size || 400) : (song.cover || ''); } catch (_e) { raw = song.cover || ''; }
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return '/api/cover?url=' + encodeURIComponent(raw);
  return raw;
}

function homeThemeTrack(song) {
  if (!song) return null;
  var key = '';
  try { key = typeof homeDashboardSongKey === 'function' ? homeDashboardSongKey(song) : ''; } catch (_e) { }
  var provider = homeThemeProviderOf(song);
  var duration = 0;
  try { duration = typeof playbackDurationFromSong === 'function' ? playbackDurationFromSong(song) : 0; } catch (_e) { }
  return {
    key: key || (provider + ':' + (song.id || song.name || '')),
    title: String(song.name || song.title || '未知歌曲'),
    artist: String(song.artist || (Array.isArray(song.artists) ? song.artists.map(function (a) { return a && a.name || a; }).join(' / ') : '') || '未知歌手'),
    album: String(song.album && song.album.name || song.album || ''),
    cover: homeThemeCoverUrl(song, 400),
    duration: duration,
    provider: provider,
    providerLabel: HOME_THEME_PROVIDER_LABELS[provider] || '',
    raw: song,
  };
}

function homeThemeLoggedIn(provider) {
  try { return typeof hasPlatformLogin === 'function' ? !!hasPlatformLogin(provider) : false; } catch (_e) { return false; }
}

// ---------- QQ 替代数据：从"我的 QQ 歌单"里每天抽一批 ----------
function homeThemeQQAccountKey() {
  try {
    var st = typeof qqLoginStatus !== 'undefined' ? qqLoginStatus : null;
    return String(st && (st.userId || st.uin || st.uid) || '');
  } catch (_e) { return ''; }
}
function homeThemeClearQQPool() {
  homeThemeData.qqPool = [];
  homeThemeData.qqPlaylists = [];
  homeThemeData.qqPoolDay = '';
  homeThemeData.qqLoadSeq += 1;
  homeThemeData.qqPoolLoading = false;
}
// QQ 退出 → 清空；换了账号 → 清空并重新加载。返回 true 表示刚清过。
function homeThemeCheckQQAccount() {
  if (!homeThemeLoggedIn('qq')) {
    var dirty = homeThemeData.qqUser !== null || homeThemeData.qqPool.length || homeThemeData.qqPlaylists.length || homeThemeData.qqPoolDay;
    homeThemeData.qqUser = null;
    if (dirty) { homeThemeClearQQPool(); homeThemeNotify(); return true; }
    return false;
  }
  var key = homeThemeQQAccountKey();
  if (homeThemeData.qqUser === key) return false;
  var hadData = homeThemeData.qqUser !== null || homeThemeData.qqPool.length || homeThemeData.qqPlaylists.length;
  homeThemeData.qqUser = key;
  homeThemeClearQQPool();
  setTimeout(function () { homeThemeLoadQQPool(true); }, 0);
  if (hadData) homeThemeNotify();
  return true;
}

async function homeThemeLoadQQPool(force) {
  homeThemeCheckQQAccount();
  if (!homeThemeLoggedIn('qq')) return;
  var day = homeThemeDayKey();
  if (!force && homeThemeData.qqPoolDay === day && homeThemeData.qqPool.length) return;
  if (homeThemeData.qqPoolLoading) return;
  homeThemeData.qqPoolLoading = true;
  var seq = homeThemeData.qqLoadSeq;
  try {
    var lists = await apiJson('/api/qq/user/playlists');
    if (seq !== homeThemeData.qqLoadSeq) return; // 期间退出 / 换号了，结果作废
    var rows = (lists && (lists.playlists || lists.data || lists.list)) || [];
    if (!Array.isArray(rows)) rows = [];
    rows = rows.filter(function (row) { return row && row.id; });
    var playlistsRows = rows;
    // 优先"我喜欢"，再按日期轮换 1~2 张其他歌单
    var liked = rows.filter(function (row) { return row.virtual || /我喜欢|liked|fav/i.test(String(row.name || '')); });
    var others = homeThemeSeededShuffle(rows.filter(function (row) { return liked.indexOf(row) < 0; }), day);
    var chosen = liked.slice(0, 1).concat(others.slice(0, liked.length ? 1 : 2));
    var pool = [];
    for (var i = 0; i < chosen.length; i++) {
      try {
        var data = await apiJson('/api/qq/playlist/tracks?id=' + encodeURIComponent(chosen[i].id) + '&limit=80&offset=0');
        var tracks = data && (data.tracks || data.songs) || [];
        pool = pool.concat(tracks);
      } catch (e) { console.warn('[HomeTheme] QQ playlist tracks', e); }
    }
    if (seq !== homeThemeData.qqLoadSeq) return;
    homeThemeData.qqPlaylists = playlistsRows;
    var seen = Object.create(null);
    pool = pool.filter(function (song) {
      var k = homeThemeTrack(song).key;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
    homeThemeData.qqPool = homeThemeSeededShuffle(pool, 'qq-' + day);
    homeThemeData.qqPoolDay = day;
  } catch (e) {
    console.warn('[HomeTheme] QQ pool', e);
  } finally {
    if (seq === homeThemeData.qqLoadSeq) homeThemeData.qqPoolLoading = false;
    homeThemeNotify();
  }
}

// ---------- 各平台的推荐 / 发现 / 电台 ----------
// 用户点推荐、发现、电台，是想听自己平时不常听的歌：这里只用平台真实下发的推荐内容
// （猜你喜欢、私人 FM、排行榜、新歌、推荐歌单、主题电台），不拿他自己的歌单充数。
var HOME_THEME_PLATFORM_ORDER = ['qq', 'netease', 'kugou', 'qishui'];

function homeThemeLoginSig() {
  return HOME_THEME_PLATFORM_ORDER.filter(homeThemeLoggedIn).join(',') + '|' + homeThemeQQAccountKey();
}
// 登录的平台或 QQ 账号变了 → 作废旧数据并重新拉
function homeThemeCheckPlatformLogin() {
  var sig = homeThemeLoginSig();
  if (homeThemeData.platformSig === sig) return false;
  homeThemeData.platformSig = sig;
  homeThemeData.platform = null;
  homeThemeData.platformDay = '';
  homeThemeData.platformFailedAt = 0;
  homeThemeData.platformLoading = false;
  homeThemeData.platformSeq += 1;
  if (sig.split('|')[0]) setTimeout(function () { homeThemeLoadPlatformDiscover(true); }, 0);
  homeThemeNotify();
  return true;
}

async function homeThemeLoadPlatformDiscover(force) {
  homeThemeCheckPlatformLogin();
  if (!HOME_THEME_PLATFORM_ORDER.some(homeThemeLoggedIn)) return;
  var day = homeThemeDayKey();
  if (!force && homeThemeData.platform && homeThemeData.platformDay === day) return;
  if (homeThemeData.platformLoading) return;
  // 失败后 2 分钟内不反复打接口（renderHomeDashboard 会频繁触发）
  if (!force && homeThemeData.platformFailedAt && Date.now() - homeThemeData.platformFailedAt < 120000) return;
  homeThemeData.platformLoading = true;
  var seq = homeThemeData.platformSeq;
  try {
    var data = await apiJson('/api/discover/platforms' + (force ? '?force=1' : ''), { timeoutMs: 20000 });
    if (seq !== homeThemeData.platformSeq) return;
    var providers = data && data.providers || {};
    var ok = Object.keys(providers).some(function (k) {
      var b = providers[k] || {};
      return (b.daily && b.daily.songs && b.daily.songs.length) || (b.toplists && b.toplists.length) || (b.playlists && b.playlists.length) || (b.radios && b.radios.length) || (b.newSongs && b.newSongs.length);
    });
    if (ok) {
      homeThemeData.platform = providers;
      homeThemeData.platformDay = day;
      homeThemeData.platformFailedAt = 0;
    } else {
      homeThemeData.platformFailedAt = Date.now();
    }
  } catch (e) {
    console.warn('[HomeTheme] platform discover', e);
    if (seq === homeThemeData.platformSeq) homeThemeData.platformFailedAt = Date.now();
  } finally {
    if (seq === homeThemeData.platformSeq) homeThemeData.platformLoading = false;
    homeThemeNotify();
  }
}

// 当前登录的平台里，已经拿到推荐数据的那些（按固定顺序）
function homeThemePlatformBundles() {
  var all = homeThemeData.platform || {};
  return HOME_THEME_PLATFORM_ORDER.filter(function (p) { return homeThemeLoggedIn(p) && all[p] && !all[p].error; })
    .map(function (p) { return all[p]; });
}

// ---------- "你已经很熟的歌"：推荐里把这些往后放 ----------
function homeThemeNormText(text) {
  return String(text || '').toLowerCase().replace(/[\s·・\-_/\\()（）\[\]【】'"“”‘’.,，。!！?？:：]+/g, '');
}
// 同一首歌的几种写法：平台 + id，以及"歌名|第一个歌手"（跨平台 / 不同版本也能认出来）
function homeThemeSongIdentity(song) {
  if (!song) return [];
  var raw = song.raw || song;
  var out = [];
  var id = raw.mid || raw.songmid || raw.hash || raw.id || '';
  if (id) out.push(homeThemeProviderOf(raw) + ':' + id);
  var name = homeThemeNormText(raw.name || raw.title);
  var firstArtist = Array.isArray(raw.artists) && raw.artists[0] ? (raw.artists[0].name || raw.artists[0]) : String(raw.artist || '').split(/\s*[\/、,&]\s*/)[0];
  if (name) out.push('t:' + name + '|' + homeThemeNormText(firstArtist));
  return out;
}
function homeThemeFamiliarSet() {
  var set = Object.create(null);
  function add(list) { (list || []).forEach(function (s) { homeThemeSongIdentity(s).forEach(function (k) { set[k] = true; }); }); }
  add(homeThemeData.qqPool);          // 你的 QQ 我喜欢 + 歌单
  add(homeThemeRecentSongs(200));     // 最近听过
  return set;
}
function homeThemeIsFamiliar(song, set) {
  if (homeThemeIsLiked(song && (song.raw || song))) return true;
  return homeThemeSongIdentity(song).some(function (k) { return !!set[k]; });
}
// 熟歌挪到最后；挪完剩得太少（推荐本来就只有几首）就保留在队尾，不直接丢
function homeThemeFreshFirst(songs, minKeep) {
  songs = (songs || []).filter(Boolean);
  if (!songs.length) return songs;
  var set = homeThemeFamiliarSet();
  var fresh = [], familiar = [];
  songs.forEach(function (s) { (homeThemeIsFamiliar(s, set) ? familiar : fresh).push(s); });
  return fresh.length >= (minKeep || 8) ? fresh : fresh.concat(familiar);
}
// 几个平台的列表交错合并（去重），避免一个平台把另一个完全挤掉
function homeThemeInterleave(lists, limit) {
  var out = [], seen = Object.create(null), i = 0, more = true;
  while (more && out.length < (limit || 30)) {
    more = false;
    lists.forEach(function (list) {
      if (i < list.length) {
        more = true;
        var s = list[i], k = homeThemeSongIdentity(s)[0] || String(i);
        if (!seen[k] && out.length < (limit || 30)) { seen[k] = true; out.push(s); }
      }
    });
    i++;
  }
  return out;
}

function homeThemeRecentSongs(limit) {
  // 听歌记录按时间倒序存在 listenStatsState.history 里（homeListenSummary().recent 只给最近一条）
  var recent = [];
  try { recent = listenStatsState && Array.isArray(listenStatsState.history) ? listenStatsState.history : []; } catch (_e) { recent = []; }
  if (!recent.length) {
    var summary = null;
    try { summary = typeof homeListenSummary === 'function' ? homeListenSummary() : null; } catch (_e) { }
    if (summary && summary.recent) recent = Array.isArray(summary.recent) ? summary.recent : [summary.recent];
  }
  return recent.filter(Boolean).slice(0, limit || 12).map(function (record) {
    try { return typeof songFromListenRecord === 'function' ? songFromListenRecord(record) : record; } catch (_e) { return record; }
  }).filter(Boolean);
}

// 每日推荐：各平台自己的个性化推荐（网易云每日推荐、QQ 猜你喜欢 / 雷达、酷狗猜你喜欢、汽水推荐流），
// 登了几个平台就交错合并，熟歌往后放。平台推荐都拿不到时，才退回"重温你的 QQ 歌单"（并如实标注），
// 再没有就用听歌记录 / 本地歌曲。
function homeThemeDailySource() {
  var netease = homeDiscoverState && Array.isArray(homeDiscoverState.songs) ? homeDiscoverState.songs : [];
  var parts = [];
  if (netease.length) parts.push({ songs: netease, label: '网易云 · 每日推荐', provider: 'netease' });
  homeThemePlatformBundles().forEach(function (b) {
    if (b.provider === 'netease') return; // 网易云每日推荐走 homeDiscoverState
    var songs = b.daily && Array.isArray(b.daily.songs) ? b.daily.songs : [];
    if (songs.length) parts.push({ songs: songs, label: b.daily.label || ((HOME_THEME_PROVIDER_LABELS[b.provider] || '') + ' · 为你推荐'), provider: b.provider });
  });
  if (parts.length === 1 && parts[0].provider === 'netease') return { songs: netease, label: parts[0].label, kind: 'netease-daily' };
  if (parts.length) {
    // 模型刷新很频繁，过滤结果按"数据没变"缓存 30 秒
    var memo = homeThemeDailySource.memo;
    var sig = parts.map(function (p) { return p.provider + p.songs.length; }).join(',') + '|' + homeThemeData.qqPool.length + '|' +
      homeThemeRecentSongs(1).map(function (x) { return homeThemeSongIdentity(x)[0]; }).join('');
    if (!memo || memo.platform !== homeThemeData.platform || memo.netease !== netease || memo.sig !== sig || Date.now() - memo.at > 30000) {
      var merged = homeThemeInterleave(parts.map(function (p) { return p.songs; }), 60);
      memo = homeThemeDailySource.memo = { platform: homeThemeData.platform, netease: netease, sig: sig, at: Date.now(), songs: homeThemeFreshFirst(merged, 10).slice(0, 30) };
    }
    return { songs: memo.songs, label: parts.length === 1 ? parts[0].label : parts.map(function (p) { return HOME_THEME_PROVIDER_LABELS[p.provider]; }).join(' + ') + ' · 为你推荐', kind: 'platform-daily' };
  }
  if (homeThemeData.qqPool.length) return { songs: homeThemeData.qqPool.slice(0, 30), label: '重温 · 你的 QQ 歌单（平台推荐暂时没拿到）', kind: 'qq-pool' };
  var local = [];
  try { local = typeof homeDashboardLocalSongs === 'function' ? homeDashboardLocalSongs() : []; } catch (_e) { }
  var recent = homeThemeRecentSongs(30);
  var mixed = homeThemeSeededShuffle(recent.concat(local), 'mix-' + homeThemeDayKey()).slice(0, 30);
  if (mixed.length) return { songs: mixed, label: '今日精选 · 来自你的听歌记录', kind: 'history' };
  return { songs: [], label: '登录网易云或 QQ 音乐后生成', kind: 'empty' };
}

function homeThemeCurrentSong() {
  try { if (playQueue && playQueue[currentIdx]) return playQueue[currentIdx]; } catch (_e) { }
  try { return typeof currentCoverSong === 'function' ? currentCoverSong() : null; } catch (_e) { return null; }
}

function homeThemeIsLiked(song) {
  try { return !!(song && typeof isSongLiked === 'function' && isSongLiked(song)); } catch (_e) { return false; }
}

// ---------- 歌单 / 电台条目（给主题里"推近以后"的页面用） ----------
function homeThemePlaylistItem(pl, tag) {
  if (!pl || !pl.id) return null;
  var provider = homeThemeProviderOf(pl);
  if (provider === 'song') provider = 'netease';
  var cover = pl.cover || pl.coverImgUrl || pl.picUrl || '';
  if (cover && provider === 'netease' && /^https?:/i.test(cover) && cover.indexOf('?param=') < 0) cover += '?param=200y200';
  if (/^https?:\/\//i.test(cover)) cover = '/api/cover?url=' + encodeURIComponent(cover);
  return {
    kind: 'playlist',
    id: String(pl.id),
    key: provider + ':' + pl.id,
    title: String(pl.name || '未命名歌单'),
    sub: (pl.trackCount ? pl.trackCount + ' 首' : '') + (pl.creator && typeof pl.creator === 'string' ? (pl.trackCount ? ' · ' : '') + pl.creator : '') || (tag || ''),
    count: Number(pl.trackCount) || 0,
    cover: cover,
    provider: provider,
    providerLabel: HOME_THEME_PROVIDER_LABELS[provider] || (provider === 'mineradio' ? 'Not Blind' : ''),
    raw: pl,
  };
}
function homeThemeLibraryItems() {
  var rows = [];
  try { rows = (userPlaylists || []).slice(0, 60); } catch (_e) { rows = []; }
  return rows.map(function (pl) { return homeThemePlaylistItem(pl); }).filter(Boolean);
}
// 发现：各平台的新歌、排行榜、推荐歌单（排行榜 / 新歌以"虚拟歌单"出现，能看曲目、能整张播放）
function homeThemeDiscoverItemsFor(bundle, neteasePlaylists) {
  var provider = bundle && bundle.provider;
  var label = HOME_THEME_PROVIDER_LABELS[provider] || '';
  var out = [];
  var newSongs = bundle && Array.isArray(bundle.newSongs) ? bundle.newSongs : [];
  if (newSongs.length) {
    var ns = provider === 'qq'
      ? homeThemePlaylistItem({ provider: 'qq', id: 'newsong_5', name: '新歌首发', trackCount: newSongs.length, cover: newSongs[0] && newSongs[0].cover })
      : homeThemePlaylistItem({ provider: provider, id: provider + '-newsong', name: '新歌速递', trackCount: newSongs.length, cover: newSongs[0] && newSongs[0].cover });
    if (ns) {
      ns.listType = 'newsong';
      if (provider !== 'qq') ns.songs = newSongs; // 没有歌单 id 的，直接带歌
      ns.sub = newSongs.length + ' 首 · 平台最新发布';
      out.push(ns);
    }
  }
  var tops = (bundle && bundle.toplists || []).slice(0, 4).map(function (pl) {
    var it = homeThemePlaylistItem(pl);
    if (!it) return null;
    it.listType = 'toplist';
    it.sub = '排行榜' + (pl.updateFrequency ? ' · ' + pl.updateFrequency : (pl.period ? ' · ' + pl.period : ''));
    return it;
  }).filter(Boolean);
  var pls = (provider === 'netease' ? (neteasePlaylists || []) : (bundle && bundle.playlists || [])).slice(0, 8).map(function (pl) {
    var it = homeThemePlaylistItem(Object.assign({ provider: provider }, pl), label + '推荐');
    if (!it) return null;
    it.listType = 'recommend';
    if (!it.sub) it.sub = pl.tag || '推荐歌单';
    return it;
  }).filter(Boolean);
  // 榜单和推荐歌单交替排，别让一种把另一种挤到最后
  for (var i = 0; i < Math.max(tops.length, pls.length); i++) {
    if (tops[i]) out.push(tops[i]);
    if (pls[i]) out.push(pls[i]);
  }
  return out;
}
function homeThemeDiscoverItems(neteaseIn, qqIn) {
  var rows = [];
  var neteasePlaylists = neteaseIn && homeDiscoverState && Array.isArray(homeDiscoverState.playlists) ? homeDiscoverState.playlists : [];
  var bundles = homeThemePlatformBundles();
  var groups = bundles.map(function (b) { return homeThemeDiscoverItemsFor(b, neteasePlaylists); });
  if (neteasePlaylists.length && !bundles.some(function (b) { return b.provider === 'netease'; })) {
    groups.push(homeThemeDiscoverItemsFor({ provider: 'netease' }, neteasePlaylists));
  }
  // 自己的歌单不算"发现"
  var own = Object.create(null);
  try { (userPlaylists || []).forEach(function (pl) { if (pl && pl.id) own[homeThemeProviderOf(pl) + ':' + pl.id] = true; }); } catch (_e) { }
  var seen = Object.create(null);
  for (var i = 0; rows.length < 28; i++) {
    var any = false;
    groups.forEach(function (g) {
      var it = g[i];
      if (!it) return;
      any = true;
      if (own[it.key] || seen[it.key]) return;
      seen[it.key] = true;
      rows.push(it);
    });
    if (!any) break;
  }
  if (!rows.length && qqIn) {
    // 平台推荐暂时拿不到：退回按日期"重温"你的 QQ 歌单（sub 里写明）
    rows = homeThemeSeededShuffle(homeThemeData.qqPlaylists || [], 'discover-' + homeThemeDayKey()).slice(0, 12).map(function (pl) {
      var it = homeThemePlaylistItem(Object.assign({ provider: 'qq' }, pl), '重温 · QQ 歌单');
      if (it) it.sub = '重温 · ' + (it.count ? it.count + ' 首' : 'QQ 歌单');
      return it;
    });
  }
  return rows.filter(Boolean);
}
// 电台：先放各平台的私人电台（猜你喜欢 / 漫游 / 私人 FM / 推荐流），再放新歌电台和主题电台；
// "回声电台"（你最近听过的）留一个，放在后面；自己的歌单只在平台电台一个都拿不到时才当电台用。
function homeThemeRadioItems(neteaseIn, qqIn) {
  var items = [];
  var bundles = homeThemePlatformBundles();
  var personal = [], themed = [], fresh = [];
  bundles.forEach(function (b) {
    (b.radios || []).forEach(function (r) {
      var it = { kind: 'platform-radio', key: 'radio:' + b.provider + ':' + r.id, provider: b.provider, radioId: String(r.id), title: r.name, sub: r.sub || ((HOME_THEME_PROVIDER_LABELS[b.provider] || '') + ' · ' + (r.group || '') + '电台'), group: r.group || '' };
      (r.personal ? personal : themed).push(it);
    });
    if (b.newSongs && b.newSongs.length) {
      fresh.push({ kind: 'songs-radio', key: 'radio:newsong:' + b.provider, provider: b.provider, songs: b.newSongs, title: '新歌电台 · ' + (HOME_THEME_PROVIDER_LABELS[b.provider] || ''), sub: '平台最新发布的 ' + b.newSongs.length + ' 首，随机放' });
    }
  });
  items = items.concat(personal);
  var daily = homeThemeDailySource();
  if (daily.songs.length && daily.kind !== 'qq-pool') items.push({ kind: 'mix', key: 'radio:mix', title: '今日混合电台', sub: '把今天的推荐打乱了放 · ' + daily.label });
  if (neteaseIn && !personal.some(function (it) { return it.provider === 'netease'; })) {
    items.push({ kind: 'private', key: 'radio:private', title: '私人雷达', sub: '网易云 · 按你的口味连续播放' });
  }
  items = items.concat(fresh);
  // 主题电台很多，按日期轮换一批（每个平台最多 8 个）
  var byProvider = {};
  themed.forEach(function (it) { (byProvider[it.provider] = byProvider[it.provider] || []).push(it); });
  Object.keys(byProvider).forEach(function (p) {
    var list = p === 'qq' ? homeThemeSeededShuffle(byProvider[p], 'radio-' + homeThemeDayKey()) : byProvider[p];
    items = items.concat(list.slice(0, 8));
  });
  var recent = homeThemeRecentSongs(40);
  if (recent.length > 3) items.push({ kind: 'history', key: 'radio:history', title: '回声电台', sub: '从你最近听过的 ' + recent.length + ' 首里随机播（都是听过的）' });
  if (!personal.length && !themed.length) {
    // 平台电台一个都没拿到：退回"把你的歌单当电台"
    var pls = homeThemeLibraryItems().filter(function (it) { return it.provider === 'netease' || it.provider === 'qq'; });
    pls.slice(0, 6).forEach(function (it) {
      items.push({ kind: 'playlist-radio', key: 'radio:pl:' + it.key, title: it.title + ' 电台', sub: '随机播放你的歌单 · ' + (it.providerLabel || '') + (it.count ? ' · ' + it.count + ' 首' : ''), playlist: it });
    });
  }
  if (neteaseIn || qqIn || homeThemeLoggedIn('kugou') || homeThemeLoggedIn('qishui')) items.push({ kind: 'platform', key: 'radio:platform', title: '平台推荐', sub: '打开各平台可验证的推荐内容' });
  return items.slice(0, 24);
}

function homeThemeSectionMeta(kind, anyIn) {
  var label = kind === 'radio' ? '电台' : '发现';
  if (!anyIn) return { label: label, sub: '登录后可用', available: false };
  var names = homeThemePlatformBundles().map(function (b) { return HOME_THEME_PROVIDER_LABELS[b.provider]; });
  if (kind === 'discover' && homeThemeLoggedIn('netease') && names.indexOf('网易云') < 0) names.unshift('网易云');
  if (!names.length) {
    return { label: label, sub: homeThemeData.platformLoading ? '正在读取平台推荐…' : (kind === 'radio' ? '平台电台暂时没拿到' : '平台推荐暂时没拿到'), available: true };
  }
  return { label: label, sub: names.join(' / ') + (kind === 'radio' ? ' · 私人电台 / 主题电台' : ' · 新歌 / 排行榜 / 推荐歌单'), available: true };
}

// [二改 2026-09-28] 哪些主题有"主页歌词位"（03-home-lyric.js）：这些主题主页上的「词」按钮只管主页那句歌词
// （反馈：孔版的「词」开关的是播放页歌词，主页上看不出任何变化）。FM 收音机 / 经典没有歌词位，照旧开关播放页歌词。
var HOME_THEME_LYRIC_SLOT = { 'echo': 1, 'star-atlas': 1, 'afternoon': 1, 'riso-poster': 1 };
function homeThemeHasLyricSlot() {
  try {
    if (typeof nbHomeLyricPref !== 'function' || typeof nbSetHomeLyricPref !== 'function') return false;
    var id = typeof homeThemeHost === 'object' && homeThemeHost ? homeThemeHost.current : '';
    return !!HOME_THEME_LYRIC_SLOT[id];
  } catch (_) { return false; }
}

function buildHomeThemeModel() {
  try { homeThemeCheckQQAccount(); } catch (_e) { }
  try { homeThemeCheckPlatformLogin(); } catch (_e) { }
  var now = new Date();
  var current = homeThemeCurrentSong();
  var duration = 0, position = 0;
  try { duration = getPlaybackDurationSeconds() || 0; } catch (_e) { }
  try { position = getPlaybackCurrentSeconds() || 0; } catch (_e) { }
  if (!position && current) {
    try { position = typeof currentResumeSeconds === 'function' ? (currentResumeSeconds(0) || 0) : 0; } catch (_e) { }
  }
  var isPlaying = false;
  try { isPlaying = !!playing; } catch (_e) { }

  var queue = [];
  try {
    if (playQueue && playQueue.length) {
      for (var i = 1; i <= Math.min(6, playQueue.length - 1); i++) queue.push(homeThemeTrack(playQueue[(currentIdx + i) % playQueue.length]));
    }
  } catch (_e) { }
  var nextInfo = null;
  try { nextInfo = typeof homeDashboardNextQueueInfo === 'function' ? homeDashboardNextQueueInfo() : null; } catch (_e) { }
  // 队列里当前这首后面还有几首
  var queueTotal = 0;
  try {
    if (typeof playQueue !== 'undefined' && Array.isArray(playQueue) && playQueue.length) {
      var ci = typeof currentIdx === 'number' ? currentIdx : -1;
      queueTotal = ci >= 0 && ci < playQueue.length ? playQueue.length - 1 - ci : playQueue.length;
    }
  } catch (_e) { }
  // 只有真在队列里、而且不是正在放的这首，才算"下一首"（队列空时 A.next() 什么都不做，别给主题一个点不动的下一首）
  var nextTrackModel = null;
  try {
    if (nextInfo && nextInfo.song && nextInfo.queued && Array.isArray(playQueue) && playQueue.length > 1) {
      nextTrackModel = homeThemeTrack(nextInfo.song);
      var curTrack = current ? homeThemeTrack(current) : null;
      if (nextInfo.song === current || (curTrack && nextTrackModel && curTrack.key === nextTrackModel.key)) nextTrackModel = null;
    }
  } catch (_e) { nextTrackModel = null; }

  var metrics = { listenMs: 0, songCount: 0, topArtist: '' };
  try { metrics = homeDashboardTodayListenMetrics(); } catch (_e) { }

  var daily = homeThemeDailySource();
  var currentKey = current ? homeThemeTrack(current).key : '';
  // "为你挑选"只从排在前面的（没听过的）歌里挑；熟歌已经被排到每日推荐的最后
  var picks = homeThemeSeededShuffle(daily.kind === 'platform-daily' ? homeThemeFreshFirst(daily.songs.slice(0, 20), 4) : daily.songs, 'picks-' + homeThemeDayKey() + '-' + (typeof homeDashboardReviewOffset === 'number' ? homeDashboardReviewOffset : 0))
    .map(homeThemeTrack).filter(function (t) { return t && t.key !== currentKey; }).slice(0, 4);

  var review = { text: '', source: '' };
  try { review = homeDashboardSelectedReview() || review; } catch (_e) { }
  if (typeof review === 'string') review = { text: review, source: '' };

  var neteaseIn = homeThemeLoggedIn('netease');
  var qqIn = homeThemeLoggedIn('qq');
  var anyIn = false;
  try { anyIn = hasAnyPlatformLogin(); } catch (_e) { }

  var playlistCount = 0;
  try { playlistCount = (userPlaylists || []).length; } catch (_e) { }
  var platforms = [];
  if (neteaseIn) platforms.push('网易云');
  if (qqIn) platforms.push('QQ 音乐');
  ['kugou', 'qishui'].forEach(function (p) { if (homeThemeLoggedIn(p)) platforms.push(HOME_THEME_PROVIDER_LABELS[p]); });

  var weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return {
    now: current ? Object.assign(homeThemeTrack(current), {
      position: position,
      duration: duration || homeThemeTrack(current).duration,
      playing: isPlaying,
      liked: homeThemeIsLiked(current),
    }) : null,
    next: nextTrackModel,
    queue: queue,
    queueTotal: queueTotal,
    lyricsOn: homeThemeHasLyricSlot() ? nbHomeLyricPref() : !!(typeof fx === 'object' && fx && fx.particleLyrics),
    today: {
      minutes: Math.floor((metrics.listenMs || 0) / 60000),
      count: metrics.songCount || 0,
      topArtist: metrics.topArtist || '',
      streak: metrics.streak || 0,
    },
    recent: homeThemeRecentSongs(12).map(homeThemeTrack),
    daily: { count: daily.songs.length, label: daily.label, kind: daily.kind, preview: daily.songs.slice(0, 6).map(homeThemeTrack), songs: daily.songs.slice(0, 30).map(homeThemeTrack) },
    picks: { items: picks, label: daily.label },
    library: { playlistCount: playlistCount, platforms: platforms, label: platforms.length ? platforms.join(' · ') : '本地音乐', items: homeThemeLibraryItems() },
    discover: homeThemeSectionMeta('discover', anyIn),
    radio: homeThemeSectionMeta('radio', anyIn),
    login: { netease: neteaseIn, qq: qqIn, any: anyIn },
    clock: {
      time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      seconds: now.getSeconds(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      weekday: weekdays[now.getDay()],
      year: now.getFullYear(),
    },
    quote: { text: String(review.text || '').replace(/^[“"]|[”"]$/g, ''), source: review.source || '' },
    loading: !!(homeDiscoverState && homeDiscoverState.loading) || homeThemeData.qqPoolLoading || homeThemeData.platformLoading,
  };
}
// 在模型上补充"发现 / 电台"的条目（包一层，避免改动上面的主体）
(function extendHomeThemeModel() {
  var base = buildHomeThemeModel;
  buildHomeThemeModel = function () {
    var m = base.apply(this, arguments);
    try {
      m.discover.items = homeThemeDiscoverItems(m.login.netease, m.login.qq);
      m.radio.items = homeThemeRadioItems(m.login.netease, m.login.qq);
      if (m.radio.items.length && !m.radio.available) m.radio.available = true;
      if (m.discover.items.length && !m.discover.available) m.discover.available = true;
    } catch (e) { console.warn('[HomeTheme] extend model', e); }
    return m;
  };
})();

// ---------- 订阅 ----------
function onHomeThemeModel(cb) {
  homeThemeData.listeners.push(cb);
  return function () { homeThemeData.listeners = homeThemeData.listeners.filter(function (fn) { return fn !== cb; }); };
}
function homeThemeNotify() {
  if (homeThemeData.notifyTimer) return;
  homeThemeData.notifyTimer = setTimeout(function () {
    homeThemeData.notifyTimer = 0;
    if (!homeThemeData.listeners.length) return;
    var model;
    try { model = buildHomeThemeModel(); } catch (e) { console.warn('[HomeTheme] model', e); return; }
    homeThemeData.listeners.slice().forEach(function (fn) { try { fn(model); } catch (e) { console.warn('[HomeTheme] listener', e); } });
  }, 40);
}

// ---------- 动作 ----------
function homeThemeLeaveHome() {
  homeForcedOpen = false;
  homeSuppressed = false;
  if (typeof setHomeControlsLocked === 'function') setHomeControlsLocked(false);
}

function homeThemePlayList(songs, index, contextName) {
  songs = (songs || []).map(function (s) { return s && s.raw ? s.raw : s; }).filter(Boolean);
  if (!songs.length) return false;
  playQueue = songs.map(function (song) { return typeof cloneSong === 'function' ? cloneSong(song) : Object.assign({}, song); });
  currentIdx = Math.max(0, Math.min(playQueue.length - 1, Number(index) || 0));
  homeThemeLeaveHome();
  if (typeof safeRenderQueuePanel === 'function') safeRenderQueuePanel('home-theme', { scrollCurrent: true });
  if (typeof safeShelfRebuild === 'function') safeShelfRebuild('home-theme', true);
  if (typeof forcePlaybackControlsInteractive === 'function') forcePlaybackControlsInteractive();
  Promise.resolve(playQueueAt(currentIdx, { manual: true, context: { type: 'home-theme', playlistName: contextName || '主页' } }))
    .catch(function (e) { console.warn('[HomeTheme] play', e); });
  return true;
}

// 平台电台：每次点都现拉一段（电台本身就是随机流），熟歌往后放
var homeThemeRadioLoading = false;
function homeThemePlayPlatformRadio(item) {
  if (!item || homeThemeRadioLoading) return;
  homeThemeRadioLoading = true;
  if (typeof showLoading === 'function') showLoading();
  var url = '/api/radio/tracks?provider=' + encodeURIComponent(item.provider) + '&id=' + encodeURIComponent(item.radioId) + '&num=30';
  return Promise.resolve(apiJson(url, { timeoutMs: 16000 }))
    .then(function (r) {
      var tracks = (r && r.tracks) || [];
      if (!tracks.length) {
        if (typeof showToast === 'function') showToast(r && r.message || (item.title + '暂时没有返回歌曲'));
        return;
      }
      homeThemePlayList(homeThemeFreshFirst(tracks, 6), 0, item.title);
    })
    .catch(function (e) { console.warn('[HomeTheme] platform radio', e); if (typeof showToast === 'function') showToast('电台加载失败'); })
    .then(function () { homeThemeRadioLoading = false; if (typeof hideLoading === 'function') hideLoading(); });
}

var homeThemeActions = {
  resume: function () { return resumeHomeDashboardPlayback(); },
  togglePlay: function () {
    if (!homeThemeCurrentSong()) return resumeHomeDashboardPlayback();
    return togglePlay();
  },
  prev: function () { return prevTrack(true); },
  next: function () { return nextTrack(true); },
  seek: function (fraction) {
    var d = 0;
    try { d = getPlaybackDurationSeconds(); } catch (_e) { }
    if (!d || !audio) return;
    commitProgressSeek(Math.max(0, Math.min(1, Number(fraction) || 0)) * d, !!playing);
    homeThemeNotify();
  },
  toggleLike: function () { toggleLikeCurrent(); setTimeout(homeThemeNotify, 300); },
  // [二改 2026-09-28] 主页上的「词」：有主页歌词位的主题只开关主页那句歌词（带提示），不再去开关播放页的 3D 歌词
  toggleLyrics: function () {
    if (homeThemeHasLyricSlot()) nbSetHomeLyricPref(!nbHomeLyricPref());
    else toggleLyricsPanel();
    homeThemeNotify();
  },
  playTrack: function (track, list, contextName) {
    var songs = list && list.length ? list : [track];
    var idx = Math.max(0, songs.indexOf(track));
    return homeThemePlayList(songs, idx, contextName);
  },
  playDaily: function (index) {
    homeThemeCheckQQAccount();
    var src = homeThemeDailySource();
    if (src.kind === 'netease-daily') {
      // 从点中的那一首开始播，整份每日推荐作为队列
      if (src.songs.length && index > 0) return homeThemePlayList(src.songs, index, '每日推荐');
      return playHomeDaily();
    }
    if (!src.songs.length) return homeThemeActions.openLogin();
    return homeThemePlayList(src.songs, index || 0, src.kind === 'qq-pool' ? '重温 · QQ 歌单' : '每日推荐');
  },
  playPick: function (index) {
    var model = buildHomeThemeModel();
    var items = model.picks.items;
    if (!items.length) return homeThemeActions.playDaily(0);
    return homeThemePlayList(items, index || 0, '为你挑选');
  },
  // 跳到当前队列里后面第 offset 首（1 = 下一首）
  playQueueItem: function (offset) {
    try {
      if (!playQueue || !playQueue.length) return homeThemeActions.resume();
      var idx = (currentIdx + Math.max(1, Number(offset) || 1)) % playQueue.length;
      homeThemeLeaveHome();
      if (typeof forcePlaybackControlsInteractive === 'function') forcePlaybackControlsInteractive();
      return Promise.resolve(playQueueAt(idx, { manual: true })).catch(function (e) { console.warn('[HomeTheme] queue', e); });
    } catch (e) { console.warn('[HomeTheme] queue', e); }
  },
  playRecent: function (index) {
    var recent = homeThemeRecentSongs(30);
    if (!recent.length) return playHomeRecent();
    return homeThemePlayList(recent, index || 0, '最近播放');
  },
  openLibrary: function () { return openHomeDashboardLibrary(); },
  // 播放一张歌单（音乐库 / 发现里的条目）
  playPlaylist: function (item) {
    if (item && Array.isArray(item.songs) && item.songs.length) {
      return homeThemePlayList(homeThemeFreshFirst(item.songs, 6), 0, item.title || '新歌');
    }
    if (!item || !item.id) return;
    var id = typeof playlistPanelProviderId === 'function' ? playlistPanelProviderId(item.provider, item.id) : item.id;
    homeThemeLeaveHome();
    return Promise.resolve(loadPlaylistIntoQueueById(id, true, item.title || '')).catch(function (e) { console.warn('[HomeTheme] playlist', e); });
  },
  // 在软件自己的歌单面板里打开这张歌单的曲目
  openPlaylist: function (item) {
    if (item && Array.isArray(item.songs) && item.songs.length) return homeThemeActions.playPlaylist(item);
    if (!item || !item.id) return;
    if (typeof openPlaylistPanelTab === 'function') openPlaylistPanelTab('playlists', true);
    if (typeof openPlaylistPanelDetail === 'function') {
      setTimeout(function () { Promise.resolve(openPlaylistPanelDetail(item.provider, item.id, item.title)).catch(function (e) { console.warn('[HomeTheme] detail', e); }); }, 60);
    }
  },
  playRadio: function (item) {
    if (!item) return homeThemeActions.openRadio();
    if (item.kind === 'mix') {
      var src = homeThemeDailySource();
      if (!src.songs.length) return homeThemeActions.openLogin();
      return homeThemePlayList(homeThemeSeededShuffle(src.songs, 'mix-' + Date.now()), 0, '今日混合电台');
    }
    if (item.kind === 'private') return playHomePrivateRadio();
    if (item.kind === 'songs-radio' && item.songs && item.songs.length) {
      return homeThemePlayList(homeThemeSeededShuffle(homeThemeFreshFirst(item.songs, 6), 'nsr-' + Date.now()), 0, item.title);
    }
    if (item.kind === 'platform-radio') return homeThemePlayPlatformRadio(item);
    if (item.kind === 'history') return homeThemePlayList(homeThemeSeededShuffle(homeThemeRecentSongs(40), 'echo-' + Date.now()), 0, '回声电台');
    if (item.kind === 'platform') return openHomeDashboardRadio();
    if (item.kind === 'playlist-radio' && item.playlist) {
      var pl = item.playlist;
      if (typeof showLoading === 'function') showLoading();
      return Promise.resolve(fetchPlaylistTracksPage(pl.provider, pl.id, { offset: 0, limit: 120 }, { timeoutMs: 16000 }))
        .then(function (r) {
          var tracks = (r && r.tracks) || [];
          if (!tracks.length) { if (typeof showToast === 'function') showToast('这张歌单暂时没有可播放的歌'); return; }
          homeThemePlayList(homeThemeSeededShuffle(tracks, 'plr-' + Date.now()), 0, pl.title + ' 电台');
        })
        .catch(function (e) { console.warn('[HomeTheme] playlist radio', e); if (typeof showToast === 'function') showToast('电台加载失败'); })
        .then(function () { if (typeof hideLoading === 'function') hideLoading(); });
    }
    return homeThemeActions.openRadio();
  },
  // 点正在播放的歌名 = 进入播放页（是否直接沉浸由「视觉」面板里的开关决定）
  openImmersive: function () {
    if (!homeThemeCurrentSong()) return homeThemeActions.resume();
    if (typeof nbEnterStage === 'function') { nbEnterStage('home-now-playing'); return; }
    try { if (typeof dismissHomePage === 'function') dismissHomePage({ reason: 'home-theme-immersive' }); else homeThemeLeaveHome(); } catch (_e) { homeThemeLeaveHome(); }
    if (typeof forcePlaybackControlsInteractive === 'function') forcePlaybackControlsInteractive();
    setTimeout(function () { if (typeof setImmersiveMode === 'function') setImmersiveMode(true); }, 60);
  },
  openDiscover: function () {
    if (homeThemeLoggedIn('netease')) return openHomeDashboardCharts();
    // 其他平台：打开"平台推荐"弹窗，停在第一个已登录的平台
    var firstSource = ['qq', 'kugou', 'qishui'].filter(homeThemeLoggedIn)[0];
    if (firstSource && typeof openHomePlatformRecommendations === 'function') return openHomePlatformRecommendations(firstSource);
    homeThemeCheckQQAccount();
    var rows = homeThemeData.qqPlaylists;
    if (rows.length) {
      var row = homeThemeSeededShuffle(rows, 'discover-' + Date.now())[0];
      homeThemeLeaveHome();
      if (typeof openPlaylistPanelTab === 'function') openPlaylistPanelTab('playlists', true);
      return loadPlaylistIntoQueueById('qq:' + row.id, true, row.name || 'QQ 歌单');
    }
    return homeThemeActions.openLogin();
  },
  openRadio: function () {
    // "更多电台 / 开始收听"：直接开第一个平台私人电台（猜你喜欢 / 漫游 / 私人 FM）
    var first = homeThemeRadioItems(homeThemeLoggedIn('netease'), homeThemeLoggedIn('qq')).filter(function (it) { return it.kind === 'platform-radio'; })[0];
    if (first) return homeThemePlayPlatformRadio(first);
    if (homeThemeLoggedIn('netease')) return openHomeDashboardRadio();
    homeThemeCheckQQAccount();
    if (homeThemeData.qqPool.length) return homeThemePlayList(homeThemeSeededShuffle(homeThemeData.qqPool, 'radio-' + Date.now()), 0, 'QQ 歌单电台');
    return homeThemeActions.openLogin();
  },
  search: function (q) { return runHomeSearch(q || ''); },
  openLogin: function () { return typeof showLoginModal === 'function' ? showLoginModal() : null; },
  importLocal: function () { return openHomeLocalImport(); },
  nextQuote: function () { homeDashboardNextReview(); homeThemeNotify(); },
  openSettings: function () { if (typeof openHomeThemeSettings === 'function') openHomeThemeSettings(); },
};

// 平台登录状态、推荐数据变化时刷新；QQ 登录时准备替代数据
(function hookHomeThemeData() {
  if (typeof renderHomeDashboard === 'function') {
    var originalRender = renderHomeDashboard;
    renderHomeDashboard = function () {
      var result = originalRender.apply(this, arguments);
      homeThemeNotify();
      homeThemeCheckQQAccount();
      if (homeThemeLoggedIn('qq') && !homeThemeData.qqPool.length && !homeThemeData.qqPoolLoading) homeThemeLoadQQPool(false);
      homeThemeCheckPlatformLogin();
      if (!homeThemeData.platformLoading && (!homeThemeData.platform || homeThemeData.platformDay !== homeThemeDayKey())) homeThemeLoadPlatformDiscover(false);
      return result;
    };
  }
  document.addEventListener('visibilitychange', homeThemeNotify);
})();
