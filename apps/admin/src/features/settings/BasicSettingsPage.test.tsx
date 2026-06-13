// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { I18nProvider } from '../../i18n/I18nProvider'
import { useAuthStore } from '../../stores/auth-store'
import {
  getBasicSettings,
  getGetBasicSettingsQueryKey,
  updateBasicSettings,
} from '../../generated/api/endpoints/settings/settings'
import { BasicSettingsPage } from './BasicSettingsPage'

vi.mock('../../generated/api/endpoints/settings/settings', () => ({
  getBasicSettings: vi.fn(),
  getGetBasicSettingsQueryKey: vi.fn(() => ['/settings/basic']),
  updateBasicSettings: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const basicSettings = {
  siteName: 'Common Admin',
  siteSubtitle: 'Operations workspace',
  defaultLocale: 'en-US',
  defaultTheme: 'light',
} as const

const apiError = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  statusCode: 500,
  requestId: 'req_settings123',
}

function renderBasicSettingsPage(permissions = ['setting.read', 'setting.update']) {
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
        <BasicSettingsPage />
      </I18nProvider>
    </QueryClientProvider>,
  )

  return { queryClient, ...view }
}

describe('BasicSettingsPage', () => {
  beforeEach(() => {
    vi.mocked(getBasicSettings).mockResolvedValue(basicSettings)
    vi.mocked(updateBasicSettings).mockResolvedValue(basicSettings)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useAuthStore.getState().reset()
  })

  it('renders a loading state', () => {
    vi.mocked(getBasicSettings).mockReturnValue(new Promise(() => undefined))

    renderBasicSettingsPage()

    expect(screen.getByText('Loading basic settings')).toBeInTheDocument()
  })

  it('renders read-only fields without a save action when setting.update is missing', async () => {
    renderBasicSettingsPage(['setting.read'])

    expect(await screen.findByDisplayValue('Common Admin')).toBeDisabled()
    expect(screen.getByDisplayValue('Operations workspace')).toBeDisabled()
    expect(screen.getByLabelText('Default locale')).toBeDisabled()
    expect(screen.getByLabelText('Default theme')).toBeDisabled()
    expect(screen.getByText('You can view these settings but cannot edit them.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Save changes' }),
    ).not.toBeInTheDocument()
  })

  it('allows editing and calls updateBasicSettings when setting.update is granted', async () => {
    const user = userEvent.setup()

    renderBasicSettingsPage()

    await user.clear(await screen.findByLabelText('Site name'))
    await user.type(screen.getByLabelText('Site name'), '  Admin Console  ')
    await user.clear(screen.getByLabelText('Site subtitle'))
    await user.type(screen.getByLabelText('Site subtitle'), '  Internal tools  ')
    await user.selectOptions(screen.getByLabelText('Default locale'), 'zh-CN')
    await user.selectOptions(screen.getByLabelText('Default theme'), 'dark')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateBasicSettings).toHaveBeenCalledWith({
      siteName: 'Admin Console',
      siteSubtitle: 'Internal tools',
      defaultLocale: 'zh-CN',
      defaultTheme: 'dark',
    })
  })

  it('preserves dirty field values when fresh query data arrives', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderBasicSettingsPage()

    await user.clear(await screen.findByLabelText('Site name'))
    await user.type(screen.getByLabelText('Site name'), 'Draft name')

    queryClient.setQueryData(getGetBasicSettingsQueryKey(), {
      ...basicSettings,
      siteName: 'Server refresh name',
      siteSubtitle: 'Updated server subtitle',
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Site name')).toHaveValue('Draft name')
    })
    expect(screen.getByLabelText('Site subtitle')).toHaveValue(
      'Operations workspace',
    )
  })

  it('resets to the saved response and accepts later query data updates after saving', async () => {
    const user = userEvent.setup()
    const savedBasicSettings = {
      siteName: 'Canonical Admin',
      siteSubtitle: 'Canonical workspace',
      defaultLocale: 'zh-CN',
      defaultTheme: 'dark',
    } as const
    vi.mocked(getBasicSettings)
      .mockResolvedValueOnce(basicSettings)
      .mockResolvedValue(savedBasicSettings)
    vi.mocked(updateBasicSettings).mockResolvedValue(savedBasicSettings)
    const { queryClient } = renderBasicSettingsPage()

    await user.clear(await screen.findByLabelText('Site name'))
    await user.type(screen.getByLabelText('Site name'), 'Draft Admin')
    await user.clear(screen.getByLabelText('Site subtitle'))
    await user.type(screen.getByLabelText('Site subtitle'), 'Draft workspace')
    await user.selectOptions(screen.getByLabelText('Default locale'), 'zh-CN')
    await user.selectOptions(screen.getByLabelText('Default theme'), 'dark')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Site name')).toHaveValue('Canonical Admin')
    })
    expect(screen.getByLabelText('Site subtitle')).toHaveValue(
      'Canonical workspace',
    )
    expect(screen.getByLabelText('Default locale')).toHaveValue('zh-CN')
    expect(screen.getByLabelText('Default theme')).toHaveValue('dark')

    queryClient.setQueryData(getGetBasicSettingsQueryKey(), {
      siteName: 'Server refresh admin',
      siteSubtitle: 'Server refresh workspace',
      defaultLocale: 'en-US',
      defaultTheme: 'light',
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Site name')).toHaveValue(
        'Server refresh admin',
      )
    })
    expect(screen.getByLabelText('Site subtitle')).toHaveValue(
      'Server refresh workspace',
    )
    expect(screen.getByLabelText('Default locale')).toHaveValue('en-US')
    expect(screen.getByLabelText('Default theme')).toHaveValue('light')
  })

  it('invalidates the basic settings query and shows a toast after saving', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderBasicSettingsPage()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Basic settings updated')
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGetBasicSettingsQueryKey(),
    })
  })

  it('formats API errors with getErrorMessage', async () => {
    const user = userEvent.setup()
    vi.mocked(updateBasicSettings).mockRejectedValue(apiError)

    renderBasicSettingsPage()

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Something went wrong. Request ID: req_settings123',
      )
    })
    expect(toast.error).not.toHaveBeenCalledWith('Internal server error')
  })
})
