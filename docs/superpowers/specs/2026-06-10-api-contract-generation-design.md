# API Contract And Type Generation Design

## Goal

Turn the backend OpenAPI document into the frontend source for API types,
endpoint functions, React Query hooks, and query keys.

Common Admin is still in active development and does not need to preserve the
current handwritten frontend API layer. Because this project is intended to be
a reusable starter template, the API workflow should optimize for fast module
creation, low contract drift, and clear project conventions.

The target state is:

- Backend NestJS DTOs and controller Swagger metadata are the API contract
  source.
- OpenAPI JSON is generated from the backend without requiring a running dev
  server.
- Orval generates frontend schema types, endpoint functions, React Query hooks,
  and query keys.
- Admin pages may import generated hooks directly.
- A custom frontend request mutator owns Common Admin request behavior such as
  auth headers, refresh, 401 replay, cookies, files, and future normalized
  errors.
- Feature-local API wrappers are no longer the default pattern.

## Context

The backend already uses NestJS, class-validator DTOs, Swagger decorators, and
response DTO classes. The frontend currently maintains separate handwritten
types and a handwritten API client. That split has already created contract
drift: `POST /users/:id/reset-password` returns `UserResponseDto` on the
backend, while the frontend API client types it as `void`.

The current frontend API shape has useful behavior that must survive the
migration:

- `VITE_API_BASE_URL` based Axios configuration.
- Access token injection.
- Cookie-backed refresh token requests.
- 401 refresh and original-request replay.
- Shared refresh promise for concurrent 401 responses.
- Session reset and React Query cache clearing after failed refresh.
- Support for multipart upload and blob download.

This design keeps those behaviors, but moves them behind an Orval mutator so
generated hooks can use the same request discipline.

## Chosen Approach

Use OpenAPI plus Orval to generate React Query hooks, and route all generated
requests through a custom Axios mutator.

This is a breaking change. Remove the old handwritten API client and most
feature-local API wrappers during migration instead of maintaining a long-term
compatibility layer.

Principles:

- Backend DTO/controller metadata is the single contract source.
- Generated frontend code is a checked-in, read-only artifact.
- Pages may directly import generated hooks.
- Feature-local facades are optional and reserved for page-level composition or
  UI model adaptation.
- The custom mutator is the only place that knows how Common Admin sends HTTP
  requests.
- CI should fail when OpenAPI JSON or generated frontend code is stale.

## Non-Goals

The first version should not include:

- Schema-first backend rewrites with Zod or another DTO system.
- Runtime API discovery in the browser.
- A separate shared package for manually authored API types.
- Long-term support for the old `createApiClient` shape.
- Handwritten wrappers for every generated endpoint.
- Generated code edits by hand.
- Full redesign of API error response format. The mutator should leave room for
  that work, but unified errors belong to the later exception/logging topic.

## Target File Structure

Add or migrate toward this structure:

```text
apps/api/openapi.json
apps/api/src/openapi.ts
apps/api/scripts/generate-openapi.ts
apps/admin/orval.config.ts
apps/admin/src/app/api-mutator.ts
apps/admin/src/generated/api/
```

Responsibilities:

- `apps/api/src/openapi.ts` creates the shared Swagger/OpenAPI document.
- `apps/api/scripts/generate-openapi.ts` creates a Nest app, calls the shared
  OpenAPI helper, and writes `apps/api/openapi.json`.
- `apps/api/openapi.json` is committed so template consumers can inspect the
  contract without running generation first.
- `apps/admin/orval.config.ts` configures Orval.
- `apps/admin/src/generated/api/` contains generated schemas, functions,
  React Query hooks, and query keys.
- `apps/admin/src/app/api-mutator.ts` contains the custom request function used
  by Orval.

Generated frontend files and `openapi.json` should be committed to the
repository. They should be refreshed by scripts, not hand edited.

## OpenAPI Generation

Move the current Swagger document setup out of `main.ts` into a shared helper:

```ts
export function createOpenApiDocument(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Common Admin API')
    .setDescription('API for the common admin starter template')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build()

  return SwaggerModule.createDocument(app, swaggerConfig)
}
```

`main.ts` should use this helper to mount Swagger UI. The generation script
should use the same helper to write JSON. This prevents runtime Swagger UI and
generated OpenAPI JSON from diverging.

Add an API package script:

```json
{
  "openapi:generate": "ts-node scripts/generate-openapi.ts"
}
```

The script should not require `pnpm dev:api` to be running. It should create
the Nest application in-process, generate the document, write the JSON file,
and close the app.

## Operation Naming

Generated hook names must be stable. The first version should use one of these
approaches:

- Add stable `@ApiOperation({ operationId })` values to controllers.
- Or configure a Swagger `operationIdFactory` that derives stable names from
  controller and method names.

Use clear operation ids:

```text
login
refreshSession
logout
changePassword
getCurrentUser
listUsers
getUser
createUser
updateUser
deleteUser
replaceUserRoles
resetUserPassword
listRoles
createRole
updateRole
deleteRole
replaceRolePermissions
listPermissionModules
listDictionaryTypes
createDictionaryType
updateDictionaryType
deleteDictionaryType
listFiles
uploadFile
downloadFile
listAuditLogs
getAuditLog
```

Do not allow generated names to depend on accidental controller method
renames. Page imports should remain stable across small backend refactors.

## Orval Generation

Add an admin script:

```json
{
  "api:generate": "orval --config orval.config.ts"
}
```

Add root scripts:

```json
{
  "api:generate": "pnpm --filter api openapi:generate && pnpm --filter admin api:generate",
  "api:check": "pnpm api:generate && git diff --exit-code apps/api/openapi.json apps/admin/src/generated/api"
}
```

The Orval config should:

- Read `../api/openapi.json` or the equivalent relative path.
- Generate React Query hooks.
- Generate endpoint functions and schema types.
- Use Axios through the custom mutator.
- Clean generated output before each run.
- Split output by tag or operation group so the generated tree stays readable.
- Export generated schemas and hooks from a stable index.

The exact generated file layout can follow Orval defaults, but the whole output
must stay under:

```text
apps/admin/src/generated/api/
```

## Request Mutator

All generated requests should use:

```text
apps/admin/src/app/api-mutator.ts
```

The mutator should expose an Orval-compatible function:

```ts
export async function apiMutator<T>(
  config: AxiosRequestConfig,
): Promise<T> {
  const response = await axiosInstance.request<T>(config)
  return response.data
}
```

Responsibilities:

- Create a single Axios instance.
- Use `import.meta.env.VITE_API_BASE_URL ?? '/api'`.
- Send cookies where needed.
- Add `Authorization: Bearer <accessToken>` when a token exists.
- Refresh the session on ordinary 401 responses.
- Share one refresh promise across concurrent 401 responses.
- Replay the original request after a successful refresh.
- Store the refreshed session in Zustand.
- Clear session state and React Query cache when refresh fails.
- Avoid refresh loops for login, refresh, and logout endpoints.
- Preserve support for `FormData` uploads.
- Preserve support for blob downloads.

The mutator should initially rethrow Axios errors. After the later unified
exception design lands, this file can normalize backend errors into a project
shape such as:

```ts
interface ApiError {
  status: number
  code?: string
  message: string
  details?: unknown
  requestId?: string
}
```

Generated hooks should know how to call the API. The mutator should know how a
Common Admin request is safely sent.

## Frontend Usage Rules

Pages may import generated hooks directly. This is the default path for new
modules.

Feature-local `.api.ts` files should not be created for simple endpoint
forwarding. A feature-local facade is allowed only when it adds page-level
value, such as:

- Combining multiple generated hooks or operations.
- Mapping DTOs to UI-only models.
- Managing complex query invalidation.
- Coordinating multi-step mutations.
- Handling an endpoint that needs special file/blob behavior.

Feature-local `.types.ts` files should no longer duplicate backend DTOs. They
may either:

- Import generated schema types directly in page code.
- Re-export generated schema types as clearer feature aliases.
- Define UI-only types such as form values, filter state, selected rows, tree
  nodes, or derived table models.

Example aliasing is acceptable when it improves readability:

```ts
import type { UserResponseDto, CreateUserDto } from '../../generated/api'

export type UserRecord = UserResponseDto
export type CreateUserRequest = CreateUserDto
```

New modules should start with generated hooks and add local facades only after
a real composition need appears.

## Auth Module Rules

Auth and session behavior is special. Generated auth operations may be used,
but session storage, startup checks, refresh coordination, and logout cleanup
remain application concerns.

Rules:

- Login should store the generated login response in the auth store.
- Refresh should be called by the mutator and by any explicit startup/session
  check that needs it.
- Logout should clear session state and query cache after the backend logout
  completes or if the user must be forced anonymous.
- `/auth/login`, `/auth/refresh`, and `/auth/logout` should not trigger
  automatic refresh/replay loops.

The API contract can be generated, but the frontend session lifecycle remains
owned by `auth-store`, `query-client`, and `api-mutator`.

## Migration Plan

Migrate in phases.

### Phase 1: Generation Infrastructure

- Extract shared OpenAPI document creation.
- Add `openapi:generate`.
- Install and configure Orval.
- Add frontend `api:generate`.
- Add root `api:generate` and `api:check`.
- Commit initial `apps/api/openapi.json`.
- Commit initial `apps/admin/src/generated/api/`.
- Do not migrate pages yet.

### Phase 2: Custom Mutator

- Add `apps/admin/src/app/api-mutator.ts`.
- Move token injection, refresh, 401 replay, session reset, and cache clearing
  behavior into the mutator.
- Add focused mutator tests.
- Confirm generated hooks use the mutator.

### Phase 3: Page Migration

Migrate modules in this order:

```text
auth/session
users
roles and permissions
dictionaries
files
audit logs
```

This order validates the riskiest foundations first:

- Auth proves the mutator and session flow.
- Users proves normal CRUD and list query behavior.
- Roles and permissions prove arrays, enums, nested DTOs, and RBAC data.
- Dictionaries prove nested resources and options queries.
- Files prove multipart upload and blob download.
- Audit logs prove read-only list/detail flows.

Remove or slim old feature API and type files as each module migrates.

### Phase 4: Cleanup And Template Documentation

- Remove the old `createApiClient` and `apps/admin/src/lib/api.ts` once no
  page uses it.
- Remove trivial feature-local `.api.ts` wrappers.
- Convert duplicated API DTO types to generated imports or aliases.
- Document the new module workflow.
- Add `api:check` to CI after CI exists.
- Fix contract drift found during migration, including the reset-password
  return type mismatch.

## Testing Strategy

Do not write tests for generated code internals. Test the project-owned seams.

Backend:

- Existing controller and service tests continue to cover behavior.
- Add a focused test or script verification that OpenAPI JSON generation
  succeeds.
- Add targeted checks for special endpoints if needed, especially multipart
  upload, blob download, and stable operation ids.

Frontend:

- Add tests for `api-mutator.ts` covering:
  - token injection
  - no-token requests
  - 401 refresh and replay
  - refresh failure cleanup
  - concurrent 401 responses sharing one refresh call
  - login/refresh/logout skip rules
- Update page tests to mock generated hooks or the request layer instead of the
  old `api-client`.
- Keep page tests focused on UI behavior, not generated client mechanics.

Contract:

- `pnpm api:check` is the main drift check.
- It should regenerate OpenAPI and frontend API output, then fail on any
  uncommitted diff.

Recommended verification order:

```text
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

Run `api:check` first because stale contract output can create noisy downstream
type failures.

## Documentation Updates

Update README or a pattern guide with the standard new API workflow:

```text
1. Add or update backend DTOs and controller Swagger metadata.
2. Add stable operation ids.
3. Run pnpm api:generate.
4. Use generated React Query hooks in the admin page.
5. Add a feature-local facade only for real page-level composition.
6. Run pnpm api:check.
7. Run pnpm lint && pnpm test && pnpm build.
```

Also document these rules:

- Do not hand edit `apps/admin/src/generated/api/`.
- Do not hand edit `apps/api/openapi.json`.
- New simple modules should not create `xxx.api.ts`.
- API DTO types should come from generated schemas.
- UI-only state can stay in feature-local types.

## Risks And Mitigations

### Incomplete Swagger Metadata

Generated types are only as good as the OpenAPI document. Missing
`@ApiProperty` or response decorators can produce weak or wrong frontend types.

Mitigation:

- Add metadata completeness to the backend module checklist.
- Let `api:check` expose drift early.
- Add targeted OpenAPI checks for special endpoints.

### Unstable Generated Names

If operation ids are accidental, generated hook imports will churn.

Mitigation:

- Use explicit operation ids or a stable operation id factory.
- Treat operation id changes as breaking frontend changes.

### Auth Refresh Complexity

Generated clients often assume simple request behavior. Common Admin needs
cookie refresh, token replay, and session cleanup.

Mitigation:

- Require all generated calls to use the custom mutator.
- Test the mutator independently.
- Keep auth skip rules explicit.

### File Endpoint Edge Cases

Multipart upload and blob download may need careful OpenAPI metadata and Orval
configuration.

Mitigation:

- Validate these endpoints during Phase 3.
- Allow a thin local facade for blob download if generated hooks are awkward.

### Test Migration Cost

Existing tests mock the handwritten API client. Migrating to generated hooks
will require one-time test updates.

Mitigation:

- Migrate tests per module.
- Mock generated hooks for page behavior.
- Keep mutator behavior covered separately.

## Success Criteria

The design is complete when:

- OpenAPI JSON can be generated without running a dev server.
- Orval generates React Query hooks into `apps/admin/src/generated/api/`.
- Generated requests use the project mutator.
- At least one CRUD module uses generated hooks directly.
- The old handwritten API client is removed after migration.
- `pnpm api:check` fails when OpenAPI or generated frontend output is stale.
- Documentation tells template users how to add a new API-backed module.
