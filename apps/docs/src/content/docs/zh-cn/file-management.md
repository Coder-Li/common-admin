---
title: 文件管理
description: 上传和下载 contracts、multipart Swagger metadata、生成的 Blob downloads，以及存储安全。
draft: false
---

Common Admin 包含一个私有 file-management 模块，用于 admin-managed uploads。Files 由 permissions 保护，通过 OpenAPI metadata 描述，并在前端通过生成的 API helpers 使用。

## 权限

File operations 使用专用 permission codes：

```text
file.read
file.upload
file.download
file.update
file.delete
```

保持后端 `@Permissions()`、前端 route/menu metadata、page action gates 和 tests 对齐。

## Upload Contract

Uploads 使用 `multipart/form-data`：

```text
POST /files
file: binary
displayName?: string
description?: string | null
metadata?: object | null
```

Swagger metadata 必须声明：

- `@ApiConsumes('multipart/form-data')`；
- 一个带有二进制 `file` 字段的 `@ApiBody` schema；
- 稳定的 operation id，例如 `uploadFile`；
- response DTO metadata。

不要手写 browser upload client。修复后端 Swagger metadata 或 Orval 配置，重新生成 API client，然后在 admin app 中使用生成的 upload helper。

## Download Contract

Downloads 从以下地址流式传输 bytes：

```text
GET /files/{id}/download
```

Controller 设置：

- 来自已存储 MIME type 的 `Content-Type`；
- `Content-Length`；
- 带有安全 fallback filename 和 UTF-8 filename 的 `Content-Disposition`。

Swagger metadata 应描述 binary response，使生成的前端 function 返回 Blob-compatible value。当前端 file-save behavior 包装生成的 download operation 时，可以放在一个小的 feature-local helper 中。

## 存储安全

当前 storage driver 是 local storage。将 file bytes 存储在 public web roots 之外，并通过授权 API endpoints 访问。

File handling 规则：

- 创建 metadata 前验证文件存在。
- 强制 upload size limits。
- 强制 allowed MIME types。
- 存储 metadata 前 normalize original filenames。
- 从 original filename 或 MIME type 推导安全 extension。
- 为 uploaded bytes 存储 checksums。
- 在功能需要历史记录时 soft-delete metadata。
- 如果 database persistence 失败，清理已存储 bytes。

除非产品明确需要，否则不要在 public API responses 中暴露 bucket names、object keys、local storage paths 或 private storage metadata。

## Upload Policy

Effective upload policy 来自 runtime settings，并受 deployment environment values 约束：

- `FILE_MAX_SIZE_MB`；
- `FILE_ALLOWED_MIME_TYPES`；
- runtime upload settings。

Settings 边界见[设置](./settings/)。

## Audit Expectations

Upload、update 和 delete operations 应使用脱敏 payloads 记录 audit logs。Audit record 应标识 actor、request metadata、file id、action 和 public file response fields。

不要在 audit logs 中存储 file bytes、tokens、private storage keys 或 raw multipart payloads。

## 验证

聚焦检查：

```bash
pnpm --filter api test -- file
pnpm --filter admin test -- FilesPage
```

对于 upload 或 download contract changes：

```bash
pnpm api:check
pnpm --filter api test:e2e
pnpm build
```
