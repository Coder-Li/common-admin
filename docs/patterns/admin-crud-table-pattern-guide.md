# Admin CRUD Table Pattern Guide

This guide is for AI agents and developers adding a new standard admin CRUD
resource to this repository. Use the existing users implementation as the
reference pattern.

The goal is to reuse the current backend and frontend CRUD table shape without
introducing a second admin architecture.

Authorization note:

- The admin app uses the RBAC permission system. Every new admin CRUD module
  must follow `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`.
- Use permission registry entries and `@Permissions()` for admin CRUD
  endpoints. Do not add role-name checks such as `@Roles(Role.ADMIN)`.
- Menus, routes, pages, and buttons must consume the same permission codes.

## Reference Implementation

Before implementing a new resource, read these files.

Backend:

- `apps/api/src/common/dto/list-query.dto.ts`
- `apps/api/src/common/dto/list-response.dto.ts`
- `apps/api/src/user/dto/user.request.ts`
- `apps/api/src/user/dto/user.response.ts`
- `apps/api/src/user/user.mapper.ts`
- `apps/api/src/user/user.service.ts`
- `apps/api/src/user/user.controller.ts`
- `apps/api/src/user/user.service.spec.ts`
- `apps/api/src/auth/auth-flow.spec.ts`

Frontend:

- `apps/admin/src/routes/admin-routes.tsx`
- `apps/admin/src/lib/permissions.ts`
- `apps/admin/src/lib/crud/list-query.ts`
- `apps/admin/src/lib/crud/useServerTableQuery.ts`
- `apps/admin/src/components/data-table/DataTable.tsx`
- `apps/admin/src/components/data-table/DataTablePagination.tsx`
- `apps/admin/src/components/data-table/DataTableToolbar.tsx`
- `apps/admin/src/features/users/users.types.ts`
- `apps/admin/src/features/users/users.api.ts`
- `apps/admin/src/features/users/users.columns.tsx`
- `apps/admin/src/features/users/UserForm.tsx`
- `apps/admin/src/features/users/UsersPage.tsx`
- `apps/admin/src/features/users/UsersPage.test.tsx`
- `apps/admin/src/features/roles/RolesPage.tsx`
- `apps/admin/src/layouts/AdminShell.tsx`
- `apps/admin/src/i18n/messages.ts`

## API Contract

Standard list endpoints use server-side pagination.

Request query:

```ts
interface ListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
}
```

Resource-specific query types add filters:

```ts
interface ExampleListQuery extends ListQuery {
  status?: 'ACTIVE' | 'INACTIVE'
}
```

Response:

```ts
interface ListResponse<TItem> {
  items: TItem[]
  total: number
  page: number
  pageSize: number
}
```

Rules:

- `page` is 1-based at the API boundary.
- Omitted `page` defaults to `1` on the backend.
- Omitted `pageSize` defaults to `20` on the backend.
- `pageSize` must be from `1` to `100`.
- Invalid query params return `400`; do not silently clamp them.
- `sort` uses `field:direction`, for example `createdAt:desc`.
- Each resource must define a sort allowlist.
- Each resource must define allowed filters.
- Search fields are resource-specific.
- Responses must not expose sensitive fields.

## Backend Pattern

Create or update this shape for each standard resource:

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

Use class-validator DTOs and Swagger decorators, following the user module.

### Request DTOs

In `<resource>.request.ts`:

- `<Resource>ListQueryDto extends ListQueryDto`
- Create DTO
- Update DTO

The list query DTO must:

- inherit `page`, `pageSize`, `search`, and `sort`
- validate resource filters
- reject sort fields outside the resource allowlist
- reject sort directions outside `asc` and `desc`

### Response DTOs

In `<resource>.response.ts`:

- `<Resource>ResponseDto`
- `<Resource>ListResponseDto`

The response DTO must include only public fields. Do not include internal
fields such as password hashes, secrets, tokens, or private audit metadata.

### Mapper

The mapper owns conversion from Prisma records to public API responses.

Rules:

- Convert `Date` fields to ISO strings.
- Return only public fields.
- Keep profile or existing mapper behavior compatible if the resource already
  has public endpoints.

### Service

The service owns business logic and Prisma access.

For list methods:

- parse the sort string
- default sort to the resource default
- reject invalid sort fields with `BadRequestException`
- build one shared `where` object
- pass that same `where` object to `findMany` and `count`
- apply `skip = (page - 1) * pageSize`
- apply `take = pageSize`
- map items through the public mapper
- return `createListResponse(items, total, page, pageSize)`

For create/update/delete:

- map Prisma `P2002` to `ConflictException`
- map Prisma `P2025` to `NotFoundException`
- hash secrets in the service if the resource has secret fields
- never return raw Prisma records directly from controller methods

### Controller

Admin CRUD controllers should expose:

```text
GET    /<resources>
GET    /<resources>/:id
POST   /<resources>
PATCH  /<resources>/:id
DELETE /<resources>/:id
```

Rules:

- Add `@Permissions('<resource>.<action>')` to each admin-only method.
- Do not add new `@Roles()` decorators or role-name based authorization checks.
- Do not add class-level admin permission metadata if the controller has
  authenticated self-service endpoints.
- Put literal routes before parameter routes, for example `me` before `:id`.
- Use `@HttpCode(204)` for successful deletes.
- Add Swagger response decorators.

### Permission Contract

For each admin CRUD resource, add permission registry entries and use the same
codes across:

- backend controller decorators with `@Permissions('<resource>.<action>')`
- `apps/admin/src/routes/admin-routes.tsx` route/menu metadata
- frontend page action gates through `apps/admin/src/lib/permissions.ts`
- optional feature-local permission constants

### Backend Tests

Add focused service tests for:

- list defaults and query validation
- rejected invalid sort fields
- rejected invalid sort directions
- search `where` mapping
- filter `where` mapping
- `findMany` and `count` using the same `where`
- create hashing or secret handling, when applicable
- duplicate unique conflicts
- find/update/delete not found behavior
- mapper excludes sensitive fields

Add auth or flow tests when routes or permissions are introduced:

- users without the required permission cannot access admin CRUD
- users with the required permission can access admin CRUD
- unauthenticated users receive `401`
- delete returns `204`
- literal route ordering is preserved when relevant

## Frontend Pattern

Each standard CRUD resource should follow this shape:

```text
apps/admin/src/features/<resource>/
  <resource>.types.ts
  <resource>.api.ts
  <resource>.columns.tsx
  <Resource>Form.tsx
  <Resource>Page.tsx
  <Resource>Page.test.tsx
```

Use shared table/query infrastructure:

- `apps/admin/src/lib/crud/list-query.ts`
- `apps/admin/src/lib/crud/useServerTableQuery.ts`
- `apps/admin/src/components/data-table/DataTable.tsx`
- `apps/admin/src/components/data-table/DataTableToolbar.tsx`
- `apps/admin/src/components/data-table/DataTablePagination.tsx`

### Types

Define frontend request and response types matching the backend contract.

Example:

```ts
export interface ExampleListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
  status?: ExampleStatus
}

export interface ExampleRecord {
  id: string
  name: string
  status: ExampleStatus
  createdAt: string
  updatedAt: string
}

export interface ExampleListResponse {
  items: ExampleRecord[]
  total: number
  page: number
  pageSize: number
}
```

### API Wrapper

Create feature-local wrapper functions around the global API client. Pages
should import these wrappers, not the global `api` object directly. This keeps
page tests easy to mock.

Example:

```ts
export function listExamples(query: ExampleListQuery) {
  return api.examples.list(query)
}
```

Also extend `apps/admin/src/lib/api.ts` if the resource needs new API client
methods.

### Columns

Column files should:

- export a `create<Resource>Columns(...)` function
- accept labels from the page or i18n
- accept action callbacks from the page
- not create mutations directly
- disable sorting for synthetic columns not accepted by the backend
- use column IDs that match backend sort allowlist fields when sortable

### Form

Forms should:

- use `react-hook-form`
- use `zod`
- validate fields consistently with backend DTOs
- omit fields from edit payloads when they are not editable
- use i18n labels and validation copy
- keep controls compact and stable on mobile

### Page

Pages should:

- use `useServerTableQuery`
- keep list state local to the page
- not sync list state to the URL unless explicitly requested
- use React Query mutations for create/update/delete
- invalidate or refetch the resource list after successful mutations
- show success and error toasts
- render `DataTable`, `DataTableToolbar`, and the resource form
- keep UI dense and operational
- avoid marketing or explanatory page copy

### Route And Menu Wiring

The current app uses custom path state through `AppContent`, `resolveRoute`,
`AdminShell`, and permission-aware route metadata in
`apps/admin/src/routes/admin-routes.tsx`.

Rules:

- Do not introduce a TanStack Router route refactor for standard CRUD pages.
- Add the page to `apps/admin/src/routes/admin-routes.tsx` with
  `requiredPermissions`.
- Let `AdminShell` render navigation from the route metadata instead of adding
  hard-coded role or permission branches.
- Direct URL access without the route permission must resolve to `/403`.
- Leave unrelated placeholder pages unchanged.

### Frontend Tests

Add page tests for:

- loading state
- empty state
- returned rows rendering
- search and filter query changes
- sorting only allowed backend fields
- create success closes form and refetches
- update success closes form and refetches
- delete confirmation calls delete and refetches
- error state and retry

Mock feature-local API wrappers in page tests.

## Required Constraints

Do not break these constraints when adding a new CRUD resource:

- Do not expose sensitive backend fields.
- Do not allow arbitrary sort fields.
- Do not silently clamp invalid backend query values.
- Do not bypass the shared API client.
- Do not import the global `api` object directly in resource pages.
- Do not introduce a TanStack Router migration as part of a CRUD page.
- Do not put users-specific behavior into shared table components.
- Do not add role-name based authorization such as `@Roles(Role.ADMIN)`.
- Do not reintroduce frontend `ADMIN` / `STANDARD` role unions for
  authorization.
- Do not hard-code menu, route, page, or button authorization separately.
  Centralize permission codes and consume them through the shared helper.
- Do not add class-level permission metadata when a controller also has
  authenticated self-service endpoints.
- Keep literal NestJS routes before parameter routes.
- Keep frontend synthetic table columns unsortable unless the backend supports
  their sort field.
- Add i18n messages for user-facing admin copy.

## Resource Checklist

Fill this out before asking an AI agent to implement a new CRUD resource.

```text
Resource name:
Route path:
Prisma model:

Public list/detail fields:
- 

Create fields:
- 

Update fields:
- 

Search fields:
- 

Sort fields:
- 

Default sort:

Filters:
- 

Sensitive fields that must never be returned:
- 

Special rules:
- 

Route/menu metadata entry:
Permission codes:
```

## AI Prompt Template

Use this prompt when asking an AI agent to add a new CRUD resource.

```text
Please implement Admin CRUD Table functionality for <resource> in the current
repository.

First read and follow:
- docs/patterns/admin-crud-table-pattern-guide.md
- docs/patterns/admin-rbac-crud-permission-pattern-guide.md

Use users as the reference implementation. Do not invent a separate CRUD
architecture.

Backend reference files:
- apps/api/src/common/dto/list-query.dto.ts
- apps/api/src/common/dto/list-response.dto.ts
- apps/api/src/user/dto/user.request.ts
- apps/api/src/user/dto/user.response.ts
- apps/api/src/user/user.mapper.ts
- apps/api/src/user/user.service.ts
- apps/api/src/user/user.controller.ts
- apps/api/src/user/user.service.spec.ts
- apps/api/src/auth/auth-flow.spec.ts

Frontend reference files:
- apps/admin/src/routes/admin-routes.tsx
- apps/admin/src/lib/permissions.ts
- apps/admin/src/lib/crud/list-query.ts
- apps/admin/src/lib/crud/useServerTableQuery.ts
- apps/admin/src/components/data-table/DataTable.tsx
- apps/admin/src/components/data-table/DataTableToolbar.tsx
- apps/admin/src/components/data-table/DataTablePagination.tsx
- apps/admin/src/features/users/users.types.ts
- apps/admin/src/features/users/users.api.ts
- apps/admin/src/features/users/users.columns.tsx
- apps/admin/src/features/users/UserForm.tsx
- apps/admin/src/features/users/UsersPage.tsx
- apps/admin/src/features/users/UsersPage.test.tsx
- apps/admin/src/features/roles/RolesPage.tsx
- apps/admin/src/layouts/AdminShell.tsx
- apps/admin/src/i18n/messages.ts

Resource details:
- Resource name: <resource>
- Route path: <route>
- Prisma model: <model>
- Public fields: <fields>
- Create fields: <fields>
- Update fields: <fields>
- Search fields: <fields>
- Sort fields: <fields>
- Default sort: <field:direction>
- Filters: <filters>
- Sensitive fields: <fields>
- Special rules: <rules>

Requirements:
- Define permission codes for the resource before implementing.
- Add permission registry entries and seed/upsert support.
- Use server-side pagination/search/sort/filter.
- List responses must use { items, total, page, pageSize }.
- Sort fields must use a backend allowlist.
- Do not expose sensitive fields.
- Use method-level `@Permissions()` decorators for admin CRUD endpoints.
- Add the route to permission-aware frontend route/menu metadata.
- Guard page action buttons with the permission helper.
- Keep permission code constants feature-local when the page has more than one
  action gate.
- Use shared frontend DataTable and useServerTableQuery.
- Use feature-local API wrapper functions.
- Do not introduce TanStack Router changes.
- Add focused backend and frontend tests.
- Run and pass:
  - pnpm --filter api exec jest --runInBand
  - pnpm --filter admin test
  - pnpm --filter api build
  - pnpm --filter admin build
  - pnpm --filter api lint
  - pnpm --filter admin lint

If this request conflicts with existing code, stop and explain the conflict
before implementing.
```

## Verification Commands

Run these before claiming the resource is complete:

```bash
pnpm --filter api exec jest --runInBand
pnpm --filter admin test
pnpm --filter api build
pnpm --filter admin build
pnpm --filter api lint
pnpm --filter admin lint
```

For UI work, also start the app and smoke test the page:

```bash
pnpm dev
```

Smoke test at least:

- login
- list renders
- search
- filters
- sorting
- create
- edit
- delete
- empty state
- error/retry path when practical
