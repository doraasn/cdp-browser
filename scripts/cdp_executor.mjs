#!/usr/bin/env node

/**
 * CDP 浏览器自动化执行器
 * 通过 Chrome DevTools Protocol 连接已运行的浏览器
 * 使用 Node.js 内置 WebSocket API，无需额外依赖
 *
 * 特性：默认后台新建、按 URL 复用自有标签、任务结束后统一清理；不抢占焦点，不关闭用户标签
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getPageSnapshot } from './page_snapshot.mjs';
import { createDomActions } from './dom_actions.mjs';
import { detectEndpoint } from './cdp_endpoint.mjs';

// 配置
const CDP_HOST = process.env.CDP_HOST || '127.0.0.1';
let CDP_PORT = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : null;
let CDP_URL = CDP_PORT ? `http://${CDP_HOST}:${CDP_PORT}` : null;

// 未显式指定端口时，按 9222 → 运行中浏览器的调试端口 顺序发现端点。
async function resolveEndpoint() {
  if (CDP_PORT) return { port: CDP_PORT, source: 'CDP_PORT' };
  const found = await detectEndpoint({ host: CDP_HOST });
  if (!found) return null;
  CDP_PORT = found.port;
  CDP_URL = `http://${CDP_HOST}:${CDP_PORT}`;
  return found;
}

// 按浏览器实例隔离标签追踪，避免不同配置或重启后的旧 ID 互相影响。
let trackerFile = null;
let trackerLockFile = null;

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
  const endpoint = await resolveEndpoint();
  if (!endpoint) throw new Error('未找到可用的调试端口：已检查 CDP_PORT、9222 和运行中浏览器的 --remote-debugging-port');
  const version = await getHttp(`${CDP_URL}/json/version`);
  const wsUrl = version.webSocketDebuggerUrl;
  const browserWsUrl = new URL(wsUrl);
  const browserInstanceId = browserWsUrl.pathname.split('/').filter(Boolean).pop() || 'unknown';
  const trackerScope = crypto.createHash('sha256')
    .update(`${browserWsUrl.host}|${version.Browser}|${browserInstanceId}`)
    .digest('hex')
    .slice(0, 20);
  trackerFile = path.join(os.tmpdir(), `cdp-created-tabs-${trackerScope}.json`);
  trackerLockFile = `${trackerFile}.lock`;

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

// Chrome 111+ 只接受 PUT /json/close/<id>，旧版本用 GET；两者都试，按状态码判定结果。
function requestClose(targetId, method) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: CDP_HOST,
      port: CDP_PORT,
      path: `/json/close/${targetId}`,
      method
    }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.setTimeout(5000, () => request.destroy(new Error('关闭标签超时')));
    request.on('error', reject);
    request.end();
  });
}

// 返回 'closed' | 'gone' | 'failed'。
async function closeTarget(targetId) {
  let statusCode;
  for (const method of ['PUT', 'GET']) {
    try {
      statusCode = await requestClose(targetId, method);
      if (statusCode >= 200 && statusCode < 300) return 'closed';
      if (statusCode === 404) return 'gone';
    } catch {}
  }
  return statusCode === 404 ? 'gone' : 'failed';
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

async function evaluate(expression, sessionId) {
  const result = await cdpSend('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || '页面脚本执行失败');
  }
  return result.result?.value;
}

async function captureScreenshot(sessionId, format = 'png') {
  const result = await cdpSend('Page.captureScreenshot', { format }, sessionId);
  return result.data;
}

// ========== 标签追踪 ==========

function loadTrackedTabs() {
  try {
    if (fs.existsSync(trackerFile)) {
      const data = JSON.parse(fs.readFileSync(trackerFile, 'utf-8'));
      return Array.isArray(data) ? data.filter(id => typeof id === 'string') : [];
    }
  } catch {}
  return [];
}

function saveTrackedTabs(tabs) {
  const tempFile = `${trackerFile}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(tabs, null, 2));
  fs.renameSync(tempFile, trackerFile);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function withTrackerLock(operation) {
  if (!trackerLockFile) throw new Error('标签追踪尚未初始化');
  const deadline = Date.now() + 15000;
  let lockFd;

  while (!lockFd) {
    try {
      lockFd = fs.openSync(trackerLockFile, 'wx');
      fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
    } catch (error) {
      if (lockFd !== undefined) {
        try { fs.closeSync(lockFd); } catch {}
        lockFd = undefined;
        try { fs.unlinkSync(trackerLockFile); } catch {}
      }
      if (error.code !== 'EEXIST') throw error;
      try {
        const lock = JSON.parse(fs.readFileSync(trackerLockFile, 'utf-8'));
        if (!isProcessAlive(lock.pid) && Date.now() - fs.statSync(trackerLockFile).mtimeMs > 30000) {
          fs.unlinkSync(trackerLockFile);
          continue;
        }
      } catch (readError) {
        if (readError.code === 'ENOENT') continue;
      }
      if (Date.now() >= deadline) throw new Error('等待标签追踪锁超时');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  try {
    return await operation();
  } finally {
    fs.closeSync(lockFd);
    try { fs.unlinkSync(trackerLockFile); } catch {}
  }
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
  const keep = new Set(keepIds);
  const remaining = [];
  const failed = [];
  let closedCount = 0;

  for (const targetId of trackedTabs) {
    if (keep.has(targetId)) {
      remaining.push(targetId);
      continue;
    }
    const outcome = await closeTarget(targetId);
    if (outcome === 'closed') closedCount++;
    else if (outcome === 'failed') failed.push(targetId);
    // closed / gone 都不再保留；failed 留待下次清理重试。
  }

  saveTrackedTabs(remaining.concat(failed));
  return { closed: closedCount, failed };
}

async function prepareTarget(url, options = {}) {
  const { targetId: requestedTargetId = null, background = true } = options;

  return withTrackerLock(async () => {
    const trackedIds = loadTrackedTabs();
    const targets = await getTargets();

    if (requestedTargetId) {
      const selected = targets.find(target => target.type === 'page' && target.id === requestedTargetId);
      if (!selected) throw new Error('指定的标签 ID 已失效，请重新运行 tabs list 获取当前 ID');

      // 用户指定的标签：只导航、不纳入追踪，任务结束后也不会被清理。
      const shouldNavigate = url && url !== '-' && selected.url !== url;
      if (shouldNavigate) {
        const sessionId = await attachToTarget(selected.id);
        try {
          await cdpSend('Page.navigate', { url }, sessionId);
        } finally {
          await detachFromTarget(sessionId);
        }
      }
      return {
        targetId: selected.id,
        reused: true,
        created: false,
        tracked: trackedIds.includes(selected.id),
        navigated: Boolean(shouldNavigate)
      };
    }

    if (!url || url === '-') throw new Error('未指定 URL 或 --target 标签 ID');

    // 同一 URL 的自有标签直接复用，避免重复新建/关闭造成抖动。
    const reusable = targets.find(target =>
      target.type === 'page' && trackedIds.includes(target.id) && target.url === url
    );
    if (reusable) {
      return { targetId: reusable.id, reused: true, created: false, tracked: true, navigated: false };
    }

    const targetId = await createTarget(url, background);
    addTrackedTab(targetId);
    return { targetId, reused: false, created: true, tracked: true, navigated: true };
  });
}

async function focusTarget(targetId) {
  const sessionId = await attachToTarget(targetId);
  try {
    await cdpSend('Page.bringToFront', {}, sessionId);
  } finally {
    await detachFromTarget(sessionId);
  }
}

// 统一入口：默认后台执行；只有显式 --foreground 才把标签切到前台。
async function ensureTarget(url, options = {}) {
  const background = options.background ?? !options.foreground;
  const target = await prepareTarget(url, { ...options, background });
  if (options.foreground) await focusTarget(target.targetId);
  return target;
}

async function waitForSelector(sessionId, selector, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let lastNavigationError;
  const expression = `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    return visible ? { tag: element.tagName.toLowerCase(), text: (element.innerText || element.value || '').trim().slice(0, 300), disabled: Boolean(element.disabled) } : null;
  })()`;

  while (Date.now() < deadline) {
    try {
      const result = await evaluate(expression, sessionId);
      if (result) return result;
    } catch (error) {
      if (!/execution context.{0,40}(destroyed|not found)|cannot find context|context with specified id/i.test(error.message)) {
        throw error;
      }
      lastNavigationError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const error = new Error(`等待元素超时 (${timeout}ms): ${selector}`);
  if (lastNavigationError) error.cause = lastNavigationError;
  throw error;
}

// ========== 命令实现 ==========

async function cmdExtract(url, options = {}) {
  const { wait = 5000 } = options;
  const target = await ensureTarget(url, options);
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
        totalLines: lines.length
      });
    })()
  `;

  const result = await evaluate(script, sessionId);
  await detachFromTarget(sessionId);

  // 标签状态由执行器返回，避免页面脚本覆盖。
  return {
    ...JSON.parse(result || '{}'),
    targetId,
    newTab: target.created,
    reusedTab: target.reused
  };
}

async function cmdEval(url, jsCode, options = {}) {
  const { wait = 3000 } = options;
  const target = await ensureTarget(url, options);
  const { targetId } = target;

  await new Promise(r => setTimeout(r, wait));

  const sessionId = await attachToTarget(targetId);
  const result = await evaluate(jsCode, sessionId);
  await detachFromTarget(sessionId);

  return { result, newTab: target.created, reusedTab: target.reused };
}

async function cmdScreenshot(url, outputPath, options = {}) {
  const { wait = 3000 } = options;

  const target = await ensureTarget(url, options);
  const { targetId } = target;

  await new Promise(r => setTimeout(r, wait));

  const sessionId = await attachToTarget(targetId);
  const data = await captureScreenshot(sessionId);
  await detachFromTarget(sessionId);

  fs.writeFileSync(outputPath, Buffer.from(data, 'base64'));

  return {
    path: outputPath,
    size: Buffer.from(data, 'base64').length,
    newTab: target.created,
    reusedTab: target.reused
  };
}

async function cmdSnapshot(url, options = {}) {
  const { wait = 500, maxNodes = 500 } = options;
  const target = await ensureTarget(url, options);
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  const sessionId = await attachToTarget(target.targetId);
  try {
    const snapshot = await getPageSnapshot(cdpSend, sessionId, { maxNodes });
    return { ...snapshot, targetId: target.targetId, reusedTab: target.reused, newTab: target.created };
  } finally {
    await detachFromTarget(sessionId);
  }
}

async function cmdWaitFor(url, selector, options = {}) {
  const { timeout = 10000 } = options;
  const target = await ensureTarget(url, options);
  const sessionId = await attachToTarget(target.targetId);
  try {
    const element = await waitForSelector(sessionId, selector, timeout);
    return { targetId: target.targetId, selector, element, reusedTab: target.reused, newTab: target.created };
  } finally {
    await detachFromTarget(sessionId);
  }
}

async function cmdElementAction(action, url, selector, values = [], options = {}) {
  const target = await ensureTarget(url, options);
  const sessionId = await attachToTarget(target.targetId);
  try {
    await waitForSelector(sessionId, selector, options.timeout ?? 10000);
    const actions = createDomActions({ send: cdpSend, sessionId });
    let result;
    if (action === 'click') result = await actions.click(selector);
    else if (action === 'fill') result = await actions.fill(selector, values[0]);
    else if (action === 'press') result = await actions.press(selector, values[0]);
    else if (action === 'scroll') result = await actions.scroll(selector, { direction: values[0], amount: Number(values[1]) });
    else throw new Error(`未知页面操作: ${action}`);
    return { ...result, targetId: target.targetId, reusedTab: target.reused, newTab: target.created };
  } finally {
    await detachFromTarget(sessionId);
  }
}

function parseOptions(args, allowed, flags = {}) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (Object.hasOwn(allowed, arg)) {
      const value = args[++index];
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} 缺少参数`);
      options[allowed[arg]] = value;
    } else if (Object.hasOwn(flags, arg)) {
      options[flags[arg]] = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`未知选项: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, options };
}

function parsedNumber(value, option, fallback, { allowZero = true } = {}) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < (allowZero ? 0 : 1)) {
    throw new Error(`${option} 需要${allowZero ? '非负' : '正'}整数`);
  }
  return parsed;
}

async function cmdTabs(action, args = []) {
  if (action === 'list') {
    const targets = await getTargets();
    const pages = targets.filter(t => t.type === 'page');
    const tracked = new Set(loadTrackedTabs());
    return pages.map(p => ({
      id: p.id,
      title: p.title,
      url: p.url,
      tracked: tracked.has(p.id)
    }));
  }

  if (action === 'open') {
    const foreground = args.includes('--foreground') || args.includes('-f');
    const urls = args.filter(arg => !arg.startsWith('-'));
    const list = urls.length ? urls : ['about:blank'];
    const opened = [];

    // 可一次开多个后台标签，供并行任务使用。
    for (const url of list) {
      const target = await ensureTarget(url, { foreground });
      opened.push({ targetId: target.targetId, url, reusedTab: target.reused, newTab: target.created });
    }

    return opened.length === 1
      ? { ...opened[0], background: !foreground }
      : { tabs: opened, background: !foreground };
  }

  return withTrackerLock(async () => {
    const targets = await getTargets();
    const pages = targets.filter(t => t.type === 'page');

    if (action === 'close') {
      const pattern = args[0] || '';
      const trackedIds = new Set(loadTrackedTabs());
      let closed = 0;
      const failed = [];
      const closedIds = new Set();
      for (const p of pages) {
        if (trackedIds.has(p.id) && p.url.includes(pattern)) {
          const outcome = await closeTarget(p.id);
          if (outcome === 'closed') closed++;
          if (outcome === 'failed') failed.push(p.id);
          if (outcome !== 'failed') closedIds.add(p.id);
        }
      }
      saveTrackedTabs(loadTrackedTabs().filter(id => !closedIds.has(id)));
      return { closed, pattern, failed, scope: 'tracked tabs only' };
    }

    if (action === 'close-id') {
      const targetId = args[0];
      if (!targetId || !pages.some(page => page.id === targetId)) {
        throw new Error('标签不存在；close-id 只会关闭明确指定的标签 ID');
      }
      const outcome = await closeTarget(targetId);
      if (outcome === 'failed') throw new Error(`关闭标签失败: ${targetId}`);
      if (outcome === 'closed') saveTrackedTabs(loadTrackedTabs().filter(id => id !== targetId));
      return { closed: Number(outcome === 'closed'), targetId };
    }

    if (action === 'close-tracked') {
      const result = await closeTrackedTabs();
      return { closedTracked: result.closed, failed: result.failed };
    }

    throw new Error(`未知的 tabs 操作: ${action}`);
  });
}

async function cmdPing() {
  const endpoint = await resolveEndpoint();
  if (!endpoint) {
    return {
      connected: false,
      error: '未找到可用的调试端口：已检查 CDP_PORT、9222 和运行中浏览器的 --remote-debugging-port'
    };
  }
  try {
    const version = await getHttp(`${CDP_URL}/json/version`);
    return {
      connected: true,
      port: CDP_PORT,
      portSource: endpoint.source || 'CDP_PORT',
      browser: version.Browser,
      wsUrl: version.webSocketDebuggerUrl
    };
  } catch (e) {
    return {
      connected: false,
      port: CDP_PORT,
      error: e.message
    };
  }
}

async function cmdCleanup(keepIds = []) {
  return withTrackerLock(async () => {
    const result = await closeTrackedTabs(keepIds);
    return { cleanedUp: result.closed, failed: result.failed, keptTracked: keepIds };
  });
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
  extract <url|-> [--wait <ms>] [--target <id>] [--foreground]  提取页面文本
  eval <url|-> <js-code> [--wait <ms>] [--target <id>] [--foreground]  执行 JavaScript
  screenshot <url|-> <output> [--wait <ms>] [--target <id>] [--foreground]  截图
  snapshot <url|-> [--wait <ms>] [--max-nodes <n>] [--target <id>] [--foreground]  无障碍快照
  wait-for <url|-> <selector> [--timeout <ms>] [--target <id>] [--foreground]  等待可见元素
  click <url|-> <selector> [--timeout <ms>] [--target <id>] [--foreground]  点击唯一可见元素
  fill <url|-> <selector> <value> [--timeout <ms>] [--target <id>] [--foreground]  填写文本控件
  press <url|-> <selector> <key> [--timeout <ms>] [--target <id>] [--foreground]  发送按键
  scroll <url|-> <selector> <direction> [amount] [--timeout <ms>] [--target <id>] [--foreground]  滚动元素或页面
  tabs list                      列出所有标签
  tabs close <pattern>           关闭匹配的自有标签
  tabs close-id <targetId>       关闭明确指定的标签
  tabs close-tracked             关闭之前创建的所有标签
  tabs open <url...> [--foreground]  后台打开或复用标签（可一次多个），不关闭其他标签
  cleanup [--keep <id,id,...>]   任务结束后统一关闭自有标签，可保留指定标签
  ping                           测试连接

特性:
  - 默认在后台新建标签，不抢占焦点；仅 --foreground 显式要求时切到前台
  - 不关闭用户标签；cleanup 只关闭本脚本创建并追踪的标签
  - 相同 URL 复用自有标签，避免重复新建/关闭
  - 页面命令不再隐式关闭任何标签
  - 所有浏览器操作仅作用于指定标签或脚本创建的标签；过期 ID 会拒绝执行
  - 按浏览器会话隔离追踪文件，并使用文件锁协调并发操作
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
        const { positionals, options } = parseOptions(args.slice(1), { '--wait': 'wait', '--target': 'targetId' }, { '--foreground': 'foreground' });
        const url = positionals[0] || (options.targetId ? '-' : undefined);
        if (!url) throw new Error('缺少 URL 或 --target 参数');
        result = await cmdExtract(url, {
          wait: parsedNumber(options.wait, '--wait', 5000), targetId: options.targetId, foreground: options.foreground
        });
        break;
      }

      case 'eval': {
        const { positionals, options } = parseOptions(args.slice(1), { '--wait': 'wait', '--target': 'targetId' }, { '--foreground': 'foreground' });
        const url = positionals[0] || (options.targetId ? '-' : undefined);
        const jsCode = positionals[1];
        if (!url || !jsCode) throw new Error('缺少 URL 或 JS 代码参数');
        result = await cmdEval(url, jsCode, {
          wait: parsedNumber(options.wait, '--wait', 3000), targetId: options.targetId, foreground: options.foreground
        });
        break;
      }

      case 'screenshot': {
        const { positionals, options } = parseOptions(args.slice(1), { '--wait': 'wait', '--target': 'targetId' }, { '--foreground': 'foreground' });
        const url = positionals[0] || (options.targetId ? '-' : undefined);
        const output = positionals[1];
        if (!url || !output) throw new Error('缺少 URL 或输出路径参数');
        result = await cmdScreenshot(url, output, {
          wait: parsedNumber(options.wait, '--wait', 3000), targetId: options.targetId, foreground: options.foreground
        });
        break;
      }

      case 'snapshot': {
        const { positionals, options } = parseOptions(args.slice(1), {
          '--wait': 'wait', '--target': 'targetId', '--max-nodes': 'maxNodes'
        }, { '--foreground': 'foreground' });
        const url = positionals[0] || (options.targetId ? '-' : undefined);
        if (!url) throw new Error('缺少 URL 或 --target 参数');
        const maxNodes = parsedNumber(options.maxNodes, '--max-nodes', 500, { allowZero: false });
        result = await cmdSnapshot(url, {
          wait: parsedNumber(options.wait, '--wait', 500), maxNodes, targetId: options.targetId, foreground: options.foreground
        });
        break;
      }

      case 'wait-for': {
        const { positionals, options } = parseOptions(args.slice(1), { '--timeout': 'timeout', '--target': 'targetId' }, { '--foreground': 'foreground' });
        const url = positionals[0] || (options.targetId ? '-' : undefined);
        const selector = positionals[1];
        if (!url || !selector) throw new Error('缺少 URL 或 CSS selector 参数');
        result = await cmdWaitFor(url, selector, {
          timeout: parsedNumber(options.timeout, '--timeout', 10000, { allowZero: false }), targetId: options.targetId, foreground: options.foreground
        });
        break;
      }

      case 'click': case 'fill': case 'press': case 'scroll': {
        const { positionals, options } = parseOptions(args.slice(1), { '--target': 'targetId', '--timeout': 'timeout' }, { '--foreground': 'foreground' });
        const url = positionals[0] || (options.targetId ? '-' : undefined);
        const selector = positionals[1];
        const values = positionals.slice(2);
        if (!url || !selector) throw new Error(`缺少 URL 或 CSS selector 参数: ${command}`);
        if (command === 'fill' && values.length !== 1) throw new Error('fill 需要一个文本值');
        if (command === 'press' && values.length !== 1) throw new Error('press 需要一个按键名');
        if (command === 'scroll') {
          if (values.length < 1 || values.length > 2) throw new Error('scroll 格式: <direction> [amount]');
          const amount = values[1] === undefined ? 300 : Number(values[1]);
          if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) throw new Error('scroll amount 需大于 0 且不超过 10000');
          values[1] = String(amount);
        }
        result = await cmdElementAction(command, url, selector, values, {
          targetId: options.targetId,
          foreground: options.foreground,
          timeout: parsedNumber(options.timeout, '--timeout', 10000, { allowZero: false })
        });
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
