---
title: 设置
description: 可在运行时编辑的设置、仅部署配置、上传策略限制和 secret 处理。
draft: false
---

Common Admin 将可在运行时编辑的产品设置与仅部署配置分离。

对于 administrators 可以安全地从 admin UI 修改的 product behavior，请使用 settings。对于 infrastructure、secrets、network boundaries 和 deployment policy ceilings，请使用环境变量。

## 可在运行时编辑的设置

Settings 模块当前覆盖：

- 基本产品展示设置；
- 默认 locale 和 theme；
- 位于部署定义限制内的 upload policy values；
- dictionary cache refresh actions；
- 面向 operators 的只读 system information。

Settings endpoints 由 `setting.read` 和 `setting.update` 保护。Administrative changes 应被审计。

## 仅部署配置

将这些保留在环境变量或部署配置中：

- database 和 Redis connection strings；
- JWT secrets；
- refresh-cookie security、same-site 和 domain values；
- allowed origins；
- file storage driver 和 storage root；
- maximum upload policy ceiling；
- logging configuration；
- diagnostic endpoint toggles；
- demo mode。

不要只是为了让它们能从 admin UI 编辑，就把 secrets 移入 runtime settings。

## Upload Policy 边界

Upload settings 只允许在部署上限内进行运行时编辑。

`FILE_MAX_SIZE_MB` 和 `FILE_ALLOWED_MIME_TYPES` 定义部署允许的最大策略。Runtime upload settings 可以更严格，但不应超过这些环境定义的限制。

上传文件时，file service 会在存储 metadata 或 bytes 之前检查 effective upload policy。

## Secret 处理

根据功能使用方式，Settings values 可能出现在 API responses、admin UI state、audit payloads 或 logs 中。因此 settings 不得包含：

- passwords；
- access tokens；
- refresh tokens；
- API keys；
- database URLs；
- private storage credentials；
- customer secrets。

如果未来产品需要可编辑 secrets，请将其建模为专门的 secret management feature，包含 encryption、redaction、access control 和 audit rules。不要把它们加入普通 settings table。

## 添加设置

添加 runtime setting 时：

1. 定义 setting key、group、default value 和 validation。
2. 决定该值是否可以公开出现在 admin API responses 中。
3. 添加 DTO metadata 和稳定的 operation ids。
4. 用 settings permissions 保护 reads 和 writes。
5. 使用脱敏 payloads 审计 write operations。
6. 通过 `pnpm api:generate` 更新生成的前端 API artifacts。
7. 在 admin app 中使用生成的 hooks、functions、schema types 和 query keys。
8. 为 validation、defaults、persistence、audit behavior 和 UI usage 添加测试。

## 验证

聚焦检查：

```bash
pnpm --filter api test -- settings
pnpm --filter admin test -- settings
```

对于 contract changes：

```bash
pnpm api:check
pnpm build
```
