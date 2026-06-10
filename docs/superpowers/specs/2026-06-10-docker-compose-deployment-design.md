# Docker Compose Deployment Design

## Goal

Add a Docker Compose based deployment path for Common Admin without changing
the existing local development workflow.

The deployment path should let an operator build and run the complete stack
with Docker Compose:

- PostgreSQL
- Redis
- NestJS API
- Vite admin frontend served by Nginx

The default deployment should expose only the Nginx HTTP port. The API,
PostgreSQL, and Redis services should remain reachable only inside the Compose
network.

## Context

Common Admin already has a productive local development flow:

- `pnpm dev` runs the API and admin app from the workspace.
- `pnpm dev:api` and `pnpm dev:admin` run each side independently.
- Local development currently assumes local or team-managed PostgreSQL and
  Redis services.
- The root README documents local ports and setup commands.

That local workflow should stay as-is. Docker Compose is not intended to become
the primary hot-reload development environment in this iteration.

The missing piece is deployment ergonomics. A user should be able to clone the
template, configure deployment environment variables, build production images,
start the stack, initialize the database, and later apply schema migrations with
documented commands.

## Chosen Approach

Use a minimal production-oriented Compose setup:

```text
external user
  -> admin nginx container :80
      -> static admin dist
      -> /api proxy to api:13001
  -> no direct external access to api/postgres/redis
```

Long-running Compose services:

```text
postgres
redis
api
admin
```

The `admin` service is an Nginx image. Its build uses a Node builder stage to
compile the Vite app, then copies the static `dist` output into Nginx.

The `api` service is a NestJS production image. Its image must also include the
Prisma schema, migrations, and seed runtime so the same image can execute
deployment database commands through Compose.

## Non-Goals

This design does not add a Docker-based hot-reload development workflow.

This design does not add HTTPS certificate management. The default deployment
serves HTTP and documents how cookie settings should change when the operator
adds HTTPS through their own proxy or infrastructure.

This design does not add backups, log shipping, orchestration-specific
manifests, resource limits, or blue-green deployment automation.

This design does not expose the API service directly by default. A future
override file can expose it for debugging if needed.

## Files

Add these deployment files:

```text
docker-compose.yml
.env.deploy.example
.dockerignore

apps/api/Dockerfile
apps/admin/Dockerfile
apps/admin/nginx.conf
```

Update these existing files:

```text
.gitignore
package.json
apps/api/package.json
README.md
apps/api/src/config/env.config.ts
```

The `env.config.ts` change is needed because the default deployment supports
HTTP. The current production validation rejects
`AUTH_REFRESH_COOKIE_SECURE=false` when `NODE_ENV=production`; the deployment
design should allow that explicit configuration and document the trade-off in
`.env.deploy.example`.

## Compose Services

### postgres

Use the official PostgreSQL image:

```text
image: postgres:16
```

Configuration comes from `.env.deploy`:

```text
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
```

Data is persisted in a named volume:

```text
postgres-data:/var/lib/postgresql/data
```

Add a healthcheck using `pg_isready`.

### redis

Use the official Redis Alpine image:

```text
image: redis:7-alpine
```

Data is persisted in a named volume:

```text
redis-data:/data
```

Add a healthcheck using `redis-cli ping`.

### api

Build the API image from the repository root:

```text
build:
  context: .
  dockerfile: apps/api/Dockerfile
```

Run the production NestJS server:

```text
pnpm --filter api start:prod
```

The API image must support two runtime modes:

- Long-running server mode: `pnpm --filter api start:prod`.
- One-off deployment command mode: `pnpm --filter api deploy:init` and
  `pnpm --filter api deploy:migrate`.

Because the current Prisma seed command runs TypeScript through `ts-node`, the
Dockerfile must choose one explicit seed-runtime strategy:

- Keep the required dev runtime packages and TypeScript source files in the API
  image so `prisma db seed` can run unchanged.
- Or compile/provide a production JavaScript seed runner and update
  `package.json` so `prisma db seed` no longer depends on `ts-node`.

The implementation plan should pick one of these strategies before writing the
Dockerfile. Do not leave seed execution accidentally dependent on files or
packages that are pruned from the final image.

Set deployment environment variables:

```text
NODE_ENV=production
PORT=13001
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
REDIS_URL=redis://redis:6379
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
JWT_ACCESS_TOKEN_SECRET=${JWT_ACCESS_TOKEN_SECRET}
AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS=${AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS}
AUTH_REFRESH_COOKIE_NAME=${AUTH_REFRESH_COOKIE_NAME}
AUTH_REFRESH_COOKIE_SECURE=${AUTH_REFRESH_COOKIE_SECURE}
AUTH_REFRESH_COOKIE_SAME_SITE=${AUTH_REFRESH_COOKIE_SAME_SITE}
AUTH_REFRESH_COOKIE_DOMAIN=${AUTH_REFRESH_COOKIE_DOMAIN}
FILE_STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=/app/storage/uploads
FILE_MAX_SIZE_MB=${FILE_MAX_SIZE_MB}
FILE_ALLOWED_MIME_TYPES=${FILE_ALLOWED_MIME_TYPES}
```

Persist uploaded files in a named volume:

```text
api-uploads:/app/storage/uploads
```

The API should depend on PostgreSQL and Redis. Prefer service healthchecks for
readiness where Compose supports them, while keeping the application resilient
to normal dependency startup timing.

Add an API healthcheck against:

```text
GET /api/health
```

Use a healthcheck command that the image actually provides. Prefer a tiny Node
HTTP check to avoid adding curl or wget only for healthchecks, unless the
Dockerfile intentionally installs one of those tools.

### admin

Build the admin image from the repository root:

```text
build:
  context: .
  dockerfile: apps/admin/Dockerfile
  args:
    VITE_API_BASE_URL: /api
```

Expose only the Nginx port:

```text
ports:
  - "${ADMIN_HTTP_PORT:-8080}:80"
```

The admin service depends on the API service and proxies API requests through
the Compose network.

## Nginx Behavior

Nginx serves the built admin app and proxies API traffic.

Requirements:

- Serve Vite static assets from `/usr/share/nginx/html`.
- Support frontend route refreshes with `try_files $uri $uri/ /index.html`.
- Proxy `/api/` to `http://api:13001/api/`.
- Preserve `Host`, `X-Real-IP`, `X-Forwarded-For`, and
  `X-Forwarded-Proto` headers.
- Cache hashed static assets aggressively.
- Avoid aggressive caching for `index.html`.
- Keep the admin app and Swagger reachable through the same exposed port:
  - `/`
  - `/api/health`
  - `/api/docs`

## Deployment Environment File

Add a root `.env.deploy.example`. Operators copy it to `.env.deploy`:

```bash
cp .env.deploy.example .env.deploy
```

The example should be copyable, commented, and safe enough for local or internal
HTTP deployment while clearly marking secrets that must be changed.

Required contents:

```text
# Public HTTP port exposed by the Nginx admin container.
ADMIN_HTTP_PORT=8080

# Public origins allowed by the API CORS and auth-origin checks.
# Keep the localhost default for single-host HTTP testing.
# Replace this with your real scheme, host, and port when deploying elsewhere.
ALLOWED_ORIGINS=http://localhost:8080

# PostgreSQL settings for the Compose postgres service.
POSTGRES_DB=common_admin
POSTGRES_USER=common_admin
POSTGRES_PASSWORD=change-me

# Change this before deployment. It must be at least 16 characters.
JWT_ACCESS_TOKEN_SECRET=change-me-at-least-16-chars

# Refresh-cookie settings.
# The default Compose deployment uses HTTP, so secure cookies are disabled.
# When serving through HTTPS, set AUTH_REFRESH_COOKIE_SECURE=true.
AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS=14
AUTH_REFRESH_COOKIE_NAME=common_admin_refresh
AUTH_REFRESH_COOKIE_SECURE=false
AUTH_REFRESH_COOKIE_SAME_SITE=lax
AUTH_REFRESH_COOKIE_DOMAIN=

# Local file upload settings for the API container.
FILE_MAX_SIZE_MB=20
FILE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,application/pdf,text/plain
```

The design intentionally keeps deployment variables separate from the existing
local `.env.example` files to avoid mixing local development and deployment
configuration.

The repository `.gitignore` currently ignores `.env.*`. Update it to explicitly
allow committing `.env.deploy.example` while continuing to ignore `.env.deploy`
and other real environment files.

## Database Commands

The deployment should separate first-time initialization from later schema
updates.

Add root scripts:

```json
{
  "scripts": {
    "deploy:init": "docker compose --env-file .env.deploy build api && docker compose --env-file .env.deploy run --rm api pnpm --filter api deploy:init",
    "deploy:migrate": "docker compose --env-file .env.deploy build api && docker compose --env-file .env.deploy run --rm api pnpm --filter api deploy:migrate"
  }
}
```

Add API scripts:

```json
{
  "scripts": {
    "db:migrate:deploy": "prisma migrate deploy",
    "deploy:init": "pnpm db:migrate:deploy && pnpm db:seed",
    "deploy:migrate": "pnpm db:migrate:deploy"
  }
}
```

`deploy:init` is for first deployment against an empty database. It applies all
Prisma migrations and then runs seed data.

`deploy:migrate` is for later releases that include schema changes. It applies
Prisma migrations only.

Do not tell operators to run seed during normal upgrades. The current seed
logic is mostly idempotent, but it resets the default administrator password for
`admin@example.com` to `Admin123!`. That makes seed appropriate for first-time
initialization, not routine upgrades.

## Deployment Flow

First deployment:

```bash
cp .env.deploy.example .env.deploy
# Edit .env.deploy before deployment.

docker compose --env-file .env.deploy up -d postgres redis
pnpm deploy:init
docker compose --env-file .env.deploy up -d --build
```

Later deployment with possible schema changes:

```bash
docker compose --env-file .env.deploy build api admin
pnpm deploy:migrate
docker compose --env-file .env.deploy up -d
```

The upgrade order is intentional: build the new images, run schema migrations
through the new API image, then start or recreate the long-running services. Do
not start the new API container against the old database schema before running
the migration command.

## HTTP And HTTPS

The default Compose deployment supports HTTP:

```text
http://localhost:${ADMIN_HTTP_PORT}
```

This is deliberate. It makes the template easy to run on a local server, in an
internal environment, or behind infrastructure that has not yet added TLS.

When the operator adds HTTPS, they should review:

```text
AUTH_REFRESH_COOKIE_SECURE=true
AUTH_REFRESH_COOKIE_SAME_SITE=lax
AUTH_REFRESH_COOKIE_DOMAIN=
```

If the frontend and API are served from different sites in a future deployment,
the operator may need:

```text
AUTH_REFRESH_COOKIE_SAME_SITE=none
AUTH_REFRESH_COOKIE_SECURE=true
AUTH_REFRESH_COOKIE_DOMAIN=<shared domain>
```

The root README and `.env.deploy.example` should explain these settings briefly.

## Verification

The implementation is complete when these checks pass:

1. Build and start the deployment stack:

   ```bash
   cp .env.deploy.example .env.deploy
   docker compose --env-file .env.deploy up -d postgres redis
   pnpm deploy:init
   docker compose --env-file .env.deploy up -d --build
   ```

2. Verify public endpoints through Nginx:

   ```text
   http://localhost:8080/
   http://localhost:8080/api/health
   http://localhost:8080/api/docs
   ```

3. Log in through the admin frontend:

   ```text
   admin@example.com
   Admin123!
   ```

4. Verify the API, PostgreSQL, and Redis ports are not directly published by
   the default Compose file. This can be checked with:

   ```bash
   docker compose --env-file .env.deploy ps
   docker compose --env-file .env.deploy config
   ```

5. Verify a later migration command runs through Compose:

   ```bash
   docker compose --env-file .env.deploy build api admin
   pnpm deploy:migrate
   docker compose --env-file .env.deploy up -d
   ```

6. Run existing quality checks where practical:

   ```bash
   pnpm lint
   pnpm test
   pnpm build
   ```

## README Updates

Update the root README with a deployment section that makes the boundary clear:

- Local development still uses the existing pnpm workflow.
- Docker Compose is the deployment path.
- `.env.deploy.example` should be copied to `.env.deploy`.
- First-time initialization and later migrations are separate commands.
- Only Nginx is exposed by default.
- HTTP is supported by default.
- HTTPS deployments should set secure cookie options.
- Seed should be treated as first-time initialization because it resets the
  default admin password.

The app-level README files can remain unchanged in this iteration unless the
implementation chooses to replace the generated starter text.

## Risks And Follow-Ups

### Startup Ordering

Compose `depends_on` does not replace application-level dependency handling.
Healthchecks reduce race conditions, but the API should still fail clearly if
PostgreSQL or Redis are unavailable.

### Seed Safety

The seed currently resets the default admin password. This is acceptable for
first deployment, but the docs must not present seed as an upgrade command.

### Secret Management

`.env.deploy` is convenient for a template, but real deployments may move
secrets into platform-specific secret stores. This can be documented later.

### Direct API Debugging

The default Compose file should not publish the API port. If needed later, add a
small override file or document a temporary `ports` entry.

### Production Hardening

Future iterations may add backups, log rotation, resource limits, TLS examples,
image publishing, CI, and deployment environment overlays.
