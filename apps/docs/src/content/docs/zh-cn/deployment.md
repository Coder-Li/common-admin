---
title: 部署
description: 使用 Docker Compose 运行 Common Admin，并将部署配置与运行时设置分离。
draft: false
---

Common Admin 可以通过 Docker Compose 作为本地类生产栈运行。Compose 形态有意保持简单：

```text
admin container
  -> nginx serves the React build and proxies /api
api container
  -> NestJS production server
postgres container
redis container
api-uploads volume
```

默认只暴露 admin HTTP 端口。API、Postgres 和 Redis 服务会留在 Compose 网络内部，除非你明确修改部署方式。

## 配置文件

使用本地环境文件保存部署值，并让它们远离源码控制。

```bash
cp .env.deploy.example .env.deploy
```

启动栈之前，请检查这些类别：

- 数据库名称、用户和密码。
- JWT access-token secret。
- Refresh-cookie 名称、安全性、same-site 和可选 domain 设置。
- 允许的浏览器来源。
- Admin HTTP 端口。
- 文件上传大小和允许的 MIME 类型。
- 使用已发布镜像时的镜像 tag 或镜像名称。
- 日志级别和 pretty-print 行为。

不要在文档、issue、日志、截图或 AI prompt 中发布 `.env.deploy`、`.env*`、token、密码、refresh cookie 或数据库 dump。

## 首次部署

在服务器上构建镜像：

```bash
docker compose --env-file .env.deploy up -d postgres redis
pnpm deploy:init
docker compose --env-file .env.deploy up -d --build
```

使用已发布镜像而不是本地构建：

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml run --rm api pnpm --filter api deploy:init
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml up -d
```

`deploy:init` 会运行数据库迁移和种子数据。只在首次初始化空数据库时使用它。后续升级请使用仅迁移流程。

## 文档站点

当变更推送到 `main` 时，公共文档站点会通过 GitHub Actions 部署到 GitHub Pages。该 workflow 使用以下命令构建 Astro Starlight 应用：

```bash
pnpm --filter docs build
```

Pages artifact 是 `apps/docs/dist`。

Astro 配置当前面向默认 GitHub Pages 项目 URL，使用 `site: 'https://coder-li.github.io'` 和 `base: '/common-admin'`。如果以后从自定义域名（例如 `common-admin.dev`）提供文档，请在部署前移除项目页 `base`，并将 `site` 设置为自定义域名 origin，以便 canonical URL、sitemap 输出和生成的资源链接与公开地址匹配。

## 升级

当新版本包含 Prisma 迁移时，部署新的 API 镜像，运行生产迁移命令，然后启动栈：

```bash
pnpm deploy:migrate
docker compose --env-file .env.deploy up -d
```

使用已发布镜像：

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml run --rm api pnpm --filter api deploy:migrate
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml up -d
```

`deploy:migrate` 会运行 Prisma migrate deploy，不会再次写入默认种子数据。

## 仅部署配置

仅部署配置属于环境变量。例如：

- `DATABASE_URL`，或用于构造它的 Compose 变量。
- `REDIS_URL`。
- `JWT_ACCESS_TOKEN_SECRET`。
- `ALLOWED_ORIGINS`。
- Refresh-cookie 安全性和 domain 设置。
- 文件存储 driver 和本地存储根目录。
- 最大上传策略上限。
- 日志和服务身份设置。

可在运行时编辑的产品设置则属于 settings 模块。边界说明见[设置](./settings/)。

## Cookie 和 Origin 规则

生产配置会校验几条 auth 安全规则：

- `JWT_ACCESS_TOKEN_SECRET` 不能使用本地开发默认值。
- `ALLOWED_ORIGINS` 在生产中不能包含 `*`。
- `AUTH_REFRESH_COOKIE_SECURE` 在生产中必须显式配置。
- `AUTH_REFRESH_COOKIE_SAME_SITE=none` 要求 `AUTH_REFRESH_COOKIE_SECURE=true`。
- `AUTH_REFRESH_COOKIE_SECURE=false` 只适合 HTTP origins。

对于简单的 HTTP Compose 部署，`sameSite=lax` 和非安全 refresh cookie 可以接受。对于 HTTPS 部署，优先使用 secure cookies。

## 验证

部署后检查：

```text
Admin:   http://localhost:<ADMIN_HTTP_PORT>/
Health:  http://localhost:<ADMIN_HTTP_PORT>/api/health
Swagger: http://localhost:<ADMIN_HTTP_PORT>/api/docs
```

常用命令：

```bash
docker compose --env-file .env.deploy ps
docker compose --env-file .env.deploy logs api
docker compose --env-file .env.deploy logs admin
```

在认为 release branch 已就绪之前，运行：

```bash
pnpm quality
```
