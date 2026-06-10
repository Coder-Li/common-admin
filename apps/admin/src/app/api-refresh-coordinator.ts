import type { AuthSession } from '../types/auth'

interface RefreshCoordinatorOptions {
  refresh: () => Promise<AuthSession>
  setSession: (session: AuthSession) => void
  onUnauthorized: () => void
}

export function createRefreshCoordinator({
  refresh,
  setSession,
  onUnauthorized,
}: RefreshCoordinatorOptions) {
  let refreshPromise: Promise<AuthSession> | null = null

  async function refreshSession() {
    if (!refreshPromise) {
      refreshPromise = refresh()
        .then((session) => {
          setSession(session)
          return session
        })
        .catch((error: unknown) => {
          onUnauthorized()
          throw error
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    return refreshPromise
  }

  return { refresh: refreshSession }
}
