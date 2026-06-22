---
title: Session Management
description: User session listing, revocation, and audit behavior in Common Admin.
draft: false
---

Session management is the admin-facing view of active and historical user
sessions. It is separate from login and refresh, but it uses the same session
records that auth creates.

## What It Does

The session-management page and API let authorized admins:

- list user sessions;
- filter by status, user, IP address, and date;
- revoke an active session;
- review session metadata for accountability.

The backend uses `user_session.read` and `user_session.revoke`.

## Boundaries

Session management does not:

- create sessions directly;
- change login credentials;
- replace auth refresh behavior;
- expose refresh tokens;
- revoke the current session when the service forbids it.

Use [Auth And Sessions](./auth-and-sessions/) for the login, refresh, logout,
and password-change lifecycle.

## List Behavior

Session lists are paginated and can filter on:

- status;
- user id;
- IP address;
- created-at date range;
- search fields across user identity values.

The service derives each row's status from revoked time and expiry time. Keep the
list contract and generated frontend helpers aligned when adding or renaming
filters.

## Revocation Behavior

Revocation is a sensitive admin action. The service:

- blocks revoking the current session;
- blocks revoking a session that is already revoked or expired;
- records audit metadata;
- keeps request-id correlation;
- marks the target session with an admin-revoked reason.

Do not weaken these checks by moving them to the frontend.

## Frontend Pattern

The admin page should use generated API hooks or endpoint functions, show
loaded and error states, and gate the revoke action with the matching
permission.

Keep local UI state limited to filters, dialog state, and selected rows.

## Verification

Focused checks:

```bash
pnpm --filter api test -- user-session
pnpm --filter admin test -- SessionManagementPage
```

For contract changes:

```bash
pnpm api:check
pnpm --filter api test:e2e
pnpm build
```
