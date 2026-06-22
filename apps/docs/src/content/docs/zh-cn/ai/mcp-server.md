---
title: MCP 服务器
description: 面向处理 Common Admin 的 AI agent 的本地 MCP 接口。
draft: false
---

Common Admin MCP 服务器向 agent 暴露文档和项目协议，而不强迫它们抓取渲染后的站点。

版本 1 有意保持小范围。它读取 allowlist 中的公开文档，返回稳定的公开任务提示词，并根据结构化反馈准备 issue 草稿。它不会修改仓库源码、运行迁移、执行任意 package 脚本、自动创建 GitHub issues，或暴露内部文件。

## 本地运行

从仓库根目录运行：

```bash
pnpm --silent mcp:stdio
```

等价的 package 命令：

```bash
pnpm --silent --filter @common-admin/mcp-server stdio
```

MCP client 配置示例：

```json
{
  "mcpServers": {
    "common-admin": {
      "command": "pnpm",
      "args": ["--silent", "mcp:stdio"],
      "cwd": "/absolute/path/to/common-admin"
    }
  }
}
```

当前本地 server 暴露：

- `submit_feedback`：为维护者准备结构化反馈。
- `list_common_admin_docs`：列出可通过 MCP server 访问的公开文档。
- `read_common_admin_doc`：按 slug 读取 allowlist 中的公开文档。
- `list_common_admin_patterns`：列出可用的实现模式。
- `get_common_admin_prompt`：返回稳定的公开任务提示词。

## V1 工具边界

允许的 v1 行为：

- 列出并读取公开 Markdown 文档。
- 返回带来源归属的内容。
- 从公开文档返回稳定的任务提示词。
- 列出公开模式指南。
- 根据公开反馈形状验证反馈输入。
- 生成 GitHub issue 草稿的标题、正文和标签，供维护者审阅。

禁止的 v1 行为：

- 自动创建 GitHub issues。
- 读取或返回环境文件。
- 从 `.git/**` 读取或返回仓库元数据。
- 从 `node_modules/**` 读取或返回依赖。
- 读取或返回生成的文档构建输出。
- 读取、总结或暴露内部流程文档。
- 执行迁移、package 脚本、测试或任意 shell 命令。
- 修改项目文件。

## 设计规则

- 读取 Markdown 源文件，而不是渲染后的 HTML。
- 只暴露来自 docs app 和公开 AI 文本文件的 allowlist 公开文档。
- 不要暴露内部流程备注、本地环境文件、仓库元数据、依赖目录或生成的文档输出。
- 返回简洁且带来源归属的结果。
- 让提示词随文档一起版本化。

## 允许列表

MCP 服务器可以读取：

```text
apps/docs/src/content/docs/introduction.md
apps/docs/src/content/docs/getting-started.md
apps/docs/src/content/docs/architecture.md
apps/docs/src/content/docs/faq.md
apps/docs/src/content/docs/deployment.md
apps/docs/src/content/docs/upgrade-guide.md
apps/docs/src/content/docs/release-checklist.md
apps/docs/src/content/docs/auth-and-sessions.md
apps/docs/src/content/docs/session-management.md
apps/docs/src/content/docs/errors-and-logging.md
apps/docs/src/content/docs/diagnostics-and-health.md
apps/docs/src/content/docs/audit-logs.md
apps/docs/src/content/docs/settings.md
apps/docs/src/content/docs/file-management.md
apps/docs/src/content/docs/quality-gates.md
apps/docs/src/content/docs/troubleshooting.md
apps/docs/src/content/docs/resource-workflow.md
apps/docs/src/content/docs/public-ai-surfaces.md
apps/docs/src/content/docs/users-roles-permissions.md
apps/docs/src/content/docs/organization-structure.md
apps/docs/src/content/docs/data-permissions.md
apps/docs/src/content/docs/dictionaries.md
apps/docs/src/content/docs/ai/index.md
apps/docs/src/content/docs/ai/mcp-server.md
apps/docs/src/content/docs/ai/skill.md
apps/docs/src/content/docs/ai/prompts.md
apps/docs/src/content/docs/feedback.md
apps/docs/src/content/docs/patterns/api-contract.md
apps/docs/src/content/docs/patterns/crud-resource.md
apps/docs/src/content/docs/patterns/rbac.md
apps/docs/public/llms.txt
apps/docs/public/llms-full.txt
```

## 拒绝列表

MCP 服务器绝不能读取或暴露：

```text
docs/superpowers/**
docs/next-step.md
.env*
.git/**
node_modules/**
apps/docs/dist/**
apps/docs/.astro/**
```

不要仅仅因为路径存在于仓库中，就把它加入 allowlist。它应该稳定、公开，并且适合开发者和 AI agent 使用。

## 文档工具

使用 `list_common_admin_docs` 发现可用 slug。当前 slug 包括：

```text
introduction
getting-started
architecture
faq
deployment
upgrade-guide
release-checklist
auth-and-sessions
session-management
errors-and-logging
diagnostics-and-health
audit-logs
settings
file-management
quality-gates
troubleshooting
resource-workflow
public-ai-surfaces
users-roles-permissions
organization-structure
data-permissions
dictionaries
ai
ai/mcp-server
ai/skill
ai/prompts
feedback
patterns/api-contract
patterns/crud-resource
patterns/rbac
llms
llms-full
```

使用 `read_common_admin_doc` 并传入其中一个 slug：

```json
{
  "slug": "patterns/api-contract"
}
```

结果包含 slug、title、source path、kind 和文档内容。未知 slug 会被拒绝，而不是被解析为文件系统路径。

当 agent 需要实现模式菜单以选择特定任务指南时，使用 `list_common_admin_patterns`。

## 提示词工具

使用 `get_common_admin_prompt` 并传入以下 prompt id 之一：

```text
new_admin_resource
change_api_contract
bootstrap_project
update_docs_ai_surfaces
```

结果包含 prompt id、title、必读公开文档和 prompt text。未知 prompt id 会被拒绝。

## `submit_feedback`

`submit_feedback` 只生成草稿。它接收来自 [/feedback/](../feedback/) 的公开反馈形状，并返回：

- `title`
- `body`
- `labels`
- `source`
- `needsMaintainerReview: true`

草稿正文应包含：

- 用户尝试构建什么。
- 哪个命令、页面或文档令人困惑。
- agent 或开发者期望发生什么。
- 实际发生了什么。
- 任何错误输出或损坏的生成代码。
- 可用时的相关环境细节。

建议标签应遵循公开反馈分类：

- `docs`
- `ai`
- `mcp`
- `starter`
- `bug`
- `feature`
- `feedback`
- `needs-triage`

人工维护者应手动审阅并提交 issue。

## 首个配置形状

第一个 MCP 版本可以仅本地使用。等公开使用模式更清晰后，再实现后续远程服务器。
