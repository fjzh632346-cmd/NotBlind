'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOGIN_EASTER_EGG_GATE_VERSION = 'world-peace-v1';
const LOGIN_EASTER_EGG_STATE_FILE = 'login-easter-egg.json';
const LOGIN_EASTER_EGG_PASSWORD = '世界和平';
const LOGIN_EASTER_EGG_CREDENTIAL_FILES = [
  '.cookie',
  '.qq-cookie',
  '.kugou-cookie',
  '.kugou-vip-evidence.json',
  '.qishui-cookie',
  '.qishui-token',
  '.spotify-token.json',
];

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch (_) {
    return {};
  }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tempFile, file);
}

function securePasswordMatch(input) {
  const expected = Buffer.from(LOGIN_EASTER_EGG_PASSWORD, 'utf8');
  const received = Buffer.from(String(input || ''), 'utf8');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

// [二改][登录彩蛋] Not Blind 不再在登录前设口令门（原版 Mineradio 要先点眼睛 5 下、输入「世界和平」才能登录，
// 新用户根本想不到，还会每次启动清掉没解锁用户的登录）。现在 gated:false（Not Blind 默认）：
//   - 登录随时可用，启动时不清任何登录；
//   - 「世界和平」的动画改成第一次登录成功后自动播放一次（celebrated 记在同一个状态文件里）；
//   - 「退出登录」仍然清掉全部平台的登录，并让下次登录成功时再播一次。
// gated:true（不传时的默认）保留原版行为（测试和想要原版体验的人用）。
class LoginEasterEggGate {
  constructor(options = {}) {
    this.userDataPath = path.resolve(String(options.userDataPath || '.'));
    this.credentialRoots = options.credentialRoots || [];
    this.stateFile = path.join(this.userDataPath, LOGIN_EASTER_EGG_STATE_FILE);
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.gated = options.gated !== false;
    this.state = this.readState();
  }

  // 用过原版口令门并解锁过的老用户，等于已经看过动画
  celebrated() {
    return this.state.celebrated === true || this.state.unlocked === true;
  }

  gatelessStatus(extra = {}) {
    return Object.assign({
      ok: true,
      gateVersion: LOGIN_EASTER_EGG_GATE_VERSION,
      gateless: true,
      unlocked: true,
      resetComplete: true,
      celebrated: this.celebrated(),
    }, extra);
  }

  readState() {
    const raw = safeReadJson(this.stateFile);
    return {
      schema: 1,
      gateVersion: String(raw.gateVersion || ''),
      cookieResetVersion: String(raw.cookieResetVersion || ''),
      resetComplete: raw.resetComplete === true,
      unlocked: raw.unlocked === true,
      resetAt: Number(raw.resetAt || 0) || 0,
      unlockedAt: Number(raw.unlockedAt || 0) || 0,
      resetError: String(raw.resetError || ''),
      celebrated: raw.celebrated === true,
      celebratedAt: Number(raw.celebratedAt || 0) || 0,
    };
  }

  writeState(next) {
    this.state = Object.assign({}, this.state, next, { schema: 1 });
    writeJsonAtomic(this.stateFile, this.state);
    return this.state;
  }

  publicStatus() {
    if (!this.gated) return this.gatelessStatus();
    return {
      ok: true,
      gateVersion: LOGIN_EASTER_EGG_GATE_VERSION,
      unlocked: this.state.gateVersion === LOGIN_EASTER_EGG_GATE_VERSION && this.state.unlocked === true,
      resetComplete: this.state.gateVersion === LOGIN_EASTER_EGG_GATE_VERSION && this.state.resetComplete === true,
    };
  }

  isUnlocked() {
    if (!this.gated) return true;
    const status = this.publicStatus();
    return status.unlocked && status.resetComplete;
  }

  resolveCredentialRoots() {
    let extraRoots = this.credentialRoots;
    if (typeof extraRoots === 'function') extraRoots = extraRoots();
    if (!Array.isArray(extraRoots)) extraRoots = [extraRoots];
    const roots = [this.userDataPath].concat(extraRoots || []);
    return Array.from(new Set(roots.filter(Boolean).map((root) => path.resolve(String(root)))));
  }

  clearCredentialFiles() {
    for (const root of this.resolveCredentialRoots()) {
      for (const name of LOGIN_EASTER_EGG_CREDENTIAL_FILES) {
        const file = path.join(root, name);
        try {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        } catch (error) {
          throw new Error(`LOGIN_CREDENTIAL_CLEAR_FAILED:${file}:${error.message}`);
        }
      }
    }
  }

  async clearCredentialState(clearProviderSessions) {
    this.clearCredentialFiles();
    if (typeof clearProviderSessions === 'function') await clearProviderSessions();
    // Logout handlers may flush an empty or stale in-memory store while the
    // provider sessions are closing. The second pass also removes migration
    // copies so a later launch cannot restore an old credential.
    this.clearCredentialFiles();
  }

  async initialize(clearProviderSessions) {
    this.state = this.readState();
    // 不设口令门：启动时什么都不清
    if (!this.gated) return this.gatelessStatus({ resetPerformed: false });
    if (
      this.state.gateVersion === LOGIN_EASTER_EGG_GATE_VERSION &&
      this.state.cookieResetVersion === LOGIN_EASTER_EGG_GATE_VERSION &&
      this.state.resetComplete
    ) {
      if (!this.state.unlocked) {
        try {
          await this.clearCredentialState(clearProviderSessions);
        } catch (error) {
          const resetError = String(error && error.message || error || 'LOGIN_SESSION_RESET_FAILED');
          try {
            this.writeState({ cookieResetVersion: '', resetComplete: false, resetError });
          } catch (_) {
            this.state = Object.assign({}, this.state, { cookieResetVersion: '', resetComplete: false, resetError });
          }
          return Object.assign({ resetPerformed: false, error: resetError }, this.publicStatus());
        }
      }
      return Object.assign({ resetPerformed: false }, this.publicStatus());
    }

    let resetError = '';
    try {
      await this.clearCredentialState(clearProviderSessions);
    } catch (error) {
      resetError = String(error && error.message || error || 'LOGIN_SESSION_RESET_FAILED');
    }

    const nextState = {
      gateVersion: LOGIN_EASTER_EGG_GATE_VERSION,
      cookieResetVersion: resetError ? '' : LOGIN_EASTER_EGG_GATE_VERSION,
      resetComplete: !resetError,
      unlocked: false,
      resetAt: this.now(),
      unlockedAt: 0,
      resetError,
    };
    try {
      this.writeState(nextState);
    } catch (error) {
      resetError = `LOGIN_EASTER_EGG_STATE_WRITE_FAILED:${error.message}`;
      this.state = Object.assign({}, this.state, nextState, {
        cookieResetVersion: '',
        resetComplete: false,
        resetError,
      });
    }
    return Object.assign({ resetPerformed: true, error: resetError || '' }, this.publicStatus());
  }

  async resetForReplay(clearProviderSessions) {
    this.state = this.readState();
    if (!this.gated) {
      // 「退出登录」：清掉所有平台的登录，下次登录成功时再播一次「世界和平」
      let clearError = '';
      try {
        await this.clearCredentialState(clearProviderSessions);
      } catch (error) {
        clearError = String(error && error.message || error || 'LOGIN_SESSION_RESET_FAILED');
      }
      try {
        this.writeState({ celebrated: false, celebratedAt: 0, unlocked: false, unlockedAt: 0 });
      } catch (_) { }
      return this.gatelessStatus({
        ok: !clearError,
        resetPerformed: true,
        replayReset: true,
        resetComplete: !clearError,
        celebrated: false,
        error: clearError,
      });
    }
    let resetError = '';
    try {
      await this.clearCredentialState(clearProviderSessions);
    } catch (error) {
      resetError = String(error && error.message || error || 'LOGIN_SESSION_RESET_FAILED');
    }
    const nextState = {
      gateVersion: LOGIN_EASTER_EGG_GATE_VERSION,
      cookieResetVersion: resetError ? '' : LOGIN_EASTER_EGG_GATE_VERSION,
      resetComplete: !resetError,
      unlocked: false,
      resetAt: this.now(),
      unlockedAt: 0,
      resetError,
    };
    try {
      this.writeState(nextState);
    } catch (error) {
      resetError = `LOGIN_EASTER_EGG_STATE_WRITE_FAILED:${error.message}`;
      this.state = Object.assign({}, this.state, nextState, {
        cookieResetVersion: '',
        resetComplete: false,
        resetError,
      });
    }
    return Object.assign({ resetPerformed: true, replayReset: true, error: resetError || '' }, this.publicStatus());
  }

  // 不设口令门时：渲染端播完「世界和平」动画后调用，记下"已经庆祝过"
  markCelebrated() {
    this.state = this.readState();
    try {
      this.writeState({ celebrated: true, celebratedAt: this.now() });
    } catch (error) {
      return this.gatelessStatus({ ok: false, error: 'LOGIN_EASTER_EGG_STATE_WRITE_FAILED' });
    }
    return this.gatelessStatus();
  }

  unlock(input) {
    this.state = this.readState();
    if (!this.gated) return this.markCelebrated();
    if (!this.state.resetComplete || this.state.gateVersion !== LOGIN_EASTER_EGG_GATE_VERSION) {
      return { ok: false, unlocked: false, error: 'LOGIN_EASTER_EGG_RESET_INCOMPLETE' };
    }
    if (!securePasswordMatch(input)) {
      return { ok: false, unlocked: false, error: 'LOGIN_EASTER_EGG_INVALID' };
    }
    try {
      this.writeState({ unlocked: true, unlockedAt: this.now(), resetError: '' });
    } catch (error) {
      return {
        ok: false,
        unlocked: false,
        error: 'LOGIN_EASTER_EGG_STATE_WRITE_FAILED',
        message: String(error && error.message || error),
      };
    }
    return this.publicStatus();
  }
}

module.exports = {
  LoginEasterEggGate,
  LOGIN_EASTER_EGG_GATE_VERSION,
  LOGIN_EASTER_EGG_STATE_FILE,
  LOGIN_EASTER_EGG_CREDENTIAL_FILES,
  securePasswordMatch,
};
