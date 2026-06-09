const SESSION_KEY = 'common-admin.session'

interface SessionStorageLike {
  removeItem: (key: string) => unknown
}

function getBrowserStorage(): SessionStorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

export function clearLegacySession(
  storage: SessionStorageLike | null = getBrowserStorage(),
) {
  storage?.removeItem(SESSION_KEY)
}

export function loadSession() {
  return null
}

export function saveSession(
  _session?: unknown,
  storage: SessionStorageLike | null = getBrowserStorage(),
) {
  clearLegacySession(storage)
}

export function clearSession(
  storage: SessionStorageLike | null = getBrowserStorage(),
) {
  clearLegacySession(storage)
}
