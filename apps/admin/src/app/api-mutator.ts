import axios, { isAxiosError, type AxiosRequestConfig } from 'axios'
import { clearQueryCache } from './query-client'
import { useAuthStore } from '../stores/auth-store'
import type { AuthSession } from '../types/auth'
import { createRefreshCoordinator } from './api-refresh-coordinator'

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const skipRefreshPaths = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
])

const apiClient = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
})

function toHeaderRecord(
  headers: AxiosRequestConfig['headers'],
): Record<string, unknown> {
  if (!headers) {
    return {}
  }

  if (
    typeof headers === 'object' &&
    'toJSON' in headers &&
    typeof headers.toJSON === 'function'
  ) {
    return headers.toJSON() as Record<string, unknown>
  }

  return { ...(headers as Record<string, unknown>) }
}

function mergeHeaders(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): AxiosRequestConfig['headers'] {
  const headers = {
    ...toHeaderRecord(config.headers),
    ...toHeaderRecord(options?.headers),
  }
  const accessToken = useAuthStore.getState().accessToken

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return Object.keys(headers).length
    ? (headers as AxiosRequestConfig['headers'])
    : undefined
}

function mergeRequestConfig(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): AxiosRequestConfig {
  const requestConfig: AxiosRequestConfig = {
    ...config,
    ...options,
  }
  const headers = mergeHeaders(config, options)

  if (headers) {
    requestConfig.headers = headers
  }

  return requestConfig
}

function requestPath(url: AxiosRequestConfig['url']) {
  if (!url) {
    return ''
  }

  try {
    return new URL(url, 'http://common-admin.local').pathname
  } catch {
    return url.split('?')[0] ?? ''
  }
}

function shouldSkipRefresh(url: AxiosRequestConfig['url']) {
  const path = requestPath(url)

  return (
    skipRefreshPaths.has(path) ||
    [...skipRefreshPaths].some((skipPath) => path.endsWith(skipPath))
  )
}

function isUnauthorizedError(error: unknown) {
  return isAxiosError(error) && error.response?.status === 401
}

async function refreshSessionRequest() {
  const response = await axios.request<AuthSession>({
    baseURL: apiBaseURL,
    url: '/auth/refresh',
    method: 'POST',
    withCredentials: true,
  })

  return response.data
}

export const apiRefreshCoordinator = createRefreshCoordinator({
  refresh: refreshSessionRequest,
  setSession: (session) => useAuthStore.getState().setSession(session),
  onUnauthorized: () => {
    useAuthStore.getState().setAnonymous()
    clearQueryCache()
  },
})

export async function apiMutator<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> {
  const requestConfig = mergeRequestConfig(config, options)

  try {
    const response = await apiClient.request<T>(requestConfig)
    return response.data
  } catch (error) {
    if (!isUnauthorizedError(error) || shouldSkipRefresh(config.url)) {
      throw error
    }

    await apiRefreshCoordinator.refresh()

    const replayResponse = await apiClient.request<T>(
      mergeRequestConfig(config, options),
    )

    return replayResponse.data
  }
}
