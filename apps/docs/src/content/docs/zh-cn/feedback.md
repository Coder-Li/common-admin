---
title: 反馈
description: 用户和 AI 智能体如何为 Common Admin 发送有用反馈。
draft: false
---

Common Admin 预期通过真实使用持续改进。

使用反馈来报告设置阻碍、缺失文档、智能体工作流缺口、MCP 工具设计问题、starter-template bug，以及不清晰的实现模式。

## 人类反馈

打开 issue 时，请包含：

- 你尝试构建什么。
- 哪个命令、页面或文档令人困惑。
- 智能体或开发者预期什么。
- 实际发生了什么。
- 任何错误输出或损坏的生成代码。
- 当相关时提供你的环境：操作系统、Node.js 版本、pnpm 版本、数据库/Redis 设置，以及 commit 或 release。
- 你是直接使用 Common Admin，还是使用从它派生的项目。

不要包含 secrets、tokens、生产密码、私有客户数据、refresh tokens、`.env` 文件内容或完整数据库 dumps。

## 智能体反馈

AI 智能体反馈应足够结构化，以便维护者复现工作流缺口。包含：

- 任务类型：`new_resource`、`api_contract_change`、`bootstrap`、`rbac`、`docs`、`mcp` 或 `other`。
- 智能体阅读过的公开文档。
- 使用的 prompt（如果有）。
- 智能体已修改或打算修改的文件。
- 智能体运行过的验证命令。
- 验证状态：`not_run`、`passed`、`failed` 或 `partial`。
- 预期工作流。
- 实际工作流或阻塞原因。
- 请求维护者采取的行动。

## Issue 分类

使用最接近的 issue template：

- Bug report：运行时 bug、设置失败、损坏命令或失败示例。
- Docs feedback：缺失、过时、令人困惑或相互矛盾的文档。
- AI agent feedback：prompts、agent workflows、reading order 或 stop conditions。
- Feature request：starter-template 能力请求。
- MCP feedback：MCP tools、schema、boundary 或 exposure concerns。

推荐 issue labels：

- `docs`
- `ai`
- `mcp`
- `starter`
- `bug`
- `feature`
- `feedback`
- `needs-triage`
- `api-contract`
- `permissions`
- `generated-api`
- `quality-gate`
- `question`

## MCP 反馈形态

MCP server 暴露 `submit_feedback` tool，它会将结构化输入转换为 GitHub issue draft。

建议输入：

```json
{
  "source": "human",
  "category": "docs",
  "title": "Getting Started does not mention Redis startup",
  "summary": "Local setup failed until Redis was started manually.",
  "taskType": "bootstrap",
  "expected": "The setup guide lists all required local services.",
  "actual": "The API failed when Redis was unavailable.",
  "stepsToReproduce": [
    "Install dependencies",
    "Start Postgres only",
    "Run pnpm dev"
  ],
  "docsOrFiles": [
    "/getting-started/"
  ],
  "commandsRun": [
    "pnpm dev"
  ],
  "errorOutput": "Connection refused for Redis",
  "environment": {
    "os": "macOS",
    "node": "unknown",
    "pnpm": "unknown",
    "commit": "unknown"
  },
  "agentContext": {
    "agentName": "",
    "docsRead": [],
    "verificationStatus": "failed",
    "blockedReason": ""
  }
}
```

该 tool 返回一个 issue draft，其中包含 title、body、labels、source 和 `needsMaintainerReview: true`。维护者应在打开 issue 前审查该 draft。
