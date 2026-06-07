import { defaultLocale, isSupportedLocale, type Locale } from './messages'

export const LOCALE_STORAGE_KEY = 'common-admin.locale'

interface LocaleStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => unknown
}

interface ResolveInitialLocaleOptions {
  storage?: LocaleStorageLike | null
  languages?: readonly string[]
}

function getBrowserStorage(): LocaleStorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

function getBrowserLanguages() {
  if (typeof navigator === 'undefined') {
    return []
  }

  return navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language].filter(Boolean)
}

function resolveBrowserLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith('zh')
    ? 'zh-CN'
    : defaultLocale
}

function readSavedLocale(storage: LocaleStorageLike | null) {
  try {
    return storage?.getItem(LOCALE_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export function resolveInitialLocale({
  storage = getBrowserStorage(),
  languages = getBrowserLanguages(),
}: ResolveInitialLocaleOptions = {}): Locale {
  const savedLocale = readSavedLocale(storage)

  if (isSupportedLocale(savedLocale)) {
    return savedLocale
  }

  return resolveBrowserLocale(languages)
}

export function persistLocale(
  locale: Locale,
  storage: LocaleStorageLike | null = getBrowserStorage(),
) {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Keep language switching usable when storage is unavailable.
  }
}
