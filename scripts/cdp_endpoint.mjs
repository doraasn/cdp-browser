/**
 * CDP 端点发现
 * 优先用 CDP_PORT 指定的端口；否则依次检查 9222 和"正在运行且带 --remote-debugging-port 的浏览器"，
 * 这样能直接接管用户已经开着调试端口的浏览器（包括他本人的标签），而不是另起一个隔离实例。
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

// 从进程命令行里提取 --remote-debugging-port（去重、过滤非法值）。
export function parseDebugPorts(text) {
  const ports = new Set();
  for (const match of String(text).matchAll(/--remote-debugging-port=(\d{1,5})/g)) {
    const port = Number(match[1]);
    if (Number.isInteger(port) && port > 0 && port < 65536) ports.add(port);
  }
  return [...ports];
}

export function listRunningBrowserPorts() {
  try {
    if (process.platform === 'win32') {
      const output = execFileSync('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' or Name='msedge.exe' or Name='brave.exe' or Name='chromium.exe' or Name='vivaldi.exe'\" | Select-Object -ExpandProperty CommandLine"
      ], { encoding: 'utf8', windowsHide: true, timeout: 6000 });
      return parseDebugPorts(output);
    }
    const output = execFileSync('ps', ['-ax', '-o', 'command='], { encoding: 'utf8', timeout: 6000 });
    return parseDebugPorts(output);
  } catch {
    return [];
  }
}

/**
 * 返回 { port, host, browser, wsUrl, source } 或 null。
 * source: 'CDP_PORT' | 'default' | 'running-browser'
 */
export async function detectEndpoint({ host = '127.0.0.1', preferredPort } = {}) {
  const candidates = [];
  if (preferredPort) candidates.push(preferredPort);
  if (!candidates.includes(9222)) candidates.push(9222);
  for (const port of listRunningBrowserPorts()) {
    if (!candidates.includes(port)) candidates.push(port);
  }

  for (const port of candidates) {
    const version = await getVersion(port, host);
    if (!version) continue;
    const source = port === preferredPort ? 'CDP_PORT' : (port === 9222 ? 'default' : 'running-browser');
    return { port, host, browser: version.Browser, wsUrl: version.webSocketDebuggerUrl, source };
  }
  return null;
}
