---
title: 公开 AI 表面
description: 公开文档、llms 文件、MCP 工具、提示词、skills、反馈和 CI 检查。
draft: false
---

Common Admin 为人类和 AI agent 暴露多个公开表面。每当文档化的架构或工作流发生变化时，都要保持它们一致。

## 表面

公开文档：

```text
apps/docs/src/content/docs/
```

AI 索引文件：

```text
apps/docs/public/llms.txt
apps/docs/public/llms-full.txt
```

MCP 服务器：

```text
packages/mcp-server/
```

反馈草稿 package：

```text
packages/feedback-draft/
```

Issue templates 和 CI：

```text
.github/ISSUE_TEMPLATE/
.github/workflows/public-ai-surfaces.yml
```

## 更新规则

添加公开文档页面时：

1. 在 docs content directory 下添加 Markdown 页面。
2. 如果人类应能导航到它，则把它添加到 Starlight sidebar。
3. 从相关入口页面链接到它。
4. 当 agent 应看到它时，更新 `llms.txt` 和 `llms-full.txt`。
5. 如果 MCP clients 应读取它，将它添加到 MCP docs allowlist。
6. 当 allowlist 行为变化时，更新 MCP tests。

不要将内部流程备注、环境文件、仓库元数据、依赖目录或生成的构建输出添加到任何公开 AI 表面。

## MCP 边界

MCP 服务器读取 allowlist 中的公开 Markdown 和公开 AI 文本文件。它应该拒绝未知 slug，而不是解析文件系统路径。

MCP 服务器不应该：

- 执行 package scripts；
- 运行 migrations；
- 修改 source files；
- 读取 generated docs output；
- 读取 environment files；
- 读取 dependencies；
- 读取 repository metadata；
- 暴露 internal process docs。

## CI 门禁

public AI surfaces workflow 检查：

```bash
pnpm --filter docs build
pnpm --filter @common-admin/feedback-draft test
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```

这是一个轻量的 public-surface gate。它不能替代实现分支的 `pnpm quality`。

## 验证

对于仅文档变更：

```bash
pnpm --filter docs build
```

对于 MCP、prompt、feedback 或 allowlist 变更：

```bash
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```

对于分支就绪状态：

```bash
pnpm quality
```
