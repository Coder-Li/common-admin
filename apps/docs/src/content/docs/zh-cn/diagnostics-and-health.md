---
title: 诊断和健康检查
description: 健康检查、诊断 endpoints 和 request logging 行为。
draft: false
---

Common Admin 暴露一个普通 health check 和一个受控的 diagnostic error endpoint。使用这些 surfaces 进行部署检查和 request-flow 验证。

## Health Check

部署栈期望 API health endpoint 在将 API container 视为 healthy 之前成功响应。

Health 是 runtime availability contract 的一部分，不是 admin product UI。它应保持简单、快速，并且不包含 secrets。

用它验证：

- API process 可达；
- service 已启动；
- health check 所需的 dependencies 正在响应。

## Diagnostic Error Endpoint

API 包含一个 public diagnostic error endpoint，可以通过部署配置启用，用于 request-flow verification。

在需要确认以下内容时使用它：

- request-id header 存在；
- global exception filter 会把 unknown errors 映射到统一 envelope；
- runtime logs 包含预期 request context；
- error responses 在 HTTP pipeline 中保持一致。

除非部署明确需要，否则不要保持 diagnostic-only failure surfaces 暴露。

## Logging Expectations

当 request 失败时，API 应记录结构化 context，例如 request id、method、path、status，以及已知情况下的 user id。

Runtime logs 面向 operators 和 diagnostics。它们不应变成 public docs 的第二份副本，也不应变成 audit trail。

## 前端使用

Admin app 不应依赖 diagnostic endpoints 进行正常操作。只在调试 request flow、global errors 或 deployment configuration 时使用它们。

## 验证

聚焦检查：

```bash
pnpm --filter api test -- diagnostics
pnpm --filter api test -- common/errors
pnpm --filter api test -- common/logging
```

对于全局 request behavior：

```bash
pnpm --filter api test:e2e
pnpm build
```
