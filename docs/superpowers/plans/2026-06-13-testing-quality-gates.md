# Testing Quality Gates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standard local and CI quality gate for Common Admin, expand API e2e boundary coverage, and document minimum test requirements for future CRUD modules.

**Architecture:** Keep the gate built from existing workspace commands and add one root `pnpm quality` command plus a GitHub Actions workflow that runs the same sequence. Expand the existing API e2e suite with explicit provider overrides so auth, permission, session, and normalized error behavior are tested through HTTP without relying on local PostgreSQL or Redis. Update the development and CRUD guides so the gate becomes a reusable template rule rather than a one-off convention.

**Tech Stack:** pnpm workspaces, GitHub Actions, Node.js 24 LTS, NestJS 11, Jest, Supertest, Prisma service mocks, Redis provider overrides, Vitest, React Testing Library, Orval/OpenAPI contract generation.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-13-testing-quality-gates-design.md`
- Development guide: `docs/development/common-admin-development-guide.md`
- CRUD pattern guide: `docs/patterns/admin-crud-table-pattern-guide.md`
- Next steps index: `docs/common-admin-next-steps.md`
- Root scripts: `package.json`
- API scripts: `apps/api/package.json`
- Existing API e2e file: `apps/api/test/app.e2e-spec.ts`
- API e2e Jest config: `apps/api/test/jest-e2e.json`
- Existing auth flow test fixtures: `apps/api/src/auth/auth-flow.spec.ts`
- Shared app setup: `apps/api/src/app.setup.ts`
- App module providers: `apps/api/src/app.module.ts`
- Redis provider token: `apps/api/src/redis/redis.constants.ts`
- Permission service: `apps/api/src/permission/permission.service.ts`
- User controller protected endpoints: `apps/api/src/user/user.controller.ts`
- Existing error flow examples: `apps/api/src/common/errors/error-flow.spec.ts`

## Implementation Decisions

- Use Node.js 24 LTS in GitHub Actions. As of 2026-06-13, Node 24 is the current LTS line and the project does not define `.nvmrc`, `.node-version`, `mise.toml`, or `engines.node`.
- Keep CI service-free in the first version. Do not add PostgreSQL or Redis service containers.
- Do not add Playwright in this plan. Leave it as the explicit second-stage follow-up described by the spec.
- Do not add coverage thresholds. Use checklist-based module requirements instead.
- Keep API e2e tests in `apps/api/test/app.e2e-spec.ts` for the first version. Add local helpers inside that file first; split into separate helper files only if the file becomes hard to review during implementation.
- Use `configureApp(app, configService)` in API e2e so the tests exercise the same global prefix, cookie parser, validation pipe, global exception filter, request id middleware, and CORS behavior as runtime bootstrap.
- Override both `PrismaService` and `REDIS_CLIENT` in API e2e. Also override `PermissionService` when the test needs exact permission contexts without exercising Redis cache internals.
- Use `/api/users` as the representative permission-protected resource because it already has `@Permissions('user.read')` and simple list semantics.
- Use login, refresh, and logout e2e with an in-memory `userSession` mock adapted from `apps/api/src/auth/auth-flow.spec.ts`.
- Use invalid login payload for normalized validation error coverage because it exercises request validation and the global exception filter without needing a database operation.
- Run the final local gate with the new `pnpm quality` command. If that command exposes pre-existing failures, record exact failures before fixing or escalating.

## File Structure

### Create

- `.github/workflows/quality.yml`: GitHub Actions workflow for pull requests and pushes to `main`.
- `docs/superpowers/plans/2026-06-13-testing-quality-gates.md`: this implementation plan.

### Modify

- `package.json`: add root `quality` script.
- `apps/api/test/app.e2e-spec.ts`: expand API e2e coverage for health, auth, permission, refresh/logout, and normalized errors with explicit dependency overrides.
- `docs/development/common-admin-development-guide.md`: make `pnpm quality` the primary verification command and keep underlying commands for troubleshooting.
- `docs/patterns/admin-crud-table-pattern-guide.md`: add minimum backend and frontend testing checklist for new CRUD modules.
- `docs/common-admin-next-steps.md`: mark testing quality gates as designed/planned and leave Playwright as follow-up.

### Verify

- `pnpm --filter api test:e2e`
- `pnpm api:check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm quality`

## Chunk 1: Root Quality Command And CI Workflow

### Task 1: Add Root Quality Script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Inspect current root scripts**

Run:

```bash
node -e "const pkg = JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log(pkg.scripts)"
```

Expected: output includes `build`, `test`, `lint`, `api:generate`, and `api:check`, but not `quality`.

- [ ] **Step 2: Add the root `quality` script**

Modify root `package.json` so the scripts object includes:

```json
"quality": "pnpm api:check && pnpm lint && pnpm test && pnpm --filter api test:e2e && pnpm build"
```

Place it near the existing broad verification scripts:

```json
{
  "scripts": {
    "build": "pnpm -r --if-present build",
    "test": "pnpm -r --if-present test",
    "lint": "pnpm -r --if-present lint",
    "quality": "pnpm api:check && pnpm lint && pnpm test && pnpm --filter api test:e2e && pnpm build"
  }
}
```

Keep existing scripts unchanged.

- [ ] **Step 3: Validate root package JSON**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"
```

Expected: command exits with code 0.

- [ ] **Step 4: Verify the script is registered**

Run:

```bash
pnpm run | rg "^  quality|quality"
```

Expected: output includes the new `quality` script.

- [ ] **Step 5: Defer full execution to final verification**

Do not run `pnpm quality` in this task. The command depends on the expanded API
e2e coverage that is added in Chunk 2 and is verified in Chunk 4.

- [ ] **Step 6: Commit the quality script**

```bash
git add package.json
git commit -m "chore: add root quality gate script"
```

### Task 2: Add GitHub Actions Quality Workflow

**Files:**
- Create: `.github/workflows/quality.yml`

- [ ] **Step 1: Confirm workflow directory state**

Run:

```bash
find .github -maxdepth 3 -type f 2>/dev/null || true
```

Expected: either no output or no existing `quality.yml`.

- [ ] **Step 2: Create the workflow**

Create the workflow directory:

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/quality.yml`:

```yaml
name: Quality

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  quality:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.28.2

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check generated API contract
        run: pnpm api:check

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test

      - name: API e2e
        run: pnpm --filter api test:e2e

      - name: Build
        run: pnpm build
```

- [ ] **Step 3: Validate workflow syntax locally**

Run:

```bash
pnpm dlx actionlint .github/workflows/quality.yml
```

Expected: command exits with code 0.

Then verify project-specific workflow choices:

```bash
node -e "const fs = require('fs'); const text = fs.readFileSync('.github/workflows/quality.yml', 'utf8'); if (!/^name: Quality/m.test(text)) throw new Error('missing name'); if (!/node-version: 24/.test(text)) throw new Error('missing Node 24'); if (!/version: 10\\.28\\.2/.test(text)) throw new Error('missing pnpm version'); if (/services:/.test(text)) throw new Error('unexpected service containers');"
```

Expected: command exits with code 0.

- [ ] **Step 4: Inspect workflow for review**

Run:

```bash
sed -n '1,220p' .github/workflows/quality.yml
```

Expected: output shows the workflow above, with Node `24`, pnpm `10.28.2`, and no PostgreSQL or Redis service containers.

- [ ] **Step 5: Commit the workflow**

```bash
git add .github/workflows/quality.yml
git commit -m "ci: add quality workflow"
```

## Chunk 2: API E2E Boundary Coverage

### Task 3: Refactor API E2E Setup For Runtime-Like App Configuration

**Files:**
- Modify: `apps/api/test/app.e2e-spec.ts`

- [ ] **Step 1: Run the existing e2e test as a baseline**

Run:

```bash
pnpm --filter api test:e2e
```

Expected: PASS for the current health e2e test.

- [ ] **Step 2: Update imports and helper types**

Replace the existing minimal imports in `apps/api/test/app.e2e-spec.ts` with runtime-like setup imports:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PermissionService } from './../src/permission/permission.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { REDIS_CLIENT } from './../src/redis/redis.constants';
```

Add helper types below the imports:

```ts
type PersistedUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  roles: Array<{ role: { code: string; name: string } }>;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRecord = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
  revokedReason?: string | null;
  user?: PersistedUser;
};

type PermissionContext = {
  roleCodes: string[];
  permissionCodes: string[];
  isSuperAdmin: boolean;
};
```

- [ ] **Step 3: Add explicit environment setup**

Inside the e2e `describe`, add a saved-env helper:

```ts
const envKeys = [
  'ALLOWED_ORIGINS',
  'JWT_ACCESS_TOKEN_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
] as const;

const originalEnv = new Map<string, string | undefined>();

beforeAll(() => {
  envKeys.forEach((key) => originalEnv.set(key, process.env[key]));
  process.env.ALLOWED_ORIGINS = 'http://localhost:15173';
  process.env.JWT_ACCESS_TOKEN_SECRET = 'test-access-secret-change-me';
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@localhost:5432/test';
  process.env.REDIS_URL = 'redis://localhost:6379';
});

afterAll(() => {
  envKeys.forEach((key) => {
    const value = originalEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });
});
```

- [ ] **Step 4: Add reusable in-memory mocks**

Add these helpers in the same file:

```ts
function createRedisMock() {
  const values = new Map<string, string>();

  return {
    get: jest.fn(async (key: string) => values.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      values.delete(key);
      return 1;
    }),
    incr: jest.fn(async (key: string) => {
      const next = Number(values.get(key) ?? '0') + 1;
      values.set(key, String(next));
      return next;
    }),
    quit: jest.fn(),
  };
}

function createPrismaMock() {
  return {
    user: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    userRole: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    dictionaryType: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dictionaryItem: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    managedFile: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    systemSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}
```

If the current `PrismaService` shape has gained additional required model mocks by the time this plan is executed, add only the missing model methods that the e2e runtime touches.

- [ ] **Step 5: Add app lifecycle setup**

Replace the existing `beforeEach` app creation with `beforeAll` app creation plus per-test mock reset:

```ts
describe('Common Admin API (e2e)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  const prisma = createPrismaMock();
  const redis = createRedisMock();
  const sessions = new Map<string, SessionRecord>();
  const permissionContexts = new Map<string, PermissionContext>();
  const allowedOrigin = 'http://localhost:15173';

  const permissionService = {
    resolveUserPermissionContext: jest.fn(async (userId: string) => {
      const context = permissionContexts.get(userId) ?? {
        roleCodes: [],
        permissionCodes: [],
        isSuperAdmin: false,
      };

      return { userId, ...context };
    }),
    invalidateUserPermissionContext: jest.fn(),
    invalidateAllPermissionContexts: jest.fn(),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(REDIS_CLIENT)
      .useValue(redis)
      .overrideProvider(PermissionService)
      .useValue(permissionService)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessions.clear();
    permissionContexts.clear();
    resetPrismaMocks(prisma, sessions);
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });
});
```

- [ ] **Step 6: Add `resetPrismaMocks` and data helpers**

Add these helpers above the `describe`:

```ts
function persistedUser(overrides: Partial<PersistedUser> = {}): PersistedUser {
  const roles = overrides.roles ?? [{ role: { code: 'admin', name: 'Admin' } }];

  return {
    id: 'user-1',
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    passwordHash: '$2a$04$test',
    roles,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
    roles,
  };
}

function resetModelMocks(model: Record<string, jest.Mock>) {
  Object.values(model).forEach((mock) => mock.mockReset());
}

function resetPrismaMocks(
  prisma: ReturnType<typeof createPrismaMock>,
  sessions: Map<string, SessionRecord>,
) {
  [
    prisma.user,
    prisma.role,
    prisma.userRole,
    prisma.userSession,
    prisma.dictionaryType,
    prisma.dictionaryItem,
    prisma.managedFile,
    prisma.systemSetting,
    prisma.auditLog,
    prisma.permission,
  ].forEach(resetModelMocks);

  prisma.$transaction.mockReset();
  prisma.$transaction.mockImplementation(
    async (callback: (client: typeof prisma) => unknown) => callback(prisma),
  );
  prisma.systemSetting.findMany.mockResolvedValue([]);
  prisma.userSession.create.mockImplementation(
    async ({ data }: { data: SessionRecord }) => {
      sessions.set(data.id, { ...data, revokedAt: null });
      return sessions.get(data.id);
    },
  );
  prisma.userSession.findUnique.mockImplementation(
    async ({ where, include }: { where: { id: string }; include?: unknown }) => {
      const session = sessions.get(where.id);

      if (!session) {
        return null;
      }

      const user =
        session.user ??
        (await prisma.user.findUnique({ where: { id: session.userId } }));

      return {
        ...session,
        user: include ? user : session.user,
      };
    },
  );
  prisma.userSession.updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: {
        id?: string;
        userId?: string;
        refreshTokenHash?: string;
        revokedAt?: null;
        expiresAt?: { gt: Date };
      };
      data: Partial<SessionRecord>;
    }) => {
      const matchingSessions = [...sessions.values()].filter((session) => {
        return (
          (!where.id || session.id === where.id) &&
          (!where.userId || session.userId === where.userId) &&
          (!where.refreshTokenHash ||
            session.refreshTokenHash === where.refreshTokenHash) &&
          (where.revokedAt !== null || !session.revokedAt) &&
          (!where.expiresAt?.gt || session.expiresAt > where.expiresAt.gt)
        );
      });

      matchingSessions.forEach((session) => {
        sessions.set(session.id, { ...session, ...data });
      });

      return { count: matchingSessions.length };
    },
  );
}
```

- [ ] **Step 7: Keep and update the health e2e test**

Inside the new `describe`, keep the health test:

```ts
it('/api/health (GET)', () => {
  return request(app.getHttpServer())
    .get('/api/health')
    .expect(200)
    .expect({ status: 'ok' });
});
```

- [ ] **Step 8: Run e2e to catch setup errors**

Run:

```bash
pnpm --filter api test:e2e
```

Expected: PASS for health. If setup fails because a runtime provider touches an unmocked method, add the smallest missing mock method to `createPrismaMock` or `createRedisMock`.

### Task 4: Add Login, Refresh, And Logout HTTP Boundary E2E

**Files:**
- Modify: `apps/api/test/app.e2e-spec.ts`

- [ ] **Step 1: Add response helpers**

Add below the helper types:

```ts
type LoginResponseBody = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    roles: Array<{ code: string; name: string }>;
    permissions: string[];
  };
};

function loginBody(response: Response): LoginResponseBody {
  return response.body as LoginResponseBody;
}
```

- [ ] **Step 2: Add a sign-in helper**

Inside the `describe`, add:

```ts
async function signIn(
  user: PersistedUser,
  permissions: string[] = ['user.read'],
) {
  permissionContexts.set(user.id, {
    roleCodes: user.roles.map(({ role }) => role.code),
    permissionCodes: permissions,
    isSuperAdmin: false,
  });
  prisma.user.findFirst.mockResolvedValueOnce(user);
  prisma.user.findUnique.mockResolvedValue(user);

  return request(app.getHttpServer())
    .post('/api/auth/login')
    .set('Origin', allowedOrigin)
    .send({ usernameOrEmail: user.email, password: 'Admin123!' })
    .expect(201);
}
```

- [ ] **Step 3: Write the login e2e test**

Add:

```ts
it('logs in and returns access token, refresh cookie, and RBAC context', async () => {
  const user = persistedUser({
    passwordHash: await bcrypt.hash('Admin123!', 4),
  });

  const response = await signIn(user, ['user.read']);
  const body = loginBody(response);

  expect(body).toMatchObject({
    accessToken: expect.any(String),
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      roles: [{ code: 'admin', name: 'Admin' }],
      permissions: ['user.read'],
    },
  });
  expect(response.headers['set-cookie'][0]).toContain(
    'common_admin_refresh=',
  );
  expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  expect(response.body).not.toHaveProperty('refreshToken');
});
```

- [ ] **Step 4: Write the refresh e2e test**

Add:

```ts
it('refreshes a session through the refresh cookie', async () => {
  const user = persistedUser({
    passwordHash: await bcrypt.hash('Admin123!', 4),
  });
  const loginResponse = await signIn(user, ['user.read']);

  const refreshResponse = await request(app.getHttpServer())
    .post('/api/auth/refresh')
    .set('Origin', allowedOrigin)
    .set('Cookie', loginResponse.headers['set-cookie'])
    .expect(201);

  expect(loginBody(refreshResponse).accessToken).toEqual(expect.any(String));
  expect(refreshResponse.headers['set-cookie'][0]).toContain(
    'common_admin_refresh=',
  );
  expect(refreshResponse.body).not.toHaveProperty('refreshToken');
});
```

- [ ] **Step 5: Write the logout e2e test**

Add:

```ts
it('logs out and clears the refresh cookie', async () => {
  const user = persistedUser({
    passwordHash: await bcrypt.hash('Admin123!', 4),
  });
  const loginResponse = await signIn(user, ['user.read']);
  const accessToken = loginBody(loginResponse).accessToken;

  const response = await request(app.getHttpServer())
    .post('/api/auth/logout')
    .set('Origin', allowedOrigin)
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Cookie', loginResponse.headers['set-cookie'])
    .expect(201);

  expect(response.headers['set-cookie'][0]).toContain(
    'common_admin_refresh=;',
  );
  expect([...sessions.values()][0]).toEqual(
    expect.objectContaining({
      revokedAt: expect.any(Date),
      revokedReason: 'logout',
    }),
  );
});
```

- [ ] **Step 6: Run focused API e2e**

Run:

```bash
pnpm --filter api test:e2e
```

Expected: PASS for health, login, refresh, and logout e2e tests.

### Task 5: Add Protected Access, 403, Authorized Read, And Error Envelope E2E

**Files:**
- Modify: `apps/api/test/app.e2e-spec.ts`

- [ ] **Step 1: Add user list response helper**

Add below `loginBody`:

```ts
type UserListResponseBody = {
  items: Array<{
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    roles: Array<{ code: string; name: string }>;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
};

function userListBody(response: Response): UserListResponseBody {
  return response.body as UserListResponseBody;
}
```

- [ ] **Step 2: Write unauthenticated protected access test**

Add:

```ts
it('rejects unauthenticated access to protected resources', async () => {
  await request(app.getHttpServer()).get('/api/users').expect(401);
});
```

- [ ] **Step 3: Write authenticated forbidden test**

Add:

```ts
it('returns 403 when authenticated user lacks required permission', async () => {
  const user = persistedUser({
    passwordHash: await bcrypt.hash('Admin123!', 4),
  });
  const loginResponse = await signIn(user, []);

  await request(app.getHttpServer())
    .get('/api/users')
    .set('Authorization', `Bearer ${loginBody(loginResponse).accessToken}`)
    .expect(403);
});
```

- [ ] **Step 4: Write authorized read test**

Add:

```ts
it('allows an authenticated user with permission to read a protected resource', async () => {
  const user = persistedUser({
    passwordHash: await bcrypt.hash('Admin123!', 4),
  });
  const loginResponse = await signIn(user, ['user.read']);
  prisma.user.count.mockResolvedValue(1);
  prisma.user.findMany.mockResolvedValue([user]);

  const response = await request(app.getHttpServer())
    .get('/api/users')
    .set('Authorization', `Bearer ${loginBody(loginResponse).accessToken}`)
    .expect(200);

  expect(userListBody(response)).toMatchObject({
    total: 1,
    page: 1,
    pageSize: 20,
    items: [
      {
        id: 'user-1',
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        roles: [{ code: 'admin', name: 'Admin' }],
      },
    ],
  });
});
```

- [ ] **Step 5: Write normalized validation error envelope test**

Add:

```ts
it('returns normalized validation error envelope with request id', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .set('Origin', allowedOrigin)
    .set('x-request-id', 'req_test_quality_gate')
    .send({ usernameOrEmail: '', password: '' })
    .expect(400);

  expect(response.body).toMatchObject({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    statusCode: 400,
    requestId: 'req_test_quality_gate',
    path: '/api/auth/login',
  });
  expect(response.body.timestamp).toEqual(expect.any(String));
  expect(response.body.details).toEqual(
    expect.objectContaining({
      fields: expect.any(Array),
    }),
  );
});
```

- [ ] **Step 6: Run focused API e2e**

Run:

```bash
pnpm --filter api test:e2e
```

Expected: PASS for health, auth/session, protected access, authorized read, and validation envelope tests.

- [ ] **Step 7: Run API lint for the updated e2e file**

Run:

```bash
pnpm --filter api lint
```

Expected: PASS. This catches unused imports and unsafe broad function types before committing the expanded e2e suite.

- [ ] **Step 8: Commit API e2e expansion**

```bash
git add apps/api/test/app.e2e-spec.ts
git commit -m "test(api): expand e2e quality gate coverage"
```

Expected: commit succeeds.

## Chunk 3: Documentation For Quality Gates And Test Requirements

### Task 6: Update Development Guide Verification

**Files:**
- Modify: `docs/development/common-admin-development-guide.md`

- [ ] **Step 1: Inspect current verification section**

Run:

```bash
rg -n "## Verification|pnpm api:check|pnpm build" docs/development/common-admin-development-guide.md
```

Expected: existing section lists individual broad verification commands.

- [ ] **Step 2: Replace the verification section**

Update the `## Verification` section to:

````md
## Verification

Run the root quality gate before considering a feature branch ready:

```bash
pnpm quality
```

The quality gate runs the same checks expected in CI:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

Run the individual commands when debugging a failure. Use package-scoped
commands while iterating:

```bash
pnpm --filter api test
pnpm --filter admin test
pnpm --filter api test:e2e
pnpm --filter api build
pnpm --filter admin build
```

For new API-backed CRUD modules, also follow the minimum test checklist in
`docs/patterns/admin-crud-table-pattern-guide.md`.
````

- [ ] **Step 3: Verify Markdown around fenced blocks**

Run:

```bash
sed -n '/## Verification/,/## Documentation Map/p' docs/development/common-admin-development-guide.md
```

Expected: Markdown fences are balanced, `pnpm quality` is the first verification command shown, and the section points new CRUD modules to the checklist.

### Task 7: Add CRUD Module Minimum Test Checklist

**Files:**
- Modify: `docs/patterns/admin-crud-table-pattern-guide.md`

- [ ] **Step 1: Find insertion point**

Run:

```bash
rg -n "Frontend Pattern|Testing|Verification|API Contract" docs/patterns/admin-crud-table-pattern-guide.md
```

Expected: use the existing guide structure to place the checklist after backend/frontend implementation rules and before final verification guidance.

- [ ] **Step 2: Add the checklist section**

Add this section:

```md
## Minimum Test Checklist

Every new API-backed CRUD module must add focused backend and frontend tests.
Use the checklist as a minimum behavior contract; add more cases when the
resource has special rules.

Backend tests:

- service-level create, read, update, delete, list, search, sort, and
  pagination behavior as applicable;
- uniqueness and domain invariant errors;
- validation and DTO mapping for request and response shapes;
- controller behavior for success responses and expected error responses;
- permission guard behavior or permission metadata for every protected action;
- audit-log behavior when the module mutates important data;
- OpenAPI operation ids and response metadata when the admin app consumes the
  endpoint through generated API code.

Frontend tests:

- initial loading and empty states;
- table rendering with representative data;
- filtering, search, sort, and pagination behavior where supported;
- create, edit, delete, enable, disable, or other primary actions;
- permission-aware visibility for route entries and row/page actions;
- API error display through the project's normalized error/toast conventions;
- cache invalidation or query refresh behavior after mutations;
- route metadata and menu registration.

Testing boundaries:

- Controller tests may mock services.
- Service tests may mock Prisma.
- Flow tests should cover only behavior that needs multiple project-owned units
  working together.
- Page tests should mock generated hooks or the shared request boundary.
- Do not test Orval-generated implementation details.
- Read-only, frontend-only, or thin wrapper modules may use a reduced checklist,
  but the reason should be stated in the implementation notes or review.
```

- [ ] **Step 3: Verify checklist renders in context**

Run:

```bash
rg -n "Minimum Test Checklist|Backend tests|Frontend tests|Testing boundaries" docs/patterns/admin-crud-table-pattern-guide.md
```

Expected: all headings and checklist labels are present once.

### Task 8: Update Next Steps Index

**Files:**
- Modify: `docs/common-admin-next-steps.md`

- [ ] **Step 1: Inspect item 9**

Run:

```bash
sed -n '136,156p' docs/common-admin-next-steps.md
```

Expected: item 9 still describes testing quality gates as future discussion.

- [ ] **Step 2: Update item 9 status**

Replace item 9's current status and follow-up bullets with:

```md
当前状态：测试与质量门禁已经完成第一版实现，将现有 TDD 基础沉淀为模板级约束：根级 `pnpm quality`、GitHub Actions 质量门禁、API e2e 边界覆盖，以及新增 CRUD 模块最低测试 checklist。

设计与实施文档：

- `docs/superpowers/specs/2026-06-13-testing-quality-gates-design.md`
- `docs/superpowers/plans/2026-06-13-testing-quality-gates.md`

后续可讨论：

- 是否把 Playwright 登录后后台冒烟测试作为第二阶段门禁。
- 是否在多个业务模块稳定后引入覆盖率基线。
- 是否增加真实 Postgres/Redis 的集成测试 job。
```

Keep the existing value paragraph.

- [ ] **Step 3: Verify next-steps item links**

Run:

```bash
rg -n "测试与质量门禁|testing-quality-gates|Playwright|覆盖率" docs/common-admin-next-steps.md
```

Expected: item 9 references both the spec and this plan, and Playwright remains follow-up.

- [ ] **Step 4: Commit documentation updates**

```bash
git add docs/development/common-admin-development-guide.md docs/patterns/admin-crud-table-pattern-guide.md docs/common-admin-next-steps.md
git commit -m "docs: document testing quality gates"
```

## Chunk 4: Full Verification And Cleanup

### Task 9: Run Contract, Lint, Tests, E2E, Build, And Quality Gate

**Files:**
- No code changes expected unless verification exposes a defect.

- [ ] **Step 1: Check working tree before verification**

Run:

```bash
git status --short
```

Expected: clean working tree after previous commits, or only intentional files if a previous task has not been committed yet.

- [ ] **Step 2: Run API e2e directly**

Run:

```bash
pnpm --filter api test:e2e
```

Expected: PASS. This isolates the newly expanded e2e suite before the full gate.

- [ ] **Step 3: Run API contract check**

Run:

```bash
pnpm api:check
```

Expected: PASS with no generated artifact diff.

- [ ] **Step 4: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Run unit/component tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 6: Run production builds**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Run the root quality gate**

Run:

```bash
pnpm quality
```

Expected: PASS. This proves the root command matches the intended gate order.

- [ ] **Step 8: Check for generated or incidental diffs**

Run:

```bash
git status --short
```

Expected: clean working tree. If `pnpm quality` generated or changed files, inspect them before proceeding.

- [ ] **Step 9: Fix or document any verification failure**

If any command fails:

1. Read the first failing command output.
2. Determine whether it is caused by this plan's changes or a pre-existing environment issue.
3. Fix defects caused by this plan.
4. Re-run the failed command.
5. Re-run `pnpm quality`.

Do not claim the gate passes until `pnpm quality` exits with code 0.

### Task 10: Final Commit And Handoff

**Files:**
- Modify only files that changed during verification fixes, if any.

- [ ] **Step 1: Inspect final status**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: working tree is clean, and recent commits include:

```text
chore: add root quality gate script
ci: add quality workflow
test(api): expand e2e quality gate coverage
docs: document testing quality gates
```

If verification fixes created additional changes, commit them with the narrowest accurate message.

- [ ] **Step 2: Summarize implementation evidence**

Record in the final handoff:

```text
Implemented:
- root pnpm quality gate
- GitHub Actions quality workflow on PRs and main pushes
- expanded API e2e for health/auth/permission/error/session boundary behavior
- development and CRUD testing docs
- next-steps status update

Verified:
- PASS pnpm --filter api test:e2e
- PASS pnpm api:check
- PASS pnpm lint
- PASS pnpm test
- PASS pnpm build
- PASS pnpm quality
```

Expected: the handoff includes exact pass/fail status from commands that were actually run.
