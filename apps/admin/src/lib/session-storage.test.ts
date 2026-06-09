import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearLegacySession,
  clearSession,
  loadSession,
  saveSession,
} from './session-storage'
import type { AuthSession } from '../types/auth'

function createStorage() {
  const values = new Map<string, string>()

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

const session: AuthSession = {
  accessToken: 'access-token',
  user: {
    id: 'user-1',
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    roles: [{ code: 'admin', name: 'Admin' }],
    permissions: ['user.read', 'role.read'],
  },
}

describe('session storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not save auth sessions', () => {
    const storage = createStorage()

    saveSession(session, storage)

    expect(loadSession(storage)).toBeNull()
    expect(storage.getItem('common-admin.session')).toBeNull()
  })

  it('removes legacy stored sessions when saving', () => {
    const storage = createStorage()
    storage.setItem('common-admin.session', JSON.stringify(session))

    saveSession(session, storage)

    expect(storage.getItem('common-admin.session')).toBeNull()
  })

  it('always returns null for legacy stored sessions', () => {
    const storage = createStorage()
    storage.setItem('common-admin.session', JSON.stringify(session))

    expect(loadSession(storage)).toBeNull()
  })

  it('clears legacy stored sessions', () => {
    const storage = createStorage()
    storage.setItem('common-admin.session', JSON.stringify(session))

    clearSession(storage)

    expect(storage.getItem('common-admin.session')).toBeNull()
  })

  it('exposes a legacy cleanup helper', () => {
    const storage = createStorage()
    storage.setItem('common-admin.session', JSON.stringify(session))

    clearLegacySession(storage)

    expect(storage.getItem('common-admin.session')).toBeNull()
  })

  it('ignores legacy session removal failures', () => {
    const storage = {
      removeItem: () => {
        throw new Error('storage unavailable')
      },
    }

    expect(() => clearLegacySession(storage)).not.toThrow()
    expect(() => saveSession(session, storage)).not.toThrow()
    expect(() => clearSession(storage)).not.toThrow()
  })

  it('ignores browser storage access failures', () => {
    const restrictedWindow = {}
    Object.defineProperty(restrictedWindow, 'localStorage', {
      get: () => {
        throw new Error('storage access denied')
      },
    })
    vi.stubGlobal('window', restrictedWindow)

    expect(() => clearLegacySession()).not.toThrow()
    expect(() => saveSession(session)).not.toThrow()
    expect(() => clearSession()).not.toThrow()
  })

  it('does not touch storage when loading sessions', () => {
    const storage = {
      removeItem: vi.fn(() => {
        throw new Error('storage unavailable')
      }),
    }

    expect(loadSession()).toBeNull()
    expect(storage.removeItem).not.toHaveBeenCalled()
  })
})
