# Data Permission Framework Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-level data scopes and enforce them on user management list, detail, create, and write operations.

**Architecture:** Extend the existing RBAC role and cached permission context with an effective data scope. Add a focused `DataPermissionService` for user visibility predicates and department assignment checks. Keep `@Permissions()` as the API capability gate, and explicitly apply row-level checks inside `UserService`.

**Tech Stack:** NestJS, Prisma, PostgreSQL migrations, Redis-backed permission context cache, Jest, Vite React, React Hook Form, Zod, React Query, Orval.

---

## File Structure

Backend model and seed:

- Modify `apps/api/prisma/schema.prisma`: add `DataScope`, `Role.dataScope`, `RoleDataScopeDepartment`, and relations.
- Create `apps/api/prisma/migrations/*_add_data_permissions/migration.sql`: Prisma-generated migration.
- Modify `apps/api/prisma/seed.ts`: use system role seed helper.
- Create `apps/api/prisma/seed-system-roles.ts`: pure system role seed payload builder.
- Create `apps/api/src/permission/system-role-seed.spec.ts`: direct seed payload tests.

Backend permission context and role API:

- Modify `apps/api/src/permission/permission.types.ts`: add `EffectiveDataScope`.
- Modify `apps/api/src/permission/permission.service.ts`: resolve effective data scope.
- Modify `apps/api/src/permission/permission.service.spec.ts`: scope merge tests.
- Modify `apps/api/src/auth/permissions.guard.spec.ts`: update mocked permission contexts.
- Modify `apps/api/src/role/dto/role.request.ts`: accept data scope fields.
- Modify `apps/api/src/role/dto/role.response.ts`: expose data scope fields.
- Modify `apps/api/src/role/role.mapper.ts`: map data scope and custom departments.
- Modify `apps/api/src/role/role.service.ts`: validate and persist role data scope.
- Modify `apps/api/src/role/role.service.spec.ts`: role data scope tests.
- Modify `apps/api/src/role/role.controller.spec.ts`: DTO/metadata compatibility tests.

Backend enforcement:

- Create `apps/api/src/data-permission/data-permission.module.ts`: export data permission service.
- Create `apps/api/src/data-permission/data-permission.service.ts`: build user visibility where clauses and assertions.
- Create `apps/api/src/data-permission/data-permission.service.spec.ts`: focused unit tests.
- Modify `apps/api/src/user/user.module.ts`: import data permission module.
- Modify `apps/api/src/user/user.controller.ts`: pass actor id to service methods.
- Modify `apps/api/src/user/user.service.ts`: apply data scope rules.
- Modify `apps/api/src/user/user.service.spec.ts`: constructor/signature compatibility tests.
- Create `apps/api/src/user/user-data-permission.spec.ts`: scoped user behavior tests.
- Modify `apps/api/src/department/department.module.ts`: import permission module.
- Modify `apps/api/src/department/department.service.ts`: invalidate contexts after department tree/status changes.
- Modify `apps/api/src/department/department.service.spec.ts`: invalidation tests.
- Modify `apps/api/src/auth/auth-flow.spec.ts`: integration coverage for RBAC versus data scope.

Frontend and generated API:

- Regenerate `apps/api/openapi.json`.
- Regenerate `apps/admin/src/generated/api/`.
- Modify `apps/admin/src/features/roles/roles.types.ts`: consume generated data scope types.
- Modify `apps/admin/src/features/roles/RoleForm.tsx`: data scope select and custom department checkboxes.
- Modify `apps/admin/src/features/roles/RolesPage.tsx`: department options query and form props.
- Modify `apps/admin/src/features/roles/roles.columns.tsx`: data scope column.
- Modify `apps/admin/src/features/roles/RolesPage.test.tsx`: role UI tests.
- Modify `apps/admin/src/i18n/messages.ts`: role data-scope labels and validation text.

## Chunk 1: Data Model And Seed

### Task 1: Add Prisma Data Scope Model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/*_add_data_permissions/migration.sql`

- [ ] **Step 1: Update Prisma schema**

Add:

```prisma
enum DataScope {
  ALL
  SELF
  DEPT
  DEPT_AND_CHILDREN
  CUSTOM_DEPT
}
```

Add to `Role`:

```prisma
dataScope            DataScope                 @default(SELF)
dataScopeDepartments RoleDataScopeDepartment[]
```

Add to `Department`:

```prisma
roleDataScopes RoleDataScopeDepartment[]
```

Add:

```prisma
model RoleDataScopeDepartment {
  roleId       String
  departmentId String
  createdAt    DateTime @default(now())

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  department Department @relation(fields: [departmentId], references: [id])

  @@id([roleId, departmentId])
  @@index([departmentId])
}
```

- [ ] **Step 2: Generate migration**

Run:

```bash
pnpm --filter api db:migrate -- --name add_data_permissions
```

Expected: Prisma creates a migration and regenerates the client.

- [ ] **Step 3: Inspect migration**

Confirm SQL:

- creates enum `DataScope`;
- adds `Role.dataScope` defaulting to `SELF`, so existing role rows migrate safely;
- creates `RoleDataScopeDepartment`;
- adds a `departmentId` index;
- cascades delete from role to role data-scope links.

- [ ] **Step 4: Verify generated Prisma types**

Run:

```bash
pnpm --filter api db:generate
pnpm --filter api build
```

Expected: both commands pass, proving `DataScope`, `Role.dataScope`, and
`RoleDataScopeDepartment` types are available.

### Task 2: Seed System Role Data Scopes

**Files:**
- Modify: `apps/api/prisma/seed.ts`
- Create: `apps/api/prisma/seed-system-roles.ts`
- Create: `apps/api/src/permission/system-role-seed.spec.ts`

- [ ] **Step 1: Create system role seed helper**

Create `buildSystemRoleUpserts()`:

```ts
import { SYSTEM_ROLE_CODES } from '../src/permission/permission.constants';

export function buildSystemRoleUpserts() {
  return [
    {
      code: SYSTEM_ROLE_CODES.superAdmin,
      name: 'Super admin',
      description: 'Full access to every active permission',
      status: 'ACTIVE' as const,
      isSystem: true,
      isDefault: false,
      dataScope: 'ALL' as const,
    },
    {
      code: SYSTEM_ROLE_CODES.admin,
      name: 'Admin',
      description: 'Default administrator role',
      status: 'ACTIVE' as const,
      isSystem: true,
      isDefault: false,
      dataScope: 'ALL' as const,
    },
    {
      code: SYSTEM_ROLE_CODES.standard,
      name: 'Standard',
      description: 'Default role for newly created users',
      status: 'ACTIVE' as const,
      isSystem: true,
      isDefault: true,
      dataScope: 'SELF' as const,
    },
  ];
}
```

- [ ] **Step 2: Use helper in seed**

Replace the repeated system role upserts in `apps/api/prisma/seed.ts` with a
loop over `buildSystemRoleUpserts()`. The upsert `update` and `create` payloads
must both include `dataScope`.

- [ ] **Step 3: Add seed tests**

In `system-role-seed.spec.ts`, assert:

```ts
const roles = buildSystemRoleUpserts();
const rolesByCode = new Map(roles.map((role) => [role.code, role]));

expect(rolesByCode.get('super_admin')?.dataScope).toBe('ALL');
expect(rolesByCode.get('admin')?.dataScope).toBe('ALL');
expect(rolesByCode.get('standard')?.dataScope).toBe('SELF');
```

Also assert each payload has the fields needed by `seed.ts`:

```ts
expect(roles).toHaveLength(3);
expect(rolesByCode.get('admin')).toMatchObject({
  status: 'ACTIVE',
  isSystem: true,
  dataScope: 'ALL',
});
expect(roles.some((role) => 'dataScopeDepartments' in role)).toBe(false);
```

- [ ] **Step 4: Run seed tests and seed command**

Run:

```bash
pnpm --filter api test -- permission-seed system-role-seed
pnpm --filter api db:seed
```

Expected: both commands pass, proving `seed.ts` can import and use
`seed-system-roles.ts`.

- [ ] **Step 5: Commit chunk 1**

```bash
git add apps/api/prisma apps/api/src/permission/system-role-seed.spec.ts
git commit -m "feat(api): add data scope schema and seed"
```

## Chunk 2: Permission Context And Role API

### Task 3: Extend Permission Context Types

**Files:**
- Modify: `apps/api/src/permission/permission.types.ts`
- Modify: `apps/api/src/auth/permissions.guard.spec.ts`

- [ ] **Step 1: Add effective data scope type**

Add:

```ts
export type EffectiveDataScope =
  | { mode: 'ALL'; selfUserIds: []; departmentIds: [] }
  | { mode: 'LIMITED'; selfUserIds: string[]; departmentIds: string[] };
```

Extend `UserPermissionContext`:

```ts
dataScope: EffectiveDataScope;
```

- [ ] **Step 2: Update permission guard test mocks**

Every mocked `resolveUserPermissionContext()` return should include either:

```ts
dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
```

or:

```ts
dataScope: { mode: 'ALL', selfUserIds: [], departmentIds: [] },
```

- [ ] **Step 3: Run type-adjacent tests**

Run:

```bash
pnpm --filter api test -- permissions.guard.spec.ts
```

Expected: PASS.

### Task 4: Resolve Effective Data Scope

**Files:**
- Modify: `apps/api/src/permission/permission.service.ts`
- Modify: `apps/api/src/permission/permission.service.spec.ts`

- [ ] **Step 1: Write failing data-scope context tests**

Add concrete Arrange/Act/Assert tests:

- `super_admin` active role returns `{ mode: 'ALL', selfUserIds: [], departmentIds: [] }`.
- any active role with `dataScope: 'ALL'` returns `ALL`.
- `SELF` returns `LIMITED` with `selfUserIds: [user.id]`.
- `DEPT` returns active current-user departments.
- `DEPT_AND_CHILDREN` queries descendants and returns parent plus active children.
- `CUSTOM_DEPT` returns only linked departments whose `department.status` is `ACTIVE`.
- disabled roles do not contribute.
- duplicate department ids from multiple roles are sorted and de-duplicated.
- limited users with no departments return `LIMITED` with both arrays empty.

Use mocked Prisma payloads with `roles.role.dataScope`,
`roles.role.dataScopeDepartments`, and `departments.department.status`.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter api test -- permission.service.spec.ts
```

Expected: FAIL because `PermissionService` does not yet load or return
`dataScope`.

- [ ] **Step 3: Define Prisma-safe loaded payload types**

Use `Prisma.validator` and `Prisma.UserGetPayload` rather than private method
return types:

```ts
const userPermissionContextArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: {
    departments: { include: { department: true } },
    roles: {
      include: {
        role: {
          include: {
            dataScopeDepartments: { include: { department: true } },
            permissions: { include: { permission: true } },
          },
        },
      },
    },
  },
});

type LoadedPermissionUser = Prisma.UserGetPayload<
  typeof userPermissionContextArgs
>;
type LoadedRole = LoadedPermissionUser['roles'][number]['role'];
```

- [ ] **Step 4: Update query and helpers**

Load the new includes in `loadUserPermissionContext()`. Add helpers:

```ts
private async buildEffectiveDataScope(
  user: LoadedPermissionUser,
  activeRoles: LoadedRole[],
): Promise<EffectiveDataScope>

private async listActiveDescendantDepartmentIds(rootIds: string[]): Promise<string[]>
private toUniqueSorted(values: string[]): string[]
```

Rules:

- `isSuperAdmin` or any active `ALL` role returns `ALL`.
- `SELF` adds the current user id.
- `DEPT` adds active current-user departments.
- `DEPT_AND_CHILDREN` adds active current-user departments and active descendants.
- `CUSTOM_DEPT` adds active linked departments only.
- limited empty scope never falls back to full access.

- [ ] **Step 5: Run context tests**

Run:

```bash
pnpm --filter api test -- permission.service.spec.ts permissions.guard.spec.ts
```

Expected: PASS.

### Task 5: Extend Role DTOs And Mapper

**Files:**
- Modify: `apps/api/src/role/dto/role.request.ts`
- Modify: `apps/api/src/role/dto/role.response.ts`
- Modify: `apps/api/src/role/role.mapper.ts`
- Modify: `apps/api/src/role/role.controller.spec.ts`

- [ ] **Step 1: Add request DTO fields**

Add optional fields to create and update DTOs:

```ts
@ApiPropertyOptional({ enum: DataScope })
@IsOptional()
@IsEnum(DataScope)
dataScope?: DataScope;

@ApiPropertyOptional({ type: [String] })
@IsOptional()
@IsArray()
@IsString({ each: true })
dataScopeDepartmentIds?: string[];
```

- [ ] **Step 2: Add response DTO fields**

Add `RoleDataScopeDepartmentDto` with `id`, `code`, `name`, and
`status: DepartmentStatus`.

Extend `RoleResponseDto`:

```ts
@ApiProperty({ enum: DataScope })
dataScope!: DataScope;

@ApiProperty({ type: [RoleDataScopeDepartmentDto] })
dataScopeDepartments!: RoleDataScopeDepartmentDto[];
```

- [ ] **Step 3: Update mapper**

`toRoleResponse()` should always return:

```ts
dataScope: role.dataScope,
dataScopeDepartments: (role.dataScopeDepartments ?? [])
  .map((link) => ({
    id: link.department.id,
    code: link.department.code,
    name: link.department.name,
    status: link.department.status,
  }))
  .sort((a, b) => a.code.localeCompare(b.code)),
```

Stored disabled links must remain in responses. Effective access filtering
happens in `PermissionService`, not in this mapper.

Add or update a mapper/service assertion that non-`CUSTOM_DEPT` roles serialize
`dataScopeDepartments: []`.

- [ ] **Step 4: Run role controller tests**

Run:

```bash
pnpm --filter api test -- role.controller.spec.ts
```

Expected: PASS after fixtures include `dataScope` and `dataScopeDepartments`.

### Task 6: Persist And Validate Role Data Scopes

**Files:**
- Modify: `apps/api/src/role/role.service.ts`
- Modify: `apps/api/src/role/role.service.spec.ts`

- [ ] **Step 1: Write failing role service tests**

Add concrete tests:

- create with no `dataScope` persists `SELF`.
- create with non-custom scopes and no department ids succeeds.
- create with `CUSTOM_DEPT` persists nested department links.
- `CUSTOM_DEPT` without ids rejects with `BadRequestException`.
- duplicate custom department ids reject with `BadRequestException`.
- disabled custom departments reject with `BadRequestException`.
- non-custom scope with department ids rejects with `BadRequestException`.
- update from `CUSTOM_DEPT` to `SELF` clears links.
- update from `SELF` to `CUSTOM_DEPT` replaces links.
- role responses include disabled stored links.
- role create/update/delete invalidates all contexts only after successful transaction.
- create/update audit snapshots include ordered `dataScopeDepartments` DTOs.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter api test -- role.service.spec.ts
```

Expected: FAIL because data-scope validation and persistence do not exist.

- [ ] **Step 3: Update role includes**

Include:

```ts
dataScopeDepartments: { include: { department: true } },
```

in role include constants used for list/detail/audit response mapping.

- [ ] **Step 4: Add validation helper**

Add:

```ts
private async resolveDataScopeDepartmentIds(
  tx: Pick<Prisma.TransactionClient, 'department'>,
  dataScope: DataScope,
  departmentIds?: string[],
): Promise<string[]>
```

Rules:

- missing scope defaults to `DataScope.SELF`;
- `CUSTOM_DEPT` requires at least one unique id;
- selected departments must exist and be `DepartmentStatus.ACTIVE`;
- non-custom scopes reject non-empty ids.

- [ ] **Step 5: Update createRole**

Create data should be Prisma-safe:

```ts
const roleData: Prisma.RoleCreateInput = {
  code: dto.code,
  name: dto.name,
  description: dto.description,
  isDefault: dto.isDefault ?? false,
  dataScope,
  ...(departmentIds.length
    ? {
        dataScopeDepartments: {
          createMany: {
            data: departmentIds.map((departmentId) => ({ departmentId })),
          },
        },
      }
    : {}),
};
```

- [ ] **Step 6: Update updateRole**

Never pass `dataScopeDepartmentIds` into `tx.role.update({ data })`.

Use explicit operations:

- update scalar role fields with `Prisma.RoleUpdateInput`;
- when next scope is non-custom, delete all existing custom links;
- when next scope is `CUSTOM_DEPT`, delete existing links then create submitted links;
- keep existing links when updating unrelated role fields.

- [ ] **Step 7: Preserve audit and invalidation**

Audit `before` and `after` snapshots should use `toRoleResponse()` so they
include `dataScope` and ordered `dataScopeDepartments`.

Call:

```ts
await this.permissionService.invalidateAllPermissionContexts();
```

only after the transaction succeeds.

- [ ] **Step 8: Run role tests**

Run:

```bash
pnpm --filter api test -- role.service.spec.ts role.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Commit chunk 2**

```bash
git add apps/api/src/permission apps/api/src/auth apps/api/src/role
git commit -m "feat(api): resolve role data scopes"
```

## Chunk 3: User Data Permission Enforcement

### Task 7: Add DataPermissionService

**Files:**
- Create: `apps/api/src/data-permission/data-permission.module.ts`
- Create: `apps/api/src/data-permission/data-permission.service.ts`
- Create: `apps/api/src/data-permission/data-permission.service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Add tests for:

- `ALL` returns `{}`.
- `SELF` returns `{ OR: [{ id: { in: ['actor-1'] } }] }` for an actor with
  self scope.
- limited departments return a `departments.some.departmentId.in` predicate.
- empty limited scope returns `{ id: { in: [] } }`.
- `assertCanAccessUser()` resolves for visible target.
- `assertCanAccessUser()` throws `NotFoundException('User not found')` for invisible target.
- `assertCanAssignDepartments()` allows `ALL`.
- `assertCanAssignDepartments()` rejects out-of-scope ids with `BadRequestException`.

- [ ] **Step 2: Implement service**

Use `permissionService.resolveUserPermissionContext(actorUserId)` as the only
scope source. Do not add a second resolver path, resource DSL, or decorators.

Methods:

```ts
async buildUserVisibilityWhere(actorUserId: string): Promise<Prisma.UserWhereInput>
async assertCanAccessUser(actorUserId: string, targetUserId: string): Promise<void>
async assertCanAssignDepartments(actorUserId: string, departmentIds: string[]): Promise<void>
```

- [ ] **Step 3: Implement module**

```ts
@Module({
  imports: [PrismaModule, PermissionModule],
  providers: [DataPermissionService],
  exports: [DataPermissionService],
})
export class DataPermissionModule {}
```

- [ ] **Step 4: Run data permission tests**

Run:

```bash
pnpm --filter api test -- data-permission.service.spec.ts
```

Expected: PASS.

### Task 8: Apply Data Scope To UserService

**Files:**
- Modify: `apps/api/src/user/user.module.ts`
- Modify: `apps/api/src/user/user.controller.ts`
- Modify: `apps/api/src/user/user.service.ts`
- Modify: `apps/api/src/user/user.controller.spec.ts`
- Modify: `apps/api/src/user/user.service.spec.ts`
- Create: `apps/api/src/user/user-data-permission.spec.ts`

- [ ] **Step 1: Wire dependency and signatures**

Import `DataPermissionModule`, inject `DataPermissionService`, and pass
`@CurrentUser().sub` into:

- `listUsers`;
- `getUser`;
- `createUser`;
- `updateUser`;
- `deleteUser`;
- `resetPassword`;
- `replaceRoles`.

- [ ] **Step 2: Write focused user data-scope tests**

In `user-data-permission.spec.ts`, cover:

- list combines base filters and visibility with `AND`;
- detail checks visibility before returning;
- `GET /users/me` path remains unscoped through `findProfileById`;
- create with departments calls `assertCanAssignDepartments`;
- create without departments does not call assignment assertion;
- update/delete/reset/replaceRoles reject out-of-scope targets with `NotFoundException('User not found')`;
- rejected write tests verify no mutation method is called.

Keep `user.service.spec.ts` changes limited to constructor/mock compatibility.

- [ ] **Step 3: Implement list/detail enforcement**

Use:

```ts
const baseWhere = this.buildUserWhere(query);
const visibilityWhere =
  await this.dataPermissionService.buildUserVisibilityWhere(actorUserId);
const where: Prisma.UserWhereInput = { AND: [baseWhere, visibilityWhere] };
```

Call `assertCanAccessUser(actorUserId, id)` before detail lookup.

- [ ] **Step 4: Implement create/write enforcement**

For create:

```ts
if (departmentIds?.length) {
  await this.dataPermissionService.assertCanAssignDepartments(
    actorUserId,
    departmentIds,
  );
}
```

For update/delete/reset/replaceRoles, call:

```ts
await this.dataPermissionService.assertCanAccessUser(actorUserId, id);
```

before mutation.

- [ ] **Step 5: Invalidate user context after committed department changes**

Call `permissionService.invalidateUserPermissionContext(targetUserId)` only
after the transaction successfully commits and only when department assignments
changed.

- [ ] **Step 6: Run focused user tests**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts user.controller.spec.ts user-data-permission.spec.ts
```

Expected: PASS.

### Task 9: Invalidate Contexts On Department Changes

**Files:**
- Modify: `apps/api/src/department/department.module.ts`
- Modify: `apps/api/src/department/department.service.ts`
- Modify: `apps/api/src/department/department.service.spec.ts`

- [ ] **Step 1: Inject PermissionService**

Import `PermissionModule` and inject `PermissionService`.

- [ ] **Step 2: Add tests**

Assert create/update/delete call `invalidateAllPermissionContexts()` only after
successful transaction. `updateDepartment()` coverage must include status and
parent changes.

- [ ] **Step 3: Add invalidation calls**

After successful create/update/delete transactions, call:

```ts
await this.permissionService.invalidateAllPermissionContexts();
```

- [ ] **Step 4: Run department tests**

Run:

```bash
pnpm --filter api test -- department.service.spec.ts
```

Expected: PASS.

### Task 10: Add Integration Coverage

**Files:**
- Modify: `apps/api/src/auth/auth-flow.spec.ts`

- [ ] **Step 1: Update permission context mock shape**

Extend the local `permissionContexts` map values with `dataScope`. Existing
tests can use empty limited scope unless they need all access:

```ts
dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
```

- [ ] **Step 2: Add deterministic fixtures**

Use helper functions in the spec to create:

- `selfUser`: has `user.read`, `dataScope: { mode: 'LIMITED', selfUserIds: ['self-1'], departmentIds: [] }`;
- `deptUser`: has `user.read`, department scope for `engineering`;
- `customUser`: has department scope for `platform`;
- `marketingTarget`: belongs to `marketing`;
- `superAdmin`: has `isSuperAdmin: true`, `dataScope: ALL`.

Mock `prisma.user.findMany`, `prisma.user.count`, and write methods so they
respect the visibility `where` passed by `UserService`. Do not rely on seed
order or shared state.

- [ ] **Step 3: Add integration tests**

Add:

- self-scoped `GET /api/users` returns only self;
- out-of-scope `PATCH /api/users/:id` returns `404` with message `User not found` and does not call `prisma.user.update`;
- super admin can read and mutate all users;
- missing RBAC permission still returns `403`.

- [ ] **Step 4: Run integration spec**

Run:

```bash
pnpm --filter api test -- auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit chunk 3**

```bash
git add apps/api/src/data-permission apps/api/src/user apps/api/src/department apps/api/src/auth
git commit -m "feat(api): enforce user data permissions"
```

## Chunk 4: Frontend And Generated API

### Task 11: Regenerate API Contracts

**Files:**
- Modify: `apps/api/openapi.json`
- Modify: `apps/admin/src/generated/api/`

- [ ] **Step 1: Generate API**

Run:

```bash
pnpm api:generate
```

Expected: generated role schemas include `dataScope` and
`dataScopeDepartments`.

- [ ] **Step 2: Inspect generated files**

Check:

- `apps/admin/src/generated/api/schemas/roleResponseDto.ts`;
- `apps/admin/src/generated/api/schemas/createRoleDto.ts`;
- `apps/admin/src/generated/api/schemas/updateRoleDto.ts`;
- `apps/admin/src/generated/api/endpoints/roles/roles.ts`.

Expected: role create/update/response contracts include data scope fields.

### Task 12: Add Role Form Data Scope Controls

**Files:**
- Modify: `apps/admin/src/features/roles/roles.types.ts`
- Modify: `apps/admin/src/features/roles/RoleForm.tsx`
- Modify: `apps/admin/src/features/roles/RolesPage.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`
- Modify: `apps/admin/src/features/roles/RolesPage.test.tsx`

- [ ] **Step 1: Add form values and validation**

Add:

```ts
dataScope: RoleRecord['dataScope']
dataScopeDepartmentIds: string[]
```

Default active submitted ids should exclude disabled linked departments:

```ts
dataScopeDepartmentIds:
  initialValue?.dataScopeDepartments
    .filter((department) => department.status === 'ACTIVE')
    .map((department) => department.id) ?? [],
```

Add Zod validation requiring at least one active id for `CUSTOM_DEPT`.

- [ ] **Step 2: Add department option props and rendering**

Use checkboxes, not a custom multi-select:

```ts
departmentOptions: Array<{ value: string; label: string; status: string }>
isDepartmentOptionsLoading: boolean
```

Render disabled linked departments as disabled checked/visible rows in edit
mode. They are display-only and must not be included in submitted ids.

- [ ] **Step 3: Fetch and merge department options**

In `RolesPage.tsx`, import:

```ts
import {
  getDepartmentOptions,
  getGetDepartmentOptionsQueryKey,
} from '../../generated/api/endpoints/departments/departments'
```

Query active departments when the role form is open. Merge disabled
`initialValue.dataScopeDepartments` into the displayed options for edit mode.

- [ ] **Step 4: Normalize submit payload**

For non-custom scopes, omit `dataScopeDepartmentIds`. For custom scope, submit
only active selected ids:

```ts
const activeOptionIds = new Set(
  departmentOptions
    .filter((department) => department.status === 'ACTIVE')
    .map((department) => department.value),
);
const dataScopeDepartmentIds =
  value.dataScope === 'CUSTOM_DEPT'
    ? value.dataScopeDepartmentIds.filter((id) => activeOptionIds.has(id))
    : undefined;
```

- [ ] **Step 5: Add frontend tests**

In `RolesPage.test.tsx`, assert:

- create form submits `dataScope: 'SELF'` by default;
- department checkboxes appear only for `CUSTOM_DEPT`;
- custom scope submit sends selected active `dataScopeDepartmentIds`;
- edit form displays disabled linked departments but does not submit disabled ids;
- existing RBAC action hiding still works without `role.update`, `role.delete`, or `role.assign_permissions`.

- [ ] **Step 6: Run role page tests**

Run:

```bash
pnpm --filter admin test -- RolesPage.test.tsx
```

Expected: PASS.

### Task 13: Display Data Scope In Role Table

**Files:**
- Modify: `apps/admin/src/features/roles/roles.columns.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`
- Modify: `apps/admin/src/features/roles/RolesPage.test.tsx`

- [ ] **Step 1: Add column**

Render labels:

```text
All
Self
Department
Department and children
Custom departments
```

For custom scope, display `Custom departments (N)` using
`role.dataScopeDepartments.length`.

- [ ] **Step 2: Add table test**

Render roles with `ALL`, `SELF`, and `CUSTOM_DEPT`, and assert the visible
labels including the custom count.

- [ ] **Step 3: Run role page tests**

Run:

```bash
pnpm --filter admin test -- RolesPage.test.tsx
```

Expected: PASS.

### Task 14: Run Final Gates

**Files:**
- Verify all changed files

- [ ] **Step 1: Check API generation drift**

Run:

```bash
pnpm api:check
```

Expected: PASS and `git diff --exit-code apps/api/openapi.json apps/admin/src/generated/api` has no diff.

- [ ] **Step 2: Run focused backend tests**

Run:

```bash
pnpm --filter api test -- permission.service.spec.ts role.service.spec.ts user.service.spec.ts user-data-permission.spec.ts data-permission.service.spec.ts department.service.spec.ts auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run focused frontend tests**

Run:

```bash
pnpm --filter admin test -- RolesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run full quality gate**

Run:

```bash
pnpm quality
```

Expected: PASS.

- [ ] **Step 5: Commit chunk 4**

```bash
git add apps/api/openapi.json apps/admin/src/generated/api apps/admin/src/features/roles apps/admin/src/i18n/messages.ts
git commit -m "feat(admin): configure role data scopes"
```

## Notes For Execution

- Do not hand-edit generated API files. Fix DTOs and regenerate.
- Do not add data-scope decorators in this implementation.
- Do not apply data scopes to department, role, permission, setting, audit-log,
  file, or session list endpoints in this implementation.
- Inaccessible user targets must return `NotFoundException('User not found')`,
  while missing RBAC permissions remain `403`.
- Keep commits small. If unrelated failures appear, report them instead of
  refactoring across modules.
