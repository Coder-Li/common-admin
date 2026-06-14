# User Session Management Design

## Goal

Add an administrator-facing online session and login device management feature
for Common Admin.

The feature should let authorized administrators inspect all internal user
sessions, filter by session state, identify where a login came from, and force
another active session offline. It completes the existing authentication
lifecycle by giving operators a practical way to govern sessions after login.

## Context

Common Admin already has a server-side `UserSession` table and a production-ready
session lifecycle:

- Login creates a `UserSession`.
- Refresh tokens are opaque secrets stored in HttpOnly cookies.
- Refresh token hashes are stored on the session record.
- Refresh rotates the token and updates `lastUsedAt`.
- Logout and password changes revoke sessions.
- Every authenticated API request checks that the access token's `sid` still
  points to a valid, unrevoked session.

The missing piece is a management surface. Administrators currently cannot view
active or historical sessions, see login device details, or force another
session offline from the admin UI.

This design only targets internal Common Admin users and local session records.
It does not add third-party login fields. If OAuth, OIDC, SSO, or another
identity provider is introduced later, that work should decide how provider
identity maps into Common Admin users and sessions.

## Non-Goals

- Do not add third-party login or external identity provider fields.
- Do not add device fingerprinting, trusted devices, or device aliases.
- Do not add a `UserDevice` table.
- Do not add batch revocation.
- Do not add "force all sessions for this user offline".
- Do not add Redis, token blacklists, or another revocation store.
- Do not add automatic historical session cleanup.
- Do not revoke the administrator's current session from this page.

## Chosen Approach

Use the existing `UserSession` model as the source of truth and add a dedicated
management module around it.

The backend exposes:

```text
GET /user-sessions
POST /user-sessions/:id/revoke
```

The frontend adds one system management page with a table, filters, and a
single-session force-offline action. Session state is derived from existing
columns instead of stored separately.

## Session State

Session status is a derived value:

```text
active   revokedAt is null and expiresAt > now
expired  revokedAt is null and expiresAt <= now
revoked  revokedAt is not null
```

Only `active` sessions can be revoked. A session that is already expired or
revoked is immutable from this page.

## Backend API

### Backend Units

Add a focused backend feature module, for example `UserSessionModule`.

Suggested units:

- `UserSessionController` owns HTTP routes, permission decorators, and request
  user/session context.
- `UserSessionService` owns list filtering, status validation, revocation, and
  audit-log coordination.
- `user-session.mapper` owns response DTO mapping, derived status, current
  session marking, and device summary mapping.
- `user-session-device.ts` or an equivalent helper owns user-agent parsing.
- DTO files define list query, list item response, detail response fragments,
  and revoke response metadata if needed.

The existing `AuthService` remains responsible for login, refresh, logout, and
password-change session lifecycle operations. The new module only manages
already-created sessions from an administrator perspective.

### List User Sessions

Endpoint:

```text
GET /user-sessions
```

Required permission:

```text
user_session.read
```

Query parameters:

```text
page
pageSize
status=active|expired|revoked
search
userId
ipAddress
dateFrom
dateTo
sort=createdAt:desc
```

Rules:

- `search` matches username, email, first name, or last name.
- `dateFrom` and `dateTo` filter login time, using `createdAt`.
- `ipAddress` performs a simple contains match.
- Sorting should support at least `createdAt`, `lastUsedAt`, and `expiresAt`.
- Default sorting is newest login first.
- The response uses the existing `ListResponse` shape used by other admin
  resources.
- Query validation should follow existing list query conventions:
  - `page` must be an integer greater than or equal to 1.
  - `pageSize` must be an integer from 1 through 100.
  - `status` must be one of `active`, `expired`, or `revoked` when provided.
  - `dateFrom` and `dateTo` must be valid ISO-8601 timestamps when provided.
  - `dateFrom` must not be later than `dateTo` when both are provided.
  - `sort` must use an allowed session sort field and either `asc` or `desc`.
  - Invalid query parameters should fail with the standard validation error
    response.

Response item fields:

```text
id
user { id, username, email, firstName, lastName }
ipAddress
userAgent
deviceSummary { browser, os, deviceType }
createdAt
lastUsedAt
expiresAt
revokedAt
revokedReason
status
isCurrentSession
```

`isCurrentSession` is true when the listed session id matches the current access
token's `sid`.

### Revoke User Session

Endpoint:

```text
POST /user-sessions/:id/revoke
```

Required permission:

```text
user_session.revoke
```

Response:

```text
204 No Content
```

Rules:

- The target session must exist.
- The target session must be `active`.
- The target session must not be the current request session.
- Revocation writes `revokedAt = now` and `revokedReason = admin_revoked`.
- Revocation should be conditional, so repeated requests cannot silently
  overwrite an already changed session.
- A revoked session becomes invalid on the next authenticated API request
  because `JwtAccessStrategy` already checks `UserSession.revokedAt`.

Suggested error behavior:

- Missing session: `404`.
- Current session revocation attempt: `400`.
- Already revoked or expired session: `400`.
- Missing permission: existing permission guard behavior.

## Device Summary

The API should provide a lightweight `deviceSummary` derived from the stored
`userAgent`.

Initial fields:

```text
browser
os
deviceType
```

The implementation can use a small user-agent parser or a focused internal
helper. The raw `userAgent` remains available for exact diagnostics. This is
presentation support, not a security boundary.

If the user agent is missing or cannot be parsed, return conservative fallback
values such as `Unknown browser`, `Unknown OS`, and `Unknown device`.

## Permissions

Add registry permissions:

```text
user_session.read
user_session.revoke
```

Default role assignment:

- `admin` gets both permissions.
- Standard users get neither permission.

No Prisma schema migration is needed for v1 because the feature reuses the
existing `UserSession` table. Permission registry and seed behavior should be
updated through the existing permission seeding pattern.

The route and UI action should both respect these permissions. The backend
remains authoritative.

## Audit Logging

Force-offline operations should write an audit log.

Suggested values:

```text
action       revoke
resourceType user_session
resourceId   target session id
```

Add the values through the existing audit-log constants instead of using ad hoc
strings:

```text
AUDIT_ACTIONS.REVOKE = revoke
AUDIT_RESOURCE_TYPES.USER_SESSION = user_session
```

Metadata should include a concise snapshot:

```text
targetUserId
targetUsername
targetEmail
ipAddress
userAgent
createdAt
expiresAt
revokedReason
```

The actor and request metadata should use the existing audit log conventions.
The audit payload must not include refresh token hashes.

The session update and audit log insert should happen in the same transaction so
the audit trail cannot drift from the revocation state.

## Frontend Route

Add a system management route:

```text
/session-management
```

Route registry values:

```text
id       session-management
labelKey nav.sessionManagement
```

Navigation label:

```text
在线会话
```

Required route permission:

```text
user_session.read
```

The route belongs in the existing system management group alongside users,
roles, and permissions.

## Frontend Page

Use the existing admin page and data table patterns.

Primary table columns:

```text
用户
状态
登录时间
最近使用
过期时间
IP
设备
操作
```

Filters:

```text
状态
关键词搜索
时间范围
```

Status labels:

```text
active   在线
expired  已过期
revoked  已下线
```

Device display:

- Main text: a short summary such as `Chrome / macOS / Desktop`.
- Secondary text or title: raw user-agent or a truncated form.
- IP is shown in its own column.

Revoke action:

- Show "强制下线" only for `active` sessions that are not the current session.
- Show a disabled or non-action "当前会话" indicator for the current session.
- Hide the action when the current user lacks `user_session.revoke`.
- Confirm before revocation, naming the target user and IP/device when
  available.
- On success, show a toast and refresh the list.

The API client should continue to come from the OpenAPI generation flow. After
backend DTOs and controllers are added, regenerate the admin client rather than
hand-writing endpoint types.

Add i18n messages for the route label, table headers, status labels, filters,
confirmation copy, and success/error toasts.

## Data Flow

```text
Admin opens 在线会话
  -> frontend requests GET /user-sessions with filters
  -> backend queries UserSession with User relation
  -> backend derives status, deviceSummary, and isCurrentSession
  -> frontend renders table

Admin clicks 强制下线
  -> frontend confirms the action
  -> frontend calls POST /user-sessions/:id/revoke
  -> backend validates permission, status, and current-session guard
  -> backend revokes target session and writes audit log
  -> frontend refreshes table
  -> target session is rejected on its next authenticated API request
```

## Testing

Backend coverage:

- Lists sessions with derived `active`, `expired`, and `revoked` states.
- Filters by each state.
- Filters by `userId`.
- Filters by `ipAddress`.
- Filters by `dateFrom` and `dateTo`.
- Searches by username, email, first name, and last name.
- Sorts by the supported session sort fields and rejects unsupported sort
  fields or directions.
- Applies pagination and page-size bounds.
- Rejects invalid `status`, malformed dates, and invalid date ranges.
- Marks `isCurrentSession` correctly.
- Revokes another active session.
- Rejects current session revocation.
- Rejects repeated revocation.
- Rejects expired session revocation.
- Returns `404` for a missing session revoke target.
- Enforces missing-permission behavior for list and revoke endpoints.
- Writes an audit log for successful revocation.
- Persists revocation and audit log in one transaction.
- Proves a revoked session's access token is rejected on a subsequent request.

Frontend coverage:

- Shows the route and navigation item for users with `user_session.read`.
- Renders session status, user, IP, and device summary.
- Sends status and search filters correctly.
- Sends `ipAddress`, `dateFrom`, and `dateTo` filters correctly.
- Shows "强制下线" for active non-current sessions.
- Blocks or labels the current session as non-revocable.
- Hides revoke action without `user_session.revoke`.
- Refreshes the table and shows a success toast after revocation.
- Uses generated API client types for the new endpoints.

## Open Decisions

No open product decisions remain for v1. Third-party login, global provider
logout, device trust, and batch revocation are intentionally deferred.
