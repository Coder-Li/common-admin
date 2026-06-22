---
title: 审计日志
description: Common Admin 审计什么、payloads 如何脱敏，以及 audit logs 与 runtime logs 有何不同。
draft: false
---

Audit logs 是敏感管理操作的数据库记录。它们回答问责问题：

- 谁执行了操作？
- 哪个 resource 发生了变化？
- 执行了什么 action？
- 脱敏后的 before 和 after values 是什么？
- 哪个 request id、IP address 和 user agent 与该操作相关？

它们不能替代 runtime logs、metrics、tracing、backups 或 business event streams。

## 审计什么

审计会改变管理状态或安全敏感数据的操作。示例包括：

- 创建、更新、删除、启用或禁用用户；
- 修改 roles 或 permission assignments；
- 修改 organization、department、position 或 data-permission structures；
- 修改会影响 product behavior 的 dictionaries；
- 上传、更新、删除或以其他方式管理 files；
- 修改 runtime product settings；
- 通过 admin action 刷新 operational caches；
- 撤销 sessions 或修改 password-related state。

只读 list 和 detail requests 通常不需要 audit records，除非 resource 特别敏感。

## Payload Shape

Audit records 应使用稳定的 resource 和 action labels。普通 record 包含：

- action；
- resource type；
- resource id；
- 已知情况下的 actor id、username、email 和 display name；
- request metadata；
- 脱敏后的 `before` payload；
- 脱敏后的 `after` payload；
- 需要时的额外脱敏 metadata。

`before` 和 `after` values 优先使用 public response DTO shapes。当 raw Prisma records 包含 private fields 时，不要存储它们。

## 脱敏

Audit payloads 不得存储 secrets。Sensitive keys 在 records 持久化之前会递归脱敏。

默认将这些视为敏感：

- passwords 和 password hashes；
- access tokens 和 refresh tokens；
- cookie values；
- 不应暴露的 storage object internals；
- API keys、secrets 和 credentials；
- uploaded files 或 external systems 的 private metadata。

如果新模块引入 secret-like field，请在记录它之前添加 sanitizer coverage。

## Runtime Logs vs Audit Logs

Runtime logs：

- 输出到 stdout/stderr；
- 支持 debugging 和 operations；
- 包含 request ids 和 exception details；
- 可根据 deployment logging policy 保留。

Audit logs：

- 存储在数据库中；
- 支持 accountability 和 admin review；
- 记录 user-triggered changes；
- 必须使用脱敏后的 business payloads。

不要在任何一个 surface 中放入 secrets。

## 查询 Audit Logs

Public API 暴露由 `audit_log.read` 保护的 list 和 detail endpoints。Admin app 应为 audit-log pages 使用生成的 API helpers。

添加 filters 或 sort fields 时，同时更新 backend query DTO、Swagger metadata、生成的 API client、page tests 和 docs。

## 验证

聚焦检查：

```bash
pnpm --filter api test -- audit-log
pnpm --filter admin test -- AuditLogsPage
```

如果另一个模块开始记录 audit logs，也要包含该模块的 service 或 controller tests。
