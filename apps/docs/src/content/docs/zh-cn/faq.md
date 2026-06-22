---
title: FAQ
description: 关于 Common Admin 开发、生成 API、RBAC、部署和 AI 使用的常见问题。
draft: false
---

## Common Admin 是演示脚手架吗？

不是。它旨在作为生产级管理后台 starter。该模板保留身份认证、refresh-token 会话、RBAC、生成的 API 客户端、Prisma 持久化、迁移、测试、文档和质量门禁。

## 我应该编辑生成的 API 文件吗？

不应该。不要手动编辑：

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

修复后端 DTO、Swagger 元数据、OpenAPI 生成或 Orval 配置，然后运行：

```bash
pnpm api:generate
pnpm api:check
```

## 为什么前端使用生成的 API helpers？

生成的 helpers 让前端代码与后端契约保持一致。请使用生成的端点函数、hooks、schema 类型和 query key helpers，而不是手写客户端。

仅当 feature-local wrappers 增加真正的页面级组合时才可以接受，例如围绕生成的下载操作实现浏览器文件保存行为。

## 权限应该检查角色名称吗？

不应该。管理能力使用稳定的小写 `module.action` 权限代码。

示例：

```text
user.read
role.assign_permissions
file.download
setting.update
```

保持后端 guards、registry entries、seed behavior、route metadata、menu visibility 和 page actions 对齐。

## 为什么菜单项消失了？

菜单可见性来自 route metadata 和当前用户的权限。检查：

- 路由 `requiredPermissions`；
- 用户被分配的角色；
- 种子权限默认值；
- 后端 registry entries；
- 前端权限状态。

不要添加仅用于菜单的权限系统。

## 为什么我看到反复出现的 401 响应？

检查认证生命周期边界：

- 登录返回了 access token；
- refresh cookie 已设置；
- 浏览器请求包含 credentials；
- refresh cookie 安全性和 same-site 设置与部署匹配；
- refresh 成功并轮换 token；
- 用户拥有所需权限。

参见[认证与会话](./auth-and-sessions/)和[故障排查](./troubleshooting/)。

## 如何添加新的管理模块？

从[资源工作流](./resource-workflow/)开始，然后阅读：

- [CRUD 资源](./patterns/crud-resource/)
- [API 契约](./patterns/api-contract/)
- [RBAC](./patterns/rbac/)

先实现后端契约，重新生成 API 产物，使用生成的 helpers 构建前端，并运行相关门禁。

## 运行时设置和环境变量有什么区别？

运行时设置是管理员可以安全地从管理 UI 编辑的产品值。

环境变量是部署配置：secrets、database URLs、Redis URLs、cookie security、allowed origins、logging、storage roots 和 policy ceilings。

不要把 secrets 移入运行时设置。

## 运行时日志和审计日志有什么区别？

运行时日志帮助操作员调试服务行为。审计日志是围绕敏感管理操作进行问责的数据库记录。

两者都必须避免 secrets。

## AI 智能体可以读取所有仓库文件吗？

不可以。公开 AI 界面应使用稳定的公开文档和与任务相关的源文件。它们不得暴露内部过程笔记、环境文件、仓库元数据、依赖目录或生成的文档输出。

参见[公开 AI 界面](./public-ai-surfaces/)。

## 分支就绪前我应该运行什么？

对于实现分支：

```bash
pnpm quality
```

对于仅文档变更：

```bash
pnpm --filter docs build
```

对于 MCP 或公开 AI 界面变更：

```bash
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```
