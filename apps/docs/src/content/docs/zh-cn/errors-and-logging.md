---
title: 错误和日志
description: 错误响应 envelopes、request IDs、校验行为、运行时日志和脱敏。
draft: false
---

Common Admin 使用一致的 API error envelopes 和结构化 runtime logs。Errors 面向 API callers；logs 面向 operators 和 diagnostics。Audit logs 是敏感管理操作的独立数据库记录。

## Error Envelope

API errors 应返回以下形态：

```ts
interface ErrorResponse {
  code: string
  message: string
  statusCode: number
  requestId: string
  path: string
  timestamp: string
  details?: unknown
}
```

`requestId` 应与 `x-request-id` response header 匹配，以便调用方把失败的 API response 关联到 server logs。

## Request IDs

当传入的 `x-request-id` header 符合允许格式时，API 会接受它。否则会创建新的 request id，并在 response header 中返回。

在以下场景使用 request id：

- 报告 bugs；
- 追踪 API logs；
- 为用户触发的变更记录 audit metadata；
- 将 frontend errors 与 backend diagnostics 关联起来。

不要把 secrets 放入 request ids。它们会被记录到日志并返回给 clients。

## Error Types

Validation errors 应使用 `VALIDATION_ERROR`，并带有 field-level details：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {
    "fields": [
      { "field": "email", "message": "email must be an email" }
    ]
  }
}
```

Guard 和 auth errors 应映射为 `UNAUTHORIZED` 或 `FORBIDDEN`。

当 callers 或 UI copy 需要区分 application errors 时，应使用稳定的 error codes，例如 duplicate records、upload policy failures 或 resource-specific conflicts。

Unexpected exceptions 应返回 `INTERNAL_SERVER_ERROR`，且不泄露 stack traces 或私有实现细节。

## Runtime Logs

API 使用结构化 stdout/stderr logs。Runtime logs 应回答如下问题：

- 哪个 request 失败了？
- 涉及哪个 route 和 method？
- 已知哪个 user id？
- 哪个 exception 导致了 500？
- 哪个 service 和 environment 发出了该事件？

Runtime logs 不是 audit logs。它们可能被 sampling、发送到外部 log system、保留有限时间，或通过部署特定的 observability stack 查看。

## 脱敏

Logging layer 会脱敏敏感 headers 和类似凭据的字段，例如：

- authorization headers；
- cookies 和 set-cookie headers；
- passwords；
- access tokens；
- refresh tokens。

添加新的 secret-like fields 时，请在发布功能之前更新 redaction 预期和测试。

## Audit Logs 是独立的

对于需要问责轨迹的管理变更，请使用 audit logs：谁在何时从何处修改了什么，以及带有哪个经过脱敏的 before/after payloads。

不要依赖 runtime logs 作为持久审计轨迹。见[审计日志](./audit-logs/)。

## 验证

聚焦检查：

```bash
pnpm --filter api test -- common/errors
pnpm --filter api test -- common/logging
```

对于影响全局 request behavior 的变更：

```bash
pnpm --filter api test:e2e
pnpm build
```
