---
title: Audit Logs
description: What Common Admin audits, how payloads are sanitized, and how audit logs differ from runtime logs.
draft: false
---

Audit logs are database records for sensitive administrative operations. They
answer accountability questions:

- Who performed the action?
- Which resource changed?
- What action was performed?
- What were the sanitized before and after values?
- Which request id, IP address, and user agent were associated with the action?

They are not a replacement for runtime logs, metrics, tracing, backups, or
business event streams.

## What To Audit

Audit operations that change administrative state or security-sensitive data.
Examples include:

- creating, updating, deleting, enabling, or disabling users;
- changing roles or permission assignments;
- changing organization, department, position, or data-permission structures;
- changing dictionaries that affect product behavior;
- uploading, updating, deleting, or otherwise managing files;
- changing runtime product settings;
- refreshing operational caches through an admin action;
- revoking sessions or changing password-related state.

Read-only list and detail requests usually do not need audit records unless the
resource is especially sensitive.

## Payload Shape

Audit records should use stable resource and action labels. A normal record
contains:

- action;
- resource type;
- resource id;
- actor id, username, email, and display name when known;
- request metadata;
- sanitized `before` payload;
- sanitized `after` payload;
- additional sanitized metadata when needed.

Prefer public response DTO shapes for `before` and `after` values. Do not store
raw Prisma records when they contain private fields.

## Sanitization

Audit payloads must not store secrets. Sensitive keys are recursively redacted
before records are persisted.

Treat these as sensitive by default:

- passwords and password hashes;
- access tokens and refresh tokens;
- cookie values;
- storage object internals that should not be exposed;
- API keys, secrets, and credentials;
- private metadata from uploaded files or external systems.

If a new module introduces a secret-like field, add sanitizer coverage before
recording it.

## Runtime Logs vs Audit Logs

Runtime logs:

- are emitted to stdout/stderr;
- support debugging and operations;
- include request ids and exception details;
- may be retained according to deployment logging policy.

Audit logs:

- are stored in the database;
- support accountability and admin review;
- record user-triggered changes;
- must use sanitized business payloads.

Do not put secrets in either surface.

## Querying Audit Logs

The public API exposes list and detail endpoints guarded by `audit_log.read`.
The admin app should use generated API helpers for audit-log pages.

When adding filters or sort fields, update the backend query DTO, Swagger
metadata, generated API client, page tests, and docs together.

## Verification

Focused checks:

```bash
pnpm --filter api test -- audit-log
pnpm --filter admin test -- AuditLogsPage
```

If another module starts recording audit logs, include that module's service or
controller tests as well.
