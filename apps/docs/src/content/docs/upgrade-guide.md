---
title: Upgrade Guide
description: How to upgrade a Common Admin deployment or derived project safely.
draft: false
---

Use this guide when moving a Common Admin deployment or derived project to a
newer version.

## Before Upgrading

Review the change set for:

- Prisma migrations;
- permission registry changes;
- API contract changes;
- generated frontend API changes;
- auth, cookie, or session behavior changes;
- settings or file upload policy changes;
- deployment variable changes;
- public docs or MCP allowlist changes.

Back up the database before applying migrations to shared or production data.

## Generated API Drift

If the upgrade changes backend contracts, regenerate and check generated
artifacts:

```bash
pnpm api:generate
pnpm api:check
```

Generated diffs should be explained by backend DTO, Swagger metadata, OpenAPI,
or Orval changes. Do not patch generated output by hand.

## Database Migrations

For local development:

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

For deployment upgrades:

```bash
pnpm deploy:migrate
```

Use `deploy:init` only for first-time empty database initialization.

If a migration renames or removes stable fields, permissions, roles, or user
data, plan how existing records should map before running it.

## Permission Changes

Permission codes are durable data. When upgrading permissions:

- add new registry entries with stable codes;
- avoid renaming existing codes unless a migration handles assignments;
- review `defaultRoles`;
- verify seed behavior does not re-grant permissions that an admin removed;
- update frontend route metadata and page action gates together.

Run focused permission tests after permission registry changes.

## Deployment Configuration

Review environment variables when upgrading auth, cookies, storage, logging, or
origins.

In production, keep these rules:

- configure a non-local JWT secret;
- avoid wildcard origins;
- explicitly configure refresh-cookie security;
- use secure cookies for HTTPS deployments;
- keep secrets out of runtime settings and docs.

## Rollback Notes

Image rollback is usually easier than database rollback. Database rollback needs
a migration or restore plan.

Before applying a risky migration, decide:

- whether the migration is reversible;
- whether old application code can read the new schema;
- how to restore data if the deploy fails;
- which image tag should be used for rollback.

## Verification

Before upgrade:

```bash
pnpm quality
```

After upgrade:

- open the admin app;
- sign in;
- verify Swagger renders;
- visit users, roles, dictionaries, files, audit logs, and settings;
- check health endpoint;
- inspect API logs for unexpected 401, 403, 500, CORS, or migration errors.

For docs or MCP-only upgrades:

```bash
pnpm --filter docs build
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```
