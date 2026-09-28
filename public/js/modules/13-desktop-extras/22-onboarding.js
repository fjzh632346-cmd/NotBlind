;
// ============================================================
// [二改 2026-09-28] 新手引导「化整为零」+ 反馈邀请
//   1. 第一次打开：不再直接放 9 页的完整引导，只出一张欢迎页，几行字说清楚
//      「是什么 / 为什么有它 / 收不收费 / 数据去哪」，按钮：开始 · 看完整引导 · 登录音乐平台
//   2. 之后走到哪里讲哪里（每条只出现一次）：第一次在主页、第一次放歌、第一次进播放页、
//      第一次开「设置」「视觉」、第一次滑出左边歌单……同一套小卡片样式，位置按当前主题找对应的元素
//   3. 用了一段时间（装了 ≥3 天、打开 ≥4 次、听歌 ≥90 分钟）后，某次打开时诚恳地请用户写几句反馈
//      「下次再说」三周后再问，最多问 3 次；「不用再问了」就永远不问；发过反馈之后 90 天内不问
//   完整引导还在：设置 › 常用 › 使用引导
// ============================================================
(function () {
  if (window.__nbOnboard) return;
  window.__nbOnboard = true;

  var HOT = '#ff4a1c';
  var HEAVY = '"Source Han Sans SC Heavy","思源黑体 Heavy","Noto Sans SC Black","Noto Sans CJK SC","Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif';
  var UI = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  var THIN = '"Segoe UI Light","Segoe UI","Microsoft YaHei UI Light","Microsoft YaHei UI",sans-serif';
  var MONO = '"Cascadia Mono",Consolas,"Microsoft YaHei UI",monospace';

  var K_ONB = 'notblind-onboard-v1';     // { welcome: 1, tips: { key: 1 }, off: 0, welcomeAt: ts }
  var K_USE = 'notblind-usage-v1';       // { first, launches, playSec, lastAsk, asks, never, sentAt }

  function load(k) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (_e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_e) { } }
  function has(c) { return !!(document.body && document.body.classList.contains(c)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function g(name) { try { return window[name]; } catch (_e) { return undefined; } }
  function isPlaying() { try { return typeof playing !== 'undefined' && !!playing; } catch (_e) { return false; } }
  function hasTrack() { try { return typeof currentIdx !== 'undefined' && currentIdx >= 0; } catch (_e) { return false; } }
  function isImmersive() { try { return typeof immersiveMode !== 'undefined' && !!immersiveMode; } catch (_e) { return false; } }
  function guideOn() { try { return typeof visualGuideActive !== 'undefined' && !!visualGuideActive; } catch (_e) { return false; } }
  function sheet(n) { try { return typeof nbSheetState === 'object' && !!nbSheetState[n]; } catch (_e) { return false; } }
  function host() { try { return typeof homeThemeHost === 'object' ? homeThemeHost : null; } catch (_e) { return null; } }
  function homeOn() { var h = host(); return has('empty-home-active') && !!(h && h.visible && h.root); }
  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function shell() { return document.getElementById('desktop-window-shell') || document.body; }

  // ---------- 状态 ----------
  var ONB = load(K_ONB);
  var firstRunOfThis = !ONB;
  if (!ONB) {
    ONB = { welcome: 0, tips: {}, off: 0 };
    // 已经看过 3.0 完整引导的老用户：不再出欢迎页和小提示
    var sawGuide = false;
    try { sawGuide = localStorage.getItem(typeof VISUAL_GUIDE_SEEN_STORE_KEY !== 'undefined' ? VISUAL_GUIDE_SEEN_STORE_KEY : 'mineradio-visual-guide-seen-v4') === '1'; } catch (_e) { }
    if (sawGuide) { ONB.welcome = 1; ONB.off = 1; ONB.legacy = 1; }
    save(K_ONB, ONB);
  }
  ONB.tips = ONB.tips || {};

  var USE = load(K_USE) || { first: Date.now(), launches: 0, playSec: 0, lastAsk: 0, asks: 0, never: 0, sentAt: 0 };
  USE.launches = (USE.launches | 0) + 1;
  save(K_USE, USE);
  // 听歌时间：每 30 秒记一次
  setInterval(function () {
    if (!isPlaying()) return;
    USE.playSec = (USE.playSec | 0) + 30;
    save(K_USE, USE);
  }, 30000);
  window.addEventListener('nb-feedback-sent', function () { USE.sentAt = Date.now(); USE.lastAsk = Date.now(); save(K_USE, USE); });

  // ============================================================
  // 样式（欢迎页 / 小提示 / 反馈邀请 一套）
  // ============================================================
  var CSS = [
    // ---- 欢迎页 ----
    '#nb-welcome{position:fixed;inset:0;z-index:2147482600;display:none;color:#dfe3dc;font-family:' + UI + ';-webkit-font-smoothing:antialiased;-webkit-app-region:no-drag;--ink:#dfe3dc;--ink2:rgba(223,227,220,.7);--ink3:rgba(223,227,220,.42);--ink4:rgba(223,227,220,.14);--hot:' + HOT + '}',
    '#nb-welcome.on{display:block;animation:nbw-in .6s ease both}',
    '#nb-welcome.out{animation:nbw-out .42s ease both}',
    '@keyframes nbw-in{from{opacity:0}to{opacity:1}}@keyframes nbw-out{to{opacity:0}}',
    '#nb-welcome .bg{position:absolute;inset:0;background:rgba(20,18,17,.955)}',
    '#nb-welcome svg.hz{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}',
    '#nb-welcome .hz-l{stroke:rgba(223,227,220,.42);stroke-width:1.2;fill:none;stroke-dasharray:3000;stroke-dashoffset:3000;animation:nbw-draw 1.6s .15s cubic-bezier(.3,.7,.2,1) forwards}',
    '#nb-welcome .hz-r{stroke:rgba(223,227,220,.5);stroke-width:1.2;fill:rgba(20,18,17,.6);opacity:0;animation:nbw-fade .8s .9s ease forwards}',
    '#nb-welcome .hz-r2{stroke:rgba(223,227,220,.2);stroke-width:1;fill:none;opacity:0;animation:nbw-fade .8s 1.05s ease forwards}',
    '#nb-welcome .hz-d{fill:var(--hot);filter:drop-shadow(0 0 6px rgba(255,74,28,.8));opacity:0;animation:nbw-fade .6s 1.2s ease forwards}',
    '#nb-welcome .hz-orb{transform-box:view-box;animation:nbw-spin 14s linear infinite}',
    '@keyframes nbw-draw{to{stroke-dashoffset:0}}@keyframes nbw-fade{to{opacity:1}}@keyframes nbw-spin{to{transform:rotate(360deg)}}',
    '#nb-welcome .col{position:absolute;left:clamp(40px,9vw,140px);top:50%;transform:translateY(-54%);width:min(560px,calc(100vw - 80px));display:flex;flex-direction:column;gap:0}',
    '#nb-welcome .col>*{opacity:0;transform:translateY(8px);animation:nbw-up .6s cubic-bezier(.2,.8,.2,1) forwards}',
    '@keyframes nbw-up{to{opacity:1;transform:none}}',
    '#nb-welcome .kick{font:11px/1 ' + MONO + ';letter-spacing:.2em;color:var(--ink3);display:flex;align-items:center;gap:9px;animation-delay:.2s}',
    '#nb-welcome .kick i{width:6px;height:6px;border-radius:50%;background:var(--hot);box-shadow:0 0 10px var(--hot)}',
    '#nb-welcome h1{margin:18px 0 6px;font:900 44px/1.12 ' + HEAVY + ';letter-spacing:.02em;color:var(--ink);animation-delay:.3s}',
    '#nb-welcome .brand{font:300 15px/1 ' + THIN + ';letter-spacing:.18em;color:var(--ink3);margin-bottom:26px;animation-delay:.36s}',
    '#nb-welcome dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:0 22px;animation-delay:.45s}',
    '#nb-welcome dt{font:11px/2.3 ' + MONO + ';letter-spacing:.14em;color:var(--hot);white-space:nowrap;padding:8px 0;border-top:1px solid var(--ink4)}',
    '#nb-welcome dd{margin:0;font:13.5px/1.8 ' + UI + ';color:var(--ink2);padding:8px 0;border-top:1px solid var(--ink4)}',
    '#nb-welcome dd b{font-weight:400;color:var(--ink)}',
    '#nb-welcome .later{margin:18px 0 0;font-size:12.5px;line-height:1.7;color:var(--ink3);animation-delay:.55s}',
    '#nb-welcome .act{display:flex;align-items:center;gap:26px;margin-top:26px;animation-delay:.62s}',
    '#nb-welcome .act button{border:0;background:transparent;padding:7px 0;font:13px/1 ' + UI + ';letter-spacing:.06em;color:var(--ink2);cursor:pointer;position:relative;transition:color .2s}',
    '#nb-welcome .act button:hover{color:var(--ink)}',
    '#nb-welcome .act .go{font-size:15px;color:var(--ink)}',
    '#nb-welcome .act .go::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1.5px;background:var(--hot);transform-origin:left;transition:transform .3s}',
    '#nb-welcome .act .go:hover::after{transform:scaleX(1.15)}',
    '#nb-welcome .credit{margin-top:30px;padding-top:12px;border-top:1px solid var(--ink4);font:11.5px/1.8 ' + UI + ';letter-spacing:.02em;color:var(--ink3);animation-delay:.7s}',
    '#nb-welcome .credit b{font-weight:400;color:var(--ink2)}',
    '#nb-welcome .act .sep{width:1px;height:12px;background:var(--ink4)}',
    '#nb-welcome button:focus-visible{outline:1.5px solid var(--hot);outline-offset:4px}',
    '@media (max-height:640px){#nb-welcome h1{font-size:34px;margin-top:12px}#nb-welcome .brand{margin-bottom:14px}#nb-welcome dd,#nb-welcome dt{padding:5px 0}}',

    // ---- 小提示 ----
    '#nb-tip-ring{position:fixed;z-index:2147482400;pointer-events:none;border-radius:12px;border:1.5px solid ' + HOT + ';box-shadow:0 0 0 1px rgba(20,18,17,.55),0 0 0 6px rgba(255,74,28,.10),0 0 22px rgba(255,74,28,.28);opacity:0;transform:scale(1.04);transition:opacity .3s,transform .45s cubic-bezier(.2,1.2,.3,1),left .25s,top .25s,width .25s,height .25s}',
    '#nb-tip-ring.on{opacity:1;transform:none;animation:nbt-breathe 2.4s ease-in-out infinite}',
    '@keyframes nbt-breathe{50%{box-shadow:0 0 0 1px rgba(20,18,17,.55),0 0 0 10px rgba(255,74,28,.04),0 0 30px rgba(255,74,28,.34)}}',
    '#nb-tip-lead{position:fixed;inset:0;width:100%;height:100%;z-index:2147482400;pointer-events:none;opacity:0;transition:opacity .3s}',
    '#nb-tip-lead.on{opacity:1}',
    '#nb-tip-lead path{stroke:rgba(255,74,28,.75);stroke-width:1.2;fill:none;stroke-dasharray:3 4}',
    '#nb-tip-lead circle{fill:' + HOT + '}',
    '#nb-tip{position:fixed;z-index:2147482500;width:292px;box-sizing:border-box;padding:15px 17px 12px;background:#161413;color:#dfe3dc;border:1px solid rgba(223,227,220,.16);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.5);font:13px/1.75 ' + UI + ';-webkit-font-smoothing:antialiased;-webkit-app-region:no-drag;opacity:0;visibility:hidden;transform:translateY(6px);pointer-events:none;transition:opacity .28s,transform .38s cubic-bezier(.2,1.1,.3,1),visibility 0s linear .38s}',
    '#nb-tip.on{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity .28s,transform .38s cubic-bezier(.2,1.1,.3,1),visibility 0s}',
    '#nb-tip .k{display:flex;align-items:center;gap:8px;font:10.5px/1 ' + MONO + ';letter-spacing:.18em;color:rgba(223,227,220,.45);margin-bottom:8px}',
    '#nb-tip .k i{width:5px;height:5px;border-radius:50%;background:' + HOT + ';box-shadow:0 0 8px ' + HOT + '}',
    '#nb-tip .t{font:900 15.5px/1.35 ' + HEAVY + ';letter-spacing:.02em;margin-bottom:4px}',
    '#nb-tip .b{color:rgba(223,227,220,.72)}',
    '#nb-tip .b kbd{display:inline-block;min-width:18px;padding:0 5px;margin:0 1px;border:1px solid rgba(223,227,220,.35);border-bottom-width:2px;border-radius:4px;font:11px/17px ' + MONO + ';text-align:center;color:#dfe3dc}',
    '#nb-tip .b em{font-style:normal;color:#dfe3dc}',
    '#nb-tip .a{display:flex;align-items:center;gap:16px;margin-top:10px}',
    '#nb-tip .a button{border:0;background:transparent;padding:4px 0;font:12px/1 ' + UI + ';color:rgba(223,227,220,.5);cursor:pointer;transition:color .2s}',
    '#nb-tip .a button:hover{color:#dfe3dc}',
    '#nb-tip .a .ok{color:#dfe3dc;border-bottom:1.5px solid ' + HOT + '}',
    '#nb-tip .a .off{margin-left:auto;font-size:11px}',
    '#nb-tip .tm{position:absolute;left:16px;right:16px;bottom:0;height:1.5px;background:rgba(255,74,28,.55);transform-origin:left;transform:scaleX(0)}',
    '#nb-tip.on .tm{animation:nbt-tm var(--dur,14s) linear forwards}',
    '#nb-tip:hover .tm{animation-play-state:paused}',
    '@keyframes nbt-tm{from{transform:scaleX(1)}to{transform:scaleX(0)}}',

    // ---- 反馈邀请 ----
    '#nb-ask{position:fixed;inset:0;z-index:8990;display:grid;place-items:center;background:rgba(8,7,7,.5);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .3s,visibility 0s linear .3s;-webkit-app-region:no-drag}',
    // [二改][窗口拖动] 同反馈遮罩：只透明不藏的话，铺满全窗口的"不可拖动区"一直在，标题栏拖不动窗口
    '#nb-ask.on{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .3s,visibility 0s}',
    '#nb-ask .box{position:relative;width:min(470px,calc(100vw - 48px));box-sizing:border-box;padding:28px 30px 22px;background:#171514;color:#dfe3dc;border:1px solid rgba(223,227,220,.14);border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.55);font:13.5px/1.85 ' + UI + ';transform:translateY(12px) scale(.985);transition:transform .45s cubic-bezier(.2,1.1,.3,1);overflow:hidden}',
    '#nb-ask.on .box{transform:none}',
    '#nb-ask .box::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,' + HOT + ',rgba(255,74,28,0))}',
    '#nb-ask .k{display:flex;align-items:center;gap:8px;font:10.5px/1 ' + MONO + ';letter-spacing:.18em;color:rgba(223,227,220,.42)}',
    '#nb-ask .k i{width:6px;height:6px;border-radius:50%;background:' + HOT + ';box-shadow:0 0 10px ' + HOT + '}',
    '#nb-ask h3{margin:14px 0 12px;font:900 22px/1.3 ' + HEAVY + ';letter-spacing:.02em}',
    '#nb-ask p{margin:0 0 10px;color:rgba(223,227,220,.74)}',
    '#nb-ask p b{font-weight:400;color:#dfe3dc}',
    '#nb-ask .a{display:flex;align-items:center;gap:10px;margin-top:20px}',
    '#nb-ask .a button{border:1px solid rgba(223,227,220,.2);background:none;color:#dfe3dc;border-radius:8px;padding:8px 18px;font:13px/1 ' + UI + ';cursor:pointer;transition:background .15s,border-color .15s,color .15s}',
    '#nb-ask .a button:hover{border-color:rgba(223,227,220,.45)}',
    '#nb-ask .a .go{background:' + HOT + ';border-color:' + HOT + ';color:#fff}',
    '#nb-ask .a .go:hover{background:#ff5f36}',
    '#nb-ask .a .never{margin-left:auto;border:0;padding:8px 0;color:rgba(223,227,220,.4);font-size:12px}',
    '#nb-ask .a .never:hover{color:rgba(223,227,220,.75)}',
    '@media (prefers-reduced-motion:reduce){#nb-welcome *,#nb-welcome,#nb-tip,#nb-tip-ring,#nb-ask .box{animation:none!important;transition:none!important}#nb-welcome .col>*{opacity:1;transform:none}#nb-welcome .hz-l{stroke-dashoffset:0}#nb-welcome .hz-r,#nb-welcome .hz-r2,#nb-welcome .hz-d{opacity:1}}'
  ].join('\n');
  function ensureStyle() {
    if (document.getElementById('nb-onboard-style')) return;
    var st = document.createElement('style'); st.id = 'nb-onboard-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // 键盘：欢迎页 / 邀请开着时，按键别漏给播放器
  function trapKeys(el, onEsc, onEnter) {
    function h(e) {
      if (!el.classList.contains('on')) return;
      if (e.key === 'Tab') return;
      if (e.key === 'Escape') { e.preventDefault(); onEsc(); }
      else if (e.key === 'Enter' && onEnter && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); onEnter(); }
      e.stopImmediatePropagation();
    }
    window.addEventListener('keydown', h, true);
  }

  // ============================================================
  // 1. 欢迎页
  // ============================================================
  var W = { el: null, pending: false, closedAt: 0 };
  function welcomeOpen() { return !!(W.el && W.el.classList.contains('on')); }
  function buildWelcome() {
    if (W.el) return W.el;
    ensureStyle();
    var el = document.createElement('div');
    el.id = 'nb-welcome';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '欢迎使用 Not Blind');
    el.innerHTML =
      '<div class="bg"></div>' +
      '<svg class="hz" aria-hidden="true"><path class="hz-l"/><circle class="hz-r2"/><circle class="hz-r"/><g class="hz-orb"><circle class="hz-d" r="3.6"/></g></svg>' +
      '<div class="col">' +
        '<div class="kick"><i></i><span>WELCOME · 第一次见面</span></div>' +
        '<h1>让听到的，<br>也能被看见。</h1>' +
        '<div class="brand">Not Blind</div>' +
        '<dl>' +
          '<dt>是什么</dt><dd>一个 Windows 桌面音乐播放器。搜歌、放歌、看歌词，封面、歌词和画面会<b>跟着音乐一起动</b>；还能铺成桌面背景。</dd>' +
          '<dt>为什么</dt><dd>大多数播放器只是一张歌曲列表。它接着已经停更的开源播放器 Mineradio 做下去，想让「听歌」这件事也<b>好看一点、安静一点</b>。</dd>' +
          '<dt>收费吗</dt><dd><b>免费，开源（GPL-3.0），没有广告。</b>不登录也能搜歌播放；登录网易云、QQ 音乐等平台能同步歌单，VIP 歌曲仍需要对应平台的会员。</dd>' +
          '<dt>数据呢</dt><dd>设置和登录都只存在你的电脑上。只有你主动点「反馈」时，才会发东西给作者。</dd>' +
        '</dl>' +
        '<p class="later">各个地方怎么用，不用现在记——等你第一次走到那里，它会轻轻提一句。</p>' +
        '<div class="act"><button type="button" class="go">开始听歌 →</button><i class="sep"></i><button type="button" class="full">看完整引导</button><button type="button" class="login">登录音乐平台</button></div>' +
        '<div class="credit">Not Blind 是开源播放器 <b>Mineradio</b>（原作者 XxHuberrr，GPL-3.0）的二次创作版本，<br>由 fjzh632346-cmd 维护，与原作者无隶属关系。谢谢原作者把它开源出来。</div>' +
      '</div>';
    shell().appendChild(el);
    W.el = el;
    el.querySelector('.go').addEventListener('click', function () { closeWelcome(); });
    el.querySelector('.full').addEventListener('click', function () {
      closeWelcome(true);
      setTimeout(function () { if (typeof startVisualGuide === 'function') startVisualGuide({ manual: true, source: 'welcome' }); }, 380);
    });
    el.querySelector('.login').addEventListener('click', function () {
      closeWelcome(true);
      setTimeout(function () { if (typeof showLoginModal === 'function') showLoginModal({ guided: true, source: 'welcome' }); }, 380);
    });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); });
    trapKeys(el, function () { closeWelcome(); }, function () { closeWelcome(); });
    window.addEventListener('resize', function () { if (welcomeOpen()) layoutWelcome(); });
    return el;
  }
  function layoutWelcome() {
    var sv = W.el.querySelector('svg'), w = innerWidth, h = innerHeight;
    var y0 = h * 0.70, y1 = h * 0.62, cx = w * 0.76, cy = y0 + (y1 - y0) * (cx / w), r = Math.max(38, Math.min(64, h * 0.07));
    sv.querySelector('.hz-l').setAttribute('d', 'M0 ' + y0.toFixed(1) + ' L' + w + ' ' + y1.toFixed(1));
    ['.hz-r', '.hz-r2'].forEach(function (s, i) { var c = sv.querySelector(s); c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', i ? r * 1.9 : r); });
    var d = sv.querySelector('.hz-d'); d.setAttribute('cx', cx + r); d.setAttribute('cy', cy);
    sv.querySelector('.hz-orb').style.transformOrigin = cx + 'px ' + cy + 'px';
  }
  function showWelcome() {
    buildWelcome();
    try { if (typeof closeNbSheets === 'function') closeNbSheets(); } catch (_e) { }
    layoutWelcome();
    W.el.classList.remove('out');
    W.el.classList.add('on');
    setTimeout(function () { try { W.el.querySelector('.go').focus({ preventScroll: true }); } catch (_e) { } }, 700);
  }
  function closeWelcome(quick) {
    if (!welcomeOpen()) return;
    ONB.welcome = 1; ONB.welcomeAt = Date.now(); save(K_ONB, ONB);
    try { if (typeof markVisualGuideSeen === 'function') markVisualGuideSeen(); } catch (_e) { }
    W.closedAt = Date.now();
    W.el.classList.add('out');
    setTimeout(function () { W.el.classList.remove('on', 'out'); }, quick ? 300 : 420);
  }
  window.openNbWelcome = showWelcome;

  // 接管开场后的启动引导：第一次 → 欢迎页；以后 → 看看要不要请用户写反馈
  var origMaybe = typeof maybeRunStartupVisualGuide === 'function' ? maybeRunStartupVisualGuide : null;
  if (origMaybe) {
    maybeRunStartupVisualGuide = function (source) {
      if (!ONB.welcome) {
        if (W.pending) return true;
        W.pending = true;
        (function wait(n) {
          setTimeout(function () {
            if (has('splash-active') || guideOn() || has('desktop-wallpaper-mode') || isImmersive()) { if (n < 40) wait(n + 1); else W.pending = false; return; }
            W.pending = false;
            if (!ONB.welcome) showWelcome();
          }, n ? 900 : (source === 'splash' ? 900 : 600));
        })(0);
        return true;   // 这一次不再自动弹登录（欢迎页里有「登录音乐平台」）
      }
      if (maybeScheduleAsk()) return true;
      return false;
    };
  }
  // 欢迎页开着时，老的「拖入上传」提示晚点再说
  if (typeof maybeShowUploadTipOnce === 'function') {
    var origUpTip = maybeShowUploadTipOnce;
    maybeShowUploadTipOnce = function () {
      if (welcomeOpen() || W.pending) { setTimeout(maybeShowUploadTipOnce, 2000); return; }
      return origUpTip.apply(this, arguments);
    };
  }

  // ============================================================
  // 2. 走到哪里讲哪里（小提示）
  // ============================================================
  // 各主题里对应元素的位置不一样：按当前主题找
  var SEL = {
    search: {
      'star-atlas': ['.sx-hint'], 'afternoon': ['.ha-shint'], 'riso-poster': ['.rp-hint-hit', '.rp-hint'],
      'echo': [function (root) { var f = root.querySelectorAll('.ec-row .ec-face'); for (var i = 0; i < f.length; i++) if (f[i].textContent === '搜索') return f[i].closest('.ec-row'); return null; }]
    },
    title: {
      'star-atlas': ['.sa-np .sa-title'], 'afternoon': ['.ha-ttl'], 'riso-poster': ['.title-hit .th-up', '.title-hit'], 'echo': ['.ec-np-t']
    },
    lyric: {
      'star-atlas': ['.sa-lz:not(.none):not(.q)'], 'afternoon': ['.ha-quote'], 'riso-poster': ['.rp-vhit'], 'echo': ['.ec-ly:not(.q) .ec-ly-in']
    }
  };
  function visibleRect(el) {
    if (!el || !el.getBoundingClientRect) return null;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return null;
    return r;
  }
  function themeEl(kind) {
    var h = host(); if (!h || !h.root) return null;
    var list = (SEL[kind] || {})[h.current] || [];
    for (var i = 0; i < list.length; i++) {
      var el = typeof list[i] === 'function' ? list[i](h.root) : h.root.querySelector(list[i]);
      if (visibleRect(el)) return el;
    }
    return null;
  }
  function byId(id) { return function () { var e = document.getElementById(id); return visibleRect(e) ? e : null; }; }
  function q(sel) { return function () { var e = document.querySelector(sel); return visibleRect(e) ? e : null; }; }

  var ISLAND_HINT = '右上角的小岛（鼠标移过去会展开）';
  var TIPS = [
    {
      key: 'search', kick: 'SEARCH · 从这里开始',
      when: function () { return homeOn() && !hasTrack() && W.closedAt && Date.now() - W.closedAt > 900; },
      anchor: function () { return themeEl('search'); },
      title: '先搜一首想听的歌',
      body: '点这里打开搜索；任何时候按 <kbd>Ctrl</kbd>+<kbd>K</kbd> 也行。本地音乐文件直接拖进窗口就能放。',
      dur: 16000
    },
    {
      key: 'play-home', kick: 'NOW PLAYING · 播放页在这里',
      when: function () { return homeOn() && isPlaying(); },
      anchor: function () { return themeEl('title') || themeEl('lyric'); },
      title: '点歌名，进入播放页',
      body: '在主页点播放不会跳走。想看歌词和画面，点<em>正在播放的歌名</em>，或主页上那句<em>歌词</em>。',
      clickAnchorDismiss: true,
      dur: 16000
    },
    {
      key: 'stage', kick: 'STAGE · 播放页',
      when: function () { return hasTrack() && !has('empty-home-active') && !has('home-theme-on') && !sheet('visual') && !sheet('settings'); },
      allowImmersive: true, delay: 1600,
      anchor: null,
      title: '这里歌词是主角',
      body: '滚轮拉远拉近，双击画面镜头回正；<kbd>I</kbd> 收起全部界面，<kbd>Esc</kbd> 或右键退回上一步。换这里的画面效果，去右上角「视觉」。',
      dur: 15000
    },
    {
      key: 'settings', kick: 'SETTINGS · 设置',
      when: function () { return sheet('settings'); },
      anchor: byId('nb-fb-entry'), fallbackAnchor: byId('fx-panel'), side: 'left',
      title: '细节都在这里',
      body: '最上面可以直接搜功能；「常用」放着最常改的几项，「快捷键」能改键。用着哪里不顺手，点这个<em>「反馈」</em>直接告诉作者，不用登录。',
      closeWhenGone: true,
      dur: 18000
    },
    {
      key: 'visual', kick: 'VISUAL · 视觉',
      when: function () { return sheet('visual'); },
      anchor: byId('nb-visual'), side: 'left',
      title: '换主页、换播放页',
      body: '上面挑主页主题，下面挑播放页效果，点一下就换，不满意再点回来。桌面歌词的开关也在这里。',
      closeWhenGone: true,
      dur: 15000
    },
    {
      key: 'cord', kick: 'THEMES · 换一套主页',
      when: function () {
        if (!homeOn() || sheet('visual') || sheet('settings')) return false;
        // 第一次打开时别连着出：等「搜索」那条看过、并且欢迎页关掉一会儿之后
        if (W.closedAt && Date.now() - W.closedAt < 45000) return false;
        return !!ONB.tips.search || hasTrack();
      },
      anchor: q('#home-theme-cord .cord-hit'),
      title: '拉一下这根绳',
      body: '往下拉，换一套主页主题（回声 · 星图 · 午后窗影 · 孔版海报）。每套主题的歌单栏、搜索框、面板都会跟着换样子。',
      clickAnchorDismiss: true,
      dur: 15000
    },
    {
      key: 'playlist', kick: 'LIBRARY · 歌单',
      when: function () { var p = document.getElementById('playlist-panel'); return !!(p && (p.classList.contains('peek') || p.classList.contains('show') || p.classList.contains('pinned'))); },
      anchor: byId('playlist-panel'), side: 'right',
      title: '左边缘藏着歌单',
      body: '鼠标贴着窗口左边停一下，队列、我的歌单、播客就会滑出来；点图钉可以让它一直开着。',
      closeWhenGone: true,
      dur: 13000
    },
    {
      key: 'feedback-island', kick: 'FEEDBACK · 反馈',
      when: function () {
        // 用了一阵子以后（第 2 次打开起、听过 20 分钟），告诉一声反馈入口在哪
        return USE.launches >= 2 && (USE.playSec | 0) >= 1200 && !has('splash-active') && document.querySelector('#mri-slot .mri-isl[data-mode=full]');
      },
      anchor: q('#mri-slot [data-mri-act=feedback]'),
      closeWhenGone: true,
      title: '有话想说？点这里',
      body: '遇到问题、觉得哪里别扭、想要什么功能，点小岛上的「反馈」写几句就能直接发给作者，不用任何账号。',
      clickAnchorDismiss: true,
      dur: 14000
    }
  ];

  var T = { el: null, ring: null, lead: null, cur: null, t0: 0, raf: 0, timer: 0, hold: 0, anchorEl: null, lastEnd: 0 };
  function buildTip() {
    if (T.el) return;
    ensureStyle();
    T.ring = document.createElement('div'); T.ring.id = 'nb-tip-ring';
    T.lead = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); T.lead.id = 'nb-tip-lead';
    T.lead.innerHTML = '<path/><circle r="2.6"/>';
    T.el = document.createElement('div'); T.el.id = 'nb-tip'; T.el.setAttribute('role', 'status'); T.el.setAttribute('aria-live', 'polite');
    T.el.innerHTML = '<div class="k"><i></i><span></span></div><div class="t"></div><div class="b"></div><div class="a"><button type="button" class="ok">知道了</button><button type="button" class="off">以后都不用提示</button></div><i class="tm"></i>';
    var sh = shell();
    sh.appendChild(T.ring); sh.appendChild(T.lead); sh.appendChild(T.el);
    T.el.querySelector('.ok').addEventListener('click', function () { endTip(true); });
    T.el.querySelector('.off').addEventListener('click', function () { ONB.off = 1; ONB.userOff = 1; save(K_ONB, ONB); endTip(true); });
    ['keydown', 'keyup'].forEach(function (t) { T.el.addEventListener(t, function (e) { if (e.key === 'Escape' && t === 'keydown') endTip(true); e.stopPropagation(); }); });
    T.el.addEventListener('contextmenu', function (e) { e.stopPropagation(); });
    // 点到了被指着的东西 = 看懂了
    document.addEventListener('click', function (e) {
      if (!T.cur || !T.cur.clickAnchorDismiss || !T.anchorEl) return;
      if (T.anchorEl.contains(e.target)) endTip(true);
    }, true);
  }
  function blocked(tip) {
    if (has('splash-active') || guideOn() || welcomeOpen() || W.pending) return true;
    if ((has('desktop-wallpaper-mode') && !(tip && tip.allowDesktop)) || has('login-guide-active')) return true;
    if (isImmersive() && !(tip && tip.allowImmersive)) return true;
    var fb = document.getElementById('nb-fb-mask'); if (fb && fb.classList.contains('on')) return true;
    var ask = document.getElementById('nb-ask'); if (ask && ask.classList.contains('on')) return true;
    var lm = document.getElementById('login-modal'); if (lm && lm.classList.contains('show')) return true;
    var um = document.getElementById('user-modal'); if (um && um.classList.contains('show')) return true;
    return false;
  }
  function anchorOf(tip) {
    var a = null;
    try { a = tip.anchor ? tip.anchor() : null; if (!a && tip.fallbackAnchor) a = tip.fallbackAnchor(); } catch (_e) { a = null; }
    return a;
  }
  function startTip(tip) {
    buildTip();
    T.cur = tip; T.t0 = performance.now(); T.anchorEl = anchorOf(tip);
    T.el.querySelector('.k span').textContent = tip.kick;
    T.el.querySelector('.t').textContent = typeof tip.title === 'function' ? tip.title() : tip.title;
    T.el.querySelector('.b').innerHTML = typeof tip.body === 'function' ? tip.body() : tip.body;
    // [二改 2026-09-28] 可选的动作按钮（比如「打开视觉」）：点了 = 看过 + 去做
    var act = T.el.querySelector('.a .act');
    if (tip.action && tip.action.label) {
      if (!act) {
        act = document.createElement('button'); act.type = 'button'; act.className = 'act';
        T.el.querySelector('.a').insertBefore(act, T.el.querySelector('.a .ok'));
        act.addEventListener('click', function () { var t = T.cur; endTip(true); if (t && t.action && typeof t.action.run === 'function') { try { t.action.run(); } catch (_e) { } } });
      }
      act.textContent = tip.action.label; act.hidden = false;
    } else if (act) act.hidden = true;
    if (typeof tip.onStart === 'function') { try { tip.onStart(); } catch (_e) { } }
    T.el.style.setProperty('--dur', (tip.dur || 14000) + 'ms');
    var tm = T.el.querySelector('.tm'); tm.style.animation = 'none'; void tm.offsetWidth; tm.style.animation = '';
    place();
    T.el.classList.add('on');
    clearTimeout(T.timer);
    T.timer = setTimeout(function () { if (T.cur === tip) endTip(true); }, tip.dur || 14000);
    T.el.onmouseenter = function () { clearTimeout(T.timer); };
    T.el.onmouseleave = function () { clearTimeout(T.timer); T.timer = setTimeout(function () { if (T.cur === tip) endTip(true); }, 6000); };
    loop();
  }
  function endTip(markSeen) {
    var tip = T.cur; if (!tip) return;
    if (markSeen) { ONB.tips[tip.key] = 1; save(K_ONB, ONB); }
    T.cur = null; T.anchorEl = null; T.lastEnd = Date.now();
    clearTimeout(T.timer); cancelAnimationFrame(T.raf);
    T.el.classList.remove('on'); T.ring.classList.remove('on'); T.lead.classList.remove('on');
    if (typeof tip.onEnd === 'function') { try { tip.onEnd(!!markSeen); } catch (_e) { } }
  }
  function loop() {
    cancelAnimationFrame(T.raf);
    var last = 0;
    (function f(now) {
      if (!T.cur) return;
      if (now - last > 90) { last = now; place(); }
      T.raf = requestAnimationFrame(f);
    })(0);
  }
  function place() {
    var tip = T.cur; if (!tip) return;
    // 目标换了 / 没了：重新找一次
    if (tip.anchor && (!T.anchorEl || !document.contains(T.anchorEl) || !visibleRect(T.anchorEl))) T.anchorEl = anchorOf(tip);
    var W0 = innerWidth, H0 = innerHeight, cw = T.el.offsetWidth || 292, ch = T.el.offsetHeight || 150, m = 16, gap = 18;
    var r = T.anchorEl ? visibleRect(T.anchorEl) : null;
    var x, y;
    if (!r) {
      // 没有具体位置：放在底部居中偏上（播放页的播放条上方）
      x = (W0 - cw) / 2; y = H0 - ch - Math.max(110, H0 * 0.16);
      T.ring.classList.remove('on'); T.lead.classList.remove('on');
    } else {
      var huge = r.width * r.height > W0 * H0 * 0.22;
      var pad = 6;
      var rl = Math.max(4, r.left - pad), rt = Math.max(4, r.top - pad), rw = Math.min(W0 - 8, r.width + pad * 2), rh = Math.min(H0 - 8, r.height + pad * 2);
      if (!huge) {
        T.ring.style.left = rl + 'px'; T.ring.style.top = rt + 'px'; T.ring.style.width = rw + 'px'; T.ring.style.height = rh + 'px';
        T.ring.style.borderRadius = Math.min(14, rh / 2) + 'px';
        T.ring.classList.add('on');
      } else T.ring.classList.remove('on');
      // 候选位置：按提示的偏好先试
      var cand = {
        below: { x: r.left + r.width / 2 - cw / 2, y: r.bottom + gap },
        above: { x: r.left + r.width / 2 - cw / 2, y: r.top - gap - ch },
        right: { x: r.right + gap, y: r.top + r.height / 2 - ch / 2 },
        left: { x: r.left - gap - cw, y: r.top + r.height / 2 - ch / 2 }
      };
      var order = tip.side === 'left' ? ['left', 'below', 'above', 'right'] : tip.side === 'right' ? ['right', 'below', 'left', 'above'] : ['below', 'above', 'right', 'left'];
      if (huge) order = ['right', 'left', 'below', 'above'];
      var pick = null;
      for (var i = 0; i < order.length; i++) {
        var c = cand[order[i]];
        var cx = Math.max(m, Math.min(W0 - cw - m, c.x)), cy = Math.max(m, Math.min(H0 - ch - m, c.y));
        var ov = cx < r.right && cx + cw > r.left && cy < r.bottom && cy + ch > r.top;
        // [二改 2026-09-28] clampOk：目标贴着屏幕角（比如桌面背景右上角的小按钮）时，允许卡片整体挪进屏幕，只要不盖住目标
        if (!ov && (tip.clampOk || (c.x >= m - 40 && c.x + cw <= W0 - m + 40 && c.y >= m - 40 && c.y + ch <= H0 - m + 40))) { pick = { x: cx, y: cy }; break; }
      }
      if (!pick) pick = { x: Math.max(m, Math.min(W0 - cw - m, r.left + 12)), y: Math.max(m, Math.min(H0 - ch - m, r.bottom - ch - 12)) };
      x = pick.x; y = pick.y;
      // 引线：卡片最近的一点 → 目标最近的一点
      var tx = Math.max(r.left, Math.min(r.right, x + cw / 2)), ty = Math.max(r.top, Math.min(r.bottom, y + ch / 2));
      var sx = Math.max(x, Math.min(x + cw, tx)), sy = Math.max(y, Math.min(y + ch, ty));
      var d = Math.hypot(tx - sx, ty - sy);
      if (d > 8 && !huge) {
        T.lead.querySelector('path').setAttribute('d', 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ' L' + tx.toFixed(1) + ' ' + ty.toFixed(1));
        var dot = T.lead.querySelector('circle'); dot.setAttribute('cx', tx.toFixed(1)); dot.setAttribute('cy', ty.toFixed(1));
        T.lead.classList.add('on');
      } else T.lead.classList.remove('on');
    }
    T.el.style.left = Math.round(x) + 'px';
    T.el.style.top = Math.round(y) + 'px';
  }

  // 每 0.7 秒看一眼：现在该不该出某条提示
  var holdFor = {};
  function tick() {
    // [二改 2026-09-28] 老用户（看过 3.0 完整引导，自动关了小提示）仍会看到标了 forLegacy 的"新变化"提示；
    // 自己点过「以后都不用提示」的（userOff）就一条都不出
    var legacyOnly = !!(ONB.off && ONB.legacy && !ONB.userOff);
    if ((ONB.off && !legacyOnly) || !ONB.welcome) { if (T.cur) endTip(false); return; }
    var now = Date.now();
    if (T.cur) {
      var tip = T.cur;
      var gone = false;
      try { gone = !tip.when(); } catch (_e) { gone = true; }
      if (blocked(tip)) { endTip(false); return; }
      // 场景已经离开：看了 2 秒以上就算看过，否则下次再出
      if (gone && (tip.closeWhenGone || !tip.anchor || !T.anchorEl)) endTip(performance.now() - T.t0 > 2000);
      return;
    }
    if (now - T.lastEnd < 2500) return;
    for (var i = 0; i < TIPS.length; i++) {
      var t = TIPS[i];
      if (ONB.tips[t.key]) continue;
      if (legacyOnly && !t.forLegacy) continue;
      var ok = false;
      try { ok = !!t.when(); } catch (_e) { ok = false; }
      if (!ok || blocked(t)) { holdFor[t.key] = 0; continue; }
      // 条件要连续成立一小会儿才出（刚切过去的画面先让它稳住）
      if (!holdFor[t.key]) { holdFor[t.key] = now; if (typeof t.prepare === 'function') { try { t.prepare(); } catch (_e) { } } continue; }
      if (now - holdFor[t.key] < (t.delay || 900)) continue;
      if (t.anchor && !anchorOf(t) && !t.fallbackAnchor) continue;
      startTip(t);
      break;
    }
  }
  setInterval(tick, 700);
  window.addEventListener('resize', function () { if (T.cur) place(); });
  // 调试 / 设置里用：把小提示全部重新打开
  window.resetNbTips = function () { ONB.tips = {}; ONB.off = 0; ONB.userOff = 0; ONB.welcome = 1; save(K_ONB, ONB); };
  // [二改 2026-09-28] 给别的模块（23-newbie-tips-extra.js）加 / 改小提示用：同一套卡片、同一个节奏
  //   tip 字段：key kick title body（可以是函数）when anchor fallbackAnchor side delay dur allowImmersive
  //   closeWhenGone clickAnchorDismiss，另加 allowDesktop（桌面背景里也能出）forLegacy（老用户也出）
  //   action {label, run}（卡片上多一个按钮）prepare()（条件刚成立时调一次）onStart() onEnd(seen)
  window.nbRegisterTip = function (tip, beforeKey) {
    if (!tip || !tip.key || typeof tip.when !== 'function') return false;
    for (var i = 0; i < TIPS.length; i++) if (TIPS[i].key === tip.key) { TIPS[i] = tip; return true; }
    var at = -1;
    if (beforeKey) for (var j = 0; j < TIPS.length; j++) if (TIPS[j].key === beforeKey) { at = j; break; }
    if (at >= 0) TIPS.splice(at, 0, tip); else TIPS.push(tip);
    return true;
  };
  window.nbGetTip = function (key) { for (var i = 0; i < TIPS.length; i++) if (TIPS[i].key === key) return TIPS[i]; return null; };
  window.nbTipKit = {
    has: has, homeOn: homeOn, sheet: sheet, hasTrack: hasTrack, isPlaying: isPlaying, isImmersive: isImmersive,
    visibleRect: visibleRect, byId: byId, q: q,
    seen: function (key) { return !!ONB.tips[key]; },
    current: function () { return T.cur ? T.cur.key : ''; },
    end: function (seen) { endTip(seen !== false); }
  };

  // ============================================================
  // 3. 用了一段时间后：请用户写几句反馈
  // ============================================================
  var DAY = 86400000;
  function askEligible() {
    if (USE.never) return false;
    if (typeof window.openNbFeedback !== 'function') return false;
    var now = Date.now();
    if (now - (USE.first || now) < 3 * DAY) return false;
    if ((USE.launches | 0) < 4) return false;
    if ((USE.playSec | 0) < 90 * 60) return false;
    if ((USE.asks | 0) >= 3) return false;
    if (USE.sentAt && now - USE.sentAt < 90 * DAY) return false;
    if (USE.lastAsk && now - USE.lastAsk < 21 * DAY) return false;
    return true;
  }
  var A = { el: null, scheduled: false };
  function maybeScheduleAsk() {
    if (A.scheduled || !askEligible()) return false;
    A.scheduled = true;
    var tries = 0;
    (function wait() {
      setTimeout(function () {
        tries++;
        var busy = has('splash-active') || guideOn() || welcomeOpen() || isImmersive() || has('desktop-wallpaper-mode') || sheet('visual') || sheet('settings') || T.cur;
        var fb = document.getElementById('nb-fb-mask'); if (fb && fb.classList.contains('on')) busy = true;
        var lm = document.getElementById('login-modal'); if (lm && lm.classList.contains('show')) busy = true;
        if (busy) { if (tries < 36) wait(); return; }   // 最多等 3 分钟，还不方便就这次不问了
        showAsk();
      }, tries ? 5000 : 6000);
    })();
    return true;
  }
  function hoursText() {
    var h = (USE.playSec | 0) / 3600;
    if (h < 1) return '';
    return h < 10 ? Math.round(h * 2) / 2 + ' 个小时' : Math.round(h) + ' 个小时';
  }
  function buildAsk() {
    if (A.el) return A.el;
    ensureStyle();
    var el = document.createElement('div');
    el.id = 'nb-ask';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '写几句反馈');
    el.innerHTML = '<div class="box">' +
      '<div class="k"><i></i><span>A SMALL ASK · 一个小请求</span></div>' +
      '<h3>想听听你用下来的感受</h3>' +
      '<p class="p1"></p>' +
      '<p>我只是一个大学生，Not Blind 是课余时间一点点做出来的。<b>你写下的几句话，是它变好最直接的办法。</b></p>' +
      '<p>好的坏的都可以，一句也行。</p>' +
      '<div class="a"><button type="button" class="go">写几句</button><button type="button" class="later">下次再说</button><button type="button" class="never">不用再问了</button></div>' +
      '</div>';
    shell().appendChild(el);
    A.el = el;
    el.querySelector('.go').addEventListener('click', function () {
      closeAsk();
      setTimeout(function () {
        try { window.openNbFeedback({ type: 'other', note: '谢谢你愿意写几句 ❤', placeholder: '随便说说：最喜欢哪里、最别扭的是什么、希望它多一个什么功能……' }); } catch (_e) { }
      }, 260);
    });
    el.querySelector('.later').addEventListener('click', function () { closeAsk(); });
    el.querySelector('.never').addEventListener('click', function () { USE.never = 1; save(K_USE, USE); closeAsk(); });
    el.addEventListener('pointerdown', function (e) { if (e.target === el) closeAsk(); });
    trapKeys(el, closeAsk, null);
    return el;
  }
  function showAsk() {
    buildAsk();
    var ht = hoursText();
    A.el.querySelector('.p1').innerHTML = ht
      ? '到今天，它已经陪你听了大约 <b>' + ht + '</b> 的歌。谢谢你一直用它。'
      : '这段时间你一直在用它，谢谢。';
    USE.asks = (USE.asks | 0) + 1; USE.lastAsk = Date.now(); save(K_USE, USE);
    A.el.classList.add('on');
    setTimeout(function () { try { A.el.querySelector('.go').focus({ preventScroll: true }); } catch (_e) { } }, 300);
  }
  function closeAsk() { if (A.el) A.el.classList.remove('on'); }
  window.openNbFeedbackAsk = function () { showAsk(); };

  // 开场已经过去了（比如秒启动跳过了开场）：自己补一次
  setTimeout(function () {
    if (has('splash-active')) return;
    if (!ONB.welcome && !W.pending && !welcomeOpen() && !guideOn()) { if (typeof maybeRunStartupVisualGuide === 'function') maybeRunStartupVisualGuide('late'); }
  }, 12000);
})();
