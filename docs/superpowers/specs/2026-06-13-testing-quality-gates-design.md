# Testing And Quality Gates Design

## Goal

Turn the existing TDD-heavy test base into explicit, repeatable quality gates
for Common Admin.

The first version should define a standard verification path for local
development and CI. It should also document the minimum test expectations for
new API-backed admin modules so the template stays reliable as teams add
business resources.

The target state is:

- Developers have one root command that runs the same broad checks expected in
  CI.
- CI blocks contract drift, lint failures, unit/component test failures, API
  e2e failures, and build failures.
- New CRUD modules have clear backend and frontend test expectations.
- Existing API e2e coverage grows beyond health checks to cover auth,
  permission, and normalized error behavior.
- Browser-level Playwright smoke tests remain a separate second-stage
  enhancement instead of becoming a prerequisite for the first quality gate.

## Context

Common Admin already has a strong testing foundation:

- The root package has `pnpm test`, `pnpm lint`, `pnpm build`, and
  `pnpm api:check`.
- The API app uses Jest for service, controller, flow, and helper tests.
- The API app already exposes `pnpm --filter api test:e2e` with a lightweight
  `apps/api/test/app.e2e-spec.ts` health check.
- The admin app uses Vitest, jsdom, React Testing Library, and user-event for
  route, shell, page, store, provider, and generated API integration tests.
- API contract generation is already part of the project through
  `apps/api/openapi.json`, Orval-generated admin API files, and
  `pnpm api:check`.
- The development guide already recommends this broad verification order:
  `pnpm api:check`, `pnpm lint`, `pnpm test`, `pnpm build`.

The missing layer is not more ad hoc tests. The missing layer is a repository
contract: what must pass before changes are considered mergeable, and what
tests a new module must add.

There is currently no GitHub Actions workflow in the repository and no
Playwright configuration for the admin app.

## Chosen Approach

Use a standard template-level gate made of existing project commands plus API
e2e:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

Expose this sequence as a root `pnpm quality` command and run the same sequence
in CI.

Keep the first version focused on deterministic checks that already fit the
repository:

- contract generation drift;
- static linting;
- API Jest tests;
- admin Vitest tests;
- API e2e tests;
- production builds.

Do not introduce coverage thresholds in the first version. The project already
uses TDD heavily, and a raw coverage percentage would be a weaker signal than
module-level behavior requirements. Coverage reporting can be kept available
through package-specific commands, but it should not block CI until the team has
a stable baseline and an agreed target.

Do not introduce Playwright in the first version. Browser smoke tests are useful
for this template, especially login and permission-aware navigation, but they
add another runtime layer and should be designed as a focused second-stage gate.

Principles:

- Prefer behavior requirements over arbitrary coverage numbers.
- Keep the default quality gate easy to run locally.
- Run contract drift checks before broad test/build work.
- Test project-owned boundaries instead of generated code internals.
- Expand e2e only where unit/component tests cannot prove the integrated
  behavior.
- Keep CI deterministic and free of external service dependencies in the first
  version.

## Non-Goals

The first version should not include:

- Playwright browser tests.
- Visual regression testing.
- Snapshot testing as a gate.
- Mutation testing.
- Performance benchmarking.
- End-to-end tests against a production-like Docker Compose stack.
- Mandatory coverage thresholds.
- A full test data factory framework.
- A new monorepo task runner.
- A required real PostgreSQL or Redis service for CI.

These can be added later if the template needs stronger release validation.

## Root Quality Command

Add a root script:

```json
{
  "scripts": {
    "quality": "pnpm api:check && pnpm lint && pnpm test && pnpm --filter api test:e2e && pnpm build"
  }
}
```

The command order is intentional:

1. `pnpm api:check` fails early when backend DTO or Swagger metadata changes
   leave generated API files stale.
2. `pnpm lint` catches static correctness and style issues before slower
   verification.
3. `pnpm test` runs all package-level unit, flow, and component tests.
4. `pnpm --filter api test:e2e` runs API process-level checks that sit outside
   the normal API Jest root.
5. `pnpm build` proves both apps compile for production.

The root `quality` command should become the default final local verification
for feature branches. Developers can still use package-scoped commands while
iterating.

## CI Workflow

Add a GitHub Actions workflow:

```text
.github/workflows/quality.yml
```

The workflow should run on pull requests and pushes to the main integration
branch. If the repository's long-lived branch is not named `main`, the
implementation plan should use the actual branch name from the repository.

Recommended job:

```text
quality
  checkout
  setup node
  setup pnpm
  restore pnpm store cache
  pnpm install --frozen-lockfile
  pnpm api:check
  pnpm lint
  pnpm test
  pnpm --filter api test:e2e
  pnpm build
```

Use the package manager version declared in the root `package.json`:

```text
pnpm@10.28.2
```

Use one current LTS Node version for the first workflow. If the local project
already documents a specific Node version by the time this is implemented, CI
should use that version. Otherwise the implementation plan must choose a single
explicit LTS version and document it in the workflow. Do not leave CI on a
floating or implicit Node version.

The first workflow should not start PostgreSQL or Redis service containers.
The existing API tests and e2e health check mock or avoid external service
dependencies. If later e2e coverage needs a real database or Redis instance,
add service containers in the same workflow or split those tests into a
dedicated integration job.

## API E2E Coverage

Current API e2e coverage proves only `GET /api/health`.

The first quality-gate iteration should expand API e2e coverage to representative
template-level behavior, not every CRUD path.

Add separate e2e tests for these behaviors unless a single HTTP flow naturally
proves multiple behaviors without hiding setup details:

- health endpoint returns the expected status;
- login succeeds with a valid seeded or test-provided user setup;
- unauthenticated requests to a protected endpoint are rejected;
- authenticated requests without the required permission receive 403;
- authenticated requests with the required permission can read one
  representative protected resource;
- refresh and logout behavior work at the HTTP/cookie boundary if the existing
  auth/session implementation can be exercised without a real external Redis
  dependency;
- validation or domain errors return the normalized error envelope, including
  request id behavior where available.

The e2e suite should prefer small, explicit module overrides when the full
runtime dependency graph would require external services. It should not become
a substitute for service/controller tests.

When protected endpoints, sessions, refresh tokens, or permission checks are
tested, the e2e setup must explicitly override or provide any Redis,
permission-cache, or session dependencies that the runtime path touches. Tests
must not pass only because a developer happens to have local Redis or other
services running.

If a scenario requires real database persistence to be meaningful, the first
implementation should either:

- keep it as a documented future integration-test item; or
- introduce a small test-only persistence strategy in the implementation plan
  and make the CI service dependency explicit.

Avoid silently relying on a developer's local database in e2e tests.

## Minimum Test Requirements For New CRUD Modules

Add a reusable checklist to the development guide and CRUD pattern guide.

### Backend

Every new API-backed CRUD module should include focused backend tests for:

- service-level create, read, update, delete, list, search, sort, and pagination
  behavior as applicable;
- uniqueness and domain invariant errors;
- validation and DTO mapping for request and response shapes;
- controller behavior for success responses and expected error responses;
- permission guard behavior or permission metadata for every protected action;
- audit-log behavior when the module mutates important data;
- OpenAPI operation ids and response metadata when the API contract is consumed
  by the admin app.

Controller tests may mock services. Service tests may mock Prisma. Flow tests
should cover only behavior that needs multiple project-owned units working
together.

### Frontend

Every new admin CRUD page should include focused Vitest/Testing Library tests
for:

- initial loading and empty states;
- table rendering with representative data;
- filtering, search, sort, and pagination behavior where the page supports it;
- create, edit, delete, enable, disable, or other primary actions;
- permission-aware visibility for route entries and row/page actions;
- API error display through the project's normalized error/toast conventions;
- cache invalidation or query refresh behavior after mutations;
- route metadata and menu registration.

Page tests should mock generated hooks or the shared request boundary. They
should not assert Orval implementation details.

### Shared Exceptions

Some modules do not need full CRUD coverage:

- read-only diagnostic pages should test read, loading, error, permission, and
  route behavior;
- frontend-only pages should test route/menu metadata and user-visible behavior,
  but do not need API contract tests;
- thin wrapper modules around existing shared behavior can rely on shared tests
  plus a focused smoke test for their registration.

The module owner should state the reason when using a reduced checklist.

## Contract Gate

`pnpm api:check` remains the main API contract gate.

It should fail when either of these committed generated artifacts is stale:

```text
apps/api/openapi.json
apps/admin/src/generated/api/
```

The quality-gate docs should repeat the existing rule:

- do not manually edit generated API files;
- update backend DTOs, Swagger metadata, or Orval config;
- run `pnpm api:generate`;
- commit the generated output.

For new endpoints, tests should verify project-owned metadata that affects
generation, especially explicit operation ids, multipart requests, binary
responses, and unusual response shapes.

## Documentation Updates

Update `docs/development/common-admin-development-guide.md` so "Verification"
points to the root quality command:

```bash
pnpm quality
```

Keep the individual command sequence documented for debugging failures:

```bash
pnpm api:check
pnpm lint
pnpm test
pnpm --filter api test:e2e
pnpm build
```

Update `docs/patterns/admin-crud-table-pattern-guide.md` with the minimum
module test checklist.

Update `docs/common-admin-next-steps.md` after implementation to mark the first
quality gate as complete and leave Playwright as a separate follow-up item.

## Future Playwright Smoke Tests

Playwright should be a second-stage enhancement after the standard quality gate
is stable.

Recommended initial browser smoke coverage:

- admin app loads;
- login succeeds through the real browser UI;
- authenticated user reaches the default admin page;
- permission-aware menu hides an unauthorized module;
- role management page can load and display existing roles;
- a representative CRUD list page can load and show data.

Playwright should run as a separate script, for example:

```bash
pnpm --filter admin test:e2e
```

Whether Playwright blocks every pull request should be decided after its runtime
cost and flake rate are known. It can start as a manual or scheduled check.

## Risks

CI may expose existing timing or environment assumptions.

Mitigation: keep the first workflow close to local commands, avoid external
services, and fix assumptions as ordinary defects.

API e2e may overlap with existing API flow tests.

Mitigation: keep e2e focused on HTTP boundary behavior and use unit/flow tests
for detailed business cases.

The root `quality` command may feel slow during iteration.

Mitigation: document package-scoped commands for inner-loop work and position
`pnpm quality` as the final local gate.

Without coverage thresholds, teams may under-test new modules.

Mitigation: use the explicit module checklist in code review and CI. Revisit
coverage thresholds after several modules establish a stable baseline.

Playwright may be deferred too long.

Mitigation: keep a small, explicit future section and add it once the standard
quality gate is passing reliably.

## Success Criteria

The first quality-gate implementation is complete when:

- root `pnpm quality` exists and runs the selected checks in order;
- GitHub Actions runs the same checks on pull requests and integration-branch
  pushes;
- API e2e covers the agreed first-version boundary behaviors: health, login,
  unauthenticated protected access, authenticated forbidden access, authorized
  protected read, normalized error envelope, and refresh/logout when those
  session flows can be exercised without hidden external dependencies;
- the development guide documents `pnpm quality` and the underlying commands;
- the CRUD pattern guide documents minimum backend and frontend test
  expectations;
- `pnpm quality` passes locally.
