# Admin RBAC CRUD Permission Pattern Guide

This guide is for developers and AI agents adding a new admin CRUD module to
the current RBAC permission system.

Use it together with `docs/patterns/admin-crud-table-pattern-guide.md`. That
guide explains the CRUD table shape. This guide explains how the same module
should declare, seed, enforce, and consume permissions.

Current RBAC integration points:

- Backend permission registry:
  `apps/api/src/permission/permission.registry.ts`
- Backend seed:
  `apps/api/prisma/seed.ts`
- Backend decorator:
  `apps/api/src/auth/permissions.decorator.ts`
- Frontend route/menu metadata:
  `apps/admin/src/routes/admin-route-registry.tsx` or the project-local equivalent
- Frontend permission helpers:
  `apps/admin/src/lib/permissions.ts`
- Frontend role management:
  `apps/admin/src/features/roles/RolesPage.tsx`
- Frontend role/permission API wrappers:
  `apps/admin/src/features/roles/roles.api.ts`

## Core Rule

Every new admin module must define its permission codes before implementation.

For a standard CRUD resource named `<resource>`, start with:

```text
<resource>.read
<resource>.create
<resource>.update
<resource>.delete
```

Add explicit permission codes for non-CRUD actions:

```text
<resource>.export
<resource>.import
<resource>.approve
<resource>.publish
<resource>.assign_users
```

Do not invent separate permission systems for menus, pages, buttons, and APIs.
They all use the same permission codes.

## Naming Convention

Use `module.action`.

Examples:

```text
article.read
article.create
article.update
article.delete
article.publish

order.read
order.update
order.cancel
order.refund
```

Rules:

- Use lowercase codes.
- Use stable names. Renaming a permission is a data migration.
- Use singular, stable module names unless an existing module code already
  exists. For example, use `article.read` for the `/articles` route.
- Prefer verbs that match user intent.
- Use `read` for list/detail page access.
- Use `create`, `update`, and `delete` for normal CRUD operations.
- Use specific action names for business operations.

## Permission Registry

Add the module's permissions to the backend permission registry.

Example:

```ts
{
  code: 'article.read',
  module: 'article',
  action: 'read',
  name: 'View articles',
  description: 'View article list and article details',
  defaultRoles: ['admin'],
  sortOrder: 300,
}
```

`defaultRoles` controls which default roles receive the permission during seed
upsert:

```text
defaultRoles: ['admin']      normal admin receives the permission
defaultRoles: []             only super_admin has it until manually assigned
defaultRoles: ['standard']   standard users receive it by default
```

Guidelines:

- Use `defaultRoles: ['admin']` for ordinary admin CRUD features.
- Use `defaultRoles: []` for sensitive features.
- Use `defaultRoles: ['standard']` only for intentionally broad access. Standard
  access should be exceptional for admin CRUD pages.
- `super_admin` does not need to appear in `defaultRoles`; it has all active
  permissions automatically.
- `defaultRoles` applies when a permission is first seeded. It must not re-grant
  a permission that an administrator manually removed from a role.

## Seed Requirement

After adding registry entries, make sure the seed/upsert flow is run in local
development and deployment environments.

The seed must:

- Upsert new permissions.
- Keep existing permissions stable.
- Apply `defaultRoles` for newly inserted permissions only.
- Avoid deleting permissions automatically when registry entries are removed.

If a feature is added without registry and seed updates, roles cannot assign the
new capability and the module is incomplete.

## Backend Controller Pattern

Each protected controller method must declare the matching permission code.

Example:

```ts
@Permissions('article.read')
@Get()
findMany() {}

@Permissions('article.read')
@Get(':id')
findOne() {}

@Permissions('article.create')
@Post()
create() {}

@Permissions('article.update')
@Patch(':id')
update() {}

@Permissions('article.delete')
@Delete(':id')
remove() {}
```

Rules:

- Do not protect new admin APIs only by checking role names.
- Do not rely on frontend button hiding.
- List and detail endpoints usually use the same `<resource>.read` permission.
- Special actions need special permissions.
- Public endpoints still use the existing public route mechanism.
- Authenticated self-service endpoints may require login but no explicit
  permission if they are available to every authenticated user.

## Backend Service Pattern

Business services should not duplicate generic permission checks already handled
by guards.

Service-level checks are still appropriate for resource-specific rules, for
example:

- The current user can only edit their own profile.
- A record cannot be deleted after approval.
- A system role cannot be deleted.

Keep generic capability checks in decorators and guards.

## Frontend Route Pattern

Add the page to the admin route/menu configuration with required permissions.

Example:

```ts
{
  path: '/articles',
  labelKey: 'nav.articles',
  icon: Newspaper,
  requiredPermissions: ['article.read'],
  component: ArticlesPage,
}
```

Rules:

- Menu visibility comes from route metadata.
- Direct URL access must also use the same metadata.
- Users without route permission should go to `/403`.
- Do not hard-code menu-only role checks inside `AdminShell`.

## Frontend Page Pattern

Use the permission helper for every page action.

Example:

```tsx
const permissions = useAuthStore((state) => state.permissions)
const canCreate = can(permissions, 'article.create')
const canUpdate = can(permissions, 'article.update')
const canDelete = can(permissions, 'article.delete')
```

Apply it to actions:

```tsx
{canCreate ? <CreateArticleButton /> : null}
{canUpdate ? <EditArticleButton /> : null}
{canDelete ? <DeleteArticleButton /> : null}
```

Rules:

- Hide actions the user cannot use.
- Keep the API call protected even when the UI hides the action.
- If an action is visible in multiple places, centralize the permission code in
  a module-local constant.
- Avoid stringly-typed permission codes scattered across a large page.

Recommended feature-local constants:

```ts
export const articlePermissions = {
  read: 'article.read',
  create: 'article.create',
  update: 'article.update',
  delete: 'article.delete',
} as const
```

Existing examples:

- Role management constants:
  `apps/admin/src/features/roles/roles.permissions.ts`
- Users action gates:
  `apps/admin/src/features/users/UsersPage.tsx`
- Dictionary action gates:
  `apps/admin/src/features/dictionaries/DictionariesPage.tsx`
- File action gates:
  `apps/admin/src/features/files/FilesPage.tsx`

## Frontend API Pattern

Frontend API wrappers do not need to pass permission codes. Authorization is
enforced by backend guards.

The wrapper should remain focused on request/response contracts:

```ts
api.articles.list(query)
api.articles.create(input)
api.articles.update(id, input)
api.articles.remove(id)
```

Do not make frontend API wrappers decide whether a user is allowed to call the
endpoint. Use page and route permission checks for UX, and backend guards for
security.

## Testing Checklist

For each new CRUD module, add or update tests that cover:

Backend:

- Controller methods declare the expected permission decorators.
- User with the permission can access the route.
- User without the permission receives `403`.
- Unauthenticated user receives `401`.
- `super_admin` can access the route.
- Special actions use their own permission codes.
- If a route uses multiple permission codes, tests cover that all listed
  permissions are required.

Frontend:

- Route appears in the menu when the user has `<resource>.read`.
- Route is hidden when the user lacks `<resource>.read`.
- Direct route access without permission redirects to `/403`.
- Create button requires `<resource>.create`.
- Edit button requires `<resource>.update`.
- Delete button requires `<resource>.delete`.
- Special action buttons require their matching permission.

Seed:

- Permission registry includes every permission used by the module.
- Seed/upsert creates the permissions.
- `defaultRoles` matches the intended rollout.
- Re-running seed does not restore permissions manually removed from a role.

Shared RBAC guard tests, usually owned by the RBAC module rather than every CRUD
module, should cover disabled roles, disabled permissions, multi-role permission
unions, and last-`super_admin` lockout prevention.

## Developer Checklist

Before opening a PR for a new CRUD module, verify:

- Permission codes are listed in the registry.
- Seed/upsert has been run locally.
- Backend endpoints use `@Permissions()`.
- Frontend route config uses `<resource>.read`.
- Page actions use the permission helper.
- Feature-local permission constants are used instead of scattered raw strings.
- Tests cover missing-permission behavior.
- Documentation or module notes mention any special permissions.

## Example: New Article Module

Permission registry:

```text
article.read
article.create
article.update
article.delete
article.publish
```

Backend:

```text
GET    /articles        article.read
GET    /articles/:id    article.read
POST   /articles        article.create
PATCH  /articles/:id    article.update
DELETE /articles/:id    article.delete
POST   /articles/:id/publish article.publish
```

Frontend:

```text
/articles menu/page     article.read
Create button           article.create
Edit button             article.update
Delete button           article.delete
Publish button          article.publish
```

Seed:

```text
article.read      defaultRoles: ['admin']
article.create    defaultRoles: ['admin']
article.update    defaultRoles: ['admin']
article.delete    defaultRoles: []
article.publish   defaultRoles: []
```

This lets normal admins browse and edit articles, while delete and publish
remain available only to `super_admin` until explicitly assigned.
