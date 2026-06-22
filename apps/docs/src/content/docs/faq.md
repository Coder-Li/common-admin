---
title: FAQ
description: Common questions about Common Admin development, generated APIs, RBAC, deployment, and AI usage.
draft: false
---

## Is Common Admin a demo scaffold?

No. It is intended as a production admin starter. The template keeps
authentication, refresh-token sessions, RBAC, generated API clients, Prisma
persistence, migrations, tests, docs, and quality gates in place.

## Should I edit generated API files?

No. Do not hand edit:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

Fix backend DTOs, Swagger metadata, OpenAPI generation, or Orval configuration,
then run:

```bash
pnpm api:generate
pnpm api:check
```

## Why does the frontend use generated API helpers?

Generated helpers keep frontend code aligned with the backend contract. Use
generated endpoint functions, hooks, schema types, and query key helpers instead
of handwritten clients.

Feature-local wrappers are acceptable only when they add real page-level
composition, such as browser file-save behavior around a generated download.

## Should permissions check role names?

No. Admin capabilities use stable lowercase `module.action` permission codes.

Examples:

```text
user.read
role.assign_permissions
file.download
setting.update
```

Keep backend guards, registry entries, seed behavior, route metadata, menu
visibility, and page actions aligned.

## Why did a menu item disappear?

Menu visibility comes from route metadata and the current user's permissions.
Check:

- route `requiredPermissions`;
- the user's assigned roles;
- seeded permission defaults;
- backend registry entries;
- frontend permission state.

Do not add a menu-only permission system.

## Why am I seeing repeated 401 responses?

Check auth lifecycle boundaries:

- login returned an access token;
- the refresh cookie was set;
- browser requests include credentials;
- refresh cookie security and same-site settings match the deployment;
- refresh succeeds and rotates the token;
- the user has the required permission.

See [Auth And Sessions](./auth-and-sessions/) and [Troubleshooting](./troubleshooting/).

## How do I add a new admin module?

Start with [Resource Workflow](./resource-workflow/), then read:

- [CRUD Resource](./patterns/crud-resource/)
- [API Contract](./patterns/api-contract/)
- [RBAC](./patterns/rbac/)

Implement backend contract first, regenerate API artifacts, build the frontend
with generated helpers, and run the relevant gates.

## What is the difference between runtime settings and environment variables?

Runtime settings are product values that admins can safely edit from the admin
UI.

Environment variables are deployment configuration: secrets, database URLs,
Redis URLs, cookie security, allowed origins, logging, storage roots, and policy
ceilings.

Do not move secrets into runtime settings.

## What is the difference between runtime logs and audit logs?

Runtime logs help operators debug service behavior. Audit logs are database
records for accountability around sensitive admin actions.

Both must avoid secrets.

## Can AI agents read all repository files?

No. Public AI surfaces should use stable public docs and source files relevant
to the task. They must not expose internal process notes, environment files,
repository metadata, dependency folders, or generated docs output.

See [Public AI Surfaces](./public-ai-surfaces/).

## What should I run before a branch is ready?

For implementation branches:

```bash
pnpm quality
```

For docs-only changes:

```bash
pnpm --filter docs build
```

For MCP or public AI surface changes:

```bash
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```
