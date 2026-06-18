---
title: API Contract
description: How backend contracts flow into generated frontend API helpers.
draft: false
---

Common Admin uses backend-first API contracts.

## Source Of Truth

- Prisma models define persistence.
- DTOs and validation define request and response shapes.
- Swagger metadata defines operation ids, response schemas, auth metadata, multipart bodies, and binary responses.
- `apps/api/openapi.json` is generated.
- `apps/admin/src/generated/api/` is generated from OpenAPI.

Do not hand edit generated artifacts:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

If generated output looks wrong, fix backend DTOs, Swagger metadata, the OpenAPI generation helper, or Orval config, then regenerate.

## Change Flow

1. Update backend source files.
2. Update DTO validation and Swagger metadata.
3. Add or preserve explicit operation ids.
4. Run API generation.
5. Update frontend usages through generated helpers.
6. Run API drift checks.

```bash
pnpm api:generate
pnpm api:check
```

Never patch generated files to satisfy TypeScript. Fix the source contract.

## Operation IDs

Every generated endpoint must have a stable explicit Swagger operation id:

```ts
@ApiOperation({ operationId: 'listUsers' })
```

Operation ids become generated frontend function, hook, and query key helper names. Treat renaming an operation id as a breaking API-client change unless the rename is the purpose of the task.

Recommended rules:

- Use clear action names such as `listArticles`, `getArticle`, `createArticle`, `updateArticle`, and `deleteArticle`.
- Keep names stable after public frontend usage exists.
- Add or update OpenAPI assertion coverage when a new generated endpoint should be protected by operation-id checks.

## Prefix-Free Paths

Runtime API routes use the `/api` prefix, but generated OpenAPI paths must stay prefix-free.

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

The frontend combines `VITE_API_BASE_URL`, which defaults to `/api`, with the generated path. If OpenAPI includes `/api`, browser requests become `/api/api/...`.

## Backend Checklist

For each generated endpoint, verify:

- Request DTOs exist for body or query input.
- Response DTOs exist for JSON responses.
- Runtime validation uses `class-validator` decorators.
- DTO fields have Swagger metadata such as `@ApiProperty` or `@ApiPropertyOptional`.
- Controller methods define `@ApiOperation({ operationId })`.
- Controller methods define response decorators such as `@ApiOkResponse`, `@ApiCreatedResponse`, or `@ApiNoContentResponse`.
- Authenticated endpoints declare bearer-auth metadata.
- Admin endpoints declare matching `@Permissions('<module>.<action>')`.
- Multipart upload and binary download endpoints have explicit Swagger metadata.

## Frontend Rules

Frontend API usage should go through generated output:

- endpoint functions and hooks from `apps/admin/src/generated/api/endpoints/`;
- schema types from `apps/admin/src/generated/api/schemas`;
- generated query key helpers for invalidation.

Feature-local types should be limited to UI-only state, form values, selected rows, or aliases around generated schema types. Do not duplicate backend DTO shapes in feature files.

Feature-local API facades are only appropriate when they do real page-level composition, such as combining operations, mapping generated DTOs into UI-only models, coordinating multi-step mutations, or wrapping browser file-save behavior around a generated download operation. Do not add one-method forwarding wrappers.

## Troubleshooting

`pnpm api:generate` regenerates the backend OpenAPI document and the admin generated client.

`pnpm api:check` runs generation and fails when committed generated output is stale:

```bash
git diff -- apps/api/openapi.json apps/admin/src/generated/api
```

Common fixes:

- Generated import name changed: check and stabilize the backend operation id.
- Request path is `/api/api/...`: keep generated OpenAPI paths prefix-free.
- Frontend type is too weak: add missing DTO fields, validation decorators, or Swagger metadata.
- Upload is not `FormData`: check multipart Swagger metadata and Orval upload config.
- Download is not a `Blob`: check binary response metadata and the Orval download override.
- OpenAPI generation reaches external services: adjust generation-safe providers before continuing.

If a generated diff is expected, commit regenerated artifacts with the source contract change. If it is unexpected, change the backend contract or Orval config and regenerate.
