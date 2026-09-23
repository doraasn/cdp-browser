---
name: cdp-browser
description: "通过 Chrome DevTools Protocol (CDP) 连接已运行的浏览器，执行页面快照、交互、数据提取和标签管理。当用户要求连接调试端口、读取网页、操作页面、截图或管理标签时使用。"
metadata:
  version: "1.4.0"
---

# CDP 浏览器自动化

通过 Node.js 脚本连接已运行的 Chrome、Edge 或 Chromium 浏览器。环境准备、Chrome 136+ 的启动要求、标签安全边界和命令说明见同目录 [README.md](README.md)。

## 首次连接流程

- 先运行 `ping`。若调试端口可用，复用该会话，不重启浏览器。
- 若端口不可用且浏览器正在运行，先询问用户是否允许关闭/重启，并询问是否要恢复旧标签；同时说明可以保持原浏览器运行、另开独立调试配置。
- Chrome 136+ 的调试配置必须使用独立 `--user-data-dir`，不能自动继承原配置的 Cookie、登录态或页面状态。恢复标签仅指重新打开能读取到的 URL。
- 只有用户明确同意后才能关闭浏览器。CDP 未开启时不能通过 CDP 读取旧标签；若没有其他已授权的标签读取方式，不得声称可以恢复。
- 用户拒绝关闭时，保持现有浏览器及其标签不动。

## 使用入口

```bash
node "$SKILLS_ROOT/cdp-browser/scripts/cdp_executor.mjs" <command> [args...]
```

常用命令：

```bash
node scripts/cdp_executor.mjs ping
node scripts/cdp_executor.mjs extract <url> [--wait <ms>]
node scripts/cdp_executor.mjs eval <url> <js-code> [--wait <ms>]
node scripts/cdp_executor.mjs screenshot <url> <output-path> [--wait <ms>]
node scripts/cdp_executor.mjs snapshot <url> [--max-nodes <n>]
node scripts/cdp_executor.mjs wait-for <url> <selector> [--timeout <ms>]
node scripts/cdp_executor.mjs click <url|-> <selector> [--timeout <ms>] [--target <id>]
node scripts/cdp_executor.mjs fill <url|-> <selector> <value> [--timeout <ms>] [--target <id>]
node scripts/cdp_executor.mjs press <url|-> <selector> <key> [--timeout <ms>] [--target <id>]
node scripts/cdp_executor.mjs scroll <url|-> <selector> <direction> [amount] [--timeout <ms>] [--target <id>]
node scripts/cdp_executor.mjs tabs list
node scripts/cdp_executor.mjs tabs open <url> [--background]
node scripts/cdp_executor.mjs cleanup [--keep <id,id,...>]
```

## 标签安全规则

- 默认只操作脚本自己创建并追踪的标签。对其他标签只允许读取列表；关闭用户已有标签必须由用户明确指定标签 ID。
- 打开页面时优先复用 URL 完全相同的自有标签；关闭其余自有标签。没有可复用标签时才创建。
- 任务结束后，若需把标签留给用户查看，调用 `cleanup --keep <targetId,...>` 保留目标标签并关闭其余自有标签。
- 标签追踪按浏览器调试会话隔离，并发修改使用文件锁；不得把旧版共享追踪文件里的标签 ID 当作本会话自有标签。
- 页面命令可用 `--target <id>` 精确选择用户指定的标签；每次操作前刷新标签列表，过期 ID 会报错并停止。URL 位置传 `-` 表示不导航当前标签。
- `snapshot` 读取精简无障碍树；`wait-for` 等待可见 CSS selector；`click`、`fill`、`press`、`scroll` 会等待唯一、可见的 selector 匹配项（默认 10 秒，可传 `--timeout`）。
- 点击提交、删除、购买、发送等会造成外部变更的控件前，必须取得用户明确授权；填写内容本身不代表允许提交。

示例：

```bash
node scripts/cdp_executor.mjs snapshot - --target TARGET_ID
node scripts/cdp_executor.mjs click - "button.search" --target TARGET_ID
node scripts/cdp_executor.mjs fill - "input[name=q]" "CDP" --target TARGET_ID
```
