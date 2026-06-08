# Admin Dictionaries Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement admin-managed dictionaries for enum-like UI options, including type/item CRUD, option endpoints, frontend dictionary helpers, a dictionary management page, and user-role UI integration.

**Architecture:** Add `DictionaryType` and `DictionaryItem` to Prisma, expose admin-only CRUD endpoints through a new NestJS dictionary module, and expose authenticated read-only option endpoints for frontend consumers. On the admin frontend, add dictionary API/hooks first, then build a master-detail management page and finally wire user role select/filter/table labels through the dictionary helper while keeping backend role authorization tied to the existing `Role` enum.

**Tech Stack:** NestJS, Prisma, PostgreSQL, class-validator, Swagger, Jest, React, Vite, TypeScript, TanStack Query, Axios, react-hook-form, zod, Vitest, React Testing Library, Tailwind CSS.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-08-admin-dictionaries-design.md`
- CRUD pattern guide: `docs/patterns/admin-crud-table-pattern-guide.md`
- Reference backend resource: `apps/api/src/user/`
- Reference frontend resource: `apps/admin/src/features/users/`

## File Structure

### Backend

- Modify `apps/api/prisma/schema.prisma`: add `DictionaryType`, `DictionaryItem`, `DictionaryStatus`, and `DictionaryBadgeVariant`.
- Modify `apps/api/prisma/seed.ts`: seed system `user_role` type and system `ADMIN` / `STANDARD` items.
- Modify generated Prisma artifacts through `pnpm --filter api db:generate` after schema changes.
- Create `apps/api/src/dictionary/dto/dictionary-type.request.ts`: list/create/update DTOs for dictionary types.
- Create `apps/api/src/dictionary/dto/dictionary-type.response.ts`: type response and list response DTOs.
- Create `apps/api/src/dictionary/dto/dictionary-item.request.ts`: list/create/update DTOs for dictionary items.
- Create `apps/api/src/dictionary/dto/dictionary-item.response.ts`: item response and list response DTOs.
- Create `apps/api/src/dictionary/dto/dictionary-options.request.ts`: multi-type option query DTO.
- Create `apps/api/src/dictionary/dto/dictionary-options.response.ts`: single and multi-type option response DTOs.
- Create `apps/api/src/dictionary/dictionary-type.mapper.ts`: map Prisma type records to type responses.
- Create `apps/api/src/dictionary/dictionary-item.mapper.ts`: map Prisma item records with type context to item responses.
- Create `apps/api/src/dictionary/dictionary-options.mapper.ts`: map active items to compact option responses.
- Create `apps/api/src/dictionary/dictionary-type.service.ts`: list/detail/create/update/delete dictionary types.
- Create `apps/api/src/dictionary/dictionary-item.service.ts`: list/detail/create/update/delete dictionary items.
- Create `apps/api/src/dictionary/dictionary-options.service.ts`: single and multi-type option loading.
- Create `apps/api/src/dictionary/dictionary-type.controller.ts`: admin type CRUD routes.
- Create `apps/api/src/dictionary/dictionary-item.controller.ts`: admin item CRUD routes.
- Create `apps/api/src/dictionary/dictionary-options.controller.ts`: authenticated option routes.
- Create `apps/api/src/dictionary/dictionary.module.ts`: module wiring for controllers and services.
- Modify `apps/api/src/app.module.ts`: import `DictionaryModule`.
- Create `apps/api/src/dictionary/dictionary-type.service.spec.ts`: type DTO/service/mapper tests.
- Create `apps/api/src/dictionary/dictionary-item.service.spec.ts`: item DTO/service/mapper tests.
- Create `apps/api/src/dictionary/dictionary-options.service.spec.ts`: option query/service/mapper tests.
- Modify `apps/api/src/auth/auth-flow.spec.ts` or add a focused controller flow test if the existing auth flow pattern is easier to extend.

### Frontend

- Modify `apps/admin/src/lib/api.ts`: add dictionary management and option methods to `createApiClient`.
- Modify `apps/admin/src/lib/api.test.ts`: cover dictionary API paths, params, auth headers, and unauthorized handling.
- Create `apps/admin/src/lib/dictionaries/dictionaries.types.ts`: shared option response and helper types.
- Create `apps/admin/src/lib/dictionaries/dictionaries.api.ts`: frontend functions for option endpoints.
- Create `apps/admin/src/lib/dictionaries/useDictionary.ts`: `useDictionary()` and `useDictionaries()` hooks.
- Create `apps/admin/src/lib/dictionaries/dictionary-label.ts`: lookup, fallback, role-safe filtering helpers.
- Create `apps/admin/src/lib/dictionaries/dictionary-label.test.ts`: lookup/fallback/role filtering tests.
- Create `apps/admin/src/lib/dictionaries/useDictionary.test.tsx`: hook query-key and state tests.
- Create `apps/admin/src/features/dictionaries/dictionaries.types.ts`: management request/response/list query types.
- Create `apps/admin/src/features/dictionaries/dictionaries.api.ts`: type/item CRUD API functions.
- Create `apps/admin/src/features/dictionaries/dictionary-type.columns.tsx`: dictionary type table columns and actions.
- Create `apps/admin/src/features/dictionaries/dictionary-item.columns.tsx`: dictionary item table columns and actions.
- Create `apps/admin/src/features/dictionaries/DictionaryTypeForm.tsx`: create/edit form for types.
- Create `apps/admin/src/features/dictionaries/DictionaryItemForm.tsx`: create/edit form for items.
- Create `apps/admin/src/features/dictionaries/DictionariesPage.tsx`: master-detail management page.
- Create `apps/admin/src/features/dictionaries/DictionariesPage.test.tsx`: management page tests.
- Modify `apps/admin/src/features/users/UserForm.tsx`: load role options from dictionaries with fallback.
- Modify `apps/admin/src/features/users/UsersPage.tsx`: load role filter options from dictionaries with fallback.
- Modify `apps/admin/src/features/users/users.columns.tsx`: render role labels from dictionary options.
- Modify `apps/admin/src/features/users/UsersPage.test.tsx`: update mocks and add dictionary-backed role behavior tests.
- Modify `apps/admin/src/i18n/messages.ts`: add dictionary management UI copy.
- Modify `apps/admin/src/lib/route-guard.ts`: add `/dictionaries` to protected routes.
- Modify `apps/admin/src/lib/route-guard.test.ts`: cover authenticated and anonymous `/dictionaries` routing.
- Modify `apps/admin/src/lib/navigation.ts`, `apps/admin/src/layouts/AdminShell.tsx`, and/or `apps/admin/src/AppContent.tsx`: add the Dictionaries navigation route following the current routing pattern.

## Chunk 1: Backend Data Model, DTOs, And Mappers

### Task 1: Add Prisma Models And Seed Data

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Write the expected Prisma model changes in `schema.prisma`**

Add the enums and models from the spec. Keep the relation non-cascading for v1 so type deletion with existing items can be rejected by service logic.

```prisma
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

model DictionaryType {
  id          String           @id @default(uuid())
  code        String           @unique @db.VarChar(80)
  name        String           @db.VarChar(120)
  status      DictionaryStatus @default(ACTIVE)
  isSystem    Boolean          @default(false)
  description String?          @db.VarChar(500)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  items       DictionaryItem[]
}

model DictionaryItem {
  id           String                    @id @default(uuid())
  typeId       String
  value        String                    @db.VarChar(120)
  label        String                    @db.VarChar(120)
  sortOrder    Int                       @default(0)
  status       DictionaryStatus          @default(ACTIVE)
  isSystem     Boolean                   @default(false)
  isDefault    Boolean                   @default(false)
  badgeVariant DictionaryBadgeVariant?
  metadata     Json?
  description  String?                   @db.VarChar(500)
  createdAt    DateTime                  @default(now())
  updatedAt    DateTime                  @updatedAt

  type         DictionaryType            @relation(fields: [typeId], references: [id])

  @@unique([typeId, value])
  @@index([typeId, sortOrder])
}
```

- [ ] **Step 2: Generate a migration and Prisma client**

Run:

```bash
pnpm --filter api db:migrate -- --name add_dictionaries
pnpm --filter api db:generate
```

Expected: Prisma creates a migration under `apps/api/prisma/migrations/` and regenerates the client before seed code references new generated Prisma types.

- [ ] **Step 3: Update the seed**

Extend `apps/api/prisma/seed.ts` after the admin user seed:

```ts
const userRoleType = await prisma.dictionaryType.upsert({
  where: { code: 'user_role' },
  update: {
    name: 'User role',
    status: 'ACTIVE',
    isSystem: true,
  },
  create: {
    code: 'user_role',
    name: 'User role',
    status: 'ACTIVE',
    isSystem: true,
  },
});

await prisma.dictionaryItem.upsert({
  where: {
    typeId_value: {
      typeId: userRoleType.id,
      value: Role.ADMIN,
    },
  },
  update: {
    label: 'Admin',
    sortOrder: 10,
    status: 'ACTIVE',
    isSystem: true,
    badgeVariant: 'DANGER',
  },
  create: {
    typeId: userRoleType.id,
    value: Role.ADMIN,
    label: 'Admin',
    sortOrder: 10,
    status: 'ACTIVE',
    isSystem: true,
    badgeVariant: 'DANGER',
  },
});
```

Repeat for `Role.STANDARD` with label `Standard`, sort order `20`, and badge variant `NEUTRAL`.

- [ ] **Step 4: Verify Prisma generation, seed type references, and smoke tests**

Run:

```bash
pnpm --filter api db:generate
pnpm --filter api exec tsc --noEmit --skipLibCheck --module nodenext --moduleResolution nodenext prisma/seed.ts
pnpm --filter api test -- main.spec.ts
```

Expected: Prisma client generation succeeds, the seed script type-checks against the generated client, and the existing smoke test passes.

If a local database is available, also run:

```bash
pnpm --filter api db:seed
```

Expected: seed completes and upserts the admin user plus `user_role` dictionary records. If no local database is available, do not fake this step. Record that `db:seed` execution is blocked by database availability and continue only after making that blocker explicit in the implementation notes.

### Task 2: Add Dictionary DTOs And Mappers

**Files:**
- Create: `apps/api/src/dictionary/dto/dictionary-type.request.ts`
- Create: `apps/api/src/dictionary/dto/dictionary-type.response.ts`
- Create: `apps/api/src/dictionary/dto/dictionary-item.request.ts`
- Create: `apps/api/src/dictionary/dto/dictionary-item.response.ts`
- Create: `apps/api/src/dictionary/dto/dictionary-options.request.ts`
- Create: `apps/api/src/dictionary/dto/dictionary-options.response.ts`
- Create: `apps/api/src/dictionary/dictionary-type.mapper.ts`
- Create: `apps/api/src/dictionary/dictionary-item.mapper.ts`
- Create: `apps/api/src/dictionary/dictionary-options.mapper.ts`
- Create: `apps/api/src/dictionary/dictionary-type.service.spec.ts`
- Create: `apps/api/src/dictionary/dictionary-item.service.spec.ts`
- Create: `apps/api/src/dictionary/dictionary-options.service.spec.ts`

- [ ] **Step 1: Write failing DTO and mapper tests**

Create focused tests that use `ValidationPipe` like `apps/api/src/user/user.service.spec.ts`.

Cover:

- `DictionaryTypeListQueryDto` defaults page/pageSize and validates `status` and `isSystem`.
- type sort rejects `id:asc` and accepts `code:asc`.
- create type rejects invalid `code` such as `User Role` and accepts `user_role`.
- create/update type reject non-whitelisted `isSystem`.
- `DictionaryItemListQueryDto` validates `typeId`, `typeCode`, `status`, and `isDefault`.
- item sort rejects `typeId:asc` and accepts `sortOrder:asc`.
- create item rejects scalar/array/null `metadata`.
- create item validates `badgeVariant`.
- options query rejects missing `types`, empty entries, invalid codes, and more than 30 codes.
- type mapper returns ISO timestamps and includes read-only `isSystem`.
- item mapper includes `typeCode` and `typeName`.
- option mapper emits only compact fields.

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter api test -- dictionary-type.service.spec.ts dictionary-item.service.spec.ts dictionary-options.service.spec.ts
```

Expected: FAIL because dictionary DTOs and mappers do not exist.

- [ ] **Step 3: Implement request DTOs**

Use class-validator and Swagger decorators. Match these constraints:

- `code`: `/^[a-z0-9_]{2,80}$/`
- `name`: string, 1-120 chars
- `value`: string, 1-120 chars
- `label`: string, 1-120 chars
- `description`: optional string, max 500 chars
- `badgeVariant`: optional `DictionaryBadgeVariant`
- `metadata`: optional plain object only
- `isSystem`: absent from create/update DTOs

For `metadata`, add a small custom validator or focused helper if class-validator cannot express "plain object, not array, not null" cleanly.

- [ ] **Step 4: Implement response DTOs**

Response classes must match the spec:

- `DictionaryTypeResponseDto`
- `DictionaryTypeListResponseDto`
- `DictionaryItemResponseDto`
- `DictionaryItemListResponseDto`
- `DictionaryOptionsResponseDto`
- `DictionaryOptionsMapResponseDto`

Use `ListResponse<T>` from `apps/api/src/common/dto/list-response.dto.ts`.

- [ ] **Step 5: Implement mappers**

Mappers should be pure functions:

```ts
export function toDictionaryTypeResponse(type: DictionaryType): DictionaryTypeResponseDto
export function toDictionaryItemResponse(item: DictionaryItemWithType): DictionaryItemResponseDto
export function toDictionaryOption(item: DictionaryItem): DictionaryOptionDto
```

Convert dates with `.toISOString()` and never return raw Prisma objects directly from controllers.

- [ ] **Step 6: Re-run focused tests**

Run:

```bash
pnpm --filter api test -- dictionary-type.service.spec.ts dictionary-item.service.spec.ts dictionary-options.service.spec.ts
```

Expected: DTO and mapper tests pass. Service tests that reference unimplemented services may still fail until Chunk 2 if they were added in the same files; keep failures clearly limited to missing services.

- [ ] **Step 7: Commit Chunk 1**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/seed.ts apps/api/prisma/migrations apps/api/src/dictionary
git commit -m "feat(api): add dictionary schema and dto contracts"
```

## Chunk 2: Backend Services, Controllers, And Module Wiring

### Task 3: Implement Dictionary Type Service And Controller

**Files:**
- Create: `apps/api/src/dictionary/dictionary-type.service.ts`
- Create: `apps/api/src/dictionary/dictionary-type.controller.ts`
- Continue: `apps/api/src/dictionary/dictionary-type.service.spec.ts`

- [ ] **Step 1: Add failing service tests**

Cover:

- list applies pagination, default sort `createdAt:desc`, search over `code`, `name`, `description`, and filters `status` / `isSystem`.
- list passes the same `where` object to `findMany` and `count`.
- invalid sort field/direction throws `BadRequestException`.
- create maps duplicate `code` (`P2002`) to `ConflictException`.
- find/update/delete missing type (`P2025` or null find) maps to `NotFoundException`.
- update cannot change `code` or `isSystem` because DTO does not contain those fields.
- delete rejects `isSystem = true` with `ConflictException`.
- delete rejects non-system types that still have items with `ConflictException`.
- successful delete calls Prisma delete and controller returns `204`.

- [ ] **Step 2: Run failing type service tests**

Run:

```bash
pnpm --filter api test -- dictionary-type.service.spec.ts
```

Expected: FAIL because the type service/controller do not exist.

- [ ] **Step 3: Implement `DictionaryTypeService`**

Follow `UserService` patterns:

- `listTypes(query)`
- `findById(id)`
- `createType(dto)`
- `updateType(id, dto)`
- `deleteType(id)`
- private `parseSort()`
- private `buildWhere()`
- private `handlePrismaWriteError()`

Deletion must first load the type with item count or run a count by `typeId`; reject system types and types with existing items before deleting.

- [ ] **Step 4: Implement `DictionaryTypeController`**

Routes:

```text
GET    /dictionary-types
GET    /dictionary-types/:id
POST   /dictionary-types
PATCH  /dictionary-types/:id
DELETE /dictionary-types/:id
```

Apply `@Roles(Role.ADMIN)` to every method and use Swagger response decorators. Use `@HttpCode(204)` for delete.

- [ ] **Step 5: Re-run type service tests**

Run:

```bash
pnpm --filter api test -- dictionary-type.service.spec.ts
```

Expected: PASS.

### Task 4: Implement Dictionary Item Service And Controller

**Files:**
- Create: `apps/api/src/dictionary/dictionary-item.service.ts`
- Create: `apps/api/src/dictionary/dictionary-item.controller.ts`
- Continue: `apps/api/src/dictionary/dictionary-item.service.spec.ts`

- [ ] **Step 1: Add failing item service tests**

Cover:

- list applies pagination, default sort `sortOrder:asc`, stable filtering by `typeId`, `typeCode`, `status`, and `isDefault`.
- list search covers `value`, `label`, and `description`.
- list passes the same `where` object to `findMany` and `count`.
- invalid sort field/direction throws `BadRequestException`.
- create maps missing type to `NotFoundException`.
- create maps duplicate `[typeId, value]` to `ConflictException`.
- create rejects any item under `type.code === 'user_role'` when `value` is not one of the backend `Role` enum values, regardless of requested status.
- setting `isDefault = true` clears previous defaults for that type in the same transaction.
- update system item cannot set `status = DISABLED`.
- update rejects enabling a legacy or drifted `user_role` item whose value is not one of the backend `Role` enum values.
- update system item may edit `label`, `sortOrder`, `badgeVariant`, `isDefault`, `metadata`, and `description`.
- delete system item is rejected with `ConflictException`.
- missing item maps to `NotFoundException`.

- [ ] **Step 2: Run failing item service tests**

Run:

```bash
pnpm --filter api test -- dictionary-item.service.spec.ts
```

Expected: FAIL because the item service/controller do not exist.

- [ ] **Step 3: Implement `DictionaryItemService`**

Follow the same shape as `UserService`, but use Prisma transactions for default handling:

```ts
if (dto.isDefault) {
  const [, item] = await this.prisma.$transaction([
    this.prisma.dictionaryItem.updateMany({
      where: { typeId, isDefault: true },
      data: { isDefault: false },
    }),
    this.prisma.dictionaryItem.create({
      data,
      include: { type: true },
    }),
  ]);
}
```

For create and update, return records with `include: { type: true }` or re-fetch with type context before mapping, because item responses include `typeCode` and `typeName`.

For `user_role` values, load the target dictionary type and enforce that item values are members of the backend `Role` enum. Reject any attempt to create `user_role` item values outside `Role`, and reject attempts to enable drifted invalid role values. This keeps dictionary data from creating runtime roles.

For update, load the existing item first so the service can reject disabling system items and know the current `typeId` for default clearing.

- [ ] **Step 4: Implement `DictionaryItemController`**

Routes:

```text
GET    /dictionary-items
GET    /dictionary-items/:id
POST   /dictionary-items
PATCH  /dictionary-items/:id
DELETE /dictionary-items/:id
```

Apply `@Roles(Role.ADMIN)` to every method and use `@HttpCode(204)` for delete.

- [ ] **Step 5: Re-run item service tests**

Run:

```bash
pnpm --filter api test -- dictionary-item.service.spec.ts
```

Expected: PASS.

### Task 5: Implement Option Service, Controllers, And Module Wiring

**Files:**
- Create: `apps/api/src/dictionary/dictionary-options.service.ts`
- Create: `apps/api/src/dictionary/dictionary-options.controller.ts`
- Create: `apps/api/src/dictionary/dictionary.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Continue: `apps/api/src/dictionary/dictionary-options.service.spec.ts`
- Modify: `apps/api/src/auth/auth-flow.spec.ts`

- [ ] **Step 1: Add failing option service tests**

Cover:

- single type returns `{ typeCode, items: [] }` for unknown, disabled, or empty types.
- single type returns only active items for active type.
- multi-type query de-duplicates codes while preserving first-seen order.
- multi-type response includes every requested code.
- multi-type query rejects missing `types`, invalid codes, empty entries, and more than 30 codes.
- option items sort by `sortOrder:asc`, then `value:asc`.

- [ ] **Step 2: Add failing auth/controller flow tests**

Use the existing auth flow style. Cover:

- standard users cannot access `GET /dictionary-types`.
- admins can access `GET /dictionary-types`.
- authenticated standard users can access `GET /dictionaries/user_role/options`.
- unauthenticated users cannot access option endpoints.
- successful management delete returns `204`.

- [ ] **Step 3: Run failing tests**

Run:

```bash
pnpm --filter api test -- dictionary-options.service.spec.ts auth-flow.spec.ts
```

Expected: FAIL because option service/controller/module wiring is missing.

- [ ] **Step 4: Implement `DictionaryOptionsService`**

Implement:

```ts
getOptions(typeCode: string): Promise<DictionaryOptionsResponseDto>
getOptionsMap(typeCodes: string[]): Promise<DictionaryOptionsMapResponseDto>
```

Query only active types and active items. Return empty arrays for requested codes that are unknown, disabled, or empty.

- [ ] **Step 5: Implement `DictionaryOptionsController`**

Routes:

```text
GET /dictionaries/:typeCode/options
GET /dictionaries/options?types=user_role,common_status
```

Do not mark these routes public. They should be authenticated by the existing global/default auth behavior.

- [ ] **Step 6: Wire `DictionaryModule`**

Create the module with all dictionary controllers and services. Import `PrismaModule` in `DictionaryModule` even though the current Prisma module is global, so module-level tests and future refactors have an explicit dependency. Then import `DictionaryModule` in `apps/api/src/app.module.ts`.

- [ ] **Step 7: Re-run backend focused tests**

Run:

```bash
pnpm --filter api test -- dictionary-type.service.spec.ts dictionary-item.service.spec.ts dictionary-options.service.spec.ts auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Chunk 2**

```bash
git add apps/api/src/dictionary apps/api/src/app.module.ts apps/api/src/auth/auth-flow.spec.ts
git commit -m "feat(api): add dictionary services and routes"
```

## Chunk 3: Frontend Dictionary API And Consumption Helpers

### Task 6: Add API Client Methods And Dictionary Hooks

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/api.test.ts`
- Create: `apps/admin/src/lib/dictionaries/dictionaries.types.ts`
- Create: `apps/admin/src/lib/dictionaries/dictionaries.api.ts`
- Create: `apps/admin/src/lib/dictionaries/useDictionary.ts`
- Create: `apps/admin/src/lib/dictionaries/dictionary-label.ts`
- Create: `apps/admin/src/lib/dictionaries/dictionary-label.test.ts`
- Create: `apps/admin/src/lib/dictionaries/useDictionary.test.tsx`

- [ ] **Step 1: Write failing API client tests**

In `apps/admin/src/lib/api.test.ts`, add tests for:

- `api.dictionaries.options('user_role')` calls `GET /dictionaries/user_role/options` with auth header.
- `api.dictionaries.optionsMap(['common_status', 'user_role'])` calls `GET /dictionaries/options` with params `{ types: 'common_status,user_role' }`.
- dictionary management list/create/update/delete methods use correct URLs and auth headers.
- unauthorized dictionary requests call `onUnauthorized`.

- [ ] **Step 2: Write failing helper tests**

In `dictionary-label.test.ts`, cover:

```ts
getDictionaryLabel(options, 'ADMIN', 'ADMIN') === 'Admin'
getDictionaryLabel(options, 'MISSING', 'MISSING') === 'MISSING'
filterRoleOptions(options) removes values outside 'ADMIN' | 'STANDARD'
mergeRoleFallbackOptions(options) restores missing ADMIN/STANDARD fallback options
```

- [ ] **Step 3: Write failing hook tests**

In `useDictionary.test.tsx`, render hooks inside `QueryClientProvider` and mock `dictionaries.api.ts`.

Cover:

- `useDictionary('user_role')` exposes loading and success states.
- `useDictionaries(['user_role', 'common_status'])` normalizes query keys so equivalent type sets share a cache entry.
- empty option response returns an empty array instead of throwing.

- [ ] **Step 4: Run failing frontend tests**

Run:

```bash
pnpm --filter admin test -- src/lib/api.test.ts src/lib/dictionaries/dictionary-label.test.ts src/lib/dictionaries/useDictionary.test.tsx
```

Expected: FAIL because dictionary API/helper files do not exist.

- [ ] **Step 5: Implement shared dictionary types**

Create types for:

```ts
export type DictionaryBadgeVariant = 'DEFAULT' | 'SUCCESS' | 'WARNING' | 'DANGER' | 'NEUTRAL'
export interface DictionaryOption { value: string; label: string; badgeVariant?: DictionaryBadgeVariant; isDefault: boolean; metadata?: Record<string, unknown> }
export interface DictionaryOptionsResponse { typeCode: string; items: DictionaryOption[] }
export interface DictionaryOptionsMapResponse { dictionaries: Record<string, DictionaryOption[]> }
```

- [ ] **Step 6: Extend `createApiClient`**

Add:

```ts
dictionaries: {
  options(typeCode: string): Promise<DictionaryOptionsResponse>
  optionsMap(typeCodes: string[]): Promise<DictionaryOptionsMapResponse>
  types: { list, get, create, update, delete }
  items: { list, get, create, update, delete }
}
```

Use existing `authenticatedConfig()` and Axios `params`.

- [ ] **Step 7: Implement dictionary API functions**

Create `apps/admin/src/lib/dictionaries/dictionaries.api.ts` as a thin wrapper around the shared API client, following `apps/admin/src/features/users/users.api.ts`.

- [ ] **Step 8: Implement hooks and helper functions**

Use React Query keys:

```ts
['dictionaries', 'options', typeCode]
['dictionaries', 'options', normalizedTypeCodes]
```

Set a longer `staleTime` than table queries, for example 5 minutes.

- [ ] **Step 9: Re-run frontend focused tests**

Run:

```bash
pnpm --filter admin test -- src/lib/api.test.ts src/lib/dictionaries/dictionary-label.test.ts src/lib/dictionaries/useDictionary.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit Chunk 3**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/lib/api.test.ts apps/admin/src/lib/dictionaries
git commit -m "feat(admin): add dictionary option helpers"
```

## Chunk 4: Frontend Dictionary Management Page

### Task 7: Add Dictionary Management Types, API, Forms, Tables, And Route

**Files:**
- Create: `apps/admin/src/features/dictionaries/dictionaries.types.ts`
- Create: `apps/admin/src/features/dictionaries/dictionaries.api.ts`
- Create: `apps/admin/src/features/dictionaries/dictionary-type.columns.tsx`
- Create: `apps/admin/src/features/dictionaries/dictionary-item.columns.tsx`
- Create: `apps/admin/src/features/dictionaries/DictionaryTypeForm.tsx`
- Create: `apps/admin/src/features/dictionaries/DictionaryItemForm.tsx`
- Create: `apps/admin/src/features/dictionaries/DictionariesPage.tsx`
- Create: `apps/admin/src/features/dictionaries/DictionariesPage.test.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`
- Modify: `apps/admin/src/lib/route-guard.ts`
- Modify: `apps/admin/src/lib/route-guard.test.ts`
- Modify: `apps/admin/src/lib/navigation.ts`
- Modify: `apps/admin/src/layouts/AdminShell.tsx`
- Modify: `apps/admin/src/AppContent.tsx`

- [ ] **Step 1: Write failing management page tests**

Mock `features/dictionaries/dictionaries.api.ts` and cover:

- loading state for type list.
- empty state for type list.
- returned type rows render `code`, `name`, `status`, and `isSystem`.
- selecting a type queries items by `typeId`.
- item table renders `value`, `label`, `sortOrder`, `status`, `isDefault`, and `badgeVariant`.
- type create form validates required `code` and `name`.
- item create form validates required `value` and `label`.
- system type delete action is hidden or disabled.
- system item delete action is hidden or disabled.
- delete confirmation appears before destructive actions.
- create/update/delete success invalidates and refetches affected queries.
- list error state renders retry.
- authenticated users can visit `/dictionaries`.
- anonymous users visiting `/dictionaries` are redirected to `/login`.

- [ ] **Step 2: Run failing management page tests**

Run:

```bash
pnpm --filter admin test -- src/features/dictionaries/DictionariesPage.test.tsx src/lib/route-guard.test.ts
```

Expected: FAIL because the dictionaries feature does not exist.

- [ ] **Step 3: Implement management types and API functions**

Mirror `apps/admin/src/features/users/users.types.ts` and `users.api.ts`.

Types should include:

- `DictionaryStatus`
- `DictionaryBadgeVariant`
- `DictionaryTypeRecord`
- `DictionaryItemRecord`
- `DictionaryTypeListQuery`
- `DictionaryItemListQuery`
- create/update request types for both resources

- [ ] **Step 4: Implement table columns**

Keep columns small and action callbacks external, following `users.columns.tsx`.

Recommended type columns:

- code
- name
- status
- system
- updatedAt
- actions

Recommended item columns:

- value
- label
- sortOrder
- status
- default
- badgeVariant
- updatedAt
- actions

- [ ] **Step 5: Implement forms**

Use `react-hook-form`, `zod`, and existing form styling from `UserForm`.

Do not include `isSystem` in create/edit forms. For item form, use a select for `badgeVariant` and checkbox for `isDefault`.

- [ ] **Step 6: Implement `DictionariesPage`**

Use a master-detail layout:

- type table at top or left depending on available space.
- selected type state.
- item table filtered by selected `typeId`.
- create/edit modal for types.
- create/edit modal for items scoped to selected type.
- delete confirmation modals.
- toast success/error messages.

Use existing `DataTable`, `DataTableToolbar`, and `useServerTableQuery`.

- [ ] **Step 7: Add navigation and route rendering**

Follow existing routing conventions in `AppContent`, `AdminShell`, `lib/navigation`, and `lib/route-guard`.

Add `/dictionaries` to `protectedPaths` in `apps/admin/src/lib/route-guard.ts` before wiring the nav item, otherwise authenticated users will be redirected back to `/dashboard`.

Add i18n keys for:

- navigation label
- page title
- column labels
- form labels
- validation messages
- action labels
- success/error toasts
- empty/loading/retry labels

- [ ] **Step 8: Re-run management page tests**

Run:

```bash
pnpm --filter admin test -- src/features/dictionaries/DictionariesPage.test.tsx src/lib/route-guard.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Chunk 4**

```bash
git add apps/admin/src/features/dictionaries apps/admin/src/i18n/messages.ts apps/admin/src/lib/navigation.ts apps/admin/src/lib/route-guard.ts apps/admin/src/lib/route-guard.test.ts apps/admin/src/layouts/AdminShell.tsx apps/admin/src/AppContent.tsx
git commit -m "feat(admin): add dictionary management page"
```

## Chunk 5: User Role Dictionary Integration And Full Verification

### Task 8: Wire User Role UI To Dictionary Options

**Files:**
- Modify: `apps/admin/src/features/users/UserForm.tsx`
- Modify: `apps/admin/src/features/users/UsersPage.tsx`
- Modify: `apps/admin/src/features/users/users.columns.tsx`
- Modify: `apps/admin/src/features/users/UsersPage.test.tsx`

- [ ] **Step 1: Update failing user page tests**

Add or update tests so they mock dictionary helpers and cover:

- role select renders dictionary labels for `ADMIN` and `STANDARD`.
- role filter renders dictionary labels and keeps the existing `All` option.
- table role cell renders dictionary label.
- dictionary value outside local `Role` union, such as `MANAGER`, is not rendered in role select/filter.
- missing seeded role options are restored from local fallback labels.
- when dictionary loading fails, user create/edit flows remain usable.

- [ ] **Step 2: Run failing user tests**

Run:

```bash
pnpm --filter admin test -- src/features/users/UsersPage.test.tsx
```

Expected: FAIL because users still render hard-coded role options.

- [ ] **Step 3: Update `users.columns.tsx`**

Change column labels so role rendering receives a dictionary-derived label map or a `formatRole(role)` callback instead of hard-coded i18n-only labels.

- [ ] **Step 4: Update `UserForm.tsx`**

Replace the local hard-coded role `<option>` list with role-safe dictionary options:

- load options in the parent and pass them into the form; or
- call the hook inside the form if test setup remains simple.

Prefer passing options from `UsersPage` so list filter, table rendering, and form share one option source.

- [ ] **Step 5: Update `UsersPage.tsx`**

Load `user_role` with `useDictionary('user_role')`. Use helper functions to:

- filter to `Role` union values;
- merge local fallback options for missing `ADMIN` or `STANDARD`;
- render role select, role filter, and role column labels.

Keep backend queries unchanged: the `role` filter must still send `'ADMIN'` or `'STANDARD'`.

- [ ] **Step 6: Re-run user page tests**

Run:

```bash
pnpm --filter admin test -- src/features/users/UsersPage.test.tsx
```

Expected: PASS.

### Task 9: Full Verification

**Files:**
- All files touched in prior chunks.

- [ ] **Step 1: Run backend unit tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 2: Run backend build and lint**

Run:

```bash
pnpm --filter api build
pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
pnpm --filter admin test
```

Expected: PASS.

- [ ] **Step 4: Run frontend build and lint**

Run:

```bash
pnpm --filter admin build
pnpm --filter admin lint
```

Expected: PASS.

- [ ] **Step 5: Run whole-workspace verification**

Run:

```bash
pnpm test
pnpm build
pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit Chunk 5**

```bash
git add apps/admin/src/features/users apps/admin/src/lib/dictionaries apps/admin/src/features/dictionaries apps/api/src/dictionary apps/api/prisma apps/api/src/app.module.ts apps/api/src/auth/auth-flow.spec.ts apps/admin/src/i18n/messages.ts apps/admin/src/lib/navigation.ts apps/admin/src/lib/route-guard.ts apps/admin/src/lib/route-guard.test.ts apps/admin/src/layouts/AdminShell.tsx apps/admin/src/AppContent.tsx
git commit -m "feat: integrate dictionaries into admin"
```

## Implementation Notes

- Use TDD for each task: write focused failing tests, run them, implement the smallest passing change, then rerun.
- Keep management endpoints admin-only with method-level `@Roles(Role.ADMIN)`.
- Keep option endpoints authenticated, but not admin-only.
- Do not make `isSystem` writable from admin create/update DTOs.
- Do not let dictionary data create new runtime roles. `user_role` remains a UI dictionary over the existing backend `Role` enum.
- Prefer `badgeVariant` over arbitrary colors throughout v1.
- Avoid adding table dictionaries, SQL dictionaries, cascades, import/export, or audit history in this implementation.
- If migrations cannot run because no local database is available, still update `schema.prisma`, run `pnpm --filter api db:generate` if possible, and clearly report the migration blocker before continuing.
