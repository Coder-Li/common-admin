# Project Bootstrap Checklist

Use this checklist when deriving a new project from the Common Admin template.
It is written for AI agents, but it should stay readable for human maintainers.

## 1. Confirm Template Decisions

- Confirm the project name and product name.
- Confirm whether the default users, roles, dictionaries, files, audit logs, and
  settings modules should stay enabled.
- Confirm the default language and theme expectations.
- Confirm whether Docker Compose, observability, and CI should be kept from the
  template.
- Confirm whether generated API contracts remain the frontend API boundary.

Do not remove core architecture pieces unless the human maintainer explicitly
asks for that change.

## 2. Configure Environment

- Copy `apps/api/.env.example` to `apps/api/.env`.
- Set database and Redis connection values.
- Set auth secrets and token/session lifetimes for the target environment.
- Review upload limits and allowed MIME types.
- Review CORS/origin settings for the target admin URL.

## 3. Initialize Local Data

Run the standard setup flow:

```bash
pnpm install
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm dev
```

Default local URLs:

```text
API:      http://localhost:13001/api
Admin:    http://localhost:15173
Swagger:  http://localhost:13001/api/docs
```

Default login:

```text
admin@example.com
Admin123!
```

For a real downstream project, rotate default credentials or replace seed data
before deployment.

## 4. Brand And Product Fit

- Update visible project/product names.
- Update default site settings if they are stored through the settings module.
- Update i18n messages for product-specific labels.
- Update any deployment names, container names, or README references that should
  no longer say Common Admin.

Keep generated API files unchanged unless the backend contract changes.

## 5. Validate The Template Boundary

Run:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

Or run the combined gate:

```bash
pnpm quality
```

If the project intentionally removes modules, update tests, seeds, docs, and
route metadata in the same change set.

## 6. Documentation Site Roadmap

The first phase keeps documentation as Markdown in the repository. This avoids
extra tooling while the template is still changing.

When the docs become stable enough for broader readers, add a static
documentation site. Prefer VitePress unless the project needs heavier React/MDX
customization or documentation versioning from day one.

Suggested later steps:

- Add VitePress config around the existing `docs/` content.
- Add `docs:dev` and `docs:build` scripts.
- Add navigation for architecture, AI protocols, pattern guides, deployment,
  and quality gates.
- Add CI docs build verification.
- Publish to GitHub Pages, Vercel, Netlify, or an internal static host.
