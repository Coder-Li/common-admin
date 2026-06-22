---
title: 会话管理
description: Common Admin 中的用户会话列表、撤销和审计行为。
draft: false
---

Session management 是面向 admin 的活跃和历史用户会话视图。它与 login 和 refresh 分离，但使用 auth 创建的同一批 session records。

## 功能

Session-management 页面和 API 允许有权限的管理员：

- 列出用户会话；
- 按状态、用户、IP 地址和日期筛选；
- 撤销活跃会话；
- 查看会话 metadata 以支持问责。

后端使用 `user_session.read` 和 `user_session.revoke`。

## 边界

Session management 不会：

- 直接创建 sessions；
- 修改登录凭据；
- 替代 auth refresh 行为；
- 暴露 refresh tokens；
- 在服务禁止时撤销当前会话。

登录、刷新、登出和修改密码生命周期见[认证和会话](./auth-and-sessions/)。

## 列表行为

Session lists 支持分页，并可以按以下条件筛选：

- status；
- user id；
- IP address；
- created-at date range；
- 跨用户身份值的 search fields。

Service 会根据 revoked time 和 expiry time 推导每一行的 status。添加或重命名 filters 时，保持 list contract 和生成的前端 helpers 对齐。

## 撤销行为

Revocation 是敏感的 admin 操作。Service 会：

- 阻止撤销当前会话；
- 阻止撤销已经 revoked 或 expired 的 session；
- 记录 audit metadata；
- 保留 request-id correlation；
- 使用 admin-revoked reason 标记目标 session。

不要通过把这些检查移动到前端来削弱它们。

## 前端模式

Admin 页面应使用生成的 API hooks 或 endpoint functions，展示 loaded 和 error states，并用匹配的 permission gate 控制 revoke 操作。

将本地 UI state 限制在 filters、dialog state 和 selected rows。

## 验证

聚焦检查：

```bash
pnpm --filter api test -- user-session
pnpm --filter admin test -- SessionManagementPage
```

对于 contract changes：

```bash
pnpm api:check
pnpm --filter api test:e2e
pnpm build
```
