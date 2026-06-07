import { useMemo, useState, type ReactNode } from 'react'
import { persistLocale, resolveInitialLocale } from './locale-storage'
import { messages, type TranslationValues } from './messages'
import { I18nContext, type I18nContextValue } from './i18n-context'

function interpolate(message: string, values: TranslationValues = {}) {
  return message.replace(/\{(\w+)\}/g, (token, key: string) => {
    const value = values[key]
    return value === undefined ? token : String(value)
  })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(resolveInitialLocale)

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale: (nextLocale) => {
        persistLocale(nextLocale)
        setLocaleState(nextLocale)
      },
      t: (key, values) => interpolate(messages[locale][key], values),
    }
  }, [locale])

  return <I18nContext value={value}>{children}</I18nContext>
}
