#!/usr/bin/env node

/**
 * CDP 浏览器自动化执行器
 * 通过 Chrome DevTools Protocol 连接已运行的浏览器
 * 使用 Node.js 内置 WebSocket API，无需额外依赖
 *
 * 特性：复用匹配的自有标签，并仅清理不再使用的自有标签
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 配置
const CDP_HOST = process.env.CDP_HOST || '127.0.0.1';
const CDP_PORT = process.env.CDP_PORT || '9222';
const CDP_URL = `http://${CDP_HOST}:${CDP_PORT}`;

// 标签追踪文件路径
const TRACKER_FILE = path.join(os.tmpdir(), 'cdp-created-tabs.json');

// WebSocket 通信
let ws = null;
let msgId = 0;
const pending = new Map();

function cdpSend(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP 命令超时: ${method}`));
    }, 30000);

    pending.set(id, { resolve, reject, timeout });
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket 未连接'));
      return;
    }
    ws.send(JSON.stringify(msg));
  });
}

function getHttp(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`解析响应失败: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

async function connect() {
  const version = await getHttp(`${CDP_URL}/json/version`);
  const wsUrl = version.webSocketDebuggerUrl;

  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('WebSocket 连接失败'));
  });

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, timeout } = pending.get(msg.id);
        clearTimeout(timeout);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    } catch {}
  };

  return true;
}

async function getTargets() {
  return await getHttp(`${CDP_URL}/json`);
}

async function closeTarget(targetId) {
  try {
    await getHttp(`${CDP_URL}/json/close/${targetId}`);
    return true;
  } catch {
    return false;
  }
}

async function createTarget(url, background = true) {
  const result = await cdpSend('Target.createTarget', { url, background });
  return result.targetId;
}

async function attachToTarget(targetId) {
  const result = await cdpSend('Target.attachToTarget', { targetId, flatten: true });
  return result.sessionId;
}

async function detachFromTarget(sessionId) {
  await cdpSend('Target.detachFromTarget', { sessionId });
}

async function evaluate(expression, sessionId, awaitPromise = false) {
  const result = await cdpSend('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise
  }, sessionId);
  return result.result?.value;
}

async function captureScreenshot(sessionId, format = 'png') {
  const result = await cdpSend('Page.captureScreenshot', { format }, sessionId);
  return result.data;
}

// ========== 标签追踪 ==========

function loadTrackedTabs() {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      const data = fs.readFileSync(TRACKER_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {}
  return [];
}

function saveTrackedTabs(tabs) {
  try {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(tabs, null, 2));
  } catch {}
}

function addTrackedTab(targetId) {
  const tabs = loadTrackedTabs();
  if (!tabs.includes(targetId)) {
    tabs.push(targetId);
    saveTrackedTabs(tabs);
  }
}

async function closeTrackedTabs(keepIds = []) {
  const trackedTabs = loadTrackedTabs();
  let closedCount = 0;
  const keep = new Set(keepIds);
  const remaining = [];

  for (const targetId of trackedTabs) {
    if (keep.has(targetId)) {
      remaining.push(targetId);
      continue;
    }
    if (await closeTarget(targetId)) {
      closedCount++;
    } else {
      // 已关闭或失效的目标不再保留在追踪文件中。
    }
  }

  saveTrackedTabs(remaining);
  return closedCount;
}

async function prepareTarget(url, background = true) {
  const trackedIds = loadTrackedTabs();
  const targets = await getTargets();
  const reusable = targets.find(target =>
    target.type === 'page' && trackedIds.includes(target.id) && target.url === url
  );

  const closed = await closeTrackedTabs(reusable ? [reusable.id] : []);
  if (reusable) return { targetId: reusable.id, reused: true, closed };

  const targetId = await createTarget(url, background);
  addTrackedTab(targetId);
  return { targetId, reused: false, closed };
}

// ========== 命令实现 ==========

async function cmdExtract(url, options = {}) {
  const { wait = 5000 } = options;
  const target = await prepareTarget(url, true);
  const { targetId } = target;

  await new Promise(r => setTimeout(r, wait));

  const sessionId = await attachToTarget(targetId);

  // 提取页面文本
  const script = `
    (function() {
      const body = document.body.innerText || '';
      const lines = body.split('\\n').filter(l => l.trim());

      const pageLines = lines.map(line => line.trim());

      return JSON.stringify({
        title: document.title,
        url: document.location.href,
        lines: pageLines.slice(0, 200),
        totalLines: lines.length,
        closedPreviousTabs: ${target.closed},
        reusedTab: ${target.reused}
      });
    })()
  `;

  const result = await evaluate(script, sessionId);
  await detachFromTarget(sessionId);

  return JSON.parse(result || '{}');
}

async function cmdEval(url, jsCode, options = {}) {
  const { wait = 3000 } = options;
  const target = await prepareTarget(url, true);
  const { targetId } = target;

  await new Promise(r => setTimeout(r, wait));

  const sessionId = await attachToTarget(targetId);
  const result = await evaluate(jsCode, sessionId);
  await detachFromTarget(sessionId);

  return { result, closedPreviousTabs: target.closed, reusedTab: target.reused };
}

async function cmdScreenshot(url, outputPath, options = {}) {
  const { wait = 3000 } = options;

  const target = await prepareTarget(url, true);
  const { targetId } = target;

  await new Promise(r => setTimeout(r, wait));

  const sessionId = await attachToTarget(targetId);
  const data = await captureScreenshot(sessionId);
  await detachFromTarget(sessionId);

  fs.writeFileSync(outputPath, Buffer.from(data, 'base64'));

  return {
    path: outputPath,
    size: Buffer.from(data, 'base64').length,
    closedPreviousTabs: target.closed,
    reusedTab: target.reused
  };
}

async function cmdTabs(action, args = []) {
  const targets = await getTargets();
  const pages = targets.filter(t => t.type === 'page');

  if (action === 'list') {
    return pages.map(p => ({
      id: p.id,
      title: p.title,
      url: p.url
    }));
  }

  if (action === 'close') {
    const pattern = args[0] || '';
    const trackedIds = new Set(loadTrackedTabs());
    let closed = 0;
    const closedIds = new Set();
    for (const p of pages) {
      if (trackedIds.has(p.id) && p.url.includes(pattern)) {
        if (await closeTarget(p.id)) {
          closed++;
          closedIds.add(p.id);
        }
      }
    }
    saveTrackedTabs(loadTrackedTabs().filter(id => !closedIds.has(id)));
    return { closed, pattern, scope: 'tracked tabs only' };
  }

  if (action === 'close-id') {
    const targetId = args[0];
    if (!targetId || !pages.some(page => page.id === targetId)) {
      throw new Error('标签不存在；close-id 只会关闭明确指定的标签 ID');
    }
    const closed = await closeTarget(targetId);
    if (closed) saveTrackedTabs(loadTrackedTabs().filter(id => id !== targetId));
    return { closed: Number(closed), targetId };
  }

  if (action === 'close-tracked') {
    const closed = await closeTrackedTabs();
    return { closedTracked: closed };
  }

  if (action === 'open') {
    const background = args.includes('--background') || args.includes('-b');
    const url = args.find(arg => !arg.startsWith('-')) || 'about:blank';
    const target = await prepareTarget(url, background);
    return { ...target, url, background };
  }

  throw new Error(`未知的 tabs 操作: ${action}`);
}

async function cmdPing() {
  try {
    const version = await getHttp(`${CDP_URL}/json/version`);
    return {
      connected: true,
      browser: version.Browser,
      wsUrl: version.webSocketDebuggerUrl
    };
  } catch (e) {
    return {
      connected: false,
      error: e.message
    };
  }
}

async function cmdCleanup(keepIds = []) {
  const closed = await closeTrackedTabs(keepIds);
  return { cleanedUp: closed, keptTracked: keepIds };
}

// ========== 主程序 ==========

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
CDP 浏览器自动化执行器

用法:
  node cdp_executor.mjs <command> [args...]

命令:
  extract <url> [--wait <ms>]    提取页面文本（复用自有标签）
  eval <url> <js-code> [--wait <ms>]  执行 JavaScript（复用自有标签）
  screenshot <url> <output> [--wait <ms>]  截图（复用自有标签）
  tabs list                      列出所有标签
  tabs close <pattern>           关闭匹配的自有标签
  tabs close-id <targetId>       关闭明确指定的标签
  tabs close-tracked             关闭之前创建的所有标签
  tabs open <url> [--background] 打开或复用标签，并清理其他自有标签
  cleanup [--keep <id,id,...>]   清理自有标签，可保留指定标签
  ping                           测试连接

特性:
  - 只自动关闭本脚本创建并追踪的标签
  - 相同 URL 优先复用自有标签；清理其他自有标签
  - 通过临时文件追踪创建的标签 ID
  - 环境变量 CDP_HOST / CDP_PORT 可配置连接地址

环境变量:
  CDP_HOST  CDP 主机 (默认: 127.0.0.1)
  CDP_PORT  CDP 端口 (默认: 9222)
`);
    return;
  }

  try {
    // 连接 CDP
    if (command !== 'ping') {
      await connect();
    }

    let result;

    switch (command) {
      case 'extract': {
        const url = args[1];
        if (!url) throw new Error('缺少 URL 参数');

        const waitIdx = args.indexOf('--wait');
        const wait = waitIdx !== -1 ? parseInt(args[waitIdx + 1]) : 5000;

        result = await cmdExtract(url, { wait });
        break;
      }

      case 'eval': {
        const url = args[1];
        const jsCode = args[2];
        if (!url || !jsCode) throw new Error('缺少 URL 或 JS 代码参数');

        const waitIdx = args.indexOf('--wait');
        const wait = waitIdx !== -1 ? parseInt(args[waitIdx + 1]) : 3000;

        result = await cmdEval(url, jsCode, { wait });
        break;
      }

      case 'screenshot': {
        const url = args[1];
        const output = args[2];
        if (!url || !output) throw new Error('缺少 URL 或输出路径参数');

        const waitIdx = args.indexOf('--wait');
        const wait = waitIdx !== -1 ? parseInt(args[waitIdx + 1]) : 3000;

        result = await cmdScreenshot(url, output, { wait });
        break;
      }

      case 'tabs': {
        const action = args[1];
        if (!action) throw new Error('缺少 tabs 操作 (list/close/close-id/close-tracked/open)');
        result = await cmdTabs(action, args.slice(2));
        break;
      }

      case 'cleanup': {
        const keepIdx = args.indexOf('--keep');
        const keepIds = keepIdx === -1 ? [] : (args[keepIdx + 1] || '').split(',').filter(Boolean);
        result = await cmdCleanup(keepIds);
        break;
      }

      case 'ping': {
        result = await cmdPing();
        break;
      }

      default:
        throw new Error(`未知命令: ${command}`);
    }

    console.log(JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    }, null, 2));

  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
    process.exit(1);
  } finally {
    if (ws) {
      ws.close();
    }
  }
}

main();
