# RBAC Permission Design

## Goal

Replace the current two-value role check with a reusable RBAC permission system
for Common Admin.

The new system should let administrators assign multiple roles to each user,
assign system-defined permissions to roles, protect backend APIs with permission
codes, and let the admin frontend consume the same permission codes for menus,
routes, pages, and action buttons.

## Context

The current project uses a simple `ADMIN` / `STANDARD` role model:

- Prisma defines a `Role` enum.
- `User.role` stores one role per user.
- Backend controllers protect admin routes with `@Roles(Role.ADMIN)`.
- The admin frontend stores `user.role`, but route guarding only checks whether
  the user is authenticated.
- Role labels are also exposed through dictionary seed data for display.

This is enough for an early starter template, but it does not scale well once
the project has role management, feature-specific access, menu permissions,
button permissions, and reusable module development rules.

The project is still in development, so this change can be a breaking change.
No compatibility migration for the old `Role` enum or `User.role` field is
required.

## Chosen Approach

Use a classic multi-role RBAC model:

```text
User -> UserRole -> Role -> RolePermission -> Permission
```

Principles:

- A user may have multiple roles.
- A role is a dynamic database record.
- A permission is a system-defined capability code.
- Permissions are declared in code, synchronized to the database by seed/upsert,
  and assigned to roles in the admin UI.
- Backend authorization is enforced by permission codes, not role names.
- Frontend permission checks improve user experience, but backend guards remain
  the security boundary.
- `super_admin` always has every active permission.

## Breaking Changes

The RBAC implementation should remove the old role model directly:

- Remove the Prisma `Role` enum.
- Remove `User.role`.
- Remove the backend `Role` enum.
- Remove `@Roles()` and the old roles guard after replacement.
- Remove frontend `Role = 'ADMIN' | 'STANDARD'` types.
- Replace dictionary-backed role labels with role records from the RBAC module.

Seed data should create the initial roles and assign the initial admin user to
`super_admin`.

## Data Model

### Permission

System capability records synchronized from code.

```text
Permission
- id
- code              unique, for example user.create
- module            for example user / dictionary / file / role
- action            for example read / create / update / delete
- name
- description
- status            ACTIVE / DISABLED
- isSystem          true
- sortOrder
- createdAt
- updatedAt
```

Rules:

- `code` is stable and should not be renamed casually.
- Permissions are not created or deleted freely from the admin UI.
- The admin UI may show permissions as a read-only capability list.
- Disabled permissions do not participate in authorization.

### Role

Dynamic role records managed from the admin UI.

```text
Role
- id
- code              unique, for example super_admin / admin / standard
- name
- description
- status            ACTIVE / DISABLED
- isSystem          system roles cannot be deleted and cannot change code
- isDefault         default role assigned to newly created users
- createdAt
- updatedAt
```

Rules:

- Non-system roles can be created, edited, disabled, and deleted.
- System roles cannot be deleted.
- `super_admin` cannot be disabled.
- `admin` and `standard` are system roles, but their assigned permissions may be
  edited from the UI.
- At most one role should be marked as the default role.
- Disabled roles do not participate in permission calculation.
- Prevent disabling or deleting the only default role.

### UserRole

Join table between users and roles.

```text
UserRole
- userId
- roleId
- createdAt
```

Rules:

- Use a composite primary key or unique constraint on `(userId, roleId)`.
- Add indexes for `userId` and `roleId`.
- Delete user-role rows when the user is deleted.
- Reject deleting a role while users are assigned to it, unless the operation
  explicitly reassigns those users in the same transaction.
- A user may have multiple active roles.
- Role assignment should reject disabled roles.
- A user should not be left without any role unless the product explicitly
  supports that state.
- Prevent removing the last active `super_admin` assignment.
- Prevent a user from removing their own last active `super_admin` assignment.

### RolePermission

Join table between roles and permissions.

```text
RolePermission
- roleId
- permissionId
- createdAt
```

Rules:

- Use a composite primary key or unique constraint on `(roleId, permissionId)`.
- Add indexes for `roleId` and `permissionId`.
- Delete role-permission rows when the role is deleted.
- Reject deleting a permission while role-permission rows still reference it;
  normal feature removal should disable the permission instead.
- `super_admin` does not need explicit rows for every permission.
- Other roles use explicit rows.
- Disabled permissions are ignored even if a role still has a join row.

### Database Constraints

Prisma should encode the join-table uniqueness directly:

```prisma
model UserRole {
  userId String
  roleId String

  @@id([userId, roleId])
  @@index([roleId])
}

model RolePermission {
  roleId       String
  permissionId String

  @@id([roleId, permissionId])
  @@index([permissionId])
}
```

PostgreSQL should also enforce one active default role. Prisma cannot express a
partial unique index directly, so add it in the migration SQL:

```sql
CREATE UNIQUE INDEX "Role_single_default_idx"
ON "Role" ("isDefault")
WHERE "isDefault" = true AND "status" = 'ACTIVE';
```

The role service should still enforce the same rule transactionally so tests do
not depend only on database errors.

## Permission Registry And Seed Sync

Permissions are system-defined, but the list is not frozen. As new features are
added, their permission codes must be added to the code registry and synchronized
to the database by seed/upsert.

Example registry entry:

```ts
{
  code: 'user.create',
  module: 'user',
  action: 'create',
  name: 'Create user',
  description: 'Create users in the admin console',
  defaultRoles: ['admin'],
  sortOrder: 120,
}
```

Seed flow:

```text
1. Upsert Permission records from the registry.
2. Upsert system Role records: super_admin, admin, standard.
3. For newly created Permission records only, insert RolePermission rows
   according to permission.defaultRoles.
4. Upsert the initial admin user and assign super_admin.
5. Do not physically delete permissions that disappeared from the registry.
```

`defaultRoles` is a rollout default, not a permanent reconciliation rule. Seed
must not re-grant a permission to a role after an administrator manually removes
that permission. A safe implementation should detect whether a permission code
was newly inserted during the current seed run and apply `defaultRoles` only for
that first insertion.

If the project later needs system-managed role permissions, add an explicit
field such as `managedBySeed` to `RolePermission`. Do not infer system ownership
from `defaultRoles`.

Handling removed permissions:

- Prefer marking them `DISABLED`, or leave them untouched until a cleanup tool is
  introduced.
- Do not automatically delete permission rows because that can destroy role
  configuration and audit history.

Default role behavior:

- `super_admin` automatically has all active permissions through guard logic.
- `admin` receives permissions listed in `defaultRoles: ['admin']`.
- `standard` receives only explicitly listed basic permissions.
- New sensitive permissions should use `defaultRoles: []` unless normal admins
  should receive them immediately.

This makes feature development predictable:

```text
New feature -> add permission registry entries -> seed upsert -> assign to roles
```

## Permission Code Convention

Use `module.action`.

Examples:

```text
dashboard.view

user.read
user.create
user.update
user.delete
user.assign_roles

role.read
role.create
role.update
role.delete
role.assign_permissions

permission.read

dictionary.read
dictionary.create
dictionary.update
dictionary.delete

file.read
file.upload
file.update
file.delete
file.download

setting.read
setting.update
```

Conventions:

- Codes must be lowercase and stable.
- Use singular, stable module names unless the project already has a different
  module code. For example, use `article.read` for the `/articles` route.
- Page/menu access usually uses `module.read` or `module.view`.
- Create actions use `module.create`.
- Edit actions use `module.update`.
- Delete actions use `module.delete`.
- Special operations use explicit verbs, for example `user.assign_roles`.
- API, route, menu, and button checks should reuse the same permission code.
- Frontend modules should expose feature-local permission constants instead of
  scattering raw strings across large pages.

## Backend Authorization

Replace `@Roles()` with a permission decorator.

```ts
@Permissions('user.read')
@Get()
findMany() {}

@Permissions('user.create')
@Post()
create() {}

@Permissions('file.delete')
@Delete(':id')
remove() {}
```

Guard behavior:

```text
1. Unauthenticated request -> 401.
2. Authenticated request without @Permissions() -> allowed.
3. Authenticated request with @Permissions() -> check permissions.
4. User with active super_admin role -> allowed.
5. Disabled roles are ignored.
6. Disabled permissions are ignored.
7. Missing permission -> 403.
```

For v1, `@Permissions(...codes)` should mean all listed permissions are
required. Most endpoints should declare exactly one permission. If the project
later needs "any of these permissions" semantics, add a separate
`@AnyPermissions()` decorator instead of overloading the first version.

Fail-open protection:

- Every admin management API must declare `@Permissions()`.
- Authenticated routes without `@Permissions()` are reserved for documented
  self-service endpoints that every logged-in user may call, such as
  `GET /users/me`.
- Add tests or a metadata audit helper that fails when admin controllers expose
  management routes without permission metadata.
- JWT validation should verify that the user still exists and is allowed to
  authenticate before returning the request user. If user status is introduced,
  disabled users must receive `401`.

## Permission Lookup And Caching

JWT payload should not contain the full permission list.

Recommended access token payload:

```text
sub
username or email, optional
tokenVersion or sessionVersion, optional for future session lifecycle work
```

The permissions guard should resolve permissions by `sub`:

```text
1. Read Redis key user_permissions:{userId}.
2. On cache miss, query active user roles and active permissions from DB.
3. Return role codes and permission codes.
4. Cache the result with a short TTL, for example 5-10 minutes.
```

Invalidate permission cache when:

- User roles are updated.
- A role's permissions are updated.
- A role is disabled or enabled.
- A permission is disabled or enabled by seed/admin maintenance.

If cache invalidation for role changes is expensive, the first version may use a
short TTL, but security-sensitive revocation should invalidate synchronously.
Do not use Redis `KEYS user_permissions:*` in production paths. Use one of:

- per-user invalidation for user-role changes
- SCAN-based background cleanup for broad maintenance
- a global permission version key included in cache keys
- a role-to-user lookup that clears only users assigned to the changed role

The default target should be: user-role changes and role-permission changes take
effect immediately after the API request succeeds.

## Backend Modules

Recommended module split:

```text
apps/api/src/permission/
  permission.registry.ts
  permission.service.ts
  permission.controller.ts
  permission.module.ts

apps/api/src/role/
  dto/
  role.mapper.ts
  role.service.ts
  role.controller.ts
  role.module.ts

apps/api/src/auth/
  permissions.decorator.ts
  permissions.guard.ts
```

Responsibilities:

- `permission.registry.ts` owns the system permission definitions.
- `permission.service.ts` exposes read-only permission queries and permission
  resolution helpers.
- `role.service.ts` owns role CRUD and role-permission assignment.
- `user.service.ts` owns user-role assignment.
- `permissions.guard.ts` enforces permission metadata on routes.

## API Surface

Permission APIs:

```text
GET /permissions
GET /permissions/modules
```

Role APIs:

```text
GET    /roles
POST   /roles
GET    /roles/:id
PATCH  /roles/:id
DELETE /roles/:id
PUT    /roles/:id/permissions
```

User APIs:

```text
GET    /users
POST   /users
PATCH  /users/:id
DELETE /users/:id
PUT    /users/:id/roles
GET    /users/me
```

User role behavior:

- `POST /users` may accept role IDs/codes. If omitted, assign the active default
  role.
- `PATCH /users/:id` should not silently mutate roles; use
  `PUT /users/:id/roles` for replacement.
- `PUT /users/:id/roles` replaces the full role set atomically.
- User list filtering should replace the old single `role` filter with role
  code or role id filters that can match any assigned role.
- User list sorting should not sort by role until a deterministic multi-role
  sort rule is designed.
- Responses should expose `roles`, not a single `role`.

`GET /users/me` should return the current user's role and permission context:

```ts
{
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  roles: Array<{ code: string; name: string }>
  permissions: string[]
}
```

## Frontend Permission Consumption

The frontend auth state should store:

```text
accessToken
user
roles
permissions
isAuthenticated
```

Add one permission helper layer:

```ts
can('user.create')
canAll(['role.read', 'permission.read'])
canAny(['file.update', 'file.delete'])
```

All menu, route, page, and button checks should use this helper layer.

### Route And Menu Config

Move hard-coded admin navigation into route metadata.

```ts
const adminRoutes = [
  {
    path: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: Lock,
    requiredPermissions: ['dashboard.view'],
    component: DashboardContent,
  },
  {
    path: '/users',
    labelKey: 'nav.users',
    icon: Users,
    requiredPermissions: ['user.read'],
    component: UsersPage,
  },
  {
    path: '/roles',
    labelKey: 'nav.roles',
    icon: Shield,
    requiredPermissions: ['role.read'],
    component: RolesPage,
  },
]
```

Rules:

- Menus render only routes whose permissions the user has.
- Direct URL access without permission goes to `/403`.
- Unknown routes go to `/404` or the existing fallback route behavior.
- Login redirects should send authenticated users to the first visible route,
  falling back to `/dashboard` only when allowed.

The project can keep the current hand-written route guard in the first RBAC
phase. If the project later migrates to TanStack Router, the same route metadata
should become route `meta`.

### Buttons And Actions

Use permission checks for page actions:

```tsx
{can('user.create') ? <CreateUserButton /> : null}
{can('user.update') ? <EditUserButton /> : null}
{can('user.delete') ? <DeleteUserButton /> : null}
```

Rules:

- Hide unavailable actions by default.
- Use `/403` or an empty state when the page itself is not allowed.
- Never rely on frontend checks as the security boundary.
- Every protected API action must still have `@Permissions()`.

## Admin Pages

Add a role management page:

- List roles.
- Create non-system roles.
- Edit role name, description, status, and default flag.
- Delete non-system roles.
- Assign permissions to a role with grouped permission checkboxes.
- Prevent deleting or disabling `super_admin`.
- Prevent removing the last active `super_admin` assignment from users.
- Prevent users from demoting themselves out of the last active `super_admin`
  account.

Add a read-only permission list page or a tab inside role management:

- Group permissions by module.
- Show code, name, description, and status.
- Do not allow arbitrary create/delete from the UI.

## Testing Strategy

Backend tests:

- Permission registry seed is idempotent.
- Seed `defaultRoles` does not re-grant permissions manually removed from a role.
- System roles are created by seed.
- `super_admin` can access all protected routes.
- Missing permission returns `403`.
- Unauthenticated requests return `401`.
- Disabled role permissions do not grant access.
- Disabled permissions do not grant access.
- Multiple user roles produce a union of permissions.
- User role assignment rejects disabled roles.
- Last `super_admin` assignment cannot be removed.
- Admin management routes without permission metadata are detected.
- System role constraints are enforced.

Frontend tests:

- Auth session stores roles and permissions.
- `can`, `canAll`, and `canAny` behave correctly.
- Menu hides routes without permissions.
- Route guard redirects unauthenticated users to `/login`.
- Route guard redirects authenticated users without permission to `/403`.
- Page action buttons hide when permissions are missing.
- Role permission assignment UI submits selected permission codes.

Audit expectations:

- RBAC mutations are sensitive operations. Until the audit-log module is built,
  services should keep mutation boundaries explicit so audit hooks can be added
  without rewriting the flow.
- Minimum future audit events: role create/update/delete/disable, role permission
  replacement, user role replacement, permission disabled by seed or maintenance,
  and failed attempts to remove the last `super_admin`.

## Rollout Plan

Suggested implementation sequence:

```text
1. Add Prisma RBAC models, registry, and seed upsert flow.
2. Add PermissionService, permission resolution, and cache invalidation helpers.
3. Add @Permissions() and PermissionsGuard while old @Roles() still exists.
4. Convert controllers from @Roles() to @Permissions().
5. Update auth responses and /users/me to return roles and permissions.
6. Update user CRUD to assign roles instead of a single enum role.
7. Remove old Role enum/User.role and update DTOs, filters, tests, seed, and
   frontend types in the same change set.
8. Add role management backend APIs.
9. Add frontend permission helpers and auth state changes.
10. Convert AdminShell to route/menu metadata.
11. Add /403 and permission-aware route guard.
12. Add role management and permission list UI.
13. Update CRUD development documentation.
```

## Out Of Scope

- Department or organization hierarchy.
- Row-level data permissions.
- Tenant-level isolation.
- ABAC rules.
- Field-level permissions.
- Approval workflows.
- Policy expression languages.
- Permission editing from the admin UI.
- Backward-compatible migration from the old `ADMIN` / `STANDARD` enum model.
