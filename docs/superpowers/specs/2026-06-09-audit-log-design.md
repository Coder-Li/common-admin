# Audit Log Design

## Goal

Add a reusable business audit log module to Common Admin.

The feature should record successful administrative write operations for core
business resources, provide a permission-protected read-only admin page, and
keep the implementation aligned with the existing NestJS, Prisma, RBAC, and
admin CRUD table patterns.

This is not an analytics, tracing, or security-event pipeline. Login, logout,
refresh token, failed authentication, validation failures, and read-only user
actions are out of scope for the first version.

## Context

Common Admin already has a React admin app, NestJS API, Prisma data model, RBAC
permissions, CRUD table conventions, and modules for users, roles,
permissions, dictionaries, files, and auth sessions.

Current records have `createdAt` and `updatedAt`, but there is no generic
business operation history. That means administrators cannot answer common
questions such as:

- Who changed this user's roles?
- When was this dictionary item edited?
- Which administrator soft-deleted this file?
- What were the before and after values of a sensitive admin operation?

The project should prefer mature, stable patterns over a heavy dependency. The
current NestJS + Prisma audit-log ecosystem does not have an obviously mature,
lightweight, unopinionated package that fits this codebase without extra
framework coupling. The chosen implementation should therefore be a small local
module that follows standard audit-log design and remains replaceable later.

## Chosen Approach

Create a local `AuditLogModule` backed by PostgreSQL through Prisma.

Business services call `AuditLogService.record()` after successful write
operations. The audit module owns sanitization, persistence, list/detail query
APIs, response mapping, and permission-protected admin access.

Principles:

- Record business write operations, not reads, analytics events, or auth
  lifecycle events.
- Record semantic actions such as `replace_roles`, not only low-level database
  mutations.
- Store logs as append-only records.
- Do not expose update or delete APIs for audit logs.
- Sanitize snapshots before storage.
- Fail the business request if audit-log persistence fails.
- For normal Prisma-only writes, persist the business mutation and audit record
  in the same transaction.
- Keep the API and frontend shape consistent with
  `docs/patterns/admin-crud-table-pattern-guide.md`.
- Keep authorization consistent with
  `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`.

## Non-Goals

The first version should not include:

- Login, logout, refresh token, failed login, or token revocation logs.
- Page views, button clicks, downloads, or other analytics events.
- Failed validation, permission-denied, or business-exception logs.
- Database triggers.
- Prisma middleware that attempts to infer audit semantics automatically.
- OpenTelemetry, ClickHouse, ELK, or another external log pipeline.
- Field-level diff UI.
- Export, retention, archiving, or cleanup policies.
- Editing or deleting audit log records from the admin UI.

These may be considered later, but they should not complicate the first
business audit-log implementation.

## Data Model

Add a Prisma model:

```prisma
model AuditLog {
  id           String   @id @default(uuid())
  actorUserId  String?
  actorEmail   String?  @db.VarChar(255)
  actorName    String?  @db.VarChar(160)

  action       String   @db.VarChar(80)
  resourceType String   @db.VarChar(80)
  resourceId   String?  @db.VarChar(120)

  before       Json?
  after        Json?
  metadata     Json?

  ipAddress    String?  @db.VarChar(80)
  userAgent    String?  @db.VarChar(500)

  createdAt    DateTime @default(now())

  @@index([createdAt])
  @@index([actorUserId])
  @@index([action])
  @@index([resourceType])
  @@index([resourceType, resourceId])
}
```

`actorEmail` and `actorName` are intentionally denormalized. Audit logs must
remain readable even if the user later changes their profile or is deleted.

`actorUserId` is nullable so future system actors, scripts, or background jobs
can write logs without pretending to be a real administrator. Most first-version
records should still come from an authenticated admin user.

### Append-Only Rule

The application must not expose update or delete methods for audit logs.

PostgreSQL-level immutability can be added later with triggers or restricted
database privileges. First version immutability is enforced by module API
design, controller surface area, and tests.

## Actions And Resource Types

Use TypeScript constants rather than database enums. This avoids migrations
when new template resources add audit coverage, while still keeping code and
tests type-friendly.

Initial actions:

```ts
export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RESET_PASSWORD: 'reset_password',
  REPLACE_ROLES: 'replace_roles',
  REPLACE_PERMISSIONS: 'replace_permissions',
} as const
```

Initial resource types:

```ts
export const AUDIT_RESOURCE_TYPES = {
  USER: 'user',
  ROLE: 'role',
  PERMISSION: 'permission',
  DICTIONARY_TYPE: 'dictionary_type',
  DICTIONARY_ITEM: 'dictionary_item',
  FILE: 'file',
} as const
```

The first version does not need separate `enable` or `disable` actions. Status
changes can be represented as `update` unless a later product need requires
more specific action names.

## Snapshot Rules

Record snapshots according to operation type:

- Create: store `after`.
- Update: store both `before` and `after`.
- Delete: store `before`.
- Replace membership operations: store before and after summaries, such as role
  codes or permission codes, rather than raw join-table rows.
- Reset password: store user identity metadata only; never store password,
  password hash, token, or session secret values.

Do not store raw request bodies. Services should pass explicit resource
snapshots or summaries to the audit service.

## Sanitization

All `before`, `after`, and `metadata` payloads must pass through the same
recursive sanitizer before persistence.

Sensitive keys should be matched case-insensitively. Initial blocked keys:

```text
password
passwordHash
token
accessToken
refreshToken
refreshTokenHash
cookie
authorization
secret
apiKey
checksum
objectKey
bucket
```

When a key matches, replace the value with:

```text
[REDACTED]
```

Rules:

- Sanitize nested objects and arrays recursively.
- Apply sanitization even when the caller passes mapper-produced response DTOs.
- Treat sanitization as the final safety boundary.
- Do not record uploaded file contents.
- File audit snapshots may include public metadata such as `displayName`,
  `mimeType`, `size`, `visibility`, `description`, and `uploadedById`, but not
  storage location or checksum fields.

## Business Coverage

Only successful write operations should create audit logs.

### Users

Record:

- `createUser`: `action=create`, `resourceType=user`, store `after`.
- `updateUser`: `action=update`, store `before` and `after`.
- `deleteUser`: `action=delete`, store `before`.
- `resetPassword`: `action=reset_password`, store sanitized user identity
  metadata only.
- `replaceRoles`: `action=replace_roles`, store before and after role code
  lists.

### Roles

Record:

- `createRole`: `action=create`, `resourceType=role`, store `after`.
- `updateRole`: `action=update`, store `before` and `after`.
- `deleteRole`: `action=delete`, store `before`.
- `replacePermissions`: `action=replace_permissions`, store before and after
  permission code lists.

### Permissions

If permissions remain system-defined and mostly read-only, first-version audit
coverage can skip permission mutations.

If the current permission admin page allows status, description, name, or sort
order changes, record those writes as `action=update`,
`resourceType=permission`.

### Dictionaries

Record:

- Dictionary type create, update, delete.
- Dictionary item create, update, delete.

Status changes should be represented as `update`.

### Files

Record:

- `createFile`: `action=create`, `resourceType=file`, store sanitized file
  metadata after persistence.
- `updateFile`: `action=update`, store `before` and `after`.
- `deleteFile`: `action=delete`, store `before`.

File delete is a soft delete in the current model. The audit snapshot should
capture the file metadata before deletion and may include deletion metadata, but
must not include storage object location or checksum fields.

## Request Metadata

The audit service should support optional request metadata:

```ts
interface AuditRequestMeta {
  ipAddress?: string
  userAgent?: string
}
```

The write API should also support an optional Prisma transaction client:

```ts
auditLogService.record(input, tx)
```

This allows business services to write the business mutation and audit row in
one transaction without nesting Prisma transactions. When no transaction client
is provided, the service can use the normal `PrismaService` client.

Controllers or a small helper can extract these values from the request and
pass them into service methods. Do not store headers wholesale.

If a call path does not have request metadata, the audit record should still be
created with `ipAddress` and `userAgent` omitted.

## Backend API

Expose audit logs as a read-only admin resource:

```text
GET /audit-logs
GET /audit-logs/:id
```

No public create, update, or delete endpoints should exist.

The backend module should follow the repository's standard resource layout:

```text
apps/api/src/audit-log/
  dto/
    audit-log.request.ts
    audit-log.response.ts
  audit-log.constants.ts
  audit-log.mapper.ts
  audit-log.service.ts
  audit-log.controller.ts
  audit-log.module.ts
```

### List Query

`AuditLogListQueryDto` should extend `ListQueryDto`.

Supported query fields:

- `page`
- `pageSize`
- `search`
- `sort`
- `actorUserId`
- `action`
- `resourceType`
- `resourceId`
- `dateFrom`
- `dateTo`

Rules:

- `page` is 1-based.
- Omitted `page` defaults to `1`.
- Omitted `pageSize` defaults to `20`.
- `pageSize` must follow the shared `ListQueryDto` constraints.
- Invalid query values return `400`.
- Default sort is `createdAt:desc`.
- Sort allowlist should include `createdAt`, `action`, `resourceType`,
  `actorEmail`, and `actorName`.
- `search` should initially match `actorEmail`, `actorName`, and `resourceId`.
- List and count must share the same Prisma `where` object.

### List Response

List responses must use the shared shape:

```ts
interface ListResponse<TItem> {
  items: TItem[]
  total: number
  page: number
  pageSize: number
}
```

List items should not include full JSON snapshots. They should include summary
fields only:

```ts
interface AuditLogListItemResponseDto {
  id: string
  actorUserId?: string
  actorEmail?: string
  actorName?: string
  action: string
  resourceType: string
  resourceId?: string
  ipAddress?: string
  createdAt: string
}
```

### Detail Response

`GET /audit-logs/:id` returns full sanitized details:

```ts
interface AuditLogResponseDto {
  id: string
  actorUserId?: string
  actorEmail?: string
  actorName?: string
  action: string
  resourceType: string
  resourceId?: string
  before?: unknown
  after?: unknown
  metadata?: unknown
  ipAddress?: string
  userAgent?: string
  createdAt: string
}
```

The mapper must convert `Date` to ISO strings and must not expose internal
fields beyond the designed response contract.

## Permissions

Add one permission code:

```text
audit_log.read
```

Seed it through the existing permission registry/upsert flow.

Registry metadata should use `module: 'audit_log'`, `action: 'read'`, and
`defaultRoles: []` because audit logs are sensitive. `super_admin` still has the
permission automatically, and administrators can explicitly assign it to other
roles.

Rules:

- Protect `GET /audit-logs` and `GET /audit-logs/:id` with
  `@Permissions('audit_log.read')`.
- Do not add role-name based authorization.
- Add the route/menu metadata with the same required permission.
- Do not create frontend-only permission branches that diverge from route
  metadata.

## Frontend

The admin page should follow
`docs/patterns/admin-crud-table-pattern-guide.md` while recognizing that audit
logs are read-only.

Add feature files:

```text
apps/admin/src/features/audit-logs/
  audit-logs.types.ts
  audit-logs.api.ts
  audit-logs.columns.tsx
  AuditLogsPage.tsx
  AuditLogsPage.test.tsx
```

Extend the shared API client in `apps/admin/src/lib/api.ts`, then expose
feature-local wrapper functions from `audit-logs.api.ts`. The page must import
feature-local wrappers, not the global API client directly.

Use shared table infrastructure:

- `useServerTableQuery`
- `DataTable`
- `DataTableToolbar`
- `DataTablePagination`

The page should be dense and operational:

- Search input.
- Resource type filter.
- Action filter.
- Date range filters.
- Table columns for time, actor, action, resource type, resource id, and IP.
- A read-only details drawer or dialog for `before`, `after`, and `metadata`
  JSON.
- Loading, empty, error, and retry states.

No create, edit, or delete controls should be shown.

Add route/menu metadata in `apps/admin/src/routes/admin-route-registry.tsx`, using
`audit_log.read` as `requiredPermissions`.

Add user-facing copy to `apps/admin/src/i18n/messages.ts`. The page should be
named `Audit Logs` / `审计日志`, not `Operation Logs`, because the feature
tracks business write operations rather than all user behavior.

## Error Handling

Business writes should be audited only after the business operation succeeds.

If the audit write fails, the request should fail. This keeps the system from
silently accepting sensitive administrative changes without traceability.

Implementation notes:

- Use the same Prisma transaction for normal database-only business writes and
  the matching audit insert.
- `AuditLogService.record()` should accept an optional transaction client so
  services with existing `$transaction` blocks can write through that client.
- For multi-step operations such as file upload, avoid storing raw request data
  and keep compensating behavior simple in the first version.
- If a file is saved to storage and the later audit write fails, the request may
  fail while the persisted file record remains. This can be revisited with a
  more complete outbox or compensation strategy if file audit failure becomes a
  practical issue.

## Testing Strategy

### Backend

Add focused tests for:

- `AuditLogService.record()` writes standard fields.
- `before`, `after`, and `metadata` are recursively sanitized.
- Sensitive fields are replaced with `[REDACTED]`.
- List defaults and query validation.
- Rejected invalid sort fields.
- Rejected invalid sort directions.
- Search and filter `where` mapping.
- `findMany` and `count` use the same `where`.
- Detail not found returns `404`.
- Mapper converts `Date` fields to ISO strings and returns only public fields.
- Unauthenticated access returns `401`.
- Users without `audit_log.read` receive `403`.
- Users with `audit_log.read` can access list and detail endpoints.
- At least one business flow, such as `updateUser` or `replaceRoles`, creates an
  audit log after success.
- Normal Prisma-only business flows write the mutation and audit log in the same
  transaction.

### Frontend

Add page tests for:

- Loading state.
- Empty state.
- Error state and retry.
- Returned rows rendering.
- Search, filters, and sort calling the feature-local API wrapper.
- Synthetic columns not using unsupported backend sort fields.
- No create, edit, or delete actions rendered.
- Details drawer/dialog displays formatted `before`, `after`, and `metadata`
  JSON.
- Route/menu visibility includes the page when `audit_log.read` is present.
- Route/menu visibility hides the page when `audit_log.read` is missing.
- Direct access without `audit_log.read` resolves to `/403` through the existing
  route guard behavior.

## Verification

Implementation should pass the same commands required by the CRUD pattern
guide:

```bash
pnpm --filter api exec jest --runInBand
pnpm --filter admin test
pnpm --filter api build
pnpm --filter admin build
pnpm --filter api lint
pnpm --filter admin lint
```

For UI verification, start the local app and smoke test:

- Login.
- Open the audit logs page.
- Confirm route permission behavior.
- Search.
- Filter by resource type and action.
- Sort supported columns.
- Open a detail view.
- Confirm JSON snapshots are readable and sanitized.

## Future Extensions

Possible later improvements:

- Security event logs for auth lifecycle events.
- Export and retention policies.
- Field-level diff rendering.
- PostgreSQL triggers for hard immutability.
- Outbox-based audit persistence for complex multi-resource operations.
- External log pipeline adapters, such as OpenTelemetry, ClickHouse, ELK, or a
  SIEM integration.
- Separate system actor support for scheduled jobs and maintenance scripts.
