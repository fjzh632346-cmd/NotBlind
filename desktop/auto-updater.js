'use strict';
// ============================================================
// [二改 3.1.1] 软件内自动更新
//
// 流程：启动后检查 → 有新版就在后台下载 → 下完提示「重启更新」；
// 不点也没关系，下次正常退出时会静默装好。
//
// 线路：
//   · 版本信息 latest.yml（里面有安装包的 sha512 校验码）优先直连 GitHub 拿，
//     拿不到再走加速线路；
//   · 安装包按 package.json › notblind.update.mirrors 的顺序走加速线路，
//     某条线路下载失败自动换下一条，最后直连 GitHub；
//   · 下载完成后 electron-updater 会用 sha512 校验，对不上直接丢弃。
// 差量：新版 .blockmap 和当前版本的 .blockmap 都从各自版本的发布页取，
//   只下载变了的部分；线路不支持分段下载时自动退回整包下载。
// ============================================================

const { app, net } = require('electron');
const path = require('path');

let electronUpdater = null;
try {
  electronUpdater = require('electron-updater');
} catch (e) {
  electronUpdater = null;
}

const CHECK_DELAY_MS = 20 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const YML_TIMEOUT_MS = 8000;

function readUpdateConfig() {
  let pkg = {};
  try { pkg = require(path.join(__dirname, '..', 'package.json')); } catch (_) { pkg = {}; }
  const local = (pkg.notblind && pkg.notblind.update) || {};
  const owner = String(local.owner || '').trim();
  const repo = String(local.repo || '').trim();
  const mirrors = (Array.isArray(local.mirrors) ? local.mirrors : [])
    .map((item) => String(item || '').trim())
    .filter((item) => /^https:\/\//i.test(item))
    .map((item) => (item.endsWith('/') ? item : item + '/'))
    .slice(0, 6);
  return {
    enabled: local.disabled !== true && local.provider !== 'none' && !!owner && !!repo,
    owner,
    repo,
    mirrors,
    preferMirrors: local.preferMirrors !== false,
  };
}

function githubBase(config) {
  return `https://github.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/releases`;
}

// 线路列表：[{ label, wrap(url) }]
function buildLines(config) {
  const direct = { label: 'GitHub', wrap: (url) => url };
  const mirrored = config.mirrors.map((mirror, index) => ({
    label: '加速线路 ' + (index + 1),
    wrap: (url) => mirror + url,
  }));
  return config.preferMirrors ? mirrored.concat([direct]) : [direct].concat(mirrored);
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await net.fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': `NotBlind/${app.getVersion()}`, 'Cache-Control': 'no-cache' },
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = await resp.text();
    if (!text || text.length > 64 * 1024) throw new Error('BAD_YML_SIZE');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function createProviderClass(config, hooks) {
  const { Provider } = electronUpdater;
  const { parseUpdateInfo, resolveFiles } = require('electron-updater/out/providers/Provider');

  return class NotBlindUpdateProvider extends Provider {
    constructor(options, updater, runtimeOptions) {
      super({ ...runtimeOptions, isUseMultipleRangeRequest: false });
      this.updater = updater;
      this.lines = buildLines(config);
      this.lineIndex = 0;
      this.latestVersion = '';
    }

    get isUseMultipleRangeRequest() {
      return false;
    }

    currentLine() {
      return this.lines[this.lineIndex] || this.lines[this.lines.length - 1];
    }

    // 下载失败时换下一条线路；没有下一条了返回 false
    nextLine() {
      if (this.lineIndex >= this.lines.length - 1) return false;
      this.lineIndex += 1;
      return true;
    }

    resetLine() {
      this.lineIndex = 0;
    }

    tagBase(version) {
      return `${githubBase(config)}/download/v${encodeURIComponent(version)}/`;
    }

    async getLatestVersion() {
      const ymlUrl = `${githubBase(config)}/latest/download/latest.yml?t=${Date.now()}`;
      // 直连优先：校验码从 GitHub 本身拿，加速线路改不了它
      const sources = [{ label: 'GitHub', url: ymlUrl }].concat(
        config.mirrors.map((mirror, index) => ({ label: '加速线路 ' + (index + 1), url: mirror + ymlUrl }))
      );
      const failures = [];
      for (const source of sources) {
        try {
          const text = await fetchTextWithTimeout(source.url, YML_TIMEOUT_MS);
          const info = parseUpdateInfo(text, 'latest.yml', new URL(source.url));
          if (!info || !info.version) throw new Error('NO_VERSION');
          this.latestVersion = String(info.version);
          if (hooks && hooks.onInfoSource) hooks.onInfoSource(source.label);
          return info;
        } catch (e) {
          failures.push(source.label + ': ' + (e && e.message || e));
        }
      }
      const error = new Error('所有线路都连不上：' + failures.join('；'));
      error.code = 'NB_UPDATE_ALL_LINES_FAILED';
      throw error;
    }

    resolveFiles(updateInfo) {
      const version = String(updateInfo && updateInfo.version || this.latestVersion || '');
      const base = new URL(this.currentLine().wrap(this.tagBase(version)));
      return resolveFiles(updateInfo, base);
    }

    // 新旧 blockmap 各自去自己版本的发布页取（不用每次把旧 blockmap 重新上传）
    async getBlockMapFiles(fileUrl, oldVersion, newVersion) {
      const newUrl = new URL(fileUrl.href + '.blockmap');
      const fileName = decodeURIComponent(fileUrl.pathname.split('/').pop() || '');
      const oldName = fileName.split(newVersion).join(oldVersion);
      const oldUrl = new URL(this.currentLine().wrap(this.tagBase(oldVersion) + encodeURIComponent(oldName) + '.blockmap'));
      return [oldUrl, newUrl];
    }
  };
}

function createNotBlindAutoUpdater(options = {}) {
  const config = readUpdateConfig();
  const sendState = typeof options.sendState === 'function' ? options.sendState : () => {};
  const log = typeof options.log === 'function' ? options.log : (...args) => console.log('[AutoUpdate]', ...args);

  const state = {
    supported: false,
    reason: '',
    status: 'idle', // idle | checking | none | available | downloading | downloaded | error
    currentVersion: app.getVersion(),
    version: '',
    percent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
    line: '',
    infoSource: '',
    error: '',
  };

  function publish(patch) {
    Object.assign(state, patch || {});
    try { sendState({ ...state }); } catch (_) { }
  }

  if (!electronUpdater) {
    state.reason = 'electron-updater 未安装';
    return { getState: () => ({ ...state }), check: async () => ({ ...state }), download: async () => ({ ...state }), installNow: () => false, start: () => {} };
  }
  if (!app.isPackaged) {
    state.reason = '源码运行（未打包），不自动更新';
  } else if (!config.enabled) {
    state.reason = '未配置更新仓库';
  } else if (process.platform !== 'win32') {
    state.reason = '仅支持 Windows';
  }

  const updater = electronUpdater.autoUpdater;
  let provider = null;
  let restartRequested = false;
  let downloading = null;
  let checkTimer = null;

  updater.logger = {
    info: (...args) => log(...args),
    warn: (...args) => log('[warn]', ...args),
    error: (...args) => log('[error]', ...args),
    debug: () => {},
  };
  updater.autoDownload = false; // 自己控制下载，方便换线路
  updater.autoInstallOnAppQuit = true; // 下载好后，正常退出时静默安装
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.disableWebInstaller = true;

  if (!state.reason) {
    // 打包时 electron-builder 会生成 resources/app-update.yml（里面有缓存目录名）；
    // 万一没有，就在数据目录补一份，缓存目录名和安装器保存旧安装包的位置保持一致
    try {
      const fs = require('fs');
      const onDisk = path.join(process.resourcesPath || '', 'app-update.yml');
      if (!fs.existsSync(onDisk)) {
        const fallback = path.join(app.getPath('userData'), 'app-update.yml');
        fs.writeFileSync(fallback, [
          'provider: github',
          'owner: ' + config.owner,
          'repo: ' + config.repo,
          'updaterCacheDirName: notblind-updater',
          '',
        ].join('\n'), 'utf8');
        updater.updateConfigPath = fallback;
      }
    } catch (e) {
      log('app-update.yml fallback failed', e && e.message || e);
    }
    state.supported = true;
    const ProviderClass = createProviderClass(config, {
      onInfoSource: (label) => { state.infoSource = label; },
    });
    updater.setFeedURL({
      provider: 'custom',
      updateProvider: function NotBlindProviderFactory(opts, updaterRef, runtimeOptions) {
        provider = new ProviderClass(opts, updaterRef, runtimeOptions);
        return provider;
      },
    });
  }

  updater.on('download-progress', (progress) => {
    publish({
      status: 'downloading',
      percent: Math.max(0, Math.min(100, Number(progress && progress.percent) || 0)),
      transferred: Number(progress && progress.transferred) || 0,
      total: Number(progress && progress.total) || 0,
      bytesPerSecond: Number(progress && progress.bytesPerSecond) || 0,
    });
  });

  async function check() {
    if (!state.supported) return { ...state };
    if (state.status === 'downloading' || state.status === 'downloaded') return { ...state };
    publish({ status: 'checking', error: '' });
    try {
      const result = await updater.checkForUpdates();
      const info = result && result.updateInfo;
      const available = !!(result && result.isUpdateAvailable);
      if (!available) {
        publish({ status: 'none', version: info && info.version || state.currentVersion });
        return { ...state };
      }
      publish({ status: 'available', version: info.version, percent: 0 });
      download().catch(() => {});
      return { ...state };
    } catch (e) {
      publish({ status: 'error', error: String(e && e.message || e).slice(0, 300) });
      return { ...state };
    }
  }

  async function download() {
    if (!state.supported) return { ...state };
    if (state.status === 'downloaded') return { ...state };
    if (downloading) return downloading;
    downloading = (async () => {
      if (provider) provider.resetLine();
      for (;;) {
        const line = provider ? provider.currentLine().label : '';
        publish({ status: 'downloading', line, error: '' });
        try {
          await updater.downloadUpdate();
          publish({ status: 'downloaded', percent: 100 });
          return { ...state };
        } catch (e) {
          const message = String(e && e.message || e).slice(0, 300);
          log('download failed on', line, message);
          if (provider && provider.nextLine()) continue;
          publish({ status: 'error', error: message });
          return { ...state };
        }
      }
    })().finally(() => { downloading = null; });
    return downloading;
  }

  // 用户点「重启更新」：先走软件自己的退出清理（桌面模式要先安全拆掉），
  // 清理完到 will-quit 时再启动安装器，装完自动重新打开。
  function installNow(requestQuit) {
    if (state.status !== 'downloaded') return false;
    restartRequested = true;
    if (typeof requestQuit === 'function') requestQuit();
    else app.quit();
    return true;
  }

  app.on('will-quit', () => {
    if (!restartRequested || state.status !== 'downloaded') return;
    try {
      updater.quitAndInstall(true, true);
    } catch (e) {
      log('quitAndInstall failed', e && e.message || e);
    }
  });

  function start() {
    if (!state.supported) {
      log('disabled:', state.reason);
      return;
    }
    if (checkTimer) return;
    setTimeout(() => { check().catch(() => {}); }, CHECK_DELAY_MS);
    checkTimer = setInterval(() => { check().catch(() => {}); }, CHECK_INTERVAL_MS);
    if (checkTimer.unref) checkTimer.unref();
  }

  return {
    getState: () => ({ ...state }),
    check,
    download,
    installNow,
    start,
  };
}

module.exports = { createNotBlindAutoUpdater };
