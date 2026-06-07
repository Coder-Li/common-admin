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
    expect(post).not.toHaveBeenCalledWith(
      '/auth/login',
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.any(String) }),
      }),
    )
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

  it('lists users with query params and bearer auth', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      },
    })
    const client = createApiClient({
      client: { get },
      getAccessToken: () => 'access-token',
    })

    const query = {
      page: 1,
      pageSize: 20,
      sort: 'createdAt:desc',
      role: 'ADMIN' as const,
    }
    const response = await client.users.list(query)

    expect(get).toHaveBeenCalledWith('/users', {
      params: query,
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(response.items).toEqual([])
  })

  it('creates users with bearer auth', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'editor@example.com',
        username: 'editor',
        firstName: 'Edit',
        lastName: 'Or',
        role: 'STANDARD',
        createdAt: '2026-06-07T00:00:00.000Z',
        updatedAt: '2026-06-07T00:00:00.000Z',
      },
    })
    const client = createApiClient({
      client: { post },
      getAccessToken: () => 'access-token',
    })
    const payload = {
      email: 'editor@example.com',
      username: 'editor',
      firstName: 'Edit',
      lastName: 'Or',
      password: 'Password123!',
      role: 'STANDARD' as const,
    }

    const response = await client.users.create(payload)

    expect(post).toHaveBeenCalledWith('/users', payload, {
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(response.id).toBe('user-1')
  })

  it('updates users with bearer auth', async () => {
    const patch = vi.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'Updated',
        role: 'ADMIN',
        createdAt: '2026-06-07T00:00:00.000Z',
        updatedAt: '2026-06-07T00:00:00.000Z',
      },
    })
    const client = createApiClient({
      client: { patch },
      getAccessToken: () => 'access-token',
    })
    const payload = { lastName: 'Updated' }

    const response = await client.users.update('user-1', payload)

    expect(patch).toHaveBeenCalledWith('/users/user-1', payload, {
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(response.lastName).toBe('Updated')
  })

  it('deletes users with bearer auth', async () => {
    const deleteRequest = vi.fn().mockResolvedValue({ data: undefined })
    const client = createApiClient({
      client: { delete: deleteRequest },
      getAccessToken: () => 'access-token',
    })

    await expect(client.users.delete('user-1')).resolves.toBeUndefined()

    expect(deleteRequest).toHaveBeenCalledWith('/users/user-1', {
      headers: { Authorization: 'Bearer access-token' },
    })
  })
})
