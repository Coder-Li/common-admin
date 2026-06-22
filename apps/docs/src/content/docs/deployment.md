---
title: Deployment
description: Run Common Admin with Docker Compose and keep deployment configuration separate from runtime settings.
draft: false
---

Common Admin can run as a local production-like stack with Docker Compose. The
Compose shape is intentionally simple:

```text
admin container
  -> nginx serves the React build and proxies /api
api container
  -> NestJS production server
postgres container
redis container
api-uploads volume
```

Only the admin HTTP port is exposed by default. The API, Postgres, and Redis
services stay inside the Compose network unless you deliberately change the
deployment.

## Configuration Files

Use local environment files for deployment values and keep them out of source
control.

```bash
cp .env.deploy.example .env.deploy
```

Review these categories before starting a stack:

- Database name, user, and password.
- JWT access-token secret.
- Refresh-cookie name, security, same-site, and optional domain settings.
- Allowed browser origins.
- Admin HTTP port.
- File upload size and allowed MIME types.
- Image tag or image names when using published images.
- Logging level and pretty-print behavior.

Do not publish `.env.deploy`, `.env*`, tokens, passwords, refresh cookies, or
database dumps in docs, issues, logs, screenshots, or AI prompts.

## First Deployment

Build images on the server:

```bash
docker compose --env-file .env.deploy up -d postgres redis
pnpm deploy:init
docker compose --env-file .env.deploy up -d --build
```

Use published images instead of building locally:

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml run --rm api pnpm --filter api deploy:init
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml up -d
```

`deploy:init` runs database migrations and seed data. Use it for the first empty
database initialization only. For later upgrades, use the migration-only flow.

## Docs Site

The public documentation site deploys from GitHub Actions to GitHub Pages when
changes are pushed to `main`. The workflow builds the Astro Starlight app with:

```bash
pnpm --filter docs build
```

The Pages artifact is `apps/docs/dist`.

The Astro config currently uses `site: 'https://common-admin.dev'`, which is
appropriate when GitHub Pages serves the docs through the `common-admin.dev`
custom domain. If you deploy through the default GitHub Pages project URL, set
the Astro `site` to that URL and add the matching `base` path before deploying
so canonical URLs, sitemap output, and generated asset links match the public
address.

## Upgrades

When a new version includes Prisma migrations, deploy the new API image, run the
production migration command, then start the stack:

```bash
pnpm deploy:migrate
docker compose --env-file .env.deploy up -d
```

With published images:

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml run --rm api pnpm --filter api deploy:migrate
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml up -d
```

`deploy:migrate` runs Prisma migrate deploy without seeding default data again.

## Deployment-Only Config

Deployment-only configuration belongs in environment variables. Examples:

- `DATABASE_URL`, or the Compose variables used to construct it.
- `REDIS_URL`.
- `JWT_ACCESS_TOKEN_SECRET`.
- `ALLOWED_ORIGINS`.
- Refresh-cookie security and domain settings.
- File storage driver and local storage root.
- Maximum upload policy ceiling.
- Logging and service identity settings.

Runtime-editable product settings belong in the settings module instead. See
[Settings](/settings/) for the boundary.

## Cookie And Origin Rules

Production configuration validates several auth safety rules:

- `JWT_ACCESS_TOKEN_SECRET` must not use the local development default.
- `ALLOWED_ORIGINS` must not include `*` in production.
- `AUTH_REFRESH_COOKIE_SECURE` must be explicitly configured in production.
- `AUTH_REFRESH_COOKIE_SAME_SITE=none` requires `AUTH_REFRESH_COOKIE_SECURE=true`.
- `AUTH_REFRESH_COOKIE_SECURE=false` is only suitable for HTTP origins.

For a simple HTTP Compose deployment, `sameSite=lax` and an insecure refresh
cookie can be acceptable. For HTTPS deployments, prefer secure cookies.

## Verification

After deployment, check:

```text
Admin:   http://localhost:<ADMIN_HTTP_PORT>/
Health:  http://localhost:<ADMIN_HTTP_PORT>/api/health
Swagger: http://localhost:<ADMIN_HTTP_PORT>/api/docs
```

Useful commands:

```bash
docker compose --env-file .env.deploy ps
docker compose --env-file .env.deploy logs api
docker compose --env-file .env.deploy logs admin
```

Before treating a release branch as ready, run:

```bash
pnpm quality
```
