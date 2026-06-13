import {
  createBrowserHistory,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router'
import { createElement } from 'react'
import { canAll } from '../lib/permissions'
import { ForbiddenPage } from '../pages/ForbiddenPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import type { AuthStatus } from '../types/auth'
import {
  adminRoutes,
  getFirstAccessibleRoute,
} from './admin-route-registry'
import {
  AdminRoutePage,
  AuthLoadingPage,
  AdminShellRoutePage,
  LoginRoutePage,
  RootRoutePage,
} from './router-pages'

export interface AdminRouterContext {
  auth: {
    status: AuthStatus
    permissions: readonly string[]
  }
}

const checkingContext: AdminRouterContext = {
  auth: {
    status: 'checking',
    permissions: [],
  },
}

function getFirstAccessiblePath(permissions: readonly string[]) {
  return getFirstAccessibleRoute(permissions)?.path ?? '/403'
}

function redirectToFirstAccessibleRoute(permissions: readonly string[]) {
  throw redirect({ to: getFirstAccessiblePath(permissions) })
}

const rootRoute = createRootRouteWithContext<AdminRouterContext>()({
  component: RootRoutePage,
  notFoundComponent: NotFoundPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    if (context.auth.status === 'checking') {
      return
    }

    if (context.auth.status === 'anonymous') {
      throw redirect({ to: '/login' })
    }

    redirectToFirstAccessibleRoute(context.auth.permissions)
  },
  component: AuthLoadingPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: ({ context }) => {
    if (context.auth.status === 'authenticated') {
      redirectToFirstAccessibleRoute(context.auth.permissions)
    }
  },
  component: LoginRoutePage,
})

const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/403',
  component: ForbiddenPage,
})

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/404',
  component: NotFoundPage,
})

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'admin-shell',
  component: AdminShellRoutePage,
})

const protectedRoutes = adminRoutes.map((route) =>
  createRoute({
    getParentRoute: () => shellRoute,
    path: route.path,
    beforeLoad: ({ context }) => {
      if (context.auth.status === 'checking') {
        return
      }

      if (context.auth.status === 'anonymous') {
        throw redirect({ to: '/login' })
      }

      if (!canAll(context.auth.permissions, route.requiredPermissions)) {
        throw redirect({ to: '/403' })
      }

      if (route.path === '/settings') {
        throw redirect({ to: '/settings/basic' })
      }
    },
    component: () => createElement(AdminRoutePage, { path: route.path }),
  }),
)

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  forbiddenRoute,
  notFoundRoute,
  shellRoute.addChildren(protectedRoutes),
])

export function createAdminRouter({
  history,
}: {
  history?: RouterHistory
} = {}) {
  return createRouter({
    routeTree,
    history: history ?? createBrowserHistory(),
    context: checkingContext,
  })
}

export type AdminRouter = ReturnType<typeof createAdminRouter>

export const createTestMemoryHistory = createMemoryHistory
