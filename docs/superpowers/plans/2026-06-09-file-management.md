# File Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a unified admin file library with local server uploads, admin CRUD, authenticated downloads, and a storage abstraction reserved for future OSS providers.

**Architecture:** Add `ManagedFile` metadata to Prisma and a new NestJS `FileModule` that separates HTTP concerns, metadata service logic, and provider-neutral storage. The first provider is local disk storage; the frontend adds a `/files` admin page that follows the existing React Query/DataTable CRUD pattern and never depends on internal storage paths or object keys.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Multer via `@nestjs/platform-express`, class-validator, Swagger, Jest, React, Vite, TypeScript, TanStack Query, Axios, react-hook-form, zod, Vitest, React Testing Library, Tailwind CSS.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-09-file-management-design.md`
- CRUD pattern guide: `docs/patterns/admin-crud-table-pattern-guide.md`
- Reference backend resource: `apps/api/src/user/`
- Reference frontend resource: `apps/admin/src/features/users/`
- Reference dictionary resource: `apps/api/src/dictionary/` and `apps/admin/src/features/dictionaries/`

## File Structure

### Backend

- Modify `apps/api/prisma/schema.prisma`: add `FileStorageDriver`, `FileVisibility`, `ManagedFile`, and `User.uploadedFiles`.
- Create a Prisma migration under `apps/api/prisma/migrations/`: database schema for managed files.
- Modify generated Prisma artifacts by running `pnpm --filter api db:generate`.
- Modify `apps/api/src/config/env.config.ts`: validate file storage settings.
- Modify `apps/api/.env.example` and root `.env.example`: document file storage settings.
- Create `apps/api/src/file/dto/file.request.ts`: list, upload body, and update DTOs plus validation helpers.
- Create `apps/api/src/file/dto/file.response.ts`: file response and list response DTOs.
- Create `apps/api/src/file/storage/storage.constants.ts`: provider token and storage constants.
- Create `apps/api/src/file/storage/storage.types.ts`: storage interface, inputs, outputs, and driver type helpers.
- Create `apps/api/src/file/storage/local-storage.service.ts`: local disk storage implementation.
- Create `apps/api/src/file/file.mapper.ts`: map Prisma managed files to public response DTOs.
- Create `apps/api/src/file/file.service.ts`: list/detail/upload/update/delete/download business logic.
- Create `apps/api/src/file/file.controller.ts`: admin routes, upload interceptor, and download streaming.
- Create `apps/api/src/file/file.module.ts`: module wiring.
- Modify `apps/api/src/app.module.ts`: import `FileModule`.
- Create `apps/api/src/file/storage/local-storage.service.spec.ts`: path safety and local object key tests.
- Create `apps/api/src/file/file.service.spec.ts`: service tests for upload, list, update, delete, and validation edge cases.
- Create `apps/api/src/file/file.controller.spec.ts`: focused controller tests for auth roles, upload errors, and download headers.
- Modify `apps/api/src/auth/auth-flow.spec.ts`: add file route authorization coverage.
- Modify `apps/api/test/app.e2e-spec.ts` or create `apps/api/test/file.e2e-spec.ts`: add an upload/download/delete smoke test when the local database and auth fixture are available.

### Frontend

- Modify `apps/admin/src/lib/api.ts`: add file list/create/update/delete/download methods and blob support.
- Modify `apps/admin/src/lib/api.test.ts`: cover file API paths, `FormData`, authenticated blob download, and auth headers.
- Create `apps/admin/src/features/files/files.types.ts`: file request, response, list query, and form types.
- Create `apps/admin/src/features/files/files.api.ts`: feature API functions using the shared client.
- Create `apps/admin/src/features/files/files.columns.tsx`: table columns and row actions.
- Create `apps/admin/src/features/files/FileUploadDialog.tsx`: upload form and selected file summary.
- Create `apps/admin/src/features/files/FileForm.tsx`: metadata edit form for `displayName` and `description`.
- Create `apps/admin/src/features/files/FilesPage.tsx`: query state, table, upload/edit/delete/download flows.
- Create `apps/admin/src/features/files/FilesPage.test.tsx`: page behavior tests.
- Modify `apps/admin/src/layouts/AdminShell.tsx`: add Files navigation and route rendering.
- Modify `apps/admin/src/routes/router-factory.ts`: protect `/files`.
- Modify `apps/admin/src/routes/router.test.tsx`: cover `/files` routing.
- Modify `apps/admin/src/i18n/messages.ts`: add English and Chinese file UI copy.

## Chunk 1: Backend Data Model And Configuration

### Task 1: Add Prisma Managed File Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Update the Prisma schema**

Add the file enums near the existing enums:

```prisma
enum FileStorageDriver {
  LOCAL
}

enum FileVisibility {
  PRIVATE
}
```

Add the reverse relation to `User`:

```prisma
uploadedFiles ManagedFile[]
```

Add the model:

```prisma
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

- [ ] **Step 2: Generate migration and Prisma client**

Run:

```bash
pnpm --filter api db:migrate -- --name add_file_management
pnpm --filter api db:generate
```

Expected: Prisma creates a migration under `apps/api/prisma/migrations/` and the client includes `managedFile`, `FileStorageDriver`, and `FileVisibility`.

- [ ] **Step 3: Verify existing backend tests still compile**

Run:

```bash
pnpm --filter api test -- main.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit schema changes**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add managed file schema"
```

### Task 2: Add File Storage Environment Configuration

**Files:**
- Modify: `apps/api/src/config/env.config.ts`
- Modify: `apps/api/.env.example`
- Modify: `.env.example`
- Test: `apps/api/src/config/env.config.spec.ts`

- [ ] **Step 1: Write failing env validation tests**

In `apps/api/src/config/env.config.spec.ts`, add cases for:

- defaults include local file storage settings.
- `FILE_STORAGE_DRIVER=oss` fails in v1.
- `FILE_MAX_SIZE_MB=0` fails.
- an empty `FILE_ALLOWED_MIME_TYPES` string fails.
- `FILE_ALLOWED_MIME_TYPES=image/jpeg,, image/png` is accepted and normalizes
  away the blank entry.
- comma-separated MIME values are accepted.

Run:

```bash
pnpm --filter api test -- env.config.spec.ts
```

Expected: FAIL because the schema does not include file storage settings yet.

- [ ] **Step 2: Extend `env.config.ts`**

Add these fields to the zod schema:

```ts
FILE_STORAGE_DRIVER: z.enum(['local']).default('local'),
LOCAL_STORAGE_ROOT: z.string().min(1).default('./storage/uploads'),
FILE_MAX_SIZE_MB: z.coerce.number().int().positive().default(20),
FILE_ALLOWED_MIME_TYPES: z
  .string()
  .default('image/jpeg,image/png,image/webp,application/pdf,text/plain')
  .transform((value, ctx) => {
    const mimeTypes = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (mimeTypes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'FILE_ALLOWED_MIME_TYPES must include at least one MIME type',
      });
      return z.NEVER;
    }

    return mimeTypes.join(',');
  }),
```

Keep `AppEnv` inferred from the schema.

- [ ] **Step 3: Update env examples**

Add:

```text
FILE_STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=./storage/uploads
FILE_MAX_SIZE_MB=20
FILE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,application/pdf,text/plain
```

to both `apps/api/.env.example` and root `.env.example`.

- [ ] **Step 4: Re-run env tests**

Run:

```bash
pnpm --filter api test -- env.config.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit env configuration**

```bash
git add apps/api/src/config/env.config.ts apps/api/src/config/env.config.spec.ts apps/api/.env.example .env.example
git commit -m "feat(api): add file storage configuration"
```

## Chunk 2: Backend Storage, DTOs, And Service

### Task 3: Add Storage Interface And Local Provider

**Files:**
- Create: `apps/api/src/file/storage/storage.constants.ts`
- Create: `apps/api/src/file/storage/storage.types.ts`
- Create: `apps/api/src/file/storage/local-storage.service.ts`
- Create: `apps/api/src/file/storage/local-storage.service.spec.ts`

- [ ] **Step 1: Write failing local storage tests**

Create tests for:

- `save()` writes a buffer under `YYYY/MM/<uuid>.<extension>`.
- `save()` omits the trailing dot when `extension` is `null`.
- `read()` returns a stream and file size.
- `delete()` succeeds when the file exists.
- `delete()` is idempotent when the file is already missing.
- path traversal object keys such as `../secret.txt` are rejected.

Use a temporary directory from Node's `fs.mkdtemp` and clean it up in `afterEach`.

Run:

```bash
pnpm --filter api test -- local-storage.service.spec.ts
```

Expected: FAIL because the storage files do not exist.

- [ ] **Step 2: Add storage constants and types**

Create `storage.constants.ts`:

```ts
export const FILE_STORAGE = Symbol('FILE_STORAGE');
```

Create `storage.types.ts` with:

```ts
import type { FileStorageDriver } from '@prisma/client';

export interface StoredObject {
  bucket: string | null;
  objectKey: string;
  checksum?: string;
}

export interface StorageReadResult {
  stream: NodeJS.ReadableStream;
  size: number;
}

export interface SaveFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  extension: string | null;
}

export interface StorageService {
  readonly driver: FileStorageDriver;
  save(input: SaveFileInput): Promise<StoredObject>;
  read(object: StoredObject): Promise<StorageReadResult>;
  delete(object: StoredObject): Promise<void>;
}
```

- [ ] **Step 3: Implement `LocalStorageService`**

Use `ConfigService<AppEnv, true>` to read `LOCAL_STORAGE_ROOT`. Use `crypto.randomUUID()`, `fs/promises`, `createReadStream`, `path.resolve`, and `path.join`.

Implementation requirements:

- Resolve relative roots against `process.cwd()`.
- Generate object keys with POSIX separators: `YYYY/MM/<uuid>[.<extension>]`.
- Treat `extension` as already sanitized and without a leading dot.
- Ensure parent directories exist with `mkdir(..., { recursive: true })`.
- Verify every resolved path starts inside the resolved storage root.
- Use a path boundary check based on `path.relative(root, candidate)` so
  sibling paths such as `/tmp/uploads2` are not mistaken for children of
  `/tmp/uploads`.
- Throw `BadRequestException` or `NotFoundException` for unsafe/missing reads.
- Ignore `ENOENT` in `delete()`.

- [ ] **Step 4: Re-run storage tests**

Run:

```bash
pnpm --filter api test -- local-storage.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit storage provider**

```bash
git add apps/api/src/file/storage
git commit -m "feat(api): add local file storage provider"
```

### Task 4: Add File DTOs, Mapper, And Validation Helpers

**Files:**
- Create: `apps/api/src/file/dto/file.request.ts`
- Create: `apps/api/src/file/dto/file.response.ts`
- Create: `apps/api/src/file/file.mapper.ts`
- Create: `apps/api/src/file/file.service.spec.ts`

- [ ] **Step 1: Write failing DTO and mapper tests**

In `file.service.spec.ts`, add focused tests for:

- list query defaults and accepts `mimeType` / `storageDriver`.
- invalid sort field `objectKey:asc` fails.
- invalid `storageDriver=S3` fails.
- `UpdateFileDto` rejects an empty body.
- `UpdateFileDto` rejects empty `displayName`.
- metadata validation rejects arrays, scalars, objects deeper than 5 levels, and serialized JSON over 16 KB.
- mapper serializes `size` as a string and omits `bucket`, `objectKey`, and `checksum`.

Run:

```bash
pnpm --filter api test -- file.service.spec.ts
```

Expected: FAIL because DTOs and mapper do not exist.

- [ ] **Step 2: Implement request DTOs**

Create:

- `FileListQueryDto extends ListQueryDto`
- `UploadFileMetadataDto`
- `UpdateFileDto`

Rules:

- `FileListQueryDto` validates `storageDriver` with `FileStorageDriver.LOCAL`.
- `FileListQueryDto` rejects sort fields outside `displayName`, `mimeType`,
  `size`, `storageDriver`, `createdAt`, and `updatedAt`; it still accepts only
  `asc` and `desc` directions.
- `displayName` is trimmed, non-empty when present, and max 255.
- `description` is trimmed, nullable, and max 500.
- `metadata` is an object or null, not an array.
- Add helper functions exported from this file:
  - `parseMultipartMetadata(value: unknown): Record<string, unknown> | null | undefined`
  - `validateMetadataShape(value: unknown): Record<string, unknown> | null`
  - `hasUpdateFileFields(dto: UpdateFileDto): boolean`

Metadata helper rules:

- `parseMultipartMetadata(undefined)` returns `undefined`.
- `parseMultipartMetadata('')` returns `undefined`.
- `parseMultipartMetadata(value)` parses JSON strings from multipart form data.
- Invalid JSON throws `BadRequestException`.
- Parsed metadata must be an object or `null`; arrays and scalars throw
  `BadRequestException`.
- Serialized metadata must be no larger than 16 KB.
- Metadata nesting depth must be at most 5 levels.

- [ ] **Step 3: Implement response DTOs**

Create `FileResponseDto` and `FileListResponseDto` matching the spec. Do not include `bucket`, `objectKey`, or `checksum` in public responses.

- [ ] **Step 4: Implement mapper**

Map Prisma `ManagedFile` records to:

```ts
{
  id,
  originalName,
  displayName,
  mimeType,
  extension,
  size: file.size.toString(),
  storageDriver,
  visibility,
  description,
  metadata: file.metadata as Record<string, unknown> | null,
  uploadedById,
  createdAt: file.createdAt.toISOString(),
  updatedAt: file.updatedAt.toISOString(),
}
```

- [ ] **Step 5: Re-run DTO and mapper tests**

Run:

```bash
pnpm --filter api test -- file.service.spec.ts
```

Expected: PASS for the DTO and mapper tests written in this task.

- [ ] **Step 6: Commit DTOs and mapper**

```bash
git add apps/api/src/file/dto apps/api/src/file/file.mapper.ts apps/api/src/file/file.service.spec.ts
git commit -m "feat(api): add file dto and mapper"
```

### Task 5: Implement File Service

**Files:**
- Create: `apps/api/src/file/file.service.ts`
- Modify: `apps/api/src/file/file.service.spec.ts`

- [ ] **Step 1: Extend failing service tests**

Add service tests with mocked Prisma and mocked storage provider:

- `listFiles()` filters `deletedAt: null`, applies search, sorts by allowed fields, and returns `createListResponse`.
- `listFiles()` passes `mimeType` and `storageDriver` filters into the Prisma
  `where` object when those query params are present.
- invalid sort throws `BadRequestException`.
- `findById()` returns a non-deleted file and throws `NotFoundException` for missing or soft-deleted files.
- `createFile()` rejects missing upload.
- `createFile()` rejects MIME types not in `FILE_ALLOWED_MIME_TYPES`.
- `createFile()` normalizes original name and falls back to `uploaded-file`.
- `createFile()` derives `extension` without a leading dot.
- `createFile()` stores file content and persists metadata with SHA-256 checksum.
- `createFile()` deletes the stored object if Prisma create fails.
- `updateFile()` trims fields and rejects empty updates.
- `deleteFile()` calls storage delete before setting `deletedAt`.
- `deleteFile()` does not set `deletedAt` if storage delete throws.
- `getDownload()` returns storage read result and file metadata.

Run:

```bash
pnpm --filter api test -- file.service.spec.ts
```

Expected: FAIL because `FileService` is missing.

- [ ] **Step 2: Implement `FileService` constructor and constants**

Inject:

- `PrismaService`
- `ConfigService<AppEnv, true>`
- storage provider through `@Inject(FILE_STORAGE) private readonly storage: StorageService`

Define:

```ts
const FILE_SORT_FIELDS = new Set([
  'displayName',
  'mimeType',
  'size',
  'storageDriver',
  'createdAt',
  'updatedAt',
]);
```

- [ ] **Step 3: Implement list/detail/update helpers**

Implement:

- `listFiles(query: FileListQueryDto): Promise<FileListResponseDto>`
- `findById(id: string): Promise<FileResponseDto>`
- `updateFile(id: string, dto: UpdateFileDto): Promise<FileResponseDto>`
- `parseSort(sort = 'createdAt:desc')`
- `buildWhere(query)`

All reads must include `deletedAt: null`.
`buildWhere(query)` must:

- add `mimeType` when `query.mimeType` is present.
- add `storageDriver` when `query.storageDriver` is present.
- search `originalName`, `displayName`, and `description` with
  case-insensitive `contains` when `query.search` is present.

- [ ] **Step 4: Implement upload behavior**

Add a method similar to:

```ts
async createFile(
  file: Express.Multer.File | undefined,
  metadataDto: UploadFileMetadataDto,
  uploadedById?: string,
): Promise<FileResponseDto>
```

Requirements:

- Reject missing file.
- Validate MIME type against the config allowlist.
- Normalize original name with `path.basename(file.originalname).trim()`.
- Fallback to `uploaded-file` if normalized original name is empty.
- Limit normalized `originalName` to 255 characters before persistence. Preserve
  the extension when truncating a long filename so storage naming still has the
  best available suffix.
- Use `displayName ?? originalName`.
- Derive `extension` with no leading dot from the normalized original name; if unavailable, use a small MIME-to-extension map for allowed defaults; otherwise `null`.
- Compute SHA-256 over `file.buffer`.
- Call `storage.save()` before Prisma create.
- If Prisma create fails, attempt `storage.delete()` for cleanup before rethrowing the original error.

- [ ] **Step 5: Implement delete and download behavior**

Implement:

- `deleteFile(id: string): Promise<void>`
- `getDownload(id: string): Promise<{ file: ManagedFile; stream: NodeJS.ReadableStream; size: number; downloadName: string }>`

Delete rules:

- Missing or already soft-deleted file returns `404`.
- Call storage delete with internal `bucket`, `objectKey`, and `checksum`.
- Set `deletedAt` only after storage delete succeeds.

Download rules:

- Missing or soft-deleted file returns `404`.
- Read through storage provider.
- Build `downloadName` from `displayName`.
- If `displayName` lacks an extension and `extension` exists, append `.<extension>`.

- [ ] **Step 6: Re-run service tests**

Run:

```bash
pnpm --filter api test -- file.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit service**

```bash
git add apps/api/src/file/file.service.ts apps/api/src/file/file.service.spec.ts
git commit -m "feat(api): add file management service"
```

## Chunk 3: Backend Controller, Module, And Security

### Task 6: Add File Controller And Module

**Files:**
- Create: `apps/api/src/file/file.controller.ts`
- Create: `apps/api/src/file/file.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/src/file/file.controller.spec.ts`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install Multer TypeScript types if missing**

Run:

```bash
pnpm --filter api add -D @types/multer
```

Expected: `apps/api/package.json` and `pnpm-lock.yaml` update if the package was not already installed.

- [ ] **Step 2: Write failing controller tests**

In `file.controller.spec.ts`, test:

- all management routes are decorated with `@Roles(Role.ADMIN)`.
- `GET /files` calls `FileService.listFiles()` with `FileListQueryDto`.
- `GET /files/:id` calls `FileService.findById()`.
- upload calls `FileService.createFile()` with the multipart file, body DTO, and current user id.
- `PATCH /files/:id` calls `FileService.updateFile()` with `UpdateFileDto`.
- `DELETE /files/:id` calls `FileService.deleteFile()`.
- missing file propagates the service `BadRequestException`.
- download sets `Content-Type`, `Content-Length`, and `Content-Disposition`.
- delete returns `204` through controller metadata.

Run:

```bash
pnpm --filter api test -- file.controller.spec.ts
```

Expected: FAIL because controller/module do not exist.

- [ ] **Step 3: Implement `FileController`**

Use:

- `@ApiTags('Files')`
- `@ApiBearerAuth('access-token')`
- `@Controller('files')`
- method-level `@Roles(Role.ADMIN)`
- `@UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize } }))` on upload
- `@UploadedFile()` and `@Body()`
- `@CurrentUser()` for uploadedById
- `@Res({ passthrough: true })` and `StreamableFile` for downloads

Implement every route from the spec:

- `@Get()` `listFiles(@Query() query: FileListQueryDto)` calls `fileService.listFiles(query)`.
- `@Post()` `uploadFile(@UploadedFile() file, @Body() body: UploadFileMetadataDto, @CurrentUser() user)` calls `fileService.createFile(file, body, user.sub)`.
- `@Get(':id/download')` must be declared before `@Get(':id')` and calls `fileService.getDownload(id)`.
- `@Get(':id')` calls `fileService.findById(id)`.
- `@Patch(':id')` calls `fileService.updateFile(id, body)`.
- `@Delete(':id')` uses `@HttpCode(204)` and calls `fileService.deleteFile(id)`.

Download header guidance:

```ts
response.setHeader('Content-Type', file.mimeType);
response.setHeader('Content-Length', size.toString());
response.setHeader('Content-Disposition', contentDisposition(downloadName));
return new StreamableFile(stream);
```

Use a small local helper to safely encode `Content-Disposition`; do not concatenate raw filenames.

- [ ] **Step 4: Implement `FileModule`**

Wire:

```ts
@Module({
  imports: [PrismaModule],
  controllers: [FileController],
  providers: [
    FileService,
    LocalStorageService,
    {
      provide: FILE_STORAGE,
      useExisting: LocalStorageService,
    },
  ],
})
export class FileModule {}
```

If `ConfigModule` is already global, do not import it here.

- [ ] **Step 5: Register module in `AppModule`**

Import `FileModule` in `apps/api/src/app.module.ts` and add it to the imports array near other domain modules.

- [ ] **Step 6: Re-run controller tests**

Run:

```bash
pnpm --filter api test -- file.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Run backend file test suite**

Run:

```bash
pnpm --filter api test -- local-storage.service.spec.ts file.service.spec.ts file.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit controller and module**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/file apps/api/src/app.module.ts
git commit -m "feat(api): add file management routes"
```

### Task 7: Add Backend Authorization And Optional E2E Coverage

**Files:**
- Modify: `apps/api/src/auth/auth-flow.spec.ts`
- Modify: `apps/api/test/app.e2e-spec.ts` or create `apps/api/test/file.e2e-spec.ts` for the optional smoke test
- Test: `apps/api/src/file/file.controller.spec.ts`

- [ ] **Step 1: Add security coverage**

Add focused cases to `apps/api/src/auth/auth-flow.spec.ts` that verify:

- unauthenticated requests to `/files` return `401`.
- standard users receive `403`.
- admin users can access the route.

Run:

```bash
pnpm --filter api test -- auth-flow.spec.ts
```

Expected: PASS, including the new file authorization cases.

- [ ] **Step 2: Add optional upload smoke test**

If the e2e harness can create an admin token and use a database, add:

- upload a tiny `text/plain` fixture.
- list files and find it.
- download it and assert content.
- delete it and assert list no longer includes it.

If local database setup is unavailable, record this as a skipped/manual verification in the final implementation notes rather than weakening unit tests.

- [ ] **Step 3: Run backend verification**

Run:

```bash
pnpm --filter api lint
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 4: Commit backend verification coverage**

```bash
git add apps/api/src/auth/auth-flow.spec.ts apps/api/src/file apps/api/test/app.e2e-spec.ts apps/api/test/file.e2e-spec.ts
git commit -m "test(api): cover file management authorization"
```

If no new files changed because existing controller tests already cover this sufficiently, skip the commit and note that no additional commit was needed.

## Chunk 4: Frontend API And File Page

### Task 8: Add Frontend File API Types And Client Methods

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/api.test.ts`
- Create: `apps/admin/src/features/files/files.types.ts`
- Create: `apps/admin/src/features/files/files.api.ts`

- [ ] **Step 1: Write failing API tests**

In `apps/admin/src/lib/api.test.ts`, add tests that:

- `api.files.list(query)` sends `GET /files` with params.
- `api.files.upload(formData)` sends `POST /files` with authenticated config.
- `api.files.update(id, payload)` sends `PATCH /files/:id`.
- `api.files.delete(id)` sends `DELETE /files/:id`.
- `api.files.download(id)` requests a blob from `GET /files/:id/download`.

Run:

```bash
pnpm --filter admin test -- api.test.ts
```

Expected: FAIL because file API methods do not exist.

- [ ] **Step 2: Add file frontend types**

Create `files.types.ts`:

```ts
export type FileStorageDriver = 'LOCAL';
export type FileVisibility = 'PRIVATE';

export interface FileRecord {
  id: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  extension: string | null;
  size: string;
  storageDriver: FileStorageDriver;
  visibility: FileVisibility;
  description: string | null;
  metadata: Record<string, unknown> | null;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  mimeType?: string;
  storageDriver?: FileStorageDriver;
}

export interface UpdateFileRequest {
  displayName?: string;
  description?: string | null;
}
```

Use the shared `ListResponse<FileRecord>` type for list responses.
Do not include `metadata` in the frontend update payload in v1 because JSON
metadata editing is intentionally out of scope for the UI.

- [ ] **Step 3: Extend shared API client**

Add a `files` namespace to `createApiClient()`:

- `list(query)`
- `upload(formData)`
- `update(id, payload)`
- `delete(id)`
- `download(id): Promise<Blob>`

Extend the local `RequestConfig` abstraction only as much as needed for blob downloads, for example with `responseType?: 'blob'`.

- [ ] **Step 4: Add feature API wrappers**

Create `files.api.ts` that mirrors the users/dictionaries pattern and delegates to `defaultApi.files`.

- [ ] **Step 5: Re-run frontend API tests**

Run:

```bash
pnpm --filter admin test -- api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit frontend API layer**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/lib/api.test.ts apps/admin/src/features/files
git commit -m "feat(admin): add file api client"
```

### Task 9: Build File Table, Upload Dialog, And Metadata Form

**Files:**
- Create: `apps/admin/src/features/files/files.columns.tsx`
- Create: `apps/admin/src/features/files/FileUploadDialog.tsx`
- Create: `apps/admin/src/features/files/FileForm.tsx`
- Create: `apps/admin/src/features/files/FilesPage.tsx`
- Create: `apps/admin/src/features/files/FilesPage.test.tsx`

- [ ] **Step 1: Write failing page tests**

Create tests for:

- loading state renders.
- empty list renders.
- query error state renders.
- file records render with display name, MIME type, formatted size, and created date.
- search updates list query.
- upload success invalidates `['files', 'list']` queries and closes dialog.
- edit success invalidates list query.
- delete success invalidates list query.
- download action calls the download API, creates a browser object URL, clicks a temporary anchor with the expected download filename, and revokes the object URL.

Run:

```bash
pnpm --filter admin test -- FilesPage.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 2: Implement table columns**

Columns should include:

- display name
- MIME type
- size formatted from string bytes
- storage driver
- created time
- actions: download, edit, delete

Use lucide icons for action buttons and keep row action callbacks passed in from `FilesPage`.

- [ ] **Step 3: Implement `FileUploadDialog`**

Use a native file input. The form should:

- show selected file name, MIME type, and formatted size.
- allow optional display name and description.
- create `FormData` with `file`, `displayName`, and `description`.
- disable submit while no file is selected or upload is pending.
- surface validation errors through inline form text or toast.

- [ ] **Step 4: Implement `FileForm`**

Use `react-hook-form` and `zod` for:

- `displayName`: required, trimmed, max 255.
- `description`: optional, max 500.

Metadata JSON editing is out of scope for v1.

- [ ] **Step 5: Implement `FilesPage`**

Follow `UsersPage` and `DictionariesPage` patterns:

- local state for search, pagination, sorting, upload dialog, edit target, delete target.
- `useServerTableQuery<FileRecord, ...>` with resource `files`.
- mutations for upload, update, delete.
- download handler that gets a blob, creates an object URL, triggers an `<a download>`, and revokes the URL.
- delete confirmation dialog that shows the target display name and only calls the delete mutation after confirmation.
- toast success/error messages.

- [ ] **Step 6: Re-run page tests**

Run:

```bash
pnpm --filter admin test -- FilesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit file page components**

```bash
git add apps/admin/src/features/files
git commit -m "feat(admin): add file management page"
```

### Task 10: Wire Files Route, Navigation, And I18n

**Files:**
- Modify: `apps/admin/src/layouts/AdminShell.tsx`
- Modify: `apps/admin/src/routes/router-factory.ts`
- Modify: `apps/admin/src/routes/router.test.tsx`
- Modify: `apps/admin/src/i18n/messages.ts`
- Modify: `apps/admin/src/layouts/AdminShell.test.tsx`

- [ ] **Step 1: Write failing route and shell tests**

Add tests that:

- authenticated `/files` is allowed.
- anonymous `/files` redirects to `/login`.
- the Files nav item is rendered on desktop and mobile.
- navigating to `/files` renders `FilesPage`.

Run:

```bash
pnpm --filter admin test -- router.test.tsx AdminShell.test.tsx
```

Expected: FAIL because `/files` is not wired yet.

- [ ] **Step 2: Update route guard**

Add `/files` to the protected paths set.

- [ ] **Step 3: Update admin shell**

Add:

- `Files` or `Folder` icon from `lucide-react`.
- desktop nav button.
- mobile nav button.
- page title branch.
- content branch rendering `<FilesPage />`.

Keep styling consistent with existing nav items.

- [ ] **Step 4: Add i18n messages**

Add English and Chinese keys for:

- `nav.files`
- file page title
- search placeholder
- upload/edit/delete/download actions
- column labels
- form labels
- success/error toasts
- delete confirmation copy
- empty state

- [ ] **Step 5: Re-run route and shell tests**

Run:

```bash
pnpm --filter admin test -- router.test.tsx AdminShell.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run focused frontend tests**

Run:

```bash
pnpm --filter admin test -- api.test.ts FilesPage.test.tsx router.test.tsx AdminShell.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit frontend route wiring**

```bash
git add apps/admin/src/layouts/AdminShell.tsx apps/admin/src/layouts/AdminShell.test.tsx apps/admin/src/routes/router-factory.ts apps/admin/src/routes/router.test.tsx apps/admin/src/i18n/messages.ts
git commit -m "feat(admin): wire file management navigation"
```

## Chunk 5: Full Verification And Handoff

### Task 11: Run Full Automated Verification

**Files:**
- No planned edits unless verification exposes issues.

- [ ] **Step 1: Run backend checks**

Run:

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run frontend checks**

Run:

```bash
pnpm --filter admin lint
pnpm --filter admin test
pnpm --filter admin build
```

Expected: all commands exit 0.

- [ ] **Step 3: Run workspace-level checks if available**

Run:

```bash
pnpm -r test
```

Expected: all package tests exit 0. If this duplicates the focused package tests but is available and fast enough, keep it as the final regression check.

- [ ] **Step 4: Fix verification failures with focused tests first**

For each failure:

1. Reproduce with the smallest command.
2. Fix the code.
3. Re-run the smallest command.
4. Re-run the relevant full package command.
5. Commit the fix with a focused message.

### Task 12: Manual Upload Smoke Test

**Files:**
- No planned edits unless the smoke test exposes issues.

- [ ] **Step 1: Start backend and frontend dev servers**

In one terminal:

```bash
pnpm --filter api dev
```

In another terminal:

```bash
pnpm --filter admin dev
```

Expected: API listens on its configured port, admin listens on Vite's port.

- [ ] **Step 2: Exercise the UI**

Using the browser:

- log in as an admin.
- navigate to `/files`.
- upload a small allowed file, such as a `.txt` file.
- confirm it appears in the list.
- edit its display name and description.
- download it and verify the downloaded file content.
- confirm the downloaded file uses the edited display name and keeps a useful extension when one was stored.
- delete it and confirm it disappears from the list.

- [ ] **Step 3: Record any skipped manual checks**

If local database, Redis, or dev server prerequisites are unavailable, record exactly which smoke-test steps were skipped and why in the final implementation notes.

### Task 13: Final Repository State

**Files:**
- No planned edits.

- [ ] **Step 1: Confirm clean git state**

Run:

```bash
git status --short
```

Expected: no output.

- [ ] **Step 2: Summarize final commits and verification**

Run:

```bash
git log --oneline -8
```

Expected: recent commits include the file management implementation commits from this plan.

- [ ] **Step 3: Handoff summary**

Final response should include:

- what was implemented.
- key files changed.
- verification commands and results.
- any manual smoke-test gaps.
- any follow-up work intentionally left out of v1, such as direct OSS uploads, public links, thumbnails, or virus scanning.
