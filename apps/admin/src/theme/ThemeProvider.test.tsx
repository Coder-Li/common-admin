// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY } from './theme-storage'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'

function mockDarkPreference(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

function Probe() {
  const { setTheme } = useTheme()

  return (
    <button type="button" onClick={() => setTheme('light')}>
      Set light
    </button>
  )
}

describe('ThemeProvider', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  beforeEach(() => {
    window.localStorage.clear()
    mockDarkPreference(false)
  })

  it('applies light theme by default', () => {
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('applies a saved dark theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('applies a backend default theme before light system preference', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <div />
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('adopts a backend default theme that arrives after initial render', () => {
    const { rerender } = render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    rerender(
      <ThemeProvider defaultTheme="dark">
        <div />
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('does not overwrite a theme changed by the user in this session', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <ThemeProvider defaultTheme="dark">
        <Probe />
      </ThemeProvider>,
    )

    await user.click(document.querySelector('button') as HTMLButtonElement)

    rerender(
      <ThemeProvider defaultTheme="dark">
        <Probe />
      </ThemeProvider>,
    )

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })
})
