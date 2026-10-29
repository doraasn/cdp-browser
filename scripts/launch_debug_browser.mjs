#!/usr/bin/env node

/**
 * 启动独立调试实例
 * 默认配置不再开放远程调试端口，因此统一用独立 profile 启动一个可调试的浏览器，
 * 不动用户正在使用的浏览器窗口与配置。端口已可用时直接复用，不再拉起新实例。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';

const HOST = process.env.CDP_HOST || '127.0.0.1';
const PORT = Number(process.env.CDP_PORT || 9222);
const PROFILE_DIR = process.env.CDP_PROFILE_DIR
  || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache'), 'cdp-browser-profile');
const START_TIMEOUT_MS = 25000;

const CANDIDATES = [
  process.env.CDP_BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'CentBrowser', 'Application', 'chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/microsoft-edge'
].filter(Boolean);

function print(data) {
  console.log(JSON.stringify({ success: true, data, timestamp: new Date().toISOString() }, null, 2));
}

function fail(message, extra = {}) {
  console.error(JSON.stringify({ success: false, error: message, data: extra, timestamp: new Date().toISOString() }, null, 2));
  process.exit(1);
}

function getVersion() {
  return new Promise(resolve => {
    const request = http.get({ host: HOST, port: PORT, path: '/json/version', timeout: 1500 }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    request.on('timeout', () => { request.destroy(); resolve(null); });
    request.on('error', () => resolve(null));
  });
}

function readRegistry(key, valueName) {
  const args = valueName ? ['query', key, '/v', valueName] : ['query', key, '/ve'];
  try {
    const output = execFileSync('reg', args, { encoding: 'utf8', windowsHide: true });
    const line = output.split(/\r?\n/).find(item => /REG_(?:EXPAND_)?SZ/.test(item));
    if (!line) return null;
    return line.replace(/^.*?REG_(?:EXPAND_)?SZ\s+/, '').trim() || null;
  } catch {
    return null;
  }
}

// 取系统默认浏览器的可执行文件；解析不到就返回 null，由候选列表兜底。
function detectDefaultBrowser() {
  if (process.platform !== 'win32') return null;
  const assoc = 'Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations';
  const progId = readRegistry(`HKCU\\${assoc}\\https\\UserChoice`, 'ProgId')
    || readRegistry(`HKCU\\${assoc}\\http\\UserChoice`, 'ProgId');
  if (!progId) return null;

  const command = readRegistry(`HKCU\\Software\\Classes\\${progId}\\shell\\open\\command`)
    || readRegistry(`HKCR\\${progId}\\shell\\open\\command`);
  if (!command) return null;

  const match = command.match(/^"([^"]+\.exe)"/i) || command.match(/^(\S+\.exe)/i);
  if (!match) return null;
  try {
    return fs.existsSync(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}

function detectBrowser() {
  const preferred = process.env.CDP_BROWSER_PATH || detectDefaultBrowser();
  if (preferred) {
    try { if (fs.existsSync(preferred)) return preferred; } catch {}
  }
  return CANDIDATES.find(candidate => {
    try { return fs.existsSync(candidate); } catch { return false; }
  }) || null;
}

async function waitForVersion(deadline) {
  while (Date.now() < deadline) {
    const version = await getVersion();
    if (version) return version;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return null;
}

async function main() {
  const existing = await getVersion();
  if (existing) {
    print({
      launched: false,
      reused: true,
      host: HOST,
      port: PORT,
      browser: existing.Browser,
      wsUrl: existing.webSocketDebuggerUrl
    });
    return;
  }

  const browser = detectBrowser();
  if (!browser) {
    fail('未找到 Chrome / Edge / CentBrowser，可用 CDP_BROWSER_PATH 指定浏览器可执行文件路径', {
      host: HOST,
      port: PORT
    });
  }

  const args = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ];

  try {
    if (process.platform === 'win32') {
      // 用 PowerShell 的 Start-Process 拉起浏览器：它走 ShellExecute 且立即返回，
      // 不会让浏览器继承调用方的 stdout 句柄，避免调用方一直等子进程退出。
      const quote = value => `'${String(value).replace(/'/g, "''")}'`;
      const script = `Start-Process -FilePath ${quote(browser)} -ArgumentList @(${args.map(quote).join(',')})`;
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], {
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
    } else {
      const child = spawn(browser, args, { detached: true, stdio: 'ignore' });
      child.unref();
    }
  } catch (error) {
    fail(`启动浏览器失败: ${error.message}`, { browser, args });
  }

  const version = await waitForVersion(Date.now() + START_TIMEOUT_MS);
  if (!version) {
    fail(`调试端口 ${PORT} 在 ${START_TIMEOUT_MS / 1000}s 内未就绪，可能被占用或浏览器启动失败；可换端口：CDP_PORT=9223`, {
      browser,
      profile: PROFILE_DIR,
      port: PORT
    });
  }

  print({
    launched: true,
    reused: false,
    host: HOST,
    port: PORT,
    browser: version.Browser,
    executable: browser,
    profile: PROFILE_DIR,
    wsUrl: version.webSocketDebuggerUrl,
    note: '这是独立配置，原浏览器窗口的标签不可见、登录态不继承，首次需要在该窗口内重新登录'
  });
}

main().catch(error => fail(error.message));
