'use strict';

// 推荐 / 发现 / 电台：用平台真实推荐，不拿用户自己的歌单充数
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const kugouSource = fs.readFileSync(path.join(root, 'kugou-api.js'), 'utf8');
const modelSource = fs.readFileSync(path.join(root, 'public', 'js', 'modules', '12-home-themes', '00-home-model.js'), 'utf8');

function namedFunctionSource(text, name) {
  const declaration = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(text);
  if (!declaration) return '';
  const bodyStart = text.indexOf('{', declaration.index + declaration[0].length);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let regex = false;
  for (let index = bodyStart; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (regex) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '/') regex = false;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; continue; }
    if (character === '/' && /[(,=:!&|?{};\s]/.test(text[index - 1] || '') && text[index + 1] !== '/' && text[index + 1] !== '*') { regex = true; continue; }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(declaration.index, index + 1);
    }
  }
  return '';
}

test('server exposes multi-platform discover and radio routes', () => {
  assert.match(serverSource, /pn === '\/api\/discover\/platforms'/);
  assert.match(serverSource, /pn === '\/api\/radio\/tracks'/);
  assert.match(serverSource, /pn === '\/api\/qq\/recommendations'/);
  const platform = namedFunctionSource(serverSource, 'handlePlatformDiscover');
  for (const name of ['handleQQDiscover', 'handleNeteaseDiscoverExtras', 'handleKugouDiscoverBundle', 'handleQishuiDiscoverBundle']) {
    assert.match(platform, new RegExp(name));
  }
  // 平台推荐里不能拿搜索结果补位
  assert.doesNotMatch(namedFunctionSource(serverSource, 'handleQQDiscover'), /search/i);
  // 汽水推荐流退回"你的喜欢 / 最近播放"时，不算发现
  assert.match(namedFunctionSource(serverSource, 'handleQishuiDiscoverBundle'), /!feed\.fallback/);
});

test('QQ radio drops spoken intro clips and keeps real songs', () => {
  const fn = vm.runInNewContext(`(${namedFunctionSource(serverSource, 'isQQRadioTalkTrack')})`);
  assert.equal(fn({ name: '《像风一样自由》许巍：我像风一样自由' }), true);
  assert.equal(fn({ name: '【抖音】《谢谢你给我的》：谢谢你给我的，不是说说而已' }), true);
  assert.equal(fn({ name: '带你去旅行' }), false);
  assert.equal(fn({ name: '若月亮没来 (若是月亮还没来)' }), false);
});

test('QQ toplists and new songs are virtual playlists that reuse the playlist pipeline', () => {
  const tracks = namedFunctionSource(serverSource, 'handleQQPlaylistTracks');
  assert.match(tracks, /QQ_TOPLIST_ID_PREFIX\) === 0\) return handleQQToplistTracks/);
  assert.match(tracks, /QQ_NEWSONG_ID_PREFIX\) === 0\) return handleQQNewSongTracks/);
  const summary = vm.runInNewContext(`(${namedFunctionSource(serverSource, 'mapQQToplistSummary')})`, { QQ_TOPLIST_ID_PREFIX: 'top_' });
  const top = summary({ topId: 62, title: '飙升榜', period: '2026-09-28', totalNum: 100, frontPicUrl: 'http://y.gtimg.cn/a.jpg', song: [{ title: '大梦归', singerName: '周深' }] });
  assert.equal(top.id, 'top_62');
  assert.equal(top.provider, 'qq');
  assert.deepEqual(Array.from(top.preview), ['大梦归 - 周深']);
});

test('Kugou rank ids route to the public rank endpoint without login', () => {
  const start = kugouSource.indexOf('async function handleKugouPlaylistTracks(');
  const tracks = kugouSource.slice(start, start + 800);
  const routeAt = tracks.indexOf('return handleKugouRankTracks');
  const authAt = tracks.indexOf('extractKugouAuth');
  assert.ok(routeAt > 0 && routeAt < authAt, 'rank routing must happen before the login check');
});

function loadModel(options) {
  const logins = Object.assign({ qq: true, netease: false, kugou: false, qishui: false }, options.logins || {});
  const ctx = {
    console, Date, Math, JSON, Object, Array, String, Number, Promise,
    setTimeout: () => 0, clearTimeout() {},
    document: { addEventListener() {} },
    hasPlatformLogin: p => !!logins[p],
    hasAnyPlatformLogin: () => Object.values(logins).some(Boolean),
    qqLoginStatus: { userId: '10001' },
    homeDiscoverState: { songs: [], playlists: [] },
    userPlaylists: options.userPlaylists || [],
    listenStatsState: { history: options.history || [] },
    songFromListenRecord: r => r,
    isSongLiked: s => !!(s && options.liked && options.liked.indexOf(s.mid) >= 0),
    playQueue: [], currentIdx: 0, playing: false,
    apiJson: async () => ({}),
    homeDashboardTodayListenMetrics: () => ({}),
    homeDashboardSelectedReview: () => ({ text: '' }),
    getPlaybackDurationSeconds: () => 0,
    getPlaybackCurrentSeconds: () => 0,
  };
  vm.createContext(ctx);
  vm.runInContext(modelSource + '\n;this.__h = { homeThemeData, buildHomeThemeModel, homeThemeCheckPlatformLogin };', ctx);
  const h = ctx.__h;
  h.homeThemeData.qqUser = '10001';
  h.homeThemeCheckPlatformLogin();
  h.homeThemeData.platform = options.platform;
  h.homeThemeData.platformDay = 'today';
  h.homeThemeData.qqPool = options.qqPool || [];
  return h.buildHomeThemeModel();
}

function qqSong(mid, name) {
  return { provider: 'qq', mid, id: mid, name, artist: '歌手' + mid, artists: [{ name: '歌手' + mid }] };
}

const QQ_BUNDLE = {
  provider: 'qq',
  daily: { mode: 'guess+radar', label: 'QQ 音乐 · 猜你喜欢 + 雷达推荐', songs: [qqSong('A', '新歌A'), qqSong('MINE', '我歌单里的'), qqSong('B', '新歌B'), qqSong('LIKED', '我喜欢的')] },
  newSongs: [qqSong('N1', '首发1')],
  toplists: [{ provider: 'qq', id: 'top_62', name: '飙升榜', period: '2026-09-28' }],
  playlists: [{ provider: 'qq', id: '555', name: '我自己收藏过的' }, { provider: 'qq', id: '777', name: '平台推荐歌单', trackCount: 50 }],
  radios: [{ provider: 'qq', id: '99', name: '猜你喜欢', personal: true }, { provider: 'qq', id: '136', name: '忧伤', group: '心情' }],
};

test('daily recommendations come from the platform and push already-known songs to the end', () => {
  const m = loadModel({
    platform: { qq: QQ_BUNDLE },
    qqPool: [qqSong('MINE', '我歌单里的')],
    liked: ['LIKED'],
  });
  assert.equal(m.daily.label, 'QQ 音乐 · 猜你喜欢 + 雷达推荐');
  const titles = Array.from(m.daily.songs, t => t.title);
  assert.deepEqual(titles.slice(0, 2), ['新歌A', '新歌B']);
  assert.ok(titles.indexOf('我歌单里的') >= 2 && titles.indexOf('我喜欢的') >= 2);
});

test('discover shows platform charts, new songs and recommendations but not the user’s own playlists', () => {
  const m = loadModel({ platform: { qq: QQ_BUNDLE }, userPlaylists: [{ provider: 'qq', id: '555', name: '我自己收藏过的' }] });
  const keys = m.discover.items.map(it => it.key);
  assert.ok(keys.includes('qq:newsong_5'));
  assert.ok(keys.includes('qq:top_62'));
  assert.ok(keys.includes('qq:777'));
  assert.ok(!keys.includes('qq:555'));
});

test('radio lists platform radios first and no longer turns every user playlist into a radio', () => {
  const m = loadModel({ platform: { qq: QQ_BUNDLE }, userPlaylists: [{ provider: 'qq', id: '555', name: '我的歌单', trackCount: 40 }] });
  const items = m.radio.items;
  assert.equal(items[0].kind, 'platform-radio');
  assert.equal(items[0].title, '猜你喜欢');
  assert.ok(items.some(it => it.kind === 'platform-radio' && it.title === '忧伤'));
  assert.ok(!items.some(it => it.kind === 'playlist-radio'));
});

test('several logged-in platforms are merged instead of one replacing the others', () => {
  const kugou = {
    provider: 'kugou',
    daily: { mode: 'guess', label: '酷狗 · 猜你喜欢', songs: [{ provider: 'kugou', hash: 'K1', id: 'K1', name: '酷狗推荐1', artist: 'x' }] },
    toplists: [{ provider: 'kugou', id: 'rank_6666', name: '飙升榜' }],
    radios: [{ provider: 'kugou', id: 'guess', name: '酷狗猜你喜欢', personal: true }],
  };
  const m = loadModel({ logins: { kugou: true }, platform: { qq: QQ_BUNDLE, kugou } });
  assert.ok(m.daily.songs.some(t => t.provider === 'kugou'));
  assert.ok(m.daily.songs.some(t => t.provider === 'qq'));
  assert.ok(m.discover.items.some(it => it.key === 'kugou:rank_6666'));
  assert.ok(m.radio.items.some(it => it.provider === 'kugou' && it.kind === 'platform-radio'));
});
