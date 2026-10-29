import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeCdp, parseSuccess } from './fake_cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = path.join(root, 'scripts', 'launch_debug_browser.mjs');

function runLauncher(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [launcher], {
      cwd: root,
      env: { ...process.env, CDP_HOST: '127.0.0.1', CDP_PORT: String(port) },
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

test('端口已就绪时只复用，不再启动浏览器', async t => {
  const cdp = await startFakeCdp();
  t.after(() => cdp.close());

  const { code, stdout } = await runLauncher(cdp.port);
  assert.equal(code, 0);

  const data = parseSuccess(stdout);
  assert.equal(data.launched, false);
  assert.equal(data.reused, true);
  assert.equal(data.port, cdp.port);
  assert.match(data.browser, /Chrome\/test/);
});
