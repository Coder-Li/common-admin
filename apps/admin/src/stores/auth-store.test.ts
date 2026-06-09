import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './auth-store'
import type { AuthSession } from '../types/auth'

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

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.getState().reset()
  })

  it('stores authenticated user and access token', () => {
    useAuthStore.getState().setSession(session)

    expect(useAuthStore.getState().accessToken).toBe('access-token')
    expect(useAuthStore.getState().user?.email).toBe('admin@example.com')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('exposes roles and permissions from the current session', () => {
    useAuthStore.getState().setSession(session)

    expect(useAuthStore.getState().roles).toEqual([
      { code: 'admin', name: 'Admin' },
    ])
    expect(useAuthStore.getState().permissions).toEqual([
      'user.read',
      'role.read',
    ])
  })

  it('clears session state', () => {
    useAuthStore.getState().setSession(session)

    useAuthStore.getState().reset()

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().roles).toEqual([])
    expect(useAuthStore.getState().permissions).toEqual([])
  })
})
