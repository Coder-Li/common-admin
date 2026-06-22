---
title: 发布检查清单
description: 用于准备 Common Admin 变更以供 review 或 release 的公开检查清单。
draft: false
---

在将 Common Admin branch、template update 或 derived-project change 视为就绪之前，请使用此检查清单。

## 范围

确认变更内容：

- backend API behavior；
- Prisma schema 或 migrations；
- generated OpenAPI 或 frontend API artifacts；
- admin UI pages；
- RBAC permissions；
- auth 或 session behavior；
- files、settings、audit logs 或 diagnostics；
- deployment configuration；
- public docs、llms files、MCP、feedback 或 CI。

## Contract Checks

如果 backend contracts 发生变化：

```bash
pnpm api:generate
pnpm api:check
```

检查 generated diffs：

- stable operation ids；
- 预期的 function、hook、query key 和 schema names；
- prefix-free OpenAPI paths；
- 正确的 multipart uploads；
- 正确的 binary downloads；
- 没有意外的 schema weakening。

## Security Checks

确认：

- 没有提交 secrets；
- 没有暴露 `.env` 内容；
- 不使用生成的 docs output 作为源材料；
- permission codes 稳定且对齐；
- sensitive payloads 已从 logs 和 audit records 中脱敏；
- frontend checks 不会替代 backend guards；
- deployment-only configuration 保持在环境变量中。

## Docs And AI Surfaces

当 public docs 或 AI surfaces 发生变化时：

- 更新 sidebar navigation；
- 更新 entry pages；
- 更新 `llms.txt` 和 `llms-full.txt`；
- 当 MCP 应读取该页面时，更新 MCP allowlist 和 tests；
- 让 denied paths 远离 public surfaces。

运行：

```bash
pnpm --filter docs build
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```

## Test Gates

迭代时运行最小的有用检查。在 branch readiness 之前，运行：

```bash
pnpm quality
```

它展开为：

```text
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

如果某个命令无法运行，请记录跳过了哪个命令以及原因。

## Review Notes

有用的 handoff 包括：

- 变更内容；
- 更新了哪些 public docs 或 source files；
- generated artifact changes（如果有）；
- migrations（如果有）；
- 添加或修改的 permission codes；
- verification commands 和结果；
- 已知 risks 或 follow-up work。
