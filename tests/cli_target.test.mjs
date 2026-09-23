import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executor = path.join(root, 'scripts', 'cdp_executor.mjs');

test('a stale --target ID fails without falling back to another open tab', async t => {
  const cdpRequests = [];
  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/json/version') {
      response.end(JSON.stringify({
        Browser: 'Chrome/test',
        webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/browser/test-instance`,
      }));
    } else if (request.url === '/json') {
      response.end(JSON.stringify([{ id: 'current-tab', type: 'page', url: 'https://example.org' }]));
    } else {
      response.statusCode = 404;
      response.end('{}');
    }
  });

  server.on('upgrade', (request, socket) => {
    socket.on('error', () => {});
    const accept = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`, '', '',
    ].join('\r\n'));

    let buffered = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= 2) {
        const opcode = buffered[0] & 0x0f;
        const masked = (buffered[1] & 0x80) !== 0;
        let length = buffered[1] & 0x7f;
        let offset = 2;
        if (length === 126) {
          if (buffered.length < 4) return;
          length = buffered.readUInt16BE(2);
          offset = 4;
        } else if (length === 127) {
          if (buffered.length < 10) return;
          length = Number(buffered.readBigUInt64BE(2));
          offset = 10;
        }
        const maskOffset = offset;
        if (masked) offset += 4;
        if (buffered.length < offset + length) return;
        const payload = Buffer.from(buffered.subarray(offset, offset + length));
        if (masked) {
          const mask = buffered.subarray(maskOffset, maskOffset + 4);
          for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4];
        }
        buffered = buffered.subarray(offset + length);
        if (opcode === 1) cdpRequests.push(JSON.parse(payload.toString('utf8')));
        if (opcode === 8) {
          socket.end(Buffer.from([0x88, 0x00]));
          return;
        }
      }
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const child = spawn(process.execPath, [executor, 'snapshot', '-', '--target', 'stale-tab'], {
    cwd: root,
    env: { ...process.env, CDP_HOST: '127.0.0.1', CDP_PORT: String(server.address().port) },
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
  assert.deepEqual(cdpRequests, []);
  assert.equal(stdout, '');
});
