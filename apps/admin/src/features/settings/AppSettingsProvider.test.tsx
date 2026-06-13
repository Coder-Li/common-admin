// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCALE_STORAGE_KEY } from '../../i18n/locale-storage'
import { THEME_STORAGE_KEY } from '../../theme/theme-storage'
import { AppSettingsProvider } from './AppSettingsProvider'
import { useAppSettings } from './useAppSettings'
import { getBasicSettings } from '../../generated/api/endpoints/settings/settings'

vi.mock('../../generated/api/endpoints/settings/settings', () => ({
  getBasicSettings: vi.fn(),
  getGetBasicSettingsQueryKey: vi.fn(() => ['/settings/basic']),
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function Probe() {
  const { defaultLocale, defaultTheme } = useAppSettings()

  return (
    <div>
      {defaultLocale} / {defaultTheme}
    </div>
  )
}

describe('AppSettingsProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.mocked(getBasicSettings).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('provides backend defaults without persisting them', async () => {
    const queryClient = createQueryClient()
    vi.mocked(getBasicSettings).mockResolvedValue({
      siteName: 'Admin',
      siteSubtitle: 'Console',
      defaultLocale: 'en-US',
      defaultTheme: 'dark',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AppSettingsProvider>
          <Probe />
        </AppSettingsProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('en-US / dark')).toBeInTheDocument()
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})
