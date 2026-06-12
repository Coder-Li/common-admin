import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios'
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

function axiosError(
  data: unknown,
  status: number,
  config: AxiosRequestConfig = {},
): AxiosError {
  return {
    isAxiosError: true,
    message: 'Request failed',
    response: {
      data,
      status,
      statusText: 'Error',
      headers: {},
      config: config as AxiosResponse['config'],
    },
    config: config as AxiosError['config'],
  } as AxiosError
}

function networkError(): AxiosError {
  return {
    isAxiosError: true,
    message: 'Network Error',
  } as AxiosError
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

  it('rejects non-401 server errors with an ApiError', async () => {
    const { apiMutator, request, axiosRequest } = await loadMutator()
    const error = axiosError(
      {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        requestId: 'req-1',
      },
      403,
      { url: '/users/me' },
    )
    request.mockRejectedValueOnce(error)

    await expect(
      apiMutator({ url: '/users/me', method: 'GET' }),
    ).rejects.toEqual({
      code: 'FORBIDDEN',
      message: 'Forbidden',
      statusCode: 403,
      requestId: 'req-1',
    })

    expect(axiosRequest).not.toHaveBeenCalled()
  })

  it('does not refresh login 401 responses and rejects with an ApiError', async () => {
    const { apiMutator, request, axiosRequest } = await loadMutator()
    request.mockRejectedValueOnce(
      axiosError(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
        },
        401,
        { url: '/auth/login' },
      ),
    )

    await expect(
      apiMutator({ url: '/auth/login', method: 'POST' }),
    ).rejects.toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials',
      statusCode: 401,
    })

    expect(axiosRequest).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledOnce()
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

  it('shares one refresh request for concurrent ordinary 401 responses and replays each original request', async () => {
    const { apiMutator, request, axiosRequest, useAuthStore } =
      await loadMutator()
    useAuthStore.setState({ accessToken: 'stale-access-token' })
    let resolveRefresh: (value: AxiosResponse<AuthSession>) => void
    const refreshPromise = new Promise<AxiosResponse<AuthSession>>(
      (resolve) => {
        resolveRefresh = resolve
      },
    )
    request
      .mockRejectedValueOnce(unauthorizedError({ url: '/users/me' }))
      .mockRejectedValueOnce(unauthorizedError({ url: '/settings' }))
      .mockResolvedValueOnce(response({ id: 'user-1' }))
      .mockResolvedValueOnce(response({ theme: 'system' }))
    axiosRequest.mockReturnValueOnce(refreshPromise)

    const firstRequest = apiMutator({ url: '/users/me', method: 'GET' })
    const secondRequest = apiMutator({ url: '/settings', method: 'GET' })

    await Promise.resolve()
    expect(axiosRequest).toHaveBeenCalledOnce()
    resolveRefresh!(response(session))

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      { id: 'user-1' },
      { theme: 'system' },
    ])

    expect(request).toHaveBeenCalledTimes(4)
    expect(request.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        url: '/users/me',
        headers: expect.objectContaining({
          Authorization: 'Bearer fresh-access-token',
        }),
      }),
    )
    expect(request.mock.calls[3]?.[0]).toEqual(
      expect.objectContaining({
        url: '/settings',
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
    const refreshError = axiosError(
      {
        code: 'SESSION_EXPIRED',
        message: 'Session expired',
      },
      401,
      { url: '/auth/refresh' },
    )
    request.mockRejectedValueOnce(unauthorizedError({ url: '/users/me' }))
    axiosRequest.mockRejectedValueOnce(refreshError)

    await expect(
      apiMutator({ url: '/users/me', method: 'GET' }),
    ).rejects.toEqual({
      code: 'SESSION_EXPIRED',
      message: 'Session expired',
      statusCode: 401,
    })

    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(clearQueryCache).toHaveBeenCalledOnce()
  })

  it('rejects replay failures after a successful refresh with an ApiError', async () => {
    const { apiMutator, request, axiosRequest, useAuthStore } =
      await loadMutator()
    useAuthStore.setState({ accessToken: 'stale-access-token' })
    request
      .mockRejectedValueOnce(unauthorizedError({ url: '/users/me' }))
      .mockRejectedValueOnce(
        axiosError(
          {
            code: 'FORBIDDEN',
            message: 'Forbidden',
          },
          403,
          { url: '/users/me' },
        ),
      )
    axiosRequest.mockResolvedValueOnce(response(session))

    await expect(
      apiMutator({ url: '/users/me', method: 'GET' }),
    ).rejects.toEqual({
      code: 'FORBIDDEN',
      message: 'Forbidden',
      statusCode: 403,
    })
  })

  it('rejects network errors with NETWORK_ERROR', async () => {
    const { apiMutator, request, axiosRequest } = await loadMutator()
    const error = networkError()
    request.mockRejectedValueOnce(error)

    await expect(
      apiMutator({ url: '/users/me', method: 'GET' }),
    ).rejects.toEqual({
      code: 'NETWORK_ERROR',
      message: 'Network request failed',
      cause: error,
    })

    expect(axiosRequest).not.toHaveBeenCalled()
  })

  it.each(['/auth/login', '/auth/refresh', '/auth/logout'])(
    'does not replay %s through refresh',
    async (url) => {
      const { apiMutator, request, axiosRequest } = await loadMutator()
      const error = unauthorizedError({ url })
      request.mockRejectedValueOnce(error)

      await expect(apiMutator({ url, method: 'POST' })).rejects.toEqual({
        code: 'UNKNOWN_API_ERROR',
        message: 'Unknown API error',
        statusCode: 401,
        cause: error,
      })

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
