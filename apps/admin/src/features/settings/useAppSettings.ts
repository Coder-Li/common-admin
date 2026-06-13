import { createContext, useContext } from 'react'
import type { BasicSettingsResponseDto } from '../../generated/api/schemas'
import type { Locale } from '../../i18n/messages'
import type { Theme } from '../../theme/theme-storage'

export interface AppSettingsContextValue {
  basicSettings: BasicSettingsResponseDto | null
  defaultLocale: Locale | null
  defaultTheme: Theme | null
  isLoading: boolean
  isError: boolean
  error: Error | null
}

export const AppSettingsContext =
  createContext<AppSettingsContextValue | null>(null)

export function useAppSettings() {
  const context = useContext(AppSettingsContext)

  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider')
  }

  return context
}
