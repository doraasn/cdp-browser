---
name: cdp-browser
description: "通过 Chrome DevTools Protocol (CDP) 连接已运行的浏览器，执行页面快照、交互、数据提取和标签管理。当用户要求连接调试端口、读取网页、操作页面、截图或管理标签时使用。默认后台新建标签、任务结束后统一清理，不关闭用户标签；关闭浏览器、重启浏览器、关闭用户标签、点击提交/删除/购买/发送类控件前，必须先取得用户明确授权。"
metadata:
  version: "1.10.0"
---

# CDP 浏览器自动化

通过 Node.js 脚本连接已运行的 Chrome、Edge 或 Chromium 浏览器。本文档自足：环境、授权、标签策略、命令与安全规则都在这里，无需另读其他文件。

## 环境要求

- Node.js 提供内置 WebSocket API，无需安装 npm 依赖。
- 浏览器需开启本地远程调试端口，默认连接 `127.0.0.1:9222`，可用 `CDP_HOST`、`CDP_PORT` 修改。
- **Chrome 136 及更高版本**对"默认配置 + 调试端口"有策略限制，官方要求另给独立的 `--user-data-dir`。但这是 Chrome 自身的策略，Chromium 分支不一定会拦：本机 CentBrowser 5.3（Chromium 150）实测用**原来的默认配置**加 `--remote-debugging-port=9222 --restore-last-session` 重启后，端口正常、原有 11 个标签全部可读。**先尝试重启同一配置，不要预设它一定不行。**

Windows 启动示例：

```powershell
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="$env:TEMP\chrome-cdp"
```

独立目录是一份新的浏览器配置，原配置中的登录状态和 Cookie 不会自动复制过去。调试端口可以控制浏览器，请限制为本机访问，不要暴露到公网。

## 连接浏览器

1. 先跑 `ping`。脚本会自动发现端点，顺序是：`CDP_PORT` 指定的端口 → 9222 → **正在运行且带 `--remote-debugging-port` 的浏览器**（读进程命令行解析，不盲扫端口）。返回里的 `port`、`portSource` 会说明连的是哪个、怎么找到的。
2. `portSource=running-browser` 说明连上的是**用户自己的浏览器**：可以直接 `tabs list` 看到并操作他的标签（只读优先、用 `--target` 指定、不关闭、不新建）。这是"直接操控用户标签"的唯一可行路径。
3. 一个都没发现时，不要再问用户怎么选，直接启动独立调试实例：

   ```bash
   node scripts/launch_debug_browser.mjs
   ```

   脚本用系统默认浏览器（注册表解析，可用 `CDP_BROWSER_PATH` 覆盖）、独立配置（默认 `%LOCALAPPDATA%\cdp-browser-profile`，可用 `CDP_PROFILE_DIR` 改）和 `--remote-debugging-port` 后台启动，等端口就绪后返回 JSON。想换端口用 `CDP_PORT`。
4. **端口没开时，首选让同一个浏览器带端口重启**（能保留登录态和原有标签，从而真正接管用户自己的标签）：

   ```powershell
   & "$env:LOCALAPPDATA\CentBrowser\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --restore-last-session
   ```

   这会关闭并重开浏览器，**必须先征得用户同意**，不要擅自执行；标签用 `--restore-last-session` 恢复（Chrome/Edge 用 `--restore-last-session`，其它分支同理）。
5. 用户不想重启、或重启后端口仍打不开时，才退回到独立配置实例（见第 3 条），并说明登录态不继承。
6. 不要偷偷接管用户正在用的浏览器；不要在不告知的情况下关闭它。
5. **独立实例有边界**：它看不到、也控制不了用户原窗口里的标签；登录态和 Cookie 不继承，首次需要在这个调试窗口里重新登录。用户要操作的页面如果只在原窗口里，请其提供 URL，在该调试窗口重新打开（必要时登录）。
6. 手动启动（脚本不可用时的备选）：

```powershell
# Chrome
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\cdp-browser-profile" --no-first-run

# Edge
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\cdp-browser-profile" --no-first-run

# CentBrowser（本机路径，按实际安装位置替换）
& "$env:LOCALAPPDATA\CentBrowser\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\cdp-browser-profile" --no-first-run
```

macOS：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir=/tmp/cdp-browser-profile
```

**为什么正常启动的浏览器没有端口**（用户问起时这样解释）：

- 调试端口只在启动参数里带 `--remote-debugging-port` 时才创建，双击打开浏览器不会开。
- Chrome 官方对默认配置有"禁止远程调试"的策略，但是否生效取决于具体构建：本机 CentBrowser 150 实测用原默认配置带端口重启后完全正常。所以先试同一配置重启，失败了再改用独立 `--user-data-dir`。
- Chromium 是单实例：浏览器已在运行时再用同一个 `--user-data-dir` 启动，只会把参数转发给现有进程，端口不会新开。必须先退出（含托盘）再带参数启动。

连上后先验证：`node scripts/cdp_executor.mjs ping` 和 `tabs list`。**ping 不通就继续排查，不要声称已经连上或已经读到页面。**

## 首次连接与授权（硬性规则）

1. 先 `ping`（自动发现端点）；通了就直接用该会话，不关闭、不重启用户的浏览器。
2. 若连的是用户自己的浏览器（`portSource=running-browser`）：只读或按用户授权操作，用 `--target` 指定标签，不新建、不关闭；任务结束也不清理他的标签。
3. 一个端口都没发现时，运行 `node scripts/launch_debug_browser.mjs` 起独立实例，不需要再征求“是否关闭浏览器”的选择；**不得关闭用户正在用的浏览器窗口**。
4. 独立实例读不到用户原窗口的标签，也不继承登录态；不得声称已经恢复或读取了那些标签。需要时请用户提供 URL 或在该窗口重新登录。
5. URL 可能含敏感查询参数，未经用户同意不得保存。不得从未公开的浏览器会话文件推断标签状态。
6. 未能通过 CDP 读到的东西，不得声称已经读到或已经恢复。

## 标签使用规则（核心）

1. **先规划再开标签**。动手前先估算任务需要几个标签：一个标签能跑到结束就只开一个，不要一条命令开一个、用完就关。
2. **优先复用**。同一 URL 的自有标签会被自动复用；连续任务应复用同一批标签直到结束，避免反复新建/关闭造成抖动和性能损耗。
3. **用户指定已有标签时，只使用用户的标签，不新建任何标签**。先用 `tabs list` 找到目标标签 ID，之后所有页面命令都带 `--target <id>`；需要原地操作时 URL 位置传 `-`，不要为了操作而导航或另开标签。注意这只对**已连接实例内**的标签成立；用户原浏览器窗口里的标签在独立调试实例中不可见，需要请其在该窗口重新打开。
4. **不关闭用户标签**。用户标签不进入追踪，`cleanup`、`tabs close` 都不会碰它；任务结束后也不得关闭。只有用户明确要求关闭某个标签时，才可用 `tabs close-id <id>` 精确关闭。
5. **新建标签一律后台**。默认 `background=true`，不抢占焦点、不打断用户；只有用户明确要求前台调试时才加 `--foreground`。
6. **任务结束统一清理**。全部任务完成后执行一次 `cleanup`；要留给用户查看的标签用 `cleanup --keep <id,...>` 保留。不要每条命令后都 `cleanup` 或 `tabs close`。
7. **能并行就并行**。需要多个页面时，用一次 `tabs open <url1> <url2> ...` 批量后台打开，或并发执行多次命令；各自用 `--target` 指向自己的标签。追踪文件带文件锁，并发安全。
8. **外部变更需授权**。点击提交、删除、购买、发送等会造成外部变更的控件前，必须取得用户明确授权；填写内容本身不代表允许提交。

## 使用入口

```bash
node "$SKILLS_ROOT/cdp-browser/scripts/cdp_executor.mjs" <command> [args...]
node "$SKILLS_ROOT/cdp-browser/scripts/launch_debug_browser.mjs"   # 端口没开时先起独立调试实例
```

在技能目录内执行时可简写为 `node scripts/cdp_executor.mjs <command> [args...]`。所有命令输出 JSON；失败时以非零状态退出。标签相关输出字段：`targetId`、`newTab`（本次是否新建）、`reusedTab`（是否复用）。

常用命令：

```bash
node scripts/cdp_executor.mjs ping
node scripts/cdp_executor.mjs tabs list
node scripts/cdp_executor.mjs tabs open <url...> [--foreground]
node scripts/cdp_executor.mjs extract <url|-> [--wait <ms>] [--target <id>] [--foreground]
node scripts/cdp_executor.mjs eval <url|-> <js-code> [--target <id>]
node scripts/cdp_executor.mjs snapshot <url|-> [--target <id>]
node scripts/cdp_executor.mjs screenshot <url|-> <output-path> [--target <id>]
node scripts/cdp_executor.mjs click <url|-> <selector> [--target <id>]
node scripts/cdp_executor.mjs fill <url|-> <selector> <value> [--target <id>]
node scripts/cdp_executor.mjs press <url|-> <selector> <key> [--target <id>]
node scripts/cdp_executor.mjs scroll <url|-> <selector> <direction> [amount] [--target <id>]
node scripts/cdp_executor.mjs cleanup [--keep <id,id,...>]
```

## 命令参考

| 命令 | 作用 |
|---|---|
| `ping` | 检查 CDP 连接 |
| `tabs list` | 列出页面标签及其 `tracked` 状态；只读取，不关闭 |
| `tabs open <url...> [--foreground]` | 后台打开或复用标签，可一次传多个 URL；不关闭其他标签 |
| `extract <url> [--wait ms]` | 提取标题、当前 URL 和最多 200 行页面文本 |
| `eval <url> <js-code> [--wait ms]` | 执行页面 JavaScript 并返回结果 |
| `screenshot <url> <output> [--wait ms]` | 保存当前视口的 PNG 截图 |
| `snapshot <url>` | 读取精简的无障碍树，最多 500 个节点 |
| `wait-for <url> <selector> [--timeout ms]` | 等待 selector 对应的可见元素 |
| `click <url> <selector> [--timeout ms]` | 等待并点击唯一、可见、可用的元素 |
| `fill <url> <selector> <value> [--timeout ms]` | 等待并填写文本 input、textarea 或 contenteditable |
| `press <url> <selector> <key> [--timeout ms]` | 聚焦元素并发送按键，支持 `Control+A` 等组合键 |
| `scroll <url> <selector> <direction> [amount] [--timeout ms]` | 滚动最近的可滚动祖先或页面，amount 为 1–10000 |
| `tabs close <pattern>` | 关闭 URL 匹配的自有标签 |
| `tabs close-id <targetId>` | 关闭明确指定的标签（用户要求关闭用户标签时才用） |
| `tabs close-tracked` / `cleanup` | 任务结束后关闭本脚本创建并追踪的所有标签 |
| `cleanup --keep <id,id,...>` | 关闭其他自有标签并保留指定标签 |

页面命令可附加 `--target <id>` 精确选择现有标签，附加 `--foreground` 才会把标签切到前台。若不需要导航，在 URL 位置传 `-`，例如 `click - "button.search" --target TARGET_ID`。不传 `--target` 时，页面命令只复用 URL 相同的自有标签，没有才新建，且不关闭其他标签。

## 标签归属与清理

- 只有脚本自己创建并追踪的标签会被清理；用户已有标签只允许读取列表，或通过 `--target` 使用。
- 脚本创建标签时记录在系统临时目录下、以浏览器调试会话标识区分的追踪文件内，写入使用文件锁和原子替换；不得把旧版共享追踪文件里的标签 ID 当作本会话自有标签。
- 每次操作前刷新标签列表；过期 ID 会报错并停止，不会猜测替代标签。URL 位置传 `-` 表示不导航当前标签。
- 页面命令本身不关闭任何标签；清理只发生在显式调用 `cleanup` / `tabs close*` 时。

## 示例

```bash
# 只读调研，一个标签跑到底
node scripts/cdp_executor.mjs tabs open "https://example.org"
node scripts/cdp_executor.mjs extract - --target TARGET_ID
node scripts/cdp_executor.mjs click - "a.more" --target TARGET_ID
node scripts/cdp_executor.mjs cleanup --keep TARGET_ID

# 并行任务：一次开两个后台标签
node scripts/cdp_executor.mjs tabs open "https://a.example" "https://b.example"
node scripts/cdp_executor.mjs extract - --target TAB_A
node scripts/cdp_executor.mjs extract - --target TAB_B

# 使用用户已有标签：只读只写，不新建、不关闭
node scripts/cdp_executor.mjs tabs list
node scripts/cdp_executor.mjs fill - "input[name=q]" "CDP" --target USER_TAB
```

## 测试

在技能目录内执行 `node --test`（自动发现 `tests/*.test.mjs`）。Windows PowerShell 下 `tests/` 目录参数和 `*` 通配符不会被展开，不要写成 `node --test tests/*.test.mjs`。
