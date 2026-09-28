// ============================================================
// [二改] 反馈面板：设置面板右上角「反馈」→ 写几句话 → 直接发给作者（不用任何账号）
// 真正发送在主进程（desktop/feedback.js），这里只负责界面。
// ============================================================
;(function () {
  if (window.__nbFeedbackUi) return;
  window.__nbFeedbackUi = true;
  var api = window.desktopWindow;
  if (!api || typeof api.feedbackSubmit !== 'function') return;   // 浏览器里打开时没有这个功能

  var CSS = [
    '#nb-fb-mask{position:fixed;inset:0;z-index:9000;background:rgba(8,7,7,.55);display:grid;place-items:center;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s ease,visibility 0s linear .2s;-webkit-app-region:no-drag}',
    // [二改][窗口拖动] 只靠透明度藏起来时，这层铺满全窗口的"不可拖动区"还在，打开过一次反馈后标题栏就拖不动窗口了；藏起时连 visibility 一起藏
    '#nb-fb-mask.on{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .2s ease,visibility 0s}',
    '#nb-fb{width:min(540px,calc(100vw - 48px));max-height:calc(100vh - 80px);overflow:auto;box-sizing:border-box;padding:26px 28px 22px;background:#171514;color:#dfe3dc;border:1px solid rgba(223,227,220,.14);border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.55);font:13px/1.6 "Microsoft YaHei UI","Microsoft YaHei",sans-serif;transform:translateY(10px) scale(.985);transition:transform .32s cubic-bezier(.2,1.1,.3,1)}',
    '#nb-fb-mask.on #nb-fb{transform:none}',
    '#nb-fb *{box-sizing:border-box}',
    '#nb-fb h3{margin:0;font-size:18px;font-weight:500;letter-spacing:.12em}',
    '#nb-fb .sub{margin:2px 0 18px;font:10.5px/1 "Cascadia Mono",Consolas,monospace;letter-spacing:.16em;color:rgba(223,227,220,.42)}',
    '#nb-fb .x{position:absolute;right:14px;top:12px}',
    '#nb-fb .seg{display:flex;gap:0;margin-bottom:12px;border:1px solid rgba(223,227,220,.16);border-radius:8px;overflow:hidden;width:max-content}',
    '#nb-fb .seg button{background:none;border:0;color:rgba(223,227,220,.6);padding:6px 18px;font:inherit;cursor:pointer;transition:background .15s,color .15s}',
    '#nb-fb .seg button+button{border-left:1px solid rgba(223,227,220,.12)}',
    '#nb-fb .seg button:hover{color:#dfe3dc}',
    '#nb-fb .seg button.on{background:rgba(255,74,28,.14);color:#ff6a44}',
    '#nb-fb textarea,#nb-fb input[type=text]{width:100%;background:#100f0e;color:#dfe3dc;border:1px solid rgba(223,227,220,.14);border-radius:8px;padding:10px 12px;font:inherit;outline:none;transition:border-color .15s}',
    '#nb-fb textarea{height:140px;resize:vertical}',
    '#nb-fb textarea:focus,#nb-fb input[type=text]:focus{border-color:rgba(255,74,28,.6)}',
    '#nb-fb textarea::placeholder,#nb-fb input::placeholder{color:rgba(223,227,220,.3)}',
    '#nb-fb .cnt{text-align:right;font:11px Consolas,monospace;color:rgba(223,227,220,.3);margin:2px 0 8px}',
    '#nb-fb label.ck{display:flex;align-items:flex-start;gap:9px;margin:10px 0 0;cursor:pointer;color:rgba(223,227,220,.8)}',
    '#nb-fb label.ck input{margin:3px 0 0;accent-color:#ff4a1c}',
    '#nb-fb label.ck small{display:block;color:rgba(223,227,220,.4);font-size:11.5px}',
    '#nb-fb .peek{background:none;border:0;color:#ff6a44;font:inherit;font-size:11.5px;padding:0;cursor:pointer;margin-left:4px}',
    '#nb-fb pre{display:none;margin:8px 0 0;max-height:160px;overflow:auto;background:#100f0e;border:1px solid rgba(223,227,220,.1);border-radius:6px;padding:8px 10px;font:11px/1.5 Consolas,monospace;color:rgba(223,227,220,.6);white-space:pre-wrap;word-break:break-all}',
    '#nb-fb pre.on{display:block}',
    '#nb-fb .shot{display:none;margin-top:8px;max-width:180px;border:1px solid rgba(223,227,220,.14);border-radius:6px}',
    '#nb-fb .shot.on{display:block}',
    '#nb-fb .act{display:flex;align-items:center;gap:10px;margin-top:18px}',
    '#nb-fb .st{flex:1;font-size:12px;color:rgba(223,227,220,.5)}',
    '#nb-fb .st.ok{color:#8fd19e}#nb-fb .st.err{color:#ff8a6a}',
    '#nb-fb .btn{background:none;border:1px solid rgba(223,227,220,.2);color:#dfe3dc;border-radius:8px;padding:7px 18px;font:inherit;cursor:pointer;transition:background .15s,border-color .15s,opacity .15s}',
    '#nb-fb .btn:hover{border-color:rgba(223,227,220,.45)}',
    '#nb-fb .btn.go{background:#ff4a1c;border-color:#ff4a1c;color:#fff}',
    '#nb-fb .btn.go:hover{background:#ff5f36}',
    '#nb-fb .btn[disabled]{opacity:.45;pointer-events:none}',
    '#nb-fb .note{display:none;margin:-6px 0 14px;padding-left:10px;border-left:2px solid #ff4a1c;color:rgba(223,227,220,.8);font-size:12.5px}',
    '#nb-fb .note.on{display:block}',
    // 设置面板顶上的入口：用强调色，一眼能看到（盖过设置面板对 .fx-mini-btn 的统一样式）
    '#nb-fb-entry{margin-left:6px;display:inline-flex;align-items:center;gap:5px}',
    '#nb-fb-entry svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}',
    'html body #fx-panel.nb-settings .fx-head-actions #nb-fb-entry{display:inline-flex!important;align-items:center;gap:5px;border-color:var(--e-hot,#ff4a1c)!important;color:var(--e-hot,#ff4a1c)!important}',
    'html body #fx-panel.nb-settings .fx-head-actions #nb-fb-entry:hover{background:var(--e-hot,#ff4a1c)!important;color:#fff!important}'
  ].join('\n');

  var TYPES = [['bug', '遇到问题'], ['idea', '功能建议'], ['other', '其他']];
  var mask = null, els = {}, state = { type: 'bug', shot: '', sending: false };

  function build() {
    if (mask) return;
    var st = document.createElement('style'); st.id = 'nb-fb-style'; st.textContent = CSS; document.head.appendChild(st);
    mask = document.createElement('div');
    mask.id = 'nb-fb-mask';
    mask.innerHTML =
      '<div id="nb-fb" role="dialog" aria-modal="true" aria-label="反馈">' +
        '<h3>反馈</h3><div class="sub">FEEDBACK · 直接发给作者，不用登录</div>' +
        '<div class="note"></div>' +
        '<div class="seg" role="radiogroup">' + TYPES.map(function (t) { return '<button type="button" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<textarea maxlength="4000" placeholder="遇到了什么问题（在哪个页面、做了什么、结果怎样），或者希望加什么功能……"></textarea>' +
        '<div class="cnt">0 / 4000</div>' +
        '<input type="text" class="contact" maxlength="120" placeholder="联系方式（选填）：QQ / 微信 / 邮箱，方便作者回复你">' +
        '<label class="ck"><input type="checkbox" class="diag" checked><span>附上诊断信息 <button type="button" class="peek">看看会发什么</button><small>版本、系统、最近的错误记录。不含你的歌单和账号</small></span></label>' +
        '<pre class="diagpre"></pre>' +
        '<label class="ck"><input type="checkbox" class="shotck"><span>附上刚才的界面截图<small>打开反馈前那一刻的软件画面</small></span></label>' +
        '<img class="shot" alt="">' +
        '<div class="act"><span class="st"></span><button type="button" class="btn cancel">取消</button><button type="button" class="btn go">发送</button></div>' +
      '</div>';
    // 桌面版整个界面在圆角外壳里，遮罩也放进去，免得盖到窗口圆角外面的透明区域
    (document.getElementById('desktop-window-shell') || document.body).appendChild(mask);
    var $ = function (s) { return mask.querySelector(s); };
    els = { note: $('.note'), box: $('#nb-fb'), seg: $('.seg'), text: $('textarea'), cnt: $('.cnt'), contact: $('.contact'), diag: $('.diag'), peek: $('.peek'), pre: $('.diagpre'), shotck: $('.shotck'), shot: $('.shot'), st: $('.st'), go: $('.go'), cancel: $('.cancel') };
    els.seg.addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (b) setType(b.getAttribute('data-t')); });
    els.text.addEventListener('input', function () { els.cnt.textContent = els.text.value.length + ' / 4000'; });
    els.peek.addEventListener('click', function (e) { e.preventDefault(); els.pre.classList.toggle('on'); });
    els.shotck.addEventListener('change', function () { els.shot.classList.toggle('on', els.shotck.checked && !!state.shot); });
    els.cancel.addEventListener('click', close);
    els.go.addEventListener('click', submit);
    mask.addEventListener('pointerdown', function (e) { if (e.target === mask && !state.sending) close(); });
    // 面板里打字时别触发软件的快捷键（空格暂停、方向键切歌等）
    ['keydown', 'keyup', 'keypress'].forEach(function (t) {
      els.box.addEventListener(t, function (e) {
        if (t === 'keydown' && e.key === 'Escape') { e.preventDefault(); close(); }
        else if (t === 'keydown' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
        e.stopPropagation();
      });
    });
  }
  function setType(t) {
    state.type = t;
    Array.prototype.forEach.call(els.seg.children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); b.setAttribute('aria-checked', b.getAttribute('data-t') === t ? 'true' : 'false'); });
  }
  function status(msg, cls) { els.st.textContent = msg || ''; els.st.className = 'st' + (cls ? ' ' + cls : ''); }
  function currentTheme() {
    try { if (typeof homeThemeHost !== 'undefined' && homeThemeHost) return homeThemeHost.current || ''; } catch (_e) { }
    return '';
  }

  var PH = '遇到了什么问题（在哪个页面、做了什么、结果怎样），或者希望加什么功能……';
  function open(opts) {
    if (!opts || typeof opts !== 'object' || typeof opts.preventDefault === 'function') opts = {};
    build();
    if (mask.classList.contains('on')) return;
    if (opts.type) state.type = opts.type;
    els.text.placeholder = opts.placeholder || PH;
    els.note.textContent = opts.note || '';
    els.note.classList.toggle('on', !!opts.note);
    // 先截图（面板还没出现），再显示面板
    var cap = typeof api.feedbackCapture === 'function' ? api.feedbackCapture() : Promise.resolve('');
    Promise.resolve(cap).catch(function () { return ''; }).then(function (shot) {
      state.shot = shot || '';
      els.shot.src = state.shot || '';
      els.shotck.checked = false; els.shot.classList.remove('on');
      els.shotck.disabled = !state.shot;
      status('');
      els.go.disabled = false; els.go.textContent = '发送';
      setType(state.type || 'bug');
      mask.classList.add('on');
      setTimeout(function () { try { els.text.focus(); } catch (_e) { } }, 60);
      if (typeof api.feedbackInfo === 'function') {
        api.feedbackInfo().then(function (info) {
          info = info || {};
          els.pre.textContent = (info.os || '') + '\nNot Blind ' + (info.version || '') + '\n\n' + (info.diagPreview || '（暂时没有错误记录）');
          if (!info.configured) status('（作者还没配置好接收服务器，发送后会先存在本机）');
        }).catch(function () { });
      }
    });
  }
  function close() {
    if (!mask || state.sending) return;
    mask.classList.remove('on');
    els.pre.classList.remove('on');
  }
  function submit() {
    if (state.sending) return;
    var text = els.text.value.trim();
    if (!text) { status('先写点什么吧', 'err'); els.text.focus(); return; }
    state.sending = true;
    els.go.disabled = true; els.go.textContent = '发送中…';
    status('');
    api.feedbackSubmit({
      type: state.type, text: text, contact: els.contact.value.trim(), theme: currentTheme(),
      includeDiag: els.diag.checked, includeShot: els.shotck.checked, screenshot: els.shotck.checked ? state.shot : '',
    }).then(function (r) {
      state.sending = false;
      r = r || {};
      if (r.ok) {
        status('收到了，谢谢你！作者会认真看每一条。编号 ' + (r.id || ''), 'ok');
        try { window.dispatchEvent(new CustomEvent('nb-feedback-sent', { detail: { id: r.id || '' } })); } catch (_e) { }
        els.text.value = ''; els.cnt.textContent = '0 / 4000';
        els.go.textContent = '已发送';
        setTimeout(close, 1800);
      } else if (r.queued) {
        status('现在发不出去（' + (r.error || '网络问题') + '），已经存在本机，下次打开软件会自动再发', 'err');
        els.text.value = ''; els.cnt.textContent = '0 / 4000';
        els.go.disabled = false; els.go.textContent = '发送';
      } else {
        status('没发出去：' + (r.error || '未知原因'), 'err');
        els.go.disabled = false; els.go.textContent = '重试';
      }
    }).catch(function (e) {
      state.sending = false;
      status('没发出去：' + (e && e.message || e), 'err');
      els.go.disabled = false; els.go.textContent = '重试';
    });
  }

  // ---------- 入口：设置面板右上角「热键」旁边 ----------
  function ensureEntry() {
    if (document.getElementById('nb-fb-entry')) return;
    var host = document.querySelector('#fx-panel .fx-head-actions');
    if (!host) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'nb-fb-entry'; b.className = 'fx-mini-btn ghost'; b.title = '给作者发反馈（不用登录）';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5z"/><path d="M8.5 9.5h7M8.5 12.2h4.5"/></svg><span>反馈</span>';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(); });
    // 放在最前面，比「热键」等按钮更显眼
    host.insertBefore(b, host.firstChild);
  }
  window.openNbFeedback = open;
  ensureEntry();
  setTimeout(ensureEntry, 1500);
  new MutationObserver(function () { ensureEntry(); }).observe(document.getElementById('fx-panel') || document.body, { childList: true, subtree: true });
})();
