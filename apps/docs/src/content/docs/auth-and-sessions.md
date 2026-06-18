---
title: Auth And Sessions
description: Login, refresh, logout, token replay, and frontend API boundary rules.
draft: false
---

Common Admin uses a short-lived access token plus a refresh-token session cookie.
The auth lifecycle spans the NestJS auth module, refresh-token persistence,
cookie settings, the generated frontend API client boundary, and the admin auth
store.

## Lifecycle

Login:

```text
POST /auth/login
  -> validate username/email and password
  -> create user session row
  -> issue access token
  -> set refresh cookie
  -> return access token and user profile
```

Refresh:

```text
POST /auth/refresh
  -> read refresh cookie
  -> validate session, expiry, revocation, and token secret
  -> rotate refresh token
  -> issue a new access token
  -> return access token and user profile
```

Logout:

```text
POST /auth/logout
  -> clear refresh cookie
  -> revoke the current session when an access token or refresh token identifies it
```

Password change:

```text
POST /auth/change-password
  -> verify current password
  -> update password hash
  -> revoke active sessions for the user
  -> clear refresh cookie
```

## Frontend Boundary

Frontend API requests should continue to use generated endpoint functions and
hooks. The generated client calls the shared API mutator, which owns:

- API base URL handling.
- Query parameter serialization.
- `withCredentials` cookie behavior.
- `Authorization: Bearer <access token>` injection.
- Common API error conversion.
- 401 refresh and replay behavior.

Do not create handwritten one-off API clients for generated endpoints. If an
endpoint needs a different generated shape, fix backend Swagger metadata or
Orval configuration and regenerate.

## Refresh Coordinator

The refresh coordinator prevents multiple simultaneous 401 responses from
starting multiple refresh requests. While a refresh is in flight, later callers
reuse the same promise.

If refresh succeeds:

- the auth store receives the new session;
- the original failed request is replayed once with the new access token.

If refresh fails:

- the auth store becomes anonymous;
- the query cache is cleared;
- the original caller receives the API error.

## 401 Replay Rules

Replay is intentionally narrow:

- The original request is retried only after a successful refresh.
- Login, refresh, and logout requests do not trigger refresh replay.
- A failed replay is returned as an error; it should not recurse forever.
- Backend guards remain the security boundary. Frontend refresh logic is only a
  session-continuity feature.

When changing auth, test the full lifecycle rather than only the edited method.

## Cookie Settings

Refresh-cookie behavior is controlled by deployment configuration:

- cookie name;
- secure flag;
- same-site mode;
- optional cookie domain;
- refresh-token lifetime.

Do not store refresh tokens in local storage. Do not expose access tokens or
refresh tokens in logs, audit payloads, docs, screenshots, or AI prompts.

## Verification

Useful focused checks:

```bash
pnpm --filter api test -- auth
pnpm --filter admin test -- api-refresh-coordinator
pnpm --filter admin test -- api-mutator
```

When auth behavior changes across backend and frontend boundaries, also run:

```bash
pnpm api:check
pnpm test
pnpm --filter api test:e2e
pnpm build
```
