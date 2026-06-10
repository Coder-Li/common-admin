# Admin Router And Menu Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the admin frontend to TanStack Router with grouped menu metadata, permission-aware route guards, page titles, and breadcrumbs.

**Architecture:** Replace the handwritten path/history routing with a centralized route/menu registry that feeds TanStack Router, sidebar navigation, login redirects, and breadcrumbs. Keep route/menu helper logic pure and testable, move guard behavior into router lifecycle, and make `AdminShell` render the protected layout with `<Outlet />`.

**Tech Stack:** React 19, Vite, TypeScript, TanStack Router, TanStack Query, Zustand, Vitest, React Testing Library, lucide-react, Tailwind CSS.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-10-admin-router-menu-architecture-design.md`
- Legacy flat route registry: replaced by `apps/admin/src/routes/admin-route-registry.tsx`
- Legacy route tests: replaced by `apps/admin/src/routes/admin-route-registry.test.tsx`
- Legacy handwritten guard: replaced by `apps/admin/src/routes/router-factory.ts`
- Legacy app dispatcher: replaced by `apps/admin/src/routes/router.tsx`
- Current shell: `apps/admin/src/layouts/AdminShell.tsx`
- Current login view: `apps/admin/src/features/auth/LoginView.tsx`
- RBAC route/menu guidance: `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`

## File Structure

### Create

- `apps/admin/src/routes/route-meta.ts`: metadata types and pure route/menu/breadcrumb helpers.
- `apps/admin/src/routes/route-meta.test.ts`: pure helper tests for grouped menus, permissions, first route, and breadcrumbs.
- `apps/admin/src/routes/admin-route-registry.tsx`: admin route definitions, menu groups, flattened route exports, and route lookup maps.
- `apps/admin/src/routes/admin-route-registry.test.tsx`: real admin registry tests for route order, permissions, groups, and i18n keys.
- `apps/admin/src/routes/router.tsx`: TanStack Router creation, public routes, protected layout route, guard behavior, and auth bootstrap/host components if kept route-local.
- `apps/admin/src/routes/router.test.tsx`: router behavior tests for auth loading, redirects, forbidden, not found, and guard invalidation.

### Modify

- `apps/admin/src/App.tsx`: replace the legacy app dispatcher with TanStack `RouterProvider` host while preserving QueryClient, Theme, I18n, and Toaster providers.
- `apps/admin/src/layouts/AdminShell.tsx`: remove `currentPath`, render grouped nav, breadcrumbs, title, and `<Outlet />`, and use router navigation for logout.
- `apps/admin/src/layouts/AdminShell.test.tsx`: update tests to render through a test router instead of passing `currentPath`.
- `apps/admin/src/features/auth/LoginView.tsx`: replace legacy navigation and old route imports with router navigation and new first-accessible-route helper.
- `apps/admin/src/features/auth/LoginView.test.tsx`: update login redirect assertions and move startup refresh tests to router tests.
- `apps/admin/src/i18n/messages.ts`: add menu group labels in `en-US` and `zh-CN`.
- `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`: update the route metadata file reference.

### Delete

- legacy app dispatcher
- legacy location subscription helper
- legacy imperative navigation helper
- legacy route guard implementation
- legacy route guard tests
- legacy flat route registry
- legacy flat route registry tests

Do not keep compatibility wrappers for the deleted handwritten routing files.

## Chunk 1: Route Metadata And Grouped Menu Helpers

### Task 1: Add Route Metadata Types And Helper Tests

**Files:**
- Create: `apps/admin/src/routes/route-meta.ts`
- Create: `apps/admin/src/routes/route-meta.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `apps/admin/src/routes/route-meta.test.ts` with focused tests using small fake route objects. Cover:

- `flattenAdminMenuGroups` preserves group/child order.
- `getVisibleAdminMenuGroups` filters routes by `requiredPermissions`.
- Empty groups are hidden.
- `hideInMenu: true` routes are excluded from visible menus.
- `getFirstAccessibleRoute` follows group and child order.
- `findAdminRouteById` and `findAdminRouteByPath` return the expected route.
- `getMenuGroupForRoute` returns the owning group.
- `getBreadcrumbsForRoute` returns `group / route`.

Example test skeleton:

```ts
const dashboardRoute = {
  id: 'dashboard',
  path: '/dashboard',
  labelKey: 'nav.dashboard',
  requiredPermissions: ['dashboard.view'],
  component: TestPage,
} satisfies AdminRouteMeta

expect(
  getVisibleAdminMenuGroups(groups, ['dashboard.view']).map((group) => ({
    id: group.id,
    children: group.children.map((route) => route.id),
  })),
).toEqual([{ id: 'workspace', children: ['dashboard'] }])
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter admin test -- src/routes/route-meta.test.ts
```

Expected: FAIL because `route-meta.ts` does not exist yet.

- [ ] **Step 3: Implement metadata types and helpers**

Create `apps/admin/src/routes/route-meta.ts` with:

```ts
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { MessageKey } from '../i18n/messages'
import { canAll } from '../lib/permissions'
import type { UserProfile } from '../types/auth'

export interface RouteComponentProps {
  isLoading: boolean
  user: UserProfile | null
}

export interface AdminRouteMeta {
  id: string
  path: string
  labelKey: MessageKey
  requiredPermissions: string[]
  component: ComponentType<RouteComponentProps>
  breadcrumbKey?: MessageKey
  titleKey?: MessageKey
  hideInMenu?: boolean
}

export interface AdminMenuGroup {
  id: string
  labelKey: MessageKey
  icon?: LucideIcon
  order?: number
  children: AdminRouteMeta[]
}
```

Also implement:

```ts
flattenAdminMenuGroups(groups)
getVisibleAdminMenuGroups(groups, permissions)
getVisibleAdminRoutes(groups, permissions)
getFirstAccessibleRoute(groups, permissions)
findAdminRouteById(routes, id)
findAdminRouteByPath(routes, path)
getMenuGroupForRoute(groups, routeId)
getBreadcrumbsForRoute(groups, routeId)
```

Keep helpers pure. Do not import page components into `route-meta.ts`.

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```bash
pnpm --filter admin test -- src/routes/route-meta.test.ts
```

Expected: PASS.

### Task 2: Convert Current Routes Into Grouped Registry

**Files:**
- Create: `apps/admin/src/routes/admin-route-registry.tsx`
- Modify/Delete: legacy flat route registry
- Modify/Delete: legacy flat route registry tests
- Test: `apps/admin/src/routes/admin-route-registry.test.tsx` or extend `route-meta.test.ts`

- [ ] **Step 1: Write failing registry tests**

Create registry tests that assert:

- Flattened paths are:

```ts
[
  '/dashboard',
  '/users',
  '/roles',
  '/permissions',
  '/dictionaries',
  '/files',
  '/audit-logs',
  '/settings',
]
```

- Permission metadata stays unchanged for `/roles`, `/permissions`, `/audit-logs`, and `/settings`.
- Menu groups are `workspace`, `system`, `resources`, `observability`, `configuration`.
- First accessible route for `['user.read']` is `/users`.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter admin test -- src/routes/admin-route-registry.test.tsx src/routes/route-meta.test.ts
```

Expected: FAIL because the new registry does not exist.

- [ ] **Step 3: Create grouped registry**

Create `apps/admin/src/routes/admin-route-registry.tsx`.

Move the current route definitions from the legacy flat registry into named constants:

```ts
const dashboardRoute: AdminRouteMeta = { id: 'dashboard', path: '/dashboard', ... }
const usersRoute: AdminRouteMeta = { id: 'users', path: '/users', ... }
```

Export:

```ts
export const adminMenuGroups = [...]
export const adminRoutes = flattenAdminMenuGroups(adminMenuGroups)
export const getVisibleAdminRoutes = (permissions) =>
  getVisibleAdminRoutesFromGroups(adminMenuGroups, permissions)
export const getFirstAccessibleRoute = (permissions) =>
  getFirstAccessibleRouteFromGroups(adminMenuGroups, permissions)
export const findAdminRouteByPath = (path) =>
  findAdminRouteByPathFromRoutes(adminRoutes, path)
export const findAdminRouteById = (id) =>
  findAdminRouteByIdFromRoutes(adminRoutes, id)
```

Use alias names if helper names would collide with imported helper functions.

- [ ] **Step 4: Delete old route registry tests**

Remove the legacy flat route registry tests after equivalent coverage exists in the new tests.

- [ ] **Step 5: Run route tests**

Run:

```bash
pnpm --filter admin test -- src/routes
```

Expected: PASS for metadata and registry tests.

### Task 3: Add Menu Group I18n Labels

**Files:**
- Modify: `apps/admin/src/i18n/messages.ts`
- Test: `apps/admin/src/routes/admin-route-registry.test.tsx`

- [ ] **Step 1: Add failing assertion for group message keys**

In registry tests, assert every `adminMenuGroups[*].labelKey` exists in `messages['en-US']` and `messages['zh-CN']`.

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm --filter admin test -- src/routes/admin-route-registry.test.tsx
```

Expected: FAIL because group message keys are missing.

- [ ] **Step 3: Add group labels**

Add keys to both locales:

```ts
'nav.group.workspace': 'Workspace',
'nav.group.system': 'System',
'nav.group.resources': 'Resources',
'nav.group.observability': 'Observability',
'nav.group.configuration': 'Configuration',
```

Chinese labels:

```ts
'nav.group.workspace': '工作台',
'nav.group.system': '系统管理',
'nav.group.resources': '资源管理',
'nav.group.observability': '运维审计',
'nav.group.configuration': '配置',
```

- [ ] **Step 4: Run route and i18n-adjacent tests**

Run:

```bash
pnpm --filter admin test -- src/routes src/i18n
```

Expected: PASS.

### Task 4: Commit Metadata Foundation

**Files:**
- Stage the files touched in Chunk 1.

- [ ] **Step 1: Review status**

Run:

```bash
git status --short
```

Expected: only Chunk 1 route/i18n files are changed.

- [ ] **Step 2: Commit**

Run:

```bash
git add apps/admin/src/routes apps/admin/src/i18n/messages.ts
git commit -m "feat(admin): add grouped route metadata"
```

Expected: commit succeeds.

## Chunk 2: TanStack Router And Auth Guards

### Task 1: Add Router Behavior Tests

**Files:**
- Create: `apps/admin/src/routes/router.tsx`
- Create: `apps/admin/src/routes/router.test.tsx`
- Modify later: `apps/admin/src/App.tsx`

- [ ] **Step 1: Write failing router tests**

Create `apps/admin/src/routes/router.test.tsx`. Use TanStack Router memory history if available from the installed version, or construct a browser-history test wrapper with `window.history.replaceState`.

Cover:

- `/` renders `Loading...` while auth status is `checking`.
- `/login` renders `Loading...` while auth status is `checking`.
- `/` redirects anonymous users to `/login`.
- `/login` redirects authenticated users to first accessible route.
- Protected routes redirect anonymous users to `/login`.
- Protected routes redirect authenticated users without permission to `/403`.
- Unknown routes keep the attempted URL and render the not-found page.
- Changing auth status or permissions triggers `router.invalidate()`.

Prefer asserting final screen state over implementation internals except for the explicit `router.invalidate()` contract.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter admin test -- src/routes/router.test.tsx
```

Expected: FAIL because `router.tsx` is not implemented.

### Task 2: Implement Router Tree And Guards

**Files:**
- Create/Modify: `apps/admin/src/routes/router.tsx`
- Modify: `apps/admin/src/App.tsx`
- Modify/Delete: legacy app dispatcher

- [ ] **Step 1: Create router context types**

In `router.tsx`, define:

```ts
export interface AdminRouterContext {
  auth: {
    status: AuthStatus
    permissions: readonly string[]
  }
}
```

Use the project `AuthStatus` type from `apps/admin/src/types/auth.ts`.

- [ ] **Step 2: Create shared loading component**

Add a small `AuthLoadingPage` component that renders the same full-screen loading UI used by the legacy app dispatcher:

```tsx
<main className="grid min-h-screen place-items-center bg-[var(--color-app)] text-sm text-[var(--color-text-muted)]">
  Loading...
</main>
```

Keep it in `router.tsx` unless it becomes reused outside routing.

- [ ] **Step 3: Implement public route guards**

For `/` and `/login`:

- If `status === 'checking'`, render loading.
- If anonymous at `/`, redirect to `/login`.
- If authenticated, redirect to `getFirstAccessibleRoute(permissions)?.path ?? '/403'`.
- If anonymous at `/login`, render `LoginView`.

Use TanStack Router `redirect({ to: ... })` from `@tanstack/react-router`.

- [ ] **Step 4: Implement protected layout guard**

For protected admin routes:

- If `status === 'checking'`, render loading.
- If anonymous, redirect to `/login`.
- If authenticated but missing route permissions, redirect to `/403`.
- If authorized, render `AdminShell`.

Route registry paths are absolute app paths. Convert to relative child paths inside `router.tsx` if TanStack child routes require it.

- [ ] **Step 5: Implement admin route children from registry**

Create route objects for every `adminRoutes` entry. Store route metadata in route context/static data in the way supported by the installed TanStack Router version.

The page component should still receive:

```tsx
{
  isLoading: meQuery.isLoading,
  user,
}
```

That prop handoff may happen in `AdminShell` via `<Outlet />` context or in the generated route component. Choose the option that keeps page components unchanged.

- [ ] **Step 6: Implement not-found behavior**

Unknown URLs should keep the attempted URL and render `NotFoundPage`. `/404` should remain an explicit public route that also renders `NotFoundPage`.

- [ ] **Step 7: Add router host and auth bootstrap**

In `router.tsx` or `App.tsx`, create a host component that:

- Reads `status` and `permissions` from `useAuthStore`.
- Calls `api.refresh()` once while status is `checking`.
- Calls `setSession` on success.
- Calls `setAnonymous` on failure.
- Passes a fresh auth context to `RouterProvider`.
- Calls `router.invalidate()` when `status` or a stable permissions key changes.

Use a stable permissions key such as `permissions.join('\u0000')` for the invalidation effect dependency.

- [ ] **Step 8: Replace Legacy Dispatcher in App**

Modify `apps/admin/src/App.tsx` to render the router host instead of the legacy dispatcher, keeping existing providers and `ThemedToaster`.

- [ ] **Step 9: Run router tests**

Run:

```bash
pnpm --filter admin test -- src/routes/router.test.tsx
```

Expected: PASS.

### Task 3: Move Startup Refresh Coverage Out Of LoginView Tests

**Files:**
- Modify: `apps/admin/src/features/auth/LoginView.test.tsx`
- Test: `apps/admin/src/routes/router.test.tsx`

- [ ] **Step 1: Delete old dispatcher startup tests**

Remove the legacy dispatcher startup refresh describe block from `LoginView.test.tsx`.

- [ ] **Step 2: Ensure equivalent router tests exist**

Confirm `router.test.tsx` covers:

- Refresh runs while auth is `checking`.
- Successful refresh stores session and reaches the protected route.
- Failed refresh marks anonymous and reaches `/login`.

- [ ] **Step 3: Run affected tests**

Run:

```bash
pnpm --filter admin test -- src/features/auth/LoginView.test.tsx src/routes/router.test.tsx
```

Expected: PASS.

### Task 4: Commit Router Foundation

**Files:**
- Stage Chunk 2 router/app/login test files.

- [ ] **Step 1: Review status**

Run:

```bash
git status --short
```

Expected: Chunk 2 changes only, plus any deleted legacy dispatcher if already removed.

- [ ] **Step 2: Commit**

Run:

```bash
git add apps/admin/src/App.tsx apps/admin/src/routes apps/admin/src/features/auth/LoginView.test.tsx
git commit -m "feat(admin): route through tanstack router"
```

Expected: commit succeeds. If the legacy dispatcher was deleted, `git add` should stage the deletion.

## Chunk 3: Shell, Login, And Navigation Migration

### Task 1: Refactor AdminShell Tests For Router Rendering

**Files:**
- Modify: `apps/admin/src/layouts/AdminShell.test.tsx`
- Modify later: `apps/admin/src/layouts/AdminShell.tsx`

- [ ] **Step 1: Replace direct `AdminShell currentPath` render helper**

Update `renderAdminShell` to render through the router test harness at a path such as `/dashboard`, `/files`, or `/audit-logs`.

The helper should set auth state before rendering:

```ts
useAuthStore.getState().setSession({
  accessToken: 'access-token',
  user: { ...user, permissions },
})
```

- [ ] **Step 2: Update expected navigation shape**

Add assertions for grouped labels:

```ts
expect(screen.getByText('Workspace')).toBeInTheDocument()
expect(screen.getByText('System')).toBeInTheDocument()
expect(screen.getByText('Resources')).toBeInTheDocument()
```

Add breadcrumb assertions:

```ts
expect(screen.getByText('Resources / Files')).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument()
```

- [ ] **Step 3: Update logout assertions**

Replace legacy navigation assertions with router navigation assertions. Prefer:

```ts
await waitFor(() => {
  expect(screen.getByText('Sign in to continue')).toBeInTheDocument()
})
```

Also keep assertions for `api.logout`, `clearQueryCache`, and local auth reset.

- [ ] **Step 4: Run test and verify it fails**

Run:

```bash
pnpm --filter admin test -- src/layouts/AdminShell.test.tsx
```

Expected: FAIL because `AdminShell` still expects `currentPath` and imports old navigation.

### Task 2: Refactor AdminShell Implementation

**Files:**
- Modify: `apps/admin/src/layouts/AdminShell.tsx`

- [ ] **Step 1: Remove `currentPath` prop**

Delete `AdminShellProps` and make `AdminShell` read route state from TanStack Router.

- [ ] **Step 2: Render grouped sidebar navigation**

Use `getVisibleAdminMenuGroups(permissions)` from the new registry/helper layer.

Render each group with:

- A small uppercase/muted group label.
- Child route links.
- Existing lucide route icons.
- Stable test IDs like `nav-group-system`, `nav-users`, `mobile-nav-users`.

Hide a group when no child routes are visible.

- [ ] **Step 3: Use TanStack links/navigation**

Replace legacy button navigation with either:

```tsx
<Link to={route.path}>...</Link>
```

or `const navigate = useNavigate()` with `navigate({ to: route.path })`.

Use the same approach consistently in desktop and mobile nav.

- [ ] **Step 4: Render page title and breadcrumbs**

Read current route metadata from router matches or by matching current path against the registry.

Render:

```text
Group / Route
Route Title
```

For routes without breadcrumbs, render only the title. Public pages do not use `AdminShell`.

- [ ] **Step 5: Render active page**

Render `<Outlet />` in the content area. Ensure current page components still receive `isLoading` and `user` props according to the router implementation chosen in Chunk 2.

- [ ] **Step 6: Migrate logout navigation**

After `api.logout()`, `reset()`, and `clearQueryCache()`, navigate with TanStack Router:

```ts
navigate({ to: '/login' })
```

If the installed version requires `replace`, use the version-supported option.

- [ ] **Step 7: Run shell tests**

Run:

```bash
pnpm --filter admin test -- src/layouts/AdminShell.test.tsx
```

Expected: PASS.

### Task 3: Migrate LoginView Navigation

**Files:**
- Modify: `apps/admin/src/features/auth/LoginView.tsx`
- Modify: `apps/admin/src/features/auth/LoginView.test.tsx`

- [ ] **Step 1: Update failing login redirect test**

Change the login redirect test to assert the resulting route/screen rather than the legacy navigation helper.

For a user with only `user.read`, assert the app reaches `/users` or renders the Users page heading after login.

- [ ] **Step 2: Replace old imports**

Remove:

```ts
import { legacyNavigate } from 'legacy navigation helper'
import { getFirstVisibleRoute } from 'legacy flat route registry'
```

Use:

```ts
import { useNavigate } from '@tanstack/react-router'
import { getFirstAccessibleRoute } from '../../routes/admin-route-registry'
```

- [ ] **Step 3: Navigate after login with router API**

After `setSession(session)`, compute:

```ts
const firstRoute = getFirstAccessibleRoute(session.user.permissions)
await navigate({ to: firstRoute?.path ?? '/403' })
```

Use the installed router navigation return type correctly; if navigation is synchronous in this version, do not await it.

- [ ] **Step 4: Run login tests**

Run:

```bash
pnpm --filter admin test -- src/features/auth/LoginView.test.tsx
```

Expected: PASS.

### Task 4: Commit Shell And Login Migration

**Files:**
- Stage `AdminShell`, `LoginView`, and their tests.

- [ ] **Step 1: Review status**

Run:

```bash
git status --short
```

Expected: Chunk 3 files changed.

- [ ] **Step 2: Commit**

Run:

```bash
git add apps/admin/src/layouts/AdminShell.tsx apps/admin/src/layouts/AdminShell.test.tsx apps/admin/src/features/auth/LoginView.tsx apps/admin/src/features/auth/LoginView.test.tsx
git commit -m "feat(admin): render grouped router shell"
```

Expected: commit succeeds.

## Chunk 4: Remove Handwritten Routing And Update Docs

### Task 1: Delete Old Routing Files And Fix Imports

**Files:**
- Delete: legacy location subscription helper
- Delete: legacy imperative navigation helper
- Delete: legacy route guard implementation
- Delete: legacy route guard tests
- Delete: legacy flat route registry
- Delete: legacy flat route registry tests
- Modify: any file still importing deleted modules.

- [ ] **Step 1: Search old imports**

Run:

```bash
rg -n "legacy-location-helper|legacy-navigation-helper|legacy-guard|legacy-registry" apps/admin/src
```

Expected before cleanup: any remaining old imports are listed.

- [ ] **Step 2: Delete old files**

Remove the deleted files listed above.

- [ ] **Step 3: Replace remaining imports**

Use the new modules:

- `apps/admin/src/routes/admin-route-registry.tsx`
- `apps/admin/src/routes/route-meta.ts`
- `@tanstack/react-router`

No app source file should import from the legacy location, navigation, guard, or flat registry modules.

- [ ] **Step 4: Verify no old imports remain**

Run:

```bash
rg -n "legacy-location-helper|legacy-navigation-helper|legacy-guard|legacy-registry" apps/admin/src
```

Expected: no output.

### Task 2: Update RBAC Pattern Docs

**Files:**
- Modify: `docs/patterns/admin-rbac-crud-permission-pattern-guide.md`

- [ ] **Step 1: Update route metadata reference**

Replace the current frontend route/menu metadata bullet with:

```text
Frontend route/menu metadata:
`apps/admin/src/routes/admin-route-registry.tsx` or the project-local equivalent
```

Update the example text if it references the old legacy registry filename.

- [ ] **Step 2: Run doc grep**

Run:

```bash
rg -n "legacy-registry|legacy-guard|legacy-navigation-helper|legacy-location-helper" docs apps/admin/src
```

Expected: no stale references except historical notes in the design/plan documents, if intentionally kept.

### Task 3: Full Verification

**Files:**
- No direct edits unless tests reveal issues.

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
pnpm --filter admin test -- src/routes src/layouts/AdminShell.test.tsx src/features/auth/LoginView.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full admin test suite**

Run:

```bash
pnpm --filter admin test
```

Expected: PASS.

- [ ] **Step 3: Run admin lint**

Run:

```bash
pnpm --filter admin lint
```

Expected: PASS.

- [ ] **Step 4: Run admin build**

Run:

```bash
pnpm --filter admin build
```

Expected: PASS.

- [ ] **Step 5: Optional root verification**

If time allows, run:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: PASS or only unrelated pre-existing failures. Document any unrelated failures explicitly.

### Task 4: Final Commit

**Files:**
- Stage cleanup and docs.

- [ ] **Step 1: Review final diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only router/menu migration files and docs are changed.

- [ ] **Step 2: Commit cleanup**

Run:

```bash
git add apps/admin/src docs/patterns/admin-rbac-crud-permission-pattern-guide.md
git commit -m "chore(admin): remove handwritten routing"
```

Expected: commit succeeds.

- [ ] **Step 3: Confirm clean working tree**

Run:

```bash
git status --short
```

Expected: no output.

## Execution Notes

- Use TDD within each task: write/update the failing test first, run it, then implement the smallest change that makes it pass.
- Keep route metadata as the single frontend source of truth. Do not introduce a separate manual menu list.
- Keep backend permissions unchanged. This plan only changes frontend routing/menu architecture.
- Do not preserve compatibility wrappers for old handwritten routing files.
- If TanStack Router API details differ from examples because of the installed version, follow the installed package types and keep behavior aligned with the spec.
- After implementation, public routes (`/login`, `/403`, `/404`) should not render `AdminShell`; protected admin pages should render inside it.
