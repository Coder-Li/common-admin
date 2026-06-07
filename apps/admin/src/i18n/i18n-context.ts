import { createContext } from 'react'
import type { Locale, MessageKey, TranslationValues } from './messages'

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, values?: TranslationValues) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)
