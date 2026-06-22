// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { clearQueryCache } from '../app/query-client'
import { changePassword, logout } from '../generated/api/endpoints/auth/auth'
import { getBasicSettings } from '../generated/api/endpoints/settings/settings'
import { getCurrentUser } from '../generated/api/endpoints/users/users'
import { I18nProvider } from '../i18n/I18nProvider'
import { LOCALE_STORAGE_KEY } from '../i18n/locale-storage'
import { AdminRouterProvider } from '../routes/router'
import { createAdminRouter } from '../routes/router-factory'
import { useAuthStore } from '../stores/auth-store'
import { ThemeProvider } from '../theme/ThemeProvider'
import type { UserProfile } from '../types/auth'

const user: UserProfile = {
  id: 'user-1',
  email: 'admin@example.com',
  username: 'admin',
  firstName: 'Admin',
  lastName: 'User',
  roles: [{ code: 'admin', name: 'Admin' }],
  permissions: [
    'dashboard.view',
    'user.read',
    'role.read',
    'department.read',
    'position.read',
    'dictionary.read',
    'file.read',
    'audit_log.read',
    'setting.read',
  ],
}

const apiError = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  statusCode: 500,
  requestId: 'req_test123',
}

function currentUserResponse(
  permissions = user.permissions,
) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    permissions,
  } as Awaited<ReturnType<typeof getCurrentUser>> & {
    permissions: string[]
  }
}

vi.mock('../generated/api/endpoints/auth/auth', () => ({
  changePassword: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
}))

vi.mock('../generated/api/endpoints/users/users', () => ({
  getCurrentUser: vi.fn(async () => currentUserResponse()),
  getListUsersQueryKey: vi.fn((params?: unknown) =>
    params ? ['/users', params] : ['/users'],
  ),
}))

vi.mock('../generated/api/endpoints/settings/settings', () => ({
  getBasicSettings: vi.fn(async () => ({
    siteName: 'Acme Console',
    siteSubtitle: 'Operations cockpit',
  })),
  getGetBasicSettingsQueryKey: vi.fn(() => ['/settings/basic']),
}))

vi.mock('../app/query-client', () => ({
  clearQueryCache: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('../features/files/FilesPage', () => ({
  FilesPage: () => <div>Files page content</div>,
}))

vi.mock('../features/audit-logs/AuditLogsPage', () => ({
  AuditLogsPage: () => <div>Audit logs page content</div>,
}))

vi.mock('../features/session-management/SessionManagementPage', () => ({
  SessionManagementPage: () => <div>Session management page content</div>,
}))

vi.mock('../features/departments/DepartmentsPage', () => ({
  DepartmentsPage: () => <div>Departments page content</div>,
}))

vi.mock('../features/positions/PositionsPage', () => ({
  PositionsPage: () => <div>Positions page content</div>,
}))

function mockBrowserLanguages(languages: readonly string[]) {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: languages,
  })
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: languages[0] ?? '',
  })
}

function renderAdminShell(
  path = '/dashboard',
  permissions = user.permissions,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  useAuthStore.getState().setSession({
    accessToken: 'access-token',
    user: { ...user, permissions },
  })
  vi.mocked(getCurrentUser).mockResolvedValue(currentUserResponse(permissions))
  const router = createAdminRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  return {
    router,
    ...render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AdminRouterProvider router={router} />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>,
    ),
  }
}

describe('AdminShell i18n', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    useAuthStore.getState().reset()
  })

  beforeEach(() => {
    window.scrollTo = vi.fn()
    window.localStorage.clear()
    mockBrowserLanguages(['en-US'])
    vi.mocked(changePassword).mockReset()
    vi.mocked(changePassword).mockResolvedValue(undefined)
    vi.mocked(logout).mockReset()
    vi.mocked(logout).mockResolvedValue(undefined)
    vi.mocked(getCurrentUser).mockReset()
    vi.mocked(getCurrentUser).mockResolvedValue(currentUserResponse())
    vi.mocked(getBasicSettings).mockReset()
    vi.mocked(getBasicSettings).mockResolvedValue({
      siteName: 'Acme Console',
      siteSubtitle: 'Operations cockpit',
      defaultLocale: 'en-US',
      defaultTheme: 'light',
    })
    vi.mocked(clearQueryCache).mockReset()
    vi.mocked(toast.error).mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it('uses the basic settings site name and subtitle for branding', async () => {
    renderAdminShell()

    expect(await screen.findByText('Acme Console')).toBeInTheDocument()
    expect(screen.getByText('Operations cockpit')).toBeInTheDocument()
  })

  it('falls back to default branding when the basic settings query fails', async () => {
    vi.mocked(getBasicSettings).mockRejectedValueOnce(new Error('settings failed'))

    renderAdminShell()

    expect(await screen.findByText('Common Admin')).toBeInTheDocument()
    expect(screen.getByText('Starter template')).toBeInTheDocument()
  })

  it('renders the shell while basic settings are loading', async () => {
    vi.mocked(getBasicSettings).mockReturnValueOnce(new Promise(() => undefined))

    renderAdminShell()

    expect(await screen.findByTestId('nav-group-workspace')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Common Admin')).toBeInTheDocument()
    expect(screen.getByText('Starter template')).toBeInTheDocument()
  })

  it('renders English shell and dashboard copy by default', async () => {
    renderAdminShell()

    expect(
      await screen.findByRole('button', { name: 'Switch to dark theme' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getByText('Workspace / Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Starter template')).toBeInTheDocument()
    expect(screen.getByText('Current user')).toBeInTheDocument()
    expect(screen.getByText('Next slice')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('renders project links before the theme switcher', async () => {
    renderAdminShell()

    const githubLink = await screen.findByRole('link', { name: 'GitHub' })
    const docsLink = screen.getByRole('link', { name: 'Docs' })
    const themeSwitcher = screen.getByRole('button', {
      name: 'Switch to dark theme',
    })

    expect(githubLink).toHaveAttribute(
      'href',
      'https://github.com/Coder-Li/common-admin',
    )
    expect(docsLink).toHaveAttribute(
      'href',
      'https://coder-li.github.io/common-admin/introduction/',
    )
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(docsLink).toHaveAttribute('target', '_blank')
    expect(githubLink).toHaveAttribute('rel', 'noreferrer')
    expect(docsLink).toHaveAttribute('rel', 'noreferrer')
    expect(githubLink.compareDocumentPosition(themeSwitcher)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(docsLink.compareDocumentPosition(themeSwitcher)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('renders Chinese shell and dashboard copy from a saved locale', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')

    renderAdminShell()

    expect((await screen.findAllByText('仪表盘')).length).toBeGreaterThan(0)
    expect(screen.getByText('工作台 / 仪表盘')).toBeInTheDocument()
    expect(screen.getByText('启动模板')).toBeInTheDocument()
    expect(screen.getByText('当前用户')).toBeInTheDocument()
    expect(screen.getByText('下一步')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /退出登录/ })).toBeInTheDocument()
  })

  it('renders the Files nav item on desktop and mobile', async () => {
    renderAdminShell('/files')

    expect(await screen.findByTestId('nav-group-workspace')).toHaveTextContent(
      'Workspace',
    )
    expect(screen.getByTestId('nav-group-system')).toHaveTextContent('System')
    expect(screen.getByTestId('nav-group-resources')).toHaveTextContent(
      'Resources',
    )
    expect(screen.getByTestId('nav-files')).toHaveTextContent('Files')
    expect(screen.getByTestId('mobile-nav-files')).toHaveTextContent('Files')
  })

  it('renders the Audit Logs nav item when audit log read permission is present', async () => {
    renderAdminShell('/audit-logs', ['audit_log.read'])

    expect(await screen.findByTestId('nav-audit-logs')).toHaveTextContent(
      'Audit Logs',
    )
    expect(screen.getByTestId('mobile-nav-audit-logs')).toHaveTextContent(
      'Audit Logs',
    )
  })

  it('renders the Online Sessions nav item when user session read permission is present', async () => {
    renderAdminShell('/session-management', ['user_session.read'])

    expect(
      await screen.findByTestId('nav-session-management'),
    ).toHaveTextContent('Online Sessions')
    expect(screen.getByTestId('mobile-nav-session-management')).toHaveTextContent(
      'Online Sessions',
    )
  })

  it('renders organization nav items when read permissions are present', async () => {
    renderAdminShell('/departments', ['department.read', 'position.read'])

    expect(await screen.findByTestId('nav-departments')).toHaveTextContent(
      'Departments',
    )
    expect(screen.getByTestId('mobile-nav-departments')).toHaveTextContent(
      'Departments',
    )
    expect(screen.getByTestId('nav-positions')).toHaveTextContent('Positions')
    expect(screen.getByTestId('mobile-nav-positions')).toHaveTextContent(
      'Positions',
    )
  })

  it('renders FilesPage for the files route', async () => {
    renderAdminShell('/files')

    expect(await screen.findByText('Resources / Files')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Files' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Files page content')).toBeInTheDocument()
  })

  it('renders AuditLogsPage for the audit logs route', async () => {
    renderAdminShell('/audit-logs', ['audit_log.read'])

    expect(
      await screen.findByText('Observability / Audit Logs'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Audit Logs' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Audit logs page content')).toBeInTheDocument()
  })

  it('renders SessionManagementPage for the session management route', async () => {
    renderAdminShell('/session-management', ['user_session.read'])

    expect(await screen.findByText('System / Online Sessions')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Online Sessions' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Session management page content')).toBeInTheDocument()
  })

  it('renders DepartmentsPage for the departments route', async () => {
    renderAdminShell('/departments', ['department.read'])

    expect(await screen.findByText('System / Departments')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Departments' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Departments page content')).toBeInTheDocument()
  })

  it('renders PositionsPage for the positions route', async () => {
    renderAdminShell('/positions', ['position.read'])

    expect(await screen.findByText('System / Positions')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Positions' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Positions page content')).toBeInTheDocument()
  })

  it('hides Users nav without user read permission', async () => {
    renderAdminShell('/dashboard', ['dashboard.view', 'role.read'])

    expect(await screen.findByTestId('nav-roles')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-users')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mobile-nav-users')).not.toBeInTheDocument()
  })

  it('shows Users nav with user read permission', async () => {
    renderAdminShell('/dashboard', ['dashboard.view', 'user.read'])

    expect(await screen.findByTestId('nav-users')).toHaveTextContent('Users')
    expect(screen.getByTestId('mobile-nav-users')).toHaveTextContent('Users')
  })

  it('includes Roles nav when role read permission is present', async () => {
    renderAdminShell('/roles', ['role.read'])

    expect(await screen.findByTestId('nav-roles')).toHaveTextContent('Roles')
    expect(screen.getByTestId('mobile-nav-roles')).toHaveTextContent('Roles')
  })

  it('ignores malformed current-user responses without replacing the session user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce('<!DOCTYPE html>' as never)

    renderAdminShell('/users', ['user.read'])

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Users' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(getCurrentUser).toHaveBeenCalled()
    })
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'user-1',
      email: 'admin@example.com',
    })
    expect(useAuthStore.getState().permissions).toEqual(['user.read'])
  })

  it('uses permissions returned by the current-user response over stale store permissions', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(
      currentUserResponse(['role.read']),
    )

    const { router } = renderAdminShell('/users', ['user.read'])

    await waitFor(() => {
      expect(getCurrentUser).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(useAuthStore.getState().permissions).toEqual(['role.read'])
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/403')
    })
  })

  it('ignores partial current-user objects without replacing the session user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: 'server-user',
      email: 'server@example.com',
    } as never)

    renderAdminShell('/users', ['user.read'])

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Users' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(getCurrentUser).toHaveBeenCalled()
    })
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'user-1',
      email: 'admin@example.com',
      username: 'admin',
    })
    expect(useAuthStore.getState().permissions).toEqual(['user.read'])
  })

  it('does not render links to unauthorized routes', async () => {
    renderAdminShell('/dashboard', ['dashboard.view', 'file.read'])

    expect(await screen.findByTestId('nav-files')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-departments')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-positions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-audit-logs')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-dictionaries')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument()
  })

  it('logs out through the API before clearing local state and navigating to login', async () => {
    const testUser = userEvent.setup()
    vi.mocked(logout).mockResolvedValueOnce(undefined)

    const { router } = renderAdminShell()

    await testUser.click(
      await screen.findByRole('button', { name: /sign out/i }),
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe('/login')
    expect(logout).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(clearQueryCache).toHaveBeenCalledOnce()
  })

  it('still clears local state and navigates to login when logout API rejects', async () => {
    const testUser = userEvent.setup()
    vi.mocked(logout).mockRejectedValueOnce(new Error('logout failed'))

    const { router } = renderAdminShell()

    await testUser.click(
      await screen.findByRole('button', { name: /sign out/i }),
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe('/login')
    expect(logout).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(clearQueryCache).toHaveBeenCalledOnce()
  })

  it('changes password, clears local state, and navigates to login', async () => {
    const testUser = userEvent.setup()
    vi.mocked(changePassword).mockResolvedValueOnce(undefined)

    const { router } = renderAdminShell()

    await testUser.click(
      await screen.findByRole('button', { name: /change password/i }),
    )
    await testUser.type(screen.getByLabelText('Current password'), 'OldPass123!')
    await testUser.type(screen.getByLabelText('New password'), 'NewPass123!')
    await testUser.click(
      screen.getByRole('button', { name: /^change password$/i }),
    )

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe('/login')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(clearQueryCache).toHaveBeenCalledOnce()
  })

  it('shows a shared API error when change password fails', async () => {
    const testUser = userEvent.setup()
    vi.mocked(changePassword).mockRejectedValueOnce(apiError)

    const { router } = renderAdminShell()

    await testUser.click(
      await screen.findByRole('button', { name: /change password/i }),
    )
    await testUser.type(screen.getByLabelText('Current password'), 'OldPass123!')
    await testUser.type(screen.getByLabelText('New password'), 'NewPass123!')
    await testUser.click(
      screen.getByRole('button', { name: /^change password$/i }),
    )

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      })
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Something went wrong. Request ID: req_test123',
      )
    })
    expect(toast.error).not.toHaveBeenCalledWith('Internal server error')
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(clearQueryCache).not.toHaveBeenCalled()
  })
})
