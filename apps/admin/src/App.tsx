import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from './app/query-client'
import { I18nProvider } from './i18n/I18nProvider'
import { AdminRouterProvider } from './routes/router'
import { ThemeProvider } from './theme/ThemeProvider'
import { useTheme } from './theme/useTheme'

function ThemedToaster() {
  const { theme } = useTheme()

  return <Toaster theme={theme} />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AdminRouterProvider />
          <ThemedToaster />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
