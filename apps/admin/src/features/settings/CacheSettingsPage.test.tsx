// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { I18nProvider } from '../../i18n/I18nProvider'
import { useAuthStore } from '../../stores/auth-store'
import { refreshDictionaryCache } from '../../generated/api/endpoints/settings/settings'
import {
  getGetDictionaryOptionsMapQueryKey,
  getGetDictionaryOptionsQueryKey,
} from '../../generated/api/endpoints/dictionaries/dictionaries'
import { CacheSettingsPage } from './CacheSettingsPage'

vi.mock('../../generated/api/endpoints/settings/settings', () => ({
  refreshDictionaryCache: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

function renderCacheSettingsPage(permissions = ['setting.read', 'setting.update']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  useAuthStore.getState().setSession({
    accessToken: 'access-token',
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      roles: [{ code: 'admin', name: 'Admin' }],
      permissions,
    },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <CacheSettingsPage />
      </I18nProvider>
    </QueryClientProvider>,
  )

  return { queryClient, ...view }
}

describe('CacheSettingsPage', () => {
  beforeEach(() => {
    vi.mocked(refreshDictionaryCache).mockResolvedValue({
      refreshedAt: '2026-06-13T00:00:00.000Z',
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useAuthStore.getState().reset()
  })

  it('renders a disabled refresh action for read-only users', () => {
    renderCacheSettingsPage(['setting.read'])

    expect(
      screen.getByRole('button', { name: 'Refresh dictionary cache' }),
    ).toBeDisabled()
    expect(
      screen.getByText('You can view cache maintenance but cannot run it.'),
    ).toBeInTheDocument()
  })

  it('calls refreshDictionaryCache for users with setting.update', async () => {
    const user = userEvent.setup()

    renderCacheSettingsPage()

    await user.click(
      screen.getByRole('button', { name: 'Refresh dictionary cache' }),
    )

    await waitFor(() => {
      expect(refreshDictionaryCache).toHaveBeenCalledWith()
    })
  })

  it('invalidates dictionary option query families and shows a toast on success', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderCacheSettingsPage()

    queryClient.setQueryData(getGetDictionaryOptionsQueryKey('status'), [
      { label: 'Active', value: 'active' },
    ])
    queryClient.setQueryData(
      getGetDictionaryOptionsMapQueryKey({ types: ['status', 'role'] }),
      {
        status: [{ label: 'Active', value: 'active' }],
        role: [{ label: 'Admin', value: 'admin' }],
      },
    )

    await user.click(
      screen.getByRole('button', { name: 'Refresh dictionary cache' }),
    )

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Dictionary cache refreshed',
      )
    })
    expect(
      queryClient.getQueryState(getGetDictionaryOptionsQueryKey('status'))
        ?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(
        getGetDictionaryOptionsMapQueryKey({ types: ['status', 'role'] }),
      )?.isInvalidated,
    ).toBe(true)
  })
})
