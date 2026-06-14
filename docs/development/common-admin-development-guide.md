# Common Admin Development Guide

This is the project-specific development entry point for teams building on top
of Common Admin.

Common Admin is a pnpm workspace with a NestJS API and a Vite/React admin app.
Most second-stage development work falls into one of these categories:

- adding an API-backed admin module;
- changing an existing API contract;
- adding RBAC permissions for a feature;
- adding frontend pages that consume generated API functions or hooks;
- deploying the template with Docker Compose.

## Project Layout

```text
apps/
  api/      NestJS API, Prisma, auth, RBAC, OpenAPI generation
  admin/    React admin app, route/menu metadata, generated API usage
docs/
  patterns/ Development guides for repeatable module work
```

Important generated artifacts:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

These files are committed, but they are not edited by hand. Change backend DTOs,
Swagger metadata, or Orval config, then regenerate.

## First Commands

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
createdb common_admin
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm dev
```

Default local URLs:

```text
API:      http://localhost:13001/api
Admin:    http://localhost:15173
Swagger:  http://localhost:13001/api/docs
```

Default login:

```text
admin@example.com
Admin123!
```

## Common Workflows

### Add an API-backed admin CRUD module

Read these guides first:

- `docs/patterns/admin-api-contract-generation-guide.md`
- `docs/patterns/admin-crud-table-pattern-guide.md`
- `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`

Short flow:

1. Add backend model/service/DTO/controller behavior.
2. Add permission registry entries when the endpoint is admin-only.
3. Add explicit Swagger operation ids and response metadata.
4. Run `pnpm api:generate`.
5. Use generated endpoint functions, hooks, schema types, and query key helpers
   in the admin page.
6. Add route/menu metadata and i18n messages.
7. Add backend and frontend tests.
8. Run `pnpm api:check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

### Change an existing API contract

1. Update backend DTOs, validation, mappers, and controller metadata.
2. Run `pnpm api:generate`.
3. Update frontend imports/usages if generated names or types changed.
4. Run `pnpm api:check`.

Do not patch generated files manually to satisfy TypeScript. Fix the backend
contract or Orval config and regenerate.

### Add a frontend-only admin page

Use route/menu metadata in `apps/admin/src/routes/admin-route-registry.tsx`.
If the page should be permission-gated, use existing permission codes or add new
ones through the RBAC guide.

Avoid adding API abstractions if the page does not call the API.

### Add special file or blob behavior

Use the generated file endpoints as the reference. Uploads use direct
`FormData`; downloads use a generated blob request. Keep browser file-save
logic in page code or a thin helper that still calls generated operations.

## Verification

Run the root quality gate before considering a feature branch ready:

```bash
pnpm quality
```

The quality gate runs the same checks expected in CI:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

Run the individual commands when debugging a failure. Use package-scoped
commands while iterating:

```bash
pnpm --filter api test
pnpm --filter admin test
pnpm --filter api test:e2e
pnpm --filter api build
pnpm --filter admin build
```

For new API-backed CRUD modules, also follow the minimum test checklist in
`docs/patterns/admin-crud-table-pattern-guide.md`.

## Documentation Map

- `docs/architecture/common-admin-architecture-overview.md`: human-facing
  architecture overview for maintainers who need to understand the whole
  template before guiding implementation work.
- `docs/ai/README.md`: AI-first working protocols for repeatable template
  tasks such as adding resources, changing contracts, and bootstrapping new
  projects.
- `docs/patterns/admin-api-contract-generation-guide.md`: generated API
  contract workflow, frontend usage, auth/mutator boundaries, upload/download,
  and troubleshooting.
- `docs/patterns/admin-crud-table-pattern-guide.md`: standard admin CRUD module
  structure.
- `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`: permission code,
  seed, backend guard, route/menu, and page action conventions.

Planning documents under `docs/superpowers/` explain how major features were
designed and implemented. Use them for background context, not as the primary
day-to-day development guide.
