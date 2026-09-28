// ============================================================
// [二改] 主页歌词位：四个主页主题"每日一句"那个位置，放歌时换成此刻这句歌词
//   主题每 100ms 调一次 homeThemeLyric(opts)，返回：
//     null                          → 功能关着（「视觉」里关掉 / 桌面背景模式），主题照旧显示每日一句
//     { state:'none' }              → 没在放歌、没歌词、纯音乐
//     { state:'intro' }             → 前奏、间奏太长、作词作曲那几行
//     { state:'line'|'paused', text, translation, key, idx, total }
//   opts.lead：提前多少秒把下一句换上（各主题按自己的过渡动画长短传，让新句开唱时已经显示好）
//   开关存在 localStorage：notblind-home-lyric-v1（'0' = 关，默认开）；「视觉 › 播放」和各主题主页上的「词」按钮都改它。
//   [二改 2026-09-28] 窗口和桌面背景用同一个开关（用户要求）：原来桌面背景另有一个开关
//   notblind-home-lyric-desktop-v1（默认不显示），现在不再单独看它，两个旧函数名留着、都转到这一个开关。
// ============================================================
var NB_HOME_LYRIC_KEY = 'notblind-home-lyric-v1';
var NB_HOME_LYRIC_DESKTOP_KEY = 'notblind-home-lyric-desktop-v1';
function nbHomeLyricPref() {
  try { return localStorage.getItem(NB_HOME_LYRIC_KEY) !== '0'; } catch (_) { return true; }
}
function nbSetHomeLyricPref(on) {
  try { localStorage.setItem(NB_HOME_LYRIC_KEY, on ? '1' : '0'); } catch (_) { }
  if (typeof showToast === 'function') showToast(on ? '主页歌词：开 · 放歌时显示此刻这句（窗口和桌面背景都是）' : '主页歌词：关 · 只显示每日一句');
}
// 旧的"桌面背景单独开关"：现在和上面是同一个
function nbHomeLyricDesktopPref() { return nbHomeLyricPref(); }
function nbSetHomeLyricDesktopPref(on) { nbSetHomeLyricPref(on); }
var NB_HOME_LYRIC_CREDIT = /^\s*(作词|作曲|编曲|词|曲|制作人|制作|监制|混音|母带|和声|和音|吉他|贝斯|鼓|键盘|弦乐|录音|录音室|出品|发行|企划|策划|统筹|演唱|原唱|OP|SP|Lyrics?|Music|Composer|Arranger|Producer)\s*[:：]/i;
function homeThemeLyric(opts) {
  var lead = opts && opts.lead > 0 ? Math.min(1.5, Number(opts.lead)) : 0;
  if (!nbHomeLyricPref()) return null;
  var a = typeof audio !== 'undefined' ? audio : null;
  if (!a || !a.src || a.ended) return { state: 'none' };
  var lines = typeof lyricsLines !== 'undefined' ? lyricsLines : null;
  if (!lines || !lines.length) return { state: 'none' };
  try { if (typeof lyricsAreFallbackTitleOnly === 'function' && lyricsAreFallbackTitleOnly(lines)) return { state: 'none' }; } catch (_) { }
  var t = 0;
  try {
    t = typeof stageLyricPlaybackSeconds === 'function' ? stageLyricPlaybackSeconds() : (Number(a.currentTime) || 0);
    if (typeof getAdjustedLyricPlaybackTime === 'function') t = getAdjustedLyricPlaybackTime(t);
  } catch (_) { t = Number(a.currentTime) || 0; }
  var idx = -1;
  try {
    if (typeof findStageLyricIndexAtTime === 'function') idx = findStageLyricIndexAtTime(t);
    else { for (var i = 0; i < lines.length; i++) { if ((Number(lines[i].t) || 0) <= t + 0.05) idx = i; else break; } }
  } catch (_) { idx = -1; }
  // 提前量：正在放（不是暂停）且下一句马上要开唱，就先把下一句换上
  if (lead && !a.paused) {
    var nx = lines[idx + 1];
    if (nx && String(nx.text || '').trim()) { var dn = (Number(nx.t) || 0) - t; if (dn > 0 && dn <= lead) { idx = idx + 1; t = Number(nx.t) || t; } }
  }
  if (idx < 0) return { state: 'intro' };
  var L = lines[idx] || {};
  var text = String(L.text || '').replace(/\s+/g, ' ').trim();
  if (!text || L.fallback) return { state: 'intro' };
  try { if (typeof isNoLyricText === 'function' && isNoLyricText(text)) return { state: 'none' }; } catch (_) { }
  if (NB_HOME_LYRIC_CREDIT.test(text)) return { state: 'intro' };
  try { if (typeof isLyricCreditLineText === 'function' && isLyricCreditLineText(text)) return { state: 'intro' }; } catch (_) { }
  // 这一句唱完很久还没有下一句（长间奏）：先回到每日一句
  var dur = Number(L.duration) || 0;
  if (dur > 0 && t > (Number(L.t) || 0) + dur + 6) return { state: 'intro' };
  var tr = String(L.translation || '').replace(/\s+/g, ' ').trim();
  if (tr === text) tr = '';
  return { state: a.paused ? 'paused' : 'line', text: text, translation: tr, key: idx + '|' + text, idx: idx, total: lines.length };
}
