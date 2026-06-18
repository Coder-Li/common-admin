# Common Admin Agent Manual

This repository is a production admin starter. Agents must preserve the NestJS API, React admin app, Prisma persistence, RBAC permission model, OpenAPI generation, generated frontend client, and quality gates.

## Reading Order

1. `apps/docs/src/content/docs/ai/index.md`
2. `apps/docs/src/content/docs/architecture.md`
3. Relevant pattern docs:
   - `apps/docs/src/content/docs/patterns/api-contract.md`
   - `apps/docs/src/content/docs/patterns/crud-resource.md`
   - `apps/docs/src/content/docs/patterns/rbac.md`
4. Relevant prompt in `apps/docs/src/content/docs/ai/prompts.md`
5. Current source and tests for the affected module.

## Generated Artifacts

Do not hand edit:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

Fix backend DTOs, Swagger metadata, OpenAPI generation, or Orval config, then regenerate.

## API Contract Rules

- Backend DTOs and Swagger metadata are the contract source.
- Every generated endpoint needs a stable explicit operation id.
- Frontend API usage must go through generated functions, hooks, schema types, and query key helpers.
- Do not create handwritten one-off API clients for generated endpoints.

## RBAC Rules

- Use stable lowercase `module.action` permission codes.
- Keep backend `@Permissions()`, permission registry/seed behavior, frontend route/menu metadata, and page actions aligned.
- Do not add role-name checks for admin capabilities.
- Stop and ask when permission naming or default role behavior is unclear.

## Verification

Use the narrowest useful command while iterating. Before claiming readiness, run the relevant gate:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

For branch readiness:

```bash
pnpm quality
```

For docs-only changes:

```bash
pnpm --filter docs build
```

## Internal Denylist

Do not expose, quote, summarize, or use these as public docs, `llms` content, MCP content, or skill content:

```text
docs/superpowers/**
docs/next-step.md
.env*
.git/**
node_modules/**
apps/docs/dist/**
apps/docs/.astro/**
```

