const SESSION_KEY = 'common-admin.session'

interface SessionStorageLike {
  removeItem: (key: string) => unknown
}

function getBrowserStorage(): SessionStorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function clearLegacySession(
  storage: SessionStorageLike | null = getBrowserStorage(),
) {
  try {
    storage?.removeItem(SESSION_KEY)
  } catch {
    // Legacy cleanup is best-effort now that auth state is memory-only.
  }
}

export function loadSession(...args: unknown[]) {
  void args
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
