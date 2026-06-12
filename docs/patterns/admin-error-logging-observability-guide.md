# Admin Error Logging Observability Guide

This guide explains how Common Admin exposes API errors, runtime logs, and the
local Loki/Grafana observability overlay.

## Runtime Logs vs Audit Logs

Runtime logs are stdout/stderr Pino logs from the API container. They answer
"what happened while serving this request?" and are meant for operators,
debugging, alerting, and log aggregation.

Audit logs are database records shown in the admin UI. They answer "who changed
what?" and are meant for business traceability. Audit metadata can include the
same `requestId` as runtime logs, but audit logs are not a replacement for
stdout/stderr runtime logs.

## Error Envelope

API errors use one normalized response envelope:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "statusCode": 400,
  "requestId": "req_01HZ0000000000000000000000",
  "path": "/api/users",
  "timestamp": "2026-06-11T10:20:30.000Z",
  "details": {
    "fields": [{ "field": "email", "message": "email must be an email" }]
  }
}
```

`details` is optional and is intended for structured, non-sensitive diagnostics
such as validation field errors.

## Error Codes

Base error codes:

- `BAD_REQUEST`
- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `PAYLOAD_TOO_LARGE`
- `UNSUPPORTED_MEDIA_TYPE`
- `INTERNAL_SERVER_ERROR`
- `SERVICE_UNAVAILABLE`

Module-specific codes currently include:

- `USER_EMAIL_ALREADY_EXISTS`
- `ROLE_CODE_ALREADY_EXISTS`
- `DICTIONARY_CODE_ALREADY_EXISTS`
- `FILE_UPLOAD_REQUIRED`
- `FILE_NOT_FOUND`

Prefer adding named module codes when the frontend can give a better user
message than the generic HTTP status code.

## Request ID Behavior

Every response includes an `x-request-id` header and the same value in API error
envelopes. A valid incoming `x-request-id` header is echoed. Missing or invalid
incoming IDs are replaced with a generated `req_<uuid>` value. CORS exposes
`x-request-id` so browser code can read it.

Use `requestId` to correlate:

- the frontend `ApiError`
- API runtime logs
- optional audit log metadata

## Runtime Logging Fields

API runtime logs are JSON on stdout/stderr unless `LOG_PRETTY=true`.

Important fields include:

- `service`: API service name, normally `api`.
- `env`: deployment environment, from `APP_ENV`.
- `level`: Pino numeric log level. Error logs are `50` and above.
- `msg`: log message, such as `request completed` or `Unhandled exception`.
- `requestId`: request correlation id.
- `method`: HTTP method.
- `path`: request path.
- `statusCode`: response status code.
- `durationMs`: request duration.
- `userId`: authenticated user id when available.
- `ip`: request IP when available.
- `userAgent`: request user agent when available.
- `code`: error code on exception logs.
- `err`: serialized exception on exception logs.
- `req` and `res`: Pino HTTP request and response objects.

Redaction replaces sensitive values with `[Redacted]`. Current redaction paths
cover:

- `req.headers.authorization`
- `req.headers.cookie`
- `res.headers.set-cookie`
- nested or top-level `password`
- nested or top-level `oldPassword`
- nested or top-level `newPassword`
- nested or top-level `accessToken`
- nested or top-level `refreshToken`

Do not log secrets under new field names unless they are also added to the
redaction list. Runtime logs should not duplicate audit before/after snapshots.

## Frontend ApiError Usage

The admin app normalizes API failures through `ApiError` in
`apps/admin/src/app/api-error.ts`. Generated API calls use the shared mutator,
which throws an `ApiError` instead of raw Axios errors.

UI code should pass caught errors to `getErrorMessage()` or `toApiError()` and
use `apiError.requestId` when showing support-friendly internal error messages.
Validation UIs can use `getValidationFieldErrors()` to read
`details.fields`.

## Local Observability Overlay

Start the deployment stack with Loki, Grafana, and Alloy:

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.observability.yml up
```

Open Grafana at:

```text
http://localhost:${GRAFANA_HTTP_PORT:-3000}
```

Grafana is provisioned with:

- datasource name: `Loki`
- dashboard title: `Common Admin API Logs`
- expected Loki labels: `service`, `container`, and `compose_project`

The overlay uses Alloy to discover the Compose API container through the Docker
socket, map it to `service="api"`, and forward stdout/stderr logs to Loki.

Production deployments can use any stdout/stderr log collector. The application
contract is JSON logs on stdout/stderr; Loki/Grafana/Alloy are only the local
reference overlay.

## LogQL Examples

Copy these into Grafana Explore with the `Loki` datasource:

```logql
{service="api"} | json
```

```logql
{service="api"} | json | requestId="req_from_response"
```

```logql
{service="api"} | json | userId="user_id_from_response"
```

```logql
{service="api"} | json | level="error"
```

Common Admin currently writes Pino JSON with numeric levels, so the practical
error-level query is:

```logql
{service="api"} | json | level >= 50
```

```logql
{service="api"} | json | statusCode >= 500
```

## Diagnostic Error Endpoint

`GET /api/diagnostics/error` exists only when
`ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=true`.

The local observability overlay enables it for smoke tests so operators can
force an error and confirm the response envelope, request id, API JSON stdout,
Alloy forwarding, Loki ingestion, and Grafana dashboard all line up.

Normal deployments must keep `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=false`.

## Troubleshooting No Logs

If Grafana shows no API logs:

1. Confirm the stack was started with both compose files and the same env file.
2. Confirm the Alloy container has the Docker socket mounted read-only at
   `/var/run/docker.sock`.
3. Check Alloy target discovery. It keeps only containers from
   `COMMON_ADMIN_COMPOSE_PROJECT` and the Compose service named `api`.
4. Confirm label mapping in Loki. API logs should have `service="api"` plus
   `container` and `compose_project` labels.
5. In Grafana, open Connections or Explore and verify the `Loki` datasource is
   healthy.
6. Confirm the API container writes JSON logs to stdout:

   ```bash
   docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.observability.yml logs api
   ```

7. If `LOG_PRETTY=true`, switch it off for collector smoke tests so Loki can
   parse JSON fields with `| json`.
