// ============================================================
// Home themes · 数据层
// 把各平台（网易云 / QQ / 本地听歌记录）的数据整理成一份统一的"主页模型"，
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

// 每日推荐：网易云有就用网易云；只有 QQ 就用 QQ 歌单抽歌；都没有就用听歌记录 / 本地歌曲
function homeThemeDailySource() {
  var netease = homeDiscoverState && Array.isArray(homeDiscoverState.songs) ? homeDiscoverState.songs : [];
  if (netease.length) return { songs: netease, label: '网易云 · 每日推荐', kind: 'netease-daily' };
  if (homeThemeData.qqPool.length) return { songs: homeThemeData.qqPool.slice(0, 30), label: '今日精选 · 来自你的 QQ 歌单', kind: 'qq-pool' };
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
function homeThemeDiscoverItems(neteaseIn, qqIn) {
  var rows = [];
  if (neteaseIn && homeDiscoverState && Array.isArray(homeDiscoverState.playlists)) {
    rows = homeDiscoverState.playlists.slice(0, 16).map(function (pl) { return homeThemePlaylistItem(pl, '网易云推荐'); });
  }
  if (!rows.length && qqIn) {
    // QQ 没有推荐歌单接口：按日期从你的 QQ 歌单里挑几张来"重温"
    rows = homeThemeSeededShuffle(homeThemeData.qqPlaylists || [], 'discover-' + homeThemeDayKey()).slice(0, 12).map(function (pl) {
      var it = homeThemePlaylistItem(Object.assign({ provider: 'qq' }, pl), '重温 · QQ 歌单');
      if (it) it.sub = '重温 · ' + (it.count ? it.count + ' 首' : 'QQ 歌单');
      return it;
    });
  }
  return rows.filter(Boolean);
}
function homeThemeRadioItems(neteaseIn, qqIn) {
  var items = [];
  var daily = homeThemeDailySource();
  if (daily.songs.length) items.push({ kind: 'mix', key: 'radio:mix', title: '今日混合电台', sub: '把今天的推荐打乱了放 · ' + daily.label });
  if (neteaseIn) items.push({ kind: 'private', key: 'radio:private', title: '私人雷达', sub: '网易云 · 按你的口味连续播放' });
  var recent = homeThemeRecentSongs(40);
  if (recent.length > 3) items.push({ kind: 'history', key: 'radio:history', title: '回声电台', sub: '从你最近听过的 ' + recent.length + ' 首里随机播' });
  // 每张歌单都可以当一个随机电台
  var pls = homeThemeLibraryItems().filter(function (it) { return it.provider === 'netease' || it.provider === 'qq'; });
  pls.slice(0, 9).forEach(function (it) {
    items.push({ kind: 'playlist-radio', key: 'radio:pl:' + it.key, title: it.title + ' 电台', sub: '随机播放 · ' + (it.providerLabel || '') + (it.count ? ' · ' + it.count + ' 首' : ''), playlist: it });
  });
  if (neteaseIn || qqIn) items.push({ kind: 'platform', key: 'radio:platform', title: '平台推荐', sub: '打开各平台可验证的推荐内容' });
  return items.slice(0, 14);
}

function buildHomeThemeModel() {
  try { homeThemeCheckQQAccount(); } catch (_e) { }
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
  var picks = homeThemeSeededShuffle(daily.songs, 'picks-' + homeThemeDayKey() + '-' + (typeof homeDashboardReviewOffset === 'number' ? homeDashboardReviewOffset : 0))
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
    lyricsOn: !!(typeof fx === 'object' && fx && fx.particleLyrics),
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
    discover: neteaseIn
      ? { label: '发现', sub: '网易云 · 推荐歌单与热门', available: true }
      : (qqIn ? { label: '发现', sub: '重温一张你的 QQ 歌单', available: !!homeThemeData.qqPlaylists.length } : { label: '发现', sub: '登录后可用', available: false }),
    radio: neteaseIn
      ? { label: '电台', sub: '网易云 · 推荐电台 / 歌单', available: true }
      : (qqIn ? { label: '电台', sub: 'QQ 歌单随机电台', available: !!homeThemeData.qqPool.length } : { label: '电台', sub: '登录后可用', available: false }),
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
    loading: !!(homeDiscoverState && homeDiscoverState.loading) || homeThemeData.qqPoolLoading,
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
  toggleLyrics: function () { toggleLyricsPanel(); homeThemeNotify(); },
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
    return homeThemePlayList(src.songs, index || 0, src.kind === 'qq-pool' ? '今日精选 · QQ' : '今日精选');
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
    if (!item || !item.id) return;
    var id = typeof playlistPanelProviderId === 'function' ? playlistPanelProviderId(item.provider, item.id) : item.id;
    homeThemeLeaveHome();
    return Promise.resolve(loadPlaylistIntoQueueById(id, true, item.title || '')).catch(function (e) { console.warn('[HomeTheme] playlist', e); });
  },
  // 在软件自己的歌单面板里打开这张歌单的曲目
  openPlaylist: function (item) {
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
      return result;
    };
  }
  document.addEventListener('visibilitychange', homeThemeNotify);
})();
