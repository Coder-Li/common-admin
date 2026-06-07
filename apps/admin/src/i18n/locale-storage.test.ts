import { describe, expect, it, vi } from 'vitest'
import {
  LOCALE_STORAGE_KEY,
  persistLocale,
  resolveInitialLocale,
} from './locale-storage'

function createStorage(initialValue?: string) {
  const values = new Map<string, string>()

  if (initialValue) {
    values.set(LOCALE_STORAGE_KEY, initialValue)
  }

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
  }
}

describe('locale storage', () => {
  it('uses a saved supported locale before browser language', () => {
    const storage = createStorage('zh-CN')

    expect(
      resolveInitialLocale({
        storage,
        languages: ['en-US'],
      }),
    ).toBe('zh-CN')
  })

  it('uses Chinese when the browser language starts with zh', () => {
    expect(
      resolveInitialLocale({
        storage: createStorage(),
        languages: ['zh-Hans-CN', 'en-US'],
      }),
    ).toBe('zh-CN')
  })

  it('uses English with empty storage and non-Chinese browser language', () => {
    expect(
      resolveInitialLocale({
        storage: createStorage(),
        languages: ['fr-FR', 'en-US'],
      }),
    ).toBe('en-US')
  })

  it('uses the primary browser language when resolving fallback locale', () => {
    expect(
      resolveInitialLocale({
        storage: createStorage(),
        languages: ['en-US', 'zh-CN'],
      }),
    ).toBe('en-US')
  })

  it('ignores invalid saved locales and falls back to browser language', () => {
    expect(
      resolveInitialLocale({
        storage: createStorage('de-DE'),
        languages: ['zh-CN'],
      }),
    ).toBe('zh-CN')
  })

  it('persists the selected locale', () => {
    const storage = createStorage()

    persistLocale('en-US', storage)

    expect(storage.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'en-US')
  })
})
