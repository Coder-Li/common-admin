// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { useAuthStore } from '../../stores/auth-store'
import {
  getUploadSettings,
  updateUploadSettings,
} from '../../generated/api/endpoints/settings/settings'
import type { UploadSettingsResponseDto } from '../../generated/api/schemas'
import { UploadSettingsPage } from './UploadSettingsPage'

vi.mock('../../generated/api/endpoints/settings/settings', () => ({
  getGetUploadSettingsQueryKey: vi.fn(() => ['/settings/upload']),
  getUploadSettings: vi.fn(),
  updateUploadSettings: vi.fn(),
}))

const uploadSettings: UploadSettingsResponseDto = {
  maxSizeMb: 8,
  allowedMimeTypes: ['image/png', 'image/jpeg'],
  environmentMaxSizeMb: 10,
  environmentAllowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'application/pdf',
  ],
  storageDriver: 'local',
}

function renderUploadSettingsPage(
  permissions = ['setting.read', 'setting.update'],
) {
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
        <UploadSettingsPage />
      </I18nProvider>
    </QueryClientProvider>,
  )

  return { queryClient, ...view }
}

describe('UploadSettingsPage', () => {
  beforeEach(() => {
    vi.mocked(getUploadSettings).mockResolvedValue(uploadSettings)
    vi.mocked(updateUploadSettings).mockResolvedValue(uploadSettings)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useAuthStore.getState().reset()
  })

  it('renders environment max size, MIME types, and storage driver from getUploadSettings', async () => {
    renderUploadSettingsPage()

    expect(await screen.findByLabelText('Maximum size (MB)')).toHaveValue(8)
    expect(screen.getByText('Environment max size')).toBeInTheDocument()
    expect(screen.getByText('10 MB')).toBeInTheDocument()
    expect(screen.getByText('Environment MIME types')).toBeInTheDocument()
    expect(screen.getByText('image/png, image/jpeg, application/pdf')).toBeInTheDocument()
    expect(screen.getByText('Storage driver')).toBeInTheDocument()
    expect(screen.getByText('local')).toBeInTheDocument()
  })

  it('renders the policy summary and form across the full content width', async () => {
    renderUploadSettingsPage()

    const form = (await screen.findByLabelText('Maximum size (MB)')).closest(
      'form',
    )
    const summary = screen.getByText('Environment max size').parentElement
      ?.parentElement

    expect(summary).toHaveClass('w-full')
    expect(summary).not.toHaveClass('max-w-3xl')
    expect(form).toHaveClass('w-full')
    expect(form).not.toHaveClass('max-w-3xl')
  })

  it('does not submit a max size above the environment maximum', async () => {
    const user = userEvent.setup()

    renderUploadSettingsPage()

    await user.clear(await screen.findByLabelText('Maximum size (MB)'))
    await user.type(screen.getByLabelText('Maximum size (MB)'), '11')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('Maximum size must be 10 MB or less'),
    ).toBeInTheDocument()
    expect(updateUploadSettings).not.toHaveBeenCalled()
  })

  it('does not submit when the selected MIME list is empty', async () => {
    const user = userEvent.setup()

    renderUploadSettingsPage()

    await user.click(await screen.findByLabelText('image/png'))
    await user.click(screen.getByLabelText('image/jpeg'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('Select at least one MIME type'),
    ).toBeInTheDocument()
    expect(updateUploadSettings).not.toHaveBeenCalled()
  })

  it('does not submit MIME types outside the environment allow list', async () => {
    const user = userEvent.setup()
    vi.mocked(getUploadSettings).mockResolvedValue({
      ...uploadSettings,
      allowedMimeTypes: ['image/png', 'text/plain'],
      environmentAllowedMimeTypes: ['image/png'],
    })

    renderUploadSettingsPage()

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(updateUploadSettings).toHaveBeenCalledWith({
        maxSizeMb: 8,
        allowedMimeTypes: ['image/png'],
      })
    })
    expect(screen.queryByLabelText('text/plain')).not.toBeInTheDocument()
  })

  it('renders read-only controls without a save action when setting.update is missing', async () => {
    renderUploadSettingsPage(['setting.read'])

    expect(await screen.findByLabelText('Maximum size (MB)')).toBeDisabled()
    expect(screen.getByLabelText('image/png')).toBeDisabled()
    expect(screen.getByLabelText('image/jpeg')).toBeDisabled()
    expect(screen.getByLabelText('application/pdf')).toBeDisabled()
    expect(screen.getByText('You can view these settings but cannot edit them.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Save changes' }),
    ).not.toBeInTheDocument()
  })

  it('calls updateUploadSettings with selected values when setting.update is granted', async () => {
    const user = userEvent.setup()

    renderUploadSettingsPage()

    await user.clear(await screen.findByLabelText('Maximum size (MB)'))
    await user.type(screen.getByLabelText('Maximum size (MB)'), '9')
    await user.click(screen.getByLabelText('application/pdf'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(updateUploadSettings).toHaveBeenCalledWith({
        maxSizeMb: 9,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
      })
    })
  })

  it('resets to the saved response and accepts later query data updates after saving', async () => {
    const user = userEvent.setup()
    const savedUploadSettings = {
      ...uploadSettings,
      maxSizeMb: 6,
      allowedMimeTypes: ['application/pdf'],
    }
    vi.mocked(getUploadSettings)
      .mockResolvedValueOnce(uploadSettings)
      .mockResolvedValue(savedUploadSettings)
    vi.mocked(updateUploadSettings).mockResolvedValue(savedUploadSettings)
    const { queryClient } = renderUploadSettingsPage()

    await user.clear(await screen.findByLabelText('Maximum size (MB)'))
    await user.type(screen.getByLabelText('Maximum size (MB)'), '9')
    await user.click(screen.getByLabelText('application/pdf'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Maximum size (MB)')).toHaveValue(6)
    })
    expect(screen.getByLabelText('image/png')).not.toBeChecked()
    expect(screen.getByLabelText('image/jpeg')).not.toBeChecked()
    expect(screen.getByLabelText('application/pdf')).toBeChecked()

    queryClient.setQueryData(['/settings/upload'], {
      ...uploadSettings,
      maxSizeMb: 7,
      allowedMimeTypes: ['image/png'],
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Maximum size (MB)')).toHaveValue(7)
    })
    expect(screen.getByLabelText('image/png')).toBeChecked()
    expect(screen.getByLabelText('image/jpeg')).not.toBeChecked()
    expect(screen.getByLabelText('application/pdf')).not.toBeChecked()
  })
})
