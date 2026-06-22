---
title: 用户、角色与权限
description: Common Admin 中用户、角色、权限和会话管理的边界。
draft: false
---

Common Admin 将身份、角色分配、权限定义和活动会话分离开来。

当你修改用户、角色、权限注册表行为、权限分配或会话管理时，请使用本页。

## 模块

后端模块：

```text
apps/api/src/user/
apps/api/src/role/
apps/api/src/permission/
apps/api/src/user-session/
apps/api/src/auth/
apps/api/src/data-permission/
```

管理端功能：

```text
apps/admin/src/features/users/
apps/admin/src/features/roles/
apps/admin/src/features/permissions/
apps/admin/src/features/session-management/
```

## 权限代码

用户管理：

```text
user.read
user.create
user.update
user.delete
user.assign_roles
```

角色管理：

```text
role.read
role.create
role.update
role.delete
role.assign_permissions
```

权限目录：

```text
permission.read
```

会话管理：

```text
user_session.read
user_session.revoke
```

不要用角色名称检查替代这些权限代码。保持后端守卫、路由元数据、菜单可见性、页面操作、注册表条目、种子行为和测试一致。

## 用户工作流

用户变更通常会影响：

- 请求 DTO 和响应 DTO；
- mapper 输出，且绝不能暴露密码哈希；
- 服务校验和唯一性规则；
- 角色分配规则；
- 数据权限可见性规则；
- 敏感变更的审计日志；
- 生成的前端 API 用法；
- 路由和页面操作门禁。

密码重置和角色替换是敏感操作。它们应当保持受保护、可审计，并与普通资料更新分开测试。

## 角色工作流

角色定义权限代码的集合。角色变更通常会影响：

- 角色 CRUD 行为；
- 受保护的系统角色行为；
- 权限替换语义；
- seed/upsert 预期；
- 前端角色表单和权限面板。

`role.assign_permissions` 独立于 `role.update`，因为修改角色权限比编辑标签或描述影响更大。

## 权限注册表

权限注册表是稳定权限定义的来源。每个条目都应包括：

- 稳定代码；
- 模块；
- 操作；
- 显示名称和描述；
- 默认角色；
- 排序顺序。

种子行为应添加新权限并分配默认值，但不能悄悄撤销管理员所做的变更。删除或重命名权限代码属于数据迁移事项。

## 会话管理

会话管理与认证登录/登出分离。它允许有权限的管理员通过受保护的 API 端点列出用户会话并撤销会话。

撤销操作应当：

- 当服务禁止撤销当前会话时，避免撤销当前会话；
- 记录审计元数据；
- 保留请求 id 关联；
- 在管理页面使用生成的 API helper。

## 验证

聚焦检查：

```bash
pnpm --filter api test -- user
pnpm --filter api test -- role
pnpm --filter api test -- permission
pnpm --filter api test -- user-session
pnpm --filter admin test -- UsersPage
pnpm --filter admin test -- RolesPage
pnpm --filter admin test -- PermissionsPage
```

对于契约、认证、权限或会话行为变更：

```bash
pnpm api:check
pnpm --filter api test:e2e
pnpm build
```
