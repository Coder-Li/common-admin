const protectedPaths = new Set([
  '/dashboard',
  '/users',
  '/dictionaries',
  '/files',
  '/settings',
])

export interface RouteResolution {
  path: string
  redirectTo: string | null
}

export function resolveRoute(
  path: string,
  isAuthenticated: boolean,
): RouteResolution {
  if (path === '/') {
    return {
      path,
      redirectTo: isAuthenticated ? '/dashboard' : '/login',
    }
  }

  if (path === '/login' && isAuthenticated) {
    return { path, redirectTo: '/dashboard' }
  }

  if (protectedPaths.has(path) && !isAuthenticated) {
    return { path, redirectTo: '/login' }
  }

  if (!protectedPaths.has(path) && path !== '/login') {
    return {
      path,
      redirectTo: isAuthenticated ? '/dashboard' : '/login',
    }
  }

  return { path, redirectTo: null }
}
