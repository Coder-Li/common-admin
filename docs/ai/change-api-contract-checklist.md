# Change API Contract Checklist

Use this checklist when changing an existing API endpoint, DTO, generated
frontend function, or frontend schema type.

## 1. Identify The Contract Source

- Find the backend controller method.
- Find request and response DTOs.
- Find mapper behavior if response shape changes.
- Find service behavior if validation, filtering, sorting, or business rules
  change.
- Find frontend imports from `apps/admin/src/generated/api/`.

## 2. Update Backend Source

- Update DTO fields and validation decorators.
- Update Swagger field metadata.
- Update controller response decorators.
- Keep `@ApiOperation({ operationId })` stable unless the rename is intentional.
- Update mapper and service behavior to match the new public contract.
- Update OpenAPI tests when operation ids, multipart bodies, binary responses,
  or prefix-sensitive paths change.

Treat operation id changes as breaking changes for frontend imports.

## 3. Regenerate

Run:

```bash
pnpm api:generate
```

Do not hand edit:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

If generation output is surprising, fix the backend metadata or Orval config and
regenerate.

## 4. Update Frontend Usage

- Update imports from generated endpoint files and schemas.
- Update form values, table columns, filters, and mutation payloads.
- Update query invalidation if generated query key helpers changed.
- Remove obsolete local aliases or UI-only types.
- Keep feature-local API wrappers out unless there is a real project-level
  adapter need.

## 5. Update Tests

- Update backend unit/controller tests for changed validation or response shape.
- Update frontend tests for changed page behavior.
- Update e2e tests if auth, permission, or request flow changes.

## 6. Verify

Run:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm build
```

Run this when the contract change touches e2e-covered request flow:

```bash
pnpm --filter api test:e2e
```
