# Admin API Contract Generation Guide

This guide is the development entry point for adding or changing API-backed
admin features in Common Admin.

The project uses the backend OpenAPI document as the source for frontend API
schema types, endpoint functions, React Query hooks, and query key helpers.
Backend DTOs and controller Swagger metadata define the contract. Orval turns
that contract into frontend code.

Use this guide together with:

- `docs/patterns/admin-crud-table-pattern-guide.md` for standard CRUD pages.
- `docs/patterns/admin-rbac-crud-permission-pattern-guide.md` for permissions.
- Existing modules such as users, roles, dictionaries, files, and audit logs.

## Core Rules

- Do not hand edit `apps/api/openapi.json`.
- Do not hand edit files under `apps/admin/src/generated/api/`.
- Do not recreate the removed handwritten API client.
- Do not add feature-local `.api.ts` files for one-method forwarding.
- Backend DTOs and Swagger decorators are the API contract source.
- Every controller endpoint must define an explicit
  `@ApiOperation({ operationId })`.
- Generated OpenAPI paths must stay prefix-free, for example `/users`, not
  `/api/users`.
- The frontend deployment prefix belongs to `VITE_API_BASE_URL`, which defaults
  to `/api`.
- Generated requests must go through `apps/admin/src/app/api-mutator.ts`.
- Use generated query key helpers, or a small project adapter around them, for
  React Query invalidation.

## Files And Responsibilities

```text
apps/api/openapi.json
apps/api/src/openapi.ts
apps/api/scripts/generate-openapi.ts
apps/admin/orval.config.ts
apps/admin/src/app/api-mutator.ts
apps/admin/src/app/api-refresh-coordinator.ts
apps/admin/src/generated/api/
```

- `apps/api/src/openapi.ts` creates the shared Swagger/OpenAPI document and
  asserts the prefix policy.
- `apps/api/scripts/generate-openapi.ts` writes `apps/api/openapi.json` without
  starting a dev server.
- `apps/admin/orval.config.ts` configures generated endpoint files, schema
  files, the custom mutator, direct `FormData` upload, and blob download.
- `apps/admin/src/app/api-mutator.ts` owns request behavior: base URL, access
  token headers, cookies, 401 refresh/replay, upload, download, and cache
  cleanup after failed refresh.
- `apps/admin/src/app/api-refresh-coordinator.ts` shares one refresh request
  between startup session restoration and 401 replay.
- `apps/admin/src/generated/api/` is generated, committed, and read-only.

## Standard Development Workflow

Use this flow when adding or changing an API-backed admin module.

1. Add or update backend Prisma/service behavior.
2. Add or update request and response DTO classes.
3. Add validation decorators and Swagger metadata to DTO fields.
4. Add controller response decorators and an explicit operation id.
5. Add permission registry entries and `@Permissions()` where the endpoint is
   admin-only.
6. Add or update OpenAPI assertion coverage when introducing endpoints or
   special request/response metadata.
7. Run `pnpm api:generate`.
8. Import generated endpoint functions, hooks, query keys, and schema types in
   the admin feature.
9. Use generated query key helpers for invalidation after mutations.
10. Add backend and frontend tests around project-owned behavior.
11. Run `pnpm api:check`, then lint, test, and build.

Commands:

```bash
pnpm api:generate
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

`pnpm api:generate` runs backend OpenAPI generation first, then Orval frontend
generation. `pnpm api:check` runs generation and fails if
`apps/api/openapi.json` or `apps/admin/src/generated/api/` differs from the
committed output.

Run `pnpm api:check` before broad type/build checks. A stale contract often
causes noisy downstream failures.

## Backend Contract Checklist

For each generated endpoint, verify the backend has:

- A request DTO for body or query parameters when the endpoint accepts input.
- A response DTO for non-empty JSON responses.
- `class-validator` decorators for runtime validation.
- `@ApiProperty`, `@ApiPropertyOptional`, or equivalent Swagger metadata for
  fields that should appear clearly in OpenAPI.
- `@ApiOperation({ operationId: '<stableName>' })`.
- `@ApiOkResponse`, `@ApiCreatedResponse`, `@ApiNoContentResponse`, or explicit
  binary/multipart response metadata.
- Path, query, body, and response metadata that is specific enough for Orval to
  generate useful frontend types.
- `@ApiBearerAuth('access-token')` when the endpoint requires authentication.
- `@Permissions('<module>.<action>')` for admin-only capabilities.
- OpenAPI tests updated when a new operation id, multipart body, binary
  response, or prefix-sensitive route is added.

Example controller shape:

```ts
@ApiTags('Articles')
@ApiBearerAuth('access-token')
@Controller('articles')
export class ArticleController {
  @ApiOperation({ operationId: 'listArticles' })
  @ApiOkResponse({ type: ArticleListResponseDto })
  @Permissions('article.read')
  @Get()
  listArticles(
    @Query() query: ArticleListQueryDto,
  ): Promise<ArticleListResponseDto> {
    return this.articleService.listArticles(query)
  }

  @ApiOperation({ operationId: 'createArticle' })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  @Permissions('article.create')
  @Post()
  createArticle(
    @Body() body: CreateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.articleService.createArticle(body)
  }
}
```

Operation ids are frontend API names. Treat renaming them as a breaking change
for imports and tests.

When adding an endpoint, update `apps/api/src/openapi.spec.ts` if the endpoint
should be part of the generated admin contract. The operation id coverage should
fail if a generated endpoint is missing its stable operation id.

## Prefix Policy

Runtime API routes use the global `/api` prefix. Generated OpenAPI paths do not.

Correct generated paths:

```text
/auth/login
/users
/files/{id}/download
```

Incorrect generated paths:

```text
/api/auth/login
/api/users
/api/files/{id}/download
```

The browser combines generated resource paths with the frontend base URL:

```text
VITE_API_BASE_URL=/api
generated path=/users
final request=/api/users
```

If OpenAPI paths include `/api`, requests become `/api/api/...`. The generation
helper asserts this and `pnpm api:check` will fail if the contract drifts.

## Frontend Usage

Generated files are split by OpenAPI tags under
`apps/admin/src/generated/api/endpoints/`. Schema types are exported from
`apps/admin/src/generated/api/schemas`.

Use generated endpoint functions or hooks directly in feature pages. Use local
types only for UI-only state, form values, selected rows, or aliases that make
the page clearer.

Example imports:

```ts
import {
  createUser,
  deleteUser,
  getListUsersQueryKey,
  listUsers,
  updateUser,
} from '../../generated/api/endpoints/users/users'
import type {
  CreateUserDto,
  ListUsersParams,
  UpdateUserDto,
  UserResponseDto,
} from '../../generated/api/schemas'
```

Acceptable feature-local type aliases:

```ts
import type {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
} from '../../generated/api/schemas'

export type UserRecord = UserResponseDto
export type CreateUserRequest = CreateUserDto
export type UpdateUserRequest = UpdateUserDto

export interface UserFormValue {
  username: string
  email: string
  roleCodes: string[]
}
```

Do not duplicate backend DTO shapes in feature `.types.ts` files.

## Queries And Invalidation

Prefer generated query key helpers when using generated endpoint functions.

```tsx
const params = {
  page: pagination.pageIndex + 1,
  pageSize: pagination.pageSize,
  search: search || undefined,
} satisfies ListUsersParams

const usersQuery = useQuery({
  queryKey: getListUsersQueryKey(params),
  queryFn: () => listUsers(params),
})

const createMutation = useMutation({
  mutationFn: (payload: CreateUserDto) => createUser(payload),
  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: getListUsersQueryKey(),
    })
  },
})
```

If a shared table adapter owns query-state conversion, it must still align its
query keys with generated helpers or expose a small invalidation adapter. Do not
write raw strings such as `['users', 'list']` when a generated key helper exists.

## Feature-Local Facades

Feature-local `.api.ts` files are not the default pattern. Add one only when it
does real page-level work, such as:

- combining multiple generated operations;
- mapping DTOs to UI-only models;
- coordinating multi-step mutations;
- centralizing complex invalidation;
- handling browser file-save behavior around a generated download operation.

Do not add wrappers such as:

```ts
export function listArticles(params: ListArticlesParams) {
  return generatedListArticles(params)
}
```

That only recreates the old handwritten API layer.

## Auth And Session Boundaries

Auth/session behavior is application-owned, even though auth endpoints are
generated.

- Login may call the generated `login` operation, then store the returned session
  in `useAuthStore`.
- Startup session restoration calls `apiRefreshCoordinator.refresh()`.
- Ordinary 401 responses are handled by `apiMutator`, which refreshes through
  the same coordinator and replays the original request once.
- Logout clears auth state and query cache after the backend logout completes or
  when the app must force anonymous state.
- `/auth/login`, `/auth/refresh`, and `/auth/logout` must not trigger automatic
  refresh/replay loops.

Do not create another refresh promise in a feature or page. Refresh tokens rotate
through cookies, so independent refresh calls can race and invalidate each other.

## Files

Uploads use direct `FormData`.

Backend upload endpoints must declare:

- `@ApiConsumes('multipart/form-data')`;
- `@ApiBody(...)` with a binary `file` field and supported metadata fields.

Frontend upload example:

```ts
const formData = new FormData()
formData.append('file', file)
formData.append('displayName', displayName)

await uploadFile(formData)
```

Downloads use the generated `downloadFile` operation. Orval is configured so
`downloadFile` requests blobs.

```ts
const blob = await downloadFile(file.id)
const url = URL.createObjectURL(blob)
const anchor = document.createElement('a')
anchor.href = url
anchor.download = file.displayName
anchor.click()
URL.revokeObjectURL(url)
```

Keep browser file-save behavior in the page or in a thin feature-local helper
that still calls the generated operation.

## Testing

Do not test generated code internals. Test the project-owned boundaries.

Backend tests should cover:

- service behavior and mapper output;
- validation and error cases;
- permission-protected route behavior when relevant;
- OpenAPI special cases for multipart and binary endpoints.

Frontend tests should cover:

- page behavior while mocking generated endpoint modules;
- mutation success and error UI;
- query key invalidation when the page owns invalidation logic;
- `api-mutator.ts` behavior for tokens, 401 refresh/replay, cleanup, skip rules,
  and blob request options;
- `api-refresh-coordinator.ts` behavior for shared refresh requests.

Contract checks:

```bash
pnpm api:check
```

Full verification:

```bash
pnpm lint
pnpm test
pnpm build
```

## Troubleshooting

### Generated import name changed

Check the backend operation id. Fix `@ApiOperation({ operationId })` instead of
renaming imports locally.

### Request path becomes `/api/api/...`

The OpenAPI document probably includes the runtime prefix. Keep
`ignoreGlobalPrefix: true` in `createOpenApiDocument` and make sure generated
paths do not start with `/api/`.

### Frontend type is too weak

The backend DTO or Swagger metadata is incomplete. Add explicit DTO fields,
validation decorators, and Swagger property metadata, then run
`pnpm api:generate`.

### Upload type is not `FormData`

Check `apps/api/src/file/file.controller.ts` style metadata and
`apps/admin/orval.config.ts`. The current project convention is direct
`FormData`, not mutator-side conversion.

### Download is not a `Blob`

Check the backend binary response metadata and the `downloadFile` override in
`apps/admin/orval.config.ts`.

### `pnpm api:check` fails

Inspect the diff:

```bash
git diff -- apps/api/openapi.json apps/admin/src/generated/api
```

If the diff is expected, commit the regenerated files. If it is unexpected,
change backend DTOs, controller metadata, or Orval config; do not manually edit
generated output.

### OpenAPI generation tries to use external services

The generation script should create the Nest application in-process, generate
the document, and close the app without calling `listen()`. If a new provider
connects to Postgres, Redis, or another external service during document
generation, add a generation-safe guard or provider override before continuing.

## New Module Prompt Template

Use this when asking an AI agent or teammate to add a standard API-backed admin
module:

```text
Add an API-backed admin module for <resource>.

Read and follow:
- docs/patterns/admin-api-contract-generation-guide.md
- docs/patterns/admin-crud-table-pattern-guide.md
- docs/patterns/admin-rbac-crud-permission-pattern-guide.md

Resource details:
- Route path:
- Prisma model:
- Public list/detail fields:
- Create fields:
- Update fields:
- Search fields:
- Sort fields:
- Default sort:
- Filters:
- Permission codes:
- Special actions:
- Sensitive fields that must never be returned:

Requirements:
- Backend DTOs and Swagger metadata are the contract source.
- Every endpoint has an explicit stable operationId.
- OpenAPI paths stay prefix-free.
- Run pnpm api:generate after backend contract changes.
- Use generated endpoint functions/hooks and schema types in the admin app.
- Use generated query key helpers for invalidation.
- Do not add one-method feature-local .api.ts wrappers.
- Do not edit generated files by hand.
- Add focused backend and frontend tests.
- Run pnpm api:check, pnpm lint, pnpm test, and pnpm build.
```
