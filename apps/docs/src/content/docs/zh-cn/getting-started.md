---
title: 入门
description: 在本地运行 Common Admin，并理解第一批开发命令。
draft: false
---

Common Admin 是一个 pnpm workspace，包含两个主要应用：

```text
apps/api      NestJS API, Prisma, auth, RBAC, OpenAPI
apps/admin    Vite React admin app
apps/docs     Public documentation site
```

## 要求

- Node.js 和仓库配置的 pnpm 版本。
- PostgreSQL，以及一个可写的本地数据库。
- Redis，用于会话和缓存相关的运行时行为。
- 能运行根目录 `pnpm` workspace scripts 的 shell。

默认本地服务值为：

```text
Postgres: postgresql://postgres:postgres@localhost:5432/common_admin
Redis:    redis://localhost:6379
```

你可以使用本地服务、团队管理的开发数据库，或 Docker 管理的服务。保持 `.env` 值仅在本地使用，不要提交它们。

## 安装

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
createdb common_admin
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm dev
```

启动应用前，检查 `apps/api/.env`：

- `DATABASE_URL` 指向预期的 Postgres 数据库。
- Redis 连接设置指向预期的 Redis 实例。
- 认证密钥和 token/session 设置适合本地开发。
- CORS/origin 值允许管理应用 URL。
- 如果你测试的功能使用文件，请检查上传和文件限制。

默认本地 URL：

```text
API:      http://localhost:13001/api
Admin:    http://localhost:15173
Swagger:  http://localhost:13001/api/docs
Docs:     http://localhost:15174
```

默认管理员：

```text
admin@example.com
Admin123!
```

## 首次验证

`pnpm dev` 启动后，在进行功能变更前先验证本地栈：

1. 打开管理应用，并使用默认管理员登录。
2. 打开 Swagger，确认 API 文档可以渲染。
3. 访问一个已有的管理列表页，例如用户、角色、字典、文件、审计日志或设置。
4. 确认浏览器没有反复出现 `401`、CORS 或网络错误。

## 质量门禁

发布变更前，运行：

```bash
pnpm quality
```

质量门禁会重新生成 API 客户端、检查生成产物漂移、执行 lint、测试、API e2e 测试，并构建 workspace。

调试或迭代时，按以下顺序运行单项命令：

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

定位失败时使用包级命令，然后在声明分支就绪前回到更广的门禁。
