# Data Permission Framework Design

## Goal

Add a reusable data permission framework to Common Admin.

The feature should let roles define which rows a user can access, then apply
that rule consistently to backend list, detail, and write operations. The first
implementation should integrate the framework with user management because
users already have department membership and are the clearest validation target.

## Context

Common Admin already has:

- authentication and refresh-token sessions;
- RBAC permissions with multiple roles per user;
- user, role, and permission management;
- organization foundation with departments, positions, user departments, and
  user positions;
- OpenAPI generation and generated frontend API clients.

The current RBAC system answers whether a user may call an API or see a page
action. It does not answer which rows the user may see or mutate after the API
permission check succeeds.

The organization design intentionally prepared department membership for data
permission rules such as:

- self;
- current department;
- current department and child departments;
- custom departments.

This design adds that missing row-level permission layer without replacing the
existing RBAC permission flow.

## Non-Goals

- Do not replace RBAC permission codes or `@Permissions()`.
- Do not implement a controller decorator or guard-based data scope abstraction
  in the first version.
- Do not use Prisma middleware to globally inject filters.
- Do not add multi-tenant isolation.
- Do not add per-module data scopes in the first version.
- Do not add position-based data scopes.
- Do not add department manager or reporting-line rules.
- Do not apply data scopes to role, permission, department, position, setting,
  audit-log, file, or session modules in the first version.
- Do not build a generic expression language for data permission filters.

## Chosen Approach

Use role-level global data scopes as the foundation.

Each active role has one global data scope:

```text
ALL
SELF
DEPT
DEPT_AND_CHILDREN
CUSTOM_DEPT
```

Users may have multiple active roles. Their effective data scope is the union of
all active role scopes. `super_admin` always has full access.

The first version should implement the core in backend services:

- `PermissionService` continues to resolve RBAC permission context.
- The user permission context is extended with effective data scope metadata.
- A new backend helper/service builds Prisma `where` fragments and access
  checks for scoped resources.
- `UserService` explicitly applies those helpers to list, detail, and write
  operations.

This keeps the security boundary visible in the service layer and avoids
premature controller magic. A later `@DataScopedResource()` decorator may be
added as documentation and test metadata after the core filtering behavior is
stable.

## Data Model

Add a Prisma enum:

```prisma
enum DataScope {
  ALL
  SELF
  DEPT
  DEPT_AND_CHILDREN
  CUSTOM_DEPT
}
```

Extend `Role`:

```text
dataScope DataScope @default(SELF)
```

Add `RoleDataScopeDepartment`:

```text
roleId
departmentId
createdAt
```

Relationships:

- `Role.dataScopeDepartments` through `RoleDataScopeDepartment`;
- `Department.roleDataScopes` through `RoleDataScopeDepartment`.

Indexes:

- composite primary key on `roleId, departmentId`;
- index on `departmentId`.

Rules:

- `CUSTOM_DEPT` role create/update submissions must include at least one active
  department.
- Non-`CUSTOM_DEPT` roles must not keep custom department links.
- Disabled departments cannot be newly selected for custom scopes.
- Existing links to departments that are later disabled remain stored for audit
  and display, but disabled departments do not contribute to effective data
  scope calculation.
- A `CUSTOM_DEPT` role whose stored departments are all later disabled is valid
  as stored configuration, but grants no department-scoped access until at least
  one linked department is re-enabled or the role is edited with active
  departments.
- When a `CUSTOM_DEPT` role is edited, the submitted department set replaces
  the old set and must contain only active departments.
- Existing role records migrate to `SELF` by default, then seed updates system
  roles to their intended scopes.

## Seed Rules

Seed should upsert system role data scopes:

```text
super_admin -> ALL
admin       -> ALL
standard    -> SELF
```

The seed should not create custom department links for system roles.

`super_admin` still receives full access through explicit service logic. The
database value remains useful for UI display and consistency.

## Effective Scope Semantics

### Scope Meanings

`ALL` means no row-level restriction.

`SELF` means the current user's own user row.

`DEPT` means users who belong to any active department assigned to the current
user.

`DEPT_AND_CHILDREN` means users who belong to any active department assigned to
the current user or any active descendant of those departments.

`CUSTOM_DEPT` means users who belong to active departments explicitly assigned
to the role. If a linked department is later disabled, it stops granting access
until it is re-enabled.

### Multi-Role Merge

Effective access is a union:

- if any active role grants `ALL`, the effective scope is `ALL`;
- otherwise include the current user's own id for every `SELF` grant;
- include current user department ids for `DEPT`;
- include current user department ids and descendants for `DEPT_AND_CHILDREN`;
- include custom role department ids for `CUSTOM_DEPT`;
- de-duplicate all ids before building queries.

The merged result can be represented as:

```ts
interface EffectiveDataScope {
  mode: 'ALL' | 'LIMITED';
  selfUserIds: string[];
  departmentIds: string[];
}
```

For user management, a row is visible when:

- the effective mode is `ALL`; or
- the row id is in `selfUserIds`; or
- the row has at least one `UserDepartment.departmentId` in `departmentIds`.

### Empty Limited Scope

A limited scope may resolve to no departments. For example, a user with only a
`DEPT` role but no departments assigned should see no department-scoped rows.

If the same user also has `SELF`, they can still see themselves. Otherwise, the
query should return an empty result instead of falling back to all rows.

## Backend Architecture

### Permission Context

Extend `UserPermissionContext`:

```ts
interface UserPermissionContext {
  userId: string
  roleCodes: string[]
  permissionCodes: string[]
  isSuperAdmin: boolean
  dataScope: EffectiveDataScope
}
```

`PermissionService.resolveUserPermissionContext()` should continue to be the
single cached resolver for authorization context. It should load active roles,
active permissions, role data scopes, role custom departments, and current user
department ids in one context-building path.

Keeping permission and data scope in one context has two benefits:

- existing request paths already resolve this context for protected endpoints;
- existing Redis invalidation can be reused and extended.

### Data Scope Helper

Add a small backend service or helper owned by the permission/data-permission
area. Suggested name:

```text
apps/api/src/data-permission/data-permission.service.ts
```

Responsibilities:

- resolve the effective scope for a user by using `PermissionService`;
- build a Prisma `UserWhereInput` fragment for user visibility;
- assert that a target user id is visible to an actor;
- expose focused methods instead of a generic resource DSL.

Suggested interface:

```ts
buildUserVisibilityWhere(actorUserId: string): Promise<Prisma.UserWhereInput>
assertCanAccessUser(actorUserId: string, targetUserId: string): Promise<void>
```

For `ALL`, `buildUserVisibilityWhere()` returns `{}`.

For limited scopes, it returns an `OR` over self ids and department membership.
If no condition exists, it returns an impossible condition such as
`{ id: { in: [] } }`.

`assertCanAccessUser()` should check existence through the same visibility
predicate and throw `NotFoundException('User not found')` when the target is not
visible. Returning 404 avoids leaking whether an inaccessible user id exists.

### UserService Integration

Update user controller methods to pass the current actor user id into scoped
service methods:

- `listUsers(query, actorUserId)`;
- `findById(id, actorUserId)`;
- `createUser(dto, actorUserId, actor, requestMeta, auditMetadata)`;
- `updateUser(id, dto, actorUserId, actor, requestMeta, auditMetadata)`;
- `deleteUser(id, actorUserId, actor, requestMeta, auditMetadata)`;
- `resetPassword(id, newPassword, actorUserId, actor, requestMeta,
  auditMetadata)`;
- `replaceRoles(id, roleCodes, actorUserId, actor, requestMeta,
  auditMetadata)`.

`listUsers()` should combine existing filters with visibility:

```ts
const where = {
  AND: [
    this.buildUserWhere(query),
    await this.dataPermissionService.buildUserVisibilityWhere(actorUserId),
  ],
}
```

Detail and write operations should call `assertCanAccessUser()` before reading
or mutating the target user. Existing business rules such as demo-mode protected
admin checks and last `super_admin` assignment protection still apply.

User creation has no existing target row to check, so its data-scope rule is
based on requested department assignment:

- RBAC `user.create` is still required for all user creation.
- Role assignment during creation remains governed by the existing
  user-management and RBAC rules. Data scope only limits the requested
  department assignment.
- Actors with `ALL` may create users in any active department, or with no
  department assignment.
- Limited actors may create users with no department assignment.
- Limited actors may create users with department assignments only when every
  requested department is inside the actor's effective department scope.
- A limited actor whose effective scope only contains `SELF` and no departments
  cannot create a user assigned to a department.

This keeps create usable for simple accounts while preventing an actor from
seeding users into departments they cannot otherwise access.

`GET /users/me` remains available to every authenticated user and does not need
explicit data-scope filtering.

### Module Boundaries

The first implementation should keep boundaries clear:

- `PermissionService`: permission and cached user context resolution;
- `DataPermissionService`: row-level visibility predicates and assertions;
- `UserService`: user business operations and explicit use of visibility
  predicates;
- `RoleService`: role CRUD, data scope validation, custom department link
  maintenance, and cache invalidation.

Avoid making frontend code responsible for security. Frontend changes only
configure and display role data scopes.

## Role API Contract

Extend role request DTOs:

```ts
dataScope?: DataScope
dataScopeDepartmentIds?: string[]
```

Creation defaults `dataScope` to `SELF` when omitted.

Validation rules:

- `dataScope` must be a valid `DataScope`;
- `dataScopeDepartmentIds` must be omitted or empty unless data scope is
  `CUSTOM_DEPT`;
- `CUSTOM_DEPT` requires at least one department id;
- department ids must be unique;
- selected departments must exist and be `ACTIVE`.

Extend role responses:

```ts
dataScope: DataScope
dataScopeDepartments: Array<{
  id: string
  code: string
  name: string
  status: DepartmentStatus
}>
```

Role list and detail endpoints should include this data so the frontend can
render role data permission settings without extra calls per row.

`dataScopeDepartments` should include stored custom department links even when a
linked department is now disabled. The `status` field lets the UI show stale
configuration clearly. Disabled linked departments are display-only and are
ignored when calculating effective access.

`dataScopeDepartments` should always be returned as an array. Non-`CUSTOM_DEPT`
roles return `[]`.

No new permission code is needed for data-scope editing in the first version.
It is part of role creation and update, protected by existing `role.create` and
`role.update`.

## Frontend Design

Update the existing role create/edit form.

Controls:

- a select for data scope;
- a department multi-select that appears only when `CUSTOM_DEPT` is selected.

Display:

- role list shows a concise data scope label;
- role detail/edit state shows selected custom departments when applicable.

Frontend validation should mirror backend validation for usability, but backend
validation remains authoritative.

The frontend should use generated API types and endpoint functions after
OpenAPI regeneration. It should not hand-edit generated files.

## Cache Invalidation

Reuse the existing permission context cache versioning.

Invalidate one user's context when:

- that user's roles are replaced;
- that user's department assignments change.

Invalidate all user contexts when:

- a role is created, updated, disabled, deleted, or has its data scope changed;
- role permissions are replaced;
- a department is created, updated, moved, disabled, or deleted, because
  descendant scope calculation or active custom-scope membership may change;
- permissions are reseeded or globally invalidated by existing flows.

This is intentionally conservative. Broad invalidation is acceptable because
the existing context cache TTL is short and role/department changes are
administrative operations.

## Error Handling

Use existing NestJS exceptions and the project's standard error mapping.

Rules:

- invalid data-scope DTOs return `400`;
- missing or disabled custom-scope departments return `400`;
- inaccessible user detail or write targets return `404 User not found`;
- normal RBAC failures still return `403` from `@Permissions()`;
- unauthenticated requests still return `401`.

## Audit Logging

Role data-scope changes should be included in existing role create and update
audit logs.

User operations should keep existing audit behavior. Data-scope denials should
not create mutation audit entries because no mutation happened.

## OpenAPI And Generated API

Backend DTO changes are the source of truth.

Implementation should regenerate:

- `apps/api/openapi.json`;
- `apps/admin/src/generated/api/`.

Generated files must not be manually edited.

## First-Version Rollout

The first version should deliver:

1. Prisma data model and migration for role data scopes.
2. Seed updates for system roles.
3. Backend data-scope context resolution and helper service.
4. Role API support for configuring data scope and custom departments.
5. User management backend filtering and target access checks.
6. Frontend role UI controls and display.
7. OpenAPI and generated frontend API updates.
8. Backend and frontend tests.

Future versions may add:

- `@DataScopedResource()` metadata for documentation and test enforcement;
- per-module role data scopes;
- reusable helpers for resources that have `ownerUserId`, `departmentId`, or
  custom ownership fields;
- import/export data-scope enforcement when those modules exist.

## Testing Strategy

### Backend Unit Tests

Permission/data-scope context:

- active `super_admin` resolves to full data access;
- `ALL` role resolves to full data access;
- `SELF` role includes only the current user id;
- `DEPT` role includes the current user's active departments;
- `DEPT_AND_CHILDREN` role includes current departments and descendants;
- `CUSTOM_DEPT` role includes selected active departments;
- `CUSTOM_DEPT` role keeps disabled linked departments visible in role
  responses but excludes them from effective access;
- disabled roles do not participate;
- duplicate departments are de-duplicated;
- multi-role users receive the union of all scopes;
- limited users with no department membership do not fall back to full access.

Role service:

- create defaults to `SELF`;
- create/update accepts each non-custom scope without department ids;
- `CUSTOM_DEPT` requires unique active department ids;
- non-custom scopes reject custom department ids;
- updating data scope replaces stale custom department links;
- role changes invalidate all permission contexts.

User service:

- create with `ALL` allows any active department assignment;
- create with a limited department scope allows only departments inside the
  actor's effective department scope;
- create with a limited scope and no departments remains allowed when RBAC
  `user.create` passes;
- list with `ALL` returns all matching users;
- list with `SELF` returns only the actor when other filters allow it;
- list with `DEPT` returns users in the actor's departments;
- list with `DEPT_AND_CHILDREN` returns users in descendant departments;
- list with `CUSTOM_DEPT` returns users in selected departments;
- existing role, search, department, and position filters compose with data
  scope through `AND`;
- detail returns visible users and returns 404 for inaccessible users;
- update, delete, reset password, and role replacement reject inaccessible
  targets;
- `GET /users/me` still returns the current profile.

Cache invalidation:

- replacing user roles clears that user's context;
- changing user department assignments clears that user's context;
- role data-scope changes clear all contexts;
- department tree changes clear all contexts.

### Backend E2E Or Integration Tests

Add focused coverage for:

- authenticated user with `user.read` but `SELF` scope only sees self;
- authenticated user with `user.update` cannot update an out-of-scope user;
- `super_admin` can read and mutate all users;
- missing RBAC permission still returns `403`, independent of data scope.

### Frontend Tests

Role page tests should cover:

- data scope select renders in create/edit forms;
- custom department selector appears only for `CUSTOM_DEPT`;
- submitting a custom scope sends `dataScopeDepartmentIds`;
- role rows display data scope information;
- role actions remain governed by existing RBAC permission checks.

## Acceptance Criteria

- Roles can configure a global data scope.
- System roles seed with `super_admin=ALL`, `admin=ALL`, and `standard=SELF`.
- User list, detail, update, delete, password reset, and role replacement are
  limited by effective data scope.
- Users with multiple roles receive the union of those role scopes.
- Limited actors can create users with no departments, or with department
  assignments only inside their effective department scope.
- Inaccessible user ids return 404 for scoped detail and write operations.
- Existing RBAC permission behavior remains unchanged.
- Role data-scope changes, user department changes, and department tree changes
  invalidate affected cached contexts.
- OpenAPI and generated frontend API code reflect the new role contract.
- Tests cover scope calculation, user filtering, role validation, cache
  invalidation, and frontend role form behavior.
