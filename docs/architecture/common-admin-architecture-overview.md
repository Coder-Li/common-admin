# Common Admin Architecture Overview

This document gives human maintainers a high-level map of Common Admin. It is
not the step-by-step implementation guide for every module. Use it to understand
the system boundaries, source-of-truth files, generated artifacts, and extension
points before asking an AI agent or developer to add features.

For task execution details, prefer the focused guides under `docs/patterns/` and
the AI working protocols under `docs/ai/`.

## System Shape

Common Admin is a pnpm workspace with two main applications:

```text
apps/
  api/      NestJS API, Prisma, auth, RBAC, OpenAPI generation
  admin/    Vite React admin app, routes, generated API usage, UI features
```

Supporting areas:

```text
docs/
  architecture/  Human-facing architecture maps
  ai/            AI-first working protocols and task checklists
  development/   Day-to-day development entry points
  patterns/      Repeatable implementation patterns
  superpowers/   Historical design specs and implementation plans
deploy/          Deployment and observability assets
```

The template currently includes authentication, refresh-token session handling,
RBAC permissions, users, roles, dictionaries, files, audit logs, system settings,
error responses, structured request logging, OpenAPI generation, and quality
gates.

## Contract Flow

The API contract starts in the backend. Frontend API code is generated from it.

```text
Prisma schema
  -> NestJS service / mapper / DTO / controller metadata
  -> apps/api/openapi.json
  -> Orval
  -> apps/admin/src/generated/api/
  -> React Query hooks / endpoint functions / schema types
  -> Admin feature pages
```

Important rules:

- Backend DTOs and Swagger metadata are the API contract source.
- `apps/api/openapi.json` is generated and committed, but not hand edited.
- `apps/admin/src/generated/api/` is generated and committed, but not hand
  edited.
- Runtime API routes use the `/api` prefix; generated OpenAPI paths must stay
  prefix-free.
- Frontend features should use generated endpoint functions, hooks, schema
  types, and query key helpers instead of handwritten one-off API clients.

Primary guide:

- `docs/patterns/admin-api-contract-generation-guide.md`

## Permission Flow

Admin permissions are code-based rather than role-name-based.

```text
permission registry
  -> permission seed
  -> backend @Permissions() guard
  -> frontend route/menu metadata
  -> frontend page action gates
```

Important rules:

- New admin CRUD endpoints should use `@Permissions('<resource>.<action>')`.
- Do not add new role-name checks for admin capabilities.
- The same permission codes should guard backend routes, frontend routes,
  menus, and page actions.
- Route and menu visibility should come from the admin route registry metadata.

Primary guide:

- `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`

## Admin Module Flow

A standard API-backed admin resource usually spans both applications:

```text
apps/api/src/<resource>/
  dto/
  <resource>.mapper.ts
  <resource>.service.ts
  <resource>.controller.ts
  <resource>.module.ts

apps/admin/src/features/<resource>/
  <resource>.types.ts
  <resource>.columns.tsx
  <Resource>Form.tsx
  <Resource>Page.tsx
  <Resource>Page.test.tsx
```

The usual sequence is:

1. Add or update the Prisma model and migration when persistence changes.
2. Implement backend DTOs, mapper, service, controller, and module wiring.
3. Add permission registry entries and controller permission guards.
4. Add explicit Swagger operation ids and response metadata.
5. Run API generation.
6. Build the admin feature page using generated API helpers.
7. Add route/menu metadata, i18n messages, and permission-gated actions.
8. Add backend and frontend tests.
9. Run the quality gates.

Primary guide:

- `docs/patterns/admin-crud-table-pattern-guide.md`

## Cross-Cutting Capabilities

Authentication and sessions:

- Access tokens are used by the admin app.
- Refresh-token and cookie behavior live in the API auth module and frontend API
  mutator / refresh coordinator.
- Login, refresh, logout, password change, and authenticated request behavior
  should be treated as one session lifecycle.

Errors and logging:

- API errors should go through the common exception mapping/filter layer.
- Validation, guard, and application errors should return consistent response
  shapes.
- Request ids and structured logs support diagnostics and observability.

Audit logs:

- Audit logs record sensitive administrative operations.
- Sanitizers should prevent secrets and private payload fields from being
  recorded.

System settings:

- Runtime-editable settings live behind the settings module.
- Environment variables remain the source for deployment-only configuration.

Quality gates:

- `pnpm quality` is the root readiness gate.
- Generated API drift should be checked with `pnpm api:check`.

## Source Of Truth

Use these files and directories as the source when judging whether a change
matches the template architecture:

```text
apps/api/prisma/schema.prisma
apps/api/src/openapi.ts
apps/api/scripts/generate-openapi.ts
apps/admin/orval.config.ts
apps/admin/src/app/api-mutator.ts
apps/admin/src/routes/admin-route-registry.tsx
apps/admin/src/routes/route-meta.ts
apps/api/src/permission/permission.registry.ts
docs/patterns/
docs/ai/
```

Generated artifacts:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

Do not repair generated artifacts by hand. Fix the source contract and
regenerate.

## Documentation Strategy

The documentation is intentionally split by audience:

- Human maintainers read this architecture overview to keep control of the
  whole system.
- AI agents read `docs/ai/` before making repeatable template changes.
- Developers and AI agents use `docs/patterns/` for detailed implementation
  rules.
- Historical design records stay in `docs/superpowers/`.

This repository does not need a static documentation site in the first phase.
However, the current Markdown structure is intended to be compatible with a
future VitePress site. When the documentation stabilizes, add a docs app or
VitePress config that publishes these same files rather than moving the content
into a separate platform.

Suggested later phases:

1. Keep Markdown files in the current structure and maintain links carefully.
2. Add VitePress with navigation for architecture, AI protocols, patterns, and
   deployment.
3. Add docs build scripts and CI checks.
4. Add search and version notes when the template starts serving multiple
   downstream projects.
