import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

/**
 * 测试用假 CDP 服务：模拟 /json、/json/version、/json/close 和 WebSocket 命令。
 * 返回 requests（客户端发来的 CDP 消息）、closes（被关闭的标签 ID）和 pages（当前标签）。
 */
export async function startFakeCdp({ tabs = [], instance = randomUUID() } = {}) {
  const requests = [];
  const closes = [];
  const closeMethods = [];
  const pages = new Map(tabs.map(tab => [tab.id, { id: tab.id, type: 'page', url: tab.url, title: tab.title || '' }]));
  const sockets = new Set();
  let tabSeq = 0;
  let sessionSeq = 0;

  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/json/version') {
      response.end(JSON.stringify({
        Browser: 'Chrome/test',
        webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/browser/${instance}`,
      }));
    } else if (request.url === '/json') {
      response.end(JSON.stringify([...pages.values()]));
    } else if (request.url.startsWith('/json/close/')) {
      const id = request.url.slice('/json/close/'.length);
      closes.push(id);
      closeMethods.push(request.method);
      pages.delete(id);
      response.end(JSON.stringify({}));
    } else {
      response.statusCode = 404;
      response.end('{}');
    }
  });

  server.on('upgrade', (request, socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
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
        if (opcode === 1) {
          const message = JSON.parse(payload.toString('utf8'));
          requests.push(message);
          handle(message, socket);
        }
        if (opcode === 8) {
          socket.end(Buffer.from([0x88, 0x00]));
          return;
        }
      }
    });
  });

  function handle(message, socket) {
    const { id, method, params = {} } = message;
    let result = {};

    if (method === 'Target.createTarget') {
      const targetId = `tab-${++tabSeq}`;
      pages.set(targetId, { id: targetId, type: 'page', url: params.url || 'about:blank', title: '' });
      result = { targetId };
    } else if (method === 'Target.attachToTarget') {
      result = { sessionId: `session-${++sessionSeq}` };
    } else if (method === 'Page.navigate') {
      const page = [...pages.values()].find(item => item.url === params.url);
      if (!page) pages.set(message.sessionId || `tab-${tabSeq}`, { id: `tab-${tabSeq}`, type: 'page', url: params.url, title: '' });
      result = {};
    } else if (method === 'Page.captureScreenshot') {
      result = { data: Buffer.from('png').toString('base64') };
    } else if (method === 'Runtime.evaluate') {
      result = {
        result: {
          type: 'string',
          value: JSON.stringify({ title: 'title', url: 'https://example.org', lines: [], totalLines: 0 }),
        },
      };
    }

    sendText(socket, JSON.stringify({ id, result }));
  }

  function sendText(socket, text) {
    const payload = Buffer.from(text, 'utf8');
    let header;
    if (payload.length < 126) {
      header = Buffer.from([0x81, payload.length]);
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    socket.write(Buffer.concat([header, payload]));
  }

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  return {
    port: server.address().port,
    instance,
    requests,
    closes,
    closeMethods,
    pages,
    createCalls: () => requests.filter(item => item.method === 'Target.createTarget'),
    close: () => new Promise(resolve => {
      for (const socket of sockets) socket.destroy();
      server.close(resolve);
    }),
  };
}

/** 解析执行器的 stdout JSON；断言成功并返回 data。 */
export function parseSuccess(stdout) {
  const payload = JSON.parse(stdout);
  if (!payload.success) throw new Error(payload.error);
  return payload.data;
}
