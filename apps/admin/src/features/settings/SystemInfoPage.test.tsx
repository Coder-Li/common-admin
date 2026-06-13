// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { useAuthStore } from '../../stores/auth-store'
import { getSystemInfo } from '../../generated/api/endpoints/settings/settings'
import { SystemInfoPage } from './SystemInfoPage'

vi.mock('../../generated/api/endpoints/settings/settings', () => ({
  getGetSystemInfoQueryKey: vi.fn(() => ['/settings/system-info']),
  getSystemInfo: vi.fn(),
}))

const systemInfo = {
  serviceName: 'api',
  appEnv: 'local',
  nodeEnv: 'test',
  logLevel: 'debug',
  storageDriver: 'local',
  uploadMaxSizeMb: 20,
  uploadAllowedMimeTypes: ['image/png', 'application/pdf'],
  databaseUrl: 'postgres://user:password@localhost:5432/app',
  redisUrl: 'redis://localhost:6379',
  jwtAccessTokenSecret: 'super-secret',
  refreshCookieName: 'common_admin_refresh',
  allowedOrigins: ['https://admin.example.com'],
  apiKey: 'secret-api-key',
} as const

function renderSystemInfoPage() {
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
      permissions: ['setting.read'],
    },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SystemInfoPage />
      </I18nProvider>
    </QueryClientProvider>,
  )

  return { queryClient, ...view }
}

describe('SystemInfoPage', () => {
  beforeEach(() => {
    vi.mocked(getSystemInfo).mockResolvedValue(systemInfo)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useAuthStore.getState().reset()
  })

  it('renders service name, environments, log level, storage driver, and upload constraints', async () => {
    renderSystemInfoPage()

    expect(await screen.findByText('Service name')).toBeInTheDocument()
    expect(screen.getByText('api')).toBeInTheDocument()
    expect(screen.getByText('App environment')).toBeInTheDocument()
    expect(screen.getAllByText('local')).toHaveLength(2)
    expect(screen.getByText('Node environment')).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('Log level')).toBeInTheDocument()
    expect(screen.getByText('debug')).toBeInTheDocument()
    expect(screen.getByText('Storage driver')).toBeInTheDocument()
    expect(screen.getByText('Upload max size')).toBeInTheDocument()
    expect(screen.getByText('20 MB')).toBeInTheDocument()
    expect(screen.getByText('Upload MIME types')).toBeInTheDocument()
    expect(screen.getByText('image/png, application/pdf')).toBeInTheDocument()
  })

  it('does not render secret-like fields', async () => {
    renderSystemInfoPage()

    await screen.findByText('Service name')

    const pageText = document.body.textContent ?? ''
    expect(pageText).not.toContain('databaseUrl')
    expect(pageText).not.toContain('postgres://')
    expect(pageText).not.toContain('redisUrl')
    expect(pageText).not.toContain('redis://')
    expect(pageText).not.toContain('jwtAccessTokenSecret')
    expect(pageText).not.toContain('super-secret')
    expect(pageText).not.toContain('refreshCookieName')
    expect(pageText).not.toContain('common_admin_refresh')
    expect(pageText).not.toContain('allowedOrigins')
    expect(pageText).not.toContain('https://admin.example.com')
    expect(pageText).not.toContain('apiKey')
    expect(pageText).not.toContain('secret-api-key')
  })

  it('has no editable form controls', async () => {
    renderSystemInfoPage()

    await screen.findByText('Service name')

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
