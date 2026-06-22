---
title: Resource Workflow
description: A stable public workflow for adding a new API-backed admin resource.
draft: false
---

Use this workflow when adding a standard resource such as a user-facing table,
form, or admin CRUD module.

## Read First

Before implementation, read:

- [Architecture](./architecture/)
- [API Contract](./patterns/api-contract/)
- [CRUD Resource](./patterns/crud-resource/)
- [RBAC](./patterns/rbac/)
- [Users Roles And Permissions](./users-roles-permissions/) when the resource
  touches identity or access control
- [Quality Gates](./quality-gates/)

## Suggested Order

1. Confirm the resource name, fields, filters, sort fields, and sensitive data.
2. Add or update persistence when needed.
3. Add backend DTOs, mappers, service logic, controller routes, and module
   wiring.
4. Add explicit Swagger operation ids and response metadata.
5. Add or update permission registry entries and guards.
6. Regenerate OpenAPI and the generated admin client.
7. Build the frontend page using generated API helpers.
8. Add route and menu metadata.
9. Add focused backend and frontend tests.
10. Run the relevant verification commands.

## Rules That Matter Most

- Backend DTOs and Swagger metadata are the API contract source.
- Generated artifacts are read-only implementation output.
- Use stable lowercase `module.action` permissions.
- Keep frontend route and action gating aligned with backend guards.
- Use generated endpoint functions, hooks, schema types, and query keys.
- Keep audit, settings, and file behavior on their own boundaries.

## Common Variations

For auth, sessions, files, settings, dictionaries, or organization data, reuse
the same pattern but keep the module-specific boundaries from the dedicated
docs.

For data-scoped resources, add backend visibility checks in the service layer
instead of relying on menu visibility or local filtering.

## Verification

Minimum useful checks:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

Run API e2e tests when auth, permissions, request flow, or generated endpoint
behavior changes:

```bash
pnpm --filter api test:e2e
```
