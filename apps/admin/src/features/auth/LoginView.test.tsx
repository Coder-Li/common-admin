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
import { api } from '../../app/api-client'
import { LoginView } from './LoginView'

vi.mock('../../app/api-client', () => ({
  api: {
    login: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
  },
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
    vi.mocked(api.login).mockReset()
    vi.mocked(api.me).mockReset()
    vi.mocked(toast.error).mockReset()
    vi.mocked(toast.success).mockReset()
    useAuthStore.getState().reset()
  })

  it('renders English copy by default for a non-Chinese browser language', () => {
    renderLoginView()

    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sign in to continue')).toBeInTheDocument()
    expect(screen.getByText('Username or email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('switches to Chinese and persists the selected locale', async () => {
    const user = userEvent.setup()
    renderLoginView()

    await user.click(screen.getByRole('button', { name: '中文' }))

    expect(screen.getByText('登录后继续')).toBeInTheDocument()
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
    vi.mocked(api.login).mockResolvedValue(usersOnlySession)
    vi.mocked(api.me).mockResolvedValue(usersOnlySession.user)
    const { router } = renderLoginRouter()

    await user.click(await screen.findByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Users' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/users')
    })
  })

  it('does not report invalid credentials when navigation fails after login succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(api.login).mockResolvedValue(usersOnlySession)
    vi.mocked(api.me).mockResolvedValue(usersOnlySession.user)
    const { router } = renderLoginRouter()
    vi.spyOn(router, 'navigate').mockRejectedValueOnce(new Error('navigation failed'))

    await user.click(await screen.findByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledOnce()
    })
    expect(toast.error).not.toHaveBeenCalledWith('Invalid credentials')
  })
})
