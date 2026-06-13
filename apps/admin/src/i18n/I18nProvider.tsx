import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { persistLocale, resolveInitialLocale } from './locale-storage'
import { messages, type Locale, type TranslationValues } from './messages'
import { I18nContext, type I18nContextValue } from './i18n-context'

interface I18nProviderProps {
  children: ReactNode
  defaultLocale?: Locale | null
}

function interpolate(message: string, values: TranslationValues = {}) {
  return message.replace(/\{(\w+)\}/g, (token, key: string) => {
    const value = values[key]
    return value === undefined ? token : String(value)
  })
}

export function I18nProvider({
  children,
  defaultLocale = null,
}: I18nProviderProps) {
  const userChangedLocaleRef = useRef(false)
  const [locale, setLocaleState] = useState(() =>
    resolveInitialLocale({ defaultLocale }),
  )

  useEffect(() => {
    if (userChangedLocaleRef.current || !defaultLocale) {
      return
    }

    setLocaleState(resolveInitialLocale({ defaultLocale }))
  }, [defaultLocale])

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale: (nextLocale) => {
        userChangedLocaleRef.current = true
        persistLocale(nextLocale)
        setLocaleState(nextLocale)
      },
      t: (key, values) => interpolate(messages[locale][key], values),
    }
  }, [locale])

  return <I18nContext value={value}>{children}</I18nContext>
}
