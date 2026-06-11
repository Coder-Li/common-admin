import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSession } from '../types/auth'

const axiosCreate = vi.hoisted(() => vi.fn())
const axiosRequest = vi.hoisted(() => vi.fn())
const clearQueryCache = vi.hoisted(() => vi.fn())

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()

  return {
    ...actual,
    default: {
      ...actual.default,
      create: axiosCreate,
      request: axiosRequest,
    },
  }
})

vi.mock('./query-client', () => ({
  clearQueryCache,
}))

const session: AuthSession = {
  accessToken: 'fresh-access-token',
  user: {
    id: 'user-1',
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Ada',
    lastName: 'Admin',
    roles: [{ code: 'admin', name: 'Admin' }],
    permissions: ['dashboard.view'],
  },
}

function response<T>(
  data: T,
  config: AxiosRequestConfig = {},
): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: config as AxiosResponse<T>['config'],
  }
}

function unauthorizedError(config: AxiosRequestConfig): Error & {
  isAxiosError: true
  response: { status: number }
  config: AxiosRequestConfig
} {
  return Object.assign(new Error('unauthorized'), {
    isAxiosError: true as const,
    response: { status: 401 },
    config,
  })
}

async function loadMutator() {
  vi.resetModules()
  axiosCreate.mockReset()
  axiosRequest.mockReset()
  clearQueryCache.mockReset()

  const request = vi.fn()
  axiosCreate.mockReturnValue({ request } as unknown as AxiosInstance)

  const authStoreModule = await import('../stores/auth-store')
  authStoreModule.useAuthStore.getState().reset()
  const mutatorModule = await import('./api-mutator')

  return {
    ...mutatorModule,
    request: request as Mock<
      (config: AxiosRequestConfig) => Promise<AxiosResponse>
    >,
    axiosRequest: axiosRequest as Mock<
      (config: AxiosRequestConfig) => Promise<AxiosResponse>
    >,
    useAuthStore: authStoreModule.useAuthStore,
  }
}

describe('api mutator', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('adds an Authorization header when an access token exists', async () => {
    const { apiMutator, request, useAuthStore } = await loadMutator()
    useAuthStore.setState({ accessToken: 'access-token' })
    request.mockResolvedValueOnce(response({ ok: true }))

    await expect(apiMutator({ url: '/users/me', method: 'GET' })).resolves.toEqual(
      { ok: true },
    )

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    )
  })

  it('does not add an Authorization header when no token exists', async () => {
    const { apiMutator, request } = await loadMutator()
    request.mockResolvedValueOnce(response({ ok: true }))

    await apiMutator({ url: '/health', method: 'GET' })

    const requestConfig = request.mock.calls[0]?.[0]
    expect(requestConfig?.headers).not.toEqual(
      expect.objectContaining({ Authorization: expect.any(String) }),
    )
  })

  it('refreshes through the shared coordinator and replays an ordinary 401 once', async () => {
    const { apiMutator, request, axiosRequest, useAuthStore } =
      await loadMutator()
    useAuthStore.setState({ accessToken: 'stale-access-token' })
    request
      .mockRejectedValueOnce(unauthorizedError({ url: '/users/me' }))
      .mockResolvedValueOnce(response({ id: 'user-1' }))
    axiosRequest.mockResolvedValueOnce(response(session))

    await expect(
      apiMutator({ url: '/users/me', method: 'GET' }),
    ).resolves.toEqual({ id: 'user-1' })

    expect(axiosRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/auth/refresh',
        method: 'POST',
        withCredentials: true,
      }),
    )
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fresh-access-token',
        }),
      }),
    )
  })

  it('clears auth and query cache when refresh fails', async () => {
    const { apiMutator, request, axiosRequest, useAuthStore } =
      await loadMutator()
    useAuthStore.getState().setSession({
      ...session,
      accessToken: 'stale-access-token',
    })
    const refreshError = new Error('refresh failed')
    request.mockRejectedValueOnce(unauthorizedError({ url: '/users/me' }))
    axiosRequest.mockRejectedValueOnce(refreshError)

    await expect(
      apiMutator({ url: '/users/me', method: 'GET' }),
    ).rejects.toBe(refreshError)

    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(clearQueryCache).toHaveBeenCalledOnce()
  })

  it.each(['/auth/login', '/auth/refresh', '/auth/logout'])(
    'does not replay %s through refresh',
    async (url) => {
      const { apiMutator, request, axiosRequest } = await loadMutator()
      const error = unauthorizedError({ url })
      request.mockRejectedValueOnce(error)

      await expect(apiMutator({ url, method: 'POST' })).rejects.toBe(error)

      expect(axiosRequest).not.toHaveBeenCalled()
      expect(request).toHaveBeenCalledOnce()
    },
  )

  it('forwards blob request options and abort signals', async () => {
    const { apiMutator, request } = await loadMutator()
    const signal = new AbortController().signal
    const blob = new Blob(['file'])
    request.mockResolvedValueOnce(response(blob))

    await expect(
      apiMutator(
        { url: '/files/file-1/download', method: 'GET', signal },
        { responseType: 'blob', headers: { 'X-Trace-Id': 'trace-1' } },
      ),
    ).resolves.toBe(blob)

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        responseType: 'blob',
        signal,
        headers: expect.objectContaining({
          'X-Trace-Id': 'trace-1',
        }),
      }),
    )
  })

  it('serializes array query params as comma-separated values', async () => {
    await loadMutator()

    const createConfig = axiosCreate.mock.calls[0]?.[0] as
      | AxiosRequestConfig
      | undefined
    const paramsSerializer = createConfig?.paramsSerializer

    expect(paramsSerializer).toEqual(
      expect.objectContaining({
        serialize: expect.any(Function),
      }),
    )
    expect(
      (paramsSerializer as { serialize: (params: unknown) => string }).serialize({
        page: 1,
        types: ['common_status', 'user_role'],
        ignored: undefined,
      }),
    ).toBe('page=1&types=common_status%2Cuser_role')
  })
})
