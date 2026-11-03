# cdp-browser

使用 Chrome DevTools Protocol (CDP) 连接已经在运行的 Chrome、Edge 或 Chromium 浏览器，做页面文本提取、JavaScript 执行、无障碍快照、截图和标签管理。适合需要复用用户已登录浏览器、又不想重开一套配置的场景。

技能的全部内容（环境要求、首次连接与授权规则、命令参考、标签安全规则、示例、测试）都在 [SKILL.md](SKILL.md) 里，使用本技能请以 SKILL.md 为准，本文档只给最短上手路径。

## 快速开始

```powershell
# 没有可用调试端口时，先起独立实例（接管用户浏览器需先征得同意）
node scripts/launch_debug_browser.mjs

# 连上后先验证，ping 不通不要声称已连上
node scripts/cdp_executor.mjs ping
node scripts/cdp_executor.mjs tabs list

# 后台开标签，后续命令都用 --target 指向它
node scripts/cdp_executor.mjs tabs open "https://example.org"
node scripts/cdp_executor.mjs extract - --target <targetId>

# 收尾只关自己开的标签
node scripts/cdp_executor.mjs cleanup --keep <targetId>
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `ping` | 探测调试端口，返回 `port` / `portSource` |
| `tabs list` / `tabs open <url...>` | 列标签 / 后台开标签（可一次多个） |
| `extract <url\|->` | 标题、当前 URL 和页面文本行 |
| `eval <url\|-> --file <js>` | 执行页面 JS；复杂脚本走 `--file` 或 `--stdin` |
| `snapshot` / `screenshot` | 无障碍树 / 视口截图 |
| `click`、`fill`、`press`、`scroll` | 页面交互 |
| `tabs close-id <id>`、`cleanup` | 精确关标签 / 关闭追踪标签 |

## 两条最容易踩的规则

- **标签一律后台打开**：`tabs open` 收到 `--foreground` 直接报错退出；`--foreground` 只用于把已冻结的标签激活一次，激活无效就新建标签，不要反复重试。
- **收尾只关自己开的**：优先 `tabs close-id`。`cleanup` 会关闭追踪文件里的全部标签，而 `tabs list` 中 `tracked=true` 可能包含历史会话遗留的标签。

## 测试

```powershell
node --test
```

Windows PowerShell 下不要写成 `node --test tests/*.test.mjs`，通配符不会被展开。
