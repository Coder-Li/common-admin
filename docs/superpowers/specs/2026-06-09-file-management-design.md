# File Management Design

## Goal

Add a unified admin file library that lets administrators upload files to the
server, browse uploaded files, edit file metadata, download files, and delete
files. The first implementation should use local server storage, while keeping
storage operations behind an interface so object storage providers can be added
later without rewriting controllers, frontend pages, or business metadata
logic.

## Context

The project already has a standard CRUD pattern documented in
`docs/patterns/admin-crud-table-pattern-guide.md` and implemented by the user
and dictionary modules. File management should follow the same conventions:

- API: NestJS, Prisma, PostgreSQL, Swagger, JWT auth, role guards, and
  class-validator DTOs.
- Admin: React, Vite, Tailwind CSS, React Query, Axios, react-hook-form, zod,
  lucide-react icons, and project-local data table components.
- Existing admin resources use paginated list endpoints, mapper files,
  separated request/response DTOs, and `@Roles(Role.ADMIN)` on management
  actions.

Mature Node/NestJS upload implementations commonly use Multer through NestJS'
file upload interceptors for multipart form data. Production systems that store
large assets commonly move toward object storage and direct uploads with S3-style
presigned URLs. For this project, the current priority is a reliable local
server upload path with a storage abstraction that can later support S3,
MinIO, Aliyun OSS, Tencent COS, or another compatible provider.

## Scope

- Backend file metadata model.
- Backend local storage provider.
- Backend storage provider interface.
- Backend upload, list, detail, update, delete, and download endpoints.
- Backend file validation for size, MIME type, and path safety.
- Frontend file management page under `/files`.
- Frontend upload dialog.
- Frontend metadata edit and delete flows.
- Frontend download action.
- Configuration placeholders for future storage drivers.

Out of scope:

- Direct-to-OSS uploads.
- Presigned upload or download URLs.
- Multipart uploads, resumable uploads, or tus protocol support.
- Drag-and-drop upload queues.
- Multi-file batch upload.
- Public share links.
- Virus scanning.
- Image transformations or thumbnails.
- File versioning.
- Binding files to specific business resources.
- End-user personal file libraries.
- Audit history and restore UI.

## Chosen Approach

Use a unified `ManagedFile` resource backed by a Prisma table and a storage
provider interface.

The API owns metadata, authorization, validation, and download responses. The
storage provider owns physical persistence. In v1, the active provider is local
disk storage. Future object storage providers should implement the same
interface and can be selected by configuration.

This keeps the current implementation small and familiar while preserving the
most important future boundary: callers work with file IDs and metadata, not
local paths or provider-specific object keys.

Public API responses must not expose local filesystem paths, storage buckets, or
object keys. Those fields are internal storage coordinates used by the service
and provider implementations. If administrators later need low-level storage
diagnostics, add a dedicated admin diagnostics response instead of coupling the
normal file library UI to storage internals.

## Backend Structure

Add a new file module:

```text
apps/api/src/file/
  dto/
    file.request.ts
    file.response.ts
  storage/
    storage.constants.ts
    storage.types.ts
    local-storage.service.ts
  file.controller.ts
  file.mapper.ts
  file.module.ts
  file.service.ts
```

Responsibilities:

- `FileController`: HTTP contract, Swagger metadata, upload interceptor, and
  response streaming/download headers.
- `FileService`: metadata persistence, list filtering, provider calls,
  validation orchestration, and delete behavior.
- `StorageService` interface: provider-neutral storage operations.
- `LocalStorageService`: local filesystem implementation.
- DTO files: request validation and response shapes.
- Mapper: conversion from Prisma records to response DTOs.

Register `FileModule` in `AppModule`.

## Storage Interface

The storage interface should be provider-neutral:

```ts
export interface StoredObject {
  bucket: string | null
  objectKey: string
  checksum?: string
}

export interface StorageReadResult {
  stream: NodeJS.ReadableStream
  size: number
}

export interface SaveFileInput {
  buffer: Buffer
  originalName: string
  mimeType: string
  extension: string | null
}

export interface StorageService {
  readonly driver: FileStorageDriver
  save(input: SaveFileInput): Promise<StoredObject>
  read(object: StoredObject): Promise<StorageReadResult>
  delete(object: StoredObject): Promise<void>
}
```

The interface intentionally does not expose local paths. Object storage
providers can map `bucket` and `objectKey` directly, while local storage can use
`bucket = null` and a relative `objectKey`.

## Data Model

Add Prisma enums and model:

```prisma
enum FileStorageDriver {
  LOCAL
}

enum FileVisibility {
  PRIVATE
}

model ManagedFile {
  id            String            @id @default(uuid())
  originalName  String            @db.VarChar(255)
  displayName   String            @db.VarChar(255)
  mimeType      String            @db.VarChar(120)
  extension     String?           @db.VarChar(32)
  size          BigInt
  storageDriver FileStorageDriver @default(LOCAL)
  bucket        String?           @db.VarChar(120)
  objectKey     String            @db.VarChar(500)
  checksum      String?           @db.VarChar(128)
  visibility    FileVisibility    @default(PRIVATE)
  description   String?           @db.VarChar(500)
  metadata      Json?
  uploadedById  String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  deletedAt     DateTime?

  uploadedBy    User?             @relation(fields: [uploadedById], references: [id])

  @@index([createdAt])
  @@index([mimeType])
  @@index([storageDriver])
  @@index([uploadedById])
  @@index([deletedAt])
}
```

Add the reverse relation on `User`:

```prisma
uploadedFiles ManagedFile[]
```

Rules:

- `displayName` defaults to `originalName`.
- `originalName`, `mimeType`, `extension`, `size`, `storageDriver`, `bucket`,
  `objectKey`, `checksum`, and `uploadedById` are immutable after creation.
- Admins can update `displayName`, `description`, and `metadata`.
- `deletedAt` implements soft delete at the metadata layer.
- List and detail endpoints ignore soft-deleted records.
- Downloading a soft-deleted file returns `404`.
- Physical files should be deleted when the delete endpoint succeeds.
- If physical deletion fails, the metadata record must not be marked deleted.
- `checksum` is computed in v1 as a lowercase hex SHA-256 digest of the uploaded
  file content.
- `originalName` is taken from the multipart file metadata, reduced to its base
  name, trimmed, and limited to 255 characters. If it is empty after
  normalization, use a generated display-safe fallback such as `uploaded-file`.
- `displayName` is trimmed, must be non-empty, and is limited to 255 characters.
- `description` is trimmed when provided, can be cleared with `null`, and is
  limited to 500 characters.
- `metadata` must be a JSON object when provided. Scalars and arrays are
  rejected.
- Serialized `metadata` must not exceed 16 KB and may be nested at most 5 levels.

The initial enum values are intentionally narrow. Future storage drivers or
visibility modes should be added through explicit migrations when there is a
real feature that uses them.

## Configuration

Extend backend environment validation with:

```text
FILE_STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=./storage/uploads
FILE_MAX_SIZE_MB=20
FILE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,application/pdf,text/plain
```

Rules:

- `FILE_STORAGE_DRIVER` accepts `local` in v1.
- `LOCAL_STORAGE_ROOT` is resolved relative to the API process working
  directory unless it is already absolute.
- `FILE_MAX_SIZE_MB` must be a positive integer.
- `FILE_ALLOWED_MIME_TYPES` is a comma-separated allowlist.
- Empty MIME entries are ignored after trimming.
- If the allowlist is empty, uploads are rejected instead of accepting all file
  types.

The `.env.example` files should document these values.

## Local Storage

Local storage saves files under the configured root with generated object keys:

```text
YYYY/MM/<uuid>[.<extension>]
```

Example:

```text
storage/uploads/2026/06/1d90e060-f0f6-4884-a802-6e546d6297d9.pdf
```

Rules:

- Never use `originalName` as the stored filename.
- Derive the extension from the original filename or MIME type only after
  validation. Store `extension` without a leading dot, for example `pdf`.
- If no safe extension can be derived, store the object as `YYYY/MM/<uuid>`
  without a trailing dot and keep `extension = null`.
- Normalize and verify paths before reads and deletes so object keys cannot
  escape `LOCAL_STORAGE_ROOT`.
- Create month directories on demand.
- Store only the relative object key in the database.
- Do not expose `LOCAL_STORAGE_ROOT` through static file serving in v1.

## API Contract

All file management endpoints are admin-only and require JWT authentication:

```text
GET    /files
GET    /files/:id
POST   /files
PATCH  /files/:id
DELETE /files/:id
GET    /files/:id/download
```

Route ordering matters. Literal routes should be declared before parameterized
routes if future endpoints are added.

### Upload

`POST /files`

- Content type: `multipart/form-data`.
- File field name: `file`.
- Optional fields: `displayName`, `description`, `metadata`.
- `metadata`, when provided in multipart form data, is a JSON string that must
  parse to an object and satisfy the metadata size/depth rules.
- Successful response: `201 Created` with `FileResponseDto`.
- Missing file returns `400`.
- Disallowed MIME type returns `400`.
- Invalid metadata JSON returns `400`.
- Overlong or empty text fields return `400`.
- Oversized upload returns `413` or `400`, depending on Multer/NestJS behavior.
- Storage failure returns `500`.

The service should store the physical file first, then create metadata. If
metadata creation fails after a successful storage write, the service should
attempt to delete the stored object before rethrowing.

### List

`GET /files`

Uses the existing list response contract:

```ts
interface FileListQuery extends ListQuery {
  mimeType?: string
  storageDriver?: 'LOCAL'
}
```

Sort allowlist:

- `displayName`
- `mimeType`
- `size`
- `storageDriver`
- `createdAt`
- `updatedAt`

Default sort:

- `createdAt:desc`

Search fields:

- `originalName`
- `displayName`
- `description`

Rules:

- Only records with `deletedAt = null` are returned.
- Invalid sort fields or directions return `400`.
- Pagination follows the existing `ListQueryDto` behavior.

### Detail

`GET /files/:id`

- Returns `FileResponseDto`.
- Missing or soft-deleted files return `404`.

### Update

`PATCH /files/:id`

Request:

```ts
interface UpdateFileRequest {
  displayName?: string
  description?: string | null
  metadata?: Record<string, unknown> | null
}
```

Rules:

- Empty request bodies return `400`.
- `displayName` is trimmed and must remain non-empty.
- `displayName`, `description`, and `metadata` follow the same validation limits
  as upload fields.
- `metadata` in this JSON endpoint must be an object or `null`; arrays and
  scalar values return `400`.
- Missing or soft-deleted files return `404`.

### Delete

`DELETE /files/:id`

- Deletes the physical object through the storage provider.
- Sets `deletedAt` when physical deletion succeeds.
- Returns `204 No Content`.
- Missing or already soft-deleted files return `404`.

Physical delete should be idempotent at the storage provider level. If the file
is already missing from disk but the metadata record exists, the delete endpoint
may still mark metadata deleted and return `204`, because the requested end
state has been reached.

### Download

`GET /files/:id/download`

- Returns the stored object stream.
- Missing or soft-deleted files return `404`.
- Storage read failure returns `404` when the object no longer exists, otherwise
  `500`.
- Sets `Content-Type` to the stored MIME type.
- Sets `Content-Length` when known.
- Sets `Content-Disposition` with the stored `displayName`.
- If `displayName` has no extension and the stored file has one, append the
  stored extension to the download filename so common desktop tools can still
  infer the file type.

The response should sanitize or encode the filename according to HTTP header
rules. Do not concatenate unescaped user-controlled names directly into headers.

## Response Shapes

```ts
interface FileResponseDto {
  id: string
  originalName: string
  displayName: string
  mimeType: string
  extension: string | null
  size: string
  storageDriver: 'LOCAL'
  visibility: 'PRIVATE'
  description: string | null
  metadata: Record<string, unknown> | null
  uploadedById: string | null
  createdAt: string
  updatedAt: string
}
```

`size` should be serialized as a string because Prisma maps `BigInt` to a
JavaScript `bigint`, which is not JSON serializable without conversion. The
frontend can convert it to a number only when it is within safe integer range.

`bucket`, `objectKey`, and `checksum` remain internal in v1 responses. Keeping
them out of normal responses preserves the storage abstraction and avoids
frontend dependencies on local or OSS implementation details.

## Frontend

Add a file management feature:

```text
apps/admin/src/features/files/
  FileForm.tsx
  FileUploadDialog.tsx
  FilesPage.tsx
  files.api.ts
  files.columns.tsx
  files.types.ts
```

Add `/files` to:

- the shared route/menu registry.
- router guard coverage.
- `AdminShell` sidebar and mobile nav through metadata.
- `AdminShell` page title resolution through metadata.
- i18n messages.

The page follows the existing standard admin layout:

- Header with title and upload action.
- Search input.
- MIME type filter if it remains simple; otherwise defer advanced filtering.
- Server-driven table using `useServerTableQuery`.
- Row actions for download, edit metadata, and delete.
- Confirmation dialog for delete.

Upload dialog:

- Uses a native file input in v1.
- Shows selected filename, type, and size.
- Allows optional display name and description.
- Submits `FormData` to `POST /files`.
- Shows loading and error states.
- Invalidates the file list query after success.

Edit metadata dialog:

- Edits `displayName` and `description`.
- Metadata JSON editing is out of scope for the v1 UI, even though the backend
  stores metadata for future integrations.

Download action:

- Calls the authenticated API endpoint and triggers browser download.
- The API client should request a blob response for downloads.

## Security

The implementation should follow common file upload hardening practices:

- Require authentication and admin role.
- Enforce file size limits.
- Enforce MIME type allowlist.
- Generate storage names server-side.
- Do not trust `originalName` for paths.
- Prevent path traversal on read and delete.
- Do not serve the upload directory as a public static directory.
- Set explicit download headers.
- Keep upload errors generic enough that filesystem paths are not leaked.

Virus scanning is out of scope for v1, but the design should not make it hard to
insert later. A future scanner could run between Multer parsing and
`StorageService.save`, or as an asynchronous quarantine workflow if public
downloads are introduced.

## Future OSS Extension

Future providers should add implementations under `file/storage/` without
changing the file controller contract. Expected extensions:

- Add enum value such as `S3`, `MINIO`, or `ALIYUN_OSS`.
- Add provider-specific configuration.
- Register the active provider based on `FILE_STORAGE_DRIVER`.
- Store provider bucket and object key in existing columns.
- Optionally add presigned download URLs as a separate endpoint, not a breaking
  replacement for `/files/:id/download`.
- Optionally add direct upload flows with a separate initiation/complete API.

The v1 API should avoid returning local filesystem paths so future OSS migration
does not break frontend consumers.

## Testing

Backend tests:

- Admin users can access file management endpoints.
- Standard users are denied access to file management endpoints.
- `FileService` lists only non-deleted records.
- `FileService` rejects invalid sort fields.
- `FileService` creates metadata after storage save.
- `FileService` cleans up storage if metadata creation fails.
- `FileService` does not mark deleted if storage delete fails.
- `LocalStorageService` keeps resolved paths inside the configured root.
- `LocalStorageService` creates object keys without a trailing dot when
  `extension = null`.
- Upload rejects missing files and disallowed MIME types.
- Upload rejects invalid metadata JSON and overlong text fields.
- Download sets expected headers.

Frontend tests:

- File API sends list params through the shared API client.
- Upload API submits `FormData`.
- File page renders loading, empty, success, and error states.
- Upload success invalidates list query.
- Delete success invalidates list query.

E2E coverage is useful if time permits:

- Login as admin.
- Upload a small allowed fixture.
- See it in the file list.
- Download it.
- Delete it.

## Implementation Order

1. Add Prisma model, enums, migration, and generated client.
2. Add backend file module skeleton and storage interface.
3. Implement local storage provider.
4. Implement upload/list/detail/update/delete/download service methods.
5. Add controller routes and Swagger metadata.
6. Extend API env validation and `.env.example`.
7. Add backend unit tests.
8. Add frontend API/types.
9. Add file management page, nav route, dialogs, and i18n strings.
10. Add frontend tests.
11. Run backend and frontend verification.
