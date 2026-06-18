---
title: Getting Started
description: Run Common Admin locally and understand the first development commands.
draft: false
---

Common Admin is a pnpm workspace with two main applications:

```text
apps/api      NestJS API, Prisma, auth, RBAC, OpenAPI
apps/admin    Vite React admin app
apps/docs     Public documentation site
```

## Requirements

- Node.js and the repository's configured pnpm version.
- PostgreSQL with a writable local database.
- Redis for session and cache-related runtime behavior.
- A shell that can run the root `pnpm` workspace scripts.

The default local service values are:

```text
Postgres: postgresql://postgres:postgres@localhost:5432/common_admin
Redis:    redis://localhost:6379
```

You may use local services, a team-managed development database, or Docker-managed services. Keep `.env` values local and do not commit them.

## Install

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
createdb common_admin
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm dev
```

Before starting the apps, check `apps/api/.env` for:

- `DATABASE_URL` pointing at the intended Postgres database.
- Redis connection settings pointing at the intended Redis instance.
- Auth secrets and token/session settings suitable for local development.
- CORS/origin values that allow the admin app URL.
- Upload and file limits if the feature you are testing uses files.

Default local URLs:

```text
API:      http://localhost:13001/api
Admin:    http://localhost:15173
Swagger:  http://localhost:13001/api/docs
Docs:     http://localhost:15174
```

Default administrator:

```text
admin@example.com
Admin123!
```

## First Verification

After `pnpm dev` starts, verify the local stack before making feature changes:

1. Open the admin app and sign in with the default administrator.
2. Open Swagger and confirm the API docs render.
3. Visit one existing admin list page, such as users, roles, dictionaries, files, audit logs, or settings.
4. Make sure the browser does not show repeated `401`, CORS, or network errors.

## Quality Gate

Before publishing a change, run:

```bash
pnpm quality
```

The quality gate regenerates API clients, checks generated drift, lints, tests, runs API e2e tests, and builds the workspace.

When debugging or iterating, run the individual commands in this order:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

Use package-scoped commands while narrowing a failure, then return to the broader gate before claiming a branch is ready.
