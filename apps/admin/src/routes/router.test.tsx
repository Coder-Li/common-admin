// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../app/api-client'
import { apiRefreshCoordinator } from '../app/api-mutator'
import { I18nProvider } from '../i18n/I18nProvider'
import { useAuthStore } from '../stores/auth-store'
import { ThemeProvider } from '../theme/ThemeProvider'
import type { AuthSession, AuthStatus } from '../types/auth'
import { createAdminRouter } from './router-factory'
import { AdminRouterProvider } from './router'

vi.mock('../app/api-client', () => ({
  api: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
  },
}))

vi.mock('../app/api-mutator', () => ({
  apiMutator: vi.fn(),
  apiRefreshCoordinator: {
    refresh: vi.fn(),
  },
}))

vi.mock('../app/query-client', () => ({
  clearQueryCache: vi.fn(),
}))

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
      'permission.read',
      'dictionary.read',
      'file.read',
      'audit_log.read',
      'setting.read',
    ],
  },
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

function setAuthState(
  status: AuthStatus,
  permissions: readonly string[] = [],
  activeSession: AuthSession | null = null,
) {
  useAuthStore.setState({
    status,
    accessToken: activeSession?.accessToken ?? null,
    user: activeSession?.user ?? null,
    roles: activeSession?.user.roles ?? [],
    permissions: [...permissions],
    isAuthenticated: status === 'authenticated',
  })
}

function renderRouter({
  path,
  status = 'anonymous',
  permissions = [],
  activeSession = null,
}: {
  path: string
  status?: AuthStatus
  permissions?: readonly string[]
  activeSession?: AuthSession | null
}) {
  setAuthState(status, permissions, activeSession)
  const router = createAdminRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  render(
    <TestProviders>
      <AdminRouterProvider router={router} />
    </TestProviders>,
  )

  return router
}

describe('admin router guards', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    vi.mocked(api.login).mockReset()
    vi.mocked(api.logout).mockReset()
    vi.mocked(api.me).mockReset()
    vi.mocked(api.refresh).mockReset()
    vi.mocked(apiRefreshCoordinator.refresh).mockReset()
    vi.mocked(api.me).mockResolvedValue(session.user)
    useAuthStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('renders loading for / while auth is checking', async () => {
    vi.mocked(apiRefreshCoordinator.refresh).mockReturnValue(
      new Promise(() => undefined),
    )

    renderRouter({ path: '/', status: 'checking' })

    expect(await screen.findByText('Loading...')).toBeInTheDocument()
  })

  it('renders loading for /login while auth is checking', async () => {
    vi.mocked(apiRefreshCoordinator.refresh).mockReturnValue(
      new Promise(() => undefined),
    )

    renderRouter({ path: '/login', status: 'checking' })

    expect(await screen.findByText('Loading...')).toBeInTheDocument()
  })

  it('redirects anonymous users from / to /login', async () => {
    const router = renderRouter({ path: '/' })

    expect(await screen.findByText('Sign in to continue')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('redirects authenticated users from /login to the first accessible route', async () => {
    const router = renderRouter({
      path: '/login',
      status: 'authenticated',
      permissions: ['user.read'],
      activeSession: {
        ...session,
        user: { ...session.user, permissions: ['user.read'] },
      },
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Users' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/users')
  })

  it('redirects anonymous users from protected routes to /login', async () => {
    const router = renderRouter({ path: '/dashboard' })

    expect(await screen.findByText('Sign in to continue')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('redirects authenticated users without route permission to /403', async () => {
    const router = renderRouter({
      path: '/dashboard',
      status: 'authenticated',
      permissions: ['user.read'],
      activeSession: {
        ...session,
        user: { ...session.user, permissions: ['user.read'] },
      },
    })

    expect(await screen.findByText('No permission')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/403')
  })

  it('keeps unknown URLs and renders the not-found page', async () => {
    const router = renderRouter({
      path: '/missing',
      status: 'authenticated',
      permissions: ['dashboard.view'],
      activeSession: {
        ...session,
        user: { ...session.user, permissions: ['dashboard.view'] },
      },
    })

    expect(await screen.findByText('Page not found')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/missing')
  })

  it('invalidates the router when auth status or permissions change', async () => {
    const router = renderRouter({ path: '/login' })
    const invalidate = vi.spyOn(router, 'invalidate')

    useAuthStore.setState({
      status: 'authenticated',
      permissions: ['dashboard.view'],
      isAuthenticated: true,
    })

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalled()
    })
  })
})

describe('admin router startup refresh', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    vi.mocked(api.login).mockReset()
    vi.mocked(api.logout).mockReset()
    vi.mocked(api.me).mockReset()
    vi.mocked(api.refresh).mockReset()
    vi.mocked(apiRefreshCoordinator.refresh).mockReset()
    vi.mocked(api.me).mockResolvedValue(session.user)
    useAuthStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('runs refresh while auth is checking', async () => {
    vi.mocked(apiRefreshCoordinator.refresh).mockReturnValue(
      new Promise(() => undefined),
    )

    renderRouter({ path: '/dashboard', status: 'checking' })

    await waitFor(() => {
      expect(apiRefreshCoordinator.refresh).toHaveBeenCalledTimes(1)
    })
  })

  it('stores a successful refresh session and reaches the protected route', async () => {
    vi.mocked(apiRefreshCoordinator.refresh).mockImplementation(async () => {
      useAuthStore.getState().setSession(session)
      return session
    })

    renderRouter({ path: '/dashboard', status: 'checking' })

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(useAuthStore.getState().user?.email).toBe('admin@example.com')
  })

  it('marks anonymous after a failed refresh and reaches /login', async () => {
    vi.mocked(apiRefreshCoordinator.refresh).mockImplementation(async () => {
      useAuthStore.getState().setAnonymous()
      throw new Error('expired')
    })
    const router = renderRouter({ path: '/dashboard', status: 'checking' })

    expect(await screen.findByText('Sign in to continue')).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(router.state.location.pathname).toBe('/login')
  })
})
