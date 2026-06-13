// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  getSavedTheme,
  persistTheme,
  resolveInitialTheme,
} from './theme-storage'

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

describe('theme storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockDarkPreference(false)
  })

  it('uses a valid saved theme first', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    expect(resolveInitialTheme()).toBe('dark')
  })

  it('uses a saved theme before a backend default theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    expect(resolveInitialTheme(window.localStorage, 'light')).toBe('dark')
  })

  it('uses a backend default theme when no saved theme exists', () => {
    expect(resolveInitialTheme(window.localStorage, 'dark')).toBe('dark')
  })

  it('ignores invalid saved values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'blue')
    mockDarkPreference(true)

    expect(resolveInitialTheme()).toBe('dark')
  })

  it('uses system dark preference when no saved theme exists', () => {
    mockDarkPreference(true)

    expect(resolveInitialTheme()).toBe('dark')
  })

  it('falls back to light without a saved or dark system theme', () => {
    expect(resolveInitialTheme()).toBe('light')
  })

  it('persists and reads selected themes', () => {
    persistTheme('dark')

    expect(getSavedTheme()).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('keeps resolving when storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('storage unavailable')
      }),
      setItem: vi.fn(() => {
        throw new Error('storage unavailable')
      }),
    }

    expect(resolveInitialTheme(storage)).toBe('light')
    expect(() => persistTheme('dark', storage)).not.toThrow()
  })
})
