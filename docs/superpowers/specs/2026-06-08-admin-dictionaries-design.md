# Admin Dictionaries Design

## Goal

Add a dictionary system for configurable enum-like data used by admin forms,
filters, tables, and badges. The dictionary system should let administrators
manage display options without moving authorization, workflow, or other business
logic out of code.

The first practical target is user roles: the backend can keep the existing
`Role` enum for permissions, while the admin frontend can use dictionaries for
role labels, select options, and filter options.

## Context

The project already has a standard admin CRUD table pattern documented in
`docs/patterns/admin-crud-table-pattern-guide.md`. The dictionary feature should
follow that pattern rather than introduce a second admin architecture.

Current stack:

- API: NestJS, Prisma, PostgreSQL, Swagger, JWT auth, roles, and
  class-validator DTOs.
- Admin: React, Vite, Tailwind CSS, React Query, Axios, zod, react-hook-form,
  and project-local data table components.
- Existing enum usage: `User.role` is a Prisma enum and is also repeated in
  frontend TypeScript types, form options, filters, and i18n labels.

Mature admin frameworks commonly model dictionaries as a type table plus an
item table. RuoYi-style systems use dictionary types and dictionary data for
runtime-configurable options. JeecgBoot additionally supports table-backed
dictionaries and annotation-based translation. Ant Design Pro often keeps small
frontend-only enums in column `valueEnum`. For this project, the first version
should use the proven two-table model and defer table-backed dictionaries until
there is a concrete business case.

## Scope

- Backend dictionary type CRUD.
- Backend dictionary item CRUD.
- Lightweight public/admin option endpoints for frontend consumers.
- Frontend admin page for managing dictionary types and items.
- Frontend dictionary query helpers for forms, filters, and table cells.
- Initial seeded system dictionary for user roles.
- User role display, select options, and filter options wired through the
  dictionary helper, while authorization continues to use the backend `Role`
  enum.

Out of scope:

- Table dictionaries that read options from arbitrary business tables.
- SQL dictionaries.
- Cascading dictionaries.
- Import/export.
- Audit history for dictionary changes.
- Server-localized dictionary labels.
- Replacing authorization or workflow enums with editable dictionary data.

## Chosen Approach

Use two persistent resources:

- `DictionaryType`: identifies a dictionary family such as `user_role`.
- `DictionaryItem`: stores the available values under one type.

Expose normal admin CRUD endpoints for both resources, plus read-optimized
option endpoints for page code. The admin CRUD endpoints follow the existing
list/query/response pattern. The option endpoints return only active types and
active items by default, with a compact response shape suitable for React Query
caching.

This approach keeps dictionary maintenance familiar to administrators while
preserving type safety for code-critical concepts. A value like `ADMIN` can
still be enforced by the backend `Role` enum, while the dictionary owns the
label, sort order, default flag, and optional badge variant used by the UI.

## Data Model

Prisma model names should be singular and explicit:

```ts
model DictionaryType {
  id          String   @id @default(uuid())
  code        String   @unique @db.VarChar(80)
  name        String   @db.VarChar(120)
  status      DictionaryStatus @default(ACTIVE)
  isSystem    Boolean  @default(false)
  description String?  @db.VarChar(500)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items       DictionaryItem[]
}

model DictionaryItem {
  id          String   @id @default(uuid())
  typeId      String
  value       String   @db.VarChar(120)
  label       String   @db.VarChar(120)
  sortOrder   Int      @default(0)
  status      DictionaryStatus @default(ACTIVE)
  isSystem    Boolean  @default(false)
  isDefault   Boolean  @default(false)
  badgeVariant DictionaryBadgeVariant?
  metadata    Json?
  description String?  @db.VarChar(500)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  type        DictionaryType @relation(fields: [typeId], references: [id])

  @@unique([typeId, value])
  @@index([typeId, sortOrder])
}

enum DictionaryStatus {
  ACTIVE
  DISABLED
}

enum DictionaryBadgeVariant {
  DEFAULT
  SUCCESS
  WARNING
  DANGER
  NEUTRAL
}
```

Rules:

- `DictionaryType.code` is immutable after creation.
- `DictionaryItem.value` is immutable after creation.
- A dictionary type with `isSystem = true` cannot be deleted.
- `DictionaryType.isSystem` and `DictionaryItem.isSystem` are read-only product
  ownership flags. They are set only by seed/migration code or explicitly
  protected service code, not by public admin create/update DTOs.
- A dictionary item with `isSystem = true` cannot be deleted.
- System dictionary items cannot change `value`, `typeId`, `status`, or
  `isSystem`. Admins may edit `label`, `sortOrder`, `badgeVariant`,
  `isDefault`, `metadata`, and `description`.
- A disabled type makes all of its items unavailable from option endpoints.
- Disabled items remain visible in admin management but are omitted from option
  endpoints.
- At most one active item under a type should be marked as default.
- If an item is marked default, the service clears the previous default item for
  that type in the same transaction.
- Deleting a non-system dictionary type with existing items is rejected with
  `409 Conflict`. The Prisma relation should not cascade deletes in v1.

The implementation can choose a PostgreSQL partial unique index for the default
constraint, or enforce it transactionally in the service. A transactional
service rule is acceptable for v1 and is easier to keep portable through Prisma.

## API Contract

Management endpoints are admin-only:

```text
GET    /dictionary-types
GET    /dictionary-types/:id
POST   /dictionary-types
PATCH  /dictionary-types/:id
DELETE /dictionary-types/:id

GET    /dictionary-items
GET    /dictionary-items/:id
POST   /dictionary-items
PATCH  /dictionary-items/:id
DELETE /dictionary-items/:id
```

Option endpoints are authenticated and read-only:

```text
GET /dictionaries/:typeCode/options
GET /dictionaries/options?types=user_role,common_status
```

If the product later needs unauthenticated dictionaries for public pages, add
separate explicitly public routes instead of making these routes public by
default.

Multi-type option query rules:

- `types` is required for `GET /dictionaries/options`.
- `types` is a comma-separated list of dictionary codes.
- Each code must satisfy the dictionary code validation rule.
- Empty entries are rejected with `400`.
- Duplicate codes are de-duplicated while preserving first-seen order.
- A single request may ask for at most 30 dictionary types.
- The response includes every requested code. Unknown, disabled, or empty
  dictionary types are returned as empty arrays.
- Items are sorted by `sortOrder:asc` and then `value:asc` for stable ties.

Single-type option route rules:

- `typeCode` must satisfy the dictionary code validation rule.
- Unknown, disabled, or empty dictionary types return
  `{ typeCode, items: [] }`.
- Items are sorted by `sortOrder:asc` and then `value:asc`.

## List Queries

Both management resources use the existing `ListQueryDto` contract:

```ts
interface ListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
}
```

Dictionary type filters:

```ts
interface DictionaryTypeListQuery extends ListQuery {
  status?: 'ACTIVE' | 'DISABLED'
  isSystem?: boolean
}
```

Dictionary item filters:

```ts
interface DictionaryItemListQuery extends ListQuery {
  typeId?: string
  typeCode?: string
  status?: 'ACTIVE' | 'DISABLED'
  isDefault?: boolean
}
```

Sort allowlists:

- Dictionary types: `code`, `name`, `status`, `isSystem`, `createdAt`,
  `updatedAt`.
- Dictionary items: `value`, `label`, `sortOrder`, `status`, `isDefault`,
  `createdAt`, `updatedAt`.

Default sort:

- Dictionary types: `createdAt:desc`.
- Dictionary items: `sortOrder:asc`.

Search behavior:

- Dictionary types search `code`, `name`, and `description`.
- Dictionary items search `value`, `label`, and `description`.

Invalid filters, sort fields, or sort directions return `400`.

## Request And Response Shapes

Create dictionary type:

```ts
interface CreateDictionaryTypeRequest {
  code: string
  name: string
  status?: 'ACTIVE' | 'DISABLED'
  description?: string
}
```

Update dictionary type:

```ts
interface UpdateDictionaryTypeRequest {
  name?: string
  status?: 'ACTIVE' | 'DISABLED'
  description?: string
}
```

`code` is intentionally absent from update requests.
`isSystem` is intentionally absent from create and update requests because it is
a read-only product ownership flag.

Create dictionary item:

```ts
interface CreateDictionaryItemRequest {
  typeId: string
  value: string
  label: string
  sortOrder?: number
  status?: 'ACTIVE' | 'DISABLED'
  isDefault?: boolean
  badgeVariant?: 'DEFAULT' | 'SUCCESS' | 'WARNING' | 'DANGER' | 'NEUTRAL'
  metadata?: Record<string, unknown>
  description?: string
}
```

Update dictionary item:

```ts
interface UpdateDictionaryItemRequest {
  label?: string
  sortOrder?: number
  status?: 'ACTIVE' | 'DISABLED'
  isDefault?: boolean
  badgeVariant?: 'DEFAULT' | 'SUCCESS' | 'WARNING' | 'DANGER' | 'NEUTRAL'
  metadata?: Record<string, unknown>
  description?: string
}
```

`typeId` and `value` are intentionally absent from update requests.
`isSystem` is intentionally absent from create and update requests because it is
a read-only product ownership flag.

Management responses:

```ts
interface DictionaryTypeResponse {
  id: string
  code: string
  name: string
  status: 'ACTIVE' | 'DISABLED'
  isSystem: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

interface DictionaryTypeListResponse {
  items: DictionaryTypeResponse[]
  total: number
  page: number
  pageSize: number
}

interface DictionaryItemResponse {
  id: string
  typeId: string
  typeCode: string
  typeName: string
  value: string
  label: string
  sortOrder: number
  status: 'ACTIVE' | 'DISABLED'
  isSystem: boolean
  isDefault: boolean
  badgeVariant?: 'DEFAULT' | 'SUCCESS' | 'WARNING' | 'DANGER' | 'NEUTRAL'
  metadata?: Record<string, unknown>
  description?: string
  createdAt: string
  updatedAt: string
}

interface DictionaryItemListResponse {
  items: DictionaryItemResponse[]
  total: number
  page: number
  pageSize: number
}
```

Item management responses include `typeCode` and `typeName` so the item table
can render useful context when users search or filter across types.

Option response:

```ts
interface DictionaryOptionsResponse {
  typeCode: string
  items: DictionaryOption[]
}

interface DictionaryOption {
  value: string
  label: string
  badgeVariant?: 'DEFAULT' | 'SUCCESS' | 'WARNING' | 'DANGER' | 'NEUTRAL'
  isDefault: boolean
  metadata?: Record<string, unknown>
}
```

Multi-type option response:

```ts
interface DictionaryOptionsMapResponse {
  dictionaries: Record<string, DictionaryOption[]>
}
```

Unknown, disabled, or empty dictionary types should return an empty item list
for option endpoints instead of failing the whole request. This makes page
rendering resilient while still allowing the management UI to expose missing
configuration.

## Backend File Boundaries

Follow the standard resource layout:

```text
apps/api/src/dictionary/
  dto/
    dictionary-type.request.ts
    dictionary-type.response.ts
    dictionary-item.request.ts
    dictionary-item.response.ts
    dictionary-options.response.ts
  dictionary-type.mapper.ts
  dictionary-item.mapper.ts
  dictionary-options.mapper.ts
  dictionary-type.service.ts
  dictionary-item.service.ts
  dictionary-options.service.ts
  dictionary-type.controller.ts
  dictionary-item.controller.ts
  dictionary-options.controller.ts
  dictionary.module.ts
```

Responsibilities:

- Type and item services own validation, Prisma access, uniqueness handling,
  default-item transactions, and system-delete guards.
- Type deletion rejects system types and non-system types that still have items.
- Item deletion rejects system items.
- Item update rejects attempts to disable system items.
- Mappers convert Prisma records to response DTOs and keep controller methods
  from returning raw database records.
- Controllers expose route contracts and apply `@Roles(Role.ADMIN)` only to
  management endpoints.
- Option service returns only active type and active item data.
- Seed data initializes `user_role` with `ADMIN` and `STANDARD`.

Prisma errors:

- Duplicate `code` or duplicate `[typeId, value]` maps to `409`.
- Missing type or item maps to `404`.
- Deleting a system type maps to `400` or `409`; prefer `409` because the
  request conflicts with a protected resource state.
- Deleting a non-system type with existing items maps to `409`.
- Deleting a system item maps to `409`.
- Disabling a system item maps to `409`.

## Frontend File Boundaries

Management UI follows the existing feature pattern:

```text
apps/admin/src/features/dictionaries/
  dictionaries.types.ts
  dictionaries.api.ts
  dictionary-type.columns.tsx
  dictionary-item.columns.tsx
  DictionaryTypeForm.tsx
  DictionaryItemForm.tsx
  DictionariesPage.tsx
  DictionariesPage.test.tsx
```

Dictionary consumption helpers live outside the management feature:

```text
apps/admin/src/lib/dictionaries/
  dictionaries.api.ts
  dictionaries.types.ts
  useDictionary.ts
  dictionary-label.ts
```

Management page layout:

- Use one page with a master-detail layout.
- The left or top region lists dictionary types.
- Selecting a type filters the item table to that type.
- Type create/edit uses a modal form.
- Item create/edit uses a modal form scoped to the selected type.
- System types show a protected delete affordance: either hide the delete
  action or show it disabled with accessible explanatory text.

Consumption API:

```ts
useDictionary(typeCode)
useDictionaries(typeCodes)
getDictionaryOption(options, value)
getDictionaryLabel(options, value, fallback?)
```

The hook should use stable React Query keys:

```ts
['dictionaries', 'options', typeCode]
['dictionaries', 'options', typeCodes]
```

The implementation should normalize `typeCodes` order for multi-type queries so
equivalent requests share a cache entry.

## User Role Integration

The first integration target is user role display.

Keep these code-level constraints:

- Prisma `Role` enum remains the source of truth for authorization.
- Backend guards and decorators continue to check `Role.ADMIN`.
- User create/update DTOs still validate against the backend enum.

Use dictionaries for UI concerns:

- `UserForm` role select options.
- `UsersPage` role filter options.
- User table role label rendering.

Seed the `user_role` dictionary:

```text
code: user_role
name: User role
isSystem: true

items:
  ADMIN    -> Admin
  STANDARD -> Standard
```

The seed should set `isSystem = true` on both the `user_role` type and its
seeded role items. Role item management rules:

- Admins may edit labels, sort order, badge variant, default flag, metadata,
  and description for seeded role items.
- Admins may not delete seeded role items.
- Admins may not disable seeded role items.
- Admins may not create additional active `user_role` values unless the backend
  `Role` enum and user DTO validation are updated in the same feature.

The frontend can still fall back to local i18n labels if the dictionary request
fails, but the normal path should come from the dictionary option endpoint.
When rendering role options, the frontend should also guard against dictionary
drift by accepting only values from the local `Role` union. If a seeded role is
missing from the option response, merge in the local fallback option so create
and edit forms remain usable.

## Caching And Freshness

Backend caching is optional in v1. PostgreSQL queries for small option sets are
acceptable until usage shows a need for Redis-backed caching.

Frontend React Query should cache dictionary options with a longer stale time
than normal table lists because dictionaries change infrequently. Management
mutations should invalidate:

- the affected type list or item list query;
- the affected option query;
- the multi-type option query family when simple targeted invalidation is not
  practical.

## Validation Rules

Recommended input constraints:

- `code`: lowercase letters, numbers, and underscores; 2-80 characters.
- `name`: 1-120 characters.
- `value`: non-empty string, 1-120 characters; preserve case because enum
  values like `ADMIN` are common.
- `label`: 1-120 characters.
- `badgeVariant`: optional enum value, one of `DEFAULT`, `SUCCESS`, `WARNING`,
  `DANGER`, or `NEUTRAL`.
- `description`: up to 500 characters.
- `metadata`: JSON plain object only; arrays, strings, numbers, booleans, and
  null are rejected.

## Testing

Backend unit tests:

- list defaults and pagination;
- rejected invalid sort fields and sort directions;
- search and filter mapping;
- `findMany` and `count` use the same `where` object for paginated list
  endpoints;
- duplicate type code returns `409`;
- duplicate item value within a type returns `409`;
- missing type or item returns `404`;
- system type deletion is rejected;
- type deletion with existing items is rejected;
- system item deletion is rejected;
- system item disabling is rejected;
- disabled type and disabled item are omitted from options;
- default item updates clear the previous default in the same type;
- option endpoints parse, validate, de-duplicate, and cap multi-type requests;
- option endpoints return requested unknown, disabled, or empty types as empty
  arrays;
- option endpoints sort items by `sortOrder:asc` and then `value:asc`;
- mappers return only public DTO fields.

Backend flow or controller tests:

- standard users cannot access management endpoints;
- admins can access management endpoints;
- authenticated users can access option endpoints;
- unauthenticated users cannot access option endpoints;
- delete returns `204` for successful deletions.

Frontend tests:

- management page loads type list and item list;
- selecting a type filters item queries;
- type and item search, sort, and filter changes send the expected query params;
- create/edit forms validate required fields;
- system type delete action is protected;
- delete confirmation is shown before destructive actions;
- mutation success closes the form and refetches affected queries;
- list loading, error, retry, and empty states render correctly;
- dictionary option hooks handle loading, success, empty, and error states;
- multi-type dictionary hook normalizes query keys for equivalent type sets;
- user role select/filter/table label can render from dictionary options;
- user role rendering filters out dictionary values outside the local `Role`
  union and merges fallback options for missing seeded roles.

## Risks

- Editable dictionaries can imply business configurability that the backend does
  not support. Keep code-critical values such as roles validated by code enums.
- Dictionary label localization is not solved by this v1. The current project
  supports English and Chinese UI copy, but dictionary labels are stored as one
  value. Add localized labels later only when needed.
- Arbitrary colors can produce inconsistent UI. The v1 model uses a constrained
  badge variant field instead of free-form color values.
- Option endpoint failures can degrade many pages. Consumers should support a
  fallback label or an empty option state.
- A master-detail management page is more ergonomic than two unrelated pages,
  but it needs careful responsive layout so tables and forms remain usable on
  smaller screens.

## Non-Goals

- Generating CRUD pages from dictionary metadata.
- Letting admins create new authorization roles at runtime.
- Replacing Prisma enums that protect code paths.
- Supporting unauthenticated public dictionaries.
- Using dictionaries as general application configuration storage.
