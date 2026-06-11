# Admin API Contract Generation Guide

Common Admin uses the backend OpenAPI document as the source for frontend API
types, endpoint functions, React Query hooks, and query keys.

## Contract Source

The API contract starts in the NestJS backend. DTO classes, validation rules,
and controller Swagger metadata define the OpenAPI document in
`apps/api/openapi.json`.

Every backend endpoint must define an explicit `@ApiOperation({ operationId })`.
Operation IDs are stable public names for generated frontend functions and
hooks, so do not rely on controller method names or automatic naming.

## Prefix Policy

Generated OpenAPI paths are prefix-free. Backend runtime routes still use the
global `/api` prefix, but the OpenAPI document exposes resource paths such as
`/users` and `/files`.

The admin app owns the deployment prefix through `VITE_API_BASE_URL`, which
defaults to `/api`. This prevents generated calls from becoming `/api/api/...`.

## Workflow

Regenerate the contract and frontend client after changing backend DTOs,
Swagger metadata, controllers, or Orval config:

```bash
pnpm api:generate
```

Check whether generated artifacts are current before committing:

```bash
pnpm api:check
```

`pnpm api:check` regenerates `apps/api/openapi.json` and
`apps/admin/src/generated/api/`, then fails if those generated files differ from
the committed output.

## Generated Code

Do not hand edit files under `apps/admin/src/generated/api/`. Change backend
DTOs, controller Swagger metadata, or `apps/admin/orval.config.ts`, then run the
generation workflow again.

Generated files are committed so template users can inspect the API contract and
frontend hooks without running generation first.

## Frontend Usage

Admin pages should default to importing generated endpoint functions, hooks, and
schema types directly from `apps/admin/src/generated/api/`.

Use generated query key helpers when invalidating generated queries. If a page
needs a project-level adapter for invalidation or table state, keep that adapter
small and focused on UI composition.

Feature-local API facades are not the default pattern. Add one only when it
performs real page-level composition or UI model adaptation that is worth naming.
Do not recreate one-method wrappers around generated endpoint functions.

## Files

Uploads use direct `FormData` in the first version. Keep multipart behavior in
the generated endpoint plus the shared mutator; avoid custom per-page upload
clients.

Downloads use the generated `downloadFile` endpoint with a blob request override
where the UI needs browser download behavior.
