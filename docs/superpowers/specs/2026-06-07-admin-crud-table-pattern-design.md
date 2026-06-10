# Admin CRUD Table Pattern Design

## Goal

Define a repeatable frontend and backend pattern for admin list/table pages and basic CRUD workflows. The first target resource is users, but the pattern should be generic enough for future resources without forcing complex business screens into a rigid generator.

The output should double as an AI-readable development guide: an agent should be able to read this document and implement a new standard resource with predictable files, DTOs, API contracts, hooks, and UI behavior.

## Context

The backend is a NestJS and Prisma API derived from the style of `manas-aggrawal/nestjs-boilerplate`. That boilerplate is useful for request/response DTO separation, Zod DTO generation, Swagger response metadata, auth guards, and role decorators. It does not provide a mature server-side table protocol: its admin user list returns a plain array from `findAll()`.

The current project already has:

- API: NestJS, Prisma, Swagger, JWT auth, roles, class-validator DTOs, and a `user` module with `/users/me`.
- Admin: React, Vite, Tailwind CSS, React Query, Axios, zod, react-hook-form, Zustand, and placeholder `/users` navigation.

The table pattern should fit this stack instead of introducing a full admin framework.

The frontend must add `@tanstack/react-table` as a new dependency before implementing shared table components. The project already has other TanStack packages, but it does not currently include the table package.

## Scope

- Backend list/query/response DTO pattern for server-side admin tables.
- Backend user CRUD endpoints as the first reference implementation.
- Frontend table/query/form pattern for standard CRUD resources.
- A small reusable frontend data-table foundation based on TanStack Table and React Query.
- Documentation that explains how AI agents should add future resources.

Out of scope:

- Fully automatic CRUD page generation from a single config object.
- Advanced workflow screens, multi-step approvals, kanban views, bulk imports, or custom analytics.
- Replacing the existing auth/session architecture.
- Introducing a full UI suite such as Ant Design or MUI.

## Chosen Approach

Use TanStack Table for table state, React Query for server data, and a small project-local CRUD/table abstraction.

TanStack Table is a headless table library, so it fits the current Tailwind/shadcn-style frontend without imposing visual design. It supports manual server-side pagination, sorting, and filtering, which matches admin data that should not be loaded entirely into the browser.

Ant Design Table and MUI X Data Grid are mature alternatives, but they bring stronger visual and architectural opinions. They are better choices when the project wants a complete enterprise component suite. This project is still a custom admin starter, so a lighter foundation is a better fit.

## API Contract

Standard list endpoints use server-side pagination. All list pages should send simple query params and receive a consistent response shape.

Request query:

```ts
interface ListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
}
```

Resource-specific list DTOs extend the common query:

```ts
interface UserListQuery extends ListQuery {
  role?: 'ADMIN' | 'STANDARD'
}
```

Response:

```ts
interface ListResponse<TItem> {
  items: TItem[]
  total: number
  page: number
  pageSize: number
}
```

Rules:

- `page` is 1-based at the API boundary.
- Omitted `page` defaults to `1`.
- Omitted `pageSize` defaults to `20`.
- `page` must be a positive integer.
- `pageSize` must be an integer from `1` to `100`.
- Invalid, malformed, or out-of-range query params return `400`; do not silently clamp invalid values.
- `sort` uses `field:direction`, for example `createdAt:desc`.
- Omitted `sort` defaults to the resource default, for example `createdAt:desc` for users.
- Invalid sort fields or directions return `400`.
- Controllers must only allow sorting and filtering by whitelisted fields.
- Free-text `search` is optional and resource-specific. For users it should search username, email, first name, and last name.
- Responses should never include sensitive fields such as password hashes.

## Backend Pattern

Each standard CRUD resource should follow this shape:

```text
resource/
  dto/
    resource.request.ts
    resource.response.ts
  resource.mapper.ts
  resource.service.ts
  resource.controller.ts
  resource.module.ts
```

Common DTOs should live under `apps/api/src/common/dto/`:

- `list-query.dto.ts`
- `list-response.dto.ts`

The initial project currently uses class-validator DTOs. The boilerplate reference shows a strong Zod DTO pattern via `nestjs-zod`, but switching the whole API validation system is larger than this table feature. The recommended path is:

1. Keep the current class-validator approach for the first implementation.
2. Keep request and response DTO files clearly separated.
3. Use Swagger decorators consistently.
4. Revisit `nestjs-zod` later if the project wants schema-first DTOs shared more directly between validation, OpenAPI, and response parsing.

## User API

The first reference resource is users.

Endpoints:

```text
GET    /users
GET    /users/:id
POST   /users
PATCH  /users/:id
DELETE /users/:id
GET    /users/me
```

`GET /users/me` remains the authenticated profile endpoint.

Route order matters in NestJS. The literal `/users/me` route must be declared before `/:id` routes so `me` is not treated as an ID.

Admin-only CRUD endpoints:

- `GET /users`: paginated user list.
- `GET /users/:id`: user detail.
- `POST /users`: create user.
- `PATCH /users/:id`: update editable profile/role fields.
- `DELETE /users/:id`: delete user.

Apply the existing `@Roles(Role.ADMIN)` decorator to each admin-only method individually. Do not apply admin role metadata at the `UserController` class level, because that would also restrict `GET /users/me`. `GET /users/me` requires authentication but must remain available to any authenticated role.

User list query allowlists:

- Sort fields: `createdAt`, `updatedAt`, `email`, `username`, `firstName`, `lastName`, `role`.
- Sort directions: `asc`, `desc`.
- Default sort: `createdAt:desc`.
- Filters: `role`.
- Search fields: `email`, `username`, `firstName`, `lastName`.

User search should use Prisma `contains` queries with case-insensitive mode where supported by the database provider.

The list item response should include:

```ts
interface UserListItem {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  role: Role
  createdAt: string
  updatedAt: string
}
```

User detail response uses the same public fields as `UserListItem`. The API may name the DTO `UserResponseDto`, `UserDetailDto`, or `UserProfileDto`, but it must not include `passwordHash`.

Create request:

```ts
interface CreateUserRequest {
  email: string
  username: string
  firstName: string
  lastName: string
  password: string
  role: Role
}
```

The service owns password hashing and stores only `passwordHash`. Duplicate `email` or `username` should return `409`.

Update request:

```ts
interface UpdateUserRequest {
  email?: string
  username?: string
  firstName?: string
  lastName?: string
  role?: Role
}
```

Password changes are not part of the admin update request in the first version. If password reset is needed later, add a dedicated endpoint instead of overloading `PATCH /users/:id`.

Delete behavior:

- First version uses hard delete through Prisma `delete`.
- Successful delete returns `204 No Content`.
- Deleting a missing user returns `404`.
- Deleting the current authenticated admin account may be allowed in the first version unless the implementation plan explicitly adds a guard. If a guard is added, document the rule and test it.

The service should implement the list query with Prisma `findMany` and `count` using the same `where` object. Sorting should be mapped from allowed API fields to Prisma `orderBy`.

## Frontend Pattern

Each standard CRUD resource should follow this shape:

```text
apps/admin/src/features/resource/
  resource.api.ts
  resource.types.ts
  resource.columns.tsx
  ResourceForm.tsx
  ResourcePage.tsx
```

Shared table components should live under:

```text
apps/admin/src/components/data-table/
  DataTable.tsx
  DataTablePagination.tsx
  DataTableToolbar.tsx
```

Shared query helpers should live under:

```text
apps/admin/src/lib/crud/
  list-query.ts
  useServerTableQuery.ts
```

Responsibilities:

- `resource.api.ts`: API functions for list/detail/create/update/delete.
- `resource.types.ts`: frontend request and response types.
- `resource.columns.tsx`: TanStack column definitions and row actions.
- `ResourceForm.tsx`: create/edit form using react-hook-form and zod.
- `ResourcePage.tsx`: wires table state, query, toolbar, modal/drawer form, and mutations.
- `DataTable.tsx`: shared rendering and manual pagination/sorting integration.
- `useServerTableQuery.ts`: converts table state into API query params and React Query keys.

The first implementation may keep table state local to the page. URL-synced list state is useful for shareable admin workflows, but it should be added after the basic users CRUD path is stable.

The current app uses TanStack Router through `AdminRouterProvider`, route guards, and `AdminShell`. Standard CRUD pages should add route/menu metadata to the shared registry rather than introducing a separate routing system. Replace or extend the existing `/users` page wiring with `UsersPage`.

The existing `createApiClient` should be extended for CRUD instead of bypassed. Add authenticated request support for `get`, `post`, `patch`, and `delete`, and use Axios `params` for list query serialization. Existing `login` and `me` behavior must remain compatible.

## Frontend Behavior

Standard CRUD pages should provide:

- Server-side pagination.
- Server-side sorting for whitelisted sortable columns.
- A search input with debounced request updates.
- Resource-specific filters, starting with user role.
- Loading, empty, and error states.
- Create, edit, and delete actions.
- Mutation success refreshes the active list query.
- Delete uses a confirmation step.

The table UI should stay dense and work-focused. Avoid marketing-style panels. Use compact controls, stable column widths, and icon buttons with tooltips for repeated row actions.

## Error Handling

Backend:

- Invalid query params return `400`.
- Unauthorized requests return `401`.
- Missing admin permission returns `403`.
- Missing resource returns `404`.
- Unique conflicts such as duplicate email or username should return `409`.

Frontend:

- API client keeps existing unauthorized handling.
- Form validation should catch obvious field errors before submit.
- Server errors should show concise toast messages.
- Table errors should show an inline retry state.

## Testing

Backend tests:

- DTO validation for list query defaults, bounds, malformed values, invalid filters, and invalid sort fields/directions.
- User service list query maps search, role filter, pagination, and sorting to Prisma.
- Controller/admin guard behavior for CRUD endpoints.
- Standard users receive `403` for admin CRUD endpoints but still receive `200` for `/users/me`.
- Create hashes passwords and never returns `passwordHash`.
- Duplicate email or username returns `409`.
- List and detail responses exclude sensitive fields.
- Delete returns `204` for existing users and `404` for missing users.
- Auth flow tests for `/users/me` remain passing.

Frontend tests:

- API client serializes list params through Axios `params`, sends bearer auth for all CRUD verbs, and preserves existing `login` and `me` behavior.
- Query hook builds stable query keys from pagination, search, sort, and filters.
- Users page renders loading, empty, data, and error states.
- Mutations invalidate the users list query.
- Form validation covers required fields and duplicate server errors where practical.

## AI Development Guide

When adding a new standard CRUD resource, an AI agent should:

1. Add backend request/response DTOs.
2. Add a mapper that removes sensitive/internal fields.
3. Add service methods for list/detail/create/update/delete.
4. Use the common `ListQuery` and `ListResponse` shapes.
5. Whitelist sortable and filterable fields.
6. Add controller routes with Swagger metadata and method-level role decorators.
7. Add frontend types and API functions matching the backend DTOs.
8. Add TanStack columns, a resource form, and a resource page.
9. Register navigation and route handling using the app's current routing style.
10. Add focused tests for list query behavior, API serialization, and page states.

Do not create a new generic framework for every exception. If a screen has complex workflow-specific behavior, use the shared list/query/table pieces where helpful and implement the rest directly in the feature.

## Risks

- Over-abstracting too early can make simple pages harder to build. Keep the first abstraction small and let the users page prove the pattern.
- Generic list DTOs can become unsafe if sort/filter fields are passed directly into Prisma. Always map from explicit allowlists.
- Server-side search can become slow on large tables. Start with indexed fields and simple `contains` queries; revisit full-text search only when needed.
- Frontend query state can drift from URL state. The first version may keep table state local, but URL-synced state should be considered once list pages become shareable workflows.

## Non-Goals

- No automatic code generator in the first version.
- No dynamic schema-rendered forms in the first version.
- No bulk actions until the single-row CRUD path is stable.
- No cursor pagination unless a resource has scale or consistency requirements that offset the extra complexity.
