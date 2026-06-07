import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './api'

describe('api client', () => {
  it('posts login credentials to auth endpoint', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        accessToken: 'access-token',
        user: {
          id: 'user-1',
          email: 'admin@example.com',
          username: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
        },
      },
    })
    const client = createApiClient({ post })

    const response = await client.login({
      usernameOrEmail: 'admin@example.com',
      password: 'Admin123!',
    })

    expect(post).toHaveBeenCalledWith('/auth/login', {
      usernameOrEmail: 'admin@example.com',
      password: 'Admin123!',
    })
    expect(response.accessToken).toBe('access-token')
  })

  it('uses bearer token for current user requests', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    })
    const client = createApiClient({
      client: { get },
      getAccessToken: () => 'access-token',
    })

    const response = await client.me()

    expect(get).toHaveBeenCalledWith('/users/me', {
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(response.email).toBe('admin@example.com')
  })

  it('calls onUnauthorized when a request returns 401', async () => {
    const error = { response: { status: 401 } }
    const get = vi.fn().mockRejectedValue(error)
    const onUnauthorized = vi.fn()
    const client = createApiClient({
      client: { get },
      getAccessToken: () => 'expired-token',
      onUnauthorized,
    })

    await expect(client.me()).rejects.toBe(error)

    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
