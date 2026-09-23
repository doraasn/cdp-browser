# cdp-browser

使用 Chrome DevTools Protocol (CDP) 连接已运行的 Chrome、Edge 或 Chromium 浏览器，执行页面文本提取、JavaScript、截图和标签管理。

## 首次连接与授权

1. 先运行 `ping` 检查调试端口。若连接成功，直接使用该浏览器会话，不关闭或重启浏览器。
2. 若连接失败且浏览器已打开，不要自动关闭。询问用户是否允许关闭/重启、是否要恢复旧标签，并提供“保持原浏览器运行，另开调试配置”的选项。
3. Chrome 136+ 的远程调试需要独立 `--user-data-dir`。新配置不会继承原配置的登录态、Cookie 或页面状态。即使重开标签，也只能恢复可读取到的 URL；表单、滚动位置和登录态不保证恢复。
4. 只有在用户同意后才关闭浏览器。若调试端口未开，CDP 无法读取旧标签；只有在用户选择恢复且能通过已授权的界面读取时才记录 URL，否则请用户提供标签地址。URL 可能含敏感查询参数，未经用户同意不得保存。不得从未公开的浏览器会话文件推断标签状态。
5. 用户不同意关闭时，保持原浏览器不动。可经用户同意另开独立调试配置，但需说明需要重新登录。

## 环境要求

- Node.js 提供内置 WebSocket API，无需安装 npm 依赖。
- 浏览器需开启本地远程调试端口。
- **Chrome 136 及更高版本**要求调试启动参数同时指定独立的 `--user-data-dir`；默认用户数据目录不再开放远程调试端口。

Windows 示例：

```powershell
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="$env:TEMP\chrome-cdp"
```

独立目录是新的浏览器配置，原配置中的登录状态和 Cookie 不会自动复制过去。调试端口可以控制浏览器，请限制为本机访问，不要暴露到公网。

## 使用

```bash
node scripts/cdp_executor.mjs <command> [args...]
```

默认连接 `127.0.0.1:9222`，可用 `CDP_HOST`、`CDP_PORT` 修改。

```bash
node scripts/cdp_executor.mjs ping
node scripts/cdp_executor.mjs extract "https://example.org" --wait 3000
node scripts/cdp_executor.mjs eval "https://example.org" "document.title"
node scripts/cdp_executor.mjs screenshot "https://example.org" "page.png"
node scripts/cdp_executor.mjs snapshot "https://example.org"
node scripts/cdp_executor.mjs wait-for "https://example.org" "main h1" --timeout 10000
node scripts/cdp_executor.mjs click - "button.search" --target TARGET_ID
node scripts/cdp_executor.mjs fill - "input[name=q]" "CDP" --target TARGET_ID
node scripts/cdp_executor.mjs press - "input[name=q]" Enter --target TARGET_ID
node scripts/cdp_executor.mjs scroll - "main" down 500 --target TARGET_ID
node scripts/cdp_executor.mjs tabs list
node scripts/cdp_executor.mjs tabs open "https://example.org" --background
node scripts/cdp_executor.mjs cleanup --keep TARGET_ID
```

所有命令输出 JSON；失败时以非零状态退出。

## 标签范围与清理

- 脚本只自动操作自己创建并记录的标签。其他现存标签不会因打开新页面、提取、截图或清理而关闭。
- `extract`、`eval`、`screenshot` 和 `tabs open` 会先在自有标签中按 URL 精确查找可复用标签；找到则复用，未找到才新建。
- 复用或新建时会关闭其余自有标签，保留本次目标标签。
- `tabs close <pattern>` 只关闭 URL 匹配的自有标签。
- `tabs close-id <targetId>` 仅在明确给出标签 ID 时关闭该标签；可用于用户指定的标签。
- 任务结束时运行 `cleanup` 关闭自有标签；需要展示的自有标签通过 `cleanup --keep ID1,ID2` 保留。
- 可用 `--target <id>` 将操作限定到 `tabs list` 返回的指定标签；每次操作都会刷新列表，已失效的 ID 会报错，不会猜测替代标签。指定 URL 时会导航该标签；传 `-` 表示保留当前页面。
- `snapshot` 输出精简无障碍树；`click`、`fill`、`press`、`scroll` 会等待唯一且可见的 CSS selector 匹配项（默认 10 秒，可用 `--timeout` 修改）。`wait-for` 也可单独等待元素。
- 点击可能提交表单或触发外部变更。只有用户明确授权后，才点击提交、删除、购买、发送等高影响控件；填写表单不等于授权提交。
- 标签 ID 记录在系统临时目录中，以浏览器调试会话标识区分的追踪文件内。
- 追踪文件按浏览器调试会话隔离，写入采用文件锁和原子替换；新版本不会导入旧版共享追踪文件中的 ID，避免误关标签。

## 命令

| 命令 | 作用 |
|---|---|
| `ping` | 检查 CDP 连接 |
| `extract <url> [--wait ms]` | 提取标题、当前 URL 和最多 200 行页面文本 |
| `eval <url> <js-code> [--wait ms]` | 执行页面 JavaScript 并返回结果 |
| `screenshot <url> <output> [--wait ms]` | 保存当前视口的 PNG 截图 |
| `snapshot <url>` | 读取精简的无障碍树，最多 500 个节点 |
| `wait-for <url> <selector> [--timeout ms]` | 等待 selector 对应的可见元素 |
| `click <url> <selector> [--timeout ms]` | 等待并点击唯一、可见、可用的元素 |
| `fill <url> <selector> <value> [--timeout ms]` | 等待并填写文本 input、textarea 或 contenteditable |
| `press <url> <selector> <key> [--timeout ms]` | 聚焦元素并发送按键，支持 `Control+A` 等组合键 |
| `scroll <url> <selector> <direction> [amount] [--timeout ms]` | 滚动最近的可滚动祖先或页面 |
| `tabs list` | 列出页面标签；只读取，不关闭 |
| `tabs open <url> [--background]` | 复用或打开标签，并清理其他自有标签 |
| `tabs close <pattern>` | 关闭 URL 匹配的自有标签 |
| `tabs close-id <targetId>` | 关闭明确指定的标签 |
| `tabs close-tracked` / `cleanup` | 关闭自有标签 |
| `cleanup --keep <id,id,...>` | 关闭其他自有标签并保留指定标签 |

页面命令可附加 `--target <id>` 精确选择现有标签。若不需要导航，在 URL 位置传 `-`，例如 `click - "button.search" --target TARGET_ID`。不传 `--target` 时，页面命令只复用或新建脚本自有标签。

运行单元和 CLI 边界测试：

```bash
node --test tests/*.test.mjs
```
