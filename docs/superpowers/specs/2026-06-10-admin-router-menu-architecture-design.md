# Admin Router And Menu Architecture Design

## Goal

Migrate the Common Admin frontend from the current handwritten path/history
routing to TanStack Router, while turning route metadata into the single
frontend source of truth for admin menus, route permissions, page titles,
breadcrumbs, and login redirects.

The new design should preserve the current RBAC behavior, support grouped
sidebar navigation, and keep the route registration workflow simple for future
CRUD modules.

## Context

The admin frontend already depends on TanStack Router, but before this
migration the active routing layer was handwritten local code:

- A local location store subscribed to browser history changes.
- A local navigation helper pushed or replaced browser history.
- A local guard resolved login, forbidden, not-found, and permission redirects.
- A flat route registry stored page path, label, icon, permission, and component
  metadata.
- `apps/admin/src/layouts/AdminShell.tsx` filters visible menu items from the
  same route metadata.

This is workable for a small starter, but it leaves path matching, navigation,
layout nesting, and not-found behavior as custom framework code. As the template
adds more modules, the frontend needs a stronger routing base without losing the
current benefit that menus and permissions come from one route registry.

The RBAC pattern guide already states that frontend menu visibility should come
from route metadata and that direct URL access should use the same permission
codes. This design keeps that rule.

## Chosen Approach

Use TanStack Router with a centralized code-defined route and menu registry.

Do not use file-based routing. Do not split menu configuration into a separate
manual list. Instead, keep a project-local registry that declares admin route
metadata and grouped menu structure, then derive the TanStack route tree,
visible sidebar items, first accessible route, page title, and breadcrumbs from
that registry.

Principles:

- Route and menu metadata are the frontend source of truth for admin navigation.
- Backend guards remain the security boundary.
- Frontend route permissions are for user experience and direct-route gating.
- TanStack Router owns path matching, navigation, outlet rendering, route
  context, and not-found behavior.
- Admin pages should stay mostly unaware of the routing library.
- The migration is a breaking change. Remove the old handwritten routing files
  instead of keeping compatibility wrappers.

## Non-Goals

The first version should not include:

- TanStack Router file-based routing.
- Unlimited-depth recursive menus.
- Database-driven menus.
- Runtime route registration from backend data.
- Per-user menu customization beyond RBAC permission filtering.
- Dynamic breadcrumb labels loaded from detail records.
- Route-level data loaders for existing CRUD table data.
- Tabbed page caching, keep-alive behavior, or multi-tab workspaces.

These can be considered later, but they should not complicate the first router
architecture migration.

## Target File Structure

Create a small route architecture under `apps/admin/src/routes/`:

```text
apps/admin/src/routes/
- admin-route-registry.tsx
- router.tsx
- route-meta.ts
```

Responsibilities:

- `admin-route-registry.tsx` declares route metadata and menu groups.
- `route-meta.ts` owns metadata types and pure helper functions.
- `router.tsx` creates the TanStack Router route tree and exports the router.

The existing flat route registry can be replaced or renamed as part of the
migration. The final codebase should not have both old and new route
registries.

Remove the old handwritten routing files:

```text
legacy app dispatcher
legacy location subscription helper
legacy imperative navigation helper
legacy route guard and guard tests
legacy flat route registry and registry tests
```

Their tests should be replaced with registry, router guard, and shell behavior
tests.

## Route And Menu Metadata

Use two related metadata shapes: routes and menu groups.

```ts
interface AdminRouteMeta {
  id: string
  path: string
  labelKey: MessageKey
  requiredPermissions: string[]
  component: ComponentType
  breadcrumbKey?: MessageKey
  titleKey?: MessageKey
  hideInMenu?: boolean
}

interface AdminMenuGroup {
  id: string
  labelKey: MessageKey
  icon?: LucideIcon
  order?: number
  children: AdminRouteMeta[]
}
```

Field rules:

- `id` is stable and should not change casually. Use it for tests, active menu
  state, breadcrumbs, and future route-related keys.
- `path` is the URL path.
- `labelKey` is the default menu label and page title.
- `titleKey` may override the page title when the menu label is too short.
- `breadcrumbKey` may override the breadcrumb label.
- `requiredPermissions` uses the same permission codes as backend guards.
- `hideInMenu` allows future detail or edit pages to be routable without showing
  them in the sidebar.
- First-version breadcrumbs are defined for grouped visible routes only. Do not
  add parent/child breadcrumb fields until a hidden detail route is actually
  introduced.

First version menus support exactly two levels:

```text
group -> route
```

Do not implement unlimited recursive menus until the product has a concrete
need. Two levels are enough for grouping modules such as workspace, system,
resources, observability, and settings while keeping active state, permissions,
and mobile navigation straightforward.

## Initial Menu Grouping

The exact labels can be adjusted during implementation, but the first grouped
sidebar should follow this shape:

```ts
export const adminMenuGroups = [
  {
    id: 'workspace',
    labelKey: 'nav.group.workspace',
    children: [dashboardRoute],
  },
  {
    id: 'system',
    labelKey: 'nav.group.system',
    children: [usersRoute, rolesRoute, permissionsRoute],
  },
  {
    id: 'resources',
    labelKey: 'nav.group.resources',
    children: [dictionariesRoute, filesRoute],
  },
  {
    id: 'observability',
    labelKey: 'nav.group.observability',
    children: [auditLogsRoute],
  },
  {
    id: 'configuration',
    labelKey: 'nav.group.configuration',
    children: [settingsRoute],
  },
]
```

Flatten these groups to build the TanStack route tree:

```ts
export const adminRoutes = flattenAdminMenuGroups(adminMenuGroups)
```

If the project later adds hidden detail pages, keep them in an
`adminStandaloneRoutes` list and include them in the router and permission
helpers without rendering them as menu items.

## Helper Functions

Keep route and menu logic testable with pure helpers:

```ts
flattenAdminMenuGroups(groups)
getVisibleAdminMenuGroups(groups, permissions)
getVisibleAdminRoutes(permissions)
getFirstAccessibleRoute(permissions)
findAdminRouteById(id)
findAdminRouteByPath(path)
getMenuGroupForRoute(routeId)
getBreadcrumbsForRoute(routeId)
```

Rules:

- A route is visible when it is not hidden and the user has all
  `requiredPermissions`.
- A menu group is visible when at least one child route is visible.
- The first accessible route is calculated by menu group order and child order.
- When `order` is omitted, group order is array order. Child route order is
  always array order in the first version.
- Hidden routes may be accessible by direct URL if the user has permission, but
  they do not affect menu visibility or the default login redirect unless the
  product explicitly changes that rule later.
- Helper functions should operate on passed metadata. They should not import
  page components directly; only the registry should connect metadata to page
  components.

## Router Structure

Use a TanStack Router tree with public routes and a protected admin layout:

```text
root route
- /
- /login
- /403
- /404
- protected admin layout route
  - /dashboard
  - /users
  - /roles
  - /permissions
  - /dictionaries
  - /files
  - /audit-logs
  - /settings
```

The protected admin layout renders `AdminShell`, and `AdminShell` renders the
current page with `<Outlet />`.

The router should be created from centralized metadata rather than duplicating
paths manually in multiple places. The implementation may still create TanStack
route objects explicitly in `router.tsx`, but the route metadata must be shared
with menu and permission helpers.

Route registry paths should use absolute application paths such as `/users` and
`/audit-logs`. If TanStack child routes require relative path strings during
construction, convert them inside `router.tsx`; do not make registry consumers
remember two path formats.

## Router Context And Auth Bootstrap

Use router context to make auth state available to route guards:

```ts
interface RouterContext {
  auth: {
    status: AuthStatus
    permissions: readonly string[]
  }
}
```

The implementation can source this context from Zustand state in `App`, then
pass it to `RouterProvider`.

Router guards must be re-evaluated when auth status or permissions change.
Implement this with a thin router host component that reads Zustand auth state,
passes a fresh context object to `RouterProvider`, and invalidates the router
when guard-relevant auth values change:

```text
on auth.status or auth.permissions change:
  router.invalidate()
```

This keeps redirects correct after bootstrap, login, logout, refresh failure,
and role/permission changes reflected in the current session.

Keep a small auth bootstrap component or hook whose only job is to restore the
session on startup:

```text
if auth status is checking:
  call api.refresh()
  on success: set session
  on failure: set anonymous
```

This bootstrap should not do path dispatch. Redirects belong to TanStack Router
route guards.

Use the existing full-screen loading treatment for auth startup. While auth
status is `checking`, routes that depend on knowing whether the user is already
authenticated should render that loading state instead of rendering login or
redirecting prematurely.

## Guard Behavior

Keep the current route behavior, but move it into TanStack Router lifecycle.

Rules:

- `/` renders the auth loading state while auth is `checking`.
- `/` sends anonymous users to `/login`.
- `/` sends authenticated users to the first accessible admin route.
- `/` sends authenticated users with no accessible admin route to `/403`.
- `/login` renders the auth loading state while auth is `checking`.
- `/login` stays visible for anonymous users.
- `/login` sends authenticated users to the first accessible admin route.
- `/login` sends authenticated users with no accessible admin route to `/403`.
- Protected admin routes show a loading state while auth is `checking`.
- Protected admin routes send anonymous users to `/login`.
- Protected admin routes send authenticated users without route permission to
  `/403`.
- Protected admin routes allow authenticated users with all route permissions.
- `/403` and `/404` are public frontend routes.
- Unknown routes should keep the attempted URL and render TanStack Router's
  not-found component. The `/404` route remains available as a public explicit
  not-found URL, but unknown URLs do not redirect to `/404`.

Do not silently redirect a user from a forbidden route to another accessible
admin page. Directly visiting a known route without permission should produce
the forbidden experience because it is clearer and easier to diagnose.

## AdminShell Responsibilities

`AdminShell` should no longer accept `currentPath`.

It should:

- Read current route metadata from TanStack Router matches.
- Render grouped sidebar navigation from visible menu groups.
- Navigate with TanStack Router's navigation APIs or `Link` components.
- Mark the active route using route id or current path from the router.
- Render page title from route metadata.
- Render breadcrumbs from route and group metadata.
- Render `<Outlet />` for the active page.
- Keep existing shell concerns such as theme switching, language switching,
  current-user refresh, and logout.

Logout should use the router navigation API to go to `/login` after clearing
session and query cache.

## Breadcrumbs

Render breadcrumbs in the admin header in the first version.

Default breadcrumb shape:

```text
group / route
```

Examples:

```text
System / Users
Resources / Files
Observability / Audit Logs
```

Rules:

- Group crumbs are not clickable in the first version.
- The current route crumb does not need to be clickable.
- First-version breadcrumb helpers only need to support routes that belong to a
  menu group. Hidden standalone route breadcrumbs should be added with their own
  concrete design when the first hidden route exists.
- Login, forbidden, and not-found pages do not participate in admin menu
  breadcrumbs.
- On narrow mobile screens, the UI may hide the group crumb if space is tight,
  but the current page title must remain visible.

## Page Titles

Page title resolution:

```text
route.titleKey ?? route.labelKey
```

The shell header should display the page title separately from breadcrumbs.

Do not add dynamic titles for detail records in the first version. Dynamic page
titles can be added later through page-level state or route loaders when detail
pages exist.

## Internationalization

Add message keys for menu groups:

```text
nav.group.workspace
nav.group.system
nav.group.resources
nav.group.observability
nav.group.configuration
```

Existing route label keys should continue to work.

Tests should cover at least the English messages used by route and group
metadata. If the project supports multiple locales, each locale should receive
the same keys during implementation.

## Migration Plan

Implementation should be done as one breaking migration:

1. Add the new route metadata types and helper functions.
2. Convert the current admin route list into grouped menu metadata.
3. Build the TanStack Router route tree from the centralized metadata.
4. Replace the legacy app dispatcher with `RouterProvider` plus auth bootstrap.
5. Refactor `AdminShell` to use router matches, grouped menus, breadcrumbs, and
   `<Outlet />`.
6. Replace legacy imperative navigation call sites with TanStack Router
   navigation or `Link`.
7. Delete the legacy local routing helpers and flat route registry.
8. Replace old route guard tests with registry, router guard, menu, breadcrumb,
   and shell tests.
9. Update docs that mention frontend route/menu metadata if file names change.

Do not leave the old handwritten routing path active beside TanStack Router.

## Testing Strategy

Add or update frontend tests for:

- Route registry preserves the expected paths and permission codes.
- Menu helpers filter routes and groups by permission.
- Empty groups are hidden.
- The first accessible route follows group and child order.
- Breadcrumb helpers return `group / route` for visible routes.
- Hidden routes do not appear in menus.
- Root and login routes render auth loading while auth status is `checking`.
- Root and login redirects use the first accessible route.
- Authenticated users without route permission reach `/403`.
- Anonymous users visiting protected routes reach `/login`.
- Auth status or permission changes invalidate the router so guards re-run.
- Unknown routes render the not-found experience.
- `AdminShell` renders grouped navigation, active state, page title, and
  breadcrumbs.
- Login redirects after successful login use the new router navigation path.
- Logout clears session/query state and navigates to `/login`.

Run the normal admin verification commands after implementation:

```text
pnpm --filter admin test
pnpm --filter admin lint
pnpm --filter admin build
```

If root-level scripts cover the admin package, run those as well before marking
the implementation complete.

## Risks And Mitigations

### Auth State During Startup

TanStack Router guards may run before the refresh call finishes. Keep
`checking` as an explicit auth state and render a loading fallback for protected
routes until the bootstrap resolves.

### Duplicate Route Metadata

The migration could accidentally create route definitions in both router code
and menu code. Keep route identity, path, label, and permissions in the registry
and derive other structures from it.

### Menu Group Permissions

Group visibility should not introduce separate permission codes. A group is
visible only when it contains at least one visible child route.

### Over-Abstracting Menus

The first version should support two levels only. Avoid recursive trees,
collapsible persistence, and complex menu settings until there is a real
product need.

### Existing Tests Coupled To Legacy Navigation

Some tests currently mock the legacy navigation helper. Update them to assert
router navigation or resulting screen state instead of preserving the old
helper.

## Documentation Updates

Update route-related references after implementation:

- `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`
- Any future module checklist that tells developers where to add frontend route
  metadata.

The RBAC rule remains unchanged:

```text
Do not invent separate permission systems for menus, pages, buttons, and APIs.
They all use the same permission codes.
```
