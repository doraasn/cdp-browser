import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomActions } from '../scripts/dom_actions.mjs';

function createMock() {
  const calls = [];
  const send = async (method, params, sessionId) => {
    calls.push({ method, params, sessionId });
    if (method === 'Runtime.evaluate') {
      return { result: { value: { ok: true, summary: {
        element: 'button', x: 20, y: 30, changed: true,
        scrolledElement: 'document', scrollLeft: 0, scrollTop: 300,
      } } } };
    }
    return {};
  };
  return { actions: createDomActions({ send, sessionId: 'session-1' }), calls };
}

test('click sends mouse input events at the unique element center', async () => {
  const { actions, calls } = createMock();
  const result = await actions.click('button.search');
  assert.equal(result.action, 'click');
  assert.deepEqual(calls.slice(1).map(call => call.params.type), ['mouseMoved', 'mousePressed', 'mouseReleased']);
  assert.deepEqual([calls[1].params.x, calls[1].params.y], [20, 30]);
  assert.ok(calls.every(call => call.sessionId === 'session-1'));
});

test('fill does not include entered text in its returned summary', async () => {
  const { actions } = createMock();
  const result = await actions.fill('input[name=q]', 'private text');
  assert.deepEqual(result, {
    action: 'fill', selector: 'input[name=q]', element: 'button', changed: true, valueLength: 12,
  });
  assert.equal(JSON.stringify(result).includes('private text'), false);
});

test('press dispatches key down and key up, while scroll validates direction', async () => {
  const { actions, calls } = createMock();
  await actions.press('input', 'Control+A');
  assert.deepEqual(calls.slice(1).map(call => call.params.type), ['keyDown', 'keyUp']);
  assert.equal(calls[1].params.modifiers, 2);
  await assert.rejects(actions.scroll('main', { direction: 'diagonal', amount: 100 }), /direction/);
  const result = await actions.scroll('main', { direction: 'down', amount: 300 });
  assert.equal(result.scrollTop, 300);
});
