---
name: cdp-browser
description: "通过 Chrome DevTools Protocol (CDP) 连接已运行的浏览器，进行页面自动化、数据提取和标签管理。当用户要求连接调试端口、读取网页、执行页面脚本、截图或管理标签时使用。"
official: false
version: 1.2.0
---

# CDP 浏览器自动化

通过 Node.js 脚本连接已运行的 Chrome、Edge 或 Chromium 浏览器。环境准备、Chrome 136+ 的启动要求、标签安全边界和命令说明见同目录 [README.md](README.md)。

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
node scripts/cdp_executor.mjs tabs list
node scripts/cdp_executor.mjs tabs open <url> [--background]
node scripts/cdp_executor.mjs cleanup [--keep <id,id,...>]
```

## 标签安全规则

- 默认只操作脚本自己创建并追踪的标签。对其他标签只允许读取列表；关闭用户已有标签必须由用户明确指定标签 ID。
- 打开页面时优先复用 URL 完全相同的自有标签；关闭其余自有标签。没有可复用标签时才创建。
- 任务结束后，若需把标签留给用户查看，调用 `cleanup --keep <targetId,...>` 保留目标标签并关闭其余自有标签。
