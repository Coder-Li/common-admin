---
title: 升级指南
description: 如何安全升级 Common Admin 部署或派生项目。
draft: false
---

当你要把 Common Admin 部署或派生项目迁移到更新版本时，请使用本指南。

## 升级前

检查变更集是否包含：

- Prisma migrations；
- permission registry changes；
- API contract changes；
- generated frontend API changes；
- auth、cookie 或 session behavior changes；
- settings 或 file upload policy changes；
- deployment variable changes；
- public docs 或 MCP allowlist changes。

在对共享或生产数据应用 migrations 前备份数据库。

## Generated API Drift

如果升级修改了后端 contracts，请重新生成并检查生成 artifacts：

```bash
pnpm api:generate
pnpm api:check
```

Generated diffs 应由 backend DTO、Swagger metadata、OpenAPI 或 Orval changes 解释。不要手动 patch generated output。

## Database Migrations

本地开发：

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

部署升级：

```bash
pnpm deploy:migrate
```

`deploy:init` 只用于首次空数据库初始化。

如果 migration 重命名或删除 stable fields、permissions、roles 或 user data，请在运行前规划现有 records 应如何映射。

## Permission Changes

Permission codes 是持久数据。升级 permissions 时：

- 使用稳定 codes 添加新的 registry entries；
- 除非 migration 会处理 assignments，否则避免重命名现有 codes；
- 检查 `defaultRoles`；
- 验证 seed behavior 不会重新授予 admin 已移除的 permissions；
- 同步更新 frontend route metadata 和 page action gates。

Permission registry changes 后运行聚焦 permission tests。

## Deployment Configuration

升级 auth、cookies、storage、logging 或 origins 时，检查环境变量。

在生产中保持这些规则：

- 配置非本地 JWT secret；
- 避免 wildcard origins；
- 显式配置 refresh-cookie security；
- HTTPS 部署使用 secure cookies；
- 让 secrets 远离 runtime settings 和 docs。

## Rollback Notes

Image rollback 通常比 database rollback 更容易。Database rollback 需要 migration 或 restore plan。

应用风险较高的 migration 之前，决定：

- migration 是否可逆；
- 旧 application code 是否能读取新 schema；
- 如果 deploy 失败如何 restore data；
- rollback 应使用哪个 image tag。

## 验证

升级前：

```bash
pnpm quality
```

升级后：

- 打开 admin app；
- sign in；
- 验证 Swagger 可以渲染；
- 访问 users、roles、dictionaries、files、audit logs 和 settings；
- 检查 health endpoint；
- 查看 API logs 中是否有意外的 401、403、500、CORS 或 migration errors。

对于 docs 或 MCP-only upgrades：

```bash
pnpm --filter docs build
pnpm --filter @common-admin/mcp-server test
pnpm --filter @common-admin/mcp-server typecheck
```
