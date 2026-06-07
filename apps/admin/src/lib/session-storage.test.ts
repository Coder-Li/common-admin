import { describe, expect, it } from 'vitest'
import { clearSession, loadSession, saveSession } from './session-storage'
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
    role: 'ADMIN',
  },
}

describe('session storage', () => {
  it('saves and loads an auth session', () => {
    const storage = createStorage()

    saveSession(session, storage)

    expect(loadSession(storage)).toEqual(session)
  })

  it('returns null when stored session JSON is invalid', () => {
    const storage = createStorage()
    storage.setItem('common-admin.session', '{broken')

    expect(loadSession(storage)).toBeNull()
  })

  it('clears an auth session', () => {
    const storage = createStorage()
    saveSession(session, storage)

    clearSession(storage)

    expect(loadSession(storage)).toBeNull()
  })
})
