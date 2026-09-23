# cdp-browser

使用 Chrome DevTools Protocol (CDP) 连接已运行的 Chrome、Edge 或 Chromium 浏览器，执行页面文本提取、JavaScript、截图和标签管理。

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
- 标签 ID 记录在系统临时目录的 `cdp-created-tabs.json` 中。

## 命令

| 命令 | 作用 |
|---|---|
| `ping` | 检查 CDP 连接 |
| `extract <url> [--wait ms]` | 提取标题、当前 URL 和最多 200 行页面文本 |
| `eval <url> <js-code> [--wait ms]` | 执行页面 JavaScript 并返回结果 |
| `screenshot <url> <output> [--wait ms]` | 保存当前视口的 PNG 截图 |
| `tabs list` | 列出页面标签；只读取，不关闭 |
| `tabs open <url> [--background]` | 复用或打开标签，并清理其他自有标签 |
| `tabs close <pattern>` | 关闭 URL 匹配的自有标签 |
| `tabs close-id <targetId>` | 关闭明确指定的标签 |
| `tabs close-tracked` / `cleanup` | 关闭自有标签 |
| `cleanup --keep <id,id,...>` | 关闭其他自有标签并保留指定标签 |
