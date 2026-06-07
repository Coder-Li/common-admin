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
API:      http://localhost:3001/api
Admin:    http://localhost:5173
Swagger:  http://localhost:3001/api/docs
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

## 常用命令

```bash
pnpm build
pnpm test
pnpm lint
pnpm format
```
