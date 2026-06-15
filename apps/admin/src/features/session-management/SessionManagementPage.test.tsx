// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { LOCALE_STORAGE_KEY } from '../../i18n/locale-storage'
import { useAuthStore } from '../../stores/auth-store'
import type { UserSessionListResponseDto } from '../../generated/api/schemas'
import { SessionManagementPage } from './SessionManagementPage'

const userSessionsApiMock = vi.hoisted(() => ({
  getListUserSessionsQueryKey: vi.fn((params?: unknown) =>
    params ? ['/user-sessions', params] : ['/user-sessions'],
  ),
  listUserSessions: vi.fn(),
  revokeUserSession: vi.fn(),
}))

vi.mock(
  '../../generated/api/endpoints/user-sessions/user-sessions',
  () => userSessionsApiMock,
)

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const activeSession = {
  id: 'session-active',
  user: {
    id: 'user-2',
    username: 'alice',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Admin',
  },
  ipAddress: '203.0.113.10',
  userAgent: 'Chrome on macOS',
  deviceSummary: {
    browser: 'Chrome',
    os: 'macOS',
    deviceType: 'Desktop',
  },
  createdAt: '2026-06-14T08:00:00.000Z',
  lastUsedAt: '2026-06-14T08:30:00.000Z',
  expiresAt: '2026-06-15T08:00:00.000Z',
  status: 'active',
  isCurrentSession: false,
} satisfies UserSessionListResponseDto['items'][number]

const currentSession = {
  ...activeSession,
  id: 'session-current',
  user: {
    id: 'current-user',
    username: 'admin',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
  },
  ipAddress: '198.51.100.11',
  isCurrentSession: true,
} satisfies UserSessionListResponseDto['items'][number]

const expiredSession = {
  ...activeSession,
  id: 'session-expired',
  user: {
    id: 'user-3',
    username: 'eve',
    email: 'eve@example.com',
    firstName: 'Eve',
    lastName: 'Expired',
  },
  status: 'expired',
  isCurrentSession: false,
} satisfies UserSessionListResponseDto['items'][number]

const revokedSession = {
  ...activeSession,
  id: 'session-revoked',
  user: {
    id: 'user-4',
    username: 'rob',
    email: 'rob@example.com',
    firstName: 'Rob',
    lastName: 'Revoked',
  },
  revokedAt: '2026-06-14T09:00:00.000Z',
  revokedReason: 'admin_revoked',
  status: 'revoked',
  isCurrentSession: false,
} satisfies UserSessionListResponseDto['items'][number]

function listResponse(
  items: UserSessionListResponseDto['items'],
): UserSessionListResponseDto {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
  }
}

function renderSessionManagementPage(
  permissions = ['user_session.read', 'user_session.revoke'],
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
  useAuthStore.getState().setSession({
    accessToken: 'access-token',
    user: {
      id: 'current-user',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      roles: [{ code: 'admin', name: 'Admin' }],
      permissions,
    },
  })

  return {
    invalidateQueries,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <SessionManagementPage />
        </I18nProvider>
      </QueryClientProvider>,
    ),
  }
}

describe('SessionManagementPage', () => {
  beforeEach(() => {
    userSessionsApiMock.getListUserSessionsQueryKey.mockClear()
    userSessionsApiMock.listUserSessions.mockReset()
    userSessionsApiMock.revokeUserSession.mockReset()
    userSessionsApiMock.listUserSessions.mockResolvedValue(
      listResponse([activeSession, currentSession, expiredSession, revokedSession]),
    )
    userSessionsApiMock.revokeUserSession.mockResolvedValue(undefined)
    vi.mocked(toast.error).mockReset()
    vi.mocked(toast.success).mockReset()
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().reset()
  })

  it('renders session rows with user, status, dates, IP, device, and actions', async () => {
    renderSessionManagementPage()

    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getAllByText('在线').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('已过期').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('已下线').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('203.0.113.10').length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByText('Chrome / macOS / Desktop').length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(3)
    expect(screen.getByRole('button', { name: '强制下线' })).toBeInTheDocument()
    expect(screen.getByText('当前会话')).toBeInTheDocument()
  })

  it('sends status and search filters to the generated list endpoint', async () => {
    const user = userEvent.setup()

    renderSessionManagementPage()
    await screen.findByText('alice@example.com')

    await user.selectOptions(screen.getByLabelText('状态'), 'active')
    await user.type(screen.getByLabelText('搜索用户或邮箱'), 'alice')

    await waitFor(() => {
      expect(userSessionsApiMock.listUserSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
          search: 'alice',
          status: 'active',
        }),
      )
    })
  })

  it('sends IP and date filters to the generated list endpoint', async () => {
    const user = userEvent.setup()

    renderSessionManagementPage()
    await screen.findByText('alice@example.com')

    await user.type(screen.getByLabelText('IP 地址'), '203.0.113')
    await user.type(screen.getByLabelText('开始'), '2026-06-01')
    await user.type(screen.getByLabelText('结束'), '2026-06-14')

    await waitFor(() => {
      expect(userSessionsApiMock.listUserSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          dateFrom: '2026-06-01T00:00:00.000Z',
          dateTo: '2026-06-14T23:59:59.999Z',
          ipAddress: '203.0.113',
          page: 1,
          pageSize: 20,
        }),
      )
    })
  })

  it('does not show revoke actions for current, expired, revoked, or unauthorized rows', async () => {
    renderSessionManagementPage(['user_session.read'])

    await screen.findByText('alice@example.com')

    expect(screen.queryByRole('button', { name: '强制下线' })).toBeNull()
    expect(screen.getByText('当前会话')).toBeInTheDocument()
    expect(screen.getByText('eve@example.com')).toBeInTheDocument()
    expect(screen.getByText('rob@example.com')).toBeInTheDocument()
  })

  it('confirms revoke, calls the generated endpoint, shows success, and invalidates the list', async () => {
    const user = userEvent.setup()
    const { invalidateQueries } = renderSessionManagementPage()

    await screen.findByText('alice@example.com')
    await user.click(screen.getByRole('button', { name: '强制下线' }))

    const dialog = await screen.findByRole('dialog', { name: '确认强制下线' })
    expect(within(dialog).getByText('alice@example.com')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '确认下线' }))

    await waitFor(() => {
      expect(userSessionsApiMock.revokeUserSession).toHaveBeenCalledWith(
        'session-active',
      )
    })
    expect(toast.success).toHaveBeenCalledWith('会话已强制下线')
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['/user-sessions'],
    })
  })

  it('shows an error toast when revoke fails', async () => {
    const user = userEvent.setup()
    userSessionsApiMock.revokeUserSession.mockRejectedValueOnce({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      statusCode: 500,
      requestId: 'req_revoke',
    })

    renderSessionManagementPage()

    await screen.findByText('alice@example.com')
    await user.click(screen.getByRole('button', { name: '强制下线' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: '确认强制下线' }))
        .getByRole('button', { name: '确认下线' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        '出现错误。请求 ID：req_revoke',
      )
    })
  })
})
