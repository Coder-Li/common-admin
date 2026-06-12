# Common Admin

一个 pnpm monorepo 通用管理后台模板，面向前后端分离的本地开发工作流。

## 项目结构

```text
.
├── apps/
│   ├── admin/   # 管理后台前端应用
│   └── api/     # 后端 API 服务
├── packages/    # 共享包、工具库和类型定义
└── pnpm-workspace.yaml
```

## 本地开发

项目使用 pnpm workspace 管理依赖。根目录脚本会转发到 `apps/admin` 和 `apps/api`：

```bash
pnpm install
pnpm dev
pnpm dev:admin
pnpm dev:api
```

本地运行依赖 Postgres 和 Redis。推荐直接使用本机或团队约定的本地服务配置；Docker 可以作为补充方案，但不是这个模板的主要开发入口。

默认本地连接：

```text
Postgres: postgresql://postgres:postgres@localhost:5432/common_admin
Redis:    redis://localhost:6379
API:      http://localhost:13001/api
Admin:    http://localhost:15173
Swagger:  http://localhost:13001/api/docs
```

初始化 API 环境：

```bash
cp apps/api/.env.example apps/api/.env
createdb common_admin
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

默认管理员账号：

```text
admin@example.com
Admin123!
```

## Docker Compose 部署

本地开发流程仍然使用 `pnpm dev`。Docker Compose 用作部署运行入口，默认只暴露 Nginx 端口，API、Postgres 和 Redis 只在 Compose 网络内访问。

部署数据库密码应使用 URL-safe 字符，避免 `@`、`:`、`/`、`#`、`?` 等字符，除非后续调整 Compose 中的数据库 URL 构造方式。

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

如果修改 `ADMIN_HTTP_PORT`，访问端口也随之变化。

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

如果未来前端和 API 分不同站点部署，再根据实际域名调整 `AUTH_REFRESH_COOKIE_SAME_SITE` 和 `AUTH_REFRESH_COOKIE_DOMAIN`；`AUTH_REFRESH_COOKIE_SAME_SITE=none` 必须同时使用 `AUTH_REFRESH_COOKIE_SECURE=true`。

### 本地日志观测

本地部署可以叠加 Loki、Grafana 和 Alloy 观测覆盖层，用于查看 API stdout/stderr JSON 日志：

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.observability.yml up
```

Grafana 默认地址是 `http://localhost:${GRAFANA_HTTP_PORT:-3000}`，数据源名称是 `Loki`，预置仪表盘是 `Common Admin API Logs`。

生产环境不要求使用这套覆盖层；可以接入任意 stdout/stderr 日志采集器。错误信封、请求 ID、运行日志字段、LogQL 示例和诊断端点注意事项见 [docs/patterns/admin-error-logging-observability-guide.md](docs/patterns/admin-error-logging-observability-guide.md)。

## 常用命令

```bash
pnpm build
pnpm test
pnpm lint
pnpm format
```

## API 契约生成

后端 DTO 和 Swagger metadata 是 API 契约来源，前端 API 类型、endpoint
functions、React Query hooks 和 query keys 由 OpenAPI + Orval 生成。新增或修改
API 后参考 `docs/patterns/admin-api-contract-generation-guide.md`。

```bash
pnpm api:generate
pnpm api:check
```
