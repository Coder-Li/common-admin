export const themes = ['light', 'dark'] as const

export type Theme = (typeof themes)[number]

export const THEME_STORAGE_KEY = 'common-admin.theme'

interface ThemeStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => unknown
}

export function isTheme(value: string | null): value is Theme {
  return themes.includes(value as Theme)
}

function getBrowserStorage(): ThemeStorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

function readSavedTheme(storage: ThemeStorageLike | null) {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function systemPrefersDark() {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    )
  } catch {
    return false
  }
}

export function getSavedTheme(
  storage: ThemeStorageLike | null = getBrowserStorage(),
): Theme | null {
  const savedTheme = readSavedTheme(storage)

  return isTheme(savedTheme) ? savedTheme : null
}

export function resolveInitialTheme(
  storage: ThemeStorageLike | null = getBrowserStorage(),
): Theme {
  return getSavedTheme(storage) ?? (systemPrefersDark() ? 'dark' : 'light')
}

export function persistTheme(
  theme: Theme,
  storage: ThemeStorageLike | null = getBrowserStorage(),
) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Keep theme switching usable when storage is unavailable.
  }
}
