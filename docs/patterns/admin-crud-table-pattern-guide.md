# Admin CRUD Table Pattern Guide

This guide is for AI agents and developers adding a new standard admin CRUD
resource to this repository. Use the existing users, roles, dictionaries, files,
and audit log implementations as reference patterns.

The goal is to reuse the current backend and frontend CRUD table shape without
introducing a second admin architecture.

Authorization note:

- The admin app uses the RBAC permission system. Every new admin CRUD module
  must follow `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`.
- The admin app uses generated API contracts. Every new API-backed module must
  follow `docs/patterns/admin-api-contract-generation-guide.md`.
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

- `apps/admin/src/routes/admin-route-registry.tsx`
- `apps/admin/src/lib/permissions.ts`
- `apps/admin/src/lib/crud/list-query.ts`
- `apps/admin/src/components/data-table/DataTable.tsx`
- `apps/admin/src/components/data-table/DataTablePagination.tsx`
- `apps/admin/src/components/data-table/DataTableToolbar.tsx`
- `apps/admin/src/features/users/users.types.ts`
- `apps/admin/src/features/users/users.columns.tsx`
- `apps/admin/src/features/users/UserForm.tsx`
- `apps/admin/src/features/users/UsersPage.tsx`
- `apps/admin/src/features/users/UsersPage.test.tsx`
- `apps/admin/src/features/roles/RolesPage.tsx`
- `apps/admin/src/generated/api/endpoints/users/users.ts`
- `apps/admin/src/generated/api/schemas/index.ts`
- `apps/admin/src/layouts/AdminShell.tsx`
- `apps/admin/src/i18n/messages.ts`

## API Contract

Standard list endpoints use server-side pagination.

The backend DTOs and Swagger metadata are the source of truth. After adding or
changing CRUD endpoints, run:

```bash
pnpm api:generate
pnpm api:check
```

Do not create handwritten frontend API DTOs or one-method API wrappers. Use the
generated schema types, endpoint functions, hooks, and query key helpers from
`apps/admin/src/generated/api/`.

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
- `apps/admin/src/routes/admin-route-registry.tsx` route/menu metadata
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
  <resource>.columns.tsx
  <Resource>Form.tsx
  <Resource>Page.tsx
  <Resource>Page.test.tsx
```

Use shared table/query infrastructure and generated API helpers:

- `apps/admin/src/lib/crud/list-query.ts`
- `apps/admin/src/components/data-table/DataTable.tsx`
- `apps/admin/src/components/data-table/DataTableToolbar.tsx`
- `apps/admin/src/components/data-table/DataTablePagination.tsx`
- `apps/admin/src/generated/api/endpoints/<tag>/<tag>.ts`
- `apps/admin/src/generated/api/schemas`

### Types

Feature-local type files should not duplicate backend DTOs. Import generated
schema types and re-export aliases only when doing so makes page code easier to
read. Keep UI-only form, filter, selected-row, and derived view types local.

Example:

```ts
import type {
  CreateArticleDto,
  ListArticlesParams,
  UpdateArticleDto,
  ArticleResponseDto,
} from '../../generated/api/schemas'

export type ArticleRecord = ArticleResponseDto
export type ArticleListQuery = ListArticlesParams
export type CreateArticleRequest = CreateArticleDto
export type UpdateArticleRequest = UpdateArticleDto

export interface ArticleFormValue {
  title: string
  status: 'DRAFT' | 'PUBLISHED'
}
```

### Generated API Usage

Pages should import generated endpoint functions, hooks, and query key helpers
directly. Feature-local `.api.ts` wrappers are allowed only when they perform
real page-level composition, not simple forwarding.

Example:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createArticle,
  deleteArticle,
  getListArticlesQueryKey,
  listArticles,
  updateArticle,
} from '../../generated/api/endpoints/articles/articles'
import type { ListArticlesParams } from '../../generated/api/schemas'

const params = {
  page: pagination.pageIndex + 1,
  pageSize: pagination.pageSize,
  search: search || undefined,
  sort: toSortParam(sorting),
} satisfies ListArticlesParams

const articlesQuery = useQuery({
  queryKey: getListArticlesQueryKey(params),
  queryFn: () => listArticles(params),
})

const createMutation = useMutation({
  mutationFn: createArticle,
  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: getListArticlesQueryKey(),
    })
  },
})
```

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

- use generated endpoint functions or generated React Query hooks
- keep list state local to the page
- not sync list state to the URL unless explicitly requested
- use React Query mutations for create/update/delete
- invalidate or refetch the resource list after successful mutations using
  generated query key helpers
- show success and error toasts
- render `DataTable`, `DataTableToolbar`, and the resource form
- keep UI dense and operational
- avoid marketing or explanatory page copy

### Route And Menu Wiring

The current app uses TanStack Router with permission-aware route/menu metadata in
`apps/admin/src/routes/admin-route-registry.tsx`.

Rules:

- Do not introduce a separate routing abstraction for standard CRUD pages.
- Add the page to `apps/admin/src/routes/admin-route-registry.tsx` with
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

Mock generated endpoint modules in page tests. Do not test generated code
internals.

## Minimum Test Checklist

Every new API-backed CRUD module must add focused backend and frontend tests.
Use the checklist as a minimum behavior contract; add more cases when the
resource has special rules.

Backend tests:

- service-level create, read, update, delete, list, search, sort, and
  pagination behavior as applicable;
- uniqueness and domain invariant errors;
- validation and DTO mapping for request and response shapes;
- controller behavior for success responses and expected error responses;
- permission guard behavior or permission metadata for every protected action;
- audit-log behavior when the module mutates important data;
- OpenAPI operation ids and response metadata when the admin app consumes the
  endpoint through generated API code.

Frontend tests:

- initial loading and empty states;
- table rendering with representative data;
- filtering, search, sort, and pagination behavior where supported;
- create, edit, delete, enable, disable, or other primary actions;
- permission-aware visibility for route entries and row/page actions;
- API error display through the project's normalized error/toast conventions;
- cache invalidation or query refresh behavior after mutations;
- route metadata and menu registration.

Testing boundaries:

- Controller tests may mock services.
- Service tests may mock Prisma.
- Flow tests should cover only behavior that needs multiple project-owned units
  working together.
- Page tests should mock generated hooks or the shared request boundary.
- Do not test Orval-generated implementation details.
- Read-only, frontend-only, or thin wrapper modules may use a reduced checklist,
  but the reason should be stated in the implementation notes or review.

## Required Constraints

Do not break these constraints when adding a new CRUD resource:

- Do not expose sensitive backend fields.
- Do not allow arbitrary sort fields.
- Do not silently clamp invalid backend query values.
- Do not bypass the generated API mutator.
- Do not reintroduce `apps/admin/src/lib/api.ts`,
  `apps/admin/src/app/api-client.ts`, or one-method feature-local `.api.ts`
  wrappers.
- Do not write raw React Query key strings when a generated query key helper
  exists.
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
OpenAPI tag:
Operation IDs:
```

## AI Prompt Template

Use this prompt when asking an AI agent to add a new CRUD resource.

```text
Please implement Admin CRUD Table functionality for <resource> in the current
repository.

First read and follow:
- docs/patterns/admin-api-contract-generation-guide.md
- docs/patterns/admin-crud-table-pattern-guide.md
- docs/patterns/admin-rbac-crud-permission-pattern-guide.md

Use existing users, roles, dictionaries, files, and audit logs as reference
implementations. Do not invent a separate CRUD architecture.

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
- apps/admin/src/routes/admin-route-registry.tsx
- apps/admin/src/lib/permissions.ts
- apps/admin/src/lib/crud/list-query.ts
- apps/admin/src/components/data-table/DataTable.tsx
- apps/admin/src/components/data-table/DataTableToolbar.tsx
- apps/admin/src/components/data-table/DataTablePagination.tsx
- apps/admin/src/features/users/users.types.ts
- apps/admin/src/features/users/users.columns.tsx
- apps/admin/src/features/users/UserForm.tsx
- apps/admin/src/features/users/UsersPage.tsx
- apps/admin/src/features/users/UsersPage.test.tsx
- apps/admin/src/features/roles/RolesPage.tsx
- apps/admin/src/generated/api/endpoints/users/users.ts
- apps/admin/src/generated/api/schemas/index.ts
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
- Add explicit `@ApiOperation({ operationId })` values for every endpoint.
- Add complete backend DTO validation and Swagger metadata.
- Use server-side pagination/search/sort/filter.
- List responses must use { items, total, page, pageSize }.
- Sort fields must use a backend allowlist.
- Do not expose sensitive fields.
- Use method-level `@Permissions()` decorators for admin CRUD endpoints.
- Run `pnpm api:generate` after backend contract changes.
- Use generated schema types, endpoint functions/hooks, and query key helpers.
- Do not add one-method feature-local `.api.ts` wrappers.
- Add the route to permission-aware frontend route/menu metadata.
- Guard page action buttons with the permission helper.
- Keep permission code constants feature-local when the page has more than one
  action gate.
- Use shared frontend DataTable components.
- Do not introduce TanStack Router changes.
- Add focused backend and frontend tests.
- Run and pass:
  - pnpm api:check
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
pnpm api:check
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
