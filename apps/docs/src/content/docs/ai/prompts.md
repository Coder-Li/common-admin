---
title: Prompts
description: Task-oriented prompts for humans asking AI agents to work on Common Admin.
draft: false
---

Use task prompts when asking an AI agent to modify Common Admin.

## Add An Admin Resource

### When To Use

Use this when adding a new API-backed admin module with persistence, list/detail behavior, forms, route/menu entries, permissions, and tests.

### Required Docs

- [Architecture](/architecture/)
- [CRUD Resource](/patterns/crud-resource/)
- [API Contract](/patterns/api-contract/)
- [RBAC](/patterns/rbac/)
- [AI Guide](/ai/)

### Prompt

```text
Add a new API-backed admin resource to Common Admin.

Before editing, read the public docs for architecture, API contract generation,
CRUD resources, and RBAC permissions. Follow existing module patterns. Use
backend DTOs and Swagger metadata as the API contract source, regenerate the
frontend API, and use generated helpers in the admin app. Add focused tests and
run the relevant quality gates.
```

### Expected Verification

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

Also run `pnpm --filter api test:e2e` when the resource touches auth, permissions, request flow, or e2e-covered routes.

## Change An API Contract

### When To Use

Use this when changing an existing endpoint, DTO, operation id, request query, response shape, generated frontend function, or generated schema type.

### Required Docs

- [Architecture](/architecture/)
- [API Contract](/patterns/api-contract/)
- [AI Guide](/ai/)
- The affected feature code and generated API usages.

### Prompt

```text
Change an existing API contract in Common Admin.

Update backend DTOs, validation, mappers, controller metadata, and tests first.
Regenerate OpenAPI and frontend API artifacts. Do not hand edit generated files.
Update frontend usages through generated types and functions. Run the API drift
check before finishing.
```

### Expected Verification

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

Also run `pnpm --filter api test:e2e` when the contract change affects auth, permissions, global request behavior, or e2e-covered endpoints.

## Bootstrap A New Project

### When To Use

Use this when deriving a product from Common Admin and renaming or configuring the starter without changing its core architecture.

### Required Docs

- [Introduction](/introduction/)
- [Getting Started](/getting-started/)
- [Architecture](/architecture/)
- [AI Guide](/ai/)

### Prompt

```text
Bootstrap a product from Common Admin.

Keep authentication, RBAC, generated API flow, and quality gates intact unless
the human maintainer explicitly changes the architecture. Rename product-facing
labels and environment values, then add business modules through the documented
CRUD and permission patterns.
```

### Expected Verification

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

Use `pnpm quality` for branch-level readiness.

## Update Docs / AI Entry Surfaces

### When To Use

Use this when changing public documentation, `llms.txt`, `llms-full.txt`, planned MCP docs, installable skill docs, or task prompts.

### Required Docs

- [Introduction](/introduction/)
- [Architecture](/architecture/)
- [AI Guide](/ai/)
- [MCP Server](/ai/mcp-server/)
- [Skill](/ai/skill/)
- [Feedback](/feedback/)

### Prompt

```text
Update the Common Admin public docs or AI entry surfaces.

Keep public docs focused on stable architecture, workflows, and agent guidance.
Do not expose internal process materials, environment files, repository metadata,
dependencies, or generated build output. Treat docs/superpowers/** and
docs/next-step.md as denied sources for public docs, llms files, MCP tools, and
installable skills. When summarizing patterns, write stable summaries rather
than copying internal plans or specs.
```

### Expected Verification

```bash
pnpm --filter docs build
```

Run broader repository checks only when documentation changes also modify code, scripts, generated artifacts, or package configuration.
