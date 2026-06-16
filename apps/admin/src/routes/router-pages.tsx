import { useIsFetching } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { Suspense } from 'react'
import { LoginView } from '../features/auth/LoginView'
import { AdminShell } from '../layouts/AdminShell'
import { findAdminRouteByPath } from './admin-route-registry'
import { useAuthStore } from '../stores/auth-store'

export function AuthLoadingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-app)] text-sm text-[var(--color-text-muted)]">
      Loading...
    </main>
  )
}

export function RootRoutePage() {
  const status = useAuthStore((state) => state.status)

  if (status === 'checking') {
    return <AuthLoadingPage />
  }

  return <Outlet />
}

export function LoginRoutePage() {
  const status = useAuthStore((state) => state.status)

  if (status === 'checking') {
    return <AuthLoadingPage />
  }

  return <LoginView />
}

export function AdminShellRoutePage() {
  const status = useAuthStore((state) => state.status)

  if (status === 'checking') {
    return <AuthLoadingPage />
  }

  return <AdminShell />
}

export function AdminRoutePage({ path }: { path: string }) {
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const isLoading = useIsFetching({ queryKey: ['me'] }) > 0
  const route = findAdminRouteByPath(path)
  const PageComponent = route?.component

  if (status === 'checking') {
    return <AuthLoadingPage />
  }

  return PageComponent ? (
    <Suspense fallback={<AuthLoadingPage />}>
      <PageComponent isLoading={isLoading} user={user} />
    </Suspense>
  ) : null
}
