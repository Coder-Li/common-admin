import { useEffect } from 'react'
import { api } from './app/api-client'
import { LoginView } from './features/auth/LoginView'
import { AdminShell } from './layouts/AdminShell'
import { useLocationPath } from './lib/location-store'
import { navigateTo } from './lib/navigation'
import { resolveRoute } from './lib/route-guard'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { useAuthStore } from './stores/auth-store'

export function AppContent() {
  const status = useAuthStore((state) => state.status)
  const permissions = useAuthStore((state) => state.permissions)
  const setSession = useAuthStore((state) => state.setSession)
  const setAnonymous = useAuthStore((state) => state.setAnonymous)
  const path = useLocationPath()
  const resolution = resolveRoute(path, { status, permissions })

  useEffect(() => {
    if (status !== 'checking') {
      return
    }

    void api
      .refresh()
      .then((session) => setSession(session))
      .catch(() => setAnonymous())
  }, [status, setSession, setAnonymous])

  useEffect(() => {
    if (resolution.redirectTo) {
      navigateTo(resolution.redirectTo, 'replace')
    }
  }, [resolution.redirectTo])

  if (resolution.redirectTo) {
    return null
  }

  if (resolution.status === 'checking') {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-app)] text-sm text-[var(--color-text-muted)]">
        Loading...
      </main>
    )
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
