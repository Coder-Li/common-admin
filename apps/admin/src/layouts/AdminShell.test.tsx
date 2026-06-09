// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { LOCALE_STORAGE_KEY } from '../i18n/locale-storage'
import { useAuthStore } from '../stores/auth-store'
import { ThemeProvider } from '../theme/ThemeProvider'
import type { UserProfile } from '../types/auth'
import { AdminShell } from './AdminShell'

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
    'setting.read',
  ],
}

vi.mock('../app/api-client', () => ({
  api: {
    me: vi.fn(async () => user),
  },
}))

vi.mock('../features/files/FilesPage', () => ({
  FilesPage: () => <div>Files page content</div>,
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
  currentPath = '/dashboard',
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

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AdminShell currentPath={currentPath} />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('AdminShell i18n', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    useAuthStore.getState().reset()
  })

  beforeEach(() => {
    window.localStorage.clear()
    mockBrowserLanguages(['en-US'])
  })

  it('renders English shell and dashboard copy by default', () => {
    renderAdminShell()

    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getByText('API connection is active')).toBeInTheDocument()
    expect(screen.getByText('Starter template')).toBeInTheDocument()
    expect(screen.getByText('Current user')).toBeInTheDocument()
    expect(screen.getByText('Next slice')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('renders Chinese shell and dashboard copy from a saved locale', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')

    renderAdminShell()

    expect(screen.getAllByText('仪表盘').length).toBeGreaterThan(0)
    expect(screen.getByText('API 连接正常')).toBeInTheDocument()
    expect(screen.getByText('启动模板')).toBeInTheDocument()
    expect(screen.getByText('当前用户')).toBeInTheDocument()
    expect(screen.getByText('下一步')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /退出登录/ })).toBeInTheDocument()
  })

  it('renders the Files nav item on desktop and mobile', () => {
    renderAdminShell('/files')

    expect(screen.getByTestId('nav-files')).toHaveTextContent('Files')
    expect(screen.getByTestId('mobile-nav-files')).toHaveTextContent('Files')
  })

  it('renders FilesPage for the files route', () => {
    renderAdminShell('/files')

    expect(screen.getByText('Files page content')).toBeInTheDocument()
  })

  it('hides Users nav without user read permission', () => {
    renderAdminShell('/dashboard', ['dashboard.view', 'role.read'])

    expect(screen.queryByTestId('nav-users')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mobile-nav-users')).not.toBeInTheDocument()
  })

  it('shows Users nav with user read permission', () => {
    renderAdminShell('/dashboard', ['dashboard.view', 'user.read'])

    expect(screen.getByTestId('nav-users')).toHaveTextContent('Users')
    expect(screen.getByTestId('mobile-nav-users')).toHaveTextContent('Users')
  })

  it('includes Roles nav when role read permission is present', () => {
    renderAdminShell('/roles', ['role.read'])

    expect(screen.getByTestId('nav-roles')).toHaveTextContent('Roles')
    expect(screen.getByTestId('mobile-nav-roles')).toHaveTextContent('Roles')
  })

  it('does not render links to unauthorized routes', () => {
    renderAdminShell('/dashboard', ['dashboard.view', 'file.read'])

    expect(screen.getByTestId('nav-files')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-dictionaries')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nav-settings')).not.toBeInTheDocument()
  })
})
