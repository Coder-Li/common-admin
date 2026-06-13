import { useMemo, type ReactNode } from 'react'
import { isSupportedLocale, type Locale } from '../../i18n/messages'
import { isTheme, type Theme } from '../../theme/theme-storage'
import { useBasicSettingsQuery } from './settings-query'
import {
  AppSettingsContext,
  type AppSettingsContextValue,
} from './useAppSettings'

interface AppSettingsProviderProps {
  children: ReactNode
}

function resolveDefaultLocale(value: string | null | undefined): Locale | null {
  const candidate = value ?? null

  return isSupportedLocale(candidate) ? candidate : null
}

function resolveDefaultTheme(value: string | null | undefined): Theme | null {
  const candidate = value ?? null

  return isTheme(candidate) ? candidate : null
}

export function AppSettingsProvider({ children }: AppSettingsProviderProps) {
  const settingsQuery = useBasicSettingsQuery()
  const basicSettings = settingsQuery.data ?? null

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      basicSettings,
      defaultLocale: resolveDefaultLocale(basicSettings?.defaultLocale),
      defaultTheme: resolveDefaultTheme(basicSettings?.defaultTheme),
      isLoading: settingsQuery.isLoading,
      isError: settingsQuery.isError,
      error: settingsQuery.error instanceof Error ? settingsQuery.error : null,
    }),
    [
      basicSettings,
      settingsQuery.error,
      settingsQuery.isError,
      settingsQuery.isLoading,
    ],
  )

  return <AppSettingsContext value={value}>{children}</AppSettingsContext>
}
