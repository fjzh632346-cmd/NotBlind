'use strict';
// ============================================================
// [二改] 反馈：软件里填的反馈 → 发到作者自己服务器上的接收程序（feedback-server）
// 不需要 GitHub 账号。服务器地址和密钥写在 package.json 的 notblind.feedback 里：
//   "feedback": { "endpoint": "http://服务器IP:8787/api/feedback", "key": "安装脚本给的 appKey" }
// 发不出去（没网、服务器没开）时先存在本机 %APPDATA%\NotBlind\feedback-outbox\，
// 下次打开软件、以及之后每 30 分钟自动再发。
// ============================================================
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function installFeedback({ app, ipcMain, getMainWindow, config, userDataPath }) {
  const cfg = config || {};
  const endpoint = String(cfg.endpoint || '').trim();
  const key = String(cfg.key || '').trim();
  const outbox = path.join(userDataPath, 'feedback-outbox');
  const version = (() => { try { return app.getVersion(); } catch (_) { return ''; } })();

  function configured() { return /^https?:\/\/[^/]+\/.+/.test(endpoint); }

  // 诊断信息里抹掉 Windows 用户名，免得把电脑用户名发出去
  function scrub(text) {
    let t = String(text || '');
    try {
      const home = os.homedir();
      if (home) t = t.split(home).join('~');
      const user = os.userInfo().username;
      if (user && user.length > 1) t = t.split(user).join('<user>');
    } catch (_) { }
    return t;
  }
  function tail(file, bytes) {
    try {
      const st = fs.statSync(file);
      const fd = fs.openSync(file, 'r');
      const len = Math.min(bytes, st.size);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, st.size - len);
      fs.closeSync(fd);
      return buf.toString('utf8');
    } catch (_) { return ''; }
  }
  function osLine() {
    return 'Windows ' + os.release() + ' · ' + process.arch + ' · Electron ' + process.versions.electron +
      ' · 内存 ' + Math.round(os.totalmem() / 1073741824) + 'GB · ' + (app.isPackaged ? '安装版' : '源码版');
  }
  function diagText() {
    const parts = [];
    const err = tail(path.join(userDataPath, 'startup-error.log'), 6000).trim();
    if (err) parts.push('== 最近的错误记录 ==\n' + err);
    const stab = tail(path.join(userDataPath, 'desktop-stability.log'), 6000).trim();
    if (stab) parts.push('== 桌面模式稳定性记录 ==\n' + stab);
    try {
      const gpu = app.getGPUFeatureStatus ? app.getGPUFeatureStatus() : null;
      if (gpu) parts.push('== 显卡加速 ==\n' + Object.keys(gpu).map((k) => k + ': ' + gpu[k]).join('\n'));
    } catch (_) { }
    return scrub(parts.join('\n\n')).slice(0, 50000);
  }

  function post(body) {
    return new Promise((resolve) => {
      let u;
      try { u = new URL(endpoint); } catch (_) { resolve({ ok: false, network: false, error: '反馈地址没配置好' }); return; }
      const data = Buffer.from(JSON.stringify(body));
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request({
        hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method: 'POST', timeout: 20000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, 'X-NB-Key': key, 'User-Agent': 'NotBlind/' + version },
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let j = null; try { j = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { }
          if (res.statusCode === 200 && j && j.ok) resolve({ ok: true, id: j.id });
          else resolve({ ok: false, network: false, status: res.statusCode, error: (j && j.error) || ('服务器返回 ' + res.statusCode) });
        });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', (e) => resolve({ ok: false, network: true, error: String(e && e.message || e) }));
      req.end(data);
    });
  }

  function queue(body) {
    try {
      fs.mkdirSync(outbox, { recursive: true });
      const f = path.join(outbox, Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.json');
      fs.writeFileSync(f, JSON.stringify(body));
      return true;
    } catch (_) { return false; }
  }
  let flushing = false;
  async function flush() {
    if (flushing || !configured()) return;
    flushing = true;
    try {
      let files = [];
      try { files = fs.readdirSync(outbox).filter((f) => f.endsWith('.json')).sort(); } catch (_) { files = []; }
      for (const f of files) {
        const full = path.join(outbox, f);
        let body = null; try { body = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (_) { }
        if (!body) { try { fs.unlinkSync(full); } catch (_) { } continue; }
        const r = await post(body);
        if (r.ok || (!r.network && r.status && r.status !== 429 && r.status < 500)) { try { fs.unlinkSync(full); } catch (_) { } }
        else if (r.network) break;   // 还是连不上，等下次
      }
    } finally { flushing = false; }
  }
  setTimeout(() => { flush().catch(() => {}); }, 20000).unref?.();
  const timer = setInterval(() => { flush().catch(() => {}); }, 30 * 60 * 1000);
  if (timer.unref) timer.unref();

  ipcMain.handle('notblind-feedback-info', () => ({
    configured: configured(),
    version,
    os: osLine(),
    diagPreview: diagText().slice(0, 4000),
  }));

  // 打开反馈面板之前先截一张当前界面（面板自己还没出现）
  ipcMain.handle('notblind-feedback-capture', async (event) => {
    const win = getMainWindow();
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return '';
    try {
      let img = await win.webContents.capturePage();
      if (!img || img.isEmpty()) return '';
      const sz = img.getSize();
      if (sz.width > 1600) img = img.resize({ width: 1600, quality: 'good' });
      return 'data:image/jpeg;base64,' + img.toJPEG(78).toString('base64');
    } catch (_) { return ''; }
  });

  ipcMain.handle('notblind-feedback-submit', async (event, payload) => {
    const win = getMainWindow();
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return { ok: false, error: 'denied' };
    const p = payload || {};
    const text = String(p.text || '').trim().slice(0, 4000);
    if (!text) return { ok: false, error: '写点内容再发吧' };
    const body = {
      type: ['bug', 'idea', 'other'].includes(p.type) ? p.type : 'other',
      text,
      contact: String(p.contact || '').trim().slice(0, 120),
      theme: String(p.theme || '').slice(0, 40),
      version,
      os: osLine(),
      diag: p.includeDiag ? diagText() : '',
      screenshot: p.includeShot && /^data:image\/jpeg;base64,/.test(String(p.screenshot || '')) && String(p.screenshot).length < 5.5e6 ? String(p.screenshot) : '',
    };
    if (!configured()) {
      queue(body);
      return { ok: false, queued: true, error: '反馈服务器还没配置，已先存在本机' };
    }
    const r = await post(body);
    if (r.ok) { flush().catch(() => {}); return { ok: true, id: r.id }; }
    if (r.network || (r.status && r.status >= 500)) { const q = queue(body); return { ok: false, queued: q, error: r.error }; }
    return { ok: false, error: r.error };
  });
}

module.exports = { installFeedback };
