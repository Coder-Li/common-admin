---
title: Quality Gates
description: API generation, drift checks, linting, tests, e2e coverage, builds, and branch readiness.
draft: false
---

Common Admin expects changes to pass focused checks while iterating and broader
gates before a branch is considered ready.

## Main Commands

Generate API artifacts:

```bash
pnpm api:generate
```

Check generated API drift:

```bash
pnpm api:check
```

Lint packages:

```bash
pnpm lint
```

Run unit and component tests:

```bash
pnpm test
```

Run API e2e tests:

```bash
pnpm --filter api test:e2e
```

Build the workspace:

```bash
pnpm build
```

Branch readiness:

```bash
pnpm quality
```

Docs-only verification:

```bash
pnpm --filter docs build
```

## API Generation Gate

`pnpm api:generate` runs:

```text
pnpm --filter api db:generate
pnpm --filter api openapi:generate
pnpm --filter admin api:generate
```

`pnpm api:check` runs generation and then fails if generated artifacts are
different from the committed files:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

Do not fix API drift by hand editing generated files. Fix backend DTOs, Swagger
metadata, OpenAPI generation, or Orval configuration, then regenerate.

## Narrow Checks While Iterating

Use the smallest useful command while finding or fixing a problem:

```bash
pnpm --filter api test -- auth
pnpm --filter api test -- settings
pnpm --filter admin test -- FilesPage
pnpm --filter docs build
```

Then return to the broader gate that matches the blast radius.

## When To Run E2E

Run API e2e tests when a change touches:

- authentication or sessions;
- guards, permissions, or request identity;
- global validation, errors, logging, or request IDs;
- generated API paths used by e2e-covered endpoints;
- behavior that only appears through the real HTTP pipeline.

## Branch Readiness

Use `pnpm quality` before treating an implementation branch as ready. It expands
to:

```text
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

If a check cannot run, the final handoff should say which command was skipped
and why.

## Docs And AI Surfaces

For docs-only changes, run:

```bash
pnpm --filter docs build
```

If the docs change also updates MCP allowlists, MCP tools, package code, or
prompt behavior, also run:

```bash
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```
