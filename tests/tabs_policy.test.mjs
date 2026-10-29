import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeCdp, parseSuccess } from './fake_cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executor = path.join(root, 'scripts', 'cdp_executor.mjs');

// 每次运行使用独立临时目录，避免标签追踪文件在测试之间串味。
async function withTempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cdp-policy-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { TEMP: dir, TMP: dir };
}

function runCdp(port, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [executor, ...args], {
      cwd: root,
      env: { ...process.env, CDP_HOST: '127.0.0.1', CDP_PORT: String(port), ...extraEnv },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout, stderr }));
  });
}

test('页面命令默认后台新建标签，且不关闭任何标签', async t => {
  const cdp = await startFakeCdp();
  t.after(() => cdp.close());
  const env = await withTempDir(t);

  const { code, stdout } = await runCdp(cdp.port, ['extract', 'https://a.example', '--wait', '0'], env);
  assert.equal(code, 0);

  const data = parseSuccess(stdout);
  assert.equal(data.newTab, true);
  assert.equal(cdp.createCalls().length, 1);
  assert.equal(cdp.createCalls()[0].params.background, true);
  assert.deepEqual(cdp.closes, []);
});

test('同一 URL 连续命令复用标签，不重复新建或关闭', async t => {
  const cdp = await startFakeCdp();
  t.after(() => cdp.close());
  const env = await withTempDir(t);

  const first = await runCdp(cdp.port, ['extract', 'https://a.example', '--wait', '0'], env);
  const second = await runCdp(cdp.port, ['extract', 'https://a.example', '--wait', '0'], env);
  assert.equal(first.code, 0);
  assert.equal(second.code, 0);

  assert.equal(cdp.createCalls().length, 1);
  assert.equal(parseSuccess(second.stdout).reusedTab, true);
  assert.deepEqual(cdp.closes, []);
});

test('tabs open 可一次后台打开多个标签', async t => {
  const cdp = await startFakeCdp();
  t.after(() => cdp.close());
  const env = await withTempDir(t);

  const { code, stdout } = await runCdp(cdp.port, ['tabs', 'open', 'https://a.example', 'https://b.example'], env);
  assert.equal(code, 0);

  const data = parseSuccess(stdout);
  assert.equal(data.tabs.length, 2);
  assert.equal(new Set(data.tabs.map(tab => tab.targetId)).size, 2);
  assert.equal(cdp.createCalls().length, 2);
  assert.equal(cdp.createCalls().every(call => call.params.background === true), true);
  assert.deepEqual(cdp.closes, []);
});

test('--foreground 才切到前台并聚焦', async t => {
  const cdp = await startFakeCdp();
  t.after(() => cdp.close());
  const env = await withTempDir(t);

  const { code } = await runCdp(cdp.port, ['tabs', 'open', 'https://a.example', '--foreground'], env);
  assert.equal(code, 0);
  assert.equal(cdp.createCalls()[0].params.background, false);
  assert.equal(cdp.requests.some(item => item.method === 'Page.bringToFront'), true);
});

test('cleanup 真的关闭自有标签（PUT /json/close）', async t => {
  const cdp = await startFakeCdp();
  t.after(() => cdp.close());
  const env = await withTempDir(t);

  const opened = await runCdp(cdp.port, ['tabs', 'open', 'https://a.example', 'https://b.example'], env);
  assert.equal(opened.code, 0);
  const ids = parseSuccess(opened.stdout).tabs.map(tab => tab.targetId);

  const cleaned = await runCdp(cdp.port, ['cleanup'], env);
  assert.equal(cleaned.code, 0);

  const data = parseSuccess(cleaned.stdout);
  assert.equal(data.cleanedUp, 2);
  assert.deepEqual([...cdp.closes].sort(), [...ids].sort());
  assert.deepEqual(cdp.closeMethods, ['PUT', 'PUT']);
  assert.equal(cdp.pages.size, 0);

  const listed = await runCdp(cdp.port, ['tabs', 'list'], env);
  assert.equal(parseSuccess(listed.stdout).length, 0);
});
test('用户标签只读不建：--target 后不新建，cleanup 也不关闭它', async t => {
  const cdp = await startFakeCdp({ tabs: [{ id: 'user-tab', url: 'https://user.example' }] });
  t.after(() => cdp.close());
  const env = await withTempDir(t);

  const used = await runCdp(cdp.port, ['extract', '-', '--target', 'user-tab', '--wait', '0'], env);
  assert.equal(used.code, 0);
  assert.equal(parseSuccess(used.stdout).reusedTab, true);
  assert.equal(cdp.createCalls().length, 0);

  const cleaned = await runCdp(cdp.port, ['cleanup'], env);
  assert.equal(cleaned.code, 0);
  assert.deepEqual(cdp.closes, []);
  assert.equal(cdp.pages.has('user-tab'), true);

  const listed = await runCdp(cdp.port, ['tabs', 'list'], env);
  const tabs = parseSuccess(listed.stdout);
  assert.equal(tabs.find(tab => tab.id === 'user-tab').tracked, false);
});

test('拒绝用 URL 参数导航用户标签，需显式放行', async t => {
  const cdp = await startFakeCdp({ tabs: [{ id: 'user-tab', url: 'https://user.example' }] });
  t.after(() => cdp.close());
  const env = await withTempDir(t);

  const blocked = await runCdp(cdp.port, ['extract', 'https://other.example', '--target', 'user-tab'], env);
  assert.equal(blocked.code, 1);
  assert.match(JSON.parse(blocked.stderr).error, /拒绝导航用户标签/);
  assert.equal(cdp.requests.some(item => item.method === 'Page.navigate'), false);

  const allowed = await runCdp(cdp.port, [
    'extract', 'https://other.example', '--target', 'user-tab', '--navigate-user-tab', '--wait', '0'
  ], env);
  assert.equal(allowed.code, 0);
  assert.equal(cdp.requests.some(item => item.method === 'Page.navigate'), true);
  assert.equal(cdp.createCalls().length, 0);
});

test('并发命令各自新建标签且互不关闭', async t => {
  const cdp = await startFakeCdp();
  t.after(() => cdp.close());
  const env = await withTempDir(t);

  const [first, second] = await Promise.all([
    runCdp(cdp.port, ['extract', 'https://a.example', '--wait', '0'], env),
    runCdp(cdp.port, ['extract', 'https://b.example', '--wait', '0'], env),
  ]);
  assert.equal(first.code, 0);
  assert.equal(second.code, 0);
  assert.equal(cdp.createCalls().length, 2);
  assert.equal(parseSuccess(first.stdout).newTab, true);
  assert.equal(parseSuccess(second.stdout).newTab, true);
  assert.deepEqual(cdp.closes, []);
});
