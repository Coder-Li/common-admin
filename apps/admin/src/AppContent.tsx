import { useEffect } from 'react'
import { LoginView } from './features/auth/LoginView'
import { AdminShell } from './layouts/AdminShell'
import { useLocationPath } from './lib/location-store'
import { navigateTo } from './lib/navigation'
import { resolveRoute } from './lib/route-guard'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { useAuthStore } from './stores/auth-store'

export function AppContent() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const permissions = useAuthStore((state) => state.permissions)
  const path = useLocationPath()
  const resolution = resolveRoute(path, { isAuthenticated, permissions })

  useEffect(() => {
    if (resolution.redirectTo) {
      navigateTo(resolution.redirectTo, 'replace')
    }
  }, [resolution.redirectTo])

  if (resolution.redirectTo) {
    return null
  }

  if (path === '/login') {
    return <LoginView />
  }

  if (path === '/403') {
    return <ForbiddenPage />
  }

  if (path === '/404') {
    return <NotFoundPage />
  }

  return <AdminShell currentPath={path} />
}
