// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { LOCALE_STORAGE_KEY } from '../../i18n/locale-storage'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { LoginView } from './LoginView'

vi.mock('../../app/api-client', () => ({
  api: {
    login: vi.fn(),
  },
}))

vi.mock('../../app/query-client', () => ({
  clearQueryCache: vi.fn(),
}))

vi.mock('../../lib/navigation', () => ({
  navigateTo: vi.fn(),
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
    <ThemeProvider>
      <I18nProvider>
        <LoginView />
      </I18nProvider>
    </ThemeProvider>,
  )
}

describe('LoginView i18n', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  beforeEach(() => {
    window.localStorage.clear()
    mockBrowserLanguages(['fr-FR', 'en-US'])
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
})
