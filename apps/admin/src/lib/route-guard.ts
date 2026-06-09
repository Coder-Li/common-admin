import {
  findAdminRoute,
  getFirstVisibleRoute,
} from '../routes/admin-routes'
import { canAll } from './permissions'

export interface RouteResolution {
  path: string
  redirectTo: string | null
  status: 'ok' | 'checking' | 'login' | 'forbidden' | 'not_found'
}

interface RouteAuthState {
  status: 'checking' | 'authenticated' | 'anonymous'
  permissions: readonly string[]
}

export function resolveRoute(
  path: string,
  auth: RouteAuthState,
): RouteResolution {
  const isAuthenticated = auth.status === 'authenticated'
  const firstVisibleRoute = getFirstVisibleRoute(auth.permissions)
  const fallbackPath = firstVisibleRoute?.path ?? '/403'

  if (path === '/') {
    return {
      path,
      redirectTo: isAuthenticated ? fallbackPath : '/login',
      status: isAuthenticated ? 'ok' : 'login',
    }
  }

  if (path === '/login') {
    return {
      path,
      redirectTo: isAuthenticated ? fallbackPath : null,
      status: isAuthenticated ? 'ok' : 'login',
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
      redirectTo: isAuthenticated ? '/404' : '/login',
      status: isAuthenticated ? 'not_found' : 'login',
    }
  }

  if (auth.status === 'checking') {
    return { path, redirectTo: null, status: 'checking' }
  }

  if (!isAuthenticated) {
    return { path, redirectTo: '/login', status: 'login' }
  }

  if (!canAll(auth.permissions, route.requiredPermissions)) {
    return { path, redirectTo: '/403', status: 'forbidden' }
  }

  return { path, redirectTo: null, status: 'ok' }
}
