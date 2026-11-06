---
name: cdp-browser
description: "通过 Chrome DevTools Protocol (CDP) 连接已运行的浏览器，执行页面快照、交互、数据提取和标签管理。当用户要求连接调试端口、读取网页、操作页面、截图或管理标签时使用。默认后台新建标签、任务结束后统一清理，不关闭用户标签；关闭浏览器、重启浏览器、关闭用户标签、点击提交/删除/购买/发送类控件前，必须先取得用户明确授权。"
metadata:
  version: "1.18.1"
---

# CDP 浏览器自动化

通过 Node.js 脚本连接已运行的 Chrome、Edge 或 Chromium 浏览器。本文档自足：环境、授权、标签策略、命令与安全规则都在这里，无需另读其他文件。

## 环境要求

- Node.js 提供内置 WebSocket API，无需安装 npm 依赖。
- 浏览器需开启本地远程调试端口，默认连接 `127.0.0.1:9222`，可用 `CDP_HOST`、`CDP_PORT` 修改。
- **Chrome 136 及更高版本**对"默认配置 + 调试端口"有策略限制，官方要求另给独立的 `--user-data-dir`。但这是 Chrome 自身的策略，Chromium 分支不一定会拦：本机 CentBrowser 5.3（Chromium 150）实测用**原来的默认配置**加 `--remote-debugging-port=9222 --restore-last-session` 重启后，端口正常、原有 11 个标签全部可读。**用户要求接管他自己浏览器时才尝试重启；默认不重启，先只用只读或独立实例。**

Windows 启动示例：

```powershell
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="$env:TEMP\chrome-cdp"
```

独立目录是一份新的浏览器配置，原配置中的登录状态和 Cookie 不会自动复制过去。调试端口可以控制浏览器，请限制为本机访问，不要暴露到公网。

## 连接浏览器

1. 先跑 `ping`。脚本会自动发现端点，顺序是：`CDP_PORT` 指定的端口 → 9222 → **正在运行且带 `--remote-debugging-port` 的有界面浏览器**（读进程命令行解析，不盲扫端口）。**默认跳过 headless 实例**，避免误连别的项目跑着的自动化浏览器；需要时用 `CDP_INCLUDE_HEADLESS=1` 打开，或用 `CDP_IGNORE_PORTS=9223,9333` 排除指定端口。返回里的 `port`、`portSource` 说明连的是哪个、怎么找到的。
2. 本机同时跑着别的项目浏览器时，**建议每条命令都显式带 `CDP_PORT`**，不要依赖自动发现来回退。判断连的是谁：`portSource` 为 `default` 或 `running-browser` 都可能是**用户自己的浏览器**（9222 上就可能是他的日常浏览器），看 `tabs list` 里 `tracked=false` 的标签即可确认。这种情况下可以直接用 `--target` 操作他的标签（只读优先、不关闭、不新建）。
3. **每个命令都是独立进程**：用了非默认端口时，每条命令都要带上，例如 PowerShell 里先 `$env:CDP_PORT='9390'`，或用 `CDP_PORT=9390 node ...`（bash）。
4. 一个端口都没发现时，不要再问用户怎么选，直接启动独立调试实例：

   ```bash
   node scripts/launch_debug_browser.mjs
   ```

   脚本用系统默认浏览器（注册表解析，可用 `CDP_BROWSER_PATH` 覆盖）、独立配置（默认 `%LOCALAPPDATA%\cdp-browser-profile`，可用 `CDP_PROFILE_DIR` 改）和 `--remote-debugging-port` 后台启动，等端口就绪后返回 JSON。显式设了 `CDP_PORT` 时只用该端口，不会悄悄换端口。
5. 想直接接管用户自己的标签：**经用户同意后**让同一个浏览器带端口重启（保留登录态和原有标签）：

   ```powershell
   & "$env:LOCALAPPDATA\CentBrowser\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --restore-last-session
   ```

   这会关闭并重开浏览器，**必须先征得同意，不要擅自执行**。
6. 用户不想重启、或重启后端口仍打不开时，才退回独立配置实例（见第 4 条），并说明登录态不继承、看不到原窗口标签。
7. 不要偷偷接管用户正在用的浏览器；不要在不告知的情况下关闭它。

手动启动（脚本不可用时的备选）：

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

### Windows 快捷方式配置（保持端口可用）

端口和会话恢复都由**启动参数**决定，而 Windows 上不同入口各有一份快捷方式，参数不一致就会出现"有时能连、有时连不上"。需要同时改这几处：

- 任务栏固定：`%APPDATA%\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\<浏览器>.lnk`
- 开始菜单：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\<浏览器>.lnk`

统一使用下面的参数（端口按实际改）：

```text
--remote-debugging-port=9222 --remote-allow-origins=* --restore-last-session
```

- `--remote-debugging-port` 打开 CDP 端口；
- `--remote-allow-origins=*` 放宽 WebSocket 来源校验，仅本机端口时风险低，不需要可去掉；
- `--restore-last-session` 重启后恢复上次的标签页，避免关浏览器就丢现场。

用 PowerShell 改（改前先备份 `.lnk`）：

```powershell
$lnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Cent Browser.lnk"
Copy-Item $lnk "$env:TEMP\Cent Browser.lnk.bak" -Force
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnk)
$shortcut.Arguments = '--remote-debugging-port=9222 --remote-allow-origins=* --restore-last-session'
$shortcut.Save()
```

改完必须**完全退出浏览器（含托盘图标）**再从快捷方式启动才生效；然后 `ping` 应返回 `portSource=default`，`tabs list` 能看到原有标签。只改快捷方式不会影响正在运行的实例。

**为什么正常启动的浏览器没有端口**（用户问起时这样解释）：

- 调试端口只在启动参数里带 `--remote-debugging-port` 时才创建，双击打开浏览器不会开。
- Chrome 官方对默认配置有"禁止远程调试"的策略，但是否生效取决于具体构建：本机 CentBrowser 150 实测用原默认配置带端口重启后完全正常。所以先试同一配置重启，失败了再改用独立 `--user-data-dir`。
- Chromium 是单实例：浏览器已在运行时再用同一个 `--user-data-dir` 启动，只会把参数转发给现有进程，端口不会新开。必须先退出（含托盘）再带参数启动。

连上后先验证：`node scripts/cdp_executor.mjs ping` 和 `tabs list`。**ping 不通就继续排查，不要声称已经连上或已经读到页面。**

## 首次连接与授权（硬性规则）

1. 先 `ping`（自动发现端点）；通了就直接用该会话，不关闭、不重启用户的浏览器。`ping` 连不上时仍输出 JSON 但 `connected=false`、退出码为 1，用脚本调用时先看退出码。
2. 若连的是用户自己的浏览器（`portSource` 为 `default` 或 `running-browser`，或 `tabs list` 里 `tracked=false` 的标签）：只读或按用户授权操作，用 `--target` 指定标签，不新建、不关闭；任务结束也不清理他的标签。
3. 一个端口都没发现时，运行 `node scripts/launch_debug_browser.mjs` 起独立实例，不需要再征求“是否关闭浏览器”的选择；**不得关闭用户正在用的浏览器窗口**。显式设了 `CDP_PORT` 时脚本只认该端口，不会去探测或复用别的端口。
4. 独立实例读不到用户原窗口的标签，也不继承登录态；不得声称已经恢复或读取了那些标签。需要时请用户提供 URL 或在该窗口重新登录。
5. URL 可能含敏感查询参数，未经用户同意不得保存。不得从未公开的浏览器会话文件推断标签状态。
6. 未能通过 CDP 读到的东西，不得声称已经读到或已经恢复。
7. 失败信息以 JSON 写到 **stderr**：PowerShell 里用 `2>&1` 合并输出，并检查 `$LASTEXITCODE`，否则容易误以为命令没有输出。

## 标签使用规则（核心）

**开工清单（每个任务过一遍；跨轮次、隔很久再继续的任务要重新过）**

- 这次要开几个标签？能一个标签跑到结束就只开一个。
- 全部**后台**打开，记下 `targetId`，后续每条命令都带 `--target`。
- 结束怎么收：哪些用 `tabs close-id` 关、哪些要留给用户。

**三条硬红线**

- **不提供任何前台/激活能力**：`--foreground`、`--user-requested-foreground` 一律报错退出；标签只在后台打开和操作，绝不抢用户焦点。
- **不要绕过技能抢焦点**：禁止用 `/json/new`、`/json/activate`、`Page.bringToFront` 等原生接口开或激活标签；新建一律用 `tabs open`（后台）。用户说“别打扰我”时，连新窗口都不要弹。
- **不要为了截图/调试去改应用、插件或前端的启动参数**：不要往 Electron / 桌面程序 / 前端代码里塞 `--remote-debugging-port` 之类的参数，也不要把桌面应用窗口当网页标签来操控；要验证 UI 就用浏览器打开网页或本地预览页，并后台打开。
- 收尾只关自己开的：优先 `tabs close-id <id>`。`cleanup` / `tabs close` / `close-tracked` **默认只动本会话（owner）的标签**；加 `--all` 才会连别的会话和历史遗留一起关，执行前必须确认没有其他会话正在用浏览器。

**细则**

1. **先规划再开标签**。动手前先估算任务需要几个标签：一个标签能跑到结束就只开一个，不要一条命令开一个、用完就关。**每条页面命令都显式带 `--target`**：漏带时会静默新建标签并进入追踪，随后 `cleanup` 会把它关掉。
2. **优先复用**。同一 URL 的自有标签会被自动复用；连续任务应复用同一批标签直到结束，避免反复新建/关闭造成抖动和性能损耗。
3. **用户指定已有标签时，只使用用户的标签，不新建任何标签**。先用 `tabs list` 找到目标标签 ID，之后所有页面命令都带 `--target <id>`；需要原地操作时 URL 位置传 `-`。**只对 `tracked=false` 的用户标签做保护**：带 URL 导航它会被拒绝（避免覆盖他当前的页面），确实要导航必须显式加 `--navigate-user-tab`；自有标签带 URL 则正常导航。注意这只对**已连接实例内**的标签成立；独立调试实例看不到用户原窗口的标签，需要请其在该窗口重新打开。
4. **不关闭用户标签**。用户标签不进入追踪，`cleanup`、`tabs close` 都不会碰它；任务结束后也不得关闭。只有用户明确要求关闭某个标签时，才可用 `tabs close-id <id>` 精确关闭。
5. **新建标签一律后台，没有前台参数**。`tabs open` 固定 `background=true`，收到 `--foreground` / `--user-requested-foreground` 直接报错退出。用户标签被冻结时不要试图激活它，改用 `tabs open` 新标签，或请用户自己点开那个标签。
6. **任务结束统一清理**。收尾用 `tabs close-id` 精确关掉本次任务自己开的标签；`cleanup` 默认只关本会话标签，加 `--all` 才会全局清理。要留给用户查看的标签保留并在最后说明，不要每条命令后都 `cleanup`。
7. **能并行就并行**。需要多个页面时，用一次 `tabs open <url1> <url2> ...` 批量后台打开，或并发执行多次命令；各自用 `--target` 指向自己的标签。追踪文件带文件锁，并发安全。
8. **外部变更需授权**。点击提交、删除、购买、发送等会造成外部变更的控件前，必须取得用户明确授权；填写内容本身不代表允许提交。

## 多会话共用浏览器（约定）

- **归属自动判定**：`CDP_OWNER` > `DSH_SESSION_ID` > `default`。同一台机器上不同会话天然是不同的 owner，不需要手工设置。
- **子代理也是独立 owner**：被派生的子代理拿到的是自己的 `DSH_SESSION_ID`（与父会话不同），不会和父会话互相关闭对方标签；确实要让子代理接管父会话的标签时，给双方显式设置同一个 `CDP_OWNER`。
- **默认隔离**：`cleanup`、`tabs close`、`tabs close-tracked` 只处理本会话的标签；`tabs list` 用 `owner` / `mine` 认领，不要靠数量猜。
- **同一 URL 只复用本会话的标签**：两个会话同时开同一个 URL 会各开一个，不会串台；跨会话不会共用标签。
- **`--all` 是唯一的全局清理**：会关闭其他会话的标签和旧版遗留（owner=`legacy`）的跟踪标签，执行前确认没有别的会话正在用浏览器。
- **不要共享同一个标签做交互**：两个会话同时用 `--target` 点同一个标签，动作会交错、结果不确定；要并行就各开各的。
- **用户标签永远安全**：不进入追踪，任何 owner 都关不掉。

## 使用入口

```bash
node "$SKILLS_ROOT/cdp-browser/scripts/cdp_executor.mjs" <command> [args...]
node "$SKILLS_ROOT/cdp-browser/scripts/launch_debug_browser.mjs"   # 一个端口都没发现时，起独立调试实例
```

在技能目录内执行时可简写为 `node scripts/cdp_executor.mjs <command> [args...]`。成功结果输出到 **stdout**，失败信息输出到 **stderr**，都是 JSON；失败时退出码非零（`ping` 连不上也返回 1，同时 stdout 里有 `connected=false`）。

常见返回字段：

| 命令 | 返回 |
|---|---|
| `tabs list` | 数组，每项 `id`、`title`、`url`、`tracked`、`owner`、`mine`；覆盖所有窗口 |
| `tabs open` | 单个 URL 返回扁平对象（`targetId`、`url`、`newTab`、`reusedTab`、`background`）；多个 URL 返回 `{ tabs: [...] }` |
| `extract` | `title`、`url`、`lines`、`totalLines`、`targetId`、`newTab`、`reusedTab` |
| `eval` | `result`（页面表达式返回值） |
| `screenshot` | `path`、`size`、`newTab`、`reusedTab` |
| `snapshot` | `nodes`、`snapshot`、`nodeCount`、`maxNodes`、`truncated` |
| `click` | `action`、`selector`、`element`、`x`、`y` |
| `fill` | `action`、`selector`、`element`、`changed`、`valueLength`（**不回显输入内容**，要核对就再 `eval` 读一次） |
| `press` / `scroll` | `action`、`selector`、`element`（按键会发送 keydown/keyup，可能触发页面监听和默认行为，例如 Enter 提交表单） |
| `cleanup` | `cleanedUp`、`failed`、`keptTracked`、`scope`（`owner <id>` 或 `all tracked tabs`） |

### 复杂 JS 用 `--file`，不要塞进命令行

Windows PowerShell 会吞掉或转义内层引号，稍长的 JS 传进去很容易变成 `SyntaxError: Unexpected end of input`。把 JS 写到文件再执行：

```powershell
node scripts/cdp_executor.mjs eval - --target TARGET_ID --file .\snippet.js
Get-Content .\snippet.js -Raw | node scripts/cdp_executor.mjs eval - --target TARGET_ID --stdin
```

bash 下对应 `cat snippet.js | node scripts/cdp_executor.mjs eval - --target TARGET_ID --stdin`。短表达式（如 `document.title`）仍可直接作为参数传。

**不要用 `| Select-Object -First N` 截断这些命令的输出**：管道提前关闭会让 node 收到 EPIPE 并以退出码 1 结束，看起来像“命令失败但 JSON 是 success”。需要截断就先 `2>&1 | Out-String` 收全，再处理字符串。

常用命令：

```bash
node scripts/cdp_executor.mjs ping
node scripts/cdp_executor.mjs tabs list
node scripts/cdp_executor.mjs tabs open <url...>            # 固定后台；前台参数会被拒绝
node scripts/cdp_executor.mjs extract <url|-> [--wait <ms>] [--target <id>]
node scripts/cdp_executor.mjs eval <url|-> <js-code> [--target <id>]
node scripts/cdp_executor.mjs eval <url|-> --file <js-path> [--target <id>]
node scripts/cdp_executor.mjs snapshot <url|-> [--target <id>]
node scripts/cdp_executor.mjs screenshot <url|-> <output-path> [--target <id>]
node scripts/cdp_executor.mjs click <url|-> <selector> [--target <id>]
node scripts/cdp_executor.mjs fill <url|-> <selector> <value> [--target <id>]
node scripts/cdp_executor.mjs press <url|-> <selector> <key> [--target <id>]
node scripts/cdp_executor.mjs scroll <url|-> <selector> <direction> [amount] [--target <id>]
node scripts/cdp_executor.mjs cleanup [--keep <id,id,...>] [--all]
```

## 脚本结构

| 文件 | 职责 | 对应命令 |
|---|---|---|
| `cdp_executor.mjs` | 唯一命令入口，执行所有操作 | 全部命令 |
| `launch_debug_browser.mjs` | 找不到端口时启动独立调试实例 | 连接前 |
| `cdp_endpoint.mjs` | 发现并排序可用调试端口 | ping / 连接阶段 |
| `dom_actions.mjs` | 点击、填表、按键、滚动 | click / fill / press / scroll |
| `page_snapshot.mjs` | 生成精简无障碍树快照 | snapshot |

除 `cdp_executor.mjs` 外均为内部模块，由入口 import，不要单独调用，也不要当死代码删除。

## 命令参考

| 命令 | 作用 |
|---|---|
| `ping` | 检查 CDP 连接 |
| `tabs list` | 列出页面标签及 `tracked`/`owner`/`mine`；只读取，不关闭 |
| `tabs open <url...>` | 固定后台打开或复用标签，可一次传多个 URL；不关闭其他标签。任何前台/激活参数都会报错退出 |
| `extract <url> [--wait ms]` | 提取标题、当前 URL 和最多 200 行页面文本 |
| `eval <url|-> <js-code> | --file <path> | --stdin [--wait ms]` | 执行页面 JavaScript；复杂 JS 用 `--file` 或 `--stdin`，避免 PowerShell 吞引号 |
| `screenshot <url> <output> [--wait ms]` | 保存当前视口的 PNG 截图 |
| `snapshot <url>` | 读取精简的无障碍树，最多 500 个节点 |
| `wait-for <url> <selector> [--timeout ms]` | 等待 selector 对应的可见元素 |
| `click <url> <selector> [--timeout ms]` | 等待并点击唯一、可见、可用的元素 |
| `fill <url> <selector> <value> [--timeout ms]` | 等待并填写文本 input、textarea 或 contenteditable |
| `press <url> <selector> <key> [--timeout ms]` | 聚焦元素并发送按键，支持 `Control+A` 等组合键 |
| `scroll <url> <selector> <direction> [amount] [--timeout ms]` | 滚动最近的可滚动祖先或页面，amount 为 1–10000 |
| `tabs close <pattern> [--all]` | 关闭 URL 匹配的本会话标签；`--all` 含其他会话 |
| `tabs close-id <targetId>` | 关闭明确指定的标签（用户要求关闭用户标签时才用） |
| `tabs close-tracked [--all]` / `cleanup [--all]` | 关闭本会话创建的标签；`--all` 关闭全部追踪标签 |
| `cleanup --keep <id,id,...>` | 关闭其他自有标签并保留指定标签 |

页面命令可附加 `--target <id>` 精确选择现有标签；不提供前台参数（传 `--foreground` 会报错），附加 `--navigate-user-tab` 才会允许用 URL 导航用户标签。若不需要导航，在 URL 位置传 `-`，例如 `click - "button.search" --target TARGET_ID`。不传 `--target` 时，页面命令只复用 URL 相同的自有标签，没有才新建，且不关闭其他标签。`tabs open` 传一个 URL 时返回扁平对象（含 `targetId`），传多个时返回 `{ tabs: [...] }`。

## 标签归属与清理

- 只有脚本自己创建并追踪的标签会被清理，而且**默认只清理本会话 owner 的**；用户已有标签只允许读取列表，或通过 `--target` 使用。`tabs list` 是实时快照，数量变化也可能来自用户自己开关标签；脚本只在显式 `tabs close*` / `cleanup` 时关闭标签。
- **用户标签可能被浏览器冻结或后台挂起**（长时间没激活的标签常见）：命令会先做 2.5 秒探活，失败时返回“标签无响应：可能已冻结或在后台挂起”，**不要试图激活它**（技能没有前台能力）；直接 `tabs open` 新标签重建，或请用户自己点开那个标签，不要在同一个标签上反复重试。
- **`tracked=true` 不等于“本次任务创建的”**：追踪文件会跨会话留存，`tabs list` 里可能挂着别的会话或很早以前的标签。看 `owner`/`mine` 区分；`cleanup` 默认只关 `mine=true` 的，`--all` 才会连历史与别人的一起关。
- `tabs open` 支持 `file://` 本地页面，自测时不需要外网。路径含中文或空格时整体加引号，例如 `"file:///C:/Users/Lenovo/测试 页.html"`；能避免时优先用 ASCII 文件名。
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
