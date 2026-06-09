# Auth Session Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement short-lived access tokens, HttpOnly refresh-cookie sessions, server-side session revocation, password lifecycle endpoints, and frontend silent session restoration.

**Architecture:** Add a `UserSession` database record as the server-side source of truth for refresh tokens and access-token session validity. The API owns cookie issuance, refresh rotation, logout, origin checks, and password revocation; the admin frontend keeps access tokens only in memory and restores state through `/auth/refresh`.

**Tech Stack:** NestJS, Passport JWT, `@nestjs/jwt`, Prisma, PostgreSQL, class-validator, Swagger, Jest, Supertest, React, Vite, Zustand, Axios, TanStack Query, Vitest, React Testing Library.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-09-auth-session-lifecycle-design.md`
- Current auth module: `apps/api/src/auth/`
- Current user module: `apps/api/src/user/`
- Current frontend API client: `apps/admin/src/lib/api.ts`
- Current auth store: `apps/admin/src/stores/auth-store.ts`
- Current route guard: `apps/admin/src/lib/route-guard.ts`

## File Structure

### Backend

- Modify `apps/api/package.json`: add `cookie-parser` and `@types/cookie-parser`.
- Modify `pnpm-lock.yaml`: dependency lockfile after installing cookie parser.
- Modify `apps/api/prisma/schema.prisma`: add `UserSession` and `User.sessions`.
- Create a Prisma migration under `apps/api/prisma/migrations/`: session table.
- Modify generated Prisma artifacts by running `pnpm --filter api db:generate`.
- Modify `apps/api/src/config/env.config.ts`: validate refresh-cookie settings and unsafe production combinations.
- Modify `apps/api/src/config/env.config.spec.ts`: env validation tests.
- Modify `apps/api/.env.example` and `.env.example`: document auth session settings.
- Modify `apps/api/src/config/auth.config.ts`: extend token/cookie config types.
- Modify `apps/api/src/main.ts`: install cookie parser and enable credentialed CORS.
- Create `apps/api/src/auth/refresh-token.service.ts`: generate, parse, hash, verify, and build refresh tokens.
- Create `apps/api/src/auth/refresh-token.service.spec.ts`: token parsing/hash tests.
- Create `apps/api/src/auth/session-cookie.service.ts`: set/clear refresh cookie with shared options.
- Create `apps/api/src/auth/session-cookie.service.spec.ts`: cookie option tests.
- Create `apps/api/src/auth/auth-origin.guard.ts`: validate browser `Origin` for cookie-sensitive auth endpoints.
- Create `apps/api/src/auth/auth-origin.guard.spec.ts`: allowed/rejected origin tests.
- Modify `apps/api/src/auth/auth.module.ts`: wire new services and config provider values.
- Modify `apps/api/src/auth/dto/auth-response.dto.ts`: keep response token shape and document no refresh token JSON.
- Modify `apps/api/src/auth/dto/login.dto.ts`: no behavior change unless tests need examples.
- Create `apps/api/src/auth/dto/change-password.dto.ts`: current/new password validation.
- Modify `apps/api/src/auth/auth.service.ts`: create sessions, refresh sessions atomically, revoke sessions, change password.
- Modify `apps/api/src/auth/auth.controller.ts`: add refresh, logout, and change-password endpoints.
- Modify `apps/api/src/auth/jwt-access.strategy.ts`: validate session and return fresh user fields.
- Modify `apps/api/src/auth/auth.service.spec.ts`: service unit coverage for login/refresh/logout/change password.
- Modify `apps/api/src/auth/auth-flow.spec.ts`: integration coverage for cookie/session behavior.
- Modify `apps/api/src/user/user.types.ts`: add `sid` to `JwtUserPayload`.
- Modify `apps/api/src/user/dto/user.request.ts`: add admin reset-password DTO.
- Modify `apps/api/src/user/user.service.ts`: reset password and revoke sessions for target user.
- Modify `apps/api/src/user/user.controller.ts`: add `POST /users/:id/reset-password`.
- Modify `apps/api/src/user/user.service.spec.ts`: reset password tests.

### Frontend

- Modify `apps/admin/src/types/auth.ts`: add `AuthStatus`, keep `AuthSession`.
- Modify `apps/admin/src/lib/session-storage.ts`: stop persisting access-token sessions, or reduce it to a no-op/cleanup helper.
- Modify `apps/admin/src/lib/session-storage.test.ts`: assert token sessions are not persisted and legacy storage is cleared.
- Modify `apps/admin/src/stores/auth-store.ts`: use `checking | authenticated | anonymous`, in-memory token only.
- Modify `apps/admin/src/stores/auth-store.test.ts`: auth status and memory-only state tests.
- Modify `apps/admin/src/lib/api.ts`: credentialed auth endpoints, refresh/retry flow, logout, change password, admin reset password.
- Modify `apps/admin/src/lib/api.test.ts`: credentialed calls, one refresh retry, concurrent refresh, auth endpoint exclusions.
- Modify `apps/admin/src/app/api-client.ts`: wire refresh success/failure callbacks and cache clearing.
- Modify `apps/admin/src/AppContent.tsx`: run startup refresh and handle `checking` state.
- Modify `apps/admin/src/lib/route-guard.ts`: accept status-aware auth state.
- Modify `apps/admin/src/lib/route-guard.test.ts`: checking, anonymous, authenticated, forbidden cases.
- Modify `apps/admin/src/features/auth/LoginView.tsx`: use memory session and default route redirect.
- Modify `apps/admin/src/features/auth/LoginView.test.tsx`: login still works with new auth store.
- Modify `apps/admin/src/layouts/AdminShell.tsx`: call server logout before local reset; handle password-change later if UI is added.
- Modify `apps/admin/src/layouts/AdminShell.test.tsx`: logout request and fallback local logout behavior.
- Modify `apps/admin/src/features/users/users.api.ts`: expose admin reset password call if feature wrappers are used.
- Modify `apps/admin/src/features/users/users.types.ts`: add reset password request type.
- Modify `apps/admin/src/features/users/UsersPage.tsx`: add or defer UI entry point for reset password according to existing page patterns.
- Modify `apps/admin/src/features/users/UsersPage.test.tsx`: admin reset self/other session behavior if UI is added in v1.

## Chunk 1: Backend Session Foundation

### Task 1: Add Cookie Parser Dependency

**Files:**
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install cookie parser**

Run:

```bash
pnpm --filter api add cookie-parser
pnpm --filter api add -D @types/cookie-parser
```

Expected: `apps/api/package.json` includes `cookie-parser` in dependencies and `@types/cookie-parser` in devDependencies.

- [ ] **Step 2: Verify install did not break dependency resolution**

Run:

```bash
pnpm --filter api test -- env.config.spec.ts
```

Expected: existing env config tests pass.

- [ ] **Step 3: Commit dependency change**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add cookie parser"
```

### Task 2: Add UserSession Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add failing schema expectation by grepping generated client usage**

Run:

```bash
rg -n "userSession|UserSession" apps/api/src apps/api/prisma/schema.prisma
```

Expected: no schema model exists yet, or only this plan/spec references exist.

- [ ] **Step 2: Update Prisma schema**

Add `sessions UserSession[]` to `model User`.

Add this model near the other auth/user-owned models:

```prisma
model UserSession {
  id               String    @id @default(uuid())
  userId           String
  refreshTokenHash String    @db.VarChar(255)
  userAgent        String?   @db.VarChar(500)
  ipAddress        String?   @db.VarChar(80)
  expiresAt        DateTime
  lastUsedAt       DateTime?
  revokedAt        DateTime?
  revokedReason    String?   @db.VarChar(120)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@index([revokedAt])
}
```

- [ ] **Step 3: Generate migration and Prisma client**

Run:

```bash
pnpm --filter api db:migrate -- --name add_user_sessions
pnpm --filter api db:generate
```

Expected: migration creates `UserSession`, indexes, and foreign key cascade.

- [ ] **Step 4: Commit schema change**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add user session schema"
```

### Task 3: Add Auth Session Environment Config

**Files:**
- Modify: `apps/api/src/config/env.config.ts`
- Modify: `apps/api/src/config/env.config.spec.ts`
- Modify: `apps/api/.env.example`
- Modify: `.env.example`

- [ ] **Step 1: Write failing env tests**

Add tests to `apps/api/src/config/env.config.spec.ts`:

```ts
it('provides auth refresh defaults', () => {
  const env = validateEnv({});

  expect(env.AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS).toBe(14);
  expect(env.AUTH_REFRESH_COOKIE_NAME).toBe('common_admin_refresh');
  expect(env.AUTH_REFRESH_COOKIE_SECURE).toBe(false);
  expect(env.AUTH_REFRESH_COOKIE_SAME_SITE).toBe('lax');
  expect(env.AUTH_REFRESH_COOKIE_DOMAIN).toBe('');
});

it('rejects sameSite none without secure cookies in production', () => {
  expect(() =>
    validateEnv({
      NODE_ENV: 'production',
      JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
      AUTH_REFRESH_COOKIE_SAME_SITE: 'none',
      AUTH_REFRESH_COOKIE_SECURE: 'false',
    }),
  ).toThrow('AUTH_REFRESH_COOKIE_SECURE must be true');
});
```

Run:

```bash
pnpm --filter api test -- env.config.spec.ts
```

Expected: FAIL because the fields do not exist yet.

- [ ] **Step 2: Extend env schema**

Add:

```ts
AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce
  .number()
  .int()
  .positive()
  .default(14),
AUTH_REFRESH_COOKIE_NAME: z.string().min(1).default('common_admin_refresh'),
AUTH_REFRESH_COOKIE_SECURE: z.coerce.boolean().default(false),
AUTH_REFRESH_COOKIE_SAME_SITE: z
  .enum(['lax', 'strict', 'none'])
  .default('lax'),
AUTH_REFRESH_COOKIE_DOMAIN: z.string().default(''),
```

Add production validation:

```ts
if (
  env.NODE_ENV === 'production' &&
  env.AUTH_REFRESH_COOKIE_SAME_SITE === 'none' &&
  !env.AUTH_REFRESH_COOKIE_SECURE
) {
  throw new Error(
    'AUTH_REFRESH_COOKIE_SECURE must be true when SameSite=None in production',
  );
}
```

- [ ] **Step 3: Update env examples**

Add to root `.env.example` and `apps/api/.env.example`:

```text
AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS=14
AUTH_REFRESH_COOKIE_NAME=common_admin_refresh
AUTH_REFRESH_COOKIE_SECURE=false
AUTH_REFRESH_COOKIE_SAME_SITE=lax
AUTH_REFRESH_COOKIE_DOMAIN=
```

- [ ] **Step 4: Run env tests**

Run:

```bash
pnpm --filter api test -- env.config.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit config change**

```bash
git add apps/api/src/config/env.config.ts apps/api/src/config/env.config.spec.ts apps/api/.env.example .env.example
git commit -m "feat(api): configure refresh session settings"
```

### Task 4: Add Refresh Token And Cookie Helpers

**Files:**
- Create: `apps/api/src/auth/refresh-token.service.ts`
- Create: `apps/api/src/auth/refresh-token.service.spec.ts`
- Create: `apps/api/src/auth/session-cookie.service.ts`
- Create: `apps/api/src/auth/session-cookie.service.spec.ts`
- Modify: `apps/api/src/config/auth.config.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: Write failing refresh token tests**

Create `apps/api/src/auth/refresh-token.service.spec.ts`:

```ts
import { RefreshTokenService } from './refresh-token.service';

describe('RefreshTokenService', () => {
  const service = new RefreshTokenService();

  it('creates parseable session-bound tokens', async () => {
    const token = service.createToken('session-1');

    expect(service.parseToken(token)).toEqual({
      sessionId: 'session-1',
      secret: expect.any(String),
    });
  });

  it('hashes and verifies secrets without storing raw tokens', async () => {
    const token = service.createToken('session-1');
    const parsed = service.parseToken(token);
    const hash = await service.hashSecret(parsed.secret);

    await expect(service.verifySecret(parsed.secret, hash)).resolves.toBe(true);
    await expect(service.verifySecret('wrong-secret', hash)).resolves.toBe(false);
  });

  it('rejects malformed tokens', () => {
    expect(() => service.parseToken('broken')).toThrow('Invalid refresh token');
  });
});
```

Run:

```bash
pnpm --filter api test -- refresh-token.service.spec.ts
```

Expected: FAIL because the service does not exist yet.

- [ ] **Step 2: Implement `RefreshTokenService`**

Create `apps/api/src/auth/refresh-token.service.ts` with:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class RefreshTokenService {
  createToken(sessionId: string): string {
    const secret = randomBytes(48).toString('base64url');
    return `${sessionId}.${secret}`;
  }

  parseToken(token: string): { sessionId: string; secret: string } {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      sessionId: token.slice(0, separatorIndex),
      secret: token.slice(separatorIndex + 1),
    };
  }

  hashSecret(secret: string): Promise<string> {
    return bcrypt.hash(secret, 10);
  }

  async verifySecret(secret: string, hash: string): Promise<boolean> {
    return bcrypt.compare(secret, hash);
  }
}
```

Note: bcrypt comparison is intentionally used here because refresh token hashes
are persisted like password hashes. Do not store raw refresh secrets.

- [ ] **Step 3: Write failing cookie helper tests**

Create `apps/api/src/auth/session-cookie.service.spec.ts` with tests that call
`setRefreshCookie(response, token)` and `clearRefreshCookie(response)` on a
mock response:

```ts
const response = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
};
```

Assert options include:

```ts
{
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 14 * 24 * 60 * 60 * 1000,
}
```

Run:

```bash
pnpm --filter api test -- session-cookie.service.spec.ts
```

Expected: FAIL because the service does not exist yet.

- [ ] **Step 4: Extend auth config types**

Modify `apps/api/src/config/auth.config.ts`:

```ts
export type RefreshCookieSameSite = 'lax' | 'strict' | 'none';

export interface AuthTokenConfig {
  accessTokenSecret: string;
  accessTokenExpiresIn: JwtSignOptions['expiresIn'];
  refreshTokenExpiresInDays: number;
  refreshCookieName: string;
  refreshCookieSecure: boolean;
  refreshCookieSameSite: RefreshCookieSameSite;
  refreshCookieDomain: string;
}
```

- [ ] **Step 5: Implement `SessionCookieService`**

Create `apps/api/src/auth/session-cookie.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AUTH_TOKEN_CONFIG, AuthTokenConfig } from '../config/auth.config';

@Injectable()
export class SessionCookieService {
  constructor(
    @Inject(AUTH_TOKEN_CONFIG) private readonly config: AuthTokenConfig,
  ) {}

  setRefreshCookie(response: Response, token: string) {
    response.cookie(this.config.refreshCookieName, token, this.cookieOptions());
  }

  clearRefreshCookie(response: Response) {
    response.clearCookie(this.config.refreshCookieName, this.clearOptions());
  }

  private cookieOptions() {
    const options = {
      httpOnly: true,
      secure: this.config.refreshCookieSecure,
      sameSite: this.config.refreshCookieSameSite,
      path: '/api/auth',
      maxAge: this.config.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
      ...(this.config.refreshCookieDomain
        ? { domain: this.config.refreshCookieDomain }
        : {}),
    } as const;

    return options;
  }

  private clearOptions() {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    return options;
  }
}
```

- [ ] **Step 6: Register helpers in `AuthModule`**

Modify the `AUTH_TOKEN_CONFIG` factory to read the new env values. Add
`RefreshTokenService` and `SessionCookieService` to providers.

- [ ] **Step 7: Run helper tests**

Run:

```bash
pnpm --filter api test -- refresh-token.service.spec.ts session-cookie.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit helper services**

```bash
git add apps/api/src/config/auth.config.ts apps/api/src/auth/auth.module.ts apps/api/src/auth/refresh-token.service.ts apps/api/src/auth/refresh-token.service.spec.ts apps/api/src/auth/session-cookie.service.ts apps/api/src/auth/session-cookie.service.spec.ts
git commit -m "feat(api): add refresh token cookie helpers"
```

### Task 5: Add Credentialed CORS And Origin Guard

**Files:**
- Modify: `apps/api/src/main.ts`
- Create: `apps/api/src/auth/auth-origin.guard.ts`
- Create: `apps/api/src/auth/auth-origin.guard.spec.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`

- [ ] **Step 1: Write failing origin guard tests**

Create `apps/api/src/auth/auth-origin.guard.spec.ts` covering:

- allowed origin returns true.
- unexpected browser origin throws `ForbiddenException`.
- missing origin returns true so same-origin/proxy and non-browser requests are
  not blocked by default.

Use a minimal `ExecutionContext` mock:

```ts
const context = {
  switchToHttp: () => ({
    getRequest: () => ({
      headers: { origin: 'http://evil.example' },
      cookies: { common_admin_refresh: 'session.secret' },
    }),
  }),
} as unknown as ExecutionContext;
```

Run:

```bash
pnpm --filter api test -- auth-origin.guard.spec.ts
```

Expected: FAIL because the guard does not exist yet.

- [ ] **Step 2: Implement `AuthOriginGuard`**

Create `apps/api/src/auth/auth-origin.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(configService: ConfigService) {
    this.allowedOrigins = new Set(
      configService
        .getOrThrow<string>('ALLOWED_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      cookies?: Record<string, string | undefined>;
    }>();
    const origin = request.headers.origin;

    if (!origin) {
      return true;
    }

    if (!this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Origin is not allowed');
    }

    return true;
  }
}
```

Keep v1 simple: validate browser-supplied `Origin`. Do not add a full CSRF token
yet. If implementation later needs stricter missing-origin behavior for a
cross-site deployment, add it behind explicit production configuration instead
of surprising local/API clients.

- [ ] **Step 3: Update `main.ts`**

Add:

```ts
import cookieParser from 'cookie-parser';
```

Before global pipes:

```ts
app.use(cookieParser());
```

Update CORS:

```ts
app.enableCors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

- [ ] **Step 4: Apply origin guard to cookie-sensitive endpoints**

In `apps/api/src/auth/auth.controller.ts`, add `@UseGuards(AuthOriginGuard)` to:

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/change-password
```

Register `AuthOriginGuard` in `AuthModule` providers.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter api test -- auth-origin.guard.spec.ts
pnpm --filter api test -- auth-flow.spec.ts
```

Expected: origin guard tests pass. Auth flow may still fail until refresh/logout endpoints exist; if so, keep only guard tests in this commit and note auth-flow failures for the next chunk.

- [ ] **Step 6: Commit CORS/origin foundation**

```bash
git add apps/api/src/main.ts apps/api/src/auth/auth-origin.guard.ts apps/api/src/auth/auth-origin.guard.spec.ts apps/api/src/auth/auth.module.ts apps/api/src/auth/auth.controller.ts
git commit -m "feat(api): add credentialed auth cookie origin checks"
```

## Chunk 2: Backend Login, Refresh, Logout, And Session Validation

### Task 6: Create Sessions During Login

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/auth-flow.spec.ts`
- Modify: `apps/api/src/user/user.types.ts`

- [ ] **Step 1: Write failing service test for login session creation**

Update `apps/api/src/auth/auth.service.spec.ts` so the Prisma mock includes:

```ts
userSession: {
  create: jest.fn(),
}
```

Assert login:

- creates a `UserSession` with `userId`, `expiresAt`, `userAgent`, `ipAddress`.
- hashes the refresh secret, not the raw token.
- signs access token with `sub` and `sid`.
- returns `{ accessToken, refreshToken, user }` internally from service.

Expected service-level result:

```ts
expect(result).toMatchObject({
  accessToken: 'access-token',
  refreshToken: expect.stringMatching(/^session-1\./),
  user: expect.objectContaining({ id: 'user-1' }),
});
```

Run:

```bash
pnpm --filter api test -- auth.service.spec.ts
```

Expected: FAIL because login does not create sessions yet.

- [ ] **Step 2: Add `sid` to JWT payload type**

Modify `apps/api/src/user/user.types.ts`:

```ts
export interface JwtUserPayload {
  sub: string;
  sid: string;
  email?: string;
  username?: string;
}
```

- [ ] **Step 3: Update `AuthService.login`**

Change the service signature to accept request metadata:

```ts
async login(
  credentials: LoginDto,
  metadata: { userAgent?: string; ipAddress?: string } = {},
): Promise<AuthResponse & { refreshToken: string }>
```

Flow:

```text
1. Validate user/password.
2. Resolve permissions/profile.
3. Create UserSession with temporary placeholder hash or create after token secret generation.
4. Generate refresh token for session id.
5. Store hash of refresh secret.
6. Sign access token with sub, sid, email, username.
7. Return accessToken, refreshToken, user.
```

Implementation note: because token format contains `sessionId`, create the
session first with a temporary impossible hash such as `pending`, then update it
with the real hash inside a transaction, or create a UUID in application code and
use it for both the session id and refresh token before insert.

Prefer application-generated UUID:

```ts
import { randomUUID } from 'node:crypto';

const sessionId = randomUUID();
const refreshToken = this.refreshTokenService.createToken(sessionId);
const { secret } = this.refreshTokenService.parseToken(refreshToken);
const refreshTokenHash = await this.refreshTokenService.hashSecret(secret);

await this.prisma.userSession.create({
  data: {
    id: sessionId,
    userId: profile.id,
    refreshTokenHash,
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress,
    expiresAt,
  },
});
```

- [ ] **Step 4: Update controller to set cookie**

Inject `SessionCookieService`. In `login`, use `@Req()` and `@Res({ passthrough: true })`:

```ts
const session = await this.authService.login(body, {
  userAgent: request.headers['user-agent'],
  ipAddress: request.ip,
});
this.sessionCookieService.setRefreshCookie(response, session.refreshToken);
return { accessToken: session.accessToken, user: session.user };
```

- [ ] **Step 5: Update auth-flow test for login cookie**

In `apps/api/src/auth/auth-flow.spec.ts`, add `prisma.userSession` mock methods:

```ts
userSession: {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
}
```

Assert login response:

```ts
expect(loginResponse.headers['set-cookie'][0]).toContain('common_admin_refresh=');
expect(loginResponse.headers['set-cookie'][0]).toContain('HttpOnly');
expect(loginResponse.body).not.toHaveProperty('refreshToken');
```

- [ ] **Step 6: Run login tests**

Run:

```bash
pnpm --filter api test -- auth.service.spec.ts
pnpm --filter api test -- auth-flow.spec.ts
```

Expected: PASS for login cases. Existing auth-flow cases that use `signIn()` may fail until JWT strategy validates sessions in Task 8; if so, update the test helper to mock session lookup after login.

- [ ] **Step 7: Commit login sessions**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.service.spec.ts apps/api/src/auth/auth-flow.spec.ts apps/api/src/user/user.types.ts
git commit -m "feat(api): create refresh sessions on login"
```

### Task 7: Add Refresh And Logout Endpoints

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/auth-flow.spec.ts`

- [ ] **Step 1: Write failing refresh service tests**

Add tests for:

- valid refresh rotates `refreshTokenHash`, updates `lastUsedAt`, returns new access/refresh token.
- old refresh token fails after rotation.
- conditional update returning no row/zero count throws `UnauthorizedException` and does not set `token_reuse_detected`.

Run:

```bash
pnpm --filter api test -- auth.service.spec.ts
```

Expected: FAIL because refresh does not exist yet.

- [ ] **Step 2: Implement `AuthService.refresh`**

Add:

```ts
async refresh(refreshToken: string): Promise<AuthResponse & { refreshToken: string }>
```

Flow:

```text
1. Parse session id and secret.
2. Find session by id with user and roles.
3. Reject missing/revoked/expired session.
4. Verify incoming secret against stored hash.
5. Resolve current user profile and permissions.
6. Generate new refresh token for same session id.
7. Hash new secret.
8. Atomically update session only if current hash/revoked/expires conditions still match.
9. Sign new access token with same sid.
10. Return accessToken, refreshToken, user.
```

Prisma conditional update pattern:

```ts
const updateResult = await this.prisma.userSession.updateMany({
  where: {
    id: session.id,
    userId: session.userId,
    refreshTokenHash: session.refreshTokenHash,
    revokedAt: null,
    expiresAt: { gt: now },
  },
  data: {
    refreshTokenHash: nextHash,
    lastUsedAt: now,
  },
});

if (updateResult.count !== 1) {
  throw new UnauthorizedException();
}
```

- [ ] **Step 3: Write failing logout service tests**

Add tests for:

- logout by `sid` sets `revokedAt` and `revokedReason = logout`.
- logout by refresh cookie can revoke when access token is absent/expired.
- logout remains successful when session is already missing.

- [ ] **Step 4: Implement logout service methods**

Add:

```ts
async logoutBySessionId(sessionId: string): Promise<void>
async logoutByRefreshToken(refreshToken: string): Promise<void>
```

Use `updateMany` instead of `update` for idempotent behavior:

```ts
await this.prisma.userSession.updateMany({
  where: { id: sessionId, revokedAt: null },
  data: { revokedAt: new Date(), revokedReason: 'logout' },
});
```

- [ ] **Step 5: Add controller endpoints**

Add:

```text
POST /auth/refresh
POST /auth/logout
```

Both should set/clear cookies through `SessionCookieService`.

`refresh` is public from the JWT guard perspective but protected by cookie
validation. Add `@IsPublic()` and `@UseGuards(AuthOriginGuard)`.

`logout` should be callable with a valid bearer token, but also work when only
the refresh cookie is available. Use `@IsPublic()` and resolve the session in
the controller/service from either `request.user?.sid` if available or cookie.
If keeping global JWT guard makes optional auth awkward, implement logout as
public and revoke by refresh token for v1.

- [ ] **Step 6: Add auth-flow integration tests**

Add tests:

```text
login sets refresh cookie and no refreshToken JSON
refresh with cookie returns new access token and new Set-Cookie
old refresh cookie fails after rotation
logout clears cookie and revokes session
```

Use Supertest `.set('Cookie', loginResponse.headers['set-cookie'])`.

- [ ] **Step 7: Run auth tests**

Run:

```bash
pnpm --filter api test -- auth.service.spec.ts auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit refresh/logout**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.service.spec.ts apps/api/src/auth/auth-flow.spec.ts
git commit -m "feat(api): add refresh rotation and logout"
```

### Task 8: Validate Active Session In JWT Strategy

**Files:**
- Modify: `apps/api/src/auth/jwt-access.strategy.ts`
- Modify: `apps/api/src/auth/auth-flow.spec.ts`
- Modify: `apps/api/src/user/user.types.ts`

- [ ] **Step 1: Write failing strategy/auth-flow tests**

Add auth-flow cases:

```text
protected request fails after logout
protected request fails when session is revoked
protected request fails when session is expired
protected request fails when token sub and sid belong to different users
users/me returns fresh email/username from database after token was signed
```

Run:

```bash
pnpm --filter api test -- auth-flow.spec.ts
```

Expected: FAIL because strategy only checks user exists.

- [ ] **Step 2: Update JWT strategy lookup**

Modify `validate(payload)` to:

```ts
const session = await this.prisma.userSession.findUnique({
  where: { id: payload.sid },
  select: {
    id: true,
    userId: true,
    expiresAt: true,
    revokedAt: true,
    user: {
      select: {
        id: true,
        email: true,
        username: true,
      },
    },
  },
});
```

Reject when:

```text
!payload.sub
!payload.sid
!session
session.userId !== payload.sub
session.revokedAt
session.expiresAt <= now
!session.user
```

Return:

```ts
return {
  sub: session.user.id,
  sid: session.id,
  email: session.user.email,
  username: session.user.username,
};
```

- [ ] **Step 3: Update mocks and helpers**

Every auth-flow login helper that later calls protected endpoints must mock
`prisma.userSession.findUnique` for the signed `sid`.

- [ ] **Step 4: Run auth-flow tests**

Run:

```bash
pnpm --filter api test -- auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit strategy session validation**

```bash
git add apps/api/src/auth/jwt-access.strategy.ts apps/api/src/auth/auth-flow.spec.ts apps/api/src/user/user.types.ts
git commit -m "feat(api): require active sessions for access tokens"
```

## Chunk 3: Password Lifecycle Endpoints

### Task 9: Add Change Password Endpoint

**Files:**
- Create: `apps/api/src/auth/dto/change-password.dto.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/auth-flow.spec.ts`

- [ ] **Step 1: Create failing DTO/service tests**

Add tests:

```text
changePassword rejects incorrect current password
changePassword hashes new password
changePassword revokes all sessions for current user with password_changed
changePassword clears refresh cookie in controller
```

Run:

```bash
pnpm --filter api test -- auth.service.spec.ts auth-flow.spec.ts
```

Expected: FAIL.

- [ ] **Step 2: Add DTO**

Create `apps/api/src/auth/dto/change-password.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
```

- [ ] **Step 3: Implement service method**

Add:

```ts
async changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void>
```

Flow:

```text
1. Load user passwordHash.
2. Compare currentPassword.
3. Throw UnauthorizedException if wrong.
4. Hash newPassword.
5. In a transaction, update user passwordHash and revoke all sessions for user.
```

Use:

```ts
await tx.userSession.updateMany({
  where: { userId, revokedAt: null },
  data: { revokedAt: now, revokedReason: 'password_changed' },
});
```

- [ ] **Step 4: Add controller endpoint**

Add `POST /auth/change-password` with `@UseGuards(AuthOriginGuard)`.

On success:

```ts
this.sessionCookieService.clearRefreshCookie(response);
```

Return `204` or `{ success: true }`. Prefer `204` for no payload.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter api test -- auth.service.spec.ts auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit change password**

```bash
git add apps/api/src/auth/dto/change-password.dto.ts apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.service.spec.ts apps/api/src/auth/auth-flow.spec.ts
git commit -m "feat(api): add change password session revocation"
```

### Task 10: Add Administrator Reset Password Endpoint

**Files:**
- Modify: `apps/api/src/user/dto/user.request.ts`
- Modify: `apps/api/src/user/user.service.ts`
- Modify: `apps/api/src/user/user.controller.ts`
- Modify: `apps/api/src/user/user.service.spec.ts`
- Modify: `apps/api/src/auth/auth-flow.spec.ts`

- [ ] **Step 1: Write failing user service tests**

In `apps/api/src/user/user.service.spec.ts`, add:

```text
resetPassword hashes the new password
resetPassword revokes all target user sessions with admin_reset_password
resetPassword returns public user response without passwordHash
resetPassword throws NotFoundException for missing user
```

Run:

```bash
pnpm --filter api test -- user.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 2: Add DTO**

In `apps/api/src/user/dto/user.request.ts`:

```ts
export class ResetUserPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
```

- [ ] **Step 3: Implement `UserService.resetPassword`**

Add:

```ts
async resetPassword(id: string, newPassword: string): Promise<UserResponseDto>
```

Use a transaction:

```ts
const passwordHash = await bcrypt.hash(newPassword, 10);
const user = await tx.user.update({
  where: { id },
  data: { passwordHash },
  include: { roles: { include: { role: true } } },
});
await tx.userSession.updateMany({
  where: { userId: id, revokedAt: null },
  data: { revokedAt: now, revokedReason: 'admin_reset_password' },
});
```

Return `toUserResponse(user)`.

- [ ] **Step 4: Add controller endpoint**

In `apps/api/src/user/user.controller.ts`:

```ts
@ApiOkResponse({ type: UserResponseDto })
@ApiForbiddenResponse({ description: 'Permission required' })
@ApiNotFoundResponse({ description: 'User not found' })
@Permissions('user.update')
@Post(':id/reset-password')
resetPassword(
  @Param('id') id: string,
  @Body() body: ResetUserPasswordDto,
): Promise<UserResponseDto> {
  return this.userService.resetPassword(id, body.newPassword);
}
```

Use `user.update` unless a dedicated `user.reset_password` permission is added
to the RBAC registry in a separate permission-design update.

- [ ] **Step 5: Add auth-flow test**

Add an integration case:

```text
admin reset password revokes target user's existing access token
```

Use two users/sessions in the mock setup.

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter api test -- user.service.spec.ts auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit admin reset password**

```bash
git add apps/api/src/user/dto/user.request.ts apps/api/src/user/user.service.ts apps/api/src/user/user.controller.ts apps/api/src/user/user.service.spec.ts apps/api/src/auth/auth-flow.spec.ts
git commit -m "feat(api): add admin password reset revocation"
```

## Chunk 4: Frontend Session Runtime

### Task 11: Refactor Auth Store To Memory-Only Status

**Files:**
- Modify: `apps/admin/src/types/auth.ts`
- Modify: `apps/admin/src/lib/session-storage.ts`
- Modify: `apps/admin/src/lib/session-storage.test.ts`
- Modify: `apps/admin/src/stores/auth-store.ts`
- Modify: `apps/admin/src/stores/auth-store.test.ts`

- [ ] **Step 1: Write failing auth store tests**

Update tests to assert:

```text
initial status is checking
setSession makes status authenticated and stores token in memory
setAnonymous clears token and marks anonymous
reset clears token and marks anonymous
access token is not written to localStorage
legacy common-admin.session is removed
```

Run:

```bash
pnpm --filter admin test -- auth-store.test.ts session-storage.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Update auth types**

In `apps/admin/src/types/auth.ts`:

```ts
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous'
```

Keep `AuthSession` as the response shape:

```ts
export interface AuthSession {
  accessToken: string
  user: UserProfile
}
```

- [ ] **Step 3: Simplify session storage**

Modify `apps/admin/src/lib/session-storage.ts` so it no longer saves sessions.
Keep a cleanup helper:

```ts
const SESSION_KEY = 'common-admin.session'

export function clearLegacySession(storage = getBrowserStorage()) {
  storage?.removeItem(SESSION_KEY)
}
```

If other imports still expect `loadSession`, `saveSession`, and `clearSession`,
either remove those imports in the same task or keep compatibility functions
that do not persist access tokens:

```ts
export function loadSession() {
  return null
}

export function saveSession() {
  clearLegacySession()
}

export function clearSession() {
  clearLegacySession()
}
```

- [ ] **Step 4: Refactor auth store**

Shape:

```ts
interface AuthState {
  status: AuthStatus
  accessToken: string | null
  user: UserProfile | null
  roles: UserRoleSummary[]
  permissions: string[]
  isAuthenticated: boolean
  setSession: (session: AuthSession) => void
  setUser: (user: UserProfile) => void
  setAnonymous: () => void
  reset: () => void
}
```

Initial state:

```ts
status: 'checking'
accessToken: null
isAuthenticated: false
```

`setSession` should call `clearLegacySession()` and store everything only in
Zustand memory.

- [ ] **Step 5: Run store tests**

Run:

```bash
pnpm --filter admin test -- auth-store.test.ts session-storage.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit auth store refactor**

```bash
git add apps/admin/src/types/auth.ts apps/admin/src/lib/session-storage.ts apps/admin/src/lib/session-storage.test.ts apps/admin/src/stores/auth-store.ts apps/admin/src/stores/auth-store.test.ts
git commit -m "feat(admin): keep auth tokens in memory"
```

### Task 12: Add API Client Refresh And Credentialed Requests

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/api.test.ts`
- Modify: `apps/admin/src/app/api-client.ts`

- [ ] **Step 1: Write failing API client tests**

Add tests:

```text
login posts with credentials config
refresh posts with credentials config
logout posts with credentials config
401 from normal request triggers refresh then retries original request once
concurrent 401 responses share one refresh request
refresh failure calls onUnauthorized
login/refresh/logout failures are not retried through refresh
changePassword posts with bearer auth and credentials
admin reset password posts to /users/:id/reset-password
```

Run:

```bash
pnpm --filter admin test -- api.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Extend API client options**

In `apps/admin/src/lib/api.ts`, extend options:

```ts
interface ApiClientOptions {
  client?: HttpClient
  getAccessToken?: () => string | null
  setSession?: (session: AuthSession) => void
  onUnauthorized?: () => void
}
```

Add `withCredentials?: boolean` to `RequestConfig`.

- [ ] **Step 3: Add credentialed auth helpers**

Use:

```ts
const credentialedConfig: RequestConfig = { withCredentials: true }
```

Add methods:

```ts
refresh(): Promise<AuthSession>
logout(): Promise<void>
changePassword(payload: ChangePasswordRequest): Promise<void>
```

Login should call:

```ts
client.post<AuthSession>('/auth/login', credentials, credentialedConfig)
```

- [ ] **Step 4: Implement refresh/retry wrapper**

Inside `createApiClient`, keep:

```ts
let refreshPromise: Promise<AuthSession> | null = null
```

`request` should accept metadata:

```ts
async function request<T>(
  operation: () => Promise<{ data: T }>,
  options: { retryOnUnauthorized?: boolean } = { retryOnUnauthorized: true },
): Promise<T>
```

On 401:

```text
1. If retry disabled, call onUnauthorized and throw.
2. If no refreshPromise, call /auth/refresh with credentials.
3. setSession with the refresh response.
4. Retry original operation once.
5. If refresh fails, call onUnauthorized and throw.
```

Do not retry `/auth/login`, `/auth/refresh`, or `/auth/logout`.

- [ ] **Step 5: Wire app API client**

In `apps/admin/src/app/api-client.ts` pass:

```ts
setSession: (session) => useAuthStore.getState().setSession(session),
onUnauthorized: () => {
  useAuthStore.getState().setAnonymous()
  clearQueryCache()
  navigateTo('/login', 'replace')
},
```

- [ ] **Step 6: Run API client tests**

Run:

```bash
pnpm --filter admin test -- api.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit API client refresh behavior**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/lib/api.test.ts apps/admin/src/app/api-client.ts
git commit -m "feat(admin): add refresh retry api client"
```

### Task 13: Add Startup Refresh And Status-Aware Routing

**Files:**
- Modify: `apps/admin/src/AppContent.tsx`
- Modify: `apps/admin/src/lib/route-guard.ts`
- Modify: `apps/admin/src/lib/route-guard.test.ts`
- Modify: `apps/admin/src/features/auth/LoginView.tsx`
- Modify: `apps/admin/src/features/auth/LoginView.test.tsx`

- [ ] **Step 1: Write failing route guard tests**

Update route guard auth input:

```ts
interface RouteAuthState {
  status: 'checking' | 'authenticated' | 'anonymous'
  permissions: readonly string[]
}
```

Expected behavior:

```text
checking protected route -> status checking, no redirect
anonymous protected route -> /login
authenticated /login -> first visible route
authenticated missing permission -> /403
```

Run:

```bash
pnpm --filter admin test -- route-guard.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Update route guard implementation**

Add `checking` to `RouteResolution.status`:

```ts
status: 'ok' | 'checking' | 'login' | 'forbidden' | 'not_found'
```

Use `auth.status === 'authenticated'` instead of `isAuthenticated`.

- [ ] **Step 3: Write failing AppContent/Login tests**

Add tests that:

```text
AppContent calls api.refresh on startup when status is checking
refresh success stores session and renders authenticated route
refresh failure marks anonymous and shows/redirects login
LoginView redirects to first visible route after login
```

Run:

```bash
pnpm --filter admin test -- LoginView.test.tsx
```

Expected: FAIL for changed behavior.

- [ ] **Step 4: Implement startup refresh in `AppContent`**

Use `status` from auth store:

```ts
useEffect(() => {
  if (status !== 'checking') {
    return;
  }

  void api
    .refresh()
    .then((session) => setSession(session))
    .catch(() => setAnonymous());
}, [status, setSession, setAnonymous]);
```

While `resolution.status === 'checking'`, render a minimal full-screen loading
surface or `null`. Keep visible text brief and localized only if adding copy is
already easy; this is a transient state.

- [ ] **Step 5: Update LoginView redirect**

After login:

```ts
const firstRoute = getFirstVisibleRoute(session.user.permissions);
navigateTo(firstRoute?.path ?? '/403');
```

- [ ] **Step 6: Run route/auth UI tests**

Run:

```bash
pnpm --filter admin test -- route-guard.test.ts LoginView.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit startup routing**

```bash
git add apps/admin/src/AppContent.tsx apps/admin/src/lib/route-guard.ts apps/admin/src/lib/route-guard.test.ts apps/admin/src/features/auth/LoginView.tsx apps/admin/src/features/auth/LoginView.test.tsx
git commit -m "feat(admin): restore sessions on startup"
```

### Task 14: Wire Frontend Logout And Password Actions

**Files:**
- Modify: `apps/admin/src/layouts/AdminShell.tsx`
- Modify: `apps/admin/src/layouts/AdminShell.test.tsx`
- Modify: `apps/admin/src/features/users/users.types.ts`
- Modify: `apps/admin/src/features/users/users.api.ts`
- Modify: `apps/admin/src/features/users/UsersPage.tsx`
- Modify: `apps/admin/src/features/users/UsersPage.test.tsx`

- [ ] **Step 1: Write failing logout shell test**

Assert clicking sign out:

```text
calls api.logout
clears auth store and query cache
navigates to /login
still clears local state if api.logout rejects
```

Run:

```bash
pnpm --filter admin test -- AdminShell.test.tsx
```

Expected: FAIL.

- [ ] **Step 2: Update `AdminShell.signOut`**

Use:

```ts
async function signOut() {
  try {
    await api.logout()
  } finally {
    reset()
    clearQueryCache()
    navigateTo('/login')
  }
}
```

- [ ] **Step 3: Add frontend types and API wrapper for reset password**

In `apps/admin/src/features/users/users.types.ts`:

```ts
export interface ResetUserPasswordRequest {
  newPassword: string
}
```

In `apps/admin/src/features/users/users.api.ts`, expose:

```ts
resetPassword(id: string, payload: ResetUserPasswordRequest)
```

If `users.api.ts` delegates directly to `api.users`, add the shared client
method in Task 12 first.

- [ ] **Step 4: Decide UI scope for v1 reset password**

Use the existing user management patterns. If adding a polished modal is small,
add a reset-password action for users with `user.update`. If it would bloat the
task, keep only the API client method in v1 and document the UI as follow-up.

Preferred UI if implemented:

```text
row action -> reset password dialog -> new password field -> confirm
```

If the target user id equals the current user id, success should clear local auth
state and navigate to `/login`.

- [ ] **Step 5: Add tests for chosen reset-password scope**

If UI is implemented, add `UsersPage.test.tsx` cases:

```text
reset password submits /users/:id/reset-password
self reset clears auth state and navigates to /login
```

If UI is deferred, add `api.test.ts` coverage only and add a short note to the
plan execution summary.

- [ ] **Step 6: Run frontend tests**

Run:

```bash
pnpm --filter admin test -- AdminShell.test.tsx UsersPage.test.tsx api.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit logout/password frontend wiring**

```bash
git add apps/admin/src/layouts/AdminShell.tsx apps/admin/src/layouts/AdminShell.test.tsx apps/admin/src/features/users/users.types.ts apps/admin/src/features/users/users.api.ts apps/admin/src/features/users/UsersPage.tsx apps/admin/src/features/users/UsersPage.test.tsx apps/admin/src/lib/api.ts apps/admin/src/lib/api.test.ts
git commit -m "feat(admin): wire logout and password reset actions"
```

## Chunk 5: Full Verification And Cleanup

### Task 15: Run Backend Verification

**Files:**
- No code changes expected unless tests reveal a defect.

- [ ] **Step 1: Run focused backend auth/user tests**

Run:

```bash
pnpm --filter api test -- auth.service.spec.ts auth-flow.spec.ts jwt-access.strategy
pnpm --filter api test -- user.service.spec.ts
```

Expected: PASS. If `jwt-access.strategy` is not a standalone spec file, omit it
or add one during Task 8.

- [ ] **Step 2: Run all backend tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 3: Run backend lint/build**

Run:

```bash
pnpm --filter api lint
pnpm --filter api build
```

Expected: PASS.

### Task 16: Run Frontend Verification

**Files:**
- No code changes expected unless tests reveal a defect.

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
pnpm --filter admin test -- api.test.ts auth-store.test.ts session-storage.test.ts route-guard.test.ts LoginView.test.tsx AdminShell.test.tsx UsersPage.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run all frontend tests**

Run:

```bash
pnpm --filter admin test
```

Expected: PASS.

- [ ] **Step 3: Run frontend lint/build**

Run:

```bash
pnpm --filter admin lint
pnpm --filter admin build
```

Expected: PASS.

### Task 17: Run Repository Verification

**Files:**
- No code changes expected unless verification reveals a defect.

- [ ] **Step 1: Run root checks**

Run:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 2: Manual API smoke flow**

Start the API and admin in the normal local setup, then verify:

```text
login sets HttpOnly refresh cookie
reload of an authenticated admin page restores the session
expired access token path silently refreshes
logout clears cookie and old access token no longer works
change password forces re-login
admin reset password revokes target user's existing session
```

Expected: all flows match the spec.

- [ ] **Step 3: Final commit if fixes were needed**

If verification required any fixes:

```bash
git add <changed files>
git commit -m "fix: stabilize auth session lifecycle"
```

If no fixes were needed, do not create an empty commit.

## Notes For Implementers

- Do not store refresh tokens in frontend-accessible storage.
- Do not put permissions in JWT payloads.
- Keep the backend permission guard as the authorization boundary.
- Use `updateMany` for idempotent revocation.
- Use conditional update semantics for refresh rotation.
- Be careful with tests that mock Prisma: once JWT validation requires sessions,
  protected endpoint tests must mock `userSession.findUnique`.
- Existing uncommitted work may be present in the workspace. Do not revert files
  unrelated to this plan.
