'use strict';

// [二改][桌面模式 Esc] 前台窗口观察器（只在完整桌面模式里运行）
//
// 桌面模式原来把 Esc 注册成"全局快捷键"来退出：Windows 的全局快捷键会把按键整个抢走，
// 于是用户在别的软件里按 Esc（关对话框、退出全屏……）也会把桌面模式退掉，那个软件还收不到 Esc。
// 这里起一个很小的 PowerShell 进程，每 120ms 看一次"现在最前面的是哪个窗口"，只在变化时报告一行：
//   FG|<窗口句柄>|<进程号>|<窗口类名>
// 主进程据此只在"桌面（Progman / WorkerW）或 Not Blind 自己在最前面"时才注册 Esc，别的软件在前面时让出来。
// 只读：不挂键盘钩子、不看按键，只问系统"前台窗口是谁"。Not Blind 退出后它自己也会在 1 秒内结束。

const { spawn } = require('child_process');

const DESKTOP_FOREGROUND_CLASSES = new Set(['Progman', 'WorkerW']);

function foregroundWatchCSharpSource() {
  return String.raw`
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class NotBlindForegroundWatch {
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  public static void Run(int ownerProcessId, int intervalMs) {
    int interval = Math.Max(60, Math.Min(1000, intervalMs));
    string last = null;
    StringBuilder name = new StringBuilder(256);
    Stopwatch clock = Stopwatch.StartNew();
    long nextOwnerCheck = 0;
    while (true) {
      IntPtr hwnd = GetForegroundWindow();
      uint pid = 0;
      string cls = "";
      if (hwnd != IntPtr.Zero) {
        name.Length = 0;
        GetClassName(hwnd, name, name.Capacity);
        cls = name.ToString().Replace("|", "_");
        GetWindowThreadProcessId(hwnd, out pid);
      }
      string line = "FG|" + hwnd.ToInt64() + "|" + pid + "|" + cls;
      if (line != last) {
        last = line;
        Console.Out.WriteLine(line);
        Console.Out.Flush();
      }
      if (clock.ElapsedMilliseconds >= nextOwnerCheck) {
        nextOwnerCheck = clock.ElapsedMilliseconds + 1000;
        try {
          if (Process.GetProcessById(ownerProcessId).HasExited) return;
        } catch {
          return;
        }
      }
      Thread.Sleep(interval);
    }
  }
}
`;
}

function foregroundWatchScript(options = {}) {
  const ownerProcessId = Math.max(1, Math.round(Number(options.ownerProcessId) || process.pid));
  const intervalMs = Math.max(60, Math.min(1000, Math.round(Number(options.intervalMs) || 120)));
  return `$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
${foregroundWatchCSharpSource()}
"@
[NotBlindForegroundWatch]::Run(${ownerProcessId}, ${intervalMs})
`;
}

function parseForegroundLine(line) {
  const text = String(line || '').trim();
  if (!text.startsWith('FG|')) return null;
  const parts = text.split('|');
  if (parts.length < 4) return null;
  const hwnd = String(parts[1] || '0');
  const pid = Number(parts[2]) || 0;
  const className = parts.slice(3).join('|');
  return { hwnd, pid, className, empty: hwnd === '0' };
}

class ForegroundWatch {
  constructor(options = {}) {
    this.options = options;
    this.child = null;
    this.state = null;
    this.stdoutBuffer = '';
    this.startedAt = 0;
    this.failures = 0;
    this.lastError = '';
  }

  isRunning() {
    return !!(this.child && this.child.exitCode === null && !this.child.killed);
  }

  // 有没有拿到过真实的前台信息（没拿到时调用方按原来的方式处理）
  hasState() {
    return this.isRunning() && !!this.state;
  }

  start() {
    if (this.isRunning()) return true;
    if (process.platform !== 'win32' && !this.options.spawnImpl) return false;
    const spawnImpl = this.options.spawnImpl || spawn;
    const env = { ...process.env };
    const nativeTempPath = String(this.options.nativeTempPath || '').trim();
    if (nativeTempPath) {
      env.TEMP = nativeTempPath;
      env.TMP = nativeTempPath;
    }
    let child;
    try {
      child = spawnImpl(
        String(this.options.powershellPath || 'powershell.exe'),
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', foregroundWatchScript({
          ownerProcessId: this.options.ownerProcessId || process.pid,
          intervalMs: this.options.intervalMs || 120,
        })],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env }
      );
    } catch (error) {
      this.failures += 1;
      this.lastError = String(error && error.message || error || 'FOREGROUND_WATCH_SPAWN_FAILED');
      return false;
    }
    this.child = child;
    this.state = null;
    this.stdoutBuffer = '';
    this.startedAt = Date.now();
    const onLine = (line) => {
      const next = parseForegroundLine(line);
      if (!next) return;
      const prev = this.state;
      this.state = next;
      if (typeof this.options.onChange === 'function') {
        try { this.options.onChange(next, prev); } catch (_) { }
      }
    };
    if (child.stdout) {
      child.stdout.setEncoding && child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        this.stdoutBuffer += String(chunk || '');
        const lines = this.stdoutBuffer.split(/\r?\n/);
        this.stdoutBuffer = lines.pop() || '';
        lines.forEach(onLine);
      });
    }
    let stderrText = '';
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        if (stderrText.length < 2000) stderrText += String(chunk || '');
      });
    }
    child.on('error', (error) => {
      this.lastError = String(error && error.message || error || 'FOREGROUND_WATCH_ERROR');
    });
    child.on('exit', (code) => {
      if (this.child !== child) return;
      this.child = null;
      this.state = null;
      if (code !== 0 && code !== null) {
        this.failures += 1;
        this.lastError = (stderrText.trim().split(/\r?\n/).pop() || `FOREGROUND_WATCH_EXIT_${code}`).slice(0, 200);
      }
      if (typeof this.options.onExit === 'function') {
        try { this.options.onExit({ code, error: this.lastError }); } catch (_) { }
      }
    });
    return true;
  }

  stop() {
    const child = this.child;
    this.child = null;
    this.state = null;
    if (child) {
      try { child.kill(); } catch (_) { }
    }
  }

  // 前台是不是"桌面"或者 Not Blind 自己
  foregroundIsDesktopOrSelf(selfPids = [process.pid]) {
    const st = this.state;
    if (!st) return true;
    if (st.empty) return true;
    if (selfPids.includes(st.pid)) return true;
    return DESKTOP_FOREGROUND_CLASSES.has(st.className);
  }

  foregroundIsDesktop() {
    const st = this.state;
    if (!st) return false;
    return st.empty || DESKTOP_FOREGROUND_CLASSES.has(st.className);
  }
}

module.exports = {
  ForegroundWatch,
  foregroundWatchScript,
  parseForegroundLine,
  DESKTOP_FOREGROUND_CLASSES,
};
