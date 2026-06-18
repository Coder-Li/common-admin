---
title: Errors And Logging
description: Error response envelopes, request IDs, validation behavior, runtime logs, and redaction.
draft: false
---

Common Admin uses consistent API error envelopes and structured runtime logs.
Errors are for API callers; logs are for operators and diagnostics. Audit logs
are a separate database record of sensitive administrative actions.

## Error Envelope

API errors should return this shape:

```ts
interface ErrorResponse {
  code: string
  message: string
  statusCode: number
  requestId: string
  path: string
  timestamp: string
  details?: unknown
}
```

The `requestId` should match the `x-request-id` response header so callers can
connect a failed API response to server logs.

## Request IDs

The API accepts an incoming `x-request-id` header when it matches the allowed
format. Otherwise it creates a new request id and returns it in the response
header.

Use the request id when:

- reporting bugs;
- tracing API logs;
- recording audit metadata for user-triggered changes;
- correlating frontend errors with backend diagnostics.

Do not put secrets into request ids. They are logged and returned to clients.

## Error Types

Validation errors should use `VALIDATION_ERROR` with field-level details:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {
    "fields": [
      { "field": "email", "message": "email must be an email" }
    ]
  }
}
```

Guard and auth errors should map to `UNAUTHORIZED` or `FORBIDDEN`.

Application errors should use stable error codes when callers or UI copy need to
distinguish them, for example duplicate records, upload policy failures, or
resource-specific conflicts.

Unexpected exceptions should return `INTERNAL_SERVER_ERROR` without leaking stack
traces or private implementation details.

## Runtime Logs

The API uses structured stdout/stderr logs. Runtime logs should answer questions
such as:

- Which request failed?
- Which route and method were involved?
- Which user id was known?
- Which exception caused a 500?
- Which service and environment emitted the event?

Runtime logs are not audit logs. They may be sampled, shipped to an external log
system, retained for a limited time, or viewed through a deployment-specific
observability stack.

## Redaction

The logging layer redacts sensitive headers and credential-like fields such as:

- authorization headers;
- cookies and set-cookie headers;
- passwords;
- access tokens;
- refresh tokens.

When adding new secret-like fields, update redaction expectations and tests
before shipping the feature.

## Audit Logs Are Separate

Use audit logs for administrative changes that need an accountability trail:
who changed what, when, from where, and with which sanitized before/after
payloads.

Do not rely on runtime logs as a durable audit trail. See [Audit Logs](/audit-logs/).

## Verification

Focused checks:

```bash
pnpm --filter api test -- common/errors
pnpm --filter api test -- common/logging
```

For changes that affect global request behavior:

```bash
pnpm --filter api test:e2e
pnpm build
```
