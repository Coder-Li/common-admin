---
title: 质量门禁
description: API 生成、drift checks、linting、tests、e2e coverage、builds 和 branch readiness。
draft: false
---

Common Admin 期望变更在迭代时通过聚焦检查，并在 branch 被视为就绪前通过更广的 gates。

## 主要命令

生成 API artifacts：

```bash
pnpm api:generate
```

检查生成的 API drift：

```bash
pnpm api:check
```

Lint packages：

```bash
pnpm lint
```

运行 unit 和 component tests：

```bash
pnpm test
```

运行 API e2e tests：

```bash
pnpm --filter api test:e2e
```

构建 workspace：

```bash
pnpm build
```

Branch readiness：

```bash
pnpm quality
```

Docs-only verification：

```bash
pnpm --filter docs build
```

## API Generation Gate

`pnpm api:generate` 运行：

```text
pnpm --filter api db:generate
pnpm --filter api openapi:generate
pnpm --filter admin api:generate
```

`pnpm api:check` 会运行生成，然后在生成 artifacts 与已提交文件不同时失败：

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

不要通过手动编辑生成文件来修复 API drift。请修复后端 DTOs、Swagger metadata、OpenAPI generation 或 Orval configuration，然后重新生成。

## 迭代时的窄范围检查

在查找或修复问题时使用最小的有用命令：

```bash
pnpm --filter api test -- auth
pnpm --filter api test -- settings
pnpm --filter admin test -- FilesPage
pnpm --filter docs build
```

然后回到与影响范围匹配的更广 gate。

## 何时运行 E2E

当变更触及以下内容时，运行 API e2e tests：

- authentication 或 sessions；
- guards、permissions 或 request identity；
- global validation、errors、logging 或 request IDs；
- e2e-covered endpoints 使用的 generated API paths；
- 只有通过真实 HTTP pipeline 才会出现的行为。

## Branch Readiness

在认为 implementation branch 已就绪之前使用 `pnpm quality`。它展开为：

```text
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

如果某个检查无法运行，最终 handoff 应说明跳过了哪个命令以及原因。

## Docs And AI Surfaces

对于 docs-only changes，运行：

```bash
pnpm --filter docs build
```

如果 docs change 还更新 MCP allowlists、MCP tools、package code 或 prompt behavior，也运行：

```bash
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```
