# RBAC Permission Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-role `ADMIN` / `STANDARD` authorization model with multi-role RBAC, system-seeded permission codes, backend `@Permissions()` guards, permission-aware user/role APIs, and frontend menu/route/action permission checks.

**Architecture:** Add Prisma RBAC tables first, then introduce permission registry, seed synchronization, permission resolution, and a new permissions guard while the old role guard still exists. Migrate controllers, auth/user payloads, frontend session state, routes, menus, and buttons to permission codes, then remove the old `Role` enum and `User.role` field in the same change set.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis via ioredis, JWT, class-validator, Swagger, Jest, React, Vite, TypeScript, TanStack Query, Axios, Zustand, Vitest, React Testing Library, Tailwind CSS, lucide-react.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-09-rbac-permission-design.md`
- CRUD permission pattern: `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`
- CRUD table pattern: `docs/patterns/admin-crud-table-pattern-guide.md`
- Current role guard: `apps/api/src/auth/roles.guard.ts`
- Current role decorator: `apps/api/src/auth/roles.decorator.ts`
- Current user role enum: `apps/api/src/user/role.enum.ts`
- Current Prisma schema: `apps/api/prisma/schema.prisma`
- Current seed: `apps/api/prisma/seed.ts`
- Current frontend route guard: `apps/admin/src/routes/router-factory.ts`
- Current admin shell: `apps/admin/src/layouts/AdminShell.tsx`
- Current auth store: `apps/admin/src/stores/auth-store.ts`

## Implementation Notes

- This is a breaking change. Do not add compatibility migrations for the old `User.role`.
- Keep the old `@Roles()` path only while converting call sites. Remove it after controllers and tests use `@Permissions()`.
- Use permission codes as the shared contract for API guards, frontend route metadata, menus, and buttons.
- Do not put permission lists into JWT payloads. Resolve permissions from DB/cache by `sub`.
- `defaultRoles` applies only when a permission is first inserted by seed. Re-running seed must not restore permissions manually removed from a role.
- `super_admin` has all active permissions through service/guard logic and does not need explicit `RolePermission` rows.
- Do not use Redis `KEYS` for permission cache invalidation.

## File Structure

### Backend Data And Seed

- Modify `apps/api/prisma/schema.prisma`: add `PermissionStatus`, `RoleStatus`, `Permission`, `Role`, `UserRole`, `RolePermission`; remove `Role` enum and `User.role` after call sites are migrated.
- Create a Prisma migration under `apps/api/prisma/migrations/`: add RBAC tables, join constraints, indexes, and partial unique default-role index.
- Modify `apps/api/prisma/seed.ts`: upsert permissions, roles, first-insert default role permissions, and initial `super_admin` user assignment.
- Create `apps/api/prisma/permission-seed.ts`: pure seed helpers for registry synchronization.
- Create `apps/api/prisma/permission-seed.spec.ts` or `apps/api/src/permission/permission-seed.spec.ts`: seed helper tests if the repository test setup can import Prisma seed helpers cleanly.

### Backend Permission Module

- Create `apps/api/src/permission/permission.constants.ts`: role codes, permission cache constants, and status constants.
- Create `apps/api/src/permission/permission.registry.ts`: system permission registry.
- Create `apps/api/src/permission/permission.types.ts`: permission context and registry types.
- Create `apps/api/src/permission/permission.mapper.ts`: map permission records to response DTOs.
- Create `apps/api/src/permission/dto/permission.response.ts`: permission and module response DTOs.
- Create `apps/api/src/permission/permission.service.ts`: list permissions, group modules, resolve user permission context, cache and invalidate permission context.
- Create `apps/api/src/permission/permission.controller.ts`: read-only permission endpoints.
- Create `apps/api/src/permission/permission.module.ts`: module wiring.
- Create `apps/api/src/permission/permission.service.spec.ts`: permission resolution, cache, disabled role/permission, multi-role union, and `super_admin` tests.
- Create `apps/api/src/permission/permission.controller.spec.ts`: controller permissions and response tests.

### Backend Auth Guard Migration

- Create `apps/api/src/auth/permissions.decorator.ts`: `@Permissions(...codes)`.
- Create `apps/api/src/auth/permissions.guard.ts`: permission metadata enforcement.
- Create `apps/api/src/auth/permissions.guard.spec.ts`: guard unit tests.
- Modify `apps/api/src/auth/jwt-access.strategy.ts`: validate that the user still exists before returning request user.
- Modify `apps/api/src/auth/auth.service.ts`: sign a minimal JWT payload and return the new auth response.
- Modify `apps/api/src/auth/dto/auth-response.dto.ts`: add roles and permissions response shape.
- Modify `apps/api/src/auth/auth.service.spec.ts`: login response and JWT payload tests.
- Modify `apps/api/src/auth/auth-flow.spec.ts`: flow coverage for `401`, `403`, `super_admin`, and missing permission.
- Modify `apps/api/src/app.module.ts`: replace `RolesGuard` provider with `PermissionsGuard` after controllers are migrated.

### Backend Role Module

- Create `apps/api/src/role/dto/role.request.ts`: list, create, update, and permission assignment DTOs.
- Create `apps/api/src/role/dto/role.response.ts`: role response and list response DTOs.
- Create `apps/api/src/role/role.mapper.ts`: map role records and permission assignments.
- Create `apps/api/src/role/role.service.ts`: role CRUD, default-role enforcement, system-role constraints, permission replacement, cache invalidation hooks.
- Create `apps/api/src/role/role.controller.ts`: role management endpoints.
- Create `apps/api/src/role/role.module.ts`: module wiring.
- Create `apps/api/src/role/role.service.spec.ts`: role constraints and permission assignment tests.
- Create `apps/api/src/role/role.controller.spec.ts`: endpoint permission metadata and controller behavior tests.

### Backend User Migration

- Modify `apps/api/src/user/user.types.ts`: replace single `role` with `roles` and `permissions`.
- Modify `apps/api/src/user/dto/user.request.ts`: replace role enum fields with role IDs/codes for create and role replacement.
- Modify `apps/api/src/user/dto/user.response.ts`: expose `roles` instead of `role`.
- Modify `apps/api/src/user/user.mapper.ts`: map joined roles.
- Modify `apps/api/src/user/user.service.ts`: create users with default or explicit roles, replace roles atomically, filter by assigned role, remove role sorting.
- Modify `apps/api/src/user/user.controller.ts`: use `@Permissions()` and add `PUT /users/:id/roles`.
- Modify `apps/api/src/user/user.service.spec.ts`: multi-role create/update/list tests.
- Delete `apps/api/src/user/role.enum.ts` after all imports are removed.
- Modify dictionary role-label code that depended on the old enum.

### Frontend Permission Foundation

- Modify `apps/admin/src/types/auth.ts`: add role and permission context types.
- Modify `apps/admin/src/lib/session-storage.ts`: persist new auth session shape.
- Modify `apps/admin/src/lib/session-storage.test.ts`: cover roles and permissions persistence.
- Modify `apps/admin/src/stores/auth-store.ts`: store roles and permissions.
- Modify `apps/admin/src/stores/auth-store.test.ts`: cover new session shape.
- Create `apps/admin/src/lib/permissions.ts`: `can`, `canAll`, `canAny`, and permission constants helpers.
- Create `apps/admin/src/lib/permissions.test.ts`: helper tests.
- Create `apps/admin/src/routes/admin-route-registry.tsx`: route/menu metadata and route lookup helpers.
- Create `apps/admin/src/routes/admin-route-registry.test.tsx`: route filtering and first visible route tests.
- Modify `apps/admin/src/routes/router-factory.ts`: route resolution based on auth state and permission context.
- Modify `apps/admin/src/routes/router.test.tsx`: `/403`, unauthenticated, and unauthorized tests.
- Create `apps/admin/src/pages/ForbiddenPage.tsx`: no-permission page.
- Create `apps/admin/src/pages/NotFoundPage.tsx`: unknown-route page if keeping separate from current fallback.

### Frontend Feature Migration

- Modify `apps/admin/src/routes/router.tsx`: pass permissions to route guard and render `/403`.
- Modify `apps/admin/src/layouts/AdminShell.tsx`: render navigation and pages from `adminRoutes`.
- Modify `apps/admin/src/layouts/AdminShell.test.tsx`: permission-aware menu and page rendering tests.
- Modify `apps/admin/src/app/api-client.ts` or `apps/admin/src/lib/api.ts`: update auth/user/role/permission API contracts.
- Modify `apps/admin/src/lib/api.test.ts`: API contract tests.
- Modify `apps/admin/src/features/users/users.types.ts`: roles array instead of single role.
- Modify `apps/admin/src/features/users/users.api.ts`: role assignment endpoints.
- Modify `apps/admin/src/features/users/UserForm.tsx`: multi-role selection or create-time role selection.
- Modify `apps/admin/src/features/users/UsersPage.tsx`: role filter, role rendering, and permission-gated actions.
- Modify `apps/admin/src/features/users/UsersPage.test.tsx`: role and action permission tests.
- Modify `apps/admin/src/features/dictionaries/DictionariesPage.tsx`: action permission gates.
- Modify `apps/admin/src/features/dictionaries/DictionariesPage.test.tsx`: action visibility tests.
- Modify `apps/admin/src/features/files/FilesPage.tsx`: action permission gates.
- Modify `apps/admin/src/features/files/FilesPage.test.tsx`: action visibility tests.
- Modify `apps/admin/src/i18n/messages.ts`: roles, permissions, forbidden page, and route labels.

### Frontend Role Management

- Create `apps/admin/src/features/roles/roles.types.ts`: role, permission, list, create/update, and assignment types.
- Create `apps/admin/src/features/roles/roles.api.ts`: role and permission API wrappers.
- Create `apps/admin/src/features/roles/roles.permissions.ts`: feature-local permission constants.
- Create `apps/admin/src/features/roles/roles.columns.tsx`: role table columns and actions.
- Create `apps/admin/src/features/roles/RoleForm.tsx`: create/edit role form.
- Create `apps/admin/src/features/roles/RolePermissionPanel.tsx`: grouped permission checkbox assignment.
- Create `apps/admin/src/features/roles/RolesPage.tsx`: role list, create/edit/delete, enable/disable/default, permission assignment, and read-only permission list.
- Create `apps/admin/src/features/roles/RolesPage.test.tsx`: page behavior and permission assignment tests.

### Documentation

- Modify `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`: update expected file paths if implementation chooses different names.
- Modify `docs/patterns/admin-crud-table-pattern-guide.md`: update reference files after route metadata and RBAC helpers land.

## Chunk 1: Backend RBAC Schema And Seed

### Task 1: Add RBAC Prisma Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Write down the schema intent in the migration task notes**

Before editing, re-read:

```bash
sed -n '60,210p' docs/superpowers/specs/2026-06-09-rbac-permission-design.md
```

Expected: the schema requirements for `Permission`, `Role`, `UserRole`, `RolePermission`, and the partial unique default-role index are visible.

- [ ] **Step 2: Update Prisma enums and models**

Add:

```prisma
enum PermissionStatus {
  ACTIVE
  DISABLED
}

enum RoleStatus {
  ACTIVE
  DISABLED
}

model Permission {
  id          String           @id @default(uuid())
  code        String           @unique @db.VarChar(120)
  module      String           @db.VarChar(80)
  action      String           @db.VarChar(80)
  name        String           @db.VarChar(120)
  description String?          @db.VarChar(500)
  status      PermissionStatus @default(ACTIVE)
  isSystem    Boolean          @default(true)
  sortOrder   Int              @default(0)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  roles       RolePermission[]

  @@index([module, sortOrder])
  @@index([status])
}

model Role {
  id          String           @id @default(uuid())
  code        String           @unique @db.VarChar(80)
  name        String           @db.VarChar(120)
  description String?          @db.VarChar(500)
  status      RoleStatus       @default(ACTIVE)
  isSystem    Boolean          @default(false)
  isDefault   Boolean          @default(false)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  users       UserRole[]
  permissions RolePermission[]

  @@index([status])
  @@index([isDefault])
}

model UserRole {
  userId    String
  roleId    String
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role     @relation(fields: [roleId], references: [id])

  @@id([userId, roleId])
  @@index([roleId])
}

model RolePermission {
  roleId       String
  permissionId String
  createdAt    DateTime @default(now())

  role          Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission    Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
  @@index([permissionId])
}
```

Add to `User`:

```prisma
roles UserRole[]
```

Do not remove `Role` enum or `User.role` in this task; keeping them temporarily avoids breaking every call site before replacement code exists.

- [ ] **Step 3: Generate migration**

Run:

```bash
pnpm --filter api db:migrate -- --name add_rbac_permissions
pnpm --filter api db:generate
```

Expected: Prisma creates a migration and generates a client with `permission`, `role`, `userRole`, and `rolePermission`.

- [ ] **Step 4: Add the partial unique index**

Open the generated migration SQL and add:

```sql
CREATE UNIQUE INDEX "Role_single_default_idx"
ON "Role" ("isDefault")
WHERE "isDefault" = true AND "status" = 'ACTIVE';
```

Expected: PostgreSQL enforces one active default role.

- [ ] **Step 5: Verify Prisma schema formatting**

Run:

```bash
pnpm --filter api db:generate
```

Expected: exit 0.

- [ ] **Step 6: Commit schema work**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add rbac schema"
```

### Task 2: Add Permission Registry And Seed Helpers

**Files:**
- Create: `apps/api/src/permission/permission.constants.ts`
- Create: `apps/api/src/permission/permission.registry.ts`
- Create: `apps/api/src/permission/permission.types.ts`
- Create: `apps/api/prisma/permission-seed.ts`
- Modify: `apps/api/prisma/seed.ts`
- Test: `apps/api/src/permission/permission-seed.spec.ts`

- [ ] **Step 1: Write failing seed helper tests**

Create `apps/api/src/permission/permission-seed.spec.ts` with tests for pure helper functions. Keep the helpers independent of a real database.

Test cases:

```ts
describe('permission seed helpers', () => {
  it('normalizes registry entries into upsert data', () => {})
  it('applies defaultRoles only when permission was newly inserted', () => {})
  it('does not re-grant manually removed permissions on later seed runs', () => {})
})
```

Expected helpers to introduce:

```ts
buildPermissionUpserts(registry)
buildDefaultRolePermissionLinks(insertedPermissionCodes, registry, rolesByCode)
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter api test -- permission-seed.spec.ts
```

Expected: FAIL because helper files do not exist.

- [ ] **Step 3: Add constants and registry types**

Create `apps/api/src/permission/permission.constants.ts`:

```ts
export const SYSTEM_ROLE_CODES = {
  superAdmin: 'super_admin',
  admin: 'admin',
  standard: 'standard',
} as const;

export const PERMISSION_CACHE_PREFIX = 'user_permissions';
export const PERMISSION_CACHE_VERSION_KEY = 'permission_cache_version';
```

Create `apps/api/src/permission/permission.types.ts`:

```ts
export interface PermissionRegistryEntry {
  code: string;
  module: string;
  action: string;
  name: string;
  description?: string;
  defaultRoles: string[];
  sortOrder: number;
}

export interface UserPermissionContext {
  userId: string;
  roleCodes: string[];
  permissionCodes: string[];
  isSuperAdmin: boolean;
}
```

- [ ] **Step 4: Add the initial permission registry**

Create `apps/api/src/permission/permission.registry.ts`:

```ts
import type { PermissionRegistryEntry } from './permission.types';

export const PERMISSION_REGISTRY = [
  { code: 'dashboard.view', module: 'dashboard', action: 'view', name: 'View dashboard', defaultRoles: ['admin', 'standard'], sortOrder: 10 },
  { code: 'user.read', module: 'user', action: 'read', name: 'View users', defaultRoles: ['admin'], sortOrder: 100 },
  { code: 'user.create', module: 'user', action: 'create', name: 'Create user', defaultRoles: ['admin'], sortOrder: 110 },
  { code: 'user.update', module: 'user', action: 'update', name: 'Update user', defaultRoles: ['admin'], sortOrder: 120 },
  { code: 'user.delete', module: 'user', action: 'delete', name: 'Delete user', defaultRoles: [], sortOrder: 130 },
  { code: 'user.assign_roles', module: 'user', action: 'assign_roles', name: 'Assign user roles', defaultRoles: ['admin'], sortOrder: 140 },
  { code: 'role.read', module: 'role', action: 'read', name: 'View roles', defaultRoles: ['admin'], sortOrder: 200 },
  { code: 'role.create', module: 'role', action: 'create', name: 'Create role', defaultRoles: [], sortOrder: 210 },
  { code: 'role.update', module: 'role', action: 'update', name: 'Update role', defaultRoles: [], sortOrder: 220 },
  { code: 'role.delete', module: 'role', action: 'delete', name: 'Delete role', defaultRoles: [], sortOrder: 230 },
  { code: 'role.assign_permissions', module: 'role', action: 'assign_permissions', name: 'Assign role permissions', defaultRoles: [], sortOrder: 240 },
  { code: 'permission.read', module: 'permission', action: 'read', name: 'View permissions', defaultRoles: ['admin'], sortOrder: 300 },
  { code: 'dictionary.read', module: 'dictionary', action: 'read', name: 'View dictionaries', defaultRoles: ['admin'], sortOrder: 400 },
  { code: 'dictionary.create', module: 'dictionary', action: 'create', name: 'Create dictionary', defaultRoles: ['admin'], sortOrder: 410 },
  { code: 'dictionary.update', module: 'dictionary', action: 'update', name: 'Update dictionary', defaultRoles: ['admin'], sortOrder: 420 },
  { code: 'dictionary.delete', module: 'dictionary', action: 'delete', name: 'Delete dictionary', defaultRoles: [], sortOrder: 430 },
  { code: 'file.read', module: 'file', action: 'read', name: 'View files', defaultRoles: ['admin'], sortOrder: 500 },
  { code: 'file.upload', module: 'file', action: 'upload', name: 'Upload file', defaultRoles: ['admin'], sortOrder: 510 },
  { code: 'file.update', module: 'file', action: 'update', name: 'Update file', defaultRoles: ['admin'], sortOrder: 520 },
  { code: 'file.delete', module: 'file', action: 'delete', name: 'Delete file', defaultRoles: [], sortOrder: 530 },
  { code: 'file.download', module: 'file', action: 'download', name: 'Download file', defaultRoles: ['admin'], sortOrder: 540 },
  { code: 'setting.read', module: 'setting', action: 'read', name: 'View settings', defaultRoles: ['admin'], sortOrder: 600 },
  { code: 'setting.update', module: 'setting', action: 'update', name: 'Update settings', defaultRoles: [], sortOrder: 610 },
] as const satisfies readonly PermissionRegistryEntry[];
```

If lint requires descriptions for every entry, add them in the same file.

- [ ] **Step 5: Add seed helpers**

Create `apps/api/prisma/permission-seed.ts` with pure functions plus a database sync function.

Important behavior:

```ts
// defaultRoles are applied only for permission codes that were newly created.
const createdPermissionCodes = new Set<string>();
```

Use Prisma `upsert` or a `findUnique` then `create/update` flow that can tell whether each permission was newly inserted.

- [ ] **Step 6: Update `seed.ts`**

Modify `apps/api/prisma/seed.ts`:

- create system roles `super_admin`, `admin`, `standard`
- call the permission sync helper
- create the initial admin user
- assign the initial admin user to `super_admin`
- keep dictionary seed data that is unrelated to old role labels

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter api test -- permission-seed.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Run seed locally**

Run:

```bash
pnpm --filter api db:seed
```

Expected: seed completes without duplicate errors.

- [ ] **Step 9: Run seed a second time**

Run:

```bash
pnpm --filter api db:seed
```

Expected: seed remains idempotent.

- [ ] **Step 10: Commit registry and seed**

```bash
git add apps/api/src/permission/permission.constants.ts apps/api/src/permission/permission.registry.ts apps/api/src/permission/permission.types.ts apps/api/prisma/permission-seed.ts apps/api/prisma/seed.ts apps/api/src/permission/permission-seed.spec.ts
git commit -m "feat(api): seed rbac permissions"
```

## Chunk 2: Backend Permission Resolution And Guard

### Task 3: Add Permission Service

**Files:**
- Create: `apps/api/src/permission/dto/permission.response.ts`
- Create: `apps/api/src/permission/permission.mapper.ts`
- Create: `apps/api/src/permission/permission.service.ts`
- Create: `apps/api/src/permission/permission.module.ts`
- Test: `apps/api/src/permission/permission.service.spec.ts`

- [ ] **Step 1: Write failing permission service tests**

Create tests for:

```ts
it('returns all active permissions for active super_admin role')
it('returns the union of active permissions from multiple active roles')
it('ignores disabled roles')
it('ignores disabled permissions')
it('returns an empty permission set for users without active roles')
it('invalidates a user permission cache key')
```

Mock Prisma and Redis; do not require a real Redis server.

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter api test -- permission.service.spec.ts
```

Expected: FAIL because service does not exist.

- [ ] **Step 3: Add response DTOs**

Create `apps/api/src/permission/dto/permission.response.ts`:

```ts
export class PermissionResponseDto {
  id!: string;
  code!: string;
  module!: string;
  action!: string;
  name!: string;
  description!: string | null;
  status!: string;
  sortOrder!: number;
}

export class PermissionModuleResponseDto {
  module!: string;
  permissions!: PermissionResponseDto[];
}
```

Add Swagger decorators following existing DTO style.

- [ ] **Step 4: Add mapper**

Create `apps/api/src/permission/permission.mapper.ts`:

```ts
export function toPermissionResponse(permission: {
  id: string;
  code: string;
  module: string;
  action: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number;
}) {
  return {
    id: permission.id,
    code: permission.code,
    module: permission.module,
    action: permission.action,
    name: permission.name,
    description: permission.description,
    status: permission.status,
    sortOrder: permission.sortOrder,
  };
}
```

- [ ] **Step 5: Implement permission service**

Create `apps/api/src/permission/permission.service.ts` with methods:

```ts
listPermissions()
listPermissionModules()
resolveUserPermissionContext(userId: string)
invalidateUserPermissionContext(userId: string)
invalidateAllPermissionContexts()
```

Behavior:

- use Redis cache key `user_permissions:${version}:${userId}`
- use `permission_cache_version` for broad invalidation
- do not use Redis `KEYS`
- `super_admin` role returns all active permission codes
- non-super roles return joined active permissions

- [ ] **Step 6: Add module wiring**

Create `apps/api/src/permission/permission.module.ts`:

```ts
@Module({
  imports: [PrismaModule],
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionModule {}
```

Redis is global through `RedisModule`.

- [ ] **Step 7: Run permission service tests**

Run:

```bash
pnpm --filter api test -- permission.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit permission service**

```bash
git add apps/api/src/permission
git commit -m "feat(api): resolve user permissions"
```

### Task 4: Add `@Permissions()` Guard

**Files:**
- Create: `apps/api/src/auth/permissions.decorator.ts`
- Create: `apps/api/src/auth/permissions.guard.ts`
- Test: `apps/api/src/auth/permissions.guard.spec.ts`
- Modify later: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing guard tests**

Test cases:

```ts
it('allows routes without permission metadata')
it('allows super_admin')
it('allows when user has all required permissions')
it('denies when any required permission is missing')
it('denies when request has no user')
```

Use a mocked `Reflector` and mocked `PermissionService`.

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter api test -- permissions.guard.spec.ts
```

Expected: FAIL because decorator and guard do not exist.

- [ ] **Step 3: Add decorator**

Create `apps/api/src/auth/permissions.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

- [ ] **Step 4: Add guard**

Create `apps/api/src/auth/permissions.guard.ts`:

```ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    if (!request.user?.sub) {
      return false;
    }

    const permissionContext =
      await this.permissionService.resolveUserPermissionContext(request.user.sub);

    if (permissionContext.isSuperAdmin) {
      return true;
    }

    return required.every((permission) =>
      permissionContext.permissionCodes.includes(permission),
    );
  }
}
```

Adjust imports and lint formatting.

- [ ] **Step 5: Run guard tests**

Run:

```bash
pnpm --filter api test -- permissions.guard.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit guard**

```bash
git add apps/api/src/auth/permissions.decorator.ts apps/api/src/auth/permissions.guard.ts apps/api/src/auth/permissions.guard.spec.ts
git commit -m "feat(api): add permissions guard"
```

### Task 5: Update JWT And Auth Response

**Files:**
- Modify: `apps/api/src/user/user.types.ts`
- Modify: `apps/api/src/auth/jwt-access.strategy.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/dto/auth-response.dto.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Write failing auth tests**

Update `apps/api/src/auth/auth.service.spec.ts` to assert:

- JWT payload includes `sub` and does not include `permissions`
- login response includes `user.roles` and `user.permissions`
- login fails when user cannot be found

- [ ] **Step 2: Run failing auth tests**

Run:

```bash
pnpm --filter api test -- auth.service.spec.ts
```

Expected: FAIL because old auth response still returns single role profile.

- [ ] **Step 3: Update user auth types**

Modify `apps/api/src/user/user.types.ts`:

```ts
export interface UserRoleSummary {
  code: string;
  name: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: UserRoleSummary[];
  permissions: string[];
}

export interface JwtUserPayload {
  sub: string;
  email?: string;
  username?: string;
}
```

- [ ] **Step 4: Update JWT validation**

Modify `apps/api/src/auth/jwt-access.strategy.ts` so `validate(payload)` verifies the user still exists.

Implementation direction:

```ts
constructor(
  configService: ConfigService,
  private readonly prisma: PrismaService,
) { ... }

async validate(payload: JwtUserPayload): Promise<JwtUserPayload> {
  const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new UnauthorizedException();
  }
  return payload;
}
```

- [ ] **Step 5: Update auth service**

Inject `PermissionService`. After password validation:

- resolve permission context for the user id
- return user profile with `roles` and `permissions`
- sign JWT with minimal payload

- [ ] **Step 6: Update auth response DTO**

Modify `apps/api/src/auth/dto/auth-response.dto.ts` to document the new shape.

- [ ] **Step 7: Run auth tests**

Run:

```bash
pnpm --filter api test -- auth.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit auth update**

```bash
git add apps/api/src/user/user.types.ts apps/api/src/auth/jwt-access.strategy.ts apps/api/src/auth/auth.service.ts apps/api/src/auth/dto/auth-response.dto.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): return rbac auth context"
```

## Chunk 3: Backend Roles, Users, And Controller Migration

### Task 6: Add Role Management API

**Files:**
- Create: `apps/api/src/role/dto/role.request.ts`
- Create: `apps/api/src/role/dto/role.response.ts`
- Create: `apps/api/src/role/role.mapper.ts`
- Create: `apps/api/src/role/role.service.ts`
- Create: `apps/api/src/role/role.controller.ts`
- Create: `apps/api/src/role/role.module.ts`
- Test: `apps/api/src/role/role.service.spec.ts`
- Test: `apps/api/src/role/role.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing role service tests**

Cover:

- create non-system role
- reject duplicate role code
- reject deleting system role
- reject disabling `super_admin`
- enforce one active default role
- replace role permissions atomically
- reject disabled permission assignment
- invalidate permission cache after role permission replacement

- [ ] **Step 2: Run failing role tests**

Run:

```bash
pnpm --filter api test -- role.service.spec.ts
```

Expected: FAIL because role module does not exist.

- [ ] **Step 3: Add role DTOs**

Create DTOs with class-validator:

```ts
export class CreateRoleDto {
  code!: string;
  name!: string;
  description?: string;
  isDefault?: boolean;
}

export class UpdateRoleDto {
  name?: string;
  description?: string | null;
  status?: 'ACTIVE' | 'DISABLED';
  isDefault?: boolean;
}

export class ReplaceRolePermissionsDto {
  permissionCodes!: string[];
}
```

Use local enum values from Prisma where practical.

- [ ] **Step 4: Implement role service**

Rules:

- `super_admin`, `admin`, and `standard` are system roles
- system role `code` cannot change
- system roles cannot be deleted
- `super_admin` cannot be disabled
- only one active default role
- role permission replacement ignores `super_admin` special all-access behavior but still allows showing selected explicit permissions for other roles
- use transactions for default-role and permission replacement operations

- [ ] **Step 5: Add role controller**

Routes:

```text
GET    /roles                   @Permissions('role.read')
POST   /roles                   @Permissions('role.create')
GET    /roles/:id               @Permissions('role.read')
PATCH  /roles/:id               @Permissions('role.update')
DELETE /roles/:id               @Permissions('role.delete')
PUT    /roles/:id/permissions   @Permissions('role.assign_permissions')
```

- [ ] **Step 6: Add module wiring**

Modify `apps/api/src/app.module.ts` to import `RoleModule`.

- [ ] **Step 7: Run role tests**

Run:

```bash
pnpm --filter api test -- role.service.spec.ts role.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit role module**

```bash
git add apps/api/src/role apps/api/src/app.module.ts
git commit -m "feat(api): add role management"
```

### Task 7: Add Permission Read API

**Files:**
- Create: `apps/api/src/permission/permission.controller.ts`
- Modify: `apps/api/src/permission/permission.module.ts`
- Test: `apps/api/src/permission/permission.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing controller tests**

Cover:

- `GET /permissions` requires `permission.read`
- `GET /permissions/modules` requires `permission.read`
- response groups permissions by module and sort order

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter api test -- permission.controller.spec.ts
```

Expected: FAIL because controller does not exist.

- [ ] **Step 3: Add controller**

Routes:

```text
GET /permissions          @Permissions('permission.read')
GET /permissions/modules  @Permissions('permission.read')
```

- [ ] **Step 4: Register module**

Modify `apps/api/src/app.module.ts` to import `PermissionModule`.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter api test -- permission.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit permission API**

```bash
git add apps/api/src/permission apps/api/src/app.module.ts
git commit -m "feat(api): expose permission catalog"
```

### Task 8: Migrate User API To Multi-Role

**Files:**
- Modify: `apps/api/src/user/dto/user.request.ts`
- Modify: `apps/api/src/user/dto/user.response.ts`
- Modify: `apps/api/src/user/user.mapper.ts`
- Modify: `apps/api/src/user/user.service.ts`
- Modify: `apps/api/src/user/user.controller.ts`
- Modify: `apps/api/src/user/user.service.spec.ts`
- Modify: `apps/api/src/auth/auth-flow.spec.ts`

- [ ] **Step 1: Write failing user service tests**

Cover:

- `create` assigns active default role when role codes are omitted
- `create` assigns explicit active role codes when provided
- `create` rejects disabled role codes
- `update` does not mutate roles
- `replaceRoles` replaces full role set atomically
- `replaceRoles` rejects removing the last active `super_admin`
- list filters by any assigned role code
- list responses expose `roles`
- sorting by role is rejected or unsupported

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: FAIL because user service still uses single role.

- [ ] **Step 3: Update DTOs**

Replace role enum fields with:

```ts
roleCodes?: string[]
```

For role replacement:

```ts
export class ReplaceUserRolesDto {
  roleCodes!: string[];
}
```

- [ ] **Step 4: Update mapper and response DTO**

Expose:

```ts
roles: Array<{ code: string; name: string }>
```

Do not expose `permissions` on ordinary user list responses unless required by the UI.

- [ ] **Step 5: Update service**

Implementation requirements:

- include role joins for list/detail/me queries
- default create-time roles to the active `isDefault` role
- reject creating a user if no active default role exists and no explicit roles were supplied
- add `replaceRoles(userId, roleCodes, actorUserId?)`
- call permission cache invalidation when user roles change
- enforce last `super_admin` assignment protection

- [ ] **Step 6: Update controller**

Replace role decorators with permissions:

```text
GET    /users             user.read
POST   /users             user.create
GET    /users/:id         user.read
PATCH  /users/:id         user.update
DELETE /users/:id         user.delete
PUT    /users/:id/roles   user.assign_roles
GET    /users/me          authenticated self-service, no @Permissions()
```

Keep literal `me` before `:id`.

- [ ] **Step 7: Run user tests**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit user migration**

```bash
git add apps/api/src/user apps/api/src/auth/auth-flow.spec.ts
git commit -m "feat(api): migrate users to multi-role rbac"
```

### Task 9: Convert Remaining Backend Controllers And Remove Old Role Model

**Files:**
- Modify: `apps/api/src/dictionary/dictionary-type.controller.ts`
- Modify: `apps/api/src/dictionary/dictionary-item.controller.ts`
- Modify: `apps/api/src/file/file.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Delete: `apps/api/src/auth/roles.decorator.ts`
- Delete: `apps/api/src/auth/roles.guard.ts`
- Delete: `apps/api/src/auth/roles.guard.spec.ts`
- Delete: `apps/api/src/user/role.enum.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Add migration under: `apps/api/prisma/migrations/`
- Modify tests importing old role enum.

- [ ] **Step 1: Search old role usage**

Run:

```bash
rg -n "Role\\.ADMIN|Role\\.STANDARD|@Roles|roles.guard|role.enum|User\\.role|\\brole\\b" apps/api/src apps/api/prisma
```

Expected: usage list is visible. Do not remove files until each call site has a target replacement.

- [ ] **Step 2: Convert dictionary controllers**

Map:

```text
GET dictionary list/detail/options -> dictionary.read
POST dictionary type/item -> dictionary.create
PATCH dictionary type/item -> dictionary.update
DELETE dictionary type/item -> dictionary.delete
```

- [ ] **Step 3: Convert file controller**

Map:

```text
GET /files, GET /files/:id -> file.read
POST /files/upload -> file.upload
PATCH /files/:id -> file.update
DELETE /files/:id -> file.delete
GET /files/:id/download -> file.download
```

- [ ] **Step 4: Replace global guard**

Modify `apps/api/src/app.module.ts`:

- keep `JwtAuthGuard`
- replace `RolesGuard` with `PermissionsGuard`
- import `PermissionModule` and `RoleModule`

- [ ] **Step 5: Add metadata audit test**

Add a test in `apps/api/src/auth/auth-flow.spec.ts` or a new focused test that fails when admin controllers expose management routes without `@Permissions()`.

- [ ] **Step 6: Remove old role enum and field**

Modify `apps/api/prisma/schema.prisma`:

- remove enum `Role`
- remove `User.role`

Generate migration:

```bash
pnpm --filter api db:migrate -- --name remove_legacy_user_role
pnpm --filter api db:generate
```

- [ ] **Step 7: Remove role dictionary coupling**

Update dictionary seed/tests/helpers that treat `user_role` as the authorization source. Role labels should come from `Role` records after RBAC.

- [ ] **Step 8: Run backend targeted tests**

Run:

```bash
pnpm --filter api test -- auth-flow.spec.ts user.service.spec.ts permission.service.spec.ts role.service.spec.ts dictionary-type.service.spec.ts dictionary-item.service.spec.ts file.service.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Verify no old role guard remains**

Run:

```bash
rg -n "Role\\.ADMIN|Role\\.STANDARD|@Roles|RolesGuard|roles.decorator|role.enum" apps/api/src apps/api/prisma
```

Expected: no results.

- [ ] **Step 10: Commit backend migration**

```bash
git add apps/api/src apps/api/prisma
git commit -m "feat(api): enforce permission-based access"
```

## Chunk 4: Frontend Permission Foundation

### Task 10: Update Auth Session And Permission Helpers

**Files:**
- Modify: `apps/admin/src/types/auth.ts`
- Modify: `apps/admin/src/lib/session-storage.ts`
- Modify: `apps/admin/src/lib/session-storage.test.ts`
- Modify: `apps/admin/src/stores/auth-store.ts`
- Modify: `apps/admin/src/stores/auth-store.test.ts`
- Create: `apps/admin/src/lib/permissions.ts`
- Create: `apps/admin/src/lib/permissions.test.ts`

- [x] **Step 1: Write failing frontend tests**

Update/add tests for:

- session storage persists roles and permissions
- auth store exposes roles and permissions
- `can`, `canAll`, and `canAny` work with permission arrays

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter admin test -- session-storage.test.ts auth-store.test.ts permissions.test.ts
```

Expected: FAIL because types/helpers are missing.

- [x] **Step 3: Update auth types**

Modify `apps/admin/src/types/auth.ts`:

```ts
export interface UserRoleSummary {
  code: string
  name: string
}

export interface UserProfile {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  roles: UserRoleSummary[]
  permissions: string[]
}

export interface AuthSession {
  accessToken: string
  user: UserProfile
}
```

- [x] **Step 4: Add permission helpers**

Create `apps/admin/src/lib/permissions.ts`:

```ts
export function can(permissions: readonly string[], permission: string) {
  return permissions.includes(permission)
}

export function canAll(
  permissions: readonly string[],
  required: readonly string[] = [],
) {
  return required.every((permission) => can(permissions, permission))
}

export function canAny(
  permissions: readonly string[],
  required: readonly string[] = [],
) {
  return required.length === 0 || required.some((permission) => can(permissions, permission))
}
```

Adjust line wrapping to satisfy lint.

- [x] **Step 5: Update auth store**

Expose:

```ts
roles: UserRoleSummary[]
permissions: string[]
```

Derive them from `session.user`.

- [x] **Step 6: Run tests**

Run:

```bash
pnpm --filter admin test -- session-storage.test.ts auth-store.test.ts permissions.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit frontend auth foundation**

```bash
git add apps/admin/src/types/auth.ts apps/admin/src/lib/session-storage.ts apps/admin/src/lib/session-storage.test.ts apps/admin/src/stores/auth-store.ts apps/admin/src/stores/auth-store.test.ts apps/admin/src/lib/permissions.ts apps/admin/src/lib/permissions.test.ts
git commit -m "feat(admin): store permission context"
```

### Task 11: Add Permission-Aware Routes And Guard

**Files:**
- Create: `apps/admin/src/routes/admin-route-registry.tsx`
- Create: `apps/admin/src/routes/admin-route-registry.test.tsx`
- Modify: `apps/admin/src/routes/router-factory.ts`
- Modify: `apps/admin/src/routes/router.test.tsx`
- Create: `apps/admin/src/pages/ForbiddenPage.tsx`
- Create: `apps/admin/src/pages/NotFoundPage.tsx`
- Modify: `apps/admin/src/routes/router.tsx`

- [x] **Step 1: Write failing route tests**

Tests:

- unauthenticated protected route redirects to `/login`
- authenticated user without route permission redirects to `/403`
- authenticated user with route permission is allowed
- `/login` authenticated redirect goes to first visible route
- unknown route redirects or renders `/404`

- [x] **Step 2: Run failing route tests**

Run:

```bash
pnpm --filter admin test -- admin-route-registry.test.tsx router.test.tsx
```

Expected: FAIL because route metadata does not exist.

- [x] **Step 3: Add route metadata**

Create `apps/admin/src/routes/admin-route-registry.tsx` with route objects:

```ts
export const adminRoutes = [
  { path: '/dashboard', labelKey: 'nav.dashboard', requiredPermissions: ['dashboard.view'], component: DashboardContent },
  { path: '/users', labelKey: 'nav.users', requiredPermissions: ['user.read'], component: UsersPage },
  { path: '/roles', labelKey: 'nav.roles', requiredPermissions: ['role.read'], component: RolesPage },
  { path: '/dictionaries', labelKey: 'nav.dictionaries', requiredPermissions: ['dictionary.read'], component: DictionariesPage },
  { path: '/files', labelKey: 'nav.files', requiredPermissions: ['file.read'], component: FilesPage },
  { path: '/settings', labelKey: 'nav.settings', requiredPermissions: ['setting.read'], component: SettingsPlaceholder },
]
```

Import lucide icons and components as needed. If `RolesPage` does not exist yet, temporarily point to a placeholder and replace in Task 14.

- [x] **Step 4: Update route guard**

Change `router guards` signature to include permissions:

```ts
router guards(path: string, auth: { isAuthenticated: boolean; permissions: string[] })
```

Return route results:

```ts
{ path, redirectTo, status: 'ok' | 'login' | 'forbidden' | 'not_found' }
```

Keep the existing simple behavior if the project does not want a status field, but tests must cover `/403`.

- [x] **Step 5: Add forbidden and not-found pages**

Create simple pages using existing `PlaceholderPage` style.

- [x] **Step 6: Update AdminRouterProvider**

Pass permissions from `useAuthStore` into `router guards`. Render:

- `LoginView` for `/login`
- `ForbiddenPage` for `/403`
- `NotFoundPage` for `/404`
- `AdminShell` for allowed admin routes

- [x] **Step 7: Run route tests**

Run:

```bash
pnpm --filter admin test -- admin-route-registry.test.tsx router.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit route foundation**

```bash
git add apps/admin/src/routes apps/admin/src/routes/router-factory.ts apps/admin/src/routes/router.test.tsx apps/admin/src/pages/ForbiddenPage.tsx apps/admin/src/pages/NotFoundPage.tsx apps/admin/src/routes/router.tsx
git commit -m "feat(admin): add permission-aware routes"
```

### Task 12: Convert AdminShell To Route Metadata

**Files:**
- Modify: `apps/admin/src/layouts/AdminShell.tsx`
- Modify: `apps/admin/src/layouts/AdminShell.test.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`

- [x] **Step 1: Write failing shell tests**

Cover:

- hides Users nav without `user.read`
- shows Users nav with `user.read`
- renders the route component from metadata
- does not render links to unauthorized routes
- includes Roles nav with `role.read`

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter admin test -- AdminShell.test.tsx
```

Expected: FAIL because `AdminShell` renders hard-coded nav.

- [x] **Step 3: Render nav from route metadata**

Use `adminRoutes` and `canAll` to compute visible routes. Render desktop and mobile nav from the same array.

- [x] **Step 4: Render page component from route metadata**

Find the matching route by `currentPath`; render its component. Keep `DashboardContent` loading behavior by passing props through route metadata or a small route render helper.

- [x] **Step 5: Add i18n entries**

Add:

```text
nav.roles
page.forbiddenTitle
page.forbiddenDescription
page.notFoundTitle
page.notFoundDescription
```

for English and Chinese.

- [x] **Step 6: Run shell tests**

Run:

```bash
pnpm --filter admin test -- AdminShell.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit shell migration**

```bash
git add apps/admin/src/layouts/AdminShell.tsx apps/admin/src/layouts/AdminShell.test.tsx apps/admin/src/i18n/messages.ts
git commit -m "feat(admin): render navigation from permissions"
```

## Chunk 5: Frontend Role Management And Feature Gates

### Task 13: Add Role And Permission API Wrappers

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/api.test.ts`
- Create: `apps/admin/src/features/roles/roles.types.ts`
- Create: `apps/admin/src/features/roles/roles.api.ts`
- Create: `apps/admin/src/features/roles/roles.permissions.ts`

- [x] **Step 1: Write failing API tests**

Cover:

- list roles
- create role
- update role
- delete role
- replace role permissions
- list permission modules
- replace user roles

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter admin test -- api.test.ts
```

Expected: FAIL because endpoints are not implemented.

- [x] **Step 3: Add shared API methods**

Add methods to `apps/admin/src/lib/api.ts` or `apps/admin/src/app/api-client.ts`, matching the current API style.

- [x] **Step 4: Add feature-local wrappers**

Create `roles.api.ts`:

```ts
export const rolesApi = {
  list: () => api.roles.list(),
  create: (input) => api.roles.create(input),
  update: (id, input) => api.roles.update(id, input),
  remove: (id) => api.roles.remove(id),
  replacePermissions: (id, permissionCodes) =>
    api.roles.replacePermissions(id, permissionCodes),
  listPermissionModules: () => api.permissions.modules(),
}
```

- [x] **Step 5: Add role permission constants**

Create `roles.permissions.ts`:

```ts
export const rolePermissions = {
  read: 'role.read',
  create: 'role.create',
  update: 'role.update',
  delete: 'role.delete',
  assignPermissions: 'role.assign_permissions',
  readPermissions: 'permission.read',
} as const
```

- [x] **Step 6: Run API tests**

Run:

```bash
pnpm --filter admin test -- api.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit API wrappers**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/lib/api.test.ts apps/admin/src/features/roles
git commit -m "feat(admin): add role api wrappers"
```

### Task 14: Add Roles Management Page

**Files:**
- Create: `apps/admin/src/features/roles/roles.columns.tsx`
- Create: `apps/admin/src/features/roles/RoleForm.tsx`
- Create: `apps/admin/src/features/roles/RolePermissionPanel.tsx`
- Create: `apps/admin/src/features/roles/RolesPage.tsx`
- Create: `apps/admin/src/features/roles/RolesPage.test.tsx`
- Modify: `apps/admin/src/routes/admin-route-registry.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`

- [x] **Step 1: Write failing page tests**

Cover:

- lists roles
- opens create dialog when `role.create`
- hides create action without `role.create`
- blocks delete for system roles
- replaces permissions with selected permission codes
- groups permission checkboxes by module
- shows read-only permission list or panel when `permission.read`
- hides assignment action without `role.assign_permissions`

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter admin test -- RolesPage.test.tsx
```

Expected: FAIL because roles page does not exist.

- [x] **Step 3: Add columns and forms**

Follow `UsersPage` and dictionary page patterns. Keep controls compact and data-table oriented.

- [x] **Step 4: Add permission assignment panel**

Use grouped modules:

```ts
Array<{ module: string; permissions: PermissionRecord[] }>
```

Use checkboxes for permissions, disabled state for unavailable operations, and submit the full selected code set.

- [x] **Step 5: Add RolesPage**

Use React Query for:

- role list
- permission module list
- create/update/delete role mutations
- replace permissions mutation

Hide actions through `can`/`canAll`.

- [x] **Step 6: Wire route**

Update `apps/admin/src/routes/admin-route-registry.tsx` to render `RolesPage` for `/roles`.

- [x] **Step 7: Add i18n copy**

Add concise English and Chinese labels for role list, form fields, status, system/default badges, and permission assignment.

- [x] **Step 8: Run page tests**

Run:

```bash
pnpm --filter admin test -- RolesPage.test.tsx admin-route-registry.test.tsx AdminShell.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit roles page**

```bash
git add apps/admin/src/features/roles apps/admin/src/routes/admin-route-registry.tsx apps/admin/src/i18n/messages.ts
git commit -m "feat(admin): add role management page"
```

### Task 15: Gate Existing Frontend Feature Actions

**Files:**
- Modify: `apps/admin/src/features/users/users.types.ts`
- Modify: `apps/admin/src/features/users/users.api.ts`
- Modify: `apps/admin/src/features/users/UserForm.tsx`
- Modify: `apps/admin/src/features/users/UsersPage.tsx`
- Modify: `apps/admin/src/features/users/UsersPage.test.tsx`
- Modify: `apps/admin/src/features/dictionaries/DictionariesPage.tsx`
- Modify: `apps/admin/src/features/dictionaries/DictionariesPage.test.tsx`
- Modify: `apps/admin/src/features/files/FilesPage.tsx`
- Modify: `apps/admin/src/features/files/FilesPage.test.tsx`
- Modify: `apps/admin/src/lib/dictionaries/dictionary-label.ts`
- Modify: `apps/admin/src/lib/dictionaries/dictionary-label.test.ts`

- [x] **Step 1: Write failing feature tests**

For each page, cover:

- create action hidden without `*.create` or equivalent
- edit action hidden without `*.update`
- delete action hidden without `*.delete`
- file upload/download actions use `file.upload` and `file.download`
- users role assignment uses `user.assign_roles`

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter admin test -- UsersPage.test.tsx DictionariesPage.test.tsx FilesPage.test.tsx
```

Expected: FAIL because pages do not gate actions yet.

- [x] **Step 3: Update users feature types and form**

Replace single `role` with `roles`.

Create users with role codes or use default role if no role UI is desired for v1. Prefer explicit multi-select if role APIs are already available.

- [x] **Step 4: Gate users actions**

Use permission constants:

```ts
user.read
user.create
user.update
user.delete
user.assign_roles
```

- [x] **Step 5: Gate dictionaries actions**

Use:

```ts
dictionary.read
dictionary.create
dictionary.update
dictionary.delete
```

- [x] **Step 6: Gate files actions**

Use:

```ts
file.read
file.upload
file.update
file.delete
file.download
```

- [x] **Step 7: Remove frontend role dictionary assumptions**

Delete or repurpose helpers that filter old `ADMIN` / `STANDARD` dictionary values for authorization role display.

- [x] **Step 8: Run feature tests**

Run:

```bash
pnpm --filter admin test -- UsersPage.test.tsx DictionariesPage.test.tsx FilesPage.test.tsx dictionary-label.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit feature gates**

```bash
git add apps/admin/src/features/users apps/admin/src/features/dictionaries apps/admin/src/features/files apps/admin/src/lib/dictionaries
git commit -m "feat(admin): gate feature actions by permission"
```

## Chunk 6: Full Verification And Documentation

### Task 16: Backend Full Verification

**Files:**
- Modify only files needed to fix verification failures.

- [x] **Step 1: Run backend tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [x] **Step 2: Run backend build**

Run:

```bash
pnpm --filter api build
```

Expected: PASS.

- [x] **Step 3: Run backend lint**

Run:

```bash
pnpm --filter api lint
```

Expected: PASS.

- [x] **Step 4: Run Prisma generate**

Run:

```bash
pnpm --filter api db:generate
```

Expected: PASS.

- [x] **Step 5: Run seed idempotence**

Run twice:

```bash
pnpm --filter api db:seed
pnpm --filter api db:seed
```

Expected: both runs complete without duplicate errors or re-granting manually removed role permissions. If manual removal verification is hard locally, document the limitation and keep the seed helper unit test as the proof.

- [ ] **Step 6: Commit backend verification fixes**

If fixes were needed:

```bash
git add apps/api
git commit -m "fix(api): stabilize rbac verification"
```

### Task 17: Frontend Full Verification

**Files:**
- Modify only files needed to fix verification failures.

- [x] **Step 1: Run frontend tests**

Run:

```bash
pnpm --filter admin test
```

Expected: PASS.

- [x] **Step 2: Run frontend build**

Run:

```bash
pnpm --filter admin build
```

Expected: PASS.

- [x] **Step 3: Run frontend lint**

Run:

```bash
pnpm --filter admin lint
```

Expected: PASS.

- [x] **Step 4: Start local app for browser smoke test**

Run:

```bash
pnpm dev
```

Expected: API and admin dev servers start.

- [x] **Step 5: Browser smoke test**

Open the admin app and verify:

- login succeeds as seeded admin
- dashboard appears
- menu only shows permitted routes
- `/roles` loads for `super_admin`
- a role can be created, edited, assigned permissions, and deleted if non-system
- direct navigation to a forbidden route renders `/403`
- users, dictionaries, and files pages still render

- [x] **Step 6: Stop dev server**

Stop any running dev server sessions before ending the implementation turn.

- [ ] **Step 7: Commit frontend verification fixes**

If fixes were needed:

```bash
git add apps/admin
git commit -m "fix(admin): stabilize rbac verification"
```

### Task 18: Update Documentation And Final Checks

**Files:**
- Modify: `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`
- Modify: `docs/patterns/admin-crud-table-pattern-guide.md`
- Optionally modify: `docs/common-admin-next-steps.md`

- [x] **Step 1: Update RBAC CRUD pattern paths**

If implementation used different file names from the expected integration points, update:

```text
docs/patterns/admin-rbac-crud-permission-pattern-guide.md
```

- [x] **Step 2: Update CRUD guide references**

Update reference files in:

```text
docs/patterns/admin-crud-table-pattern-guide.md
```

Mention route metadata and permission constants as part of standard CRUD module work.

- [x] **Step 3: Update next steps**

If `docs/common-admin-next-steps.md` remains as a living checklist, mark the permission design/plan as prepared and point to the spec and plan.

- [x] **Step 4: Run documentation sanity checks**

Run:

```bash
rg -n "Role\\.ADMIN|Role\\.STANDARD|@Roles|RolesGuard|role.enum" apps docs
```

Expected: no live implementation references. Historical references inside the RBAC spec context are acceptable only if they clearly describe the old model or removal steps.

- [x] **Step 5: Run final repository checks**

Run:

```bash
pnpm --filter api test
pnpm --filter admin test
pnpm --filter api build
pnpm --filter admin build
pnpm --filter api lint
pnpm --filter admin lint
```

Expected: all pass.

- [ ] **Step 6: Commit documentation**

```bash
git add docs
git commit -m "docs: document rbac development workflow"
```

## Final Acceptance Checklist

- [x] Prisma schema has RBAC tables and no legacy `User.role`.
- [x] Seed creates system permissions, system roles, and initial `super_admin` assignment.
- [x] Seed is idempotent and does not re-grant manually removed permissions.
- [x] `@Permissions()` replaces `@Roles()` on admin management APIs.
- [x] Permission guard returns `401` for unauthenticated requests and `403` for missing permissions.
- [x] `super_admin` has all active permissions without explicit `RolePermission` rows.
- [x] Disabled roles and disabled permissions do not grant access.
- [x] User supports multiple roles.
- [x] User create assigns default role when explicit roles are omitted.
- [x] Last active `super_admin` assignment cannot be removed.
- [x] Frontend auth state stores roles and permissions.
- [x] Frontend menus, routes, pages, and buttons consume the same permission codes.
- [x] `/403` exists and is used for unauthorized direct navigation.
- [x] Role management UI can create/update/delete non-system roles and assign permissions.
- [x] Existing users, dictionaries, and files pages still work with permission-gated actions.
- [x] CRUD permission pattern guide points developers to the implemented RBAC files.
