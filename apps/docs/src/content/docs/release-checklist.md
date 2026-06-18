---
title: Release Checklist
description: Public checklist for preparing Common Admin changes for review or release.
draft: false
---

Use this checklist before treating a Common Admin branch, template update, or
derived-project change as ready.

## Scope

Confirm what changed:

- backend API behavior;
- Prisma schema or migrations;
- generated OpenAPI or frontend API artifacts;
- admin UI pages;
- RBAC permissions;
- auth or session behavior;
- files, settings, audit logs, or diagnostics;
- deployment configuration;
- public docs, llms files, MCP, feedback, or CI.

## Contract Checks

If backend contracts changed:

```bash
pnpm api:generate
pnpm api:check
```

Review generated diffs for:

- stable operation ids;
- expected function, hook, query key, and schema names;
- prefix-free OpenAPI paths;
- correct multipart uploads;
- correct binary downloads;
- no accidental schema weakening.

## Security Checks

Confirm:

- no secrets are committed;
- no `.env` contents are exposed;
- generated docs output is not used as source material;
- permission codes are stable and aligned;
- sensitive payloads are redacted from logs and audit records;
- frontend checks do not replace backend guards;
- deployment-only configuration remains in environment variables.

## Docs And AI Surfaces

When public docs or AI surfaces change:

- update sidebar navigation;
- update entry pages;
- update `llms.txt` and `llms-full.txt`;
- update MCP allowlist and tests when MCP should read the page;
- keep denied paths out of public surfaces.

Run:

```bash
pnpm --filter docs build
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```

## Test Gates

Run the narrowest useful checks while iterating. Before branch readiness, run:

```bash
pnpm quality
```

It expands to:

```text
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

If a command cannot run, document which command was skipped and why.

## Review Notes

A useful handoff includes:

- what changed;
- which public docs or source files were updated;
- generated artifact changes, if any;
- migrations, if any;
- permission codes added or changed;
- verification commands and results;
- known risks or follow-up work.
