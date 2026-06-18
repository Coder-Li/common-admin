---
title: Architecture
description: The core architecture and source-of-truth boundaries in Common Admin.
draft: false
---

Common Admin keeps backend contracts as the source of truth.

```text
Prisma schema
  -> NestJS service / mapper / DTO / controller metadata
  -> apps/api/openapi.json
  -> Orval
  -> apps/admin/src/generated/api/
  -> React Query hooks / endpoint functions / schema types
  -> Admin feature pages
```

## Main Applications

- `apps/api`: NestJS API, Prisma, authentication, RBAC, OpenAPI generation.
- `apps/admin`: Vite React admin app, route metadata, generated API usage.
- `apps/docs`: public documentation for humans and AI agents.

## Source Of Truth

Use these files and directories when judging whether a change matches the starter architecture:

```text
apps/api/prisma/schema.prisma
apps/api/src/openapi.ts
apps/api/scripts/generate-openapi.ts
apps/admin/orval.config.ts
apps/admin/src/app/api-mutator.ts
apps/admin/src/app/api-refresh-coordinator.ts
apps/admin/src/routes/admin-route-registry.tsx
apps/admin/src/routes/route-meta.ts
apps/api/src/permission/permission.registry.ts
apps/api/prisma/seed.ts
apps/docs/src/content/docs/
```

Pattern docs are public summaries of stable workflows:

```text
apps/docs/src/content/docs/patterns/api-contract.md
apps/docs/src/content/docs/patterns/crud-resource.md
apps/docs/src/content/docs/patterns/rbac.md
```

Operational topic docs expand cross-cutting behavior:

```text
apps/docs/src/content/docs/deployment.md
apps/docs/src/content/docs/upgrade-guide.md
apps/docs/src/content/docs/release-checklist.md
apps/docs/src/content/docs/faq.md
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
```

## Important Rules

- Do not hand edit `apps/api/openapi.json`.
- Do not hand edit `apps/admin/src/generated/api/`.
- Backend DTOs and Swagger metadata are the API contract source.
- Frontend features should use generated endpoint functions, hooks, schema types, and query key helpers.
- Permission codes should align across backend guards, frontend routes, menus, and page actions.

Generated artifacts are committed so reviewers can see contract drift. They are still read-only implementation outputs. If generated names, schemas, paths, or hooks look wrong, fix the backend DTOs, Swagger metadata, OpenAPI generation helper, or Orval config, then regenerate.

Generated artifacts:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

## Permission Flow

```text
permission registry
  -> permission seed
  -> backend @Permissions() guard
  -> frontend route/menu metadata
  -> frontend page action gates
```

Use stable `module.action` permission codes such as `user.read`, `role.update`, or `file.delete`.

See [Users Roles And Permissions](/users-roles-permissions/) and [RBAC](/patterns/rbac/).

## Organization And Data Scope

Departments and positions provide organization structure for user assignment and future business modules. Data permissions apply department-scoped visibility rules after RBAC answers whether an action is allowed.

See [Organization Structure](/organization-structure/) and [Data Permissions](/data-permissions/).

## Dictionaries

Dictionaries provide admin-managed option lists for product features. Management endpoints are permission-protected, while option endpoints provide safe generated API access for forms and filters.

See [Dictionaries](/dictionaries/).

## Auth And Sessions

The admin app uses access tokens for API requests and refresh-token session behavior for continuity. The API auth module, refresh cookie settings, frontend API mutator, and refresh coordinator are one lifecycle. Changes to login, refresh, logout, password changes, 401 replay, cookies, or token cleanup should be tested as session behavior, not isolated one-line edits.

See [Auth And Sessions](/auth-and-sessions/).

## Session Management

Admin session management lists user sessions and revokes active sessions through guarded endpoints. It is separate from login/refresh behavior and should audit revocation actions.

See [Session Management](/session-management/).

## Errors And Logging

API errors should flow through the common exception mapping and filter layer. Validation, guard, and application errors should return consistent error envelopes with request IDs. Runtime logs are structured stdout/stderr logs for operators and diagnostics; they are separate from audit logs.

When adding new secret-like fields, make sure logging redaction still protects them.

See [Errors And Logging](/errors-and-logging/).

## Diagnostics And Health

Health checks verify runtime reachability. Diagnostic endpoints are gated by deployment configuration and exist for validating the global error and logging pipeline.

See [Diagnostics And Health](/diagnostics-and-health/).

## Audit Logs

Audit logs are database records for sensitive administrative operations. They answer who changed what, not whether the server was healthy. Audit payloads should be sanitized so passwords, tokens, secrets, and private metadata are not stored.

See [Audit Logs](/audit-logs/).

## Settings

Runtime-editable product settings belong behind the settings module. Deployment-only configuration remains in environment variables. Do not move secrets into runtime settings just to make them editable from the admin UI.

See [Settings](/settings/).

## Files

File management uses permission-protected upload, download, update, and delete endpoints with multipart Swagger metadata and generated frontend API helpers. Upload policy is runtime-editable only within deployment-defined limits.

See [File Management](/file-management/).

## Deployment

Docker Compose is the production-like local deployment shape. Keep deployment secrets in local environment files, use migration-only commands for upgrades, and avoid exposing Postgres, Redis, or API internals unless your deployment deliberately requires it.

See [Deployment](/deployment/).

## Upgrade And Release

Upgrades should account for migrations, generated API drift, permissions, deployment configuration, and rollback planning. Release readiness should include contract, security, docs, AI surface, and quality checks.

See [Upgrade Guide](/upgrade-guide/) and [Release Checklist](/release-checklist/).

## Quality Gates

The root readiness gate is:

```bash
pnpm quality
```

It expands to:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

Run narrower commands while iterating, but use the broader gate before treating a feature branch as ready.

See [Quality Gates](/quality-gates/).

## Resource Workflow

New API-backed admin modules should follow the backend-first contract flow, regenerate generated API artifacts, use generated frontend helpers, align RBAC, and add focused tests.

See [Resource Workflow](/resource-workflow/).

## Public AI Surfaces

Public docs, llms files, MCP tools, feedback helpers, issue templates, and CI checks are maintained together. Keep them stable and avoid exposing internal files or generated output.

See [Public AI Surfaces](/public-ai-surfaces/).

## Troubleshooting

When setup, auth, generated API drift, migrations, permissions, uploads, or docs builds fail, start with the narrow troubleshooting checks before changing architecture.

See [Troubleshooting](/troubleshooting/).

## FAQ

Use FAQ for short answers about generated APIs, RBAC, settings, logs, AI access, and readiness commands.

See [FAQ](/faq/).
