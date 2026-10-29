import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDebugPorts, detectEndpoint } from '../scripts/cdp_endpoint.mjs';
import { startFakeCdp } from './fake_cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('从浏览器命令行解析调试端口并去重', () => {
  const text = [
    '"C:\\Chrome\\chrome.exe" --remote-debugging-port=9223 --user-data-dir=C:\\p1',
    '"C:\\Edge\\msedge.exe" --remote-debugging-port=9223',
    '"C:\\Chrome\\chrome.exe" --type=renderer --remote-debugging-port=0',
    '"C:\\Chrome\\chrome.exe" --remote-debugging-port=abc',
  ].join('\n');

  assert.deepEqual(parseDebugPorts(text), [9223]);
  assert.deepEqual(parseDebugPorts(''), []);
});

test('detectEndpoint 命中 CDP_PORT 指定的端口', async t => {
  const cdp = await startFakeCdp();
  t.after(() => cdp.close());

  const endpoint = await detectEndpoint({ preferredPort: cdp.port });
  assert.equal(endpoint.port, cdp.port);
  assert.equal(endpoint.source, 'CDP_PORT');
  assert.match(endpoint.browser, /Chrome\/test/);
});
