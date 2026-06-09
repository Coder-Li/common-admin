// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    window.localStorage.clear()
  })

  it('initial status is checking', async () => {
    vi.resetModules()
    const { useAuthStore: freshAuthStore } = await import('./auth-store')

    expect(freshAuthStore.getState().status).toBe('checking')
    expect(freshAuthStore.getState().accessToken).toBeNull()
    expect(freshAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('removes legacy common-admin.session on initialization', async () => {
    window.localStorage.setItem('common-admin.session', JSON.stringify(session))
    vi.resetModules()

    const { useAuthStore: freshAuthStore } = await import('./auth-store')

    expect(freshAuthStore.getState().status).toBe('checking')
    expect(window.localStorage.getItem('common-admin.session')).toBeNull()
  })

  it('setSession makes status authenticated and stores token in memory', () => {
    useAuthStore.getState().setSession(session)

    expect(useAuthStore.getState().status).toBe('authenticated')
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

  it('setAnonymous clears token and marks anonymous', () => {
    useAuthStore.getState().setSession(session)

    useAuthStore.getState().setAnonymous()

    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().roles).toEqual([])
    expect(useAuthStore.getState().permissions).toEqual([])
  })

  it('reset clears token and marks anonymous', () => {
    useAuthStore.getState().setSession(session)

    useAuthStore.getState().reset()

    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().roles).toEqual([])
    expect(useAuthStore.getState().permissions).toEqual([])
  })

  it('access token is not written to localStorage', () => {
    useAuthStore.getState().setSession(session)

    expect(window.localStorage.getItem('common-admin.session')).toBeNull()
    expect(JSON.stringify(window.localStorage)).not.toContain('access-token')
  })

  it('legacy common-admin.session is removed', () => {
    window.localStorage.setItem('common-admin.session', JSON.stringify(session))

    useAuthStore.getState().setSession(session)

    expect(window.localStorage.getItem('common-admin.session')).toBeNull()
  })
})
