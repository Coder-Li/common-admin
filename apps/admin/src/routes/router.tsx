import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useMemo, useRef } from 'react'
import { api } from '../app/api-client'
import { useAuthStore } from '../stores/auth-store'
import {
  createAdminRouter,
  type AdminRouter,
  type AdminRouterContext,
} from './router-factory'

export function AdminRouterProvider({
  router,
}: {
  router?: AdminRouter
}) {
  const status = useAuthStore((state) => state.status)
  const permissions = useAuthStore((state) => state.permissions)
  const setSession = useAuthStore((state) => state.setSession)
  const setAnonymous = useAuthStore((state) => state.setAnonymous)
  const refreshStartedRef = useRef(false)
  const activeRouter = useMemo(() => router ?? createAdminRouter(), [router])
  const permissionsKey = permissions.join('\u0000')
  const context = useMemo<AdminRouterContext>(
    () => ({
      auth: {
        status,
        permissions,
      },
    }),
    [status, permissions],
  )

  useEffect(() => {
    if (status !== 'checking' || refreshStartedRef.current) {
      return
    }

    refreshStartedRef.current = true
    void api
      .refresh()
      .then((session) => setSession(session))
      .catch(() => setAnonymous())
  }, [status, setSession, setAnonymous])

  useEffect(() => {
    void activeRouter.invalidate()
  }, [activeRouter, status, permissionsKey])

  return <RouterProvider router={activeRouter} context={context} />
}
