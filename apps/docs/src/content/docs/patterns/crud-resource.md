---
title: CRUD Resource
description: Standard shape for adding API-backed admin resources.
draft: false
---

A normal admin resource spans the API app and the admin app.

```text
apps/api/src/<resource>/
  dto/
    <resource>.request.ts
    <resource>.response.ts
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

## List Contract

Standard list endpoints use server-side pagination and return:

```ts
interface ListResponse<TItem> {
  items: TItem[]
  total: number
  page: number
  pageSize: number
}
```

List query rules:

- `page` is 1-based at the API boundary.
- Omitted `page` defaults to `1`.
- Omitted `pageSize` defaults to `20`.
- `pageSize` must be from `1` to `100`.
- Invalid query values return `400`; do not silently clamp them.
- `search` is optional and maps only to resource-approved fields.
- `sort` uses `field:direction`, for example `createdAt:desc`.
- Sort directions are only `asc` and `desc`.
- Every resource must define a sort allowlist.
- Filters are resource-specific and must be explicitly validated.

Frontend table pagination is usually zero-based internally. Convert to the 1-based API contract at the generated API call boundary.

## Implementation Order

1. Add persistence changes if needed.
2. Add backend DTOs, mapper, service, controller, and module wiring.
3. Add permission registry entries and controller guards.
4. Add explicit Swagger operation ids.
5. Regenerate API artifacts.
6. Build the admin page with generated helpers.
7. Add route/menu metadata and i18n messages.
8. Add focused tests.
9. Run quality gates.

## Backend Pattern

Request DTOs should include:

- `<Resource>ListQueryDto` extending the shared list query DTO.
- Create DTO.
- Update DTO.
- Resource-specific filter validation.
- Sort validation against the resource allowlist.

Response DTOs should include:

- `<Resource>ResponseDto` for public record fields.
- `<Resource>ListResponseDto` for `{ items, total, page, pageSize }`.

Mapper rules:

- Convert database records to public response objects.
- Convert `Date` values to ISO strings.
- Exclude passwords, tokens, secrets, and private metadata.
- Do not return raw Prisma records directly from controllers.

Service rules:

- Build one shared `where` object for `findMany` and `count`.
- Apply `skip = (page - 1) * pageSize`.
- Apply `take = pageSize`.
- Parse and validate sort before passing it to Prisma.
- Map unique conflicts to conflict errors.
- Map missing records to not-found errors.
- Use the shared list response helper when available.

Controller rules:

- Standard CRUD routes are `GET /<resources>`, `GET /<resources>/:id`, `POST /<resources>`, `PATCH /<resources>/:id`, and `DELETE /<resources>/:id`.
- Put literal routes before parameter routes.
- Use method-level `@Permissions()` for admin-only methods.
- Use `@HttpCode(204)` for successful deletes.
- Add explicit Swagger operation ids and response decorators.

## Frontend Pattern

Feature files should use generated schema types, endpoint functions, hooks, and query key helpers. Keep local types for UI-only form state, selected rows, derived values, or aliases that make page code easier to read.

Columns should:

- be created by a `create<Resource>Columns(...)` function;
- accept labels and action callbacks from the page;
- keep synthetic columns unsortable unless the backend supports the sort field;
- use sortable column ids that match backend sort allowlist fields.

Forms should:

- use the existing form and validation pattern;
- keep create and update payloads aligned with generated DTO types;
- omit fields from edit payloads when they are not editable;
- use i18n labels for visible copy.

Pages should:

- use generated API helpers directly;
- keep list state local unless URL sync is explicitly required;
- use generated query key helpers for invalidation after mutations;
- show loading, empty, success, and error states;
- reuse shared table, toolbar, pagination, form, toast, and error patterns.

## Route, Menu, I18n, And Permissions

Wire the resource through the same metadata used by the existing admin shell:

- Add the route/menu entry to `apps/admin/src/routes/admin-route-registry.tsx`.
- Set `requiredPermissions` to the read permission, such as `article.read`.
- Let menu visibility come from route metadata.
- Ensure direct URL access without permission resolves to `/403`.
- Add i18n messages for navigation, page labels, form labels, validation copy, and actions.
- Gate create, update, delete, and special action buttons with the same permission codes used by backend guards.

Do not add role-name checks or separate menu-only authorization logic.

## Test Checklist

Backend tests should cover:

- list defaults and query validation;
- invalid page, pageSize, sort field, and sort direction behavior;
- search and filter `where` mapping;
- `findMany` and `count` using the same `where`;
- create, update, delete, duplicate, and not-found behavior;
- mapper output excluding sensitive fields;
- permission metadata or guarded route behavior for protected actions.

Frontend tests should cover:

- loading and empty states;
- representative table rows;
- search, filters, sorting, and pagination when supported;
- create, edit, delete, and special actions;
- permission-aware route/menu/action visibility;
- API error display and retry behavior where owned by the page;
- cache invalidation or refetch behavior after mutations.

Do not test generated API implementation internals. Mock generated endpoint modules or the shared request boundary in page tests.

## Resource Intake Checklist

Confirm these details before implementing a new resource:

```text
Resource name:
Route path:
Prisma model:
Public list/detail fields:
Create fields:
Update fields:
Search fields:
Sort fields:
Default sort:
Filters:
Sensitive fields that must never be returned:
Special rules:
Route/menu metadata:
Permission codes:
OpenAPI tag:
Operation ids:
```
