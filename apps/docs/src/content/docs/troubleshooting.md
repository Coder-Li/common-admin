---
title: Troubleshooting
description: Common setup, auth, API generation, migration, upload, and docs-site failures.
draft: false
---

Use this page when the local stack, generated API flow, or public docs build
does not behave as expected.

Start with the smallest check that can prove or disprove the problem, then move
outward. Avoid patching generated artifacts or changing architecture boundaries
to silence a symptom.

## Local Stack

If the API does not start:

- Confirm Postgres is reachable from `DATABASE_URL`.
- Confirm Redis is reachable from `REDIS_URL`.
- Confirm `apps/api/.env` exists and contains local development values.
- Run Prisma migrations before starting the app.

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm dev:api
```

If the admin app cannot call the API:

- Check `VITE_API_BASE_URL`.
- Check API CORS `ALLOWED_ORIGINS`.
- Confirm the API is mounted at `/api`.
- Look for doubled paths such as `/api/api/...`.

## Login And Refresh

Repeated `401` responses usually mean one of these boundaries is broken:

- access token was not stored in the frontend auth store;
- refresh cookie was not set or sent;
- refresh cookie security or same-site settings do not match the deployment;
- refresh failed and the frontend correctly became anonymous;
- an endpoint is guarded by a permission the user does not have.

Focused checks:

```bash
pnpm --filter api test -- auth
pnpm --filter admin test -- api-mutator
pnpm --filter admin test -- api-refresh-coordinator
```

See [Auth And Sessions](/auth-and-sessions/).

## API Drift

If `pnpm api:check` fails, inspect generated drift:

```bash
git diff -- apps/api/openapi.json apps/admin/src/generated/api
```

Common causes:

- missing or renamed Swagger operation id;
- missing DTO Swagger metadata;
- generated paths include `/api`;
- multipart upload metadata is incomplete;
- binary download metadata is incomplete;
- frontend code expects an old generated name.

Do not edit generated files by hand. Fix backend DTOs, controller metadata,
OpenAPI generation, or Orval configuration, then run:

```bash
pnpm api:generate
pnpm api:check
```

See [API Contract](/patterns/api-contract/).

## Migrations And Seed

Use development migrations locally:

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

Use deployment migrations in a production-like environment:

```bash
pnpm deploy:migrate
```

Use `deploy:init` only for first-time empty database initialization. It runs
migrations and seed data.

If a migration might drop or rewrite data, stop and plan the migration before
running it against shared or production data.

## Permissions

If a page is missing from the menu:

- confirm the route metadata has the expected `requiredPermissions`;
- confirm the current user has the permission code;
- confirm the backend registry contains the permission;
- confirm seed behavior granted it to the intended default role;
- confirm the frontend is not checking role names.

If direct URL access returns `/403`, the route guard is working. Check the
permission assignment instead of bypassing the guard.

See [RBAC](/patterns/rbac/).

## Uploads And Downloads

If uploads fail:

- check `FILE_MAX_SIZE_MB`;
- check `FILE_ALLOWED_MIME_TYPES`;
- check runtime upload settings;
- confirm the request is `multipart/form-data`;
- confirm generated upload helpers are being used.

If downloads are not saved as files:

- confirm the endpoint Swagger metadata describes a binary response;
- confirm the generated frontend function is used;
- confirm the browser file-save wrapper handles the Blob and filename.

See [File Management](/file-management/).

## Docs Build

For docs-only changes:

```bash
pnpm --filter docs build
```

If the docs build reports duplicate content ids, remove generated Astro content
cache and rerun. The docs package already does this in `prebuild`.

Do not use generated docs output as source material for public docs, llms files,
MCP tools, or skills.

## Reporting

When reporting a problem, include:

- command or page;
- expected result;
- actual result;
- relevant error output;
- request id for API failures;
- docs read before the issue appeared;
- verification command and result.

Do not include secrets, tokens, `.env` contents, refresh cookies, production
passwords, private customer data, or database dumps.
