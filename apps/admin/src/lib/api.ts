import axios from 'axios'
import type { AuthSession, UserProfile } from '../types/auth'

export interface LoginCredentials {
  usernameOrEmail: string
  password: string
}

interface HttpClient {
  post?<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
  get?<T = unknown>(
    url: string,
    config?: { headers?: Record<string, string> },
  ): Promise<{ data: T }>
}

interface ApiClientOptions {
  client?: HttpClient
  getAccessToken?: () => string | null
  onUnauthorized?: () => void
}

interface ResolvedApiClientOptions {
  client: HttpClient
  getAccessToken?: () => string | null
  onUnauthorized?: () => void
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
})

function isUnauthorizedError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    error.response.status === 401
  )
}

function resolveOptions(options?: ApiClientOptions | HttpClient): ResolvedApiClientOptions {
  if (!options) {
    return { client: http }
  }

  if (
    'client' in options ||
    'getAccessToken' in options ||
    'onUnauthorized' in options
  ) {
    return {
      client: options.client ?? http,
      getAccessToken: options.getAccessToken,
      onUnauthorized: options.onUnauthorized,
    }
  }

  return { client: options as HttpClient }
}

export function createApiClient(options?: ApiClientOptions | HttpClient) {
  const { client, getAccessToken, onUnauthorized } = resolveOptions(options)

  async function request<T>(operation: () => Promise<{ data: T }>): Promise<T> {
    try {
      const response = await operation()
      return response.data
    } catch (error) {
      if (isUnauthorizedError(error)) {
        onUnauthorized?.()
      }
      throw error
    }
  }

  return {
    async login(credentials: LoginCredentials): Promise<AuthSession> {
      if (!client.post) {
        throw new Error('HTTP post client is not configured')
      }
      return request(() => client.post!<AuthSession>('/auth/login', credentials))
    },

    async me(accessToken = getAccessToken?.()): Promise<UserProfile> {
      if (!client.get) {
        throw new Error('HTTP get client is not configured')
      }
      if (!accessToken) {
        throw new Error('Access token is required')
      }
      return request(() =>
        client.get!<UserProfile>('/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      )
    },
  }
}
