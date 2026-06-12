# Common Admin API

This is the NestJS API application for Common Admin.

For project-specific development guidance, use:

- `../../docs/development/common-admin-development-guide.md`
- `../../docs/patterns/admin-api-contract-generation-guide.md`
- `../../docs/patterns/admin-crud-table-pattern-guide.md`
- `../../docs/patterns/admin-rbac-crud-permission-pattern-guide.md`

Common commands:

```bash
pnpm --filter api dev
pnpm --filter api test
pnpm --filter api lint
pnpm --filter api build
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm --filter api openapi:generate
```

Backend DTOs and controller Swagger metadata are the source for the generated
frontend API contract. Every generated endpoint needs a stable
`@ApiOperation({ operationId })`, complete DTO/response metadata, and
prefix-free OpenAPI paths.
