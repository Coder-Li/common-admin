# Organization, Department, And Position Design

## Goal

Add an administrator-facing organization foundation to Common Admin.

The feature should let authorized administrators maintain department trees and
position records, and let user administrators assign users to one or more
departments and positions. It prepares the project for the later data permission
framework without implementing data permission filtering in this iteration.

## Context

Common Admin already has authentication, RBAC, users, roles, permissions,
dictionaries, files, audit logs, system settings, OpenAPI generation, and shared
admin CRUD table patterns.

The current user model only stores identity and role membership. Most enterprise
admin systems eventually need organization relationships for ownership,
reporting, approval, and data permission rules such as:

- current user only;
- current department;
- current department and child departments;
- custom departments.

This design adds the organization data foundation first. The next data
permission feature can then consume stable department membership instead of
inventing resource-specific filters.

## Non-Goals

- Do not implement data permission filtering.
- Do not add multi-tenant organization isolation.
- Do not add department managers or supervisors.
- Do not add department member detail pages.
- Do not add position member detail pages.
- Do not add batch assignment.
- Do not add drag-and-drop tree sorting or moving.
- Do not add approval workflow, reporting-line hierarchy, or headcount planning.
- Do not replace the existing user, role, permission, or route architecture.

## Chosen Approach

Add dedicated department and position admin modules, and extend the existing user
management form to maintain user organization assignments.

The first version uses a standard enterprise relationship model:

- one user can belong to multiple departments;
- one of those departments can be marked as the primary department;
- one user can hold multiple positions;
- department and position records both have `ACTIVE` and `DISABLED` states;
- disabled records remain visible for history but cannot be newly assigned.

Organization base data and user organization assignments have separate
responsibilities:

- department management maintains the department tree and department metadata;
- position management maintains reusable position metadata;
- user management assigns departments and positions to users.

This keeps the first version useful without building a full organization center.

## Data Model

Add these Prisma enums:

```prisma
enum DepartmentStatus {
  ACTIVE
  DISABLED
}

enum PositionStatus {
  ACTIVE
  DISABLED
}
```

Add `Department`:

```text
id
code unique, varchar(80)
name varchar(120)
parentId nullable
status DepartmentStatus, default ACTIVE
sortOrder int, default 0
description nullable, varchar(500)
createdAt
updatedAt
```

Relationships:

- `parent` self relation through `parentId`;
- `children` self relation;
- `users` through `UserDepartment`.

Indexes:

- `code` unique;
- `parentId, sortOrder`;
- `status`;
- `name`.

Add `Position`:

```text
id
code unique, varchar(80)
name varchar(120)
status PositionStatus, default ACTIVE
sortOrder int, default 0
description nullable, varchar(500)
createdAt
updatedAt
```

Relationships:

- `users` through `UserPosition`.

Indexes:

- `code` unique;
- `status, sortOrder`;
- `name`.

Add `UserDepartment`:

```text
userId
departmentId
isPrimary boolean, default false
createdAt
```

Relationships:

- `user` references `User`, `onDelete: Cascade`;
- `department` references `Department`.

Constraints and indexes:

- primary key `[userId, departmentId]`;
- index `departmentId`;
- at most one primary department per user.

PostgreSQL should enforce the one-primary-department invariant with a partial
unique index:

```sql
CREATE UNIQUE INDEX user_departments_one_primary_per_user
ON "UserDepartment" ("userId")
WHERE "isPrimary" = true;
```

The service layer must also validate this invariant before writing, so tests can
cover the business rule without depending only on database behavior.

Add `UserPosition`:

```text
userId
positionId
createdAt
```

Relationships:

- `user` references `User`, `onDelete: Cascade`;
- `position` references `Position`.

Constraints and indexes:

- primary key `[userId, positionId]`;
- index `positionId`.

Extend `User` relationships:

- `departments UserDepartment[]`;
- `positions UserPosition[]`.

## Domain Rules

Department rules:

- Department `code` is required, unique, stable, and lowercase-friendly.
- Department `code` should be trimmed by DTO transformation when the existing
  DTO pattern supports it, must not exceed 80 characters, and should be
  documented as lowercase snake-case or kebab-case for operators.
- Department `name` is required.
- Department `name` must not exceed 120 characters.
- A department can be a root department when `parentId` is omitted.
- A department cannot use itself as its parent.
- A department cannot use one of its descendants as its parent.
- A disabled department cannot be newly selected as another department's parent.
- During department update, omitted `parentId` means leave the existing parent
  unchanged. This lets an existing disabled parent remain attached during
  unrelated department edits.
- During department update, an explicit `parentId` value must be either `null`
  for a root department or an active department id.
- Disabling a department does not change child departments or user assignments.
- A disabled department cannot be newly selected for user assignment.
- Deleting a department is rejected when it has child departments.
- Deleting a department is rejected when it has assigned users.

Position rules:

- Position `code` is required, unique, stable, and lowercase-friendly.
- Position `code` should be trimmed by DTO transformation when the existing DTO
  pattern supports it, must not exceed 80 characters, and should be documented
  as lowercase snake-case or kebab-case for operators.
- Position `name` is required.
- Position `name` must not exceed 120 characters.
- Disabling a position does not change user assignments.
- A disabled position cannot be newly selected for user assignment.
- Deleting a position is rejected when it has assigned users.

User assignment rules:

- A user can have zero or more departments.
- A user can have zero or more positions.
- When `primaryDepartmentId` is provided, it must be present in
  `departmentIds`.
- When exactly one department is submitted and no `primaryDepartmentId` is
  provided, the service marks that department as primary.
- When multiple departments are submitted, the request must provide
  `primaryDepartmentId`; otherwise return `400` to avoid ambiguous data.
- During user creation, omitted `departmentIds` and `positionIds` mean no
  organization assignment.
- During user update, omitted `departmentIds`, `primaryDepartmentId`, and
  `positionIds` mean leave existing assignments unchanged.
- During user update, an explicit empty `departmentIds: []` clears all
  department assignments and requires `primaryDepartmentId` to be omitted.
- During user update, an explicit empty `positionIds: []` clears all position
  assignments.
- During user update, provided `departmentIds` and `positionIds` replace the
  existing assignments for that relationship.
- User update requests should submit assignment fields only when the user
  intentionally changes assignments. Saving unrelated user fields must omit
  `departmentIds`, `primaryDepartmentId`, and `positionIds`.
- Assignments are updated in the same transaction as the user write.
- Assigning a missing, disabled, or duplicate department id returns `400`.
- Assigning a missing, disabled, or duplicate position id returns `400`.
- Existing disabled department and position assignments can remain on a user
  when the corresponding update field is omitted. If the corresponding field is
  provided, every submitted id must be active.
- If a user already has disabled assignments and an administrator edits that
  assignment type, the disabled ids cannot be resubmitted to retain them. The
  administrator must either leave that assignment type unchanged or replace it
  with active ids.
- Department and position summaries are ordered by primary department first,
  then `sortOrder`, then `name`.

## Backend Architecture

Follow the repository's standard CRUD shape from
`docs/patterns/admin-crud-table-pattern-guide.md` and RBAC shape from
`docs/patterns/admin-rbac-crud-permission-pattern-guide.md`.

### Department Module

Add:

```text
apps/api/src/department/
  dto/
    department.request.ts
    department.response.ts
  department.mapper.ts
  department.service.ts
  department.controller.ts
  department.module.ts
```

Responsibilities:

- `DepartmentController` owns routes, Swagger metadata, operation ids, and
  method-level `@Permissions()` decorators.
- `DepartmentService` owns validation, Prisma queries, tree construction,
  dependency checks, and audit-log coordination.
- `department.mapper` owns conversion from Prisma records to public response
  DTOs and ISO date strings.
- DTOs own query validation, request validation, and Swagger response metadata.

Endpoints:

```text
GET    /departments
GET    /departments/tree
GET    /departments/options
GET    /departments/:id
POST   /departments
PATCH  /departments/:id
DELETE /departments/:id
```

List query:

```text
page
pageSize
search
status=ACTIVE|DISABLED
parentId
sort=name:asc
```

Search fields:

- `code`;
- `name`;
- `description`.

Allowed sort fields:

- `name`;
- `code`;
- `sortOrder`;
- `createdAt`;
- `updatedAt`.

Default sort:

```text
sortOrder:asc
```

The standard list endpoint returns the existing list response shape:

```text
{ items, total, page, pageSize }
```

The tree endpoint returns the complete nested department tree ordered by
`sortOrder` then `name`. It does not implement search in the first version.
Filtered table behavior uses `GET /departments`; selector behavior uses
`GET /departments/options`.

The options endpoint returns a flat list ordered by `sortOrder` then `name`.
It supports:

```text
status=ACTIVE|DISABLED
includeIds
```

By default it returns active departments only. `includeIds` is a comma-separated
list of department ids that should be included even when disabled, so edit forms
can render existing historical assignments without allowing new disabled
selection. Unknown `includeIds` values are ignored; duplicate ids are
deduplicated in the response.

Public department fields:

```text
id
code
name
parentId
parentName
status
sortOrder
description
createdAt
updatedAt
```

Tree node fields:

```text
id
code
name
parentId
status
sortOrder
children
```

Options endpoint fields:

```text
id
code
name
parentId
status
```

### Position Module

Add:

```text
apps/api/src/position/
  dto/
    position.request.ts
    position.response.ts
  position.mapper.ts
  position.service.ts
  position.controller.ts
  position.module.ts
```

Responsibilities:

- `PositionController` owns routes, Swagger metadata, operation ids, and
  method-level `@Permissions()` decorators.
- `PositionService` owns validation, Prisma queries, dependency checks, and
  audit-log coordination.
- `position.mapper` owns conversion from Prisma records to public response DTOs
  and ISO date strings.
- DTOs own query validation, request validation, and Swagger response metadata.

Endpoints:

```text
GET    /positions
GET    /positions/options
GET    /positions/:id
POST   /positions
PATCH  /positions/:id
DELETE /positions/:id
```

List query:

```text
page
pageSize
search
status=ACTIVE|DISABLED
sort=sortOrder:asc
```

Search fields:

- `code`;
- `name`;
- `description`.

Allowed sort fields:

- `name`;
- `code`;
- `sortOrder`;
- `createdAt`;
- `updatedAt`.

Default sort:

```text
sortOrder:asc
```

Public position fields:

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

Options endpoint fields:

```text
id
code
name
status
```

The options endpoint returns active positions by default and is used by the user
form. It should expose a simple, stable response DTO rather than requiring the
form to page through the full list endpoint. It accepts an optional
comma-separated `includeIds` query parameter so edit forms can render existing
disabled assignments while keeping new selections limited to active positions.
Unknown `includeIds` values are ignored; duplicate ids are deduplicated in the
response.

### User Module Extension

Extend existing files instead of creating a second user assignment module:

```text
apps/api/src/user/dto/user.request.ts
apps/api/src/user/dto/user.response.ts
apps/api/src/user/user.mapper.ts
apps/api/src/user/user.service.ts
apps/api/src/user/user.service.spec.ts
apps/api/src/user/user.controller.spec.ts
```

Extend request DTOs:

- `CreateUserDto.departmentIds?: string[]`;
- `CreateUserDto.primaryDepartmentId?: string`;
- `CreateUserDto.positionIds?: string[]`;
- `UpdateUserDto.departmentIds?: string[]`;
- `UpdateUserDto.primaryDepartmentId?: string`;
- `UpdateUserDto.positionIds?: string[]`.

Update DTO semantics:

- omitted assignment fields leave that assignment type unchanged;
- `departmentIds: []` clears department assignments;
- `positionIds: []` clears position assignments;
- provided arrays replace the assignment type they represent;
- duplicate ids are rejected before writing.
- update payloads generated by `UserForm` should omit assignment fields that are
  unchanged from the loaded user.

Extend `UserListQueryDto`:

- `departmentId?: string`;
- `positionId?: string`.

Extend `UserResponseDto`:

```text
departments: UserDepartmentSummaryDto[]
primaryDepartment: UserDepartmentSummaryDto | null
positions: UserPositionSummaryDto[]
```

Summary fields:

```text
id
code
name
status
```

Service behavior:

- Include department and position assignments in user list and detail queries.
- Filter users by `departmentId` and `positionId` when provided.
- Create and update user organization assignments inside the existing user
  transaction.
- Keep role assignment behavior unchanged.
- Preserve existing password and session revocation behavior.
- Audit user updates with the public response shape, including organization
  summaries.
- Preserve existing disabled department or position assignments during unrelated
  user edits when assignment fields are omitted.
- Reject submitted disabled department or position ids when assignment fields
  are provided.

## Permissions

Add permission registry entries:

```text
department.read
department.create
department.update
department.delete
position.read
position.create
position.update
position.delete
```

Default roles:

- `admin` receives `read`, `create`, and `update` permissions.
- `department.delete` and `position.delete` default to no normal admin role.
- `standard` receives none.
- `super_admin` continues to have all active permissions through the existing
  permission behavior.

User organization assignment happens through the existing user create and update
flows. The first version uses existing user permissions:

- creating a user with organization assignments requires `user.create`;
- updating a user's organization assignments requires `user.update`.

Do not add `user.assign_organization` in this iteration. That permission can be
introduced later if administrators need to separate profile editing from
organization assignment.

Endpoint permission mapping:

```text
GET    /departments          department.read
GET    /departments/tree     department.read
GET    /departments/options  department.read
GET    /departments/:id      department.read
POST   /departments          department.create
PATCH  /departments/:id      department.update
DELETE /departments/:id      department.delete

GET    /positions            position.read
GET    /positions/options    position.read
GET    /positions/:id        position.read
POST   /positions            position.create
PATCH  /positions/:id        position.update
DELETE /positions/:id        position.delete
```

## Audit Logging

Department mutations record audit logs:

- create: `CREATE`, resource type `DEPARTMENT`;
- update: `UPDATE`, resource type `DEPARTMENT`;
- delete: `DELETE`, resource type `DEPARTMENT`.

Position mutations record audit logs:

- create: `CREATE`, resource type `POSITION`;
- update: `UPDATE`, resource type `POSITION`;
- delete: `DELETE`, resource type `POSITION`.

User organization assignment changes are captured by the existing user update
audit flow. The public user response used in audit `after` data should include
department and position summaries.

The audit constants should be extended rather than hard-coding resource type
strings in services.

## Error Handling

Use existing NestJS exceptions and the project's standard error mapping.

Department errors:

- missing department: `404`;
- duplicate department code: `409`;
- invalid parent id: `400`;
- parent id equals current department id: `400`;
- parent id points to a descendant: `400`;
- delete with child departments: `400`;
- delete with assigned users: `400`;
- invalid sort field or direction: validation error or `400`, matching existing
  list query conventions.

Position errors:

- missing position: `404`;
- duplicate position code: `409`;
- delete with assigned users: `400`;
- invalid sort field or direction: validation error or `400`, matching existing
  list query conventions.

User assignment errors:

- primary department not included in `departmentIds`: `400`;
- multiple departments without `primaryDepartmentId`: `400`;
- missing department id: `400`;
- disabled department id: `400`;
- duplicate department id: `400`;
- missing position id: `400`;
- disabled position id: `400`;
- duplicate position id: `400`.

## Frontend Architecture

Follow the repository's standard admin CRUD table pattern and generated API
contract pattern.

Use generated schema types, generated endpoint functions, generated hooks where
appropriate, and generated query key helpers. Do not create one-method
feature-local API wrappers.

### Routes And Menu

Add route metadata in `apps/admin/src/routes/admin-route-registry.tsx`:

```text
/departments  requiredPermissions: ['department.read']
/positions    requiredPermissions: ['position.read']
```

Place both routes in the existing system management menu group. Use lucide icons
that fit the current menu style.

Direct URL access without the route permission must resolve to `/403` through
the existing route metadata behavior.

### Department Page

Add:

```text
apps/admin/src/features/departments/
  departments.types.ts
  departments.columns.tsx
  DepartmentForm.tsx
  DepartmentsPage.tsx
  DepartmentsPage.test.tsx
```

The page should provide:

- dense operational management UI;
- department tree browsing;
- search;
- status filter;
- create root department;
- create child department;
- edit department;
- enable or disable through edit status;
- delete with confirmation;
- permission-aware action visibility.

Form fields:

- code;
- name;
- parent department;
- status;
- sort order;
- description.

Parent selector behavior:

- when editing, disable the current department and its descendants;
- allow empty parent for root departments;
- use active departments for normal selection;
- preserve the displayed current disabled parent value when editing historical
  data, but omit unchanged `parentId` from the update payload;
- reject attempts to change `parentId` to a disabled department.

### Position Page

Add:

```text
apps/admin/src/features/positions/
  positions.types.ts
  positions.columns.tsx
  PositionForm.tsx
  PositionsPage.tsx
  PositionsPage.test.tsx
```

The page should provide:

- standard paginated `DataTable`;
- search;
- status filter;
- sort by backend-allowed fields;
- create;
- edit;
- delete with confirmation;
- permission-aware action visibility.

Form fields:

- code;
- name;
- status;
- sort order;
- description.

### User Page Extension

Update the existing user feature:

```text
apps/admin/src/features/users/users.types.ts
apps/admin/src/features/users/users.columns.tsx
apps/admin/src/features/users/UserForm.tsx
apps/admin/src/features/users/UsersPage.tsx
apps/admin/src/features/users/UsersPage.test.tsx
```

User form changes:

- add department multi-select;
- add primary department select;
- add position multi-select;
- primary department options come from selected departments;
- when exactly one department is selected, default it as primary;
- when selected departments change and the primary department is no longer
  selected, clear or reset the primary department;
- on create, submit `departmentIds`, `primaryDepartmentId`, and `positionIds`;
- on update, submit `departmentIds`, `primaryDepartmentId`, and `positionIds`
  only when the corresponding assignment fields changed from the loaded user.

User table changes:

- show primary department summary;
- show position summary compactly;
- keep synthetic display columns unsortable unless the backend supports the sort
  field.

User list filters:

- add department filter using department options data;
- add position filter using position options data;
- pass `departmentId` and `positionId` to the generated user list endpoint.

Selector labels should use the department or position `name` as the primary
label and may show `code` as secondary supporting text when the existing control
shape supports it.

### I18n

Update `apps/admin/src/i18n/messages.ts` with navigation, table, form, action,
validation, empty-state, and confirmation copy for departments, positions, and
user organization fields.

## API Contract Generation

Backend DTOs and Swagger metadata are the source of truth.

Every consumed endpoint must have explicit `@ApiOperation({ operationId })`
values so Orval generates stable frontend functions and query key helpers.

Use these operation ids:

```text
listDepartments
getDepartmentTree
getDepartmentOptions
getDepartment
createDepartment
updateDepartment
deleteDepartment

listPositions
getPositionOptions
getPosition
createPosition
updatePosition
deletePosition
```

Existing user endpoint operation ids should remain stable. Extending user DTOs
and query params will still require regenerating the OpenAPI client, but should
not rename existing user endpoint functions unless the implementation uncovers a
contract-generation conflict.

After backend contract changes:

```bash
pnpm api:generate
pnpm api:check
```

The generated frontend API files under `apps/admin/src/generated/api/` are
expected to change and should be committed with the implementation.

## Testing

### Backend Tests

Department service tests:

- list default pagination and sorting;
- search `where` mapping;
- status and parent filters;
- allowed and rejected sort fields;
- create success;
- update success;
- duplicate code conflict;
- missing record returns not found;
- rejecting self parent;
- rejecting descendant parent;
- rejecting a newly selected disabled parent;
- preserving an existing disabled parent when `parentId` is omitted;
- delete success;
- delete rejected with child departments;
- delete rejected with assigned users;
- tree response ordering and nesting;
- audit log recording for mutations.

Position service tests:

- list default pagination and sorting;
- search `where` mapping;
- status filter;
- allowed and rejected sort fields;
- create success;
- update success;
- duplicate code conflict;
- missing record returns not found;
- delete success;
- delete rejected with assigned users;
- options endpoint returns active records in stable order;
- audit log recording for mutations.

User service tests:

- create user with departments and positions;
- update user replaces departments and positions;
- one selected department defaults to primary when no primary is provided;
- multiple departments without primary returns `400`;
- primary department outside selected departments returns `400`;
- disabled department cannot be assigned;
- existing disabled department assignment remains when department fields are
  omitted;
- missing department cannot be assigned;
- duplicate department ids are rejected;
- disabled position cannot be assigned;
- existing disabled position assignment remains when position fields are
  omitted;
- missing position cannot be assigned;
- duplicate position ids are rejected;
- list users filters by department id;
- list users filters by position id;
- mapper returns public organization summaries.

Controller and RBAC tests:

- unauthenticated users receive `401`;
- users missing permissions receive `403`;
- users with permissions can access list and mutation endpoints;
- delete endpoints return `204`;
- literal routes such as `tree` and `options` are registered before `:id`;
- permission metadata is present for every protected endpoint.

### Frontend Tests

Department page tests:

- loading state;
- empty state;
- returned tree/list data rendering;
- search and status filter query changes;
- create form opens and submits generated API payload;
- edit form opens with existing values;
- delete confirmation calls generated endpoint and invalidates query;
- actions are hidden when permissions are missing;
- API errors use the existing normalized error/toast behavior.

Position page tests:

- loading state;
- empty state;
- returned rows rendering;
- search, status filter, pagination, and sorting behavior;
- create, edit, and delete flows;
- actions are hidden when permissions are missing;
- API errors use the existing normalized error/toast behavior.

User page tests:

- organization fields render in create and edit forms;
- department selection drives primary department options;
- one selected department defaults as primary;
- invalid primary selection is prevented or cleared in the UI;
- submit payload includes department and position ids;
- unchanged organization assignment fields are omitted from update payloads;
- editing unrelated fields on a user with disabled assignments preserves those
  assignments;
- department and position filters update list query params;
- table renders primary department and position summaries.

Route tests:

- department and position routes appear for users with read permissions;
- department and position routes are hidden without read permissions;
- direct route access without permission resolves to forbidden behavior.

## Verification Commands

Run the existing quality checks before claiming implementation complete:

```bash
pnpm api:check
pnpm --filter api exec jest --runInBand
pnpm --filter admin test
pnpm --filter api build
pnpm --filter admin build
pnpm --filter api lint
pnpm --filter admin lint
```

For UI work, also start the admin app and smoke test the department, position,
and user pages in a browser.

## Implementation Decisions

- `GET /departments/tree` returns the complete tree and does not support search
  in the first version.
- Department management uses a tree-first layout backed by standard form and
  mutation patterns. It may use a compact adjacent detail/table area when that
  fits the existing admin UI, but it must not introduce drag-and-drop behavior.
- User edit selectors load active departments and positions by default, plus
  currently assigned disabled ids through `includeIds`, so historical
  assignments remain visible without enabling new disabled assignments.
