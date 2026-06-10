// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../app/api-client'
import { clearQueryCache } from '../app/query-client'
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
    'dictionary.read',
    'file.read',
    'audit_log.read',
    'setting.read',
  ],
}

vi.mock('../app/api-client', () => ({
  api: {
    me: vi.fn(async () => user),
    logout: vi.fn(async () => undefined),
  },
}))

vi.mock('../app/query-client', () => ({
  clearQueryCache: vi.fn(),
}))

vi.mock('../features/files/FilesPage', () => ({
  FilesPage: () => <div>Files page content</div>,
}))

vi.mock('../features/audit-logs/AuditLogsPage', () => ({
  AuditLogsPage: () => <div>Audit logs page content</div>,
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
  vi.mocked(api.me).mockResolvedValue({ ...user, permissions })
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
    vi.mocked(api.logout).mockReset()
    vi.mocked(api.logout).mockResolvedValue(undefined)
    vi.mocked(clearQueryCache).mockReset()
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

  it('does not render links to unauthorized routes', async () => {
    renderAdminShell('/dashboard', ['dashboard.view', 'file.read'])

    expect(await screen.findByTestId('nav-files')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-audit-logs')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-dictionaries')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument()
  })

  it('logs out through the API before clearing local state and navigating to login', async () => {
    const testUser = userEvent.setup()
    vi.mocked(api.logout).mockResolvedValueOnce(undefined)

    const { router } = renderAdminShell()

    await testUser.click(
      await screen.findByRole('button', { name: /sign out/i }),
    )

    await waitFor(() => {
      expect(screen.getByText('Sign in to continue')).toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe('/login')
    expect(api.logout).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(clearQueryCache).toHaveBeenCalledOnce()
  })

  it('still clears local state and navigates to login when logout API rejects', async () => {
    const testUser = userEvent.setup()
    vi.mocked(api.logout).mockRejectedValueOnce(new Error('logout failed'))

    const { router } = renderAdminShell()

    await testUser.click(
      await screen.findByRole('button', { name: /sign out/i }),
    )

    await waitFor(() => {
      expect(screen.getByText('Sign in to continue')).toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe('/login')
    expect(api.logout).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(clearQueryCache).toHaveBeenCalledOnce()
  })
})
