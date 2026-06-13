import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from './app/query-client'
import { AppSettingsProvider } from './features/settings/AppSettingsProvider'
import { useAppSettings } from './features/settings/useAppSettings'
import { I18nProvider } from './i18n/I18nProvider'
import { AdminRouterProvider } from './routes/router'
import { ThemeProvider } from './theme/ThemeProvider'
import { useTheme } from './theme/useTheme'

function ThemedToaster() {
  const { theme } = useTheme()

  return <Toaster theme={theme} />
}

function AppProviders() {
  const { defaultLocale, defaultTheme } = useAppSettings()

  return (
    <ThemeProvider defaultTheme={defaultTheme}>
      <I18nProvider defaultLocale={defaultLocale}>
        <AdminRouterProvider />
        <ThemedToaster />
      </I18nProvider>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AppProviders />
      </AppSettingsProvider>
    </QueryClientProvider>
  )
}
