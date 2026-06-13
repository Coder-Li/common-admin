// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { AdminRouterProvider } from '../../routes/router'
import { createAdminRouter } from '../../routes/router-factory'
import { I18nProvider } from '../../i18n/I18nProvider'
import { LOCALE_STORAGE_KEY } from '../../i18n/locale-storage'
import { useAuthStore } from '../../stores/auth-store'
import type { AuthSession } from '../../types/auth'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { login } from '../../generated/api/endpoints/auth/auth'
import { getBasicSettings } from '../../generated/api/endpoints/settings/settings'
import { getCurrentUser } from '../../generated/api/endpoints/users/users'
import { LoginView } from './LoginView'

vi.mock('../../generated/api/endpoints/auth/auth', () => ({
  login: vi.fn(),
}))

vi.mock('../../generated/api/endpoints/users/users', () => ({
  getCurrentUser: vi.fn(),
  getListUsersQueryKey: vi.fn((params?: unknown) =>
    params ? ['/users', params] : ['/users'],
  ),
}))

vi.mock('../../generated/api/endpoints/settings/settings', () => ({
  getBasicSettings: vi.fn(async () => ({
    siteName: 'Acme Console',
    siteSubtitle: 'Operations cockpit',
  })),
  getGetBasicSettingsQueryKey: vi.fn(() => ['/settings/basic']),
}))

vi.mock('../../app/query-client', () => ({
  clearQueryCache: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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

function renderLoginView() {
  return render(
    <TestProviders>
      <LoginView />
    </TestProviders>,
  )
}

function renderLoginRouter() {
  const router = createAdminRouter({
    history: createMemoryHistory({ initialEntries: ['/login'] }),
  })

  return {
    router,
    ...render(
      <TestProviders>
        <AdminRouterProvider router={router} />
      </TestProviders>,
    ),
  }
}

function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>{children}</I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const session: AuthSession = {
  accessToken: 'access-token',
  user: {
    id: 'user-1',
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Ada',
    lastName: 'Admin',
    roles: [{ code: 'admin', name: 'Admin' }],
    permissions: [
      'dashboard.view',
      'user.read',
      'role.read',
      'dictionary.read',
      'file.read',
      'setting.read',
    ],
  },
}

const usersOnlySession: AuthSession = {
  ...session,
  user: {
    ...session.user,
    permissions: ['user.read'],
  },
}

const usersOnlyCurrentUser = {
  id: usersOnlySession.user.id,
  email: usersOnlySession.user.email,
  username: usersOnlySession.user.username,
  firstName: usersOnlySession.user.firstName,
  lastName: usersOnlySession.user.lastName,
  roles: usersOnlySession.user.roles,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const apiError = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  statusCode: 500,
  requestId: 'req_test123',
}

const unauthorizedError = {
  code: 'UNAUTHORIZED',
  message: 'Unauthorized',
  statusCode: 401,
  requestId: 'req_login401',
}

describe('LoginView i18n', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  beforeEach(() => {
    window.scrollTo = vi.fn()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/login')
    mockBrowserLanguages(['fr-FR', 'en-US'])
    vi.mocked(login).mockReset()
    vi.mocked(getBasicSettings).mockReset()
    vi.mocked(getBasicSettings).mockResolvedValue({
      siteName: 'Acme Console',
      siteSubtitle: 'Operations cockpit',
      defaultLocale: 'en-US',
      defaultTheme: 'light',
    })
    vi.mocked(getCurrentUser).mockReset()
    vi.mocked(toast.error).mockReset()
    vi.mocked(toast.success).mockReset()
    useAuthStore.getState().reset()
  })

  it('uses the basic settings site name and subtitle for branding', async () => {
    renderLoginView()

    expect(await screen.findByText('Acme Console')).toBeInTheDocument()
    expect(screen.getByText('Operations cockpit')).toBeInTheDocument()
  })

  it('falls back to default branding when the basic settings query fails', async () => {
    vi.mocked(getBasicSettings).mockRejectedValueOnce(new Error('settings failed'))

    renderLoginView()

    expect(await screen.findByText('Common Admin')).toBeInTheDocument()
    expect(screen.getByText('Starter template')).toBeInTheDocument()
  })

  it('renders English copy by default for a non-Chinese browser language', async () => {
    renderLoginView()

    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Operations cockpit')).toBeInTheDocument()
    expect(screen.getByText('Username or email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('switches to Chinese and persists the selected locale', async () => {
    const user = userEvent.setup()
    renderLoginView()

    await user.click(screen.getByRole('button', { name: '中文' }))

    expect(screen.getByText('Operations cockpit')).toBeInTheDocument()
    expect(screen.getByText('用户名或邮箱')).toBeInTheDocument()
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-CN')
  })

  it('toggles the root theme from the login page', async () => {
    const user = userEvent.setup()
    renderLoginView()

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('redirects to the first visible route after login', async () => {
    const user = userEvent.setup()
    vi.mocked(login).mockResolvedValue(usersOnlySession)
    vi.mocked(getCurrentUser).mockResolvedValue(usersOnlyCurrentUser)
    const { router } = renderLoginRouter()

    await user.click(await screen.findByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Users' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/users')
    })
  })

  it('reports shared API errors for non-auth login failures', async () => {
    const user = userEvent.setup()
    vi.mocked(login).mockRejectedValueOnce(apiError)

    renderLoginRouter()

    await user.click(await screen.findByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Something went wrong. Request ID: req_test123',
      )
    })
    expect(toast.error).not.toHaveBeenCalledWith('Invalid username or password')
    expect(toast.error).not.toHaveBeenCalledWith('Internal server error')
  })

  it('reports invalid credentials for auth login failures', async () => {
    const user = userEvent.setup()
    vi.mocked(login).mockRejectedValueOnce(unauthorizedError)

    renderLoginRouter()

    await user.click(await screen.findByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid username or password')
    })
    expect(toast.error).not.toHaveBeenCalledWith(
      'Something went wrong. Request ID: req_login401',
    )
    expect(toast.error).not.toHaveBeenCalledWith('Unauthorized')
  })

  it('does not report invalid credentials when navigation fails after login succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(login).mockResolvedValue(usersOnlySession)
    vi.mocked(getCurrentUser).mockResolvedValue(usersOnlyCurrentUser)
    const { router } = renderLoginRouter()
    vi.spyOn(router, 'navigate').mockRejectedValueOnce(new Error('navigation failed'))

    await user.click(await screen.findByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        usernameOrEmail: 'admin@example.com',
        password: 'Admin123!',
      })
    })
    expect(toast.error).not.toHaveBeenCalledWith('Invalid credentials')
  })
})
