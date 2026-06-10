# Docker Compose Deployment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Docker Compose deployment path that builds and runs PostgreSQL, Redis, the NestJS API, and the Vite admin frontend served by Nginx.

**Architecture:** Keep local development unchanged and add a production-oriented Compose stack. The API runs as a NestJS production container with Prisma migration/seed command support, while the admin app is built into static files and served by Nginx, which is the only externally exposed service and reverse proxies `/api` to the API container.

**Tech Stack:** Docker Compose, Docker multi-stage builds, pnpm workspaces, NestJS, Prisma, PostgreSQL 16, Redis 7 Alpine, Vite, React, Nginx.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-10-docker-compose-deployment-design.md`
- Root scripts: `package.json`
- API scripts and Prisma seed command: `apps/api/package.json`
- API env validation: `apps/api/src/config/env.config.ts`
- API health endpoint: `apps/api/src/health/health.controller.ts`
- Admin Vite config: `apps/admin/vite.config.ts`
- Root deployment docs: `README.md`

## Implementation Decisions

- Use `.env.deploy.example` for deployment variables and keep `.env.deploy` ignored.
- Update `.gitignore` so `.env.deploy.example` is committed even though `.env.*` is ignored.
- Keep HTTP deployment supported by default. Remove the production-only hard failure that requires `AUTH_REFRESH_COOKIE_SECURE=true`.
- Choose the API seed runtime strategy that keeps `ts-node`, TypeScript source files, Prisma schema, and migrations available in the final API image. This is larger than a fully pruned runtime image, but it keeps `prisma db seed` working without changing the existing seed pipeline.
- Use a Node-based API healthcheck command so the API image does not need curl or wget.
- Let root `deploy:init` and `deploy:migrate` build the API image before running one-off Compose commands. The later deployment flow may build `api` twice; keep this redundancy for safety and simplicity.

## File Structure

### Create

- `.dockerignore`: exclude local dependencies, build output, logs, local runtime data, and real env files from Docker build contexts.
- `.env.deploy.example`: commented deployment environment template.
- `docker-compose.yml`: deployment stack for postgres, redis, api, and admin.
- `apps/api/Dockerfile`: API production image with Prisma migrate/seed runtime support.
- `apps/admin/Dockerfile`: admin static Nginx image using a Node builder stage.
- `apps/admin/nginx.conf`: Nginx static serving and `/api` reverse proxy config.

### Modify

- `.gitignore`: allow `.env.deploy.example` to be committed.
- `package.json`: add root `deploy:init` and `deploy:migrate` scripts.
- `apps/api/package.json`: add `db:migrate:deploy`, `deploy:init`, and `deploy:migrate` scripts.
- `apps/api/src/config/env.config.ts`: allow explicit HTTP refresh-cookie deployment in production.
- `apps/api/src/config/env.config.spec.ts`: cover explicit HTTP cookie deployment in production env validation.
- `README.md`: document Docker Compose deployment flow.

### Verify

- `docker compose --env-file .env.deploy config`
- `docker compose --env-file .env.deploy build api admin`
- `docker compose --env-file .env.deploy up -d postgres redis`
- `pnpm deploy:init`
- `docker compose --env-file .env.deploy up -d --build`
- `curl http://localhost:8080/api/health`
- Browser: `http://localhost:8080/` and `http://localhost:8080/api/docs`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Chunk 1: Deployment Configuration And Scripts

### Task 1: Add Deployment Env Template And Git Ignore Rule

**Files:**
- Create: `.env.deploy.example`
- Modify: `.gitignore`

- [ ] **Step 1: Inspect current environment ignore rules**

Run:

```bash
sed -n '1,80p' .gitignore
```

Expected: `.env.*` is ignored and only `.env.example` is allowed.

- [ ] **Step 2: Add `.env.deploy.example` allow rule**

Modify `.gitignore` so the environment section is:

```gitignore
# Environment
.env
.env.*
!.env.example
!.env.deploy.example
```

- [ ] **Step 3: Create deployment env example**

Create `.env.deploy.example`:

```dotenv
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

- [ ] **Step 4: Verify the example file is visible to git**

Run:

```bash
git check-ignore -v .env.deploy.example || true
git status --short .env.deploy.example .gitignore
```

Expected: `git check-ignore` prints nothing, and `git status` shows `.env.deploy.example` as untracked or staged plus `.gitignore` modified.

### Task 2: Add Deployment Scripts

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Add API deployment scripts**

Modify `apps/api/package.json` scripts:

```json
{
  "scripts": {
    "db:migrate:deploy": "prisma migrate deploy",
    "deploy:init": "pnpm db:migrate:deploy && pnpm db:seed",
    "deploy:migrate": "pnpm db:migrate:deploy"
  }
}
```

Keep all existing scripts. Add the new entries near existing `db:*` scripts.

- [ ] **Step 2: Add root deployment scripts**

Modify root `package.json` scripts:

```json
{
  "scripts": {
    "deploy:init": "docker compose --env-file .env.deploy build api && docker compose --env-file .env.deploy run --rm api pnpm --filter api deploy:init",
    "deploy:migrate": "docker compose --env-file .env.deploy build api && docker compose --env-file .env.deploy run --rm api pnpm --filter api deploy:migrate"
  }
}
```

Keep all existing scripts.

- [ ] **Step 3: Validate package JSON files**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('apps/api/package.json','utf8'))"
```

Expected: command exits with code 0.

- [ ] **Step 4: Verify scripts are registered**

Run:

```bash
pnpm run | rg "deploy:init|deploy:migrate"
pnpm --filter api run | rg "db:migrate:deploy|deploy:init|deploy:migrate"
```

Expected: both root and API deployment scripts are listed.

### Task 3: Allow Explicit HTTP Cookie Deployment

**Files:**
- Modify: `apps/api/src/config/env.config.ts`
- Test: `apps/api/src/config/env.config.spec.ts`

- [ ] **Step 1: Add or update env validation tests**

Inspect existing tests:

```bash
sed -n '1,220p' apps/api/src/config/env.config.spec.ts
```

Update tests so they assert:

```ts
it('allows insecure refresh cookies in production when explicitly configured for HTTP deployments', () => {
  expect(() =>
    validateEnv({
      NODE_ENV: 'production',
      JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
      AUTH_REFRESH_COOKIE_SECURE: 'false',
      ALLOWED_ORIGINS: 'http://localhost:8080',
    }),
  ).not.toThrow()
})
```

Keep the existing test that rejects wildcard `ALLOWED_ORIGINS` in production.
Remove or update any test that expects production to reject
`AUTH_REFRESH_COOKIE_SECURE=false`.

- [ ] **Step 2: Run env config tests and verify failure**

Run:

```bash
pnpm --filter api test -- config/env.config.spec.ts
```

Expected: FAIL because production still rejects insecure refresh cookies.

- [ ] **Step 3: Update env validation**

In `apps/api/src/config/env.config.ts`, remove this production hard failure:

```ts
if (env.NODE_ENV === 'production' && !env.AUTH_REFRESH_COOKIE_SECURE) {
  throw new Error('AUTH_REFRESH_COOKIE_SECURE must be true in production');
}
```

Keep the production validation that rejects the default JWT secret and wildcard
origins.

- [ ] **Step 4: Run env config tests and verify pass**

Run:

```bash
pnpm --filter api test -- config/env.config.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Chunk 1**

Run:

```bash
git add .gitignore .env.deploy.example package.json apps/api/package.json apps/api/src/config/env.config.ts apps/api/src/config/env.config.spec.ts
git commit -m "chore: add deployment env and scripts"
```

Expected: commit succeeds.

## Chunk 2: Docker Images And Compose Stack

### Task 4: Add Docker Build Ignore File

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

Create `.dockerignore`:

```dockerignore
.git
.github

node_modules
**/node_modules
.pnpm-store

dist
build
coverage
**/dist
**/coverage

.env
.env.*
!.env.deploy.example
!.env.example

storage
uploads
logs
*.log

.DS_Store
.idea
.vscode
```

- [ ] **Step 2: Verify Docker build context exclusions**

Run:

```bash
test -f .dockerignore
rg -n "node_modules|\\.env\\.\\*|storage|uploads" .dockerignore
```

Expected: all key exclusions are present.

### Task 5: Add API Dockerfile

**Files:**
- Create: `apps/api/Dockerfile`

- [ ] **Step 1: Create API Dockerfile**

Create `apps/api/Dockerfile`:

```dockerfile
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter api db:generate
RUN pnpm --filter api build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
EXPOSE 13001
CMD ["pnpm", "--filter", "api", "start:prod"]
```

This intentionally keeps the installed workspace dependencies and TypeScript
source in the final image so `pnpm --filter api deploy:init` can run the
existing `prisma db seed` command through `ts-node`.

- [ ] **Step 2: Build the API image**

Run:

```bash
docker build -f apps/api/Dockerfile -t common-admin-api:test .
```

Expected: image builds successfully.

- [ ] **Step 3: Verify API image has deployment commands**

Run:

```bash
docker run --rm common-admin-api:test pnpm --filter api run | rg "deploy:init|deploy:migrate|db:migrate:deploy"
docker run --rm common-admin-api:test test -f apps/api/prisma/schema.prisma
docker run --rm common-admin-api:test test -d apps/api/prisma/migrations
```

Expected: scripts are listed and Prisma files exist.

### Task 6: Add Admin Dockerfile And Nginx Config

**Files:**
- Create: `apps/admin/Dockerfile`
- Create: `apps/admin/nginx.conf`

- [ ] **Step 1: Create Nginx config**

Create `apps/admin/nginx.conf`:

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://api:13001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location = /api {
    return 301 /api/;
  }

  location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location = /index.html {
    add_header Cache-Control "no-store";
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 2: Create admin Dockerfile**

Create `apps/admin/Dockerfile`:

```dockerfile
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY . .
RUN pnpm --filter admin build

FROM nginx:1.27-alpine AS runner
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 3: Build the admin image**

Run:

```bash
docker build -f apps/admin/Dockerfile -t common-admin-admin:test .
```

Expected: image builds successfully.

- [ ] **Step 4: Verify built static files exist**

Run:

```bash
docker run --rm common-admin-admin:test test -f /usr/share/nginx/html/index.html
docker run --rm common-admin-admin:test nginx -t
```

Expected: both commands pass.

### Task 7: Add Docker Compose Stack

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Compose file**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 13001
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
      JWT_ACCESS_TOKEN_SECRET: ${JWT_ACCESS_TOKEN_SECRET}
      AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS: ${AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS}
      AUTH_REFRESH_COOKIE_NAME: ${AUTH_REFRESH_COOKIE_NAME}
      AUTH_REFRESH_COOKIE_SECURE: ${AUTH_REFRESH_COOKIE_SECURE}
      AUTH_REFRESH_COOKIE_SAME_SITE: ${AUTH_REFRESH_COOKIE_SAME_SITE}
      AUTH_REFRESH_COOKIE_DOMAIN: ${AUTH_REFRESH_COOKIE_DOMAIN}
      FILE_STORAGE_DRIVER: local
      LOCAL_STORAGE_ROOT: /app/storage/uploads
      FILE_MAX_SIZE_MB: ${FILE_MAX_SIZE_MB}
      FILE_ALLOWED_MIME_TYPES: ${FILE_ALLOWED_MIME_TYPES}
    volumes:
      - api-uploads:/app/storage/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "require('node:http').get('http://127.0.0.1:13001/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))",
        ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
      args:
        VITE_API_BASE_URL: /api
    restart: unless-stopped
    ports:
      - "${ADMIN_HTTP_PORT:-8080}:80"
    depends_on:
      api:
        condition: service_healthy

volumes:
  postgres-data:
  redis-data:
  api-uploads:
```

- [ ] **Step 2: Validate Compose config**

Run:

```bash
cp .env.deploy.example .env.deploy
docker compose --env-file .env.deploy config
```

Expected: config renders without errors.

- [ ] **Step 3: Verify only admin publishes a port**

Run:

```bash
docker compose --env-file .env.deploy config | rg -n "ports:|published|target"
```

Expected: only the `admin` service has a published port mapping to target `80`.

- [ ] **Step 4: Commit Chunk 2**

Run:

```bash
git add .dockerignore docker-compose.yml apps/api/Dockerfile apps/admin/Dockerfile apps/admin/nginx.conf
git commit -m "build: add docker compose deployment stack"
```

Expected: commit succeeds.

## Chunk 3: Documentation And End-To-End Verification

### Task 8: Document Deployment Flow

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README deployment section**

Add a `## Docker Compose 部署` section after the local development section:

````markdown
## Docker Compose 部署

本地开发流程仍然使用 `pnpm dev`。Docker Compose 用作部署运行入口，默认只暴露 Nginx 端口，API、Postgres 和 Redis 只在 Compose 网络内访问。

### 首次部署

```bash
cp .env.deploy.example .env.deploy
# 修改 .env.deploy 中的密码、JWT secret、域名和端口配置

docker compose --env-file .env.deploy up -d postgres redis
pnpm deploy:init
docker compose --env-file .env.deploy up -d --build
```

访问：

```text
Admin:   http://localhost:8080/
Health:  http://localhost:8080/api/health
Swagger: http://localhost:8080/api/docs
```

默认管理员账号：

```text
admin@example.com
Admin123!
```

### 后续升级数据库

如果新版本包含 Prisma migration，先构建新镜像，再执行迁移，最后启动或重建服务：

```bash
docker compose --env-file .env.deploy build api admin
pnpm deploy:migrate
docker compose --env-file .env.deploy up -d
```

`deploy:init` 会执行 seed，并会把默认管理员密码重置为 `Admin123!`。它只应该用于首次空库初始化；后续升级使用 `deploy:migrate`。

### HTTP 与 HTTPS

默认 Compose 部署支持 HTTP，所以 `.env.deploy.example` 使用：

```text
AUTH_REFRESH_COOKIE_SECURE=false
AUTH_REFRESH_COOKIE_SAME_SITE=lax
```

如果你在 HTTPS 后面部署，建议改为：

```text
AUTH_REFRESH_COOKIE_SECURE=true
```

如果未来前端和 API 分不同站点部署，再根据实际域名调整 `AUTH_REFRESH_COOKIE_SAME_SITE` 和 `AUTH_REFRESH_COOKIE_DOMAIN`。
````

Keep the existing local development section intact.

- [ ] **Step 2: Check README commands match scripts**

Run:

```bash
rg -n "deploy:init|deploy:migrate|AUTH_REFRESH_COOKIE_SECURE|Docker Compose" README.md package.json .env.deploy.example
```

Expected: README, package scripts, and env example use the same command names and cookie variable names.

### Task 9: Run Static Quality Checks

**Files:**
- All changed files

- [ ] **Step 1: Validate JSON and Compose syntax**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('apps/api/package.json','utf8'))"
docker compose --env-file .env.deploy config
```

Expected: both commands pass.

- [ ] **Step 2: Run API env config test**

Run:

```bash
pnpm --filter api test -- config/env.config.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run workspace checks**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: PASS. If an unrelated pre-existing failure appears, capture the failing command and error in the implementation notes before continuing.

### Task 10: Run Docker Deployment Smoke Test

**Files:**
- Runtime verification only

- [ ] **Step 1: Build deployment images**

Run:

```bash
cp .env.deploy.example .env.deploy
docker compose --env-file .env.deploy build api admin
```

Expected: both images build successfully.

- [ ] **Step 2: Start dependencies**

Run:

```bash
docker compose --env-file .env.deploy up -d postgres redis
docker compose --env-file .env.deploy ps
```

Expected: `postgres` and `redis` are running and healthy.

- [ ] **Step 3: Initialize database**

Run:

```bash
pnpm deploy:init
```

Expected: Prisma migrations apply successfully and seed completes.

- [ ] **Step 4: Start full stack**

Run:

```bash
docker compose --env-file .env.deploy up -d --build
docker compose --env-file .env.deploy ps
```

Expected: `postgres`, `redis`, `api`, and `admin` are running. `admin` publishes `${ADMIN_HTTP_PORT}:80`; API, PostgreSQL, and Redis do not publish host ports.

- [ ] **Step 5: Verify public endpoints**

Run:

```bash
curl -fsS http://localhost:8080/api/health
curl -fsSI http://localhost:8080/
curl -fsSI http://localhost:8080/api/docs
```

Expected:

- `/api/health` returns JSON containing `"status":"ok"`.
- `/` returns HTTP 200.
- `/api/docs` returns HTTP 200 or a redirect that resolves to Swagger UI.

- [ ] **Step 6: Verify database migration command**

Run:

```bash
pnpm deploy:migrate
```

Expected: Prisma reports no pending migrations or applies pending migrations successfully. It must not run seed.

- [ ] **Step 7: Clean up local smoke-test containers if desired**

Run:

```bash
docker compose --env-file .env.deploy down
```

Expected: containers stop. Named volumes remain unless explicitly removed, preserving local smoke-test data.

### Task 11: Final Review And Commit

**Files:**
- All changed files

- [ ] **Step 1: Review changed files**

Run:

```bash
git status --short
git diff --stat
git diff -- . ':!docs/superpowers/plans/2026-06-10-docker-compose-deployment.md'
```

Expected: only planned deployment files and docs changed. Do not revert unrelated user changes if present.

- [ ] **Step 2: Commit final implementation**

Run:

```bash
git add .dockerignore .env.deploy.example .gitignore docker-compose.yml README.md package.json apps/api/package.json apps/api/src/config/env.config.ts apps/api/src/config/env.config.spec.ts apps/api/Dockerfile apps/admin/Dockerfile apps/admin/nginx.conf
git commit -m "feat: add docker compose deployment"
```

Expected: commit succeeds.

- [ ] **Step 3: Record verification evidence**

In the final response, report:

- Docker Compose config validation result.
- Docker image build result.
- `pnpm deploy:init` result.
- Endpoint smoke-test result.
- `pnpm deploy:migrate` result.
- `pnpm lint`, `pnpm test`, and `pnpm build` results, or any pre-existing failures with exact command output.
