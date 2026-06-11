# Error Handling, Logging, And Observability Design

## Goal

Give Common Admin one consistent runtime error and logging model across the
NestJS API, React admin app, and local deployment tooling.

This work is separate from audit logs. Audit logs answer "who changed what";
runtime logs answer "what happened while the program was running". The two
should be connected by `requestId`, but they should not share the same storage
or lifecycle.

The target state is:

- API errors return one stable response envelope.
- The frontend consumes one normalized `ApiError` shape instead of raw Axios or
  NestJS errors.
- Every HTTP response includes `x-request-id`.
- Runtime logs are structured JSON in production and readable pretty logs in
  local development.
- Request logs, exception logs, and application logs include enough fields to
  debug failures without leaking secrets.
- Audit log metadata can include the same `requestId` as the corresponding
  runtime logs.
- A local optional observability stack can verify the logging behavior with
  Loki, Grafana, and Grafana Alloy.

## Context

The project already has a database-backed audit log module and an admin page
for browsing those records. That module is designed for business traceability:
actor, action, resource type, resource id, request metadata, and before/after
snapshots.

Runtime error handling and logging are currently less formal:

- `apps/api/src/main.ts` configures validation pipes and Swagger, but there is
  no global exception filter or request id middleware.
- The API relies mostly on NestJS default logging and a bootstrap
  `console.error`.
- Backend services throw standard NestJS exceptions and some Prisma errors are
  converted manually in feature services.
- `apps/admin/src/app/api-mutator.ts` owns Axios configuration, access token
  injection, cookie-backed refresh, 401 replay, and query-cache clearing after
  failed refresh.
- Admin pages often read `error.message` directly for toasts and table error
  states.

The API contract generation design intentionally left normalized errors for
this topic. This design fills that gap.

## Chosen Approach

Use Pino through NestJS integration for structured runtime logs, add a global
exception filter for stable API error responses, normalize all frontend request
failures into `ApiError`, and add an optional Docker Compose observability
overlay with Loki, Grafana, and Grafana Alloy.

Principles:

- The application writes logs to stdout/stderr only.
- Docker, Kubernetes, cloud platforms, or local Alloy collect those logs.
- Production logs are JSON.
- Local development logs are human-readable.
- Error responses are safe for users and stable for clients.
- Exception logs retain internal debugging details such as stack traces.
- Business audit logs remain database records and are not used as runtime logs.
- The observability stack is optional for local verification and small
  deployments; production remains platform-neutral.

## Non-Goals

The first version should not include:

- OpenTelemetry tracing.
- Metrics collection, Prometheus, or alert rules.
- A mandatory production dependency on Loki or Grafana.
- A runtime log browsing page inside the admin application.
- Database persistence for runtime logs.
- Full rewrite of every service to use custom exceptions immediately.
- Client-side error reporting to Sentry or another SaaS.
- A generic distributed tracing model across future services.

## Target File Structure

Add or migrate toward this structure:

```text
apps/api/src/common/errors/
  app-exception.ts
  error-codes.ts
  error-response.dto.ts
  exception-filter.ts
  exception-mapper.ts
apps/api/src/common/logging/
  logging.module.ts
  request-id.middleware.ts
  request-context.ts
  log-redaction.ts
apps/admin/src/app/api-error.ts
apps/admin/src/app/api-error-messages.ts
apps/admin/src/app/api-mutator.ts
docker-compose.observability.yml
deploy/observability/
  loki/config.yml
  alloy/config.alloy
  grafana/provisioning/datasources/loki.yml
  grafana/provisioning/dashboards/common-admin.yml
  grafana/dashboards/api-logs.json
docs/patterns/admin-error-logging-observability-guide.md
```

Responsibilities:

- `app-exception.ts` defines the project-level exception type for new business
  errors.
- `error-codes.ts` contains stable machine-readable error codes.
- `error-response.dto.ts` documents the public API error envelope.
- `exception-filter.ts` converts thrown errors into the public envelope and
  logs exceptions.
- `exception-mapper.ts` maps NestJS, validation, Prisma, and unknown errors to
  the project error model.
- `logging.module.ts` configures Pino and environment-specific formatting.
- `request-id.middleware.ts` reads or creates request ids and writes the
  response header.
- `request-context.ts` exposes request metadata needed by logging and audit
  helpers.
- `log-redaction.ts` centralizes fields that must never be logged.
- `api-error.ts` defines the frontend normalized error type and guards.
- `api-error-messages.ts` maps error codes to user-facing i18n-friendly
  messages.
- `api-mutator.ts` remains the single frontend HTTP behavior boundary.
- `deploy/observability` contains the local log collection and dashboard
  configuration.

## API Error Envelope

All API errors should return this envelope:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "statusCode": 400,
  "requestId": "req_01HZ0000000000000000000000",
  "path": "/api/users",
  "timestamp": "2026-06-11T10:20:30.000Z",
  "details": {
    "fields": [
      {
        "field": "email",
        "message": "email must be an email"
      }
    ]
  }
}
```

Fields:

- `code` is stable and machine-readable. Frontend branching should use this
  field instead of parsing messages.
- `message` is safe for users, but the frontend may replace it with localized
  copy.
- `statusCode` mirrors the HTTP status.
- `requestId` connects the response to runtime logs and audit metadata.
- `path` is the request path.
- `timestamp` is generated by the API at response time.
- `details` is optional structured context. It must not contain secrets.

The error envelope should be represented as a response DTO and referenced in
Swagger responses through a shared decorator or controller-level convention.
Endpoints that already document custom error responses may keep those
decorators, but they should use the same `ErrorResponseDto`. The generated
frontend types should include the error response model, but Orval consumers
should still rely on `ApiError` from the mutator as the runtime type.

## Error Codes

Start with a small base code set:

```text
BAD_REQUEST
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
PAYLOAD_TOO_LARGE
UNSUPPORTED_MEDIA_TYPE
INTERNAL_SERVER_ERROR
SERVICE_UNAVAILABLE
```

Business modules may add more specific codes when the frontend can use them:

```text
USER_EMAIL_ALREADY_EXISTS
ROLE_CODE_ALREADY_EXISTS
DICTIONARY_CODE_ALREADY_EXISTS
FILE_UPLOAD_REQUIRED
FILE_NOT_FOUND
```

Do not create a unique error code for every possible message. Add a module
code only when it improves user feedback, form mapping, or automated handling.

## Backend Exception Mapping

The global exception filter should map thrown values as follows:

| Source | Response code | HTTP status | Notes |
| --- | --- | --- | --- |
| `AppException` | Exception `code` | Exception status | Preferred for new business errors |
| class-validator / `ValidationPipe` | `VALIDATION_ERROR` | 400 | Include `details.fields` |
| `BadRequestException` | `BAD_REQUEST` | 400 | Unless it carries a known app code |
| `UnauthorizedException` | `UNAUTHORIZED` | 401 | Keep refresh flow compatible |
| `ForbiddenException` | `FORBIDDEN` | 403 | For permission failures |
| `NotFoundException` | `NOT_FOUND` | 404 | Module code may override |
| `ThrottlerException` | `RATE_LIMITED` | 429 | Include retry detail when available |
| Multer file size limit | `PAYLOAD_TOO_LARGE` | 413 | Include upload limit when safe |
| Multer unexpected field / file validation | `BAD_REQUEST` | 400 | Module code may override |
| Unsupported upload MIME type | `UNSUPPORTED_MEDIA_TYPE` | 415 | Use for explicit MIME validation failures |
| Prisma `P2002` | `CONFLICT` | 409 | Module code may override in services |
| Prisma `P2025` | `NOT_FOUND` | 404 | For missing records |
| Unknown errors | `INTERNAL_SERVER_ERROR` | 500 | Do not expose stack or raw message |

`AppException` should look conceptually like:

```ts
throw new AppException({
  code: 'USER_EMAIL_ALREADY_EXISTS',
  message: 'User email already exists',
  statusCode: 409,
  details: { field: 'email' },
})
```

Existing feature services do not need a large immediate rewrite. New code
should prefer `AppException`, while existing Prisma error conversions can be
migrated when touched.

## Request Id And Context

Every request should have exactly one request id.

Rules:

- Read an incoming `x-request-id` header when present and valid.
- Generate a new id when the header is missing or invalid.
- Write the selected id to the `x-request-id` response header.
- Attach the id to Pino request context.
- Make the id available to audit helpers so audit log metadata can include it.

An incoming id is valid only when it is a single string between 8 and 128
characters and matches this character set:

```text
[A-Za-z0-9._:-]
```

Invalid incoming values should be ignored and replaced, not returned as an
error. Generated ids should satisfy the same rule.

The generated id should be opaque, URL-safe, and low collision risk. A `req_`
prefix is useful for scanning logs, but frontend code must not depend on the
prefix.

Request context should expose:

```text
requestId
method
path
userId
ip
userAgent
```

Authentication may run after request id middleware. Therefore unauthenticated
request logs can omit `userId`; authenticated controllers and services should
still be able to include it in audit metadata through existing user payloads.

CORS must allow browser clients to send and read request ids:

- Add `x-request-id` to allowed request headers.
- Add `x-request-id` to exposed response headers.

Health routes, Swagger UI routes, unknown routes, and CORS preflight requests
should all receive a request id header when they pass through the Nest
application. Unknown API routes should use the same error envelope as other
404 responses. CORS preflight responses do not need the JSON error envelope
because they are not API error responses.

## Runtime Logging

Use Pino for runtime logs.

Log categories:

- Request logs: one automatic completed-request log per HTTP request.
- Exception logs: emitted by the global exception filter for exceptions that
  are unexpected or operationally important.
- Application logs: startup, shutdown, configuration, background jobs, and
  external dependency state.

Production request log example:

```json
{
  "level": "info",
  "time": "2026-06-11T10:20:30.000Z",
  "service": "api",
  "env": "production",
  "requestId": "req_01HZ0000000000000000000000",
  "method": "POST",
  "path": "/api/users",
  "statusCode": 201,
  "durationMs": 42,
  "userId": "user_01HZ0000000000000000000000",
  "ip": "127.0.0.1",
  "msg": "request completed"
}
```

Exception log example:

```json
{
  "level": "error",
  "time": "2026-06-11T10:20:30.000Z",
  "service": "api",
  "env": "production",
  "requestId": "req_01HZ0000000000000000000000",
  "code": "INTERNAL_SERVER_ERROR",
  "method": "GET",
  "path": "/api/files",
  "userId": "user_01HZ0000000000000000000000",
  "err": {
    "type": "Error",
    "message": "Database connection failed",
    "stack": "..."
  },
  "msg": "Unhandled exception"
}
```

Application log example:

```json
{
  "level": "info",
  "time": "2026-06-11T10:20:30.000Z",
  "service": "api",
  "env": "production",
  "msg": "API server started",
  "port": 3000
}
```

Default log level policy:

- Local development: `LOG_LEVEL=debug`.
- Test: `LOG_LEVEL=silent` or test-specific override unless a test asserts
  logs.
- Production: `LOG_LEVEL=info`.

Request severity policy:

- `2xx` and `3xx`: `info`.
- `4xx`: `warn` when useful, otherwise rely on request log and avoid duplicate
  exception noise.
- `5xx`: `error`.

Centralized exception logging should follow this rule:

- Unknown exceptions and all `5xx` responses are logged by the exception filter
  with `err`.
- Expected `4xx` responses such as validation failures, unauthorized requests,
  forbidden actions, not found records, and duplicate records are not logged as
  exception logs by default; the request log is enough.
- `4xx` responses may be logged by the exception filter only when they indicate
  operational abuse or infrastructure pressure, such as rate limiting, payload
  too large, repeated malformed uploads, or an explicit `AppException` option
  that asks for logging.

Business code should not log every expected branch. It should log only when it
has useful context that the request and exception logs do not already contain.

## Redaction

Runtime logs must never include:

```text
password
oldPassword
newPassword
accessToken
refreshToken
authorization
cookie
set-cookie
```

Pino redaction should cover request headers and common object keys. The audit
log sanitizer already handles business snapshots; the logging redaction list
should share the same sensitive field vocabulary where possible.

Unknown exceptions should log the internal stack but return a generic response
message. Validation and business errors may return safe messages.

## Audit Log Integration

Audit logs remain database-backed and append-oriented. Runtime logs remain
stdout/stderr.

Integration points:

- `getAuditRequestMeta` should continue to return transport fields such as
  `ipAddress` and `userAgent`.
- Audit log `metadata.requestId` is the single storage location for the request
  id.
- Services that already pass audit metadata should merge the request id into
  that metadata.
- Services without audit metadata should pass `{ requestId }` when the request
  id is available.
- Existing `ipAddress` and `userAgent` audit fields should remain unchanged.
- Runtime logs should not duplicate before/after audit snapshots.

This gives operators a path from a UI error to runtime logs and from a runtime
failure to the business operation that triggered it.

## Frontend ApiError

`apps/admin/src/app/api-mutator.ts` should convert all failed requests into one
frontend error shape:

```ts
export type ApiError = {
  code: string
  message: string
  statusCode?: number
  requestId?: string
  path?: string
  timestamp?: string
  details?: unknown
  cause?: unknown
}
```

Server error responses should map directly into this type. Network failures,
timeouts, CORS failures, and malformed server responses should also become
`ApiError`:

```ts
{
  code: 'NETWORK_ERROR',
  message: 'Network request failed',
  cause: error
}
```

The mutator should preserve the existing behavior:

- `VITE_API_BASE_URL` based Axios configuration.
- Access token injection.
- Cookie-backed refresh token request.
- 401 refresh and original request replay.
- Shared refresh promise for concurrent 401 responses.
- Session reset and React Query cache clearing after failed refresh.
- Multipart upload and blob download support.

`ApiError` normalization must not break refresh replay. A 401 should still be
recognized before converting the final failure that is thrown to page code.

## Frontend Display Rules

Pages should not parse Axios errors or raw NestJS responses.

Display rules:

- Query loading failure: render the existing page or table error state with a
  retry action.
- Mutation failure: show a toast.
- `VALIDATION_ERROR`: map `details.fields` to form fields when possible;
  otherwise show a toast.
- `UNAUTHORIZED`: keep the refresh flow; after refresh failure, clear session
  and return to login.
- `FORBIDDEN`: route-level access goes to `/403`; action-level failure shows a
  toast.
- `INTERNAL_SERVER_ERROR` and other `5xx`: show a generic localized message
  and include the `requestId` when present.
- `NETWORK_ERROR`: show a service unavailable or network connectivity message.
- `RATE_LIMITED`: show a too-many-requests message and include retry timing
  when the response provides it.

Backend `message` is a fallback. Frontend copy should prefer local i18n based
on `code`, for example:

```text
USER_EMAIL_ALREADY_EXISTS -> Email already exists
VALIDATION_ERROR -> Please check the highlighted fields
INTERNAL_SERVER_ERROR -> Something went wrong. Request ID: ...
```

Initial migration should add shared helpers such as:

```text
isApiError(error)
toApiError(error)
getErrorMessage(error, fallback)
getValidationFieldErrors(error)
```

The initial migration scope must include these existing surfaces:

- `LoginView`
- `AdminShell` change-password flow
- `UsersPage`
- `RolesPage`
- `DictionariesPage`
- `FilesPage`
- `AuditLogsPage`
- `DataTable`

These surfaces should stop reading raw Axios or NestJS errors. A page may still
read `ApiError.message` through a shared helper.

## Observability Compose Overlay

Add a local optional compose overlay:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.observability.yml \
  up
```

Services:

- `loki`: stores and queries logs.
- `grafana`: provides the log UI.
- `alloy`: collects Docker container stdout/stderr and sends logs to Loki.
- `api`: continues to write only stdout/stderr JSON logs.

Use Grafana Alloy instead of Promtail because Promtail is in long-term support
and reaches end-of-life in 2026. Alloy also avoids requiring users to install a
Docker logging driver plugin.

The overlay should mount the Docker socket read-only for Alloy and label or
filter logs so Common Admin API logs can be queried as `service="api"`.

Grafana provisioning should include:

- Loki datasource.
- A dashboard for API runtime logs.
- Panels for request volume, 4xx count, 5xx count, slow requests, recent
  errors, request id search, user id search, and raw logs.

Example LogQL queries:

```logql
{service="api"} | json
{service="api"} | json | level="error"
{service="api"} | json | requestId="req_01HZ0000000000000000000000"
{service="api"} | json | statusCode >= 500
```

The dashboard is a verification aid. Production deployments may use the same
stdout JSON logs with Kubernetes DaemonSets, cloud log agents, Grafana Cloud,
Elastic, OpenSearch, Datadog, CloudWatch, Aliyun SLS, Tencent CLS, or another
platform.

## Environment Variables

Add or document:

```text
LOG_LEVEL
LOG_PRETTY
SERVICE_NAME
APP_ENV
```

Suggested defaults:

- `SERVICE_NAME=api`
- `APP_ENV` follows `NODE_ENV` or deployment environment.
- `LOG_PRETTY=true` in local development.
- `LOG_PRETTY=false` in production.

Avoid using observability-specific env vars in the application runtime. Loki
and Grafana configuration belongs to the compose overlay.

## Testing Strategy

Backend tests:

- Exception filter maps common NestJS exceptions into the envelope.
- Validation errors include `details.fields`.
- Unknown errors return `INTERNAL_SERVER_ERROR` and do not expose stack in the
  response.
- Prisma mapping covers `P2002` and `P2025`.
- Request id middleware accepts valid incoming ids, generates missing ids, and
  writes the response header.
- CORS allows and exposes `x-request-id`.
- Upload errors map to `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, or
  `BAD_REQUEST` as appropriate.
- Audit metadata stores request ids at `metadata.requestId`.
- Pino redaction removes sensitive headers and fields.

Frontend tests:

- `api-mutator` preserves refresh and replay behavior.
- Axios server errors become `ApiError`.
- Network failures become `NETWORK_ERROR`.
- 5xx errors expose `requestId` to message helpers.
- Validation details can be converted to field errors.
- `LoginView`, `AdminShell`, `UsersPage`, `RolesPage`, `DictionariesPage`,
  `FilesPage`, `AuditLogsPage`, and `DataTable` render retry states or mutation
  toasts through the shared helpers.

Integration or manual verification:

- Start the compose observability overlay.
- Trigger a successful API request and see it in Grafana.
- Trigger a validation error and confirm the frontend receives
  `VALIDATION_ERROR`.
- Trigger or simulate a 500 and confirm the frontend receives a `requestId`.
- Search the same `requestId` in Grafana and find the corresponding exception
  log.
- Perform an audited write and confirm the audit record stores the same
  `requestId` at `metadata.requestId`.

## Migration Order

1. Add backend error model, exception mapping, error response DTO, and global
   exception filter.
2. Add request id middleware and make request id available to audit metadata.
3. Introduce Pino logging with redaction and environment-specific formatting.
4. Normalize frontend errors in `api-mutator.ts` while preserving refresh
   behavior.
5. Add shared frontend error message and validation helpers.
6. Migrate existing admin pages away from direct raw `error.message` reads.
7. Add Loki, Grafana, and Alloy compose overlay with provisioning.
8. Add pattern documentation and verification steps.

This order keeps the API contract stable before frontend migration, then makes
the observability stack verify the final behavior.

## Acceptance Criteria

- Common API failures return the unified error envelope.
- Every API response includes `x-request-id`.
- Request logs include `service`, `env`, `level`, `time`, `requestId`,
  `method`, `path`, `statusCode`, `durationMs`, `userId` when available,
  `code` when applicable, and `msg`.
- Exception logs include request context when available and include `err` for
  stack-bearing failures.
- Application logs include `service`, `env`, `level`, `time`, and `msg`, but do
  not need request-only fields.
- Production logs are JSON and local logs are readable.
- Sensitive headers and token/password fields are redacted from runtime logs.
- Audit log metadata stores request ids at `metadata.requestId`.
- Frontend request failures throw `ApiError` rather than raw Axios errors.
- `LoginView`, `AdminShell`, `UsersPage`, `RolesPage`, `DictionariesPage`,
  `FilesPage`, `AuditLogsPage`, and `DataTable` use shared error helpers for
  their existing error states and mutation toasts.
- The optional observability overlay starts locally and Grafana can query API
  request and error logs.
- A failed request's `requestId` can be used to find the corresponding runtime
  log in Grafana.
