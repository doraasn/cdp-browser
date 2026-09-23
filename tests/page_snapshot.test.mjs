import test from 'node:test';
import assert from 'node:assert/strict';
import { getPageSnapshot, PageSnapshotError } from '../scripts/page_snapshot.mjs';

test('builds a readable accessibility snapshot and respects maxNodes', async () => {
  const response = {
    nodes: [
      { nodeId: '1', role: { value: 'RootWebArea' }, name: { value: 'Example' }, childIds: ['2', '3'] },
      { nodeId: '2', role: { value: 'button' }, name: { value: 'Search' }, backendDOMNodeId: 22,
        properties: [{ name: 'disabled', value: { value: false } }] },
      { nodeId: '3', role: { value: 'paragraph' }, name: { value: 'Hidden by limit' } },
    ],
  };
  const calls = [];
  const snapshot = await getPageSnapshot(async (...args) => {
    calls.push(args);
    return response;
  }, 'session-1', { maxNodes: 2 });

  assert.equal(calls[0][0], 'Accessibility.getFullAXTree');
  assert.equal(calls[0][2], 'session-1');
  assert.equal(snapshot.nodeCount, 2);
  assert.equal(snapshot.truncated, true);
  assert.match(snapshot.snapshot, /RootWebArea "Example"/);
  assert.match(snapshot.snapshot, /button "Search"/);
  assert.equal(snapshot.nodes[1].backendDOMNodeId, 22);
});

test('labels unsupported accessibility protocol errors', async () => {
  await assert.rejects(
    getPageSnapshot(async () => { throw Object.assign(new Error('Method not found'), { code: -32601 }); }, 'session-1'),
    error => error instanceof PageSnapshotError && error.code === 'PROTOCOL_UNSUPPORTED'
  );
});

test('rejects invalid snapshot limits before sending CDP commands', async () => {
  let sent = false;
  await assert.rejects(
    getPageSnapshot(async () => { sent = true; }, 'session-1', { maxNodes: 0 }),
    RangeError
  );
  assert.equal(sent, false);
});
