/**
 * 精简 CDP 无障碍树快照。
 * Compact CDP accessibility-tree snapshots.
 */

const IGNORED_ROLES = new Set([
  'generic',
  'none',
  'presentation',
  'inlinetextbox',
  'linebreak',
  'unknown'
]);

const STRUCTURAL_ROLES = new Set([
  'rootwebarea', 'webarea', 'application', 'main', 'navigation', 'complementary',
  'banner', 'contentinfo', 'search', 'form', 'region', 'article', 'section',
  'heading', 'paragraph', 'list', 'listitem', 'table', 'row', 'cell',
  'columnheader', 'rowheader', 'link', 'button', 'textbox', 'combobox',
  'checkbox', 'radio', 'radiogroup', 'tab', 'tablist', 'tabpanel', 'menu',
  'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tree',
  'treeitem', 'grid', 'gridcell', 'switch', 'slider', 'spinbutton',
  'progressbar', 'meter', 'separator'
]);

const KEPT_PROPERTIES = new Set([
  'disabled', 'checked', 'expanded', 'selected', 'pressed', 'required',
  'focused', 'focusable', 'readonly', 'invalid', 'level', 'orientation',
  'valuemin', 'valuemax'
]);

/**
 * 快照失败时抛出的错误。code 为 PROTOCOL_UNSUPPORTED、PAGE_NOT_READY 或 CDP_ERROR。
 * Error raised when snapshot generation fails. `code` is PROTOCOL_UNSUPPORTED,
 * PAGE_NOT_READY, or CDP_ERROR.
 */
export class PageSnapshotError extends Error {
  /**
   * @param {'PROTOCOL_UNSUPPORTED'|'PAGE_NOT_READY'|'CDP_ERROR'} code 错误类别 / Error category.
   * @param {string} message 错误说明 / Error description.
   * @param {unknown} [cause] 原始 CDP 错误 / Original CDP error.
   */
  constructor(code, message, cause) {
    super(message);
    this.name = 'PageSnapshotError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

function axValue(value) {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'value')) {
    return value.value;
  }
  return value;
}

function printable(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function getPropertyMap(axNode) {
  const result = new Map();
  for (const property of axNode.properties ?? []) {
    if (!property || typeof property.name !== 'string') continue;
    const name = property.name.toLowerCase();
    if (!KEPT_PROPERTIES.has(name)) continue;
    const value = axValue(property.value);
    if (printable(value)) result.set(name, value);
  }
  return result;
}

function toSnapshotNode(axNode, depth) {
  if (!axNode || axNode.ignored === true) return null;

  const role = axValue(axNode.role);
  if (typeof role !== 'string' || role.length === 0) return null;
  const normalizedRole = role.toLowerCase();
  if (IGNORED_ROLES.has(normalizedRole)) return null;

  const rawName = axValue(axNode.name);
  const name = typeof rawName === 'string' && rawName.length > 0 ? rawName : undefined;
  const rawValue = axValue(axNode.value);
  const value = printable(rawValue) && rawValue !== '' ? rawValue : undefined;
  const properties = getPropertyMap(axNode);

  if (!name && value === undefined && properties.size === 0 &&
      !STRUCTURAL_ROLES.has(normalizedRole)) {
    return null;
  }

  const node = {
    nodeId: axNode.nodeId,
    role,
    depth
  };
  if (axNode.backendDOMNodeId !== undefined) {
    node.backendDOMNodeId = axNode.backendDOMNodeId;
  }
  if (name !== undefined) node.name = name;
  if (value !== undefined) node.value = value;
  for (const [property, propertyValue] of properties) {
    node[property] = propertyValue;
  }
  return node;
}

function isUnsupported(error) {
  const message = String(error?.message ?? error);
  return error?.code === -32601 ||
    /method.{0,40}(not found|wasn.t found|unknown|unsupported)|(not found|wasn.t found|unknown|unsupported).{0,40}method/i.test(message);
}

function isPageNotReady(error) {
  const message = String(error?.message ?? error);
  return /no frame|cannot find.{0,20}(frame|context)|frame.{0,30}(not found|detached)|(execution )?context.{0,30}(not found|destroyed)|target.{0,20}(closed|crashed)|session.{0,20}(closed|detached)|page.{0,20}(not ready|not available)|document.{0,30}not available/i.test(message);
}

function formatNode(node) {
  const indent = '  '.repeat(node.depth);
  let line = `${indent}- ${node.role}`;
  if (node.name !== undefined) line += ` ${JSON.stringify(node.name)}`;
  if (node.value !== undefined) line += ` value=${JSON.stringify(node.value)}`;

  const fields = [`nodeId=${JSON.stringify(node.nodeId)}`];
  if (node.backendDOMNodeId !== undefined) {
    fields.push(`backendDOMNodeId=${JSON.stringify(node.backendDOMNodeId)}`);
  }
  for (const property of KEPT_PROPERTIES) {
    if (Object.hasOwn(node, property)) {
      fields.push(`${property}=${JSON.stringify(node[property])}`);
    }
  }
  return `${line} (${fields.join(', ')})`;
}

/**
 * 读取并精简当前页面的无障碍树。
 * Read and simplify the current page's accessibility tree.
 *
 * @param {(method: string, params: object, sessionId: string) => Promise<object>} send 注入的 CDP 发送函数 / Injected CDP send function.
 * @param {string} sessionId 页面 session ID / Page session ID.
 * @param {{maxNodes?: number}} [options] 配置；默认最多 500 个有效节点 / Options; defaults to 500 meaningful nodes.
 * @returns {Promise<{nodes: Array<object>, snapshot: string, nodeCount: number, maxNodes: number, truncated: boolean}>} 结构化节点与可读快照 / Structured nodes and readable snapshot.
 * @throws {PageSnapshotError} 协议不支持、页面未就绪或 CDP 调用失败时抛出 / Throws when unsupported, not ready, or a CDP call fails.
 */
export async function getPageSnapshot(send, sessionId, { maxNodes = 500 } = {}) {
  if (typeof send !== 'function') throw new TypeError('send 必须是函数 / send must be a function');
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new TypeError('sessionId 必须是非空字符串 / sessionId must be a non-empty string');
  }
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1) {
    throw new RangeError('maxNodes 必须是正安全整数 / maxNodes must be a positive safe integer');
  }

  let response;
  try {
    response = await send('Accessibility.getFullAXTree', {}, sessionId);
  } catch (error) {
    if (isUnsupported(error)) {
      throw new PageSnapshotError(
        'PROTOCOL_UNSUPPORTED',
        '当前浏览器或目标不支持 Accessibility.getFullAXTree',
        error
      );
    }
    if (isPageNotReady(error)) {
      throw new PageSnapshotError('PAGE_NOT_READY', `页面尚未就绪：${error?.message ?? error}`, error);
    }
    throw new PageSnapshotError(
      'CDP_ERROR',
      `CDP 调用 Accessibility.getFullAXTree 失败：${error?.message ?? String(error)}`,
      error
    );
  }

  if (!response || !Array.isArray(response.nodes)) {
    throw new PageSnapshotError(
      'CDP_ERROR',
      'CDP 响应无效：Accessibility.getFullAXTree 未返回 nodes 数组'
    );
  }
  if (response.nodes.length === 0) {
    throw new PageSnapshotError('PAGE_NOT_READY', '页面尚未就绪：无障碍树为空');
  }
  if (response.nodes.some(node => !node || typeof node !== 'object' || node.nodeId === undefined)) {
    throw new PageSnapshotError(
      'CDP_ERROR',
      'CDP 响应无效：无障碍树节点缺少 nodeId'
    );
  }

  const nodeById = new Map();
  const childIds = new Set();
  for (const axNode of response.nodes) {
    nodeById.set(axNode.nodeId, axNode);
    for (const childId of axNode?.childIds ?? []) childIds.add(childId);
  }

  const roots = response.nodes
    .filter(node => node?.nodeId !== undefined && !childIds.has(node.nodeId))
    .map(node => node.nodeId);
  if (roots.length === 0 && response.nodes[0]?.nodeId !== undefined) {
    roots.push(response.nodes[0].nodeId);
  }

  const stack = roots.reverse().map(nodeId => ({ nodeId, depth: 0 }));
  const visited = new Set();
  const snapshotNodes = [];
  let truncated = false;

  while (stack.length > 0) {
    const { nodeId, depth } = stack.pop();
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const axNode = nodeById.get(nodeId);
    if (!axNode) continue;
    const snapshotNode = toSnapshotNode(axNode, depth);
    if (snapshotNode) {
      if (snapshotNodes.length === maxNodes) {
        truncated = true;
        break;
      }
      snapshotNodes.push(snapshotNode);
    }

    const childDepth = depth + (snapshotNode ? 1 : 0);
    const children = axNode.childIds ?? [];
    for (let index = children.length - 1; index >= 0; index--) {
      stack.push({ nodeId: children[index], depth: childDepth });
    }
  }

  return {
    nodes: snapshotNodes,
    snapshot: snapshotNodes.map(formatNode).join('\n'),
    nodeCount: snapshotNodes.length,
    maxNodes,
    truncated
  };
}
