# Error Handling Logging Observability Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unified API error responses, request ids, structured runtime logs, frontend `ApiError` handling, and a local Loki/Grafana/Alloy observability overlay.

**Architecture:** Keep audit logs as database-backed business records and add a separate runtime observability layer that writes structured logs to stdout/stderr. The API owns error envelopes, request id propagation, Pino logging, and audit `metadata.requestId`; the admin app owns normalized `ApiError` objects and user-facing error messages; Docker Compose owns local log collection and dashboard verification.

**Tech Stack:** NestJS 11, Express, class-validator, Prisma, Multer, Pino, nestjs-pino, React 19, Vite, TypeScript, Axios, TanStack Query, Sonner, Vitest, React Testing Library, Jest, Docker Compose, Grafana Loki, Grafana Alloy, Grafana.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-11-error-handling-logging-observability-design.md`
- Existing API bootstrap: `apps/api/src/main.ts`
- Existing API module: `apps/api/src/app.module.ts`
- Existing env validation: `apps/api/src/config/env.config.ts`
- Existing OpenAPI helper: `apps/api/src/openapi.ts`
- Existing audit request metadata helper: `apps/api/src/audit-log/audit-log-request-meta.ts`
- Existing frontend mutator: `apps/admin/src/app/api-mutator.ts`
- Existing frontend mutator tests: `apps/admin/src/app/api-mutator.test.ts`
- Existing table error state: `apps/admin/src/components/data-table/DataTable.tsx`
- Existing Docker Compose deployment: `docker-compose.yml`

## File Structure

### Create

- `apps/api/src/common/errors/error-codes.ts`: central error code constants and type.
- `apps/api/src/common/errors/app-exception.ts`: project exception class for business errors.
- `apps/api/src/common/errors/error-response.dto.ts`: Swagger DTO for the public error envelope.
- `apps/api/src/common/errors/exception-mapper.ts`: pure mapping from thrown values to safe error responses and log metadata.
- `apps/api/src/common/errors/exception-filter.ts`: global Nest exception filter that writes error envelopes and exception logs.
- `apps/api/src/common/errors/exception-mapper.spec.ts`: mapper unit tests.
- `apps/api/src/common/errors/exception-filter.spec.ts`: filter unit tests.
- `apps/api/src/common/errors/error-response.decorator.ts`: shared Swagger decorator for common error responses.
- `apps/api/src/common/errors/validation-errors.ts`: helper that converts class-validator errors to `details.fields`.
- `apps/api/src/common/logging/log-redaction.ts`: sensitive log field paths.
- `apps/api/src/common/logging/logging.module.ts`: Pino module configuration.
- `apps/api/src/common/logging/request-id.middleware.ts`: request id validation, generation, and response header propagation.
- `apps/api/src/common/logging/request-context.ts`: typed request context helpers used by exception responses, logging, and audit integration.
- `apps/api/src/common/logging/request-id.middleware.spec.ts`: request id unit tests.
- `apps/api/src/common/logging/log-redaction.spec.ts`: redaction configuration tests.
- `apps/api/src/diagnostics/diagnostics.controller.ts`: local-only diagnostics endpoint for observability smoke tests.
- `apps/api/src/diagnostics/diagnostics.module.ts`: conditionally registers diagnostics routes when enabled.
- `apps/api/src/diagnostics/diagnostics.controller.spec.ts`: verifies diagnostics routes are disabled by default and throw controlled 500s when enabled.
- `apps/api/src/diagnostics/diagnostics-flow.spec.ts`: verifies enabled diagnostics traffic passes through the real app prefix, middleware, filter, request id, and logging flow.
- `apps/admin/src/app/api-error.ts`: frontend `ApiError` type, guard, normalizer, and field error extraction.
- `apps/admin/src/app/api-error.test.ts`: frontend error normalization tests.
- `apps/admin/src/app/api-error-messages.ts`: user-facing i18n-aware error message helper.
- `apps/admin/src/app/api-error-messages.test.ts`: message helper tests.
- `docker-compose.observability.yml`: optional Loki/Grafana/Alloy overlay.
- `deploy/observability/loki/config.yml`: local Loki config.
- `deploy/observability/alloy/config.alloy`: Docker log collection pipeline.
- `deploy/observability/grafana/provisioning/datasources/loki.yml`: Grafana datasource provisioning.
- `deploy/observability/grafana/provisioning/dashboards/common-admin.yml`: Grafana dashboard provisioning.
- `deploy/observability/grafana/dashboards/api-logs.json`: API runtime logs dashboard.
- `docs/patterns/admin-error-logging-observability-guide.md`: operational guide.

### Modify

- `apps/api/package.json`: add `nestjs-pino`, `pino`, and `pino-pretty`; keep scripts unchanged.
- `apps/api/src/main.ts`: install global exception filter, validation exception factory, CORS request id headers, and Pino bootstrap logger.
- `apps/api/src/app.module.ts`: import `LoggingModule`, implement request id middleware registration.
- `apps/api/src/config/env.config.ts`: add `LOG_LEVEL`, `LOG_PRETTY`, `SERVICE_NAME`, `APP_ENV`, and `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT`.
- `apps/api/src/openapi.ts`: expose the shared error response DTO through OpenAPI metadata.
- `apps/api/src/audit-log/audit-log-request-meta.ts`: keep transport metadata focused on IP/user agent and add a helper to merge `metadata.requestId`.
- `apps/api/src/audit-log/audit-log-request-meta.spec.ts`: cover request id metadata merge behavior.
- `apps/api/src/user/user.controller.ts`: pass request id metadata into audited write service calls.
- `apps/api/src/role/role.controller.ts`: pass request id metadata into audited write service calls.
- `apps/api/src/dictionary/dictionary-type.controller.ts`: pass request id metadata into audited write service calls.
- `apps/api/src/dictionary/dictionary-item.controller.ts`: pass request id metadata into audited write service calls.
- `apps/api/src/file/file.controller.ts`: pass request id metadata into audited write service calls and map upload exceptions.
- `apps/api/src/**/**/*.service.spec.ts`: update audit expectations to include `metadata.requestId` where controller inputs include it.
- `apps/admin/src/app/api-mutator.ts`: throw `ApiError` for final request failures while preserving refresh/replay behavior.
- `apps/admin/src/app/api-mutator.test.ts`: cover server, network, and post-refresh normalized failures.
- `apps/admin/src/components/data-table/DataTable.tsx`: render shared error messages instead of raw `Error.message`.
- `apps/admin/src/features/auth/LoginView.tsx`: use shared mutation error message helper.
- `apps/admin/src/layouts/AdminShell.tsx`: use shared mutation error message helper for change password.
- `apps/admin/src/features/users/UsersPage.tsx`: replace local `mutationErrorMessage`.
- `apps/admin/src/features/roles/RolesPage.tsx`: replace local `mutationErrorMessage`.
- `apps/admin/src/features/dictionaries/DictionariesPage.tsx`: replace local `mutationErrorMessage`.
- `apps/admin/src/features/files/FilesPage.tsx`: replace local `mutationErrorMessage`.
- `apps/admin/src/features/audit-logs/AuditLogsPage.tsx`: replace local `mutationErrorMessage`.
- `apps/admin/src/i18n/messages.ts`: add shared error messages.
- `docker-compose.yml`: add API logging env defaults for production compose.
- `.env.example` and `.env.deploy.example`: document logging env vars for local and Compose deployment.
- `README.md`: link the new observability guide.

## Chunk 1: Backend Error Model And Global Exception Filter

### Task 1: Add Error Codes, AppException, And Response DTO

**Files:**
- Create: `apps/api/src/common/errors/error-codes.ts`
- Create: `apps/api/src/common/errors/app-exception.ts`
- Create: `apps/api/src/common/errors/error-response.dto.ts`
- Create: `apps/api/src/common/errors/error-response.decorator.ts`
- Test: `apps/api/src/common/errors/exception-mapper.spec.ts`

- [ ] **Step 1: Write failing tests for the public error model**

Create `apps/api/src/common/errors/exception-mapper.spec.ts` with initial expectations for `AppException` fields and `ErrorResponseDto` importability:

```ts
import { AppException } from './app-exception';
import { ERROR_CODES } from './error-codes';
import { ErrorResponseDto } from './error-response.dto';

describe('AppException', () => {
  it('stores a stable code, status, message, and details', () => {
    const exception = new AppException({
      code: ERROR_CODES.CONFLICT,
      message: 'Conflict',
      statusCode: 409,
      details: { field: 'email' },
    });

    expect(exception.getStatus()).toBe(409);
    expect(exception.code).toBe(ERROR_CODES.CONFLICT);
    expect(exception.message).toBe('Conflict');
    expect(exception.details).toEqual({ field: 'email' });
  });

  it('exports the public error response DTO', () => {
    expect(ErrorResponseDto).toEqual(expect.any(Function));
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter api test -- common/errors/exception-mapper.spec.ts
```

Expected: FAIL because the new files do not exist.

- [ ] **Step 3: Implement error code constants**

Create `apps/api/src/common/errors/error-codes.ts`:

```ts
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  USER_EMAIL_ALREADY_EXISTS: 'USER_EMAIL_ALREADY_EXISTS',
  ROLE_CODE_ALREADY_EXISTS: 'ROLE_CODE_ALREADY_EXISTS',
  DICTIONARY_CODE_ALREADY_EXISTS: 'DICTIONARY_CODE_ALREADY_EXISTS',
  FILE_UPLOAD_REQUIRED: 'FILE_UPLOAD_REQUIRED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

- [ ] **Step 4: Implement AppException**

Create `apps/api/src/common/errors/app-exception.ts`:

```ts
import { HttpException } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

interface AppExceptionInput {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: unknown;
  log?: boolean;
}

export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details: unknown;
  readonly shouldLog: boolean;

  constructor(input: AppExceptionInput) {
    super(input.message, input.statusCode);
    this.code = input.code;
    this.details = input.details;
    this.shouldLog = input.log ?? false;
  }
}
```

- [ ] **Step 5: Implement ErrorResponseDto and decorator**

Create `apps/api/src/common/errors/error-response.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorFieldDto {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Request validation failed' })
  message!: string;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'req_01HZ0000000000000000000000' })
  requestId!: string;

  @ApiProperty({ example: '/api/users' })
  path!: string;

  @ApiProperty({ example: '2026-06-11T10:20:30.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({
    example: { fields: [{ field: 'email', message: 'email must be an email' }] },
  })
  details?: unknown;
}
```

Create `apps/api/src/common/errors/error-response.decorator.ts`:

```ts
import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse, ApiInternalServerErrorResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './error-response.dto';

export function ApiCommonErrorResponses() {
  return applyDecorators(
    ApiBadRequestResponse({ type: ErrorResponseDto }),
    ApiInternalServerErrorResponse({ type: ErrorResponseDto }),
  );
}
```

- [ ] **Step 6: Run the test**

Run:

```bash
pnpm --filter api test -- common/errors/exception-mapper.spec.ts
```

Expected: PASS for the initial error model tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/errors/error-codes.ts apps/api/src/common/errors/app-exception.ts apps/api/src/common/errors/error-response.dto.ts apps/api/src/common/errors/error-response.decorator.ts apps/api/src/common/errors/exception-mapper.spec.ts
git commit -m "feat(api): add application error model"
```

### Task 2: Implement Exception Mapping

**Files:**
- Create: `apps/api/src/common/errors/validation-errors.ts`
- Create: `apps/api/src/common/errors/exception-mapper.ts`
- Modify: `apps/api/src/common/errors/exception-mapper.spec.ts`

- [ ] **Step 1: Extend mapper tests**

Add cases for:

- `AppException` preserves code/status/details.
- `BadRequestException` maps to `BAD_REQUEST`.
- validation arrays map to `VALIDATION_ERROR` with `details.fields`.
- `UnauthorizedException`, `ForbiddenException`, and `NotFoundException` map to their matching base codes.
- `ThrottlerException` or an HTTP 429 exception maps to `RATE_LIMITED`.
- HTTP 415 exceptions map to `UNSUPPORTED_MEDIA_TYPE`.
- Prisma-like `{ code: 'P2002' }` maps to `CONFLICT`.
- Prisma-like `{ code: 'P2025' }` maps to `NOT_FOUND`.
- Multer-like `{ code: 'LIMIT_FILE_SIZE' }` maps to `PAYLOAD_TOO_LARGE`.
- unknown `Error` maps to `INTERNAL_SERVER_ERROR` with a safe message.

Use a fake request context:

```ts
const context = {
  path: '/api/users',
  requestId: 'req_test123',
  timestamp: '2026-06-11T10:20:30.000Z',
};
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
pnpm --filter api test -- common/errors/exception-mapper.spec.ts
```

Expected: FAIL because `mapExceptionToErrorResponse` is not implemented.

- [ ] **Step 3: Implement validation field extraction**

Create `apps/api/src/common/errors/validation-errors.ts`:

```ts
import type { ValidationError } from 'class-validator';

export interface ValidationFieldError {
  field: string;
  message: string;
}

export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationFieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    return [
      ...ownMessages,
      ...flattenValidationErrors(error.children ?? [], field),
    ];
  });
}
```

- [ ] **Step 4: Implement exception mapper**

Create `apps/api/src/common/errors/exception-mapper.ts` with a pure function returning:

```ts
export interface MappedException {
  response: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    requestId: string;
    path: string;
    timestamp: string;
    details?: unknown;
  };
  logLevel: 'warn' | 'error';
  shouldLogException: boolean;
  error: unknown;
}
```

Mapping rules:

- `AppException`: use its code/status/details/message and `shouldLogException = exception.shouldLog || status >= 500`.
- `HttpException`: use status and map known statuses to base codes.
- validation response arrays: return `VALIDATION_ERROR` and `details.fields`.
- HTTP 429 or `ThrottlerException`: `RATE_LIMITED`, 429.
- HTTP 415: `UNSUPPORTED_MEDIA_TYPE`, 415.
- Prisma `P2002`: `CONFLICT`, 409.
- Prisma `P2025`: `NOT_FOUND`, 404.
- Multer `LIMIT_FILE_SIZE`: `PAYLOAD_TOO_LARGE`, 413.
- Multer other errors: `BAD_REQUEST`, 400.
- unknown errors: `INTERNAL_SERVER_ERROR`, 500, generic message.

- [ ] **Step 5: Run mapper tests**

Run:

```bash
pnpm --filter api test -- common/errors/exception-mapper.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/errors/validation-errors.ts apps/api/src/common/errors/exception-mapper.ts apps/api/src/common/errors/exception-mapper.spec.ts
git commit -m "feat(api): map exceptions to error envelopes"
```

### Task 3: Add Global Exception Filter And Validation Factory

**Files:**
- Create: `apps/api/src/common/errors/exception-filter.ts`
- Create: `apps/api/src/common/errors/exception-filter.spec.ts`
- Create: `apps/api/src/common/logging/request-context.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/openapi.ts`
- Modify: `apps/api/src/openapi.spec.ts`

- [ ] **Step 1: Write filter tests**

Create tests that mock `ArgumentsHost`, a response object, and a logger object. Cover:

- `BadRequestException` writes the unified JSON response.
- unknown `Error` writes `INTERNAL_SERVER_ERROR` without stack in the response.
- unknown `Error` calls `logger.error`.
- expected validation `4xx` does not call `logger.error`.
- missing request context falls back to `unknown` request id until the request id middleware lands in Chunk 2.

- [ ] **Step 2: Run failing filter tests**

Run:

```bash
pnpm --filter api test -- common/errors/exception-filter.spec.ts
```

Expected: FAIL because the filter does not exist.

- [ ] **Step 3: Implement the filter**

Create `apps/api/src/common/errors/exception-filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { mapExceptionToErrorResponse } from './exception-mapper';
import { getRequestIdFromRequest } from '../logging/request-context';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const mapped = mapExceptionToErrorResponse(exception, {
      path: request.originalUrl ?? request.url,
      requestId: getRequestIdFromRequest(request),
      timestamp: new Date().toISOString(),
    });

    if (mapped.shouldLogException) {
      this.logger.error(
        JSON.stringify({
          err: exception,
          code: mapped.response.code,
          requestId: mapped.response.requestId,
          method: request.method,
          path: mapped.response.path,
          userId: request.user?.sub,
        }),
        mapped.response.statusCode >= 500 ? 'Unhandled exception' : 'Request exception',
      );
    }

    response.status(mapped.response.statusCode).json(mapped.response);
  }
}
```

Also create a minimal `apps/api/src/common/logging/request-context.ts` so this chunk compiles before request id middleware is implemented:

```ts
import type { Request } from 'express';

const requestIdKey = Symbol.for('common-admin.requestId');

type RequestWithContext = Request & { [requestIdKey]?: string };

export function setRequestId(request: Request, requestId: string) {
  (request as RequestWithContext)[requestIdKey] = requestId;
}

export function getRequestIdFromRequest(request: Request): string {
  return (request as RequestWithContext)[requestIdKey] ?? 'unknown';
}
```

- [ ] **Step 4: Update ValidationPipe in `main.ts`**

Add an `exceptionFactory` that throws `AppException`:

```ts
exceptionFactory: (errors) =>
  new AppException({
    code: ERROR_CODES.VALIDATION_ERROR,
    message: 'Request validation failed',
    statusCode: 400,
    details: { fields: flattenValidationErrors(errors) },
  }),
```

- [ ] **Step 5: Register the global filter**

In `main.ts`, after creating the app and before listening, register:

```ts
app.useGlobalFilters(app.get(GlobalExceptionFilter));
```

Modify `apps/api/src/app.module.ts` and add `GlobalExceptionFilter` to `providers` so `app.get(GlobalExceptionFilter)` succeeds. Do not use `APP_FILTER` yet because this plan keeps all HTTP bootstrap behavior in `main.ts`.

- [ ] **Step 6: Add OpenAPI error DTO metadata**

In `apps/api/src/openapi.ts`, import `ErrorResponseDto` and pass it through the Swagger `extraModels` option:

```ts
const document = SwaggerModule.createDocument(app, swaggerConfig, {
  ignoreGlobalPrefix: true,
  extraModels: [ErrorResponseDto],
});
```

Add `ApiCommonErrorResponses()` to `AuthController` for the login endpoint as the first concrete shared-decorator adoption, and update `apps/api/src/openapi.spec.ts` to assert:

- `components.schemas.ErrorResponseDto` exists;
- `POST /auth/login` has a `400` response that references `ErrorResponseDto`.

Later controller-specific error documentation may broaden this decorator, but this task must prove the shared DTO and decorator are wired into the generated OpenAPI document.

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter api test -- common/errors/exception-mapper.spec.ts common/errors/exception-filter.spec.ts openapi.spec.ts main.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/common/errors apps/api/src/common/logging/request-context.ts apps/api/src/auth/auth.controller.ts apps/api/src/app.module.ts apps/api/src/main.ts apps/api/src/openapi.ts apps/api/src/openapi.spec.ts apps/api/src/main.spec.ts
git commit -m "feat(api): return unified error responses"
```

## Chunk 2: Request Ids, Runtime Logging, And Audit Correlation

### Task 1: Add Logging Dependencies And Environment Variables

**Files:**
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/api/src/config/env.config.ts`
- Modify: `apps/api/src/config/env.config.spec.ts`

- [ ] **Step 1: Install logging dependencies**

Run:

```bash
pnpm --filter api add nestjs-pino pino
pnpm --filter api add -D pino-pretty
```

Expected: package manifest and lockfile update.

- [ ] **Step 2: Write env tests**

Update `apps/api/src/config/env.config.spec.ts` to assert defaults:

```ts
expect(validateEnv({}).LOG_LEVEL).toBe('debug');
expect(validateEnv({}).LOG_PRETTY).toBe(true);
expect(validateEnv({ NODE_ENV: 'test' }).LOG_LEVEL).toBe('silent');
expect(
  validateEnv({
    NODE_ENV: 'production',
    JWT_ACCESS_TOKEN_SECRET: 'configured-secret-123',
    AUTH_REFRESH_COOKIE_SECURE: 'true',
  }).LOG_LEVEL,
).toBe('info');
expect(
  validateEnv({
    NODE_ENV: 'production',
    JWT_ACCESS_TOKEN_SECRET: 'configured-secret-123',
    AUTH_REFRESH_COOKIE_SECURE: 'true',
  }).LOG_PRETTY,
).toBe(false);
expect(validateEnv({}).SERVICE_NAME).toBe('api');
expect(validateEnv({}).APP_ENV).toBe('development');
expect(validateEnv({}).ENABLE_DIAGNOSTIC_ERROR_ENDPOINT).toBe(false);
expect(
  validateEnv({ ENABLE_DIAGNOSTIC_ERROR_ENDPOINT: 'true' })
    .ENABLE_DIAGNOSTIC_ERROR_ENDPOINT,
).toBe(true);
```

- [ ] **Step 3: Run failing env tests**

Run:

```bash
pnpm --filter api test -- config/env.config.spec.ts
```

Expected: FAIL because logging env vars do not exist.

- [ ] **Step 4: Add env schema entries**

Add a local boolean preprocessor, following the existing inline boolean handling
pattern for refresh cookie config:

```ts
function parseBooleanLike(value: unknown): unknown {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}
```

Then add `LOG_LEVEL`, `LOG_PRETTY`, `SERVICE_NAME`, `APP_ENV`, and
`ENABLE_DIAGNOSTIC_ERROR_ENDPOINT`. Because the log defaults depend on
`NODE_ENV`, either parse `NODE_ENV` first or apply these defaults after
`envSchema.parse(config)` in `validateEnv`:

```ts
const defaultLogLevel =
  env.NODE_ENV === 'production'
    ? 'info'
    : env.NODE_ENV === 'test'
      ? 'silent'
      : 'debug';
```

Do not reference an undefined helper such as `booleanParser`.

`ENABLE_DIAGNOSTIC_ERROR_ENDPOINT` must default to `false`. It exists only for
local observability smoke tests and must be explicitly enabled by the optional
observability compose overlay.

- [ ] **Step 5: Run env tests**

Run:

```bash
pnpm --filter api test -- config/env.config.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/config/env.config.ts apps/api/src/config/env.config.spec.ts
git commit -m "feat(api): add logging environment config"
```

### Task 2: Add Request Id Middleware And Context Helpers

**Files:**
- Modify: `apps/api/src/common/logging/request-context.ts`
- Create: `apps/api/src/common/logging/request-id.middleware.ts`
- Create: `apps/api/src/common/logging/request-id.middleware.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Write request id middleware tests**

Cover:

- Accepts valid `x-request-id`.
- Replaces missing id.
- Replaces invalid id with spaces or too-long values.
- Replaces array-valued or duplicate `x-request-id` headers because the spec
  accepts only a single string.
- Writes selected id to the response header.
- Stores selected id on the request object.
- `getRequestLogContext(request)` exposes `requestId`, `method`, `path`,
  `userId`, `ip`, and `userAgent`.

- [ ] **Step 2: Run failing middleware tests**

Run:

```bash
pnpm --filter api test -- common/logging/request-id.middleware.spec.ts
```

Expected: FAIL because middleware files do not exist and `request-context.ts`
does not yet expose the full logging context.

- [ ] **Step 3: Implement request context helper**

Extend the `apps/api/src/common/logging/request-context.ts` file created in
Chunk 1:

```ts
import type { Request } from 'express';

const requestIdKey = Symbol.for('common-admin.requestId');

type RequestWithContext = Request & { [requestIdKey]?: string };

export function setRequestId(request: Request, requestId: string) {
  (request as RequestWithContext)[requestIdKey] = requestId;
}

export function getRequestIdFromRequest(request: Request): string {
  return (request as RequestWithContext)[requestIdKey] ?? 'unknown';
}

export function getRequestLogContext(request: Request) {
  const userAgent = request.headers['user-agent'];

  return {
    requestId: getRequestIdFromRequest(request),
    method: request.method,
    path: request.originalUrl ?? request.url,
    userId: request.user?.sub,
    ip: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  };
}
```

- [ ] **Step 4: Implement middleware**

Create `apps/api/src/common/logging/request-id.middleware.ts`:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { setRequestId } from './request-context';

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && requestIdPattern.test(value);
}

export function createRequestId(): string {
  return `req_${randomUUID()}`;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const incoming = request.headers['x-request-id'];
    const requestId = isValidRequestId(incoming) ? incoming : createRequestId();

    setRequestId(request, requestId);
    response.setHeader('x-request-id', requestId);
    next();
  }
}
```

- [ ] **Step 5: Register middleware and CORS headers**

Modify `apps/api/src/app.module.ts` to implement `NestModule` and register `RequestIdMiddleware` for all routes:

```ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

Modify `apps/api/src/main.ts` CORS config:

```ts
allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
exposedHeaders: ['x-request-id'],
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter api test -- common/logging/request-id.middleware.spec.ts main.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/logging/request-context.ts apps/api/src/common/logging/request-id.middleware.ts apps/api/src/common/logging/request-id.middleware.spec.ts apps/api/src/app.module.ts apps/api/src/main.ts apps/api/src/main.spec.ts
git commit -m "feat(api): add request id middleware"
```

### Task 3: Configure Pino Runtime Logging

**Files:**
- Create: `apps/api/src/common/logging/log-redaction.ts`
- Create: `apps/api/src/common/logging/log-redaction.spec.ts`
- Create: `apps/api/src/common/logging/logging.module.ts`
- Create: `apps/api/src/common/logging/logging.module.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/common/errors/exception-filter.ts`

- [ ] **Step 1: Write logging configuration tests**

In `log-redaction.spec.ts`, assert that redaction paths include:

```text
req.headers.authorization
req.headers.cookie
res.headers.set-cookie
password
oldPassword
newPassword
accessToken
refreshToken
```

In `logging.module.spec.ts`, test a pure factory such as
`createPinoHttpOptions(env)` and assert:

- JSON production config has no pretty transport.
- local pretty config enables `pino-pretty`.
- request logs include top-level `requestId`, `method`, `path`, `statusCode`,
  `durationMs`, `ip`, and optional `userId`.
- severity policy returns `info` for 2xx/3xx, `warn` for 4xx, and `error` for
  5xx.
- serializers or custom props do not include raw `authorization`, `cookie`, or
  password/token fields.

- [ ] **Step 2: Run failing redaction tests**

Run:

```bash
pnpm --filter api test -- common/logging/log-redaction.spec.ts common/logging/logging.module.spec.ts
```

Expected: FAIL because logging config files do not exist.

- [ ] **Step 3: Implement redaction paths**

Create `apps/api/src/common/logging/log-redaction.ts`:

```ts
export const LOG_REDACTION_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers.set-cookie',
  '*.password',
  '*.oldPassword',
  '*.newPassword',
  '*.accessToken',
  '*.refreshToken',
  'password',
  'oldPassword',
  'newPassword',
  'accessToken',
  'refreshToken',
];
```

- [ ] **Step 4: Implement LoggingModule**

Create `apps/api/src/common/logging/logging.module.ts` with a testable factory:

```ts
export function createPinoHttpOptions(env: Pick<AppEnv, 'LOG_LEVEL' | 'LOG_PRETTY' | 'SERVICE_NAME' | 'APP_ENV'>) {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      base: {
        service: env.SERVICE_NAME,
        env: env.APP_ENV,
      },
      redact: {
        paths: LOG_REDACTION_PATHS,
        censor: '[Redacted]',
      },
      customProps: (request) => getRequestLogContext(request),
      customAttributeKeys: {
        responseTime: 'durationMs',
      },
      customLogLevel: (_request, response, error) => {
        if (error || response.statusCode >= 500) {
          return 'error';
        }
        if (response.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      customSuccessMessage: () => 'request completed',
    },
  };
}
```

Then have `LoggerModule.forRootAsync` call this factory. Configure:

- `level` from `LOG_LEVEL`.
- `redact.paths` from `LOG_REDACTION_PATHS`.
- `transport` with `pino-pretty` only when `LOG_PRETTY=true`.
- `base` fields: `service` and `env`.
- request custom props from `getRequestLogContext(request)`: `requestId`,
  `method`, `path`, `userId`, `ip`, and `userAgent`.
- status code and duration fields at top level for request logs.
- request message: `request completed`.

After Pino is installed, update `GlobalExceptionFilter` to inject `PinoLogger`
or the `nestjs-pino` logger service and log structured objects instead of the
temporary Nest `Logger` JSON string from Chunk 1. The exception filter tests
should continue to assert that expected 4xx responses do not emit exception
logs and unknown/5xx failures do.

- [ ] **Step 5: Wire Pino into Nest bootstrap**

Modify `apps/api/src/app.module.ts` imports to include `LoggingModule`.

Modify `apps/api/src/main.ts`:

```ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

Import `Logger` from `nestjs-pino`.

- [ ] **Step 6: Replace bootstrap console error**

Use a plain fallback logger for bootstrap failures before Nest is available:

```ts
void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

Keep `console.error` only for this bootstrap failure path.

- [ ] **Step 7: Run tests and lint**

Run:

```bash
pnpm --filter api test -- common/logging/log-redaction.spec.ts common/logging/logging.module.spec.ts common/errors/exception-filter.spec.ts main.spec.ts
pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/common/logging apps/api/src/app.module.ts apps/api/src/main.ts apps/api/src/main.spec.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): configure structured runtime logging"
```

### Task 4: Add Request Id To Audit Metadata

**Files:**
- Modify: `apps/api/src/audit-log/audit-log-request-meta.ts`
- Modify: `apps/api/src/audit-log/audit-log-request-meta.spec.ts`
- Modify: `apps/api/src/user/user.controller.ts`
- Create: `apps/api/src/user/user.controller.spec.ts`
- Modify: `apps/api/src/user/user.service.ts`
- Modify: `apps/api/src/user/user.service.spec.ts`
- Modify: `apps/api/src/role/role.controller.ts`
- Modify: `apps/api/src/role/role.controller.spec.ts`
- Modify: `apps/api/src/role/role.service.ts`
- Modify: `apps/api/src/role/role.service.spec.ts`
- Modify: `apps/api/src/dictionary/dictionary-type.controller.ts`
- Create: `apps/api/src/dictionary/dictionary-type.controller.spec.ts`
- Modify: `apps/api/src/dictionary/dictionary-type.service.ts`
- Modify: `apps/api/src/dictionary/dictionary-type.service.spec.ts`
- Modify: `apps/api/src/dictionary/dictionary-item.controller.ts`
- Create: `apps/api/src/dictionary/dictionary-item.controller.spec.ts`
- Modify: `apps/api/src/dictionary/dictionary-item.service.ts`
- Modify: `apps/api/src/dictionary/dictionary-item.service.spec.ts`
- Modify: `apps/api/src/file/file.controller.ts`
- Modify: `apps/api/src/file/file.controller.spec.ts`
- Modify: `apps/api/src/file/file.service.ts`
- Modify: `apps/api/src/file/file.service.spec.ts`

- [ ] **Step 1: Write audit metadata helper tests**

Add tests for a helper named `withAuditRequestId`:

```ts
expect(withAuditRequestId(undefined, 'req_12345678')).toEqual({
  requestId: 'req_12345678',
});
expect(withAuditRequestId({ reason: 'support' }, 'req_12345678')).toEqual({
  reason: 'support',
  requestId: 'req_12345678',
});
expect(withAuditRequestId({ requestId: 'caller-value' }, 'req_12345678')).toEqual({
  requestId: 'req_12345678',
});
expect(getAuditRequestMeta(request)).not.toHaveProperty('requestId');
```

The selected request id must overwrite any caller-provided `metadata.requestId`
so audit records always correlate to the actual HTTP request.

- [ ] **Step 2: Run failing audit tests**

Run:

```bash
pnpm --filter api test -- audit-log/audit-log-request-meta.spec.ts
```

Expected: FAIL because `withAuditRequestId` does not exist.

- [ ] **Step 3: Implement metadata merge helper**

In `apps/api/src/audit-log/audit-log-request-meta.ts`, add:

```ts
export function withAuditRequestId(
  metadata: Record<string, unknown> | undefined,
  requestId: string,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    requestId,
  };
}
```

Keep `getAuditRequestMeta` limited to `ipAddress` and `userAgent`.

- [ ] **Step 4: Update controllers**

In audited write controllers, read:

```ts
const requestId = getRequestIdFromRequest(request);
```

Update service method signatures to accept an optional audit metadata argument
separate from `requestMeta`. For example:

```ts
createUser(dto, actor, requestMeta, auditMetadata)
```

In controllers, call services with:

```ts
const auditMetadata = withAuditRequestId(undefined, requestId);
return this.userService.createUser(
  body,
  buildAuditActor(user),
  getAuditRequestMeta(request),
  auditMetadata,
);
```

For service methods that already create domain metadata, merge the incoming
audit metadata into the final `AuditLogService.record({ metadata })` payload:

```ts
metadata: {
  ...domainMetadata,
  ...auditMetadata,
}
```

The important boundary is: `requestMeta` remains `ipAddress` and `userAgent`;
`metadata.requestId` is persisted through the `metadata` field.

- [ ] **Step 5: Update service tests**

Update service specs to pass `auditMetadata` into audited service methods and
assert `AuditLogService.record` receives:

```ts
metadata: expect.objectContaining({ requestId: 'req_12345678' })
```

Also update controller specs, or add them where missing, to prove controllers
read `getRequestIdFromRequest(request)` and pass the resulting audit metadata
into service calls. Use a mock request whose request context has been populated
with `setRequestId(request, 'req_12345678')`.

- [ ] **Step 6: Run focused audit tests**

Run:

```bash
pnpm --filter api test -- audit-log/audit-log-request-meta.spec.ts user/user.service.spec.ts role/role.service.spec.ts dictionary/dictionary-type.service.spec.ts dictionary/dictionary-item.service.spec.ts file/file.service.spec.ts user/user.controller.spec.ts role/role.controller.spec.ts file/file.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/audit-log/audit-log-request-meta.ts apps/api/src/audit-log/audit-log-request-meta.spec.ts apps/api/src/user apps/api/src/role apps/api/src/dictionary apps/api/src/file
git commit -m "feat(api): correlate audit logs with request ids"
```

## Chunk 3: Frontend ApiError Normalization And Page Migration

### Task 1: Add ApiError Type And Normalizer

**Files:**
- Create: `apps/admin/src/app/api-error.ts`
- Create: `apps/admin/src/app/api-error.test.ts`

- [ ] **Step 1: Write ApiError tests**

Cover:

- server error envelope becomes `ApiError`;
- response header `x-request-id` is used when body lacks `requestId`;
- network Axios error becomes `NETWORK_ERROR`;
- malformed server response becomes `UNKNOWN_API_ERROR`;
- validation field details are extracted.

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter admin test -- src/app/api-error.test.ts
```

Expected: FAIL because `api-error.ts` does not exist.

- [ ] **Step 3: Implement `api-error.ts`**

Create:

```ts
export type ApiError = {
  code: string
  message: string
  statusCode?: number
  requestId?: string
  path?: string
  timestamp?: string
  details?: unknown
  cause?: unknown
}
```

Add:

```ts
export function isApiError(error: unknown): error is ApiError
export function toApiError(error: unknown): ApiError
export function getValidationFieldErrors(error: unknown): Array<{ field: string; message: string }>
```

Use Axios `isAxiosError` to inspect `error.response?.data`.

- [ ] **Step 4: Run ApiError tests**

Run:

```bash
pnpm --filter admin test -- src/app/api-error.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/api-error.ts apps/admin/src/app/api-error.test.ts
git commit -m "feat(admin): normalize api errors"
```

### Task 2: Throw ApiError From The Mutator

**Files:**
- Modify: `apps/admin/src/app/api-mutator.ts`
- Modify: `apps/admin/src/app/api-mutator.test.ts`

- [ ] **Step 1: Extend mutator tests**

Add tests:

- non-401 server error rejects with `ApiError`;
- login 401 is not refreshed and rejects with `ApiError`;
- concurrent ordinary 401 responses share one refresh request and replay each
  original request after that shared refresh resolves;
- refresh failure still clears session/cache and rejects with normalized `ApiError`;
- replay failure after successful refresh rejects with normalized `ApiError`;
- network error rejects with `NETWORK_ERROR`.

- [ ] **Step 2: Run failing mutator tests**

Run:

```bash
pnpm --filter admin test -- src/app/api-mutator.test.ts
```

Expected: FAIL because mutator still throws raw Axios errors.

- [ ] **Step 3: Update mutator catch paths**

In `apiMutator`, keep the 401 refresh decision against raw Axios errors. Convert only final failures:

```ts
if (!isUnauthorizedError(error) || shouldSkipRefresh(config.url)) {
  throw toApiError(error);
}

try {
  await apiRefreshCoordinator.refresh();
  const replayResponse = await apiClient.request<T>(mergeRequestConfig(config, options));
  return replayResponse.data;
} catch (replayOrRefreshError) {
  throw toApiError(replayOrRefreshError);
}
```

If refresh coordinator tests expect raw errors, update them to assert session/cache behavior and normalized thrown error where the mutator is the public boundary.

- [ ] **Step 4: Run mutator tests**

Run:

```bash
pnpm --filter admin test -- src/app/api-mutator.test.ts src/app/api-refresh-coordinator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/api-mutator.ts apps/admin/src/app/api-mutator.test.ts apps/admin/src/app/api-refresh-coordinator.test.ts
git commit -m "feat(admin): throw normalized api errors"
```

### Task 3: Add User-Facing Error Message Helper

**Files:**
- Create: `apps/admin/src/app/api-error-messages.ts`
- Create: `apps/admin/src/app/api-error-messages.test.ts`
- Modify: `apps/admin/src/i18n/messages.ts`

- [ ] **Step 1: Write message helper tests**

Cover:

- known code returns localized message;
- `USER_EMAIL_ALREADY_EXISTS`, `ROLE_CODE_ALREADY_EXISTS`,
  `DICTIONARY_CODE_ALREADY_EXISTS`, `FILE_UPLOAD_REQUIRED`, and
  `FILE_NOT_FOUND` return code-specific localized messages;
- `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, and `UNSUPPORTED_MEDIA_TYPE` return
  shared localized messages;
- `INTERNAL_SERVER_ERROR` includes request id when present;
- fallback is used for unknown errors;
- raw `Error` still produces fallback-safe text.

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter admin test -- src/app/api-error-messages.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Add i18n keys**

Add shared keys to `apps/admin/src/i18n/messages.ts`:

```text
errors.network
errors.validation
errors.forbidden
errors.rateLimited
errors.payloadTooLarge
errors.unsupportedMediaType
errors.conflict
errors.userEmailAlreadyExists
errors.roleCodeAlreadyExists
errors.dictionaryCodeAlreadyExists
errors.fileUploadRequired
errors.fileNotFound
errors.internal
errors.internalWithRequestId
errors.unknown
```

Add English and Chinese values.

- [ ] **Step 4: Implement helper**

Create `api-error-messages.ts`:

```ts
export function getErrorMessage(
  error: unknown,
  fallback: string,
  t?: (key: string, values?: Record<string, string>) => string,
): string
```

Map common codes to i18n keys and use backend `ApiError.message` only after code-based local messages and explicit fallback.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter admin test -- src/app/api-error-messages.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/api-error-messages.ts apps/admin/src/app/api-error-messages.test.ts apps/admin/src/i18n/messages.ts
git commit -m "feat(admin): add api error messages"
```

### Task 4: Migrate Existing Error Surfaces

**Files:**
- Modify: `apps/admin/src/components/data-table/DataTable.tsx`
- Modify: `apps/admin/src/features/auth/LoginView.tsx`
- Modify: `apps/admin/src/features/auth/LoginView.test.tsx`
- Modify: `apps/admin/src/layouts/AdminShell.tsx`
- Modify: `apps/admin/src/layouts/AdminShell.test.tsx`
- Modify: `apps/admin/src/features/users/UsersPage.tsx`
- Modify: `apps/admin/src/features/users/UsersPage.test.tsx`
- Modify: `apps/admin/src/features/roles/RolesPage.tsx`
- Modify: `apps/admin/src/features/roles/RolesPage.test.tsx`
- Modify: `apps/admin/src/features/dictionaries/DictionariesPage.tsx`
- Modify: `apps/admin/src/features/dictionaries/DictionariesPage.test.tsx`
- Modify: `apps/admin/src/features/files/FilesPage.tsx`
- Modify: `apps/admin/src/features/files/FilesPage.test.tsx`
- Modify: `apps/admin/src/features/audit-logs/AuditLogsPage.tsx`
- Modify: `apps/admin/src/features/audit-logs/AuditLogsPage.test.tsx`

- [ ] **Step 1: Update page tests first**

For each listed test file, add or update one failure assertion to use an
`ApiError` object with a request id:

```ts
const error = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  statusCode: 500,
  requestId: 'req_test123',
};
```

Expected UI should show the localized generic error and request id, not raw backend message.

- [ ] **Step 2: Run failing page tests**

Run:

```bash
pnpm --filter admin test -- src/components/data-table src/features/auth src/layouts src/features/users src/features/roles src/features/dictionaries src/features/files src/features/audit-logs
```

Expected: FAIL until pages use shared helpers.

- [ ] **Step 3: Update `DataTable`**

Change the prop type from `error?: Error | null` to `error?: unknown`, add a
`formatError?: (error: unknown, fallback: string) => string` prop, and render:

```tsx
<span>{formatError ? formatError(error, errorLabel) : errorLabel}</span>
```

Keep `DataTable` i18n-agnostic. Each page that renders a `DataTable` must pass
`formatError={(error, fallback) => getErrorMessage(error, fallback, t)}`.

- [ ] **Step 4: Replace local mutation helpers**

In each page, remove local functions like:

```ts
function mutationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined
}
```

Use:

```ts
toast.error(getErrorMessage(error, t('users.error.create'), t));
```

- [ ] **Step 5: Keep auth/session behavior intact**

`LoginView` should still show invalid credentials for auth failures. `AdminShell` should still reset or keep session according to existing change-password behavior. Do not alter routing or permission logic in this chunk.

- [ ] **Step 6: Run focused frontend tests**

Run:

```bash
pnpm --filter admin test -- src/app/api-error.test.ts src/app/api-error-messages.test.ts src/app/api-mutator.test.ts src/components/data-table src/features/auth src/layouts src/features/users src/features/roles src/features/dictionaries src/features/files src/features/audit-logs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/app apps/admin/src/components/data-table apps/admin/src/features/auth apps/admin/src/layouts apps/admin/src/features/users apps/admin/src/features/roles apps/admin/src/features/dictionaries apps/admin/src/features/files apps/admin/src/features/audit-logs apps/admin/src/i18n/messages.ts
git commit -m "feat(admin): use shared api error messages"
```

## Chunk 4: Upload Error Mapping, OpenAPI Regeneration, And Backend E2E Coverage

### Task 1: Map Upload Errors

**Files:**
- Modify: `apps/api/src/file/dto/file.request.ts`
- Modify: `apps/api/src/file/file.controller.ts`
- Modify: `apps/api/src/file/file.controller.spec.ts`
- Modify: `apps/api/src/file/file.service.ts`
- Modify: `apps/api/src/file/file.service.spec.ts`
- Modify: `apps/api/src/common/errors/exception-mapper.spec.ts`

- [ ] **Step 1: Add upload mapping tests**

Add mapper tests for:

- Multer `LIMIT_FILE_SIZE` returns an envelope with `code:
  PAYLOAD_TOO_LARGE`, `statusCode: 413`, and safe upload-limit details when
  available.
- unsupported MIME validation returns an envelope with `code:
  UNSUPPORTED_MEDIA_TYPE` and `statusCode: 415`.
- missing upload file returns an envelope with `code: FILE_UPLOAD_REQUIRED`
  and `statusCode: 400`.

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter api test -- common/errors/exception-mapper.spec.ts file/file.controller.spec.ts
```

Expected: FAIL until upload exceptions are mapped.

- [ ] **Step 3: Implement explicit file exceptions**

Where file upload currently throws `BadRequestException('File upload is required')`, migrate to:

```ts
throw new AppException({
  code: ERROR_CODES.FILE_UPLOAD_REQUIRED,
  message: 'File upload is required',
  statusCode: 400,
});
```

File upload required and MIME validation belong with file creation behavior in
this plan. Inspect `apps/api/src/file/file.service.ts`, migrate the missing-file
and MIME-mismatch branches there to `AppException`, and keep controller tests
focused on Multer interceptor/file parameter behavior while service tests cover
business validation.

- [ ] **Step 4: Run upload tests**

Run:

```bash
pnpm --filter api test -- common/errors/exception-mapper.spec.ts file/file.controller.spec.ts file/file.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/errors apps/api/src/file
git commit -m "feat(api): normalize upload errors"
```

### Task 2: Add API Flow Tests For Error Envelope And Request Id

**Files:**
- Create: `apps/api/src/common/errors/error-flow.spec.ts`
- Create: `apps/api/src/app.setup.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Write flow tests**

Create focused Nest testing app tests for:

- `GET /api/does-not-exist` returns a 404 envelope with `code`, `message`,
  `statusCode`, `requestId`, `path`, and `timestamp`, plus the `x-request-id`
  response header.
- invalid login payload returns `VALIDATION_ERROR` with
  `details.fields`.
- incoming valid `x-request-id` is echoed.
- invalid incoming `x-request-id` is replaced.
- CORS preflight or an API response exposes `x-request-id` through
  `access-control-expose-headers`.

- [ ] **Step 2: Run failing flow tests**

Run:

```bash
pnpm --filter api test -- common/errors/error-flow.spec.ts
```

Expected: FAIL until bootstrap/test app setup uses the same middleware/filter/pipes.

- [ ] **Step 3: Share app setup**

Create `apps/api/src/app.setup.ts` so `main.ts` and flow tests use the same
HTTP behavior:

```ts
export function configureApp(app: INestApplication, configService: ConfigService) {
  // helmet, cookieParser, global pipes, CORS, prefix, filters
}
```

Use it from `main.ts` and flow tests. Keep Swagger setup in `main.ts`.

- [ ] **Step 4: Run flow tests**

Run:

```bash
pnpm --filter api test -- common/errors/error-flow.spec.ts auth/auth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/errors/error-flow.spec.ts apps/api/src/app.setup.ts apps/api/src/main.ts
git commit -m "test(api): cover error envelopes and request ids"
```

### Task 3: Add Local Diagnostics Error Endpoint

**Files:**
- Create: `apps/api/src/diagnostics/diagnostics.controller.ts`
- Create: `apps/api/src/diagnostics/diagnostics.module.ts`
- Create: `apps/api/src/diagnostics/diagnostics.controller.spec.ts`
- Create: `apps/api/src/diagnostics/diagnostics-flow.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write diagnostics tests**

Add tests that prove:

- diagnostics routes are disabled when `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=false`;
- `GET /api/diagnostics/error` throws a normal `Error` when
  `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=true`;
- the route is decorated with `@IsPublic()` only so unauthenticated local smoke
  tests can reach the controlled 500;
- the route still goes through the app global prefix, request id middleware,
  exception filter, and runtime logging when the diagnostics module is enabled.

Add an app-level flow test in `diagnostics-flow.spec.ts` that starts the real
`AppModule` through `configureApp`, sets `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=true`
for the test process, calls `GET /api/diagnostics/error` without credentials,
and expects:

- HTTP `500`;
- `x-request-id` response header;
- unified envelope with `code: "INTERNAL_SERVER_ERROR"` and matching
  `requestId`;
- an error log record containing the same `requestId`.

- [ ] **Step 2: Run failing diagnostics tests**

Run:

```bash
pnpm --filter api test -- diagnostics/diagnostics.controller.spec.ts diagnostics/diagnostics-flow.spec.ts
```

Expected: FAIL because diagnostics files do not exist.

- [ ] **Step 3: Implement diagnostics module**

Create a diagnostics controller:

```ts
import { Controller, Get } from '@nestjs/common';
import { IsPublic } from '../common/decorators/is-public.decorator';

@Controller('diagnostics')
export class DiagnosticsController {
  @IsPublic()
  @Get('error')
  throwError(): never {
    throw new Error('Diagnostic error');
  }
}
```

Create a diagnostics module that registers the controller only when
`ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=true`. Prefer dynamic module registration so
the route does not exist by default. The env schema and default for
`ENABLE_DIAGNOSTIC_ERROR_ENDPOINT` were added in Chunk 2; do not duplicate that
schema work here.

- [ ] **Step 4: Wire module**

Import the diagnostics module from `AppModule`. Do not edit
`docker-compose.observability.yml` in this chunk; Chunk 5 creates the overlay
and enables `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=true` there. Keep
`docker-compose.yml`, `.env.example`, and `.env.deploy.example` defaults
disabled until Chunk 5 documents them.

- [ ] **Step 5: Run diagnostics tests**

Run:

```bash
pnpm --filter api test -- diagnostics/diagnostics.controller.spec.ts diagnostics/diagnostics-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/diagnostics apps/api/src/app.module.ts
git commit -m "feat(api): add local diagnostics error endpoint"
```

### Task 4: Regenerate API Contract And Admin Types

**Files:**
- Modify: `apps/api/openapi.json`
- Modify: `apps/admin/src/generated/api/**`

- [ ] **Step 1: Generate API artifacts**

Run:

```bash
ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=false pnpm api:generate
```

Expected: OpenAPI and generated admin API files update to include
`ErrorResponseDto` and any changed error metadata. `/diagnostics/error` must
not appear in `apps/api/openapi.json`, because diagnostics is disabled by
default and exists only for local smoke tests.

- [ ] **Step 2: Check generated diff**

Run:

```bash
git diff -- apps/api/openapi.json apps/admin/src/generated/api
```

Expected: generated changes only; no manual edits inside generated files.
Confirm that `apps/api/openapi.json` contains `ErrorResponseDto` and that
`apps/admin/src/generated/api/schemas` contains the generated error response
schema. Confirm that `apps/api/openapi.json` does not contain
`/diagnostics/error`.

- [ ] **Step 3: Run API contract check**

Run:

```bash
pnpm api:check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/openapi.json apps/admin/src/generated/api
git commit -m "chore: regenerate api contract for error responses"
```

## Chunk 5: Observability Compose Overlay And Documentation

### Task 1: Add Loki, Alloy, And Grafana Overlay

**Files:**
- Create: `docker-compose.observability.yml`
- Create: `deploy/observability/loki/config.yml`
- Create: `deploy/observability/alloy/config.alloy`
- Create: `deploy/observability/grafana/provisioning/datasources/loki.yml`
- Create: `deploy/observability/grafana/provisioning/dashboards/common-admin.yml`
- Create: `deploy/observability/grafana/dashboards/api-logs.json`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Write compose config**

Create `docker-compose.observability.yml` with services:

- `loki` using `grafana/loki`.
- `grafana` using `grafana/grafana`.
- `alloy` using `grafana/alloy`.

Expose Grafana on `${GRAFANA_HTTP_PORT:-3000}`. Keep Loki internal to the
Compose network; do not publish port `3100` by default. Mount the Docker socket
read-only into Alloy.

- [ ] **Step 2: Write Loki config**

Create a local filesystem Loki config with:

- HTTP listen port `3100`;
- local storage under `/loki`;
- single-tenant auth disabled;
- retention enabled with a 7-day local retention period.

- [ ] **Step 3: Write Alloy config**

Configure Alloy to:

- read Docker logs from the mounted Docker socket;
- derive `compose_project` from `__meta_docker_container_label_com_docker_compose_project`;
- derive `compose_service` from `__meta_docker_container_label_com_docker_compose_service`;
- filter targets to `compose_service == "api"`;
- set Loki label `service="api"` explicitly for API logs;
- set Loki label `container` from the Docker container name;
- set Loki label `compose_project` from the Compose project label;
- forward to `http://loki:3100/loki/api/v1/push`.

The dashboard and smoke tests must be able to query API logs with:

```logql
{service="api"} | json
```

- [ ] **Step 4: Provision Grafana**

Add Loki datasource provisioning with datasource name `Loki`. Add dashboard
provisioning with dashboard title `Common Admin API Logs`. Dashboard panels must
cover:

- request volume;
- 4xx count;
- 5xx count;
- slow requests;
- recent error logs;
- request id search;
- user id search;
- raw logs.

Use `{service="api"} | json` as the base LogQL selector. The request id and user
id panels must use variables named `requestId` and `userId`.

- [ ] **Step 5: Add API logging env defaults in compose**

In `docker-compose.yml`, add:

```yaml
LOG_LEVEL: ${LOG_LEVEL:-info}
LOG_PRETTY: ${LOG_PRETTY:-false}
SERVICE_NAME: api
APP_ENV: ${APP_ENV:-production}
ENABLE_DIAGNOSTIC_ERROR_ENDPOINT: ${ENABLE_DIAGNOSTIC_ERROR_ENDPOINT:-false}
```

In `docker-compose.observability.yml`, override only the API service with:

```yaml
ENABLE_DIAGNOSTIC_ERROR_ENDPOINT: "true"
```

- [ ] **Step 6: Validate compose config**

Run:

```bash
docker compose --env-file .env.deploy -f docker-compose.yml config
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.observability.yml config
```

Expected: both commands exit 0. The base-only config renders `postgres`,
`redis`, `api`, and `admin`; the merged overlay config renders `postgres`,
`redis`, `api`, `admin`, `loki`, `grafana`, and `alloy`. Also inspect the
rendered config and confirm:

- Base-only API env has `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=false`.
- Overlay API env has `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=true`.
- Grafana publishes `${GRAFANA_HTTP_PORT:-3000}`.
- Loki does not publish port `3100` by default.
- Alloy mounts the Docker socket read-only.
- Grafana mounts datasource and dashboard provisioning files.
- API has `LOG_LEVEL`, `LOG_PRETTY`, `SERVICE_NAME`, `APP_ENV`, and
  `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT`.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml docker-compose.observability.yml deploy/observability
git commit -m "feat(deploy): add local observability stack"
```

### Task 2: Add Operational Documentation

**Files:**
- Create: `docs/patterns/admin-error-logging-observability-guide.md`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `.env.deploy.example`

- [ ] **Step 1: Write the guide**

Include:

- difference between audit logs and runtime logs;
- error envelope shape;
- base error codes;
- request id behavior;
- logging fields and redaction rules;
- frontend `ApiError` usage;
- how to start the overlay;
- Grafana URL `http://localhost:${GRAFANA_HTTP_PORT:-3000}`;
- Grafana datasource name `Loki`;
- dashboard title `Common Admin API Logs`;
- expected Loki labels: `service`, `container`, and `compose_project`;
- copy-paste LogQL examples:

```logql
{service="api"} | json
{service="api"} | json | requestId="req_from_response"
{service="api"} | json | userId="user_id_from_response"
{service="api"} | json | level="error"
{service="api"} | json | statusCode >= 500
```

- note that `GET /api/diagnostics/error` exists only when
  `ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=true`, is enabled by the local
  observability overlay for smoke tests, and must stay disabled in normal
  deployments;
- troubleshooting when no logs appear, including Docker socket mount,
  Alloy target discovery, `service="api"` label mapping, Loki datasource health,
  and API stdout JSON.

- [ ] **Step 2: Link the guide**

Add a README section for:

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.observability.yml up
```

Mention that production can use any stdout/stderr log collector.

- [ ] **Step 3: Document env vars**

Add:

```text
LOG_LEVEL
LOG_PRETTY
SERVICE_NAME
APP_ENV
GRAFANA_HTTP_PORT
ENABLE_DIAGNOSTIC_ERROR_ENDPOINT
```

For `.env.deploy.example`, include deployment-oriented defaults:

```text
LOG_LEVEL=info
LOG_PRETTY=false
SERVICE_NAME=api
APP_ENV=production
GRAFANA_HTTP_PORT=3000
ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=false
```

Document that the observability compose overlay enables
`ENABLE_DIAGNOSTIC_ERROR_ENDPOINT=true` only for local smoke tests, and normal
deployments should keep it disabled.

- [ ] **Step 4: Run documentation checks**

Run:

```bash
git diff --check -- docs/patterns/admin-error-logging-observability-guide.md README.md .env.example .env.deploy.example docker-compose.observability.yml
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/patterns/admin-error-logging-observability-guide.md README.md .env.example .env.deploy.example docker-compose.observability.yml
git commit -m "docs: add error logging observability guide"
```

## Chunk 6: Final Verification

### Task 1: Run Full Static And Unit Verification

**Files:**
- No planned source edits unless verification exposes failures.

- [ ] **Step 1: Run API tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 2: Run admin tests**

Run:

```bash
pnpm --filter admin test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Run API contract check**

Run:

```bash
pnpm api:check
```

Expected: PASS.

- [ ] **Step 6: Commit fixes if needed**

If any verification command required code changes:

```bash
git add docs apps package.json pnpm-lock.yaml docker-compose.yml docker-compose.observability.yml .env.example .env.deploy.example
git commit -m "fix: stabilize error logging observability checks"
```

If no changes are needed, do not create an empty commit.

### Task 2: Manual Observability Smoke Test

**Files:**
- No planned source edits unless smoke test exposes config problems.

- [ ] **Step 1: Start the stack**

Run:

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.observability.yml up --build
```

Expected: API becomes healthy, admin starts, Grafana starts, Alloy sends logs to Loki.

- [ ] **Step 2: Trigger API traffic**

In another terminal:

```bash
curl -i http://localhost:${ADMIN_HTTP_PORT:-8080}/api/health
curl -i -H 'Content-Type: application/json' -d '{}' http://localhost:${ADMIN_HTTP_PORT:-8080}/api/auth/login
```

Expected: responses include `x-request-id`; invalid login payload returns the unified error envelope.

- [ ] **Step 3: Verify frontend receives normalized validation errors**

Open `http://localhost:${ADMIN_HTTP_PORT:-8080}/` in the browser, submit the
login form with missing or invalid fields, and confirm the UI shows the
localized validation/auth error instead of a raw Axios/NestJS message. If
browser devtools are available, confirm the failed API response body contains
`code: "VALIDATION_ERROR"` and a `requestId`.

- [ ] **Step 4: Trigger and verify a 500**

Trigger a controlled 500 through the diagnostics endpoint enabled only by the
observability compose overlay:

```bash
curl -i http://localhost:${ADMIN_HTTP_PORT:-8080}/api/diagnostics/error
```

Expected: the frontend or curl response contains an `INTERNAL_SERVER_ERROR`
envelope with `requestId`, and Grafana can find an exception log for that id:

```logql
{service="api"} | json | level="error" | requestId="req_from_500_response"
```

- [ ] **Step 5: Verify audited write correlation**

Log in with the seeded admin account, perform one audited write such as updating
a dictionary item, role, user, or file metadata, and record the response
`x-request-id`. Confirm the audit log detail stores the same id at
`metadata.requestId`.

- [ ] **Step 6: Search Grafana**

Open Grafana at `http://localhost:${GRAFANA_HTTP_PORT:-3000}` and run:

```logql
{service="api"} | json
```

Then search by one returned request id:

```logql
{service="api"} | json | requestId="req_from_response"
```

Expected: corresponding request logs are visible and include `service`, `env`,
`requestId`, `method`, `path`, `statusCode`, `durationMs`, and `msg`.

- [ ] **Step 7: Stop the stack**

Run:

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.observability.yml down
```

Expected: containers stop cleanly.

- [ ] **Step 8: Record verification result**

Add a short note to the final PR or handoff summary with:

- commands run;
- whether Grafana could query logs;
- one sample request id used for lookup;
- one sample 500 request id used for error-log lookup;
- which audited write was used to confirm `metadata.requestId`;
- any known limitations.
