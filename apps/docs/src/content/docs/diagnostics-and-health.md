---
title: Diagnostics And Health
description: Health checks, diagnostic endpoints, and request logging behavior.
draft: false
---

Common Admin exposes a normal health check and a gated diagnostic error
endpoint. Use these surfaces for deployment checks and request-flow validation.

## Health Check

The deployment stack expects the API health endpoint to respond successfully
before treating the API container as healthy.

Health is part of the runtime availability contract, not the admin product UI.
It should stay simple, fast, and free of secrets.

Use it to verify:

- the API process is reachable;
- the service has booted;
- dependencies required by the health check are responding.

## Diagnostic Error Endpoint

The API includes a public diagnostic error endpoint that can be enabled through
deployment configuration for request-flow verification.

Use it when you need to confirm:

- the request-id header is present;
- the global exception filter maps unknown errors to the unified envelope;
- runtime logs include the expected request context;
- error responses remain consistent through the HTTP pipeline.

Do not leave diagnostic-only failure surfaces exposed unless the deployment
explicitly requires them.

## Logging Expectations

When a request fails, the API should log structured context such as request id,
method, path, status, and user id when known.

Runtime logs are for operators and diagnostics. They should not become a second
copy of the public docs or an audit trail.

## Frontend Use

The admin app should not depend on diagnostic endpoints for normal operation.
Use them only when debugging request flow, global errors, or deployment
configuration.

## Verification

Focused checks:

```bash
pnpm --filter api test -- diagnostics
pnpm --filter api test -- common/errors
pnpm --filter api test -- common/logging
```

For global request behavior:

```bash
pnpm --filter api test:e2e
pnpm build
```
