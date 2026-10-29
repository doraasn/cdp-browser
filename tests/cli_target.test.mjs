import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeCdp } from './fake_cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executor = path.join(root, 'scripts', 'cdp_executor.mjs');

test('a stale --target ID fails without falling back to another open tab', async t => {
  const cdp = await startFakeCdp({ tabs: [{ id: 'current-tab', url: 'https://example.org' }] });
  t.after(() => cdp.close());

  const child = spawn(process.execPath, [executor, 'snapshot', '-', '--target', 'stale-tab'], {
    cwd: root,
    env: { ...process.env, CDP_HOST: '127.0.0.1', CDP_PORT: String(cdp.port) },
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const timer = setTimeout(() => child.kill(), 5000);
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  }).finally(() => clearTimeout(timer));

  assert.equal(exitCode, 1);
  const failure = JSON.parse(stderr);
  assert.match(failure.error, /标签 ID 已失效/);
  assert.deepEqual(cdp.requests, []);
  assert.equal(stdout, '');
});
