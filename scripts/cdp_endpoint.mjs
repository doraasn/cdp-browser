/**
 * CDP 端点发现
 * 优先用 CDP_PORT 指定的端口；否则依次检查 9222、运行中且带 --remote-debugging-port 的**有界面**浏览器，
 * 这样能接管用户已经开着调试端口的浏览器（包括他本人的标签），又不会误连别的项目跑着的 headless 实例。
 * 可用 CDP_IGNORE_PORTS 排除端口，CDP_INCLUDE_HEADLESS=1 把 headless 实例也纳入候选。
 */

import http from 'node:http';
import { execFileSync } from 'node:child_process';

export function getVersion(port, host = '127.0.0.1', timeout = 1200) {
  return new Promise(resolve => {
    const request = http.get({ host, port, path: '/json/version', timeout }, response => {
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

// 从进程命令行里解析出 [{ port, headless }]：同一端口只要有一个非 headless 进程就按有界面算。
export function parseRunningBrowsers(text) {
  const byPort = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/--remote-debugging-port=(\d{1,5})/);
    if (!match) continue;
    const port = Number(match[1]);
    if (!Number.isInteger(port) || port <= 0 || port >= 65536) continue;
    const headless = /--headless(?:\s|=|$)/.test(line);
    const previous = byPort.get(port);
    byPort.set(port, previous === undefined ? headless : (previous && headless));
  }
  return [...byPort.entries()].map(([port, headless]) => ({ port, headless }));
}

// 兼容旧接口：只返回端口。
export function parseDebugPorts(text) {
  return parseRunningBrowsers(text).map(item => item.port);
}

export function listRunningBrowsers() {
  try {
    if (process.platform === 'win32') {
      const output = execFileSync('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' or Name='msedge.exe' or Name='brave.exe' or Name='chromium.exe' or Name='vivaldi.exe'\" | Select-Object -ExpandProperty CommandLine"
      ], { encoding: 'utf8', windowsHide: true, timeout: 6000 });
      return parseRunningBrowsers(output);
    }
    const output = execFileSync('ps', ['-ax', '-o', 'command='], { encoding: 'utf8', timeout: 6000 });
    return parseRunningBrowsers(output);
  } catch {
    return [];
  }
}

// 纯函数：决定探测顺序。有界面实例优先，headless 默认跳过，避免连到别的项目的自动化实例。
export function rankCandidatePorts(browsers, { preferredPort, ignorePorts = [], includeHeadless = false } = {}) {
  const ignored = new Set(ignorePorts);
  const ports = [];
  const push = port => {
    if (!port || ignored.has(port) || ports.includes(port)) return;
    ports.push(port);
  };

  if (preferredPort) push(preferredPort);
  push(9222);
  for (const item of browsers) if (!item.headless) push(item.port);
  if (includeHeadless) for (const item of browsers) push(item.port);
  return ports;
}

/**
 * 返回 { port, host, browser, wsUrl, source } 或 null。
 * source: 'CDP_PORT' | 'default' | 'running-browser'
 */
export async function detectEndpoint({ host = '127.0.0.1', preferredPort } = {}) {
  const ignorePorts = (process.env.CDP_IGNORE_PORTS || '')
    .split(',')
    .map(value => Number(value.trim()))
    .filter(port => Number.isInteger(port) && port > 0);
  const includeHeadless = /^(1|true|yes)$/i.test(process.env.CDP_INCLUDE_HEADLESS || '');

  const candidates = rankCandidatePorts(listRunningBrowsers(), {
    preferredPort,
    ignorePorts,
    includeHeadless
  });

  for (const port of candidates) {
    const version = await getVersion(port, host);
    if (!version) continue;
    const source = port === preferredPort ? 'CDP_PORT' : (port === 9222 ? 'default' : 'running-browser');
    return { port, host, browser: version.Browser, wsUrl: version.webSocketDebuggerUrl, source };
  }
  return null;
}
