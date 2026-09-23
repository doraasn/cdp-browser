/**
 * 在指定的 CDP 页面会话中执行受控 DOM 操作。
 * 调用方负责选择并授权目标标签；本模块只使用注入的 send 与 sessionId。
 *
 * @author Y77H
 * @date 2026-09-23
 */

const RUNTIME_EVALUATE = 'Runtime.evaluate';
const INPUT_DISPATCH_MOUSE_EVENT = 'Input.dispatchMouseEvent';
const INPUT_DISPATCH_KEY_EVENT = 'Input.dispatchKeyEvent';
const MAX_SCROLL_AMOUNT = 10000;

const KEY_DEFINITIONS = new Map([
  ['Enter', { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }],
  ['Tab', { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }],
  ['Escape', { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }],
  ['Backspace', { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }],
  ['Delete', { key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 }],
  ['ArrowUp', { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 }],
  ['ArrowDown', { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }],
  ['ArrowLeft', { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 }],
  ['ArrowRight', { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }],
  ['Home', { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 }],
  ['End', { key: 'End', code: 'End', windowsVirtualKeyCode: 35 }],
  ['PageUp', { key: 'PageUp', code: 'PageUp', windowsVirtualKeyCode: 33 }],
  ['PageDown', { key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 }],
  ['Space', { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' }],
  [' ', { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' }],
  ['Control', { key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 }],
  ['Alt', { key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18 }],
  ['Shift', { key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 }],
  ['Meta', { key: 'Meta', code: 'MetaLeft', windowsVirtualKeyCode: 91 }],
]);

const MODIFIER_ALIASES = new Map([
  ['Control', 'Control'], ['Ctrl', 'Control'],
  ['Alt', 'Alt'], ['Option', 'Alt'],
  ['Shift', 'Shift'],
  ['Meta', 'Meta'], ['Cmd', 'Meta'], ['Command', 'Meta'],
]);

const MODIFIER_MASKS = Object.freeze({ Alt: 1, Control: 2, Meta: 4, Shift: 8 });

/**
 * 创建绑定到单个 CDP 页面会话的 DOM 动作接口。
 * send 的签名须与 CDP executor 一致：send(method, params, sessionId)。
 *
 * @param {{send: (method: string, params: object, sessionId: string) => Promise<object>, sessionId: string}} options CDP 发送函数及已授权的页面会话 ID
 * @returns {{click(selector: string): Promise<object>, fill(selector: string, value: string): Promise<object>, press(selector: string, key: string): Promise<object>, scroll(selector: string, options?: {direction?: 'up'|'down'|'left'|'right', amount?: number}): Promise<object>}} 页面动作方法
 */
export function createDomActions({ send, sessionId } = {}) {
  if (typeof send !== 'function') {
    throw new TypeError('必须提供 CDP send(method, params, sessionId) 函数');
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new TypeError('必须提供有效的 CDP sessionId');
  }

  async function evaluate(payload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    const expression = createPageExpression(encodedPayload);
    const response = await send(RUNTIME_EVALUATE, {
      expression,
      returnByValue: true,
      awaitPromise: false,
    }, sessionId);

    if (response?.exceptionDetails) {
      const detail = response.exceptionDetails.exception?.description
        || response.exceptionDetails.text
        || '未知页面执行错误';
      throw new Error(`页面执行失败: ${detail}`);
    }

    const result = response?.result?.value;
    if (!result || typeof result !== 'object') {
      throw new Error('CDP 未返回页面操作结果');
    }
    if (!result.ok) {
      throw new Error(result.error || '页面操作失败');
    }
    return result.summary;
  }

  return Object.freeze({
    /**
     * 使用浏览器输入事件点击唯一匹配且可见、可用的元素。
     *
     * @param {string} selector CSS selector
     * @returns {Promise<object>} 点击摘要
     */
    async click(selector) {
      validateSelector(selector);
      const summary = await evaluate({ action: 'click', selector });
      const { x, y } = summary;
      await send(INPUT_DISPATCH_MOUSE_EVENT, { type: 'mouseMoved', x, y, button: 'none' }, sessionId);
      await send(INPUT_DISPATCH_MOUSE_EVENT, {
        type: 'mousePressed', x, y, button: 'left', clickCount: 1,
      }, sessionId);
      try {
        await send(INPUT_DISPATCH_MOUSE_EVENT, {
          type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
        }, sessionId);
      } catch (error) {
        throw new Error(`点击已发送，但释放鼠标失败: ${error.message}`);
      }
      return { action: 'click', selector, element: summary.element, x, y };
    },

    /**
     * 替换文本控件或 contenteditable 元素的内容，并派发 input/change 事件。
     *
     * @param {string} selector CSS selector
     * @param {string} value 要填入的文本
     * @returns {Promise<object>} 填写摘要，不回显文本内容
     */
    async fill(selector, value) {
      validateSelector(selector);
      if (typeof value !== 'string') throw new TypeError('fill 的 value 必须是字符串');
      const summary = await evaluate({ action: 'fill', selector, value });
      return {
        action: 'fill', selector, element: summary.element,
        changed: summary.changed, valueLength: value.length,
      };
    },

    /**
     * 聚焦元素后向页面发送一次 CDP 键盘按下和抬起事件；支持 Control+A 等组合键。
     *
     * @param {string} selector CSS selector
     * @param {string} key 按键名称或以 + 连接的组合键，例如 Enter、ArrowDown、Control+A
     * @returns {Promise<object>} 按键摘要
     */
    async press(selector, key) {
      validateSelector(selector);
      const keyInfo = parseKey(key);
      const summary = await evaluate({ action: 'press', selector });
      const baseParams = {
        key: keyInfo.key,
        code: keyInfo.code,
        modifiers: keyInfo.modifiers,
      };
      if (keyInfo.windowsVirtualKeyCode !== undefined) {
        baseParams.windowsVirtualKeyCode = keyInfo.windowsVirtualKeyCode;
      }

      const downParams = { type: 'keyDown', ...baseParams };
      if (keyInfo.text !== undefined && keyInfo.modifiers === 0) {
        downParams.text = keyInfo.text;
        downParams.unmodifiedText = keyInfo.unmodifiedText ?? keyInfo.text;
      }
      await send(INPUT_DISPATCH_KEY_EVENT, downParams, sessionId);
      try {
        await send(INPUT_DISPATCH_KEY_EVENT, { type: 'keyUp', ...baseParams }, sessionId);
      } catch (error) {
        throw new Error(`按键已按下，但释放按键失败: ${error.message}`);
      }
      return { action: 'press', selector, element: summary.element, key };
    },

    /**
     * 滚动元素最近的可滚动祖先；没有可滚动祖先时滚动页面。
     *
     * @param {string} selector CSS selector
     * @param {{direction?: 'up'|'down'|'left'|'right', amount?: number}} [options] 方向和像素距离，默认向下 300 像素
     * @returns {Promise<object>} 实际滚动位置摘要
     */
    async scroll(selector, options = {}) {
      validateSelector(selector);
      const direction = options.direction ?? 'down';
      const amount = options.amount ?? 300;
      if (!['up', 'down', 'left', 'right'].includes(direction)) {
        throw new TypeError('scroll direction 必须是 up、down、left 或 right');
      }
      if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_SCROLL_AMOUNT) {
        throw new TypeError(`scroll amount 必须大于 0 且不超过 ${MAX_SCROLL_AMOUNT}`);
      }
      const scrollAmount = Math.max(1, Math.round(amount));
      const summary = await evaluate({
        action: 'scroll', selector, direction, amount: scrollAmount,
      });
      return {
        action: 'scroll', selector, element: summary.element,
        scrolledElement: summary.scrolledElement,
        direction, amount: scrollAmount,
        scrollLeft: summary.scrollLeft, scrollTop: summary.scrollTop,
        changed: summary.changed,
      };
    },
  });
}

function validateSelector(selector) {
  if (typeof selector !== 'string' || selector.trim().length === 0) {
    throw new TypeError('selector 必须是非空 CSS selector 字符串');
  }
}

function parseKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 64) {
    throw new TypeError('key 必须是 1 到 64 个字符的按键名');
  }

  const parts = key.split('+');
  const modifiers = new Set();
  while (parts.length > 1) {
    const modifier = MODIFIER_ALIASES.get(parts[0]);
    if (!modifier || modifiers.has(modifier)) {
      throw new TypeError(`不支持的按键组合: ${key}`);
    }
    modifiers.add(modifier);
    parts.shift();
  }
  const token = parts[0];
  let definition = KEY_DEFINITIONS.get(token);
  if (!definition && /^[a-z]$/i.test(token)) {
    const upper = token.toUpperCase();
    definition = {
      key: token,
      code: `Key${upper}`,
      windowsVirtualKeyCode: upper.charCodeAt(0),
      text: token,
      unmodifiedText: token.toLowerCase(),
    };
  } else if (!definition && /^[0-9]$/.test(token)) {
    definition = {
      key: token,
      code: `Digit${token}`,
      windowsVirtualKeyCode: token.charCodeAt(0),
      text: token,
    };
  } else if (!definition && /^[!-/:-@[-`{-~]$/.test(token)) {
    const punctuation = {
      ',': ['Comma', 188], '.': ['Period', 190], '/': ['Slash', 191],
      ';': ['Semicolon', 186], "'": ['Quote', 222], '[': ['BracketLeft', 219],
      ']': ['BracketRight', 221], '\\': ['Backslash', 220], '-': ['Minus', 189],
      '=': ['Equal', 187], '`': ['Backquote', 192],
    };
    const entry = punctuation[token];
    if (!entry) throw new TypeError(`不支持的按键: ${key}`);
    definition = { key: token, code: entry[0], windowsVirtualKeyCode: entry[1], text: token };
  }
  if (!definition) throw new TypeError(`不支持的按键: ${key}`);

  const modifierMask = [...modifiers].reduce((mask, modifier) => mask | MODIFIER_MASKS[modifier], 0);
  return { ...definition, modifiers: modifierMask };
}

function createPageExpression(encodedPayload) {
  // 参数先 UTF-8/Base64 编码，再在页面中解码，避免把 selector 或文本当作 JS 源码拼接。
  return `(() => {
    const bytes = Uint8Array.from(atob(${JSON.stringify(encodedPayload)}), c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const fail = message => { throw new Error(message); };
    try {
      let elements;
      try {
        elements = document.querySelectorAll(data.selector);
      } catch (error) {
        fail('无效的 CSS selector: ' + error.message);
      }
      if (elements.length !== 1) {
        fail(elements.length === 0
          ? 'CSS selector 没有匹配到元素'
          : 'CSS selector 匹配到 ' + elements.length + ' 个元素，要求恰好一个');
      }
      const element = elements[0];
      const style = getComputedStyle(element);
      const rects = element.getClientRects();
      const visible = element.isConnected
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.visibility !== 'collapse'
        && rects.length > 0
        && Array.from(rects).some(rect => rect.width > 0 && rect.height > 0);
      if (!visible) fail('匹配到的元素不可见');
      const disabled = Boolean(element.disabled)
        || element.matches(':disabled')
        || Boolean(element.closest('[aria-disabled="true"]'));
      if (disabled) fail('匹配到的元素已禁用');

      const tagName = element.tagName.toLowerCase();
      let summary;
      if (data.action === 'click') {
        element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const rect = element.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) fail('元素没有可点击区域');
        summary = { element: tagName, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      } else if (data.action === 'fill') {
        if (element.readOnly || element.getAttribute('aria-readonly') === 'true') {
          fail('匹配到的元素为只读状态');
        }
        const isContentEditable = element.isContentEditable;
        const inputTypes = new Set([
          'text', 'search', 'email', 'url', 'tel', 'password', 'number',
          'date', 'month', 'week', 'time', 'datetime-local',
        ]);
        if (!isContentEditable && tagName !== 'textarea'
          && !(tagName === 'input' && inputTypes.has(element.type))) {
          fail('fill 仅支持文本 input、textarea 或 contenteditable 元素');
        }
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        element.focus({ preventScroll: true });
        const previous = isContentEditable ? element.textContent : element.value;
        if (isContentEditable) {
          element.textContent = data.value;
        } else {
          let prototype = Object.getPrototypeOf(element);
          let setter;
          while (prototype && !setter) {
            setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            prototype = Object.getPrototypeOf(prototype);
          }
          if (setter) setter.call(element, data.value);
          else element.value = data.value;
          if (element.value !== data.value) fail('浏览器拒绝了该 input 类型的文本值');
        }
        try {
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true, composed: true, inputType: 'insertText', data: data.value,
          }));
        } catch {
          element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }
        element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        summary = { element: tagName, changed: previous !== (isContentEditable ? element.textContent : element.value) };
      } else if (data.action === 'press') {
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        element.focus({ preventScroll: true });
        summary = { element: tagName };
      } else if (data.action === 'scroll') {
        const vertical = data.direction === 'up' || data.direction === 'down';
        const canScroll = node => {
          const nodeStyle = getComputedStyle(node);
          const overflow = vertical ? nodeStyle.overflowY : nodeStyle.overflowX;
          const overflows = vertical
            ? node.scrollHeight > node.clientHeight
            : node.scrollWidth > node.clientWidth;
          return overflows && /^(auto|scroll|hidden|overlay)$/.test(overflow);
        };
        let target = element;
        while (target && target !== document.documentElement && !canScroll(target)) {
          target = target.parentElement;
        }
        const pageTarget = document.scrollingElement || document.documentElement;
        if (!target || target === document.documentElement) target = pageTarget;
        const beforeLeft = target.scrollLeft;
        const beforeTop = target.scrollTop;
        const distance = data.amount * ((data.direction === 'up' || data.direction === 'left') ? -1 : 1);
        const deltaX = vertical ? 0 : distance;
        const deltaY = vertical ? distance : 0;
        if (target === pageTarget) window.scrollBy(deltaX, deltaY);
        else target.scrollBy(deltaX, deltaY);
        summary = {
          element: tagName,
          scrolledElement: target === pageTarget ? 'document' : target.tagName.toLowerCase(),
          scrollLeft: target.scrollLeft,
          scrollTop: target.scrollTop,
          changed: target.scrollLeft !== beforeLeft || target.scrollTop !== beforeTop,
        };
      } else {
        fail('不支持的 DOM 操作');
      }
      return { ok: true, summary };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  })()`;
}
