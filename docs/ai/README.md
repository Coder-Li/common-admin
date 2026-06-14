# Common Admin AI Working Protocols

This directory is the entry point for AI agents working on Common Admin.

These documents are working protocols for the current codebase. When
implementation patterns change, update the affected protocol in the same change
set.

## Choose The Task Type

For a new API-backed admin resource:

1. Read `docs/ai/new-admin-resource-prompt.md`.
2. Follow `docs/ai/new-admin-resource-checklist.md`.
3. Use the required pattern guides linked from the checklist.

For an API contract change:

1. Follow `docs/ai/change-api-contract-checklist.md`.
2. Regenerate the API contract.
3. Update frontend usages through generated types and functions.

For a new project derived from this template:

1. Follow `docs/ai/project-bootstrap-checklist.md`.
2. Keep the generated API and quality gate workflow intact unless the human
   maintainer explicitly changes the architecture.

For architecture context:

- Read `docs/architecture/common-admin-architecture-overview.md`.

## Global Rules

- Do not hand edit `apps/api/openapi.json`.
- Do not hand edit files under `apps/admin/src/generated/api/`.
- Do not recreate a handwritten frontend API client.
- Do not add role-name checks for admin permissions.
- Use backend DTOs and Swagger metadata as the API contract source.
- Use generated frontend endpoint functions, React Query hooks, schema types,
  and query key helpers.
- Keep route, menu, backend guard, and page action permission codes aligned.
- Prefer updating existing pattern documents over creating duplicate guidance.

## Standard Verification

Run the narrowest useful command while iterating, then run broader gates before
finishing.

Common commands:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

For a branch-level readiness check:

```bash
pnpm quality
```

If a generated API check fails, fix the backend contract or Orval configuration
and regenerate. Do not patch generated output manually.
