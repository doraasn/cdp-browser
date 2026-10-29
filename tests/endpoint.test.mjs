import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDebugPorts, parseRunningBrowsers, rankCandidatePorts, detectEndpoint } from '../scripts/cdp_endpoint.mjs';
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

test('解析进程命令行时区分 headless 与有界面实例', () => {
  const text = [
    '"C:\\CentBrowser\\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=*',
    '"C:\\Edge\\msedge.exe" --headless=new --remote-debugging-port=9223 --user-data-dir=C:/Projects/x/temp',
    '"C:\\Chrome\\chrome.exe" --remote-debugging-port=9222 --type=renderer',
  ].join('\n');

  const browsers = parseRunningBrowsers(text).sort((a, b) => a.port - b.port);
  assert.deepEqual(browsers, [
    { port: 9222, headless: false },
    { port: 9223, headless: true },
  ]);
});

test('候选端口默认跳过 headless，并支持忽略列表', () => {
  const browsers = [
    { port: 9222, headless: false },
    { port: 9223, headless: true },
    { port: 9333, headless: false },
  ];

  assert.deepEqual(rankCandidatePorts(browsers), [9222, 9333]);
  assert.deepEqual(rankCandidatePorts(browsers, { ignorePorts: [9333] }), [9222]);
  assert.deepEqual(rankCandidatePorts(browsers, { includeHeadless: true }), [9222, 9333, 9223]);
  assert.deepEqual(rankCandidatePorts(browsers, { preferredPort: 9333 }), [9333, 9222]);
});

test('detectEndpoint 命中 CDP_PORT 指定的端口', async t => {
  const cdp = await startFakeCdp();
  t.after(() => cdp.close());

  const endpoint = await detectEndpoint({ preferredPort: cdp.port });
  assert.equal(endpoint.port, cdp.port);
  assert.equal(endpoint.source, 'CDP_PORT');
  assert.match(endpoint.browser, /Chrome\/test/);
});
