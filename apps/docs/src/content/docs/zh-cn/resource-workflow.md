---
title: 资源工作流
description: 添加新的 API 支撑管理资源时使用的稳定公开工作流。
draft: false
---

当添加标准资源时使用此工作流，例如面向用户的表格、表单或管理端 CRUD 模块。

## 先阅读

实现前，请阅读：

- [架构](./architecture/)
- [API 契约](./patterns/api-contract/)
- [CRUD 资源](./patterns/crud-resource/)
- [RBAC](./patterns/rbac/)
- 当资源涉及身份或访问控制时，阅读[用户、角色与权限](./users-roles-permissions/)
- [质量门禁](./quality-gates/)

## 建议顺序

1. 确认资源名称、字段、筛选器、排序字段和敏感数据。
2. 在需要时添加或更新持久化。
3. 添加后端 DTO、mapper、服务逻辑、控制器路由和模块接线。
4. 添加显式 Swagger operation ids 和响应元数据。
5. 添加或更新权限注册表条目和守卫。
6. 重新生成 OpenAPI 和生成的管理端客户端。
7. 使用生成的 API helper 构建前端页面。
8. 添加路由和菜单元数据。
9. 添加聚焦的后端和前端测试。
10. 运行相关验证命令。

## 最重要的规则

- 后端 DTO 和 Swagger 元数据是 API 契约来源。
- 生成产物是只读实现输出。
- 使用稳定的小写 `module.action` 权限。
- 保持前端路由和操作门禁与后端守卫一致。
- 使用生成的 endpoint functions、hooks、schema types 和 query keys。
- 保持审计、设置和文件行为位于各自边界内。

## 常见变体

对于认证、会话、文件、设置、字典或组织数据，复用同一模式，但保留专用文档中的模块特定边界。

对于按数据范围限定的资源，在服务层添加后端可见性检查，而不是依赖菜单可见性或本地筛选。

## 验证

最低限度的有用检查：

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

当认证、权限、请求流或生成端点行为发生变化时，运行 API e2e 测试：

```bash
pnpm --filter api test:e2e
```
