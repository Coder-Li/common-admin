# Auth Session Lifecycle Design

## Goal

Upgrade Common Admin from access-token-only authentication to a production-ready
session lifecycle that remains simple enough for a reusable starter template.

The new system should support silent session restoration, short-lived access
tokens, refresh token rotation, server-side logout, password-change revocation,
administrator password reset, and clear frontend behavior when a session expires.

## Context

The current project signs an access token after login and stores the session in
the admin frontend. This is enough for local development and early template
work, but real admin systems usually need stronger session governance:

- Users should not be forced back to the login page every time a short access
  token expires.
- Logout should invalidate server-side state, not only clear frontend storage.
- Password changes and administrator resets should force old sessions to stop
  working.
- Refresh credentials should not be readable by frontend JavaScript.
- The API should be able to reject requests from revoked sessions even while an
  access token has not naturally expired.

The RBAC system already keeps backend authorization as the security boundary.
This design keeps that rule: frontend permissions are for menus and user
experience, while backend guards decide access.

## Chosen Approach

Use two token layers plus a server-side session record:

```text
access token   short-lived bearer token, stored only in frontend memory
refresh token  longer-lived random secret, stored in an HttpOnly cookie
UserSession    database record that controls expiry, revocation, and rotation
```

Principles:

- Access tokens should be short-lived, for example 15 minutes.
- Refresh tokens should be opaque random strings, not JWTs.
- The raw refresh token is written only to an HttpOnly cookie.
- The database stores only a hash of the refresh token.
- Every refresh rotates the refresh token.
- Every authenticated API request verifies that the access token's session is
  still valid.
- The frontend does not persist access tokens in `localStorage`.
- PostgreSQL is the source of truth for session state in v1. Redis can be added
  later as an optimization, not as a required dependency for the first version.

## Data Model

Add a `UserSession` model.

```prisma
model UserSession {
  id               String    @id @default(uuid())
  userId           String
  refreshTokenHash String    @db.VarChar(255)
  userAgent        String?   @db.VarChar(500)
  ipAddress        String?   @db.VarChar(80)
  expiresAt        DateTime
  lastUsedAt       DateTime?
  revokedAt        DateTime?
  revokedReason    String?   @db.VarChar(120)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@index([revokedAt])
}
```

Add the reverse relation on `User`:

```prisma
sessions UserSession[]
```

Rules:

- `refreshTokenHash` stores a one-way hash of the current refresh token.
- `expiresAt` is the absolute refresh/session expiry time.
- `revokedAt` marks a session as no longer valid.
- `revokedReason` should use stable string values such as `logout`,
  `password_changed`, `admin_reset_password`, `admin_revoked`, or
  `token_reuse_detected`.
- `lastUsedAt` updates when refresh succeeds.
- `ipAddress` and `userAgent` are recorded for diagnostics and future device
  display, but v1 does not use them for risk checks.
- Deleting a user cascades to their sessions.

Do not add a session UI in v1. The table is still useful immediately because it
enables logout, token rotation, password revocation, and future audit work.

## Token Shape

Access token payload:

```ts
{
  sub: string
  sid: string
  email: string
  username: string
}
```

Rules:

- `sub` is the user id.
- `sid` is the `UserSession.id`.
- Do not put role or permission lists in the access token.
- Do not rely on access token contents for authorization beyond identifying the
  user and session.
- Backend permission guards continue resolving active permissions from current
  database state.

Refresh token format:

```text
<sessionId>.<random 32-64 byte secret encoded as URL-safe text>
```

Rules:

- Use cryptographically secure random bytes.
- Treat the session id portion as a lookup id, not as a credential.
- Store only a hash of the random secret in the database.
- Set the raw token as an HttpOnly cookie.
- Do not expose the refresh token in JSON responses.
- Compare refresh token secrets with a constant-time comparison when practical.

## Cookie Policy

Use one refresh cookie owned by the API.

Recommended defaults:

```text
name       common_admin_refresh
httpOnly   true
secure     true in production
sameSite   lax by default
path       /api/auth
domain     unset by default
maxAge     matches refresh/session lifetime
```

Development may allow `secure = false` for local HTTP.

If the admin frontend and API are deployed on different sites and cross-site
cookies are required, production configuration must explicitly opt into
`sameSite = none` and `secure = true`. Keep the default local template simpler
and safer with same-site or same-origin assumptions.

The API should clear the same cookie name and path during logout and refresh
failure handling. If `domain`, `sameSite`, or `secure` are configured
explicitly, clear-cookie must use the same effective cookie options as
set-cookie so browsers actually remove the cookie.

## CORS And Cookie Credentials

Cookie-backed refresh only works when both the browser client and API explicitly
allow credentials.

Backend CORS requirements:

- Enable `credentials: true` in Nest CORS when refresh cookies are enabled.
- Use configured, non-wildcard origins from `ALLOWED_ORIGINS`.
- Do not combine credentialed CORS with `Access-Control-Allow-Origin: *`.
- Include any CSRF header name in `allowedHeaders` if a header-based CSRF token
  is introduced later.

Frontend request requirements:

- Configure Axios with `withCredentials: true` for auth-cookie endpoints.
- Login, refresh, and logout must send credentials so the browser can store,
  send, and clear the refresh cookie.
- Normal authenticated API requests may also use the same credentialed Axios
  instance for consistency, while access authorization still uses the bearer
  access token.

Cross-origin deployment requirements:

- If the admin app and API are on different origins, confirm that
  `VITE_API_BASE_URL`, `ALLOWED_ORIGINS`, cookie `sameSite`, cookie `secure`, and
  CORS credentials are configured together.
- A cross-site deployment that needs cookies must use `sameSite = none` and
  `secure = true`.
- Local same-origin or same-site deployment should keep the safer default
  `sameSite = lax`.

## CSRF And Origin Policy

Refresh cookies are sent automatically by browsers, so cookie-sensitive
endpoints need an origin policy.

For v1, validate the `Origin` header on these endpoints:

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/change-password
```

Rules:

- Accept requests whose `Origin` matches configured admin origins.
- Reject unexpected browser origins with `403`.
- Treat missing `Origin` on non-browser clients conservatively; allow only if
  the request does not include the refresh cookie or if the environment
  explicitly permits same-origin/proxy traffic without the header.
- Require strict origin validation for any production deployment using
  `sameSite = none`.
- Keep bearer-token authorization as the API security boundary, but do not rely
  on CORS alone to prevent cross-site refresh or logout side effects.

If the project later adds a formal CSRF token, use a double-submit or
server-issued token pattern and document how it is bootstrapped. Do not make that
a v1 dependency unless cross-site cookie deployments become the default.

## Environment Configuration

Extend backend environment validation with:

```text
JWT_ACCESS_TOKEN_SECRET=...
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS=14
AUTH_REFRESH_COOKIE_NAME=common_admin_refresh
AUTH_REFRESH_COOKIE_SECURE=false
AUTH_REFRESH_COOKIE_SAME_SITE=lax
AUTH_REFRESH_COOKIE_DOMAIN=
```

Rules:

- `JWT_ACCESS_TOKEN_SECRET` must remain required and non-default in production.
- `JWT_ACCESS_TOKEN_EXPIRES_IN` stays short, commonly 15 minutes.
- Refresh lifetime should default to 14 days for the starter template.
- Cookie security should default to local development values but fail or require
  explicit configuration for unsafe production combinations.
- Production should reject `sameSite = none` unless `secure = true`.
- Production should reject credentialed CORS with wildcard origins.
- `.env.example` files should document the values.

## Backend Authentication Flow

### Login

Endpoint:

```text
POST /auth/login
```

Behavior:

```text
1. Validate username/email and password.
2. Resolve current user profile, roles, and permissions for the response.
3. Create a UserSession record.
4. Generate a refresh token and store its hash on the session.
5. Sign an access token containing sub and sid.
6. Set the refresh cookie.
7. Return accessToken and user profile.
```

Response:

```ts
{
  accessToken: string
  user: UserProfile
}
```

The response remains compatible with the existing frontend shape except that the
refresh token is delivered by cookie instead of JSON.

### Refresh

Endpoint:

```text
POST /auth/refresh
```

Behavior:

```text
1. Read the refresh token from the HttpOnly cookie.
2. Parse the session id and random secret.
3. Find the UserSession by id.
4. Compare the incoming secret with refreshTokenHash.
5. Reject missing, expired, revoked, or mismatched sessions.
6. Verify the user still exists.
7. Generate a new refresh token secret for the same session id.
8. Replace refreshTokenHash with the new secret hash.
9. Update lastUsedAt.
10. Sign a new access token for the same session id.
11. Set the new refresh cookie.
12. Return accessToken and user profile.
```

Refresh token rotation means the previous refresh token stops working after a
successful refresh. If an old token is reused and the backend can confidently
identify the session, revoke that session with `token_reuse_detected`. Do not
make v1 overly complex just to detect every possible replay shape.

Concurrent refresh requests may cause one request to fail because the token has
already rotated. The frontend should avoid this by sharing a single in-flight
refresh promise.

Rotation must be atomic. Implement refresh with a transaction or conditional
update that only replaces `refreshTokenHash` when all of these still match:

```text
id = parsed session id
userId = session user id
refreshTokenHash = hash of incoming secret
revokedAt is null
expiresAt > now
```

If the conditional update affects zero rows after the initial validation, return
`401` and clear the refresh cookie. Do not mark this ordinary race as
`token_reuse_detected` by default; near-simultaneous browser requests should not
revoke an otherwise valid session. Reserve `token_reuse_detected` for cases
where the backend can distinguish suspicious reuse from a normal rotation race.

### Logout

Endpoint:

```text
POST /auth/logout
```

Behavior:

```text
1. Prefer the authenticated access token's sid when it is valid.
2. If the access token is missing or expired, fall back to the refresh cookie
   when it can identify a valid session.
3. Revoke the resolved UserSession.
4. Clear the refresh cookie.
5. Return an empty success response.
```

If the cookie is already missing or the session was already revoked, logout may
still clear the cookie and return success. The operation should be idempotent
from the user's point of view.

### Change Password

Endpoint:

```text
POST /auth/change-password
```

Request:

```ts
{
  currentPassword: string
  newPassword: string
}
```

Behavior:

```text
1. Require authentication.
2. Verify the current password.
3. Validate the new password with the same minimum policy used for user create.
4. Update passwordHash.
5. Revoke all sessions for the current user with password_changed.
6. Clear the refresh cookie.
7. Return success.
```

After a successful password change, the frontend should clear local auth state
and redirect to `/login`. This includes the current session. The behavior is
simple, explicit, and safe.

### Administrator Password Reset

Endpoint:

```text
POST /users/:id/reset-password
```

Request:

```ts
{
  newPassword: string
}
```

Behavior:

```text
1. Require the appropriate user management permission.
2. Validate the new password.
3. Update the target user's passwordHash.
4. Revoke all sessions for the target user with admin_reset_password.
5. Return the public user response or an empty success response.
```

This endpoint should be separate from `PATCH /users/:id`. Password changes are a
sensitive lifecycle action and should not be hidden inside generic profile
updates.

If an administrator resets their own password, the frontend should clear local
auth state and redirect to `/login`.

## Request Authentication

Update JWT access validation so every protected request verifies both the token
and the session.

Validation behavior:

```text
1. Verify access token signature and expiration.
2. Require payload.sub.
3. Require payload.sid.
4. Query the session and user with a minimal joined/select lookup.
5. Verify the session belongs to the user.
6. Verify the session is not expired.
7. Verify the session is not revoked.
8. Return a normalized request user built from current database fields.
```

Failure modes:

- Missing or invalid token -> `401`.
- Missing user -> `401`.
- Missing, expired, or revoked session -> `401`.
- Missing permissions after authentication -> `403` from the permissions guard.

The permissions guard remains responsible for authorization. The JWT strategy is
responsible for authentication and session validity.

Do not return stale mutable identity fields from the access token when the
database has fresher values. If `email` or `username` remains in the token for
debugging or client convenience, request authentication should still return the
current user fields loaded from the database.

The hot-path session lookup should avoid unnecessary double queries. Prefer a
single query that selects only the required columns:

```text
session.id
session.userId
session.expiresAt
session.revokedAt
user.id
user.email
user.username
```

The existing primary key on `UserSession.id` covers lookup by `sid`. Add or keep
indexes for cleanup and user-level revocation:

```text
@@index([userId])
@@index([expiresAt])
@@index([revokedAt])
```

Tests should include a mismatched `sub` and `sid` case to prove one user's token
cannot authenticate against another user's session.

## Frontend Session State

Replace the current persisted token session with an explicit auth status:

```ts
type AuthStatus = 'checking' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  accessToken: string | null
  user: UserProfile | null
  roles: UserRoleSummary[]
  permissions: string[]
}
```

Rules:

- Do not persist `accessToken` to `localStorage`.
- Do not store refresh tokens in frontend-accessible storage.
- Keep `accessToken`, `user`, `roles`, and `permissions` in memory.
- Frontend route guards should handle `checking` without flashing the login
  page.
- `isAuthenticated` can remain as a derived convenience value if useful, but the
  source of truth should be `status`.

Startup flow:

```text
1. App starts with status = checking.
2. Call POST /auth/refresh.
3. If refresh succeeds, store accessToken and user in memory.
4. If refresh fails, set status = anonymous.
5. Render the resolved route after auth state is known.
```

Login flow:

```text
1. Submit credentials to POST /auth/login.
2. API sets refresh cookie.
3. Frontend stores accessToken and user in memory.
4. Redirect to the first visible admin route.
```

Logout flow:

```text
1. Call POST /auth/logout.
2. Clear local auth state and React Query cache.
3. Navigate to /login.
```

If the logout request fails, the frontend should still clear local auth state
and navigate to `/login`. The user asked to leave the admin session, so the UI
should not trap them in the shell because of a network error.

## API Client Refresh Behavior

The API client should handle expired access tokens centrally.

Behavior:

```text
1. Send normal authenticated requests with the in-memory access token.
2. If a request receives 401, call POST /auth/refresh once.
3. Share the same refresh promise across concurrent 401 responses.
4. If refresh succeeds, retry the original request once.
5. If refresh fails, reset auth state, clear query cache, and navigate to /login.
```

Rules:

- Never retry a request more than once after refresh.
- Do not try to refresh when the failing request was `/auth/login`,
  `/auth/refresh`, or `/auth/logout`.
- Use Axios `withCredentials` or equivalent so refresh cookies can be set, sent,
  and cleared.
- Keep auth retry logic in the shared API client instead of duplicating it in
  feature APIs.

## Route Guard Behavior

Route resolution should distinguish unknown, anonymous, checking, and forbidden
states.

Rules:

- During `checking`, protected routes should show a lightweight loading state or
  defer routing until refresh finishes.
- Anonymous users visiting protected routes go to `/login`.
- Authenticated users visiting `/login` go to the first visible route.
- Authenticated users without a route permission go to `/403`.
- If refresh fails during an authenticated page, clear state and go to `/login`.

This avoids the current access-token-only problem where a reload depends on
frontend storage instead of server-confirmed session state.

## Password Reset Scope

In scope for v1:

- Logged-in user changes their own password.
- Administrator resets another user's password.
- All sessions for the affected user are revoked after either operation.

Out of scope for v1:

- Forgot-password email flow.
- Password reset token table.
- Email delivery provider configuration.
- Anti-enumeration responses for public reset requests.
- Login failure rate limiting.

If forgot-password is added later, introduce a separate `PasswordResetToken`
model that stores only token hashes and short expirations. Do not reuse
`UserSession` for public password reset tokens.

## Security Notes

- The refresh token is the long-lived credential and must never be readable by
  frontend JavaScript.
- The access token is short-lived and stored only in memory.
- Server-side session validation makes logout and password revocation effective
  immediately for protected API requests.
- Refresh token rotation reduces the useful lifetime of a stolen refresh token.
- Backend permission checks remain the final security boundary.
- API responses must not expose password hashes, refresh token hashes, cookie
  values, or raw session secrets.
- User agent and IP metadata are diagnostic fields in v1 and should not be
  treated as reliable identity proof.

## Testing

Backend tests should cover:

- Login creates a `UserSession`, sets a refresh cookie, and returns an access
  token plus user profile.
- Login response does not include a refresh token.
- Login and refresh set the expected HttpOnly refresh cookie attributes.
- Refresh succeeds with a valid cookie, rotates the refresh token, updates the
  session hash, and returns a new access token.
- Reusing an old refresh token after rotation fails.
- A refresh rotation race or failed conditional update returns `401` without
  revoking the session as suspicious reuse.
- Logout revokes the current session and clears the refresh cookie.
- Logout can clear the cookie when only the refresh cookie identifies the
  session.
- Access token validation fails after logout.
- Access token validation fails when the session is revoked or expired.
- Access token validation fails when `sub` and `sid` do not belong together.
- Change password rejects an incorrect current password.
- Change password updates the hash, revokes all user sessions, and clears the
  refresh cookie.
- Administrator reset password updates the target user's hash and revokes the
  target user's sessions.
- Permission guards still return `403` for authenticated users without the
  required permission.
- Credentialed CORS is configured when refresh cookies are enabled.
- Cookie-sensitive auth endpoints reject unexpected browser origins.

Frontend tests should cover:

- Auth store starts in `checking` and can become `authenticated` or `anonymous`.
- Login stores access token and user only in memory.
- Login, refresh, and logout use credentialed requests.
- Session storage no longer persists access tokens.
- App startup calls refresh and restores authenticated state on success.
- App startup becomes anonymous on refresh failure.
- API client retries one failed authenticated request after successful refresh.
- Concurrent 401 responses share one refresh request.
- API client does not try refresh/retry behavior for login, refresh, or logout
  failures.
- Refresh failure clears auth state, clears query cache, and navigates to
  `/login`.
- Logout clears local state even if the logout request fails.
- Password change success clears state and navigates to `/login`.
- Administrator self-reset clears local state and navigates to `/login`.

Manual/browser smoke checks should verify:

- Reloading an authenticated admin page restores the session without a visible
  login flash.
- Letting the access token expire still allows work to continue after silent
  refresh.
- Logging out prevents the previous access token from calling protected APIs.
- Changing password forces re-login.

## Rollout Plan

Recommended implementation order:

```text
1. Add UserSession model, migration, config, and token helpers.
2. Add credentialed CORS and auth endpoint origin validation.
3. Update login to create sessions and set refresh cookies.
4. Add refresh and logout endpoints with atomic refresh rotation.
5. Update JWT validation to require an active session.
6. Update backend tests for login, refresh, logout, and revoked sessions.
7. Refactor frontend auth store away from persisted access tokens.
8. Add API client refresh/retry behavior with credentialed requests.
9. Add startup refresh behavior and route checking state.
10. Add change-password endpoint and frontend flow.
11. Add administrator reset-password endpoint and user management flow.
```

Steps 1-9 are the core session lifecycle. Steps 10-11 complete the first password
lifecycle slice.

## Future Enhancements

- Session/device list UI.
- Administrator session revocation per user or per device.
- BroadcastChannel or storage-event based cross-tab logout sync.
- Forgot-password email reset flow.
- Login attempt throttling and account lockout policy.
- Redis caching for hot session validation paths.
- Audit log events for login, refresh reuse detection, logout, password change,
  and administrator password reset.
