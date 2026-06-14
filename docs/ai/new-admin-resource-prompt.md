# New Admin Resource Prompt

Use this prompt when asking an AI agent to add a standard API-backed admin
resource to Common Admin.

```text
You are working in the Common Admin repository.

Add a new admin resource module for <resource-name>.

Before implementation, read:

- docs/architecture/common-admin-architecture-overview.md
- docs/ai/README.md
- docs/ai/new-admin-resource-checklist.md
- docs/patterns/admin-api-contract-generation-guide.md
- docs/patterns/admin-crud-table-pattern-guide.md
- docs/patterns/admin-rbac-crud-permission-pattern-guide.md

Follow the existing users, roles, dictionaries, files, audit logs, and settings
modules as references where relevant.

Requirements:

- Backend DTOs and Swagger metadata are the API contract source.
- Add explicit Swagger operation ids for generated endpoints.
- Use @Permissions() with permission codes for admin-only capabilities.
- Keep backend permission guards, frontend route/menu metadata, and page action
  gates aligned.
- Run API generation after changing backend contracts.
- Use generated frontend endpoint functions, hooks, query keys, and schema
  types.
- Do not hand edit apps/api/openapi.json.
- Do not hand edit apps/admin/src/generated/api/.
- Do not create a handwritten frontend API client.
- Add focused backend and frontend tests for the behavior introduced.

Before finishing, run the relevant verification commands:

- pnpm api:check
- pnpm lint
- pnpm test
- pnpm build

If the task touches e2e-covered auth, permissions, or request flow, also run:

- pnpm --filter api test:e2e
```

Replace `<resource-name>` with the domain name and add any human-provided
business rules, fields, filters, sort behavior, or permission names after the
prompt.
