# Common Admin Frontend

This is the React/Vite admin application for Common Admin.

For project-specific development guidance, use:

- `../../docs/development/common-admin-development-guide.md`
- `../../docs/patterns/admin-api-contract-generation-guide.md`
- `../../docs/patterns/admin-crud-table-pattern-guide.md`
- `../../docs/patterns/admin-rbac-crud-permission-pattern-guide.md`

Common commands:

```bash
pnpm --filter admin dev
pnpm --filter admin test
pnpm --filter admin lint
pnpm --filter admin build
```

API-backed pages should use generated endpoint functions, hooks, schema types,
and query key helpers from `src/generated/api/`. Do not hand edit generated
files or recreate the removed handwritten API client.
