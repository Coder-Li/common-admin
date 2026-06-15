# Organization, Department, And Position Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build department tree management, position management, and user organization assignment for Common Admin.

**Architecture:** Add Prisma organization models and focused NestJS department and position modules that follow the existing CRUD/RBAC/OpenAPI patterns. Extend the existing user module to own user department and position assignments, then regenerate the admin client and add permission-aware department, position, and user-form UI changes.

**Tech Stack:** NestJS 11, Prisma, PostgreSQL, class-validator, Swagger, Jest, React 19, Vite, TypeScript, TanStack Query, TanStack Router, Orval, Vitest, React Testing Library, react-hook-form, zod, lucide-react.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-15-organization-department-position-design.md`
- CRUD pattern: `docs/patterns/admin-crud-table-pattern-guide.md`
- RBAC pattern: `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`
- API contract guide: `docs/patterns/admin-api-contract-generation-guide.md`
- Backend user reference: `apps/api/src/user/`
- Backend dictionary reference: `apps/api/src/dictionary/`
- Backend file reference: `apps/api/src/file/`
- Backend session reference: `apps/api/src/user-session/`
- Permission registry: `apps/api/src/permission/permission.registry.ts`
- Audit constants: `apps/api/src/audit-log/audit-log.constants.ts`
- Prisma schema: `apps/api/prisma/schema.prisma`
- Frontend route registry: `apps/admin/src/routes/admin-route-registry.tsx`
- Frontend user feature reference: `apps/admin/src/features/users/`
- Frontend dictionaries feature reference: `apps/admin/src/features/dictionaries/`
- Frontend data table components: `apps/admin/src/components/data-table/`

## Implementation Notes

- Do not modify `docs/next-step.md`.
- Do not implement data permission filtering.
- Do not add department managers, member detail pages, batch assignment, drag-and-drop tree behavior, multi-tenancy, or approval workflow.
- Use generated API functions and schema types in the admin app. Do not add one-method feature-local API wrappers.
- Use method-level `@Permissions()` decorators on new admin endpoints.
- Keep literal NestJS routes (`tree`, `options`) before `:id`.
- Use `department.read/create/update/delete` and `position.read/create/update/delete`.
- User organization assignment is authorized through existing `user.create` and `user.update`.
- For PATCH semantics, omitted user assignment fields mean "leave unchanged"; explicit empty arrays mean "clear".
- Existing disabled assignments can remain when assignment fields are omitted. Submitted assignment ids must be active.
- Commit after each chunk once its tests pass.

## File Structure

### Prisma And Shared Backend

- Modify `apps/api/prisma/schema.prisma`: add `DepartmentStatus`, `PositionStatus`, `Department`, `Position`, `UserDepartment`, `UserPosition`, and `User` relations.
- Create migration under `apps/api/prisma/migrations/<timestamp>_add_organization/`: generated table DDL plus partial unique index for one primary department per user.
- Modify `apps/api/src/permission/permission.registry.ts`: add department and position permissions.
- Modify `apps/api/src/permission/permission.registry.spec.ts`: assert permission registry entries.
- Modify `apps/api/src/audit-log/audit-log.constants.ts`: add `DEPARTMENT` and `POSITION` resource types.

### Department Backend Module

- Create `apps/api/src/department/department.constants.ts`: statuses, sort fields, default sort.
- Create `apps/api/src/department/dto/department.request.ts`: list, options, create, update DTOs.
- Create `apps/api/src/department/dto/department.response.ts`: response, list response, tree node, option DTOs.
- Create `apps/api/src/department/department.mapper.ts`: Prisma-to-response mapping and tree building helpers.
- Create `apps/api/src/department/department.service.ts`: list, tree, options, create, update, delete, validation, audit logging.
- Create `apps/api/src/department/department.controller.ts`: routes, operation ids, permissions, Swagger responses.
- Create `apps/api/src/department/department.module.ts`: module wiring.
- Create `apps/api/src/department/department.mapper.spec.ts`: mapper and tree tests.
- Create `apps/api/src/department/department.service.spec.ts`: domain, list, tree, dependency, audit tests.
- Create `apps/api/src/department/department.controller.spec.ts`: controller delegation and permission metadata tests.

### Position Backend Module

- Create `apps/api/src/position/position.constants.ts`: statuses, sort fields, default sort.
- Create `apps/api/src/position/dto/position.request.ts`: list, options, create, update DTOs.
- Create `apps/api/src/position/dto/position.response.ts`: response, list response, option DTOs.
- Create `apps/api/src/position/position.mapper.ts`: Prisma-to-response mapping.
- Create `apps/api/src/position/position.service.ts`: list, options, create, update, delete, validation, audit logging.
- Create `apps/api/src/position/position.controller.ts`: routes, operation ids, permissions, Swagger responses.
- Create `apps/api/src/position/position.module.ts`: module wiring.
- Create `apps/api/src/position/position.mapper.spec.ts`: mapper tests.
- Create `apps/api/src/position/position.service.spec.ts`: domain, list, options, dependency, audit tests.
- Create `apps/api/src/position/position.controller.spec.ts`: controller delegation and permission metadata tests.

### User Backend Extension

- Modify `apps/api/src/user/dto/user.request.ts`: add `departmentIds`, `primaryDepartmentId`, `positionIds`, `departmentId`, `positionId`.
- Modify `apps/api/src/user/dto/user.response.ts`: add department and position summary DTOs.
- Modify `apps/api/src/user/user.mapper.ts`: include organization summaries.
- Modify `apps/api/src/user/user.types.ts`: extend public user types if needed.
- Modify `apps/api/src/user/user.service.ts`: include assignments, filter by department/position, validate and replace assignments transactionally.
- Modify `apps/api/src/user/user.service.spec.ts`: organization assignment tests.
- Modify `apps/api/src/user/user.controller.spec.ts`: updated request/response expectations if needed.
- Modify `apps/api/src/app.module.ts`: import `DepartmentModule` and `PositionModule`.
- Modify `apps/api/src/openapi.spec.ts`: assert operation ids and generated contract shape.
- Modify generated contract files after `pnpm api:generate`: `apps/api/openapi.json` and `apps/admin/src/generated/api/`.

### Frontend

- Create `apps/admin/src/features/departments/departments.types.ts`: generated type aliases and UI-only types.
- Create `apps/admin/src/features/departments/departments.columns.tsx`: department row columns/action definitions where useful.
- Create `apps/admin/src/features/departments/DepartmentForm.tsx`: create/edit form.
- Create `apps/admin/src/features/departments/DepartmentsPage.tsx`: tree-first page, filters, mutations, confirmations.
- Create `apps/admin/src/features/departments/DepartmentsPage.test.tsx`: page behavior tests.
- Create `apps/admin/src/features/positions/positions.types.ts`: generated type aliases and UI-only types.
- Create `apps/admin/src/features/positions/positions.columns.tsx`: position table columns/actions.
- Create `apps/admin/src/features/positions/PositionForm.tsx`: create/edit form.
- Create `apps/admin/src/features/positions/PositionsPage.tsx`: table page, filters, mutations, confirmations.
- Create `apps/admin/src/features/positions/PositionsPage.test.tsx`: page behavior tests.
- Modify `apps/admin/src/features/users/users.types.ts`: expose organization form values/types.
- Modify `apps/admin/src/features/users/users.columns.tsx`: primary department and position summaries.
- Modify `apps/admin/src/features/users/UserForm.tsx`: department multi-select, primary department select, position multi-select, changed-field PATCH payloads.
- Modify `apps/admin/src/features/users/UsersPage.tsx`: department/position filters and options queries.
- Modify `apps/admin/src/features/users/UsersPage.test.tsx`: organization form and filter tests.
- Modify `apps/admin/src/routes/admin-route-registry.tsx`: add `/departments` and `/positions` routes.
- Modify `apps/admin/src/routes/admin-route-registry.test.tsx`: route visibility and metadata tests.
- Modify `apps/admin/src/layouts/AdminShell.test.tsx`: menu visibility tests if route registry tests do not cover shell rendering.
- Modify `apps/admin/src/routes/router.test.tsx`: direct forbidden route tests if existing router tests cover route permissions.
- Modify `apps/admin/src/i18n/messages.ts`: nav, table, form, filter, confirmation, toast text.

## Chunk 1: Data Model, Permissions, And Shared Backend Contracts

### Task 1: Add Organization Prisma Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_organization/migration.sql`

- [ ] **Step 1: Add schema models**

Update `apps/api/prisma/schema.prisma` with:

```prisma
enum DepartmentStatus {
  ACTIVE
  DISABLED
}

enum PositionStatus {
  ACTIVE
  DISABLED
}

model Department {
  id          String           @id @default(uuid())
  code        String           @unique @db.VarChar(80)
  name        String           @db.VarChar(120)
  parentId    String?
  status      DepartmentStatus @default(ACTIVE)
  sortOrder   Int              @default(0)
  description String?          @db.VarChar(500)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  parent      Department?      @relation("DepartmentTree", fields: [parentId], references: [id])
  children    Department[]     @relation("DepartmentTree")
  users       UserDepartment[]

  @@index([parentId, sortOrder])
  @@index([status])
  @@index([name])
}

model Position {
  id          String         @id @default(uuid())
  code        String         @unique @db.VarChar(80)
  name        String         @db.VarChar(120)
  status      PositionStatus @default(ACTIVE)
  sortOrder   Int            @default(0)
  description String?        @db.VarChar(500)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  users       UserPosition[]

  @@index([status, sortOrder])
  @@index([name])
}

model UserDepartment {
  userId       String
  departmentId String
  isPrimary    Boolean  @default(false)
  createdAt    DateTime @default(now())

  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  department   Department @relation(fields: [departmentId], references: [id])

  @@id([userId, departmentId])
  @@index([departmentId])
}

model UserPosition {
  userId     String
  positionId String
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  position   Position @relation(fields: [positionId], references: [id])

  @@id([userId, positionId])
  @@index([positionId])
}
```

Add to `model User`:

```prisma
departments UserDepartment[]
positions   UserPosition[]
```

- [ ] **Step 2: Generate migration without applying it**

Run:

```bash
pnpm --filter api prisma migrate dev --create-only --name add_organization
```

Expected: Prisma creates a new migration file but does not apply it to the
local database yet.

- [ ] **Step 3: Add partial unique index**

Edit the generated migration SQL and add:

```sql
CREATE UNIQUE INDEX "user_departments_one_primary_per_user"
ON "UserDepartment" ("userId")
WHERE "isPrimary" = true;
```

Expected: migration explicitly enforces one primary department per user.

- [ ] **Step 4: Apply edited migration and verify Prisma client generation**

Run:

```bash
pnpm --filter api db:migrate
pnpm --filter api db:generate
```

Expected: migration applies with the partial unique index included, and Prisma
Client is generated.

- [ ] **Step 5: Commit schema work**

Run:

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add organization schema"
```

Expected: commit succeeds.

### Task 2: Register Permissions And Audit Resource Types

**Files:**
- Modify: `apps/api/src/permission/permission.registry.ts`
- Modify: `apps/api/src/permission/permission.registry.spec.ts`
- Modify: `apps/api/src/audit-log/audit-log.constants.ts`
- Create: `apps/api/src/audit-log/audit-log.constants.spec.ts`

- [ ] **Step 1: Write failing permission and audit constant assertions**

Update `apps/api/src/permission/permission.registry.spec.ts` to assert:

```ts
expect(PERMISSION_REGISTRY).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      code: 'department.read',
      module: 'department',
      action: 'read',
      defaultRoles: ['admin'],
    }),
    expect.objectContaining({
      code: 'department.create',
      module: 'department',
      action: 'create',
      defaultRoles: ['admin'],
    }),
    expect.objectContaining({
      code: 'department.update',
      module: 'department',
      action: 'update',
      defaultRoles: ['admin'],
    }),
    expect.objectContaining({
      code: 'department.delete',
      module: 'department',
      action: 'delete',
      defaultRoles: [],
    }),
    expect.objectContaining({
      code: 'position.read',
      module: 'position',
      action: 'read',
      defaultRoles: ['admin'],
    }),
    expect.objectContaining({
      code: 'position.create',
      module: 'position',
      action: 'create',
      defaultRoles: ['admin'],
    }),
    expect.objectContaining({
      code: 'position.update',
      module: 'position',
      action: 'update',
      defaultRoles: ['admin'],
    }),
    expect.objectContaining({
      code: 'position.delete',
      module: 'position',
      action: 'delete',
      defaultRoles: [],
    }),
  ]),
);
```

Create `apps/api/src/audit-log/audit-log.constants.spec.ts` to assert:

```ts
expect(AUDIT_RESOURCE_TYPES.DEPARTMENT).toBe('department');
expect(AUDIT_RESOURCE_TYPES.POSITION).toBe('position');
```

Run:

```bash
pnpm --filter api test -- permission.registry.spec.ts audit-log
```

Expected: FAIL because permissions and audit resource types are not registered.

- [ ] **Step 2: Add permission registry entries**

Add entries to `PERMISSION_REGISTRY` after user/session or before resource
permissions:

```ts
{
  code: 'department.read',
  module: 'department',
  action: 'read',
  name: 'View departments',
  defaultRoles: ['admin'],
  sortOrder: 800,
},
{
  code: 'department.create',
  module: 'department',
  action: 'create',
  name: 'Create department',
  defaultRoles: ['admin'],
  sortOrder: 810,
},
{
  code: 'department.update',
  module: 'department',
  action: 'update',
  name: 'Update department',
  defaultRoles: ['admin'],
  sortOrder: 820,
},
{
  code: 'department.delete',
  module: 'department',
  action: 'delete',
  name: 'Delete department',
  defaultRoles: [],
  sortOrder: 830,
},
{
  code: 'position.read',
  module: 'position',
  action: 'read',
  name: 'View positions',
  defaultRoles: ['admin'],
  sortOrder: 840,
},
{
  code: 'position.create',
  module: 'position',
  action: 'create',
  name: 'Create position',
  defaultRoles: ['admin'],
  sortOrder: 850,
},
{
  code: 'position.update',
  module: 'position',
  action: 'update',
  name: 'Update position',
  defaultRoles: ['admin'],
  sortOrder: 860,
},
{
  code: 'position.delete',
  module: 'position',
  action: 'delete',
  name: 'Delete position',
  defaultRoles: [],
  sortOrder: 870,
},
```

- [ ] **Step 3: Add audit resource constants**

Add to `AUDIT_RESOURCE_TYPES` in `apps/api/src/audit-log/audit-log.constants.ts`:

```ts
DEPARTMENT: 'department',
POSITION: 'position',
```

- [ ] **Step 4: Run shared contract tests**

Run:

```bash
pnpm --filter api test -- permission.registry.spec.ts audit-log
```

Expected: PASS.

- [ ] **Step 5: Commit shared backend contract work**

Run:

```bash
git add apps/api/src/permission/permission.registry.ts apps/api/src/permission/permission.registry.spec.ts apps/api/src/audit-log/audit-log.constants.ts apps/api/src/audit-log/audit-log.constants.spec.ts
git commit -m "feat(api): register organization permissions"
```

Expected: commit succeeds.

## Chunk 2: Department And Position Backend Modules

### Task 3: Implement Department DTOs And Mapper

**Files:**
- Create: `apps/api/src/department/department.constants.ts`
- Create: `apps/api/src/department/dto/department.request.ts`
- Create: `apps/api/src/department/dto/department.response.ts`
- Create: `apps/api/src/department/department.mapper.ts`
- Create: `apps/api/src/department/department.mapper.spec.ts`

- [ ] **Step 1: Write failing mapper tests**

Create `apps/api/src/department/department.mapper.spec.ts` with tests for:

```ts
expect(toDepartmentResponse(record)).toMatchObject({
  id: 'dept-1',
  code: 'engineering',
  name: 'Engineering',
  parentId: null,
  parentName: null,
  status: 'ACTIVE',
  sortOrder: 10,
  description: null,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z',
});

expect(toDepartmentTree(records)).toEqual([
  expect.objectContaining({
    id: 'root',
    children: [expect.objectContaining({ id: 'child' })],
  }),
]);
```

Run:

```bash
pnpm --filter api test -- department.mapper.spec.ts
```

Expected: FAIL because department mapper does not exist.

- [ ] **Step 2: Add department constants**

Create constants:

```ts
export const DEPARTMENT_SORT_FIELDS = [
  'name',
  'code',
  'sortOrder',
  'createdAt',
  'updatedAt',
] as const;

export const DEPARTMENT_DEFAULT_SORT = 'sortOrder:asc';
```

- [ ] **Step 3: Add department request DTOs**

Create DTOs:

- `DepartmentListQueryDto extends ListQueryDto` with `status`, `parentId`, and sort regex.
- `DepartmentOptionsQueryDto` with optional `status` and comma-separated `includeIds`.
- `CreateDepartmentDto` with `code`, `name`, optional `parentId`, `status`, `sortOrder`, `description`.
- `UpdateDepartmentDto` with all create fields optional and `parentId` nullable.

Use `@ApiProperty`, `@ApiPropertyOptional`, `@IsString`, `@MaxLength`,
`@IsOptional`, `@IsEnum`, `@IsInt`, `@Min`, and sort `@Matches` following
existing DTO style.

- [ ] **Step 4: Add department response DTOs**

Create:

- `DepartmentResponseDto`
- `DepartmentListResponseDto`
- `DepartmentTreeNodeDto`
- `DepartmentOptionDto`

Ensure dates are strings and list response implements `ListResponse<DepartmentResponseDto>`.

- [ ] **Step 5: Add mapper implementation**

Implement:

```ts
export function toDepartmentResponse(record: DepartmentRecord): DepartmentResponseDto;
export function toDepartmentOption(record: DepartmentOptionRecord): DepartmentOptionDto;
export function toDepartmentTree(records: DepartmentTreeRecord[]): DepartmentTreeNodeDto[];
```

Sort tree siblings by `sortOrder` then `name`.

- [ ] **Step 6: Run mapper tests**

Run:

```bash
pnpm --filter api test -- department.mapper.spec.ts
```

Expected: PASS.

### Task 4: Implement Department Service

**Files:**
- Create: `apps/api/src/department/department.service.ts`
- Create/modify: `apps/api/src/department/department.service.spec.ts`

- [ ] **Step 1: Write failing list and tree service tests**

Create `apps/api/src/department/department.service.spec.ts` with mocked
`PrismaService` and `AuditLogService`. Cover:

- default pagination and `sortOrder:asc`;
- search maps to `code`, `name`, `description`;
- status and parent filters;
- same `where` passed to `findMany` and `count`;
- `getTree` returns nested data;
- `getOptions` returns active records by default;
- `getOptions` orders by `sortOrder` then `name`;
- `getOptions` includes disabled records named in `includeIds`;
- `getOptions` ignores unknown `includeIds`;
- `getOptions` deduplicates duplicate `includeIds`.

Run:

```bash
pnpm --filter api test -- department.service.spec.ts
```

Expected: FAIL because service does not exist.

- [ ] **Step 2: Implement read methods**

Implement:

```ts
listDepartments(query: DepartmentListQueryDto): Promise<ListResponse<DepartmentResponseDto>>
getDepartmentTree(): Promise<DepartmentTreeNodeDto[]>
getDepartmentOptions(query: DepartmentOptionsQueryDto): Promise<DepartmentOptionDto[]>
findById(id: string): Promise<DepartmentResponseDto>
```

Use existing `createListResponse`, allowed sort parsing, shared `where`, and
mapper functions.

- [ ] **Step 3: Run read tests**

Run:

```bash
pnpm --filter api test -- department.service.spec.ts
```

Expected: read tests PASS; mutation tests still absent.

- [ ] **Step 4: Write failing mutation/domain tests**

Add tests for:

- duplicate code maps to `ConflictException`;
- missing record maps to `NotFoundException`;
- create succeeds and records audit data;
- update succeeds and records audit data;
- self parent rejected with `BadRequestException`;
- descendant parent rejected with `BadRequestException`;
- disabled parent rejected when explicitly selected;
- explicit `parentId: null` makes the department a root department;
- omitted `parentId` preserves existing disabled parent;
- delete rejected with child departments;
- delete rejected with assigned users;
- delete succeeds and records audit data.

- [ ] **Step 5: Implement mutations and validation**

Implement:

```ts
createDepartment(dto, actor?, requestMeta?, auditMetadata?)
updateDepartment(id, dto, actor?, requestMeta?, auditMetadata?)
deleteDepartment(id, actor?, requestMeta?, auditMetadata?)
```

Validation rules:

- if `parentId` is `null`, make the department a root department;
- if `parentId` is a string, it must exist, be active, not equal `id`, and not be a descendant;
- if `parentId` is omitted in update, do not change the parent;
- before delete, count child departments and `UserDepartment` rows;
- audit writes use `AUDIT_RESOURCE_TYPES.DEPARTMENT`.

- [ ] **Step 6: Run department service tests**

Run:

```bash
pnpm --filter api test -- department.service.spec.ts
```

Expected: PASS.

### Task 5: Implement Department Controller And Module

**Files:**
- Create: `apps/api/src/department/department.controller.ts`
- Create: `apps/api/src/department/department.module.ts`
- Create: `apps/api/src/department/department.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [x] **Step 1: Write failing controller tests**

Assert controller methods call service methods and carry permission metadata:

```ts
expect(getPermissionsMetadata(controller.listDepartments)).toEqual(['department.read']);
expect(getPermissionsMetadata(controller.getDepartmentTree)).toEqual(['department.read']);
expect(getPermissionsMetadata(controller.getDepartmentOptions)).toEqual(['department.read']);
expect(getPermissionsMetadata(controller.getDepartment)).toEqual(['department.read']);
expect(getPermissionsMetadata(controller.createDepartment)).toEqual(['department.create']);
expect(getPermissionsMetadata(controller.updateDepartment)).toEqual(['department.update']);
expect(getPermissionsMetadata(controller.deleteDepartment)).toEqual(['department.delete']);
```

Assert each controller method delegates to the matching service method:

```ts
await controller.listDepartments(query);
expect(service.listDepartments).toHaveBeenCalledWith(query);
await controller.getDepartment('dept-1');
expect(service.findById).toHaveBeenCalledWith('dept-1');
```

Assert literal routes are declared before `:id`, using route metadata or the
existing controller test helper pattern:

```ts
expect(routePaths.indexOf('tree')).toBeLessThan(routePaths.indexOf(':id'));
expect(routePaths.indexOf('options')).toBeLessThan(routePaths.indexOf(':id'));
```

Run:

```bash
pnpm --filter api test -- department.controller.spec.ts
```

Expected: FAIL because controller does not exist.

- [x] **Step 2: Add controller**

Add routes with operation ids:

```text
GET    /departments          listDepartments
GET    /departments/tree     getDepartmentTree
GET    /departments/options  getDepartmentOptions
GET    /departments/:id      getDepartment
POST   /departments          createDepartment
PATCH  /departments/:id      updateDepartment
DELETE /departments/:id      deleteDepartment
```

Use `@HttpCode(204)` for delete.

- [x] **Step 3: Add module and app wiring**

Create `DepartmentModule` exporting `DepartmentService` only if another module
needs it. Import `DepartmentModule` in `apps/api/src/app.module.ts`.

- [x] **Step 4: Run department tests**

Run:

```bash
pnpm --filter api test -- department
```

Expected: PASS.

### Task 6: Implement Position Backend Module

**Files:**
- Create: `apps/api/src/position/position.constants.ts`
- Create: `apps/api/src/position/dto/position.request.ts`
- Create: `apps/api/src/position/dto/position.response.ts`
- Create: `apps/api/src/position/position.mapper.ts`
- Create: `apps/api/src/position/position.service.ts`
- Create: `apps/api/src/position/position.controller.ts`
- Create: `apps/api/src/position/position.module.ts`
- Create: `apps/api/src/position/position.mapper.spec.ts`
- Create: `apps/api/src/position/position.service.spec.ts`
- Create: `apps/api/src/position/position.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [x] **Step 1: Write failing mapper, service, and controller tests**

Cover:

- response DTO date mapping;
- default pagination and `sortOrder:asc`;
- search maps to `code`, `name`, `description`;
- status filter;
- options returns active rows by default;
- options orders by `sortOrder` then `name`;
- options includes disabled records named in `includeIds`;
- options ignores unknown `includeIds`;
- options deduplicates duplicate `includeIds`;
- create success;
- update success;
- duplicate code conflict;
- missing record not found;
- delete rejected with assigned users;
- delete success;
- audit writes on create/update/delete.

Controller tests cover:

- `GET /positions` uses `position.read` and delegates to `listPositions`;
- `GET /positions/options` uses `position.read`, delegates to
  `getPositionOptions`, and is declared before `:id`;
- `GET /positions/:id` uses `position.read` and delegates to `findById`;
- `POST /positions` uses `position.create` and delegates to `createPosition`;
- `PATCH /positions/:id` uses `position.update` and delegates to
  `updatePosition`;
- `DELETE /positions/:id` uses `position.delete`, delegates to
  `deletePosition`, and returns `204`.

Run:

```bash
pnpm --filter api test -- position
```

Expected: FAIL because position module files do not exist.

- [x] **Step 2: Implement constants, DTOs, and mapper**

Use the same structure as department without tree or parent fields.

Allowed sort fields:

```text
name
code
sortOrder
createdAt
updatedAt
```

Operation response fields:

```text
id
code
name
status
sortOrder
description
createdAt
updatedAt
```

- [x] **Step 3: Implement service**

Implement:

```ts
listPositions(query)
getPositionOptions(query)
findById(id)
createPosition(dto, actor?, requestMeta?, auditMetadata?)
updatePosition(id, dto, actor?, requestMeta?, auditMetadata?)
deletePosition(id, actor?, requestMeta?, auditMetadata?)
```

Delete must reject when `UserPosition` rows exist. Audit resource type is
`AUDIT_RESOURCE_TYPES.POSITION`.

- [x] **Step 4: Implement controller and module**

Add routes with operation ids:

```text
GET    /positions          listPositions
GET    /positions/options  getPositionOptions
GET    /positions/:id      getPosition
POST   /positions          createPosition
PATCH  /positions/:id      updatePosition
DELETE /positions/:id      deletePosition
```

Assert `options` route is declared before `:id` in controller tests. Full
OpenAPI operation id assertions are handled in Chunk 3.

Import `PositionModule` in `apps/api/src/app.module.ts`.

- [x] **Step 5: Run position tests**

Run:

```bash
pnpm --filter api test -- position
```

Expected: PASS.

- [x] **Step 6: Commit backend CRUD modules**

Run:

```bash
git add apps/api/src/department apps/api/src/position apps/api/src/app.module.ts
git commit -m "feat(api): add department and position modules"
```

Expected: commit succeeds.

## Chunk 3: User Organization Assignments And API Contract Generation

### Task 7: Extend User DTOs And Mapper

**Files:**
- Modify: `apps/api/src/user/dto/user.request.ts`
- Modify: `apps/api/src/user/dto/user.response.ts`
- Modify: `apps/api/src/user/user.mapper.ts`
- Modify: `apps/api/src/user/user.types.ts`
- Modify: `apps/api/src/user/user.service.spec.ts`

- [x] **Step 1: Write failing mapper tests**

Add tests to `apps/api/src/user/user.service.spec.ts` or a focused mapper test
if one already exists. Assert `toUserResponse` includes:

```ts
expect(response.departments).toEqual([
  expect.objectContaining({
    id: 'dept-1',
    code: 'engineering',
    name: 'Engineering',
    status: 'ACTIVE',
  }),
]);
expect(response.primaryDepartment).toMatchObject({ id: 'dept-1' });
expect(response.positions).toEqual([
  expect.objectContaining({ id: 'pos-1', code: 'developer' }),
]);
```

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: FAIL because response shape does not include organization summaries.

- [x] **Step 2: Add DTO fields**

Update create/update request DTOs:

```ts
departmentIds?: string[];
primaryDepartmentId?: string;
positionIds?: string[];
```

Update `UserListQueryDto`:

```ts
departmentId?: string;
positionId?: string;
```

Use `@IsArray`, `@IsString({ each: true })`, `@IsOptional`, and Swagger
metadata. Keep existing user fields unchanged.

Update response DTOs:

```ts
class UserOrganizationSummaryDto {
  id!: string;
  code!: string;
  name!: string;
  status!: string;
}

departments!: UserOrganizationSummaryDto[];
primaryDepartment!: UserOrganizationSummaryDto | null;
positions!: UserOrganizationSummaryDto[];
```

- [x] **Step 3: Update mapper**

Map included relations:

- departments ordered with primary first, then `sortOrder`, then `name`;
- positions ordered by `sortOrder`, then `name`;
- `primaryDepartment` from the relation with `isPrimary`.

- [x] **Step 4: Run mapper/user tests**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: mapper-related tests PASS or fail only on service assignment logic.

### Task 8: Implement User Assignment Service Logic

**Files:**
- Modify: `apps/api/src/user/user.service.ts`
- Modify: `apps/api/src/user/user.service.spec.ts`

- [x] **Step 1: Write failing assignment tests**

Add tests for:

- create user with departments and positions;
- one selected department defaults as primary;
- multiple departments without primary returns `BadRequestException`;
- primary outside selected departments returns `BadRequestException`;
- missing, disabled, or duplicate department id returns `BadRequestException`;
- missing, disabled, or duplicate position id returns `BadRequestException`;
- update replaces departments when `departmentIds` is provided;
- update clears departments with `departmentIds: []`;
- update leaves departments unchanged when omitted;
- update rejects `primaryDepartmentId` when `departmentIds` is omitted;
- existing disabled department remains when omitted;
- update replaces positions when `positionIds` is provided;
- update clears positions with `positionIds: []`;
- update leaves positions unchanged when omitted;
- existing disabled position remains when omitted;
- list filters by `departmentId` and `positionId`.

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: FAIL because service does not implement assignments.

- [x] **Step 2: Include organization relations in reads**

Update `listUsers`, `findById`, create, and update includes:

```ts
include: {
  roles: { include: { role: true } },
  departments: { include: { department: true } },
  positions: { include: { position: true } },
}
```

Add list filters:

```ts
departments: { some: { departmentId: query.departmentId } }
positions: { some: { positionId: query.positionId } }
```

- [x] **Step 3: Add assignment validation helpers**

Add focused private helpers in `UserService`:

```ts
private normalizeDepartmentAssignment(input): NormalizedDepartmentAssignment
private normalizePositionAssignment(input): string[]
private async resolveActiveDepartments(tx, ids): Promise<Department[]>
private async resolveActivePositions(tx, ids): Promise<Position[]>
```

Rules:

- duplicate ids rejected;
- missing ids rejected;
- disabled ids rejected when submitted;
- one department without primary becomes primary;
- multiple departments require primary;
- empty departments require no primary;
- `primaryDepartmentId` without `departmentIds` on update is rejected because it
  is an ambiguous partial assignment payload.

- [x] **Step 4: Write assignment mutations in transactions**

During create:

- create user;
- create `UserDepartment` rows when `departmentIds` provided;
- create `UserPosition` rows when `positionIds` provided.

During update:

- if `departmentIds` is omitted, do not delete or create department assignments;
- if `departmentIds` is provided, delete existing and recreate submitted rows;
- if `positionIds` is omitted, do not delete or create position assignments;
- if `positionIds` is provided, delete existing and recreate submitted rows.

- [x] **Step 5: Run user service tests**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: PASS.

### Task 9: Verify Backend OpenAPI Contract

**Files:**
- Modify: `apps/api/src/openapi.spec.ts`
- Modify: `apps/api/openapi.json`
- Modify generated: `apps/admin/src/generated/api/`

- [x] **Step 1: Write failing OpenAPI assertions**

Update `apps/api/src/openapi.spec.ts` to assert operation ids:

```ts
expect(operationIds).toEqual(
  expect.arrayContaining([
    'listDepartments',
    'getDepartmentTree',
    'getDepartmentOptions',
    'getDepartment',
    'createDepartment',
    'updateDepartment',
    'deleteDepartment',
    'listPositions',
    'getPositionOptions',
    'getPosition',
    'createPosition',
    'updatePosition',
    'deletePosition',
  ]),
);
```

Also assert user schemas expose `departments`, `primaryDepartment`, and
`positions`.

Assert existing user operation ids remain present, for example:

```ts
expect(operationIds).toEqual(
  expect.arrayContaining([
    'listUsers',
    'getUser',
    'createUser',
    'updateUser',
    'deleteUser',
  ]),
);
```

Run:

```bash
pnpm --filter api test -- openapi.spec.ts
```

Expected: PASS if controllers are correctly decorated; otherwise FAIL and fix
Swagger metadata.

- [x] **Step 2: Generate API client**

Run:

```bash
pnpm api:generate
```

Expected: `apps/api/openapi.json` and files under
`apps/admin/src/generated/api/` update.

- [x] **Step 3: Commit backend user and generated contract files before diff check**

Run:

```bash
git add apps/api/src/user apps/api/src/openapi.spec.ts apps/api/openapi.json apps/admin/src/generated/api
git commit -m "feat(api): add user organization assignments"
```

Expected: commit succeeds with backend user changes and generated contract files.

- [x] **Step 4: Check generated contract**

Run:

```bash
pnpm api:check
```

Expected: PASS after generated files are committed or no diff remains beyond
expected generated output.

- [x] **Step 5: Run backend test slice**

Run:

```bash
pnpm --filter api test -- department position user.service.spec.ts openapi.spec.ts
```

Expected: PASS.

- [x] **Step 6: Confirm no unexpected backend contract diff**

Run:

```bash
git status --short
```

Expected: no unexpected uncommitted backend contract files remain.

## Chunk 4: Admin Frontend Pages, User Form Integration, And Verification

### Task 10: Add Department Frontend Page

**Files:**
- Create: `apps/admin/src/features/departments/departments.types.ts`
- Create: `apps/admin/src/features/departments/departments.columns.tsx`
- Create: `apps/admin/src/features/departments/DepartmentForm.tsx`
- Create: `apps/admin/src/features/departments/DepartmentsPage.tsx`
- Create: `apps/admin/src/features/departments/DepartmentsPage.test.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`

- [x] **Step 1: Write failing page tests**

Mock generated department endpoints and assert:

- loading state renders;
- empty state renders;
- tree/list rows render;
- search and status filter call `listDepartments` with query params;
- create root department submits `createDepartment`;
- create child department submits `parentId`;
- edit submits only changed `parentId` when changed;
- unchanged disabled parent is displayed and omitted from update payload;
- parent selector disables current department and descendants;
- parent selector loads active departments plus current disabled parent through `includeIds`;
- changing parent to a disabled department is prevented in the UI;
- delete confirmation calls `deleteDepartment`;
- action buttons are hidden without create/update/delete permissions;
- API errors use existing normalized error and toast behavior.

Run:

```bash
pnpm --filter admin test -- DepartmentsPage.test.tsx
```

Expected: FAIL because page does not exist.

- [x] **Step 2: Add types and columns**

Use generated schema aliases from `apps/admin/src/generated/api/schemas`.
Keep UI-only types local:

```ts
export type DepartmentRecord = DepartmentResponseDto;
export type DepartmentTreeNode = DepartmentTreeNodeDto;
export interface DepartmentFormValue {
  code: string;
  name: string;
  parentId: string | null;
  status: 'ACTIVE' | 'DISABLED';
  sortOrder: number;
  description?: string;
}
```

- [x] **Step 3: Add DepartmentForm**

Use `react-hook-form` and `zod`. Validate:

- code required, max 80;
- name required, max 120;
- description max 500;
- sort order integer;
- parent id nullable.

Selector labels use `name` with `code` as supporting text when the control shape
supports it.

Parent selector behavior:

- load normal options through `getDepartmentOptions({ status: 'ACTIVE' })`;
- when editing a department with a disabled parent, call
  `getDepartmentOptions({ status: 'ACTIVE', includeIds: currentParentId })`;
- disable the current department and descendants in the selectable options;
- omit unchanged `parentId` from update payloads;
- never submit a disabled changed `parentId`.

- [x] **Step 4: Add DepartmentsPage**

Use generated functions and query key helpers:

```ts
listDepartments
getDepartmentTree
getDepartmentOptions
createDepartment
updateDepartment
deleteDepartment
getListDepartmentsQueryKey
getGetDepartmentTreeQueryKey
```

Keep page state local. Invalidate department list, tree, and options queries
after mutations. Use permission helper for actions. Use the existing normalized
API error helper/toast pattern used by other admin feature pages.
When invalidating options, use the generated options query key helper if Orval
creates one, following the existing `getGet...QueryKey` naming style.

- [x] **Step 5: Add i18n messages**

Add nav, table, form, filter, confirmation, toast, empty-state, and validation
copy in `apps/admin/src/i18n/messages.ts`.

- [x] **Step 6: Run department page tests**

Run:

```bash
pnpm --filter admin test -- DepartmentsPage.test.tsx
```

Expected: PASS.

### Task 11: Add Position Frontend Page

**Files:**
- Create: `apps/admin/src/features/positions/positions.types.ts`
- Create: `apps/admin/src/features/positions/positions.columns.tsx`
- Create: `apps/admin/src/features/positions/PositionForm.tsx`
- Create: `apps/admin/src/features/positions/PositionsPage.tsx`
- Create: `apps/admin/src/features/positions/PositionsPage.test.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`

- [ ] **Step 1: Write failing page tests**

Mock generated position endpoints and assert:

- loading state renders;
- empty state renders;
- returned rows render;
- search, status filter, pagination, and sorting update query params;
- create submits `createPosition`;
- edit submits `updatePosition`;
- delete confirmation calls `deletePosition`;
- action buttons are hidden without create/update/delete permissions;
- API errors use existing normalized error and toast behavior.

Run:

```bash
pnpm --filter admin test -- PositionsPage.test.tsx
```

Expected: FAIL because page does not exist.

- [ ] **Step 2: Add types, columns, and form**

Use generated schema aliases and a `PositionFormValue` with:

```ts
code
name
status
sortOrder
description
```

Validation mirrors backend DTOs.

- [ ] **Step 3: Add PositionsPage**

Use shared `DataTable`, `DataTableToolbar`, and generated endpoints:

```ts
listPositions
createPosition
updatePosition
deletePosition
getListPositionsQueryKey
```

Keep synthetic action columns unsortable.
Use the existing normalized API error helper/toast pattern used by other admin
feature pages.

- [ ] **Step 4: Add i18n messages**

Add position nav, table, form, confirmation, toast, empty-state, and validation
copy.

- [ ] **Step 5: Run position page tests**

Run:

```bash
pnpm --filter admin test -- PositionsPage.test.tsx
```

Expected: PASS.

### Task 12: Wire Routes And Menu

**Files:**
- Modify: `apps/admin/src/routes/admin-route-registry.tsx`
- Modify: `apps/admin/src/routes/admin-route-registry.test.tsx`
- Modify: `apps/admin/src/layouts/AdminShell.test.tsx`
- Modify: `apps/admin/src/routes/router.test.tsx`

- [ ] **Step 1: Write failing route tests**

Assert:

```ts
expect(findAdminRouteByPath('/departments')).toMatchObject({
  requiredPermissions: ['department.read'],
});
expect(findAdminRouteByPath('/positions')).toMatchObject({
  requiredPermissions: ['position.read'],
});
```

Add visibility checks with and without read permissions.
Add direct access checks that unauthorized navigation to `/departments` and
`/positions` resolves to `/403`.

Run:

```bash
pnpm --filter admin test -- admin-route-registry.test.tsx router.test.tsx AdminShell.test.tsx
```

Expected: FAIL because routes are not registered.

- [ ] **Step 2: Add route metadata**

Import pages and icons. Add route entries:

```ts
export const departmentsRoute: AdminRouteMeta = {
  id: 'departments',
  path: '/departments',
  labelKey: 'nav.departments',
  requiredPermissions: ['department.read'],
  component: DepartmentsPage,
  icon: Building2,
};

export const positionsRoute: AdminRouteMeta = {
  id: 'positions',
  path: '/positions',
  labelKey: 'nav.positions',
  requiredPermissions: ['position.read'],
  component: PositionsPage,
  icon: BriefcaseBusiness,
};
```

Add both to the existing system group.

- [ ] **Step 3: Run route tests**

Run:

```bash
pnpm --filter admin test -- admin-route-registry.test.tsx router.test.tsx AdminShell.test.tsx
```

Expected: PASS.

### Task 13: Extend User Form And User List

**Files:**
- Modify: `apps/admin/src/features/users/users.types.ts`
- Modify: `apps/admin/src/features/users/users.columns.tsx`
- Modify: `apps/admin/src/features/users/UserForm.tsx`
- Modify: `apps/admin/src/features/users/UsersPage.tsx`
- Modify: `apps/admin/src/features/users/UsersPage.test.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`

- [ ] **Step 1: Write failing user page tests**

Add tests for:

- organization fields render in create and edit forms;
- department options drive primary department options;
- edit forms call `getDepartmentOptions` with active status plus `includeIds`
  for currently assigned disabled department ids;
- edit forms call `getPositionOptions` with active status plus `includeIds` for
  currently assigned disabled position ids;
- one selected department defaults as primary;
- changing departments clears invalid primary;
- create payload includes `departmentIds`, `primaryDepartmentId`, `positionIds`;
- update payload omits unchanged assignment fields;
- editing unrelated fields on a user with disabled assignments preserves them;
- department and position filters pass `departmentId` and `positionId`;
- table renders primary department and position summaries.

Run:

```bash
pnpm --filter admin test -- UsersPage.test.tsx
```

Expected: FAIL because UI does not include organization fields.

- [ ] **Step 2: Update user types and columns**

Use generated user response fields. Add columns for:

- primary department;
- positions summary.

Keep these columns unsortable unless backend supports their sort fields.

- [ ] **Step 3: Update UserForm**

Load department and position options in `UsersPage` and pass them into
`UserForm`.

For edit forms, load selector options as:

```ts
getDepartmentOptions({
  status: 'ACTIVE',
  includeIds: assignedDepartmentIds.join(',') || undefined,
});
getPositionOptions({
  includeIds: assignedPositionIds.join(',') || undefined,
});
```

The included disabled options are displayable for historical assignments but
must not be newly selectable once removed.

Implement form behavior:

- department multi-select stores selected department ids;
- primary department select is derived from selected department ids;
- one selected department auto-selects primary;
- no departments clears primary;
- position multi-select stores selected position ids;
- create submits all organization assignment fields;
- update compares loaded organization ids to current form values and omits
  unchanged assignment fields from PATCH payload.

- [ ] **Step 4: Update UsersPage filters**

Add department and position filters using generated options endpoints:

```ts
getDepartmentOptions
getPositionOptions
```

Pass selected filter values to `listUsers` as `departmentId` and `positionId`.
Filters use active options by default and do not need `includeIds`.

- [ ] **Step 5: Add i18n messages**

Add labels and validation copy for department assignments, primary department,
position assignments, department filter, and position filter.

- [ ] **Step 6: Run user page tests**

Run:

```bash
pnpm --filter admin test -- UsersPage.test.tsx
```

Expected: PASS.

### Task 14: Full Verification And Final Commit

**Files:**
- All files changed in chunks 1-4

- [ ] **Step 1: Run API contract check**

Run:

```bash
pnpm api:check
```

Expected: PASS with no generated API diff.

- [ ] **Step 2: Run backend tests**

Run:

```bash
pnpm --filter api exec jest --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
pnpm --filter admin test
```

Expected: PASS.

- [ ] **Step 4: Run builds**

Run:

```bash
pnpm --filter api build
pnpm --filter admin build
```

Expected: both PASS.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm --filter api lint
pnpm --filter admin lint
```

Expected: both PASS.

- [ ] **Step 6: Browser smoke test**

Start the app:

```bash
pnpm dev
```

Open the admin app and smoke test:

- `/departments` loads and supports create/edit/delete;
- `/positions` loads and supports create/edit/delete;
- `/users` shows organization fields and filters;
- editing a user with disabled existing assignments shows those assignments and
  omits unchanged assignment fields from PATCH payloads;
- route/menu visibility respects permissions.

Expected: pages render without console errors and without overlapping UI.

- [ ] **Step 7: Commit frontend and verification work**

Run:

```bash
git add apps/admin apps/api/openapi.json apps/admin/src/generated/api
git commit -m "feat(admin): add organization management UI"
```

Expected: commit succeeds.

- [ ] **Step 8: Capture final status**

Run:

```bash
git status --short
```

Expected: no unexpected uncommitted changes.
