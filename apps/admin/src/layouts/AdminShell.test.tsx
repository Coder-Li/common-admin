// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { LOCALE_STORAGE_KEY } from '../i18n/locale-storage'
import { useAuthStore } from '../stores/auth-store'
import type { UserProfile } from '../types/auth'
import { AdminShell } from './AdminShell'

const user: UserProfile = {
  id: 'user-1',
  email: 'admin@example.com',
  username: 'admin',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN',
}

vi.mock('../app/api-client', () => ({
  api: {
    me: vi.fn(async () => user),
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

function renderAdminShell(currentPath = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  useAuthStore.getState().setSession({
    accessToken: 'access-token',
    user,
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AdminShell currentPath={currentPath} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('AdminShell i18n', () => {
  afterEach(() => {
    cleanup()
    useAuthStore.getState().reset()
  })

  beforeEach(() => {
    window.localStorage.clear()
    mockBrowserLanguages(['en-US'])
  })

  it('renders English shell and dashboard copy by default', () => {
    renderAdminShell()

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
})
