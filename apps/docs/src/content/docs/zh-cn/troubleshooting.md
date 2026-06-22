---
title: 故障排查
description: 常见的设置、认证、API 生成、迁移、上传和文档站点失败。
draft: false
---

当本地栈、生成 API 流程或公开文档构建未按预期工作时，使用本页。

从能够证明或否定问题的最小检查开始，然后逐步向外扩展。避免为了压制症状而修补生成产物或改变架构边界。

## 本地栈

如果 API 无法启动：

- 确认可通过 `DATABASE_URL` 访问 Postgres。
- 确认可通过 `REDIS_URL` 访问 Redis。
- 确认 `apps/api/.env` 存在并包含本地开发值。
- 启动应用前运行 Prisma 迁移。

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm dev:api
```

如果管理应用无法调用 API：

- 检查 `VITE_API_BASE_URL`。
- 检查 API CORS `ALLOWED_ORIGINS`。
- 确认 API 挂载在 `/api`。
- 查找类似 `/api/api/...` 的重复路径。

## 登录与刷新

反复出现 `401` 响应通常意味着以下边界之一损坏：

- access token 没有存入前端 auth store；
- refresh cookie 没有设置或发送；
- refresh cookie 安全性或 same-site 设置与部署不匹配；
- refresh 失败，前端正确变为匿名状态；
- 某个端点由用户不具备的权限保护。

聚焦检查：

```bash
pnpm --filter api test -- auth
pnpm --filter admin test -- api-mutator
pnpm --filter admin test -- api-refresh-coordinator
```

参见[认证与会话](./auth-and-sessions/)。

## API 漂移

如果 `pnpm api:check` 失败，检查生成产物漂移：

```bash
git diff -- apps/api/openapi.json apps/admin/src/generated/api
```

常见原因：

- 缺失或重命名 Swagger operation id；
- 缺失 DTO Swagger 元数据；
- 生成路径包含 `/api`；
- multipart upload 元数据不完整；
- binary download 元数据不完整；
- 前端代码期望旧的生成名称。

不要手动编辑生成文件。修复后端 DTO、controller metadata、OpenAPI 生成或 Orval 配置，然后运行：

```bash
pnpm api:generate
pnpm api:check
```

参见 [API 契约](./patterns/api-contract/)。

## 迁移与种子

本地使用开发迁移：

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

在类生产环境中使用部署迁移：

```bash
pnpm deploy:migrate
```

仅在首次初始化空数据库时使用 `deploy:init`。它会运行迁移和种子数据。

如果某个迁移可能删除或重写数据，请先停下来规划迁移，再对共享或生产数据运行它。

## 权限

如果页面从菜单中消失：

- 确认 route metadata 拥有预期的 `requiredPermissions`；
- 确认当前用户拥有该 permission code；
- 确认后端 registry 包含该 permission；
- 确认 seed behavior 已将它授予预期默认角色；
- 确认前端没有检查角色名称。

如果直接访问 URL 返回 `/403`，说明 route guard 正常工作。请检查权限分配，而不是绕过 guard。

参见 [RBAC](./patterns/rbac/)。

## 上传与下载

如果上传失败：

- 检查 `FILE_MAX_SIZE_MB`；
- 检查 `FILE_ALLOWED_MIME_TYPES`；
- 检查运行时上传设置；
- 确认请求是 `multipart/form-data`；
- 确认正在使用生成的上传 helpers。

如果下载未保存为文件：

- 确认端点 Swagger metadata 描述了 binary response；
- 确认使用了生成的前端函数；
- 确认浏览器文件保存 wrapper 处理了 Blob 和文件名。

参见[文件管理](./file-management/)。

## 文档构建

对于仅文档变更：

```bash
pnpm --filter docs build
```

如果文档构建报告重复 content ids，移除生成的 Astro 内容缓存并重新运行。docs package 已经在 `prebuild` 中这样做。

不要将生成的文档输出作为公开文档、llms 文件、MCP 工具或技能的源材料。

## 报告

报告问题时，请包含：

- 命令或页面；
- 预期结果；
- 实际结果；
- 相关错误输出；
- API 失败的 request id；
- 问题出现前阅读过的文档；
- 验证命令和结果。

不要包含 secrets、tokens、`.env` 内容、refresh cookies、生产密码、私有客户数据或数据库 dumps。
