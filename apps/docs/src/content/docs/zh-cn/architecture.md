---
title: 架构
description: Common Admin 中的核心架构和事实来源边界。
draft: false
---

Common Admin 将后端契约作为事实来源。

```text
Prisma schema
  -> NestJS service / mapper / DTO / controller metadata
  -> apps/api/openapi.json
  -> Orval
  -> apps/admin/src/generated/api/
  -> React Query hooks / endpoint functions / schema types
  -> Admin feature pages
```

## 主要应用

- `apps/api`：NestJS API、Prisma、身份认证、RBAC、OpenAPI 生成。
- `apps/admin`：Vite React 管理应用、路由元数据、生成 API 的使用。
- `apps/docs`：面向人类和 AI 智能体的公开文档。

## 事实来源

判断某项变更是否符合 starter 架构时，使用这些文件和目录：

```text
apps/api/prisma/schema.prisma
apps/api/src/openapi.ts
apps/api/scripts/generate-openapi.ts
apps/admin/orval.config.ts
apps/admin/src/app/api-mutator.ts
apps/admin/src/app/api-refresh-coordinator.ts
apps/admin/src/routes/admin-route-registry.tsx
apps/admin/src/routes/route-meta.ts
apps/api/src/permission/permission.registry.ts
apps/api/prisma/seed.ts
apps/docs/src/content/docs/
```

模式文档是稳定工作流的公开摘要：

```text
apps/docs/src/content/docs/patterns/api-contract.md
apps/docs/src/content/docs/patterns/crud-resource.md
apps/docs/src/content/docs/patterns/rbac.md
```

运营主题文档扩展跨领域行为：

```text
apps/docs/src/content/docs/deployment.md
apps/docs/src/content/docs/upgrade-guide.md
apps/docs/src/content/docs/release-checklist.md
apps/docs/src/content/docs/faq.md
apps/docs/src/content/docs/auth-and-sessions.md
apps/docs/src/content/docs/session-management.md
apps/docs/src/content/docs/errors-and-logging.md
apps/docs/src/content/docs/diagnostics-and-health.md
apps/docs/src/content/docs/audit-logs.md
apps/docs/src/content/docs/settings.md
apps/docs/src/content/docs/file-management.md
apps/docs/src/content/docs/quality-gates.md
apps/docs/src/content/docs/troubleshooting.md
apps/docs/src/content/docs/resource-workflow.md
apps/docs/src/content/docs/public-ai-surfaces.md
apps/docs/src/content/docs/users-roles-permissions.md
apps/docs/src/content/docs/organization-structure.md
apps/docs/src/content/docs/data-permissions.md
apps/docs/src/content/docs/dictionaries.md
```

## 重要规则

- 不要手动编辑 `apps/api/openapi.json`。
- 不要手动编辑 `apps/admin/src/generated/api/`。
- 后端 DTO 和 Swagger 元数据是 API 契约来源。
- 前端功能应使用生成的端点函数、hooks、schema 类型和 query key helpers。
- 权限代码应在后端 guards、前端路由、菜单和页面操作之间保持一致。

生成产物会被提交，以便审查者看到契约漂移。它们仍然是只读的实现输出。如果生成的名称、schema、路径或 hooks 看起来不对，请修复后端 DTO、Swagger 元数据、OpenAPI 生成 helper 或 Orval 配置，然后重新生成。

生成产物：

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

## 权限流

```text
permission registry
  -> permission seed
  -> backend @Permissions() guard
  -> frontend route/menu metadata
  -> frontend page action gates
```

使用稳定的 `module.action` 权限代码，例如 `user.read`、`role.update` 或 `file.delete`。

参见[用户、角色与权限](./users-roles-permissions/)和 [RBAC](./patterns/rbac/)。

## 组织与数据范围

部门和职位为用户分配和未来业务模块提供组织结构。RBAC 判断某个操作是否允许后，数据权限会应用按部门限定的可见性规则。

参见[组织结构](./organization-structure/)和[数据权限](./data-permissions/)。

## 字典

字典为产品功能提供管理员维护的选项列表。管理端点受权限保护，而选项端点为表单和过滤器提供安全的生成 API 访问。

参见[字典](./dictionaries/)。

## 认证与会话

管理应用使用 access tokens 发起 API 请求，并通过 refresh-token 会话行为保持连续性。API 认证模块、refresh cookie 设置、前端 API mutator 和 refresh coordinator 是同一个生命周期。对登录、刷新、退出、密码变更、401 重放、cookie 或 token 清理的改动，应作为会话行为测试，而不是孤立的一行编辑。

参见[认证与会话](./auth-and-sessions/)。

## 会话管理

管理员会话管理通过受保护端点列出用户会话并撤销活跃会话。它与登录/刷新行为分离，并且应审计撤销操作。

参见[会话管理](./session-management/)。

## 错误与日志

API 错误应流经通用异常映射和 filter 层。校验、guard 和应用错误应返回带请求 ID 的一致错误信封。运行时日志是面向操作员和诊断的结构化 stdout/stderr 日志；它们与审计日志分离。

添加新的类密钥字段时，确认日志脱敏仍然保护它们。

参见[错误与日志](./errors-and-logging/)。

## 诊断与健康检查

健康检查验证运行时可达性。诊断端点由部署配置控制，用于验证全局错误和日志管线。

参见[诊断与健康检查](./diagnostics-and-health/)。

## 审计日志

审计日志是敏感管理操作的数据库记录。它们回答谁改了什么，而不是服务器是否健康。审计 payload 应经过清理，以免存储密码、tokens、secrets 和私有元数据。

参见[审计日志](./audit-logs/)。

## 设置

运行时可编辑的产品设置应放在 settings 模块之后。仅部署配置仍然留在环境变量中。不要为了让管理员 UI 可编辑而把 secrets 移入运行时设置。

参见[设置](./settings/)。

## 文件

文件管理使用受权限保护的上传、下载、更新和删除端点，配合 multipart Swagger 元数据和生成的前端 API helpers。上传策略仅能在部署定义的限制范围内运行时编辑。

参见[文件管理](./file-management/)。

## 部署

Docker Compose 是类生产本地部署形态。将部署 secrets 保存在本地环境文件中，升级使用仅迁移命令，并避免暴露 Postgres、Redis 或 API 内部细节，除非你的部署明确需要这样做。

参见[部署](./deployment/)。

## 升级与发布

升级应考虑迁移、生成 API 漂移、权限、部署配置和回滚计划。发布就绪度应包括契约、安全、文档、AI 界面和质量检查。

参见[升级指南](./upgrade-guide/)和[发布检查清单](./release-checklist/)。

## 质量门禁

根级就绪门禁是：

```bash
pnpm quality
```

它展开为：

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

迭代时运行更窄的命令，但在将功能分支视为就绪前使用更广的门禁。

参见[质量门禁](./quality-gates/)。

## 资源工作流

新的 API 支撑管理模块应遵循后端优先的契约流，重新生成生成 API 产物，使用生成的前端 helpers，对齐 RBAC，并添加聚焦测试。

参见[资源工作流](./resource-workflow/)。

## 公开 AI 界面

公开文档、llms 文件、MCP 工具、反馈 helpers、issue templates 和 CI 检查会一起维护。保持它们稳定，并避免暴露内部文件或生成输出。

参见[公开 AI 界面](./public-ai-surfaces/)。

## 故障排查

当设置、认证、生成 API 漂移、迁移、权限、上传或文档构建失败时，先从窄范围故障排查检查开始，再考虑改变架构。

参见[故障排查](./troubleshooting/)。

## FAQ

FAQ 提供关于生成 API、RBAC、设置、日志、AI 访问和就绪命令的简短答案。

参见 [FAQ](./faq/)。
