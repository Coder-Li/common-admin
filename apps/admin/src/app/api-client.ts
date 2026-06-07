import { createApiClient } from '../lib/api'
import { navigateTo } from '../lib/navigation'
import { useAuthStore } from '../stores/auth-store'
import { clearQueryCache } from './query-client'

export const api = createApiClient({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onUnauthorized: () => {
    useAuthStore.getState().reset()
    clearQueryCache()
    navigateTo('/login', 'replace')
  },
})
