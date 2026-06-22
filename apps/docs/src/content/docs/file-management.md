---
title: File Management
description: Upload and download contracts, multipart Swagger metadata, generated Blob downloads, and storage safety.
draft: false
---

Common Admin includes a private file-management module for admin-managed
uploads. Files are protected by permissions, described through OpenAPI metadata,
and consumed in the frontend through generated API helpers.

## Permissions

File operations use dedicated permission codes:

```text
file.read
file.upload
file.download
file.update
file.delete
```

Keep backend `@Permissions()`, frontend route/menu metadata, page action gates,
and tests aligned.

## Upload Contract

Uploads use `multipart/form-data`:

```text
POST /files
file: binary
displayName?: string
description?: string | null
metadata?: object | null
```

Swagger metadata must declare:

- `@ApiConsumes('multipart/form-data')`;
- an `@ApiBody` schema with the binary `file` field;
- a stable operation id such as `uploadFile`;
- response DTO metadata.

Do not hand-write a browser upload client. Fix the backend Swagger metadata or
Orval configuration, regenerate the API client, then use the generated upload
helper from the admin app.

## Download Contract

Downloads stream bytes from:

```text
GET /files/{id}/download
```

The controller sets:

- `Content-Type` from the stored MIME type;
- `Content-Length`;
- `Content-Disposition` with a safe fallback filename and UTF-8 filename.

Swagger metadata should describe a binary response so the generated frontend
function returns a Blob-compatible value. Frontend file-save behavior may live in
a small feature-local helper when it wraps the generated download operation.

## Storage Safety

The current storage driver is local storage. Store file bytes outside public web
roots and access them through authorized API endpoints.

File handling rules:

- Validate the file exists before creating metadata.
- Enforce upload size limits.
- Enforce allowed MIME types.
- Normalize original filenames before storing metadata.
- Derive a safe extension from the original filename or MIME type.
- Store checksums for uploaded bytes.
- Soft-delete metadata where the feature expects historical records.
- Clean up stored bytes if database persistence fails.

Do not expose bucket names, object keys, local storage paths, or private storage
metadata in public API responses unless a product explicitly requires it.

## Upload Policy

The effective upload policy comes from runtime settings constrained by
deployment environment values:

- `FILE_MAX_SIZE_MB`;
- `FILE_ALLOWED_MIME_TYPES`;
- runtime upload settings.

See [Settings](./settings/) for the settings boundary.

## Audit Expectations

Upload, update, and delete operations should record audit logs with sanitized
payloads. The audit record should identify the actor, request metadata, file id,
action, and public file response fields.

Do not store file bytes, tokens, private storage keys, or raw multipart payloads
in audit logs.

## Verification

Focused checks:

```bash
pnpm --filter api test -- file
pnpm --filter admin test -- FilesPage
```

For upload or download contract changes:

```bash
pnpm api:check
pnpm --filter api test:e2e
pnpm build
```
