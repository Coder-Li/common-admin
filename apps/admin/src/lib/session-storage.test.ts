import { describe, expect, it } from 'vitest'
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
})
