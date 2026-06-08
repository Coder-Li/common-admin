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

  it('loads dictionary options with bearer auth', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        typeCode: 'user_role',
        items: [
          {
            value: 'ADMIN',
            label: 'Admin',
            isDefault: false,
            badgeVariant: 'DANGER',
          },
        ],
      },
    })
    const client = createApiClient({
      client: { get },
      getAccessToken: () => 'access-token',
    })

    const response = await client.dictionaries.options('user_role')

    expect(get).toHaveBeenCalledWith('/dictionaries/user_role/options', {
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(response.items[0].label).toBe('Admin')
  })

  it('loads multiple dictionary option sets with comma-separated params', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        dictionaries: {
          common_status: [],
          user_role: [],
        },
      },
    })
    const client = createApiClient({
      client: { get },
      getAccessToken: () => 'access-token',
    })

    const response = await client.dictionaries.optionsMap([
      'common_status',
      'user_role',
    ])

    expect(get).toHaveBeenCalledWith('/dictionaries/options', {
      params: { types: 'common_status,user_role' },
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(response.dictionaries.user_role).toEqual([])
  })

  it('manages dictionary types with bearer auth', async () => {
    const typeRecord = {
      id: 'type-1',
      code: 'common_status',
      name: 'Common status',
      status: 'ACTIVE',
      isSystem: false,
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    }
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        data: { items: [typeRecord], total: 1, page: 1, pageSize: 20 },
      })
      .mockResolvedValueOnce({ data: typeRecord })
    const post = vi.fn().mockResolvedValue({ data: typeRecord })
    const patch = vi.fn().mockResolvedValue({
      data: { ...typeRecord, name: 'Status' },
    })
    const deleteRequest = vi.fn().mockResolvedValue({ data: undefined })
    const client = createApiClient({
      client: { delete: deleteRequest, get, patch, post },
      getAccessToken: () => 'access-token',
    })
    const query = { page: 1, pageSize: 20, status: 'ACTIVE' as const }
    const createPayload = {
      code: 'common_status',
      name: 'Common status',
      status: 'ACTIVE' as const,
    }
    const updatePayload = { name: 'Status' }

    await client.dictionaries.types.list(query)
    await client.dictionaries.types.get('type-1')
    await client.dictionaries.types.create(createPayload)
    await client.dictionaries.types.update('type-1', updatePayload)
    await client.dictionaries.types.delete('type-1')

    expect(get).toHaveBeenNthCalledWith(1, '/dictionary-types', {
      params: query,
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(get).toHaveBeenNthCalledWith(2, '/dictionary-types/type-1', {
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(post).toHaveBeenCalledWith('/dictionary-types', createPayload, {
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(patch).toHaveBeenCalledWith(
      '/dictionary-types/type-1',
      updatePayload,
      {
        headers: { Authorization: 'Bearer access-token' },
      },
    )
    expect(deleteRequest).toHaveBeenCalledWith('/dictionary-types/type-1', {
      headers: { Authorization: 'Bearer access-token' },
    })
  })

  it('manages dictionary items with bearer auth', async () => {
    const itemRecord = {
      id: 'item-1',
      typeId: 'type-1',
      typeCode: 'user_role',
      typeName: 'User role',
      value: 'ADMIN',
      label: 'Admin',
      sortOrder: 10,
      status: 'ACTIVE',
      isSystem: true,
      isDefault: false,
      badgeVariant: 'DANGER',
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    }
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        data: { items: [itemRecord], total: 1, page: 1, pageSize: 20 },
      })
      .mockResolvedValueOnce({ data: itemRecord })
    const post = vi.fn().mockResolvedValue({ data: itemRecord })
    const patch = vi.fn().mockResolvedValue({
      data: { ...itemRecord, label: 'Administrator' },
    })
    const deleteRequest = vi.fn().mockResolvedValue({ data: undefined })
    const client = createApiClient({
      client: { delete: deleteRequest, get, patch, post },
      getAccessToken: () => 'access-token',
    })
    const query = { page: 1, pageSize: 20, typeCode: 'user_role' }
    const createPayload = {
      typeId: 'type-1',
      value: 'ADMIN',
      label: 'Admin',
      sortOrder: 10,
      status: 'ACTIVE' as const,
      isDefault: false,
      badgeVariant: 'DANGER' as const,
    }
    const updatePayload = { label: 'Administrator' }

    await client.dictionaries.items.list(query)
    await client.dictionaries.items.get('item-1')
    await client.dictionaries.items.create(createPayload)
    await client.dictionaries.items.update('item-1', updatePayload)
    await client.dictionaries.items.delete('item-1')

    expect(get).toHaveBeenNthCalledWith(1, '/dictionary-items', {
      params: query,
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(get).toHaveBeenNthCalledWith(2, '/dictionary-items/item-1', {
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(post).toHaveBeenCalledWith('/dictionary-items', createPayload, {
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(patch).toHaveBeenCalledWith(
      '/dictionary-items/item-1',
      updatePayload,
      {
        headers: { Authorization: 'Bearer access-token' },
      },
    )
    expect(deleteRequest).toHaveBeenCalledWith('/dictionary-items/item-1', {
      headers: { Authorization: 'Bearer access-token' },
    })
  })

  it('calls onUnauthorized when a dictionary request returns 401', async () => {
    const error = { response: { status: 401 } }
    const get = vi.fn().mockRejectedValue(error)
    const onUnauthorized = vi.fn()
    const client = createApiClient({
      client: { get },
      getAccessToken: () => 'expired-token',
      onUnauthorized,
    })

    await expect(client.dictionaries.options('user_role')).rejects.toBe(error)

    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
