---
title: 认证和会话
description: 登录、刷新、登出、token replay，以及前端 API 边界规则。
draft: false
---

Common Admin 使用短生命周期 access token 加 refresh-token session cookie。Auth 生命周期横跨 NestJS auth 模块、refresh-token 持久化、cookie 设置、生成的前端 API client 边界，以及 admin auth store。

## 生命周期

登录：

```text
POST /auth/login
  -> validate username/email and password
  -> create user session row
  -> issue access token
  -> set refresh cookie
  -> return access token and user profile
```

刷新：

```text
POST /auth/refresh
  -> read refresh cookie
  -> validate session, expiry, revocation, and token secret
  -> rotate refresh token
  -> issue a new access token
  -> return access token and user profile
```

登出：

```text
POST /auth/logout
  -> clear refresh cookie
  -> revoke the current session when an access token or refresh token identifies it
```

修改密码：

```text
POST /auth/change-password
  -> verify current password
  -> update password hash
  -> revoke active sessions for the user
  -> clear refresh cookie
```

## 前端边界

前端 API 请求应继续使用生成的 endpoint functions 和 hooks。生成的 client 会调用共享 API mutator，由它负责：

- API base URL 处理。
- Query parameter 序列化。
- `withCredentials` cookie 行为。
- 注入 `Authorization: Bearer <access token>`。
- 通用 API error 转换。
- 401 refresh 和 replay 行为。

不要为生成的 endpoints 创建手写的一次性 API client。如果某个 endpoint 需要不同的生成形态，请修复后端 Swagger metadata 或 Orval 配置并重新生成。

## Refresh Coordinator

Refresh coordinator 会防止多个同时发生的 401 响应启动多个 refresh 请求。当 refresh 正在进行时，后续调用方会复用同一个 promise。

如果 refresh 成功：

- auth store 接收新 session；
- 原始失败请求会使用新的 access token 重放一次。

如果 refresh 失败：

- auth store 变为 anonymous；
- query cache 被清空；
- 原始调用方收到 API error。

## 401 Replay 规则

Replay 被有意限制在很窄的范围：

- 原始请求只会在 refresh 成功后重试。
- Login、refresh 和 logout 请求不会触发 refresh replay。
- 失败的 replay 会作为错误返回；它不应无限递归。
- 后端 guards 仍然是安全边界。前端 refresh 逻辑只是 session-continuity 功能。

修改 auth 时，请测试完整生命周期，而不只是测试被编辑的方法。

## Cookie 设置

Refresh-cookie 行为由部署配置控制：

- cookie name；
- secure flag；
- same-site mode；
- 可选 cookie domain；
- refresh-token lifetime。

不要把 refresh tokens 存入 local storage。不要在日志、audit payloads、文档、截图或 AI prompts 中暴露 access tokens 或 refresh tokens。

## 验证

常用聚焦检查：

```bash
pnpm --filter api test -- auth
pnpm --filter admin test -- api-refresh-coordinator
pnpm --filter admin test -- api-mutator
```

当 auth 行为跨越后端和前端边界变化时，也运行：

```bash
pnpm api:check
pnpm test
pnpm --filter api test:e2e
pnpm build
```
