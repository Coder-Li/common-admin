---
title: RBAC
description: Permission conventions for backend guards, frontend routes, menus, and page actions.
draft: false
---

Common Admin uses permission codes instead of role-name checks.

## Permission Codes

Use lowercase `module.action` codes:

```text
article.read
article.create
article.update
article.delete
article.publish
```

Rules:

- Use singular, stable module names unless an existing module code already exists.
- Use `read` for list and detail access.
- Use `create`, `update`, and `delete` for normal CRUD actions.
- Use specific business verbs for non-CRUD actions, such as `publish`, `approve`, `cancel`, `refund`, `import`, or `export`.
- Keep codes stable. Renaming a permission is a data migration risk because roles, route metadata, page gates, tests, and seeded records can all reference it.

## Required Alignment

The same permission code should protect:

- Backend controller methods through `@Permissions()`.
- Frontend route access.
- Menu visibility.
- Page actions such as create, edit, delete, import, export, or approve.

Define permission codes before implementation when adding a module. If naming or default role behavior is unclear, stop and ask the maintainer rather than guessing.

## Registry And Seed Behavior

Add permissions to the backend registry with a stable code, module, action, name, description, default roles, and sort order.

`defaultRoles` controls initial seed assignment:

```text
defaultRoles: ['admin']      ordinary admin receives the permission
defaultRoles: []             only super_admin has it until manually assigned
defaultRoles: ['standard']   standard users receive it by default
```

Guidelines:

- Use `defaultRoles: ['admin']` for ordinary admin CRUD features.
- Use `defaultRoles: []` for sensitive or destructive features.
- Use `defaultRoles: ['standard']` only for intentionally broad access.
- `super_admin` does not need to appear in `defaultRoles`; it has all active permissions automatically.
- Seed behavior should upsert new permissions, preserve existing permissions, and avoid re-granting permissions that an administrator manually removed from a role.
- Removing a registry entry should not silently delete production permission records.

## Backend Enforcement

Admin controller methods should use matching permission decorators:

```ts
@Permissions('article.read')
@Get()
listArticles() {}

@Permissions('article.create')
@Post()
createArticle() {}

@Permissions('article.update')
@Patch(':id')
updateArticle() {}

@Permissions('article.delete')
@Delete(':id')
deleteArticle() {}
```

List and detail endpoints usually share `<resource>.read`. Special actions need their own codes.

Generic capability checks belong in guards and decorators. Service-level checks are still appropriate for resource-specific rules, such as ownership limits, status transitions, or protected system records.

## Frontend Enforcement

Route and menu visibility should come from admin route metadata:

```ts
{
  path: '/articles',
  labelKey: 'nav.articles',
  requiredPermissions: ['article.read'],
}
```

Page actions should use the same permission codes:

```ts
const canCreate = can(permissions, 'article.create')
const canUpdate = can(permissions, 'article.update')
const canDelete = can(permissions, 'article.delete')
```

If a page uses several permissions, prefer a feature-local constant object instead of scattered string literals.

Frontend permission checks improve UX, but backend guards are the security boundary. Hiding a button is not enough.

## Avoid

- Role-name checks such as `if admin`.
- Frontend-only permission enforcement.
- Scattered string literals when a feature-local permission constant would be clearer.
- Separate permission systems for routes, menus, pages, and APIs.
- Generated API wrappers that decide whether a user is authorized to call an endpoint.

## Rename And Migration Risk

Permission codes are durable data. Renaming `article.publish` to `article.approve` is not just a text edit; it can affect seeded permissions, existing role assignments, audit expectations, route metadata, generated tests, and downstream projects.

When a permission must be renamed:

- plan a data migration;
- update registry entries, backend decorators, frontend route metadata, page action gates, tests, and docs together;
- decide whether old assignments should carry over;
- verify the seed does not duplicate or re-grant unintended access.

## Test Checklist

Backend tests should cover:

- registry entries for every permission used by the module;
- seed/upsert behavior for new permissions;
- users with the permission can access protected routes;
- users without the permission receive `403`;
- unauthenticated users receive `401`;
- `super_admin` can access active permissions;
- special actions use special permission codes.

Frontend tests should cover:

- route appears in the menu when the user has `<resource>.read`;
- route is hidden when the user lacks `<resource>.read`;
- direct route access without permission redirects to `/403`;
- create, update, delete, and special action buttons follow their matching permissions.
