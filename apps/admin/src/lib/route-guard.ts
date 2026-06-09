import {
  findAdminRoute,
  getFirstVisibleRoute,
} from '../routes/admin-routes'
import { canAll } from './permissions'

export interface RouteResolution {
  path: string
  redirectTo: string | null
  status: 'ok' | 'login' | 'forbidden' | 'not_found'
}

interface RouteAuthState {
  isAuthenticated: boolean
  permissions: readonly string[]
}

export function resolveRoute(
  path: string,
  auth: RouteAuthState,
): RouteResolution {
  const firstVisibleRoute = getFirstVisibleRoute(auth.permissions)
  const fallbackPath = firstVisibleRoute?.path ?? '/403'

  if (path === '/') {
    return {
      path,
      redirectTo: auth.isAuthenticated ? fallbackPath : '/login',
      status: auth.isAuthenticated ? 'ok' : 'login',
    }
  }

  if (path === '/login') {
    return {
      path,
      redirectTo: auth.isAuthenticated ? fallbackPath : null,
      status: auth.isAuthenticated ? 'ok' : 'login',
    }
  }

  if (path === '/403') {
    return { path, redirectTo: null, status: 'forbidden' }
  }

  if (path === '/404') {
    return { path, redirectTo: null, status: 'not_found' }
  }

  const route = findAdminRoute(path)
  if (!route) {
    return {
      path,
      redirectTo: auth.isAuthenticated ? '/404' : '/login',
      status: auth.isAuthenticated ? 'not_found' : 'login',
    }
  }

  if (!auth.isAuthenticated) {
    return { path, redirectTo: '/login', status: 'login' }
  }

  if (!canAll(auth.permissions, route.requiredPermissions)) {
    return { path, redirectTo: '/403', status: 'forbidden' }
  }

  return { path, redirectTo: null, status: 'ok' }
}
