import type { AuthSession } from '../types/auth'

const SESSION_KEY = 'common-admin.session'

interface SessionStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => unknown
  removeItem: (key: string) => unknown
}

function getBrowserStorage(): SessionStorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

export function loadSession(
  storage: SessionStorageLike | null = getBrowserStorage(),
): AuthSession | null {
  if (!storage) {
    return null
  }

  const value = storage.getItem(SESSION_KEY)
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as AuthSession
  } catch {
    storage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveSession(
  session: AuthSession,
  storage: SessionStorageLike | null = getBrowserStorage(),
) {
  storage?.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(
  storage: SessionStorageLike | null = getBrowserStorage(),
) {
  storage?.removeItem(SESSION_KEY)
}
