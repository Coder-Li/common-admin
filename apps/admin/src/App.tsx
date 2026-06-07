import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AppContent } from './AppContent'
import { queryClient } from './app/query-client'
import { I18nProvider } from './i18n/I18nProvider'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AppContent />
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>
  )
}
