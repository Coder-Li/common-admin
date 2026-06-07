import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './auth-store'

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.getState().reset()
  })

  it('stores authenticated user and access token', () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    })

    expect(useAuthStore.getState().accessToken).toBe('access-token')
    expect(useAuthStore.getState().user?.email).toBe('admin@example.com')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('clears session state', () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    })

    useAuthStore.getState().reset()

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
