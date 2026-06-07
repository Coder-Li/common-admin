# Admin CRUD Table Pattern Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first standard admin CRUD table workflow with users, establishing reusable backend list DTOs and frontend table/query patterns.

**Architecture:** Add a server-side list contract to the NestJS API, then implement admin-only user CRUD using Prisma and method-level role decorators while preserving `/users/me`. On the frontend, extend the existing API client, add TanStack Table as the table state engine, create small shared table/query helpers, and replace the `/users` placeholder with a users CRUD page.

**Tech Stack:** NestJS, Prisma, PostgreSQL, class-validator, Swagger, Jest, React, Vite, TypeScript, TanStack Query, TanStack Table, Axios, react-hook-form, zod, Vitest, React Testing Library, Tailwind CSS.

---

## File Structure

### Backend

- Create `apps/api/src/common/dto/list-query.dto.ts`: shared query DTO for `page`, `pageSize`, `search`, and `sort`.
- Create `apps/api/src/common/dto/list-response.dto.ts`: shared generic list response helper and Swagger response DTO base.
- Modify `apps/api/src/user/user.types.ts`: add public user list/detail/create/update/list-query TypeScript interfaces if useful to keep mapper/service signatures clear.
- Modify `apps/api/src/user/user.mapper.ts`: map persisted Prisma users to public user responses with timestamps and no `passwordHash`.
- Create `apps/api/src/user/dto/user.request.ts`: `UserListQueryDto`, `CreateUserDto`, `UpdateUserDto`.
- Create `apps/api/src/user/dto/user.response.ts`: `UserResponseDto`, `UserListResponseDto`.
- Modify `apps/api/src/user/user.service.ts`: add list/detail/create/update/delete methods, sort/filter/search allowlists, password hashing, conflict handling, and not-found handling.
- Modify `apps/api/src/user/user.controller.ts`: add admin-only CRUD routes with method-level `@Roles(Role.ADMIN)` while preserving `GET /users/me` before `/:id`.
- Modify `apps/api/src/auth/auth-flow.spec.ts`: add e2e-style tests for admin CRUD security and `/users/me` preservation.
- Create or modify `apps/api/src/user/user.service.spec.ts`: unit-test list query mapping, create hashing/conflicts, update/delete behavior.

### Frontend

- Modify `apps/admin/package.json`: add `@tanstack/react-table`.
- Modify `pnpm-lock.yaml`: update after installing the dependency.
- Modify `apps/admin/src/lib/api.ts`: extend the HTTP client abstraction and `createApiClient` with authenticated `get`, `post`, `patch`, and `delete` helpers plus Axios `params` support.
- Modify `apps/admin/src/lib/api.test.ts`: cover list param serialization, CRUD verbs, auth headers, and existing login/me behavior.
- Create `apps/admin/src/lib/crud/list-query.ts`: frontend list query types and utilities for converting table state to API params.
- Create `apps/admin/src/lib/crud/useServerTableQuery.ts`: small hook that combines table query state with React Query options.
- Create `apps/admin/src/lib/crud/list-query.test.ts`: test stable query keys/query params.
- Create `apps/admin/src/components/data-table/DataTable.tsx`: shared TanStack Table renderer.
- Create `apps/admin/src/components/data-table/DataTablePagination.tsx`: pagination controls.
- Create `apps/admin/src/components/data-table/DataTableToolbar.tsx`: search/filter/action toolbar.
- Create `apps/admin/src/features/users/users.types.ts`: frontend user CRUD types.
- Create `apps/admin/src/features/users/users.api.ts`: user list/detail/create/update/delete API functions using the shared API client.
- Create `apps/admin/src/features/users/users.columns.tsx`: user table column definitions and row action callbacks.
- Create `apps/admin/src/features/users/UserForm.tsx`: create/edit form using react-hook-form and zod.
- Create `apps/admin/src/features/users/UsersPage.tsx`: page wiring query state, table, filters, create/edit/delete workflows, and mutations.
- Create `apps/admin/src/features/users/UsersPage.test.tsx`: page states and mutation invalidation tests.
- Modify `apps/admin/src/layouts/AdminShell.tsx`: replace the `/users` placeholder branch with `UsersPage`.
- Modify `apps/admin/src/i18n/messages.ts`: add user page, form, table, and toast copy in English and Chinese.

## Chunk 1: Backend Shared List DTOs

### Task 1: Common List Query Contract

**Files:**
- Create: `apps/api/src/common/dto/list-query.dto.ts`
- Create: `apps/api/src/common/dto/list-response.dto.ts`
- Test: `apps/api/src/user/user.service.spec.ts`

- [ ] **Step 1: Write failing tests for list defaults and invalid query behavior**

Add tests that instantiate and validate `ListQueryDto` through Nest's `ValidationPipe` or a focused DTO validation helper. Cover:

```ts
// Expected defaults
{}
// -> page 1, pageSize 20

// Expected validation failures
{ page: 0 }
{ page: 'abc' }
{ pageSize: 101 }
{ sort: 'createdAt:sideways' }
```

- [ ] **Step 2: Run the focused backend test and confirm it fails**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: FAIL because the shared DTOs do not exist yet.

- [ ] **Step 3: Implement `ListQueryDto`**

Create `apps/api/src/common/dto/list-query.dto.ts` with class-validator decorators and transform defaults:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9]*:(asc|desc)$/)
  sort?: string;
}
```

- [ ] **Step 4: Implement list response helpers**

Create `apps/api/src/common/dto/list-response.dto.ts`:

```ts
export interface ListResponse<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function createListResponse<TItem>(
  items: TItem[],
  total: number,
  page: number,
  pageSize: number,
): ListResponse<TItem> {
  return { items, total, page, pageSize };
}
```

- [ ] **Step 5: Re-run the focused backend test**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit shared DTOs**

```bash
git add apps/api/src/common/dto/list-query.dto.ts apps/api/src/common/dto/list-response.dto.ts apps/api/src/user/user.service.spec.ts
git commit -m "feat(api): add shared list dto contract"
```

## Chunk 2: Backend User CRUD

### Task 2: User DTOs And Mapper

**Files:**
- Modify: `apps/api/src/user/user.types.ts`
- Modify: `apps/api/src/user/user.mapper.ts`
- Create: `apps/api/src/user/dto/user.request.ts`
- Create: `apps/api/src/user/dto/user.response.ts`
- Test: `apps/api/src/user/user.service.spec.ts`

- [ ] **Step 1: Write failing mapper and DTO tests**

In `apps/api/src/user/user.service.spec.ts`, add expectations for:

- user list query inherits defaults and validates role filters.
- invalid sort field `passwordHash:asc` fails.
- invalid sort direction `createdAt:sideways` fails.
- mapper output includes `id`, `email`, `username`, `firstName`, `lastName`, `role`, `createdAt`, `updatedAt`.
- mapper output excludes `passwordHash`.

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: FAIL because user DTOs and mapper changes are missing.

- [ ] **Step 3: Implement user request DTOs**

Create `apps/api/src/user/dto/user.request.ts` with:

- `UserListQueryDto extends ListQueryDto` and rejects sort fields outside the user allowlist.
- `role?: Role` with `@IsEnum(Role)` and Swagger enum metadata.
- `CreateUserDto` with `email`, `username`, `firstName`, `lastName`, `password`, `role`.
- `UpdateUserDto` with optional `email`, `username`, `firstName`, `lastName`, `role`.

Use class-validator constraints that match the Prisma schema:

```ts
email: max 255 and email format
username: min 3, max 80
firstName: min 1, max 80
lastName: min 1, max 80
password: min 8
role: Role enum
```

- [ ] **Step 4: Implement user response DTOs**

Create `apps/api/src/user/dto/user.response.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ListResponse } from '../../common/dto/list-response.dto';
import { Role } from '../role.enum';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class UserListResponseDto implements ListResponse<UserResponseDto> {
  @ApiProperty({ type: [UserResponseDto] })
  items!: UserResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
```

- [ ] **Step 5: Update types and mapper**

Update `apps/api/src/user/user.types.ts` to export a public user response shape if service signatures need it.

Update `apps/api/src/user/user.mapper.ts` so the mapper:

- Accepts a persisted user with `createdAt` and `updatedAt`.
- Returns `createdAt` and `updatedAt` as ISO strings.
- Does not expose `passwordHash`.
- Keeps existing `toUserProfile` behavior compatible with auth tests.

- [ ] **Step 6: Re-run mapper and DTO tests**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: mapper and DTO tests PASS, service CRUD tests may still fail until service implementation is added.

- [ ] **Step 7: Commit user DTOs and mapper**

```bash
git add apps/api/src/user/user.types.ts apps/api/src/user/user.mapper.ts apps/api/src/user/dto/user.request.ts apps/api/src/user/dto/user.response.ts apps/api/src/user/user.service.spec.ts
git commit -m "feat(api): define user crud dto shapes"
```

### Task 3: User Service CRUD

**Files:**
- Modify: `apps/api/src/user/user.service.ts`
- Test: `apps/api/src/user/user.service.spec.ts`

- [ ] **Step 1: Write failing user service tests**

In `apps/api/src/user/user.service.spec.ts`, mock `PrismaService` and test:

- `listUsers()` calls `prisma.user.findMany` with `skip`, `take`, allowed `orderBy`, and `where`.
- `listUsers()` calls `prisma.user.count` with the same `where`.
- `search` maps to `OR` over `email`, `username`, `firstName`, and `lastName` using Prisma `{ contains: search, mode: 'insensitive' }` filters.
- `findMany` and `count` receive the same case-insensitive search `where` object.
- `role` maps to `where.role`.
- invalid sort field throws `BadRequestException`.
- `createUser()` hashes the password and writes `passwordHash`, not `password`.
- duplicate unique constraint maps to `ConflictException`.
- `findById()` returns public user or throws `NotFoundException`.
- `updateUser()` handles missing users and duplicate unique conflicts.
- `deleteUser()` returns void or throws `NotFoundException`.

- [ ] **Step 2: Run service tests and confirm failure**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: FAIL because service methods do not exist yet.

- [ ] **Step 3: Implement list constants and sort parser**

Inside `apps/api/src/user/user.service.ts`, add private allowlists:

```ts
const USER_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'email',
  'username',
  'firstName',
  'lastName',
  'role',
]);
```

Implement a small parser that:

- defaults to `createdAt:desc`.
- rejects unknown fields.
- rejects directions other than `asc` and `desc`.
- returns `{ [field]: direction }`.

- [ ] **Step 4: Implement list and detail methods**

Add:

```ts
async listUsers(query: UserListQueryDto): Promise<ListResponse<UserResponseDto>>
async findById(id: string): Promise<UserResponseDto>
```

Use:

```ts
skip = (query.page - 1) * query.pageSize
take = query.pageSize
```

Build a shared `where` object for `findMany` and `count`.

For search, the `where` object must use PostgreSQL-compatible case-insensitive Prisma filters:

```ts
{
  OR: [
    { email: { contains: search, mode: 'insensitive' } },
    { username: { contains: search, mode: 'insensitive' } },
    { firstName: { contains: search, mode: 'insensitive' } },
    { lastName: { contains: search, mode: 'insensitive' } },
  ],
}
```

Combine this with `role` when a role filter is present, and pass the same object to both `findMany` and `count`.

- [ ] **Step 5: Implement create/update/delete methods**

Add:

```ts
async createUser(dto: CreateUserDto): Promise<UserResponseDto>
async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponseDto>
async deleteUser(id: string): Promise<void>
```

Use `bcrypt.hash(dto.password, 10)` and save to `passwordHash`.

Map Prisma known request errors:

- `P2002` -> `ConflictException`.
- `P2025` -> `NotFoundException`.

- [ ] **Step 6: Re-run service tests**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit service CRUD**

```bash
git add apps/api/src/user/user.service.ts apps/api/src/user/user.service.spec.ts
git commit -m "feat(api): implement user crud service"
```

### Task 4: User Controller Routes And Security

**Files:**
- Modify: `apps/api/src/user/user.controller.ts`
- Modify: `apps/api/src/auth/auth-flow.spec.ts`
- Test: `apps/api/src/auth/auth-flow.spec.ts`

- [ ] **Step 1: Write failing auth flow tests**

In `apps/api/src/auth/auth-flow.spec.ts`, add tests for:

- authenticated standard user can call `GET /api/users/me`.
- standard user receives `403` for `GET /api/users`.
- admin user can call `GET /api/users` and receives `{ items, total, page, pageSize }`.
- admin CRUD routes call the expected service methods.
- `GET /api/users/me` is not swallowed by `GET /api/users/:id`.
- `DELETE /api/users/:id` returns `204`.

- [ ] **Step 2: Run auth flow tests and confirm failure**

Run:

```bash
pnpm --filter api test -- auth-flow.spec.ts
```

Expected: FAIL because CRUD routes are missing.

- [ ] **Step 3: Implement controller routes**

Update `apps/api/src/user/user.controller.ts`:

- Keep `@Get('me')` before `@Get(':id')`.
- Add `@Get()` with `@Query() query: UserListQueryDto`.
- Add `@Get(':id')`.
- Add `@Post()`.
- Add `@Patch(':id')`.
- Add `@Delete(':id')` with `@HttpCode(204)`.
- Apply `@Roles(Role.ADMIN)` to each admin-only CRUD method.
- Do not apply `@Roles(Role.ADMIN)` to the controller class or `getMe()`.
- Add `@ApiOkResponse`, `@ApiCreatedResponse`, `@ApiNoContentResponse`, `@ApiForbiddenResponse`, and `@ApiNotFoundResponse` metadata where appropriate.

- [ ] **Step 4: Re-run backend focused tests**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run full API tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 6: Commit controller routes**

```bash
git add apps/api/src/user/user.controller.ts apps/api/src/auth/auth-flow.spec.ts
git commit -m "feat(api): expose admin user crud routes"
```

## Chunk 3: Frontend API Client And CRUD Query Helpers

### Task 5: Install TanStack Table

**Files:**
- Modify: `apps/admin/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the table dependency**

Run:

```bash
pnpm --filter admin add @tanstack/react-table
```

Expected: `apps/admin/package.json` includes `@tanstack/react-table`, and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify dependency resolution**

Run:

```bash
pnpm --filter admin build
```

Expected: current build behavior remains unchanged except dependency availability. If build fails on unrelated existing issues, record the exact failure before continuing.

- [ ] **Step 3: Commit dependency**

```bash
git add apps/admin/package.json pnpm-lock.yaml
git commit -m "build(admin): add tanstack table"
```

### Task 6: Extend API Client

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/api.test.ts`

- [ ] **Step 1: Write failing API client tests**

In `apps/admin/src/lib/api.test.ts`, add tests for:

- `api.users.list({ page: 1, pageSize: 20, sort: 'createdAt:desc', role: 'ADMIN' })` calls `get('/users', { params, headers })`.
- `api.users.create(payload)` sends authenticated `post('/users', payload, { headers })`.
- `api.users.update(id, payload)` sends authenticated `patch('/users/:id', payload, { headers })`.
- `api.users.delete(id)` sends authenticated `delete('/users/:id', { headers })`.
- existing `login()` still does not require auth headers.
- existing `me()` still sends bearer auth.

- [ ] **Step 2: Run API client tests and confirm failure**

Run:

```bash
pnpm --filter admin test src/lib/api.test.ts
```

Expected: FAIL because the client lacks patch/delete/query params/users namespace.

- [ ] **Step 3: Extend HTTP client types and request helpers**

Update `apps/admin/src/lib/api.ts`:

- Add `patch` and `delete` to `HttpClient`.
- Let `get` accept `params`.
- Add a helper that builds `{ headers: { Authorization }, params }`.
- Keep unauthorized handling centralized.
- Keep `createApiClient()` testable with a fake client.

- [ ] **Step 4: Add users API methods to `createApiClient()`**

Expose:

```ts
users: {
  list(query: UserListQuery): Promise<ListResponse<UserProfile>>
  create(payload: CreateUserRequest): Promise<UserProfile>
  update(id: string, payload: UpdateUserRequest): Promise<UserProfile>
  delete(id: string): Promise<void>
}
```

Use frontend-local user CRUD types until generated OpenAPI types exist. Import those types from `apps/admin/src/features/users/users.types.ts` once that file exists; before then, keep temporary local interfaces in `api.ts` and move them during Task 9.

- [ ] **Step 5: Re-run API client tests**

Run:

```bash
pnpm --filter admin test src/lib/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit API client changes**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/lib/api.test.ts
git commit -m "feat(admin): extend api client for crud"
```

### Task 7: CRUD Query Helpers

**Files:**
- Create: `apps/admin/src/lib/crud/list-query.ts`
- Create: `apps/admin/src/lib/crud/useServerTableQuery.ts`
- Create: `apps/admin/src/lib/crud/list-query.test.ts`

- [ ] **Step 1: Write failing list query helper tests**

Add tests for:

- converting zero-based table page index to API `page`.
- default `pageSize`.
- stable query key parts for `page`, `pageSize`, `search`, `sort`, and filters.
- omitting empty `search`.

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
pnpm --filter admin test src/lib/crud/list-query.test.ts
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement list query utilities**

Create `list-query.ts` with:

```ts
export interface ServerListState<TFilters extends Record<string, unknown> = Record<string, unknown>> {
  pageIndex: number
  pageSize: number
  search: string
  sort?: string
  filters: TFilters
}

export function toApiListQuery(...)
export function createListQueryKey(...)
```

Use 1-based `page` at the API boundary.

- [ ] **Step 4: Implement `useServerTableQuery`**

Create a small wrapper around React Query:

```ts
export function useServerTableQuery<TItem, TFilters>(options: {
  resource: string
  state: ServerListState<TFilters>
  queryFn: (query: Record<string, unknown>) => Promise<ListResponse<TItem>>
})
```

Keep it simple. Do not introduce URL sync.

- [ ] **Step 5: Re-run helper tests**

Run:

```bash
pnpm --filter admin test src/lib/crud/list-query.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit query helpers**

```bash
git add apps/admin/src/lib/crud/list-query.ts apps/admin/src/lib/crud/useServerTableQuery.ts apps/admin/src/lib/crud/list-query.test.ts
git commit -m "feat(admin): add server table query helpers"
```

## Chunk 4: Shared Data Table Components

### Task 8: Data Table Foundation

**Files:**
- Create: `apps/admin/src/components/data-table/DataTable.tsx`
- Create: `apps/admin/src/components/data-table/DataTablePagination.tsx`
- Create: `apps/admin/src/components/data-table/DataTableToolbar.tsx`

- [ ] **Step 1: Implement `DataTablePagination`**

Create a compact pagination component with:

- previous/next buttons.
- page indicator.
- page size select or buttons for `10`, `20`, `50`.
- disabled states.

Use stable heights and existing Tailwind styling.

- [ ] **Step 2: Implement `DataTableToolbar`**

Create a toolbar with:

- debounced or externally controlled search input.
- optional filter slot.
- optional primary action slot.

Do not hard-code users-specific copy.

- [ ] **Step 3: Implement `DataTable`**

Use TanStack Table with manual pagination and manual sorting:

```ts
manualPagination: true
manualSorting: true
rowCount: total
```

Render:

- table header.
- table body.
- loading row.
- empty row.
- error row with retry action.
- pagination footer.

- [ ] **Step 4: Type-check shared components**

Run:

```bash
pnpm --filter admin build
```

Expected: PASS or fail only because later users feature files are not created yet. If it fails, fix type errors in shared components before continuing.

- [ ] **Step 5: Commit shared table components**

```bash
git add apps/admin/src/components/data-table/DataTable.tsx apps/admin/src/components/data-table/DataTablePagination.tsx apps/admin/src/components/data-table/DataTableToolbar.tsx
git commit -m "feat(admin): add shared data table components"
```

## Chunk 5: Users Frontend Feature

### Task 9: Users Types, API, And Columns

**Files:**
- Create: `apps/admin/src/features/users/users.types.ts`
- Create: `apps/admin/src/features/users/users.api.ts`
- Create: `apps/admin/src/features/users/users.columns.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`

- [ ] **Step 1: Add user frontend types**

Create types matching the backend contract:

```ts
export type Role = 'ADMIN' | 'STANDARD'
export interface UserListQuery { page: number; pageSize: number; search?: string; sort?: string; role?: Role }
export interface UserRecord { id: string; email: string; username: string; firstName: string; lastName: string; role: Role; createdAt: string; updatedAt: string }
export interface UserListResponse { items: UserRecord[]; total: number; page: number; pageSize: number }
export interface CreateUserRequest { email: string; username: string; firstName: string; lastName: string; password: string; role: Role }
export interface UpdateUserRequest { email?: string; username?: string; firstName?: string; lastName?: string; role?: Role }
```

- [ ] **Step 2: Add users API wrapper**

Create `users.api.ts` that exports functions wrapping `api.users.*`. `UsersPage` should import these wrapper functions instead of importing the global `api` object directly; this keeps page tests easy to mock.

- [ ] **Step 3: Add columns**

Create columns for:

- username.
- email.
- full name.
- role.
- created at.
- row actions.

Use action callbacks injected by `UsersPage`, not global mutations inside the columns file.

- [ ] **Step 4: Add i18n copy**

Update `messages.ts` with user page title, search placeholder, role labels, create/edit/delete labels, validation copy, and success/error toasts in English and Chinese.

- [ ] **Step 5: Run frontend tests/build**

Run:

```bash
pnpm --filter admin test
pnpm --filter admin build
```

Expected: PASS after any type issues are fixed.

- [ ] **Step 6: Commit users foundation**

```bash
git add apps/admin/src/features/users/users.types.ts apps/admin/src/features/users/users.api.ts apps/admin/src/features/users/users.columns.tsx apps/admin/src/i18n/messages.ts
git commit -m "feat(admin): add users table foundation"
```

### Task 10: User Form

**Files:**
- Create: `apps/admin/src/features/users/UserForm.tsx`

- [ ] **Step 1: Create form schema**

Use zod for:

- email format.
- username required.
- firstName required.
- lastName required.
- password min 8 on create.
- password omitted on edit.
- role enum.

- [ ] **Step 2: Implement form component**

`UserForm` props:

```ts
interface UserFormProps {
  mode: 'create' | 'edit'
  initialValue?: UserRecord
  isSubmitting: boolean
  onSubmit: (value: CreateUserRequest | UpdateUserRequest) => void
  onCancel: () => void
}
```

Use compact inputs and native buttons styled with Tailwind. Keep fields stable on mobile.

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter admin build
```

Expected: PASS after form type issues are fixed.

- [ ] **Step 4: Commit form**

```bash
git add apps/admin/src/features/users/UserForm.tsx
git commit -m "feat(admin): add user form"
```

### Task 11: Users Page

**Files:**
- Create: `apps/admin/src/features/users/UsersPage.tsx`
- Create: `apps/admin/src/features/users/UsersPage.test.tsx`
- Modify: `apps/admin/src/layouts/AdminShell.tsx`

- [ ] **Step 1: Write failing users page tests**

In `UsersPage.test.tsx`, mock users API functions and test:

- loading state.
- empty state.
- data rows render.
- role filter triggers a list query.
- create success invalidates/refetches users list and closes the form.
- update success invalidates/refetches users list.
- delete confirmation calls delete and invalidates/refetches.
- error state shows retry.

- [ ] **Step 2: Run users page tests and confirm failure**

Run:

```bash
pnpm --filter admin test src/features/users/UsersPage.test.tsx
```

Expected: FAIL because `UsersPage` does not exist.

- [ ] **Step 3: Implement `UsersPage` state and queries**

Use:

- `useServerTableQuery` for list loading.
- React Query mutations for create/update/delete.
- local state for search, role filter, pagination, sort, selected user, and form mode.
- `sonner` toasts for success/error.

- [ ] **Step 4: Wire `DataTable`, toolbar, and form**

Render:

- page title and create button.
- search input.
- role filter.
- data table.
- modal or inline panel for create/edit.
- delete confirmation.

Keep UI dense and operational. Do not add explanatory marketing text.

- [ ] **Step 5: Replace `/users` placeholder**

Update `apps/admin/src/layouts/AdminShell.tsx`:

- import `UsersPage`.
- replace the current `/users` `PlaceholderPage` branch with `<UsersPage />`.
- leave `/settings` placeholder unchanged.

- [ ] **Step 6: Re-run users page tests**

Run:

```bash
pnpm --filter admin test src/features/users/UsersPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run shell tests**

Run:

```bash
pnpm --filter admin test src/layouts/AdminShell.test.tsx
```

Expected: PASS after updating expectations if they still expect the users placeholder.

- [ ] **Step 8: Commit users page**

```bash
git add apps/admin/src/features/users/UsersPage.tsx apps/admin/src/features/users/UsersPage.test.tsx apps/admin/src/layouts/AdminShell.tsx
git commit -m "feat(admin): implement users crud page"
```

## Chunk 6: Integration Verification And Docs

### Task 12: Full Verification

**Files:**
- Modify only if verification reveals issues in files touched by previous chunks.

- [ ] **Step 1: Run API tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 2: Run admin tests**

Run:

```bash
pnpm --filter admin test
```

Expected: PASS.

- [ ] **Step 3: Run builds**

Run:

```bash
pnpm --filter api build
pnpm --filter admin build
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
pnpm --filter api lint
pnpm --filter admin lint
```

Expected: PASS.

- [ ] **Step 5: Start local dev servers for manual smoke testing**

Run:

```bash
pnpm dev
```

Expected:

- API starts on `http://localhost:3001/api`.
- Admin starts on `http://localhost:5173`.
- Login still works with `admin@example.com / Admin123!`.
- `/users` shows the real users table.
- Create, edit, delete, search, role filter, pagination, and sort work against the API.

- [ ] **Step 6: Commit final verification fixes**

If verification required fixes:

```bash
git add <changed-files>
git commit -m "fix: stabilize users crud verification"
```

If no fixes were needed, do not create an empty commit.

## Notes For Implementers

- Use `superpowers:test-driven-development` before code changes in each implementation chunk.
- Use `superpowers:verification-before-completion` before claiming any chunk is complete.
- Do not introduce TanStack Router routing in this feature.
- Do not apply `@Roles(Role.ADMIN)` at the `UserController` class level.
- Do not expose `passwordHash` in any response.
- Do not silently clamp invalid query values; invalid query params return `400`.
- Keep abstractions small. If a users-specific behavior does not belong in shared table code, leave it in `features/users`.
