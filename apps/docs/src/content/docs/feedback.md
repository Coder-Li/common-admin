---
title: Feedback
description: How users and AI agents can send useful feedback for Common Admin.
draft: false
---

Common Admin is expected to improve through real usage.

Use feedback to report setup friction, missing docs, agent workflow gaps, MCP
tool design issues, starter-template bugs, and unclear implementation patterns.

## Human Feedback

When opening an issue, include:

- What you tried to build.
- Which command, page, or document was confusing.
- What the agent or developer expected.
- What actually happened.
- Any error output or broken generated code.
- Your environment when it matters: operating system, Node.js version, pnpm
  version, database/Redis setup, and commit or release.
- Whether you are using Common Admin directly or a project derived from it.

Do not include secrets, tokens, production passwords, private customer data,
refresh tokens, `.env` file contents, or full database dumps.

## Agent Feedback

AI-agent feedback should be structured enough for maintainers to reproduce the
workflow gap. Include:

- Task type: `new_resource`, `api_contract_change`, `bootstrap`, `rbac`, `docs`,
  `mcp`, or `other`.
- Public docs the agent read.
- Prompt used, if any.
- Files the agent changed or intended to change.
- Verification commands the agent ran.
- Verification status: `not_run`, `passed`, `failed`, or `partial`.
- Expected workflow.
- Actual workflow or blocked reason.
- Maintainer action requested.

## Issue Categories

Use the closest issue template:

- Bug report: runtime bugs, failed setup, broken commands, or failing examples.
- Docs feedback: missing, outdated, confusing, or contradictory docs.
- AI agent feedback: prompts, agent workflows, reading order, or stop conditions.
- Feature request: starter-template capability requests.
- MCP feedback: MCP tools, schema, boundary, or exposure concerns.

Recommended issue labels:

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

## MCP Feedback Shape

The MCP server exposes a `submit_feedback` tool that turns structured input into
a GitHub issue draft.

Suggested input:

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

The tool returns an issue draft with title, body, labels, source, and
`needsMaintainerReview: true`. A maintainer should review the draft before
opening the issue.
