# New Admin Resource Checklist

This checklist is for AI agents adding a standard API-backed admin resource.
Use it together with:

- `docs/patterns/admin-api-contract-generation-guide.md`
- `docs/patterns/admin-crud-table-pattern-guide.md`
- `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`

## 1. Understand The Resource

- Confirm the resource name, fields, unique constraints, and relationships.
- Confirm list filters, searchable fields, and allowed sort fields.
- Confirm which actions exist: read, create, update, delete, export, upload, or
  other custom actions.
- Confirm whether the module needs audit log records or special redaction.
- Confirm whether the module should appear in the admin menu.

## 2. Backend Persistence

- Add or update the Prisma model in `apps/api/prisma/schema.prisma`.
- Create a Prisma migration when the database schema changes.
- Add seed data only when the template should ship with default records.
- Keep private fields, secrets, tokens, and internal metadata out of public
  response DTOs.

## 3. Backend Module

Create or update:

```text
apps/api/src/<resource>/
  dto/
    <resource>.request.ts
    <resource>.response.ts
  <resource>.mapper.ts
  <resource>.service.ts
  <resource>.controller.ts
  <resource>.module.ts
```

Checklist:

- Request DTOs use class-validator decorators.
- Response DTOs use Swagger metadata.
- Mapper converts database records into public response objects.
- Date fields are returned as ISO strings.
- List endpoints use the shared pagination response shape.
- List queries validate filters and sort fields.
- `findMany` and `count` use the same `where` object.
- Prisma unique conflicts map to conflict errors.
- Not-found behavior maps to not-found errors.
- Controllers define explicit `@ApiOperation({ operationId })` values.
- Controllers define response decorators for JSON, empty, binary, or multipart
  responses as appropriate.

## 4. Permissions

- Add permission registry entries for every admin action.
- Add seed behavior for the new permission codes.
- Use `@Permissions('<resource>.<action>')` on admin-only controller methods.
- Do not add role-name checks for admin capabilities.
- Keep permission code names stable because frontend routes and action gates
  depend on them.

## 5. API Generation

Run:

```bash
pnpm api:generate
```

Then inspect generated names and imports. If generated output is wrong, fix the
backend DTOs, controller metadata, or Orval configuration and regenerate.

Never hand edit:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

## 6. Frontend Feature

Create or update:

```text
apps/admin/src/features/<resource>/
  <resource>.types.ts
  <resource>.columns.tsx
  <Resource>Form.tsx
  <Resource>Page.tsx
  <Resource>Page.test.tsx
```

Checklist:

- Use generated schema types for API data.
- Use generated endpoint functions or hooks for requests.
- Use generated query key helpers, or a small existing adapter, for invalidation.
- Keep local types limited to UI-only state or aliases.
- Add route and menu metadata in the admin route registry.
- Add i18n messages for visible text.
- Gate page actions with the same permission codes used by the backend.
- Reuse existing table, toolbar, pagination, form, toast, and error patterns.

## 7. Tests

Backend tests should cover:

- list defaults and query validation
- invalid sort fields and directions
- search and filter query mapping
- shared `where` object for `findMany` and `count`
- create/update/delete success behavior
- unique conflict behavior
- not-found behavior
- mapper output excludes sensitive fields
- permission guard behavior when new routes are introduced

Frontend tests should cover:

- initial list rendering
- search/filter/sort/page interactions when present
- create/update/delete flows when present
- permission-gated visibility for menu entries and page actions
- error or empty states when the page owns meaningful behavior

## 8. Verification

Run:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

Run API e2e tests when the change touches auth, permission flow, global request
behavior, or e2e-covered routes:

```bash
pnpm --filter api test:e2e
```

For branch readiness:

```bash
pnpm quality
```

If a command fails, fix the source behavior and rerun the relevant command.
