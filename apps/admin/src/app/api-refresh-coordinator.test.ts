import { describe, expect, it, vi } from 'vitest'
import { createRefreshCoordinator } from './api-refresh-coordinator'
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
    permissions: ['user.read'],
  },
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void
  let reject: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

describe('api refresh coordinator', () => {
  it('returns an object with a refresh function', () => {
    const coordinator = createRefreshCoordinator({
      refresh: vi.fn(),
      setSession: vi.fn(),
      onUnauthorized: vi.fn(),
    })

    expect(coordinator.refresh).toEqual(expect.any(Function))
  })

  it('shares one pending refresh request across concurrent calls', async () => {
    const deferred = createDeferred<AuthSession>()
    const refresh = vi.fn().mockReturnValue(deferred.promise)
    const setSession = vi.fn()
    const coordinator = createRefreshCoordinator({
      refresh,
      setSession,
      onUnauthorized: vi.fn(),
    })

    const firstRefresh = coordinator.refresh()
    const secondRefresh = coordinator.refresh()
    deferred.resolve(session)

    await expect(Promise.all([firstRefresh, secondRefresh])).resolves.toEqual([
      session,
      session,
    ])

    expect(refresh).toHaveBeenCalledOnce()
    expect(setSession).toHaveBeenCalledOnce()
    expect(setSession).toHaveBeenCalledWith(session)
  })

  it('stores and returns a successful refresh session', async () => {
    const refresh = vi.fn().mockResolvedValue(session)
    const setSession = vi.fn()
    const coordinator = createRefreshCoordinator({
      refresh,
      setSession,
      onUnauthorized: vi.fn(),
    })

    await expect(coordinator.refresh()).resolves.toBe(session)

    expect(setSession).toHaveBeenCalledOnce()
    expect(setSession).toHaveBeenCalledWith(session)
  })

  it('calls onUnauthorized, rejects with the original error, and clears pending refresh on failure', async () => {
    const refreshError = new Error('refresh failed')
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(refreshError)
      .mockResolvedValueOnce(session)
    const setSession = vi.fn()
    const onUnauthorized = vi.fn()
    const coordinator = createRefreshCoordinator({
      refresh,
      setSession,
      onUnauthorized,
    })

    await expect(coordinator.refresh()).rejects.toBe(refreshError)
    await expect(coordinator.refresh()).resolves.toBe(session)

    expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(setSession).toHaveBeenCalledOnce()
    expect(setSession).toHaveBeenCalledWith(session)
  })

  it('starts a new refresh request after a successful refresh completes', async () => {
    const nextSession = { ...session, accessToken: 'next-access-token' }
    const refresh = vi
      .fn()
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce(nextSession)
    const setSession = vi.fn()
    const coordinator = createRefreshCoordinator({
      refresh,
      setSession,
      onUnauthorized: vi.fn(),
    })

    await expect(coordinator.refresh()).resolves.toBe(session)
    await expect(coordinator.refresh()).resolves.toBe(nextSession)

    expect(refresh).toHaveBeenCalledTimes(2)
    expect(setSession).toHaveBeenNthCalledWith(1, session)
    expect(setSession).toHaveBeenNthCalledWith(2, nextSession)
  })
})
