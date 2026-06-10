# API Contract Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the handwritten admin API contract layer with OpenAPI-generated schema types, endpoint functions, React Query hooks, and query keys.

**Architecture:** Keep NestJS DTOs and Swagger decorators as the contract source, generate prefix-free OpenAPI JSON from the API package, then generate admin React Query hooks with Orval. All generated calls use one Axios mutator and one refresh coordinator so auth, refresh, 401 replay, cookies, upload/download, and cache cleanup remain project-owned behavior.

**Tech Stack:** NestJS 11, @nestjs/swagger, class-validator, Prisma, Redis, React 19, Vite, TypeScript, Axios, Orval, TanStack Query, Zustand, Vitest, React Testing Library, Jest.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-10-api-contract-generation-design.md`
- Existing Swagger setup: `apps/api/src/main.ts`
- Existing frontend API client: `apps/admin/src/lib/api.ts`
- Existing frontend API client tests: `apps/admin/src/lib/api.test.ts`
- Existing auth store: `apps/admin/src/stores/auth-store.ts`
- Existing router startup refresh: `apps/admin/src/routes/router.tsx`
- Existing query client: `apps/admin/src/app/query-client.ts`
- Existing file upload FormData convention: `apps/admin/src/features/files/FileUploadDialog.tsx`
- Orval docs: `https://orval.dev/reference/configuration/output`
- Orval custom Axios docs: `https://orval.dev/guides/custom-axios`
- Orval React Query docs: `https://orval.dev/guides/react-query`

## File Structure

### Create

- `apps/api/src/openapi.ts`: shared OpenAPI document creation, prefix policy, and path assertions.
- `apps/api/src/openapi.spec.ts`: tests for prefix-free OpenAPI paths and expected operation ids.
- `apps/api/scripts/generate-openapi.ts`: writes `apps/api/openapi.json` without running a dev server.
- `apps/api/openapi.json`: generated OpenAPI contract committed to the repository.
- `apps/admin/orval.config.ts`: Orval config for generated React Query hooks, schemas, query keys, and mutator usage.
- `apps/admin/src/app/api-refresh-coordinator.ts`: shared refresh coordinator for startup checks and 401 replay.
- `apps/admin/src/app/api-refresh-coordinator.test.ts`: coordinator tests.
- `apps/admin/src/app/api-mutator.ts`: Orval mutator and Axios instance.
- `apps/admin/src/app/api-mutator.test.ts`: mutator tests.
- `apps/admin/src/generated/api/`: generated Orval output.
- `docs/patterns/admin-api-contract-generation-guide.md`: template workflow for adding API-backed modules.

### Modify

- `package.json`: add root `api:generate` and `api:check` scripts.
- `apps/api/package.json`: add `openapi:generate` script.
- `apps/api/src/main.ts`: use the shared OpenAPI helper.
- `apps/api/src/*/*controller.ts`: add explicit `@ApiOperation({ operationId })` to all current endpoints.
- `apps/api/src/file/file.controller.ts`: add explicit multipart upload and binary download OpenAPI metadata.
- `apps/admin/package.json`: add Orval dev dependency and `api:generate` script.
- `apps/admin/src/routes/router.tsx`: replace direct `api.refresh()` startup check with the shared refresh coordinator.
- `apps/admin/src/features/auth/LoginView.tsx`: migrate login to generated mutation and session storage.
- `apps/admin/src/features/users/*`: migrate users page to generated hooks and generated schema types.
- `apps/admin/src/features/roles/*`: migrate roles and permissions to generated hooks and generated query keys.
- `apps/admin/src/features/dictionaries/*`: migrate dictionaries to generated hooks and generated query keys.
- `apps/admin/src/features/files/*`: migrate files to generated hooks, `FormData` upload, and blob download override.
- `apps/admin/src/features/audit-logs/*`: migrate audit logs to generated hooks.
- `apps/admin/src/lib/dictionaries/*`: replace dictionary option wrappers with generated hooks or generated type aliases.
- `apps/admin/src/types/auth.ts`: replace duplicated DTO shapes with generated aliases where practical.
- `README.md` or `apps/admin/README.md`: link the new API contract guide.
- `docs/common-admin-next-steps.md`: mark API contract/type generation as designed or in progress.

### Delete After Migration

- `apps/admin/src/app/api-client.ts`
- `apps/admin/src/lib/api.ts`
- `apps/admin/src/lib/api.test.ts`
- trivial `apps/admin/src/features/*/*.api.ts` files that only forward requests
- duplicated API DTO definitions in feature `.types.ts` files

Do not delete old files until every import has migrated and `pnpm --filter admin test` plus `pnpm --filter admin build` pass.

## Chunk 1: Backend OpenAPI Contract Generation

### Task 1: Extract Shared OpenAPI Helper

**Files:**
- Create: `apps/api/src/openapi.ts`
- Modify: `apps/api/src/main.ts`
- Test: `apps/api/src/main.spec.ts`

- [ ] **Step 1: Write or update the failing test**

Update `apps/api/src/main.spec.ts` or add a focused `apps/api/src/openapi.spec.ts` test that imports `createOpenApiDocument` and verifies it is exported.

Example expectation:

```ts
import { createOpenApiDocument } from './openapi';

describe('openapi helper', () => {
  it('exports a document factory', () => {
    expect(createOpenApiDocument).toEqual(expect.any(Function));
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm --filter api test -- openapi.spec.ts
```

Expected: FAIL because `apps/api/src/openapi.ts` does not exist.

- [ ] **Step 3: Implement `apps/api/src/openapi.ts`**

Create a helper that contains the current `DocumentBuilder` setup from `main.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Common Admin API')
    .setDescription('API for the common admin starter template')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: true,
  });
}

export function assertPrefixFreeOpenApiPaths(document: {
  paths?: Record<string, unknown>;
}) {
  const prefixedPaths = Object.keys(document.paths ?? {}).filter((path) =>
    path.startsWith('/api/'),
  );

  if (prefixedPaths.length > 0) {
    throw new Error(
      `OpenAPI paths must not include /api prefix: ${prefixedPaths.join(', ')}`,
    );
  }
}
```

Use `ignoreGlobalPrefix: true` so OpenAPI paths stay resource-relative while the frontend base URL owns `/api`.

- [ ] **Step 4: Modify `main.ts`**

Replace inline Swagger document creation in `apps/api/src/main.ts` with:

```ts
import { createOpenApiDocument } from './openapi';

const document = createOpenApiDocument(app);
SwaggerModule.setup('api/docs', app, document);
```

Keep `app.setGlobalPrefix('api')` unchanged for runtime routes.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter api test -- main.spec.ts openapi.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/openapi.ts apps/api/src/main.ts apps/api/src/main.spec.ts apps/api/src/openapi.spec.ts
git commit -m "feat(api): share openapi document setup"
```

### Task 2: Add Explicit Operation IDs

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/user/user.controller.ts`
- Modify: `apps/api/src/role/role.controller.ts`
- Modify: `apps/api/src/permission/permission.controller.ts`
- Modify: `apps/api/src/dictionary/*.controller.ts`
- Modify: `apps/api/src/file/file.controller.ts`
- Modify: `apps/api/src/audit-log/audit-log.controller.ts`
- Modify: `apps/api/src/health/health.controller.ts`
- Test: `apps/api/src/openapi.spec.ts`

- [ ] **Step 1: Write failing operation id coverage test**

Add a test that creates a testing Nest app, calls `createOpenApiDocument`, and asserts that all expected operation ids exist exactly once.

Expected operation ids:

```ts
const expectedOperationIds = [
  'checkHealth',
  'login',
  'refreshSession',
  'logout',
  'changePassword',
  'getCurrentUser',
  'listUsers',
  'getUser',
  'createUser',
  'updateUser',
  'deleteUser',
  'replaceUserRoles',
  'resetUserPassword',
  'listRoles',
  'getRole',
  'createRole',
  'updateRole',
  'deleteRole',
  'replaceRolePermissions',
  'listPermissions',
  'listPermissionModules',
  'getDictionaryOptionsMap',
  'getDictionaryOptions',
  'listDictionaryTypes',
  'getDictionaryType',
  'createDictionaryType',
  'updateDictionaryType',
  'deleteDictionaryType',
  'listDictionaryItems',
  'getDictionaryItem',
  'createDictionaryItem',
  'updateDictionaryItem',
  'deleteDictionaryItem',
  'listFiles',
  'getFile',
  'uploadFile',
  'updateFile',
  'deleteFile',
  'downloadFile',
  'listAuditLogs',
  'getAuditLog',
];
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm --filter api test -- openapi.spec.ts
```

Expected: FAIL because controllers do not yet define explicit operation ids.

- [ ] **Step 3: Add `ApiOperation` decorators**

Import `ApiOperation` from `@nestjs/swagger` in each controller and add explicit operation ids from the spec table.

Example:

```ts
@ApiOperation({ operationId: 'listUsers' })
@ApiOkResponse({ type: UserListResponseDto })
@Get()
listUsers(...)
```

Do not use a method-name operation id factory.

- [ ] **Step 4: Run the operation id test**

Run:

```bash
pnpm --filter api test -- openapi.spec.ts
```

Expected: PASS and every expected operation id appears once.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src apps/api/src/openapi.spec.ts
git commit -m "feat(api): add stable openapi operation ids"
```

### Task 3: Add OpenAPI Generation Script

**Files:**
- Create: `apps/api/scripts/generate-openapi.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/openapi.json`
- Test: `apps/api/src/openapi.spec.ts`

- [ ] **Step 1: Add failing prefix assertion test**

In `apps/api/src/openapi.spec.ts`, add a test for `assertPrefixFreeOpenApiPaths`:

```ts
expect(() =>
  assertPrefixFreeOpenApiPaths({ paths: { '/api/users': {} } }),
).toThrow('/api prefix');
```

- [ ] **Step 2: Run the test and verify it passes after Task 1 helper exists**

Run:

```bash
pnpm --filter api test -- openapi.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Create generation script**

Create `apps/api/scripts/generate-openapi.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  assertPrefixFreeOpenApiPaths,
  createOpenApiDocument,
} from '../src/openapi';

async function main() {
  process.env.NODE_ENV ??= 'test';

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const document = createOpenApiDocument(app);
  assertPrefixFreeOpenApiPaths(document);

  const outputPath = resolve(__dirname, '../openapi.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

If this script attempts to connect to Postgres or Redis, stop and add generation-mode provider overrides before proceeding. Do not require external services for OpenAPI generation.

- [ ] **Step 4: Add API package script**

Modify `apps/api/package.json`:

```json
{
  "openapi:generate": "ts-node scripts/generate-openapi.ts"
}
```

- [ ] **Step 5: Generate OpenAPI JSON**

Run:

```bash
pnpm --filter api openapi:generate
```

Expected: creates `apps/api/openapi.json`; generated paths include `/users`, not `/api/users`.

- [ ] **Step 6: Verify generated JSON**

Run:

```bash
node -e "const d=require('./apps/api/openapi.json'); const bad=Object.keys(d.paths||{}).filter(p=>p.startsWith('/api/')); if (bad.length) throw new Error(bad.join(',')); console.log(Object.keys(d.paths||{}).length)"
```

Expected: prints a positive number and exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/scripts/generate-openapi.ts apps/api/package.json apps/api/openapi.json apps/api/src/openapi.spec.ts
git commit -m "feat(api): generate openapi contract"
```

## Chunk 2: Orval Generation And Request Runtime

### Task 4: Configure Orval

**Files:**
- Modify: `apps/admin/package.json`
- Create: `apps/admin/orval.config.ts`
- Create: `apps/admin/src/generated/api/`
- Modify: `package.json`

- [ ] **Step 1: Install Orval**

Run:

```bash
pnpm --filter admin add -D orval
```

Expected: `apps/admin/package.json` and `pnpm-lock.yaml` update.

- [ ] **Step 2: Create a placeholder mutator**

Create `apps/admin/src/app/api-mutator.ts` temporarily:

```ts
import type { AxiosRequestConfig } from 'axios'

export async function apiMutator<T>(
  _config: AxiosRequestConfig,
): Promise<T> {
  throw new Error('apiMutator is not implemented yet')
}
```

This lets Orval resolve the mutator path before the real implementation.

- [ ] **Step 3: Add Orval config**

Create `apps/admin/orval.config.ts`:

```ts
import { defineConfig } from 'orval'

export default defineConfig({
  commonAdminApi: {
    input: {
      target: '../api/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/generated/api/endpoints',
      schemas: 'src/generated/api/schemas',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/app/api-mutator.ts',
          name: 'apiMutator',
        },
        operations: {
          downloadFile: {
            requestOptions: {
              responseType: 'blob',
            },
          },
        },
      },
    },
  },
})
```

If the installed Orval version expects a slightly different override shape, follow the installed package types and keep the behavior: generated calls use `apiMutator`, and `downloadFile` requests blobs.

- [ ] **Step 4: Add scripts**

Modify `apps/admin/package.json`:

```json
{
  "api:generate": "orval --config orval.config.ts"
}
```

Modify root `package.json`:

```json
{
  "api:generate": "pnpm --filter api openapi:generate && pnpm --filter admin api:generate",
  "api:check": "pnpm api:generate && git diff --exit-code apps/api/openapi.json apps/admin/src/generated/api"
}
```

- [ ] **Step 5: Generate frontend API**

Run:

```bash
pnpm api:generate
```

Expected: `apps/admin/src/generated/api/` is created, generated hooks are present, and generated paths are not `/api/...`.

- [ ] **Step 6: Run typecheck/build**

Run:

```bash
pnpm --filter admin build
```

Expected: may FAIL because placeholder mutator throws at runtime but should typecheck. If type errors appear from Orval config, fix config to match installed Orval types.

- [ ] **Step 7: Commit**

```bash
git add package.json apps/admin/package.json pnpm-lock.yaml apps/admin/orval.config.ts apps/admin/src/app/api-mutator.ts apps/admin/src/generated/api apps/api/openapi.json
git commit -m "feat(admin): generate api hooks with orval"
```

### Task 5: Add Refresh Coordinator

**Files:**
- Create: `apps/admin/src/app/api-refresh-coordinator.ts`
- Create: `apps/admin/src/app/api-refresh-coordinator.test.ts`
- Modify later: `apps/admin/src/routes/router.tsx`

- [ ] **Step 1: Write failing coordinator tests**

Create `apps/admin/src/app/api-refresh-coordinator.test.ts` covering:

- concurrent calls share one refresh request;
- successful refresh stores the session;
- failed refresh calls unauthorized cleanup;
- a later call after failure can attempt refresh again.

Example:

```ts
const refresh = vi.fn().mockResolvedValue(session)
const setSession = vi.fn()
const onUnauthorized = vi.fn()
const coordinator = createRefreshCoordinator({
  refresh,
  setSession,
  onUnauthorized,
})

await Promise.all([coordinator.refresh(), coordinator.refresh()])

expect(refresh).toHaveBeenCalledOnce()
expect(setSession).toHaveBeenCalledWith(session)
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm --filter admin test -- src/app/api-refresh-coordinator.test.ts
```

Expected: FAIL because the coordinator does not exist.

- [ ] **Step 3: Implement coordinator**

Create `apps/admin/src/app/api-refresh-coordinator.ts`:

```ts
import type { AuthSession } from '../types/auth'

interface RefreshCoordinatorOptions {
  refresh: () => Promise<AuthSession>
  setSession: (session: AuthSession) => void
  onUnauthorized: () => void
}

export function createRefreshCoordinator({
  refresh,
  setSession,
  onUnauthorized,
}: RefreshCoordinatorOptions) {
  let refreshPromise: Promise<AuthSession> | null = null

  async function refreshSession() {
    if (!refreshPromise) {
      refreshPromise = refresh()
        .then((session) => {
          setSession(session)
          return session
        })
        .catch((error: unknown) => {
          onUnauthorized()
          throw error
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    return refreshPromise
  }

  return { refresh: refreshSession }
}
```

Export a singleton later only after the mutator can provide the actual refresh HTTP call.

- [ ] **Step 4: Run coordinator tests**

Run:

```bash
pnpm --filter admin test -- src/app/api-refresh-coordinator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/api-refresh-coordinator.ts apps/admin/src/app/api-refresh-coordinator.test.ts
git commit -m "feat(admin): add api refresh coordinator"
```

### Task 6: Implement API Mutator

**Files:**
- Modify: `apps/admin/src/app/api-mutator.ts`
- Create: `apps/admin/src/app/api-mutator.test.ts`
- Modify: `apps/admin/src/routes/router.tsx`

- [ ] **Step 1: Write failing mutator tests**

Create `apps/admin/src/app/api-mutator.test.ts` covering:

- `Authorization` header is added when an access token exists;
- no header is added when no token exists;
- ordinary 401 calls the shared refresh coordinator and replays once;
- refresh failure clears auth and query cache;
- login, refresh, and logout requests are not replayed through refresh;
- blob request options are forwarded.

Use a mocked Axios adapter or a mocked Axios instance. Do not hit a network.

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm --filter admin test -- src/app/api-mutator.test.ts
```

Expected: FAIL because `api-mutator.ts` is still a placeholder.

- [ ] **Step 3: Implement Axios mutator**

Implement `apps/admin/src/app/api-mutator.ts` with these rules:

- `baseURL` is `import.meta.env.VITE_API_BASE_URL ?? '/api'`;
- requests use `withCredentials: true` where needed;
- access token comes from `useAuthStore.getState().accessToken`;
- refresh uses a bare request to `/auth/refresh` and stores the returned session;
- failed refresh calls `useAuthStore.getState().setAnonymous()` and `clearQueryCache()`;
- replay uses the original config after refresh;
- skip automatic refresh for `/auth/login`, `/auth/refresh`, and `/auth/logout`;
- return `response.data`.

Keep upload convention as direct `FormData`. Do not convert typed upload payloads in the mutator for the first version.

- [ ] **Step 4: Update startup refresh**

Modify `apps/admin/src/routes/router.tsx` so startup session checks call the same refresh coordinator path instead of `api.refresh()` from the old API client.

Expected behavior remains:

- initial `checking` status triggers one refresh;
- success stores session;
- failure sets anonymous;
- router invalidates after auth status/permissions change.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter admin test -- src/app/api-mutator.test.ts src/app/api-refresh-coordinator.test.ts src/routes/router.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Regenerate API**

Run:

```bash
pnpm --filter admin api:generate
```

Expected: generated calls still import `apiMutator`.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/app/api-mutator.ts apps/admin/src/app/api-mutator.test.ts apps/admin/src/app/api-refresh-coordinator.ts apps/admin/src/app/api-refresh-coordinator.test.ts apps/admin/src/routes/router.tsx apps/admin/src/generated/api
git commit -m "feat(admin): route generated api through auth mutator"
```

## Chunk 3: Auth And CRUD Migration

### Task 7: Migrate Auth Session Calls

**Files:**
- Modify: `apps/admin/src/features/auth/LoginView.tsx`
- Modify: `apps/admin/src/features/auth/LoginView.test.tsx`
- Modify: `apps/admin/src/types/auth.ts`
- Modify: `apps/admin/src/routes/router.tsx`

- [ ] **Step 1: Update tests first**

Change login tests to mock generated auth mutation or the mutator-backed login function, not `api.login`.

Run:

```bash
pnpm --filter admin test -- src/features/auth/LoginView.test.tsx src/routes/router.test.tsx
```

Expected: FAIL until the component imports generated hooks/functions.

- [ ] **Step 2: Migrate login**

Use the generated login mutation/function from `apps/admin/src/generated/api/`. On success:

- call `clearQueryCache()`;
- call `useAuthStore.getState().setSession(session)`;
- navigate to `getFirstAccessibleRoute(session.user.permissions)?.path ?? '/403'`.

- [ ] **Step 3: Replace duplicated auth DTOs with generated aliases where practical**

In `apps/admin/src/types/auth.ts`, prefer aliases from generated schemas for `AuthSession` and `UserProfile`. Keep UI-only `AuthStatus`.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter admin test -- src/features/auth/LoginView.test.tsx src/routes/router.test.tsx src/stores/auth-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/auth apps/admin/src/types/auth.ts apps/admin/src/routes/router.tsx
git commit -m "feat(admin): migrate auth to generated api"
```

### Task 8: Migrate Users

**Files:**
- Modify: `apps/admin/src/features/users/UsersPage.tsx`
- Modify: `apps/admin/src/features/users/UserForm.tsx`
- Modify: `apps/admin/src/features/users/users.columns.tsx`
- Modify: `apps/admin/src/features/users/users.types.ts`
- Modify: `apps/admin/src/features/users/UsersPage.test.tsx`
- Delete after migration: `apps/admin/src/features/users/users.api.ts`

- [ ] **Step 1: Update tests to mock generated hooks**

Replace `api-client` mocks with generated hook/function mocks.

Run:

```bash
pnpm --filter admin test -- src/features/users/UsersPage.test.tsx
```

Expected: FAIL until page code migrates.

- [ ] **Step 2: Replace list/create/update/delete/reset/role assignment calls**

Use generated hooks for:

- `listUsers`
- `createUser`
- `updateUser`
- `deleteUser`
- `replaceUserRoles`
- `resetUserPassword`

Use generated query key helpers for invalidating the users list after mutations.

- [ ] **Step 3: Replace users types**

Convert `users.types.ts` to generated aliases plus UI-only types only.

- [ ] **Step 4: Run users tests**

```bash
pnpm --filter admin test -- src/features/users/UsersPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/users
git rm apps/admin/src/features/users/users.api.ts
git commit -m "feat(admin): migrate users to generated api"
```

### Task 9: Migrate Roles And Permissions

**Files:**
- Modify: `apps/admin/src/features/roles/*`
- Modify: `apps/admin/src/features/permissions/*`
- Modify: `apps/admin/src/features/roles/roles.types.ts`
- Modify: `apps/admin/src/features/roles/RolesPage.test.tsx`
- Modify: `apps/admin/src/features/permissions/PermissionsPage.test.tsx`
- Delete after migration: `apps/admin/src/features/roles/roles.api.ts`
- Delete after migration: `apps/admin/src/features/permissions/permissions.api.ts`

- [ ] **Step 1: Update tests to mock generated hooks**

Run:

```bash
pnpm --filter admin test -- src/features/roles/RolesPage.test.tsx src/features/permissions/PermissionsPage.test.tsx
```

Expected: FAIL until page code migrates.

- [ ] **Step 2: Replace role and permission API calls**

Use generated hooks/functions for:

- `listRoles`
- `getRole`
- `createRole`
- `updateRole`
- `deleteRole`
- `replaceRolePermissions`
- `listPermissions`
- `listPermissionModules`

Use generated query key helpers for invalidation.

- [ ] **Step 3: Replace duplicated types**

Keep only UI-specific role permission tree/form state types. Use generated schemas for API records and payloads.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter admin test -- src/features/roles/RolesPage.test.tsx src/features/permissions/PermissionsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/roles apps/admin/src/features/permissions
git rm apps/admin/src/features/roles/roles.api.ts apps/admin/src/features/permissions/permissions.api.ts
git commit -m "feat(admin): migrate roles permissions to generated api"
```

### Task 10: Migrate Dictionaries

**Files:**
- Modify: `apps/admin/src/features/dictionaries/*`
- Modify: `apps/admin/src/lib/dictionaries/*`
- Modify: `apps/admin/src/features/dictionaries/DictionariesPage.test.tsx`
- Modify: `apps/admin/src/lib/dictionaries/useDictionary.test.tsx`
- Delete after migration: `apps/admin/src/features/dictionaries/dictionaries.api.ts`
- Delete after migration: `apps/admin/src/lib/dictionaries/dictionaries.api.ts`

- [ ] **Step 1: Update dictionary tests**

Run:

```bash
pnpm --filter admin test -- src/features/dictionaries/DictionariesPage.test.tsx src/lib/dictionaries/useDictionary.test.tsx
```

Expected: FAIL until dictionary calls migrate.

- [ ] **Step 2: Replace dictionary API calls**

Use generated hooks/functions for:

- `getDictionaryOptionsMap`
- `getDictionaryOptions`
- `listDictionaryTypes`
- `getDictionaryType`
- `createDictionaryType`
- `updateDictionaryType`
- `deleteDictionaryType`
- `listDictionaryItems`
- `getDictionaryItem`
- `createDictionaryItem`
- `updateDictionaryItem`
- `deleteDictionaryItem`

Use generated query keys for invalidating type lists, item lists, and options.

- [ ] **Step 3: Keep UI-only dictionary helpers**

Keep `dictionary-label.ts` and UI-only types if they transform options for display. Replace API DTO types with generated schema imports.

- [ ] **Step 4: Run dictionary tests**

```bash
pnpm --filter admin test -- src/features/dictionaries/DictionariesPage.test.tsx src/lib/dictionaries/useDictionary.test.tsx src/lib/dictionaries/dictionary-label.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/dictionaries apps/admin/src/lib/dictionaries
git rm apps/admin/src/features/dictionaries/dictionaries.api.ts apps/admin/src/lib/dictionaries/dictionaries.api.ts
git commit -m "feat(admin): migrate dictionaries to generated api"
```

### Task 11: Migrate Files

**Files:**
- Modify: `apps/api/src/file/file.controller.ts`
- Modify: `apps/admin/orval.config.ts`
- Modify: `apps/admin/src/features/files/*`
- Modify: `apps/admin/src/features/files/FilesPage.test.tsx`
- Delete after migration: `apps/admin/src/features/files/files.api.ts`

- [ ] **Step 1: Add file OpenAPI metadata tests**

Extend `apps/api/src/openapi.spec.ts` to assert:

- `uploadFile` request body consumes `multipart/form-data`;
- `downloadFile` response includes binary content metadata.

Run:

```bash
pnpm --filter api test -- openapi.spec.ts
```

Expected: FAIL until file metadata is complete.

- [ ] **Step 2: Complete file endpoint metadata**

Ensure `apps/api/src/file/file.controller.ts` declares:

- `@ApiConsumes('multipart/form-data')`;
- `@ApiBody(...)` with binary `file` plus metadata fields;
- `@ApiOkResponse(...)` or explicit response content for binary download.

- [ ] **Step 3: Regenerate API**

Run:

```bash
pnpm api:generate
```

Expected: `uploadFile` supports the chosen `FormData` convention; `downloadFile` uses blob response options through Orval override.

- [ ] **Step 4: Update file page tests**

Run:

```bash
pnpm --filter admin test -- src/features/files/FilesPage.test.tsx
```

Expected: FAIL until file page migrates.

- [ ] **Step 5: Migrate file page**

Use generated hooks/functions for:

- `listFiles`
- `getFile`
- `uploadFile`
- `updateFile`
- `deleteFile`
- `downloadFile`

Keep direct `FormData` upload from `FileUploadDialog`. If browser file-save behavior needs local logic, create a thin feature-local helper that calls generated `downloadFile`.

- [ ] **Step 6: Run file tests**

```bash
pnpm --filter api test -- openapi.spec.ts
pnpm --filter admin test -- src/features/files/FilesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/file/file.controller.ts apps/api/src/openapi.spec.ts apps/api/openapi.json apps/admin/orval.config.ts apps/admin/src/generated/api apps/admin/src/features/files
git rm apps/admin/src/features/files/files.api.ts
git commit -m "feat(admin): migrate files to generated api"
```

### Task 12: Migrate Audit Logs

**Files:**
- Modify: `apps/admin/src/features/audit-logs/*`
- Modify: `apps/admin/src/features/audit-logs/AuditLogsPage.test.tsx`
- Delete after migration: `apps/admin/src/features/audit-logs/audit-logs.api.ts`

- [ ] **Step 1: Update tests**

Run:

```bash
pnpm --filter admin test -- src/features/audit-logs/AuditLogsPage.test.tsx
```

Expected: FAIL until audit log calls migrate.

- [ ] **Step 2: Replace audit log API calls**

Use generated hooks/functions for:

- `listAuditLogs`
- `getAuditLog`

Use generated query key helpers for list/detail invalidation if needed.

- [ ] **Step 3: Replace duplicated types**

Use generated schemas for audit log records and list responses. Keep UI-only filter state types if needed.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter admin test -- src/features/audit-logs/AuditLogsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/audit-logs
git rm apps/admin/src/features/audit-logs/audit-logs.api.ts
git commit -m "feat(admin): migrate audit logs to generated api"
```

## Chunk 4: Cleanup, Docs, And Quality Gate

### Task 13: Remove Old Handwritten API Client

**Files:**
- Delete: `apps/admin/src/app/api-client.ts`
- Delete: `apps/admin/src/lib/api.ts`
- Delete: `apps/admin/src/lib/api.test.ts`
- Modify: any remaining imports found by `rg`

- [ ] **Step 1: Search for old API imports**

Run:

```bash
rg -n "app/api-client|lib/api|createApiClient|api\\." apps/admin/src
```

Expected: only obsolete files match before deletion.

- [ ] **Step 2: Delete old API client files**

Run:

```bash
git rm apps/admin/src/app/api-client.ts apps/admin/src/lib/api.ts apps/admin/src/lib/api.test.ts
```

- [ ] **Step 3: Run targeted checks**

Run:

```bash
pnpm --filter admin test
pnpm --filter admin build
```

Expected: PASS. If imports remain, replace them with generated hooks/functions or the mutator/coordinator.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src
git commit -m "refactor(admin): remove handwritten api client"
```

### Task 14: Add Contract Generation Documentation

**Files:**
- Create: `docs/patterns/admin-api-contract-generation-guide.md`
- Modify: `README.md`
- Modify: `apps/admin/README.md`
- Modify: `docs/common-admin-next-steps.md`

- [ ] **Step 1: Write guide**

Create `docs/patterns/admin-api-contract-generation-guide.md` with:

- contract source: backend DTO/controller Swagger metadata;
- operation id naming rule;
- prefix policy: OpenAPI paths are prefix-free, frontend base URL owns `/api`;
- command workflow: `pnpm api:generate`, `pnpm api:check`;
- generated code rule: do not hand edit `apps/admin/src/generated/api/`;
- page rule: default to generated hooks directly;
- invalidation rule: use generated query key helpers or project adapter;
- facade rule: only for real page-level composition;
- upload rule: first version uses direct `FormData`;
- download rule: `downloadFile` requests blobs.

- [ ] **Step 2: Link guide from README files**

Add a short section to `README.md` and `apps/admin/README.md` pointing to the guide and listing the two commands:

```bash
pnpm api:generate
pnpm api:check
```

- [ ] **Step 3: Update next steps**

In `docs/common-admin-next-steps.md`, update section 6 to point at:

- `docs/superpowers/specs/2026-06-10-api-contract-generation-design.md`
- `docs/superpowers/plans/2026-06-10-api-contract-generation.md`
- `docs/patterns/admin-api-contract-generation-guide.md`

- [ ] **Step 4: Commit**

```bash
git add README.md apps/admin/README.md docs/common-admin-next-steps.md docs/patterns/admin-api-contract-generation-guide.md
git commit -m "docs: add api contract generation guide"
```

### Task 15: Add Final Quality Gate

**Files:**
- Modify: `package.json`
- Modify: CI file if one exists later

- [ ] **Step 1: Run full contract check**

Run:

```bash
pnpm api:check
```

Expected: PASS with no generated diff.

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 3: Check old API layer is gone**

Run:

```bash
test ! -f apps/admin/src/lib/api.ts
test ! -f apps/admin/src/app/api-client.ts
rg -n "createApiClient|app/api-client|lib/api" apps/admin/src && exit 1 || true
```

Expected: exits 0.

- [ ] **Step 4: Check generated output is committed**

Run:

```bash
git status --short
```

Expected: no uncommitted changes after generation and verification.

- [ ] **Step 5: Commit any final script or docs adjustments**

```bash
git add package.json pnpm-lock.yaml docs apps/api/openapi.json apps/admin/src/generated/api
git commit -m "chore: enforce api contract generation"
```

Skip this commit if there are no changes.

## Execution Notes

- Keep commits small and close to the tasks above.
- Do not hand edit generated files. Change DTOs, Swagger metadata, or Orval config, then rerun generation.
- Do not add compatibility wrappers for the old API client.
- Use generated query key helpers for invalidation. If Orval output is awkward, add a tiny project adapter around generated keys instead of writing raw strings in pages.
- If `apps/api/scripts/generate-openapi.ts` requires DB or Redis, stop and fix that before any frontend migration.
- If Orval output names differ from the expected operation ids, fix backend `@ApiOperation` metadata rather than renaming imports locally.
- If file download generation is awkward, keep a thin feature-local download helper, but make it call the generated operation or mutator path.
