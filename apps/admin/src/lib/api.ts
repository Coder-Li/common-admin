import axios from 'axios'
import type { AuthSession, UserProfile } from '../types/auth'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserListQuery,
  UserListResponse,
  UserRecord,
} from '../features/users/users.types'
import type {
  DictionaryOptionsMapResponse,
  DictionaryOptionsResponse,
} from './dictionaries/dictionaries.types'
import type {
  CreateDictionaryItemRequest,
  CreateDictionaryTypeRequest,
  DictionaryItemListQuery,
  DictionaryItemListResponse,
  DictionaryItemRecord,
  DictionaryTypeListQuery,
  DictionaryTypeListResponse,
  DictionaryTypeRecord,
  UpdateDictionaryItemRequest,
  UpdateDictionaryTypeRequest,
} from '../features/dictionaries/dictionaries.types'
import type {
  FileListQuery,
  FileListResponse,
  FileRecord,
  UpdateFileRequest,
} from '../features/files/files.types'

export interface LoginCredentials {
  usernameOrEmail: string
  password: string
}

export interface ListResponse<TItem> {
  items: TItem[]
  total: number
  page: number
  pageSize: number
}

interface RequestConfig {
  headers?: Record<string, string>
  params?: object
  responseType?: 'blob'
}

interface HttpClient {
  post?<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<{ data: T }>
  patch?<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<{ data: T }>
  delete?<T = unknown>(url: string, config?: RequestConfig): Promise<{ data: T }>
  get?<T = unknown>(
    url: string,
    config?: RequestConfig,
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

  function authenticatedConfig(
    accessToken = getAccessToken?.(),
    params?: RequestConfig['params'],
  ): RequestConfig {
    if (!accessToken) {
      throw new Error('Access token is required')
    }

    return {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(params ? { params } : {}),
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
      return request(() =>
        client.get!<UserProfile>('/users/me', authenticatedConfig(accessToken)),
      )
    },

    users: {
      async list(query: UserListQuery): Promise<UserListResponse> {
        if (!client.get) {
          throw new Error('HTTP get client is not configured')
        }
        return request(() =>
          client.get!<UserListResponse>(
            '/users',
            authenticatedConfig(undefined, query),
          ),
        )
      },

      async create(payload: CreateUserRequest): Promise<UserRecord> {
        if (!client.post) {
          throw new Error('HTTP post client is not configured')
        }
        return request(() =>
          client.post!<UserRecord>('/users', payload, authenticatedConfig()),
        )
      },

      async update(
        id: string,
        payload: UpdateUserRequest,
      ): Promise<UserRecord> {
        if (!client.patch) {
          throw new Error('HTTP patch client is not configured')
        }
        return request(() =>
          client.patch!<UserRecord>(
            `/users/${id}`,
            payload,
            authenticatedConfig(),
          ),
        )
      },

      async delete(id: string): Promise<void> {
        if (!client.delete) {
          throw new Error('HTTP delete client is not configured')
        }
        return request(() =>
          client.delete!<void>(`/users/${id}`, authenticatedConfig()),
        )
      },
    },

    files: {
      async list(query: FileListQuery): Promise<FileListResponse> {
        if (!client.get) {
          throw new Error('HTTP get client is not configured')
        }
        return request(() =>
          client.get!<FileListResponse>(
            '/files',
            authenticatedConfig(undefined, query),
          ),
        )
      },

      async upload(formData: FormData): Promise<FileRecord> {
        if (!client.post) {
          throw new Error('HTTP post client is not configured')
        }
        return request(() =>
          client.post!<FileRecord>('/files', formData, authenticatedConfig()),
        )
      },

      async update(
        id: string,
        payload: UpdateFileRequest,
      ): Promise<FileRecord> {
        if (!client.patch) {
          throw new Error('HTTP patch client is not configured')
        }
        return request(() =>
          client.patch!<FileRecord>(
            `/files/${id}`,
            payload,
            authenticatedConfig(),
          ),
        )
      },

      async delete(id: string): Promise<void> {
        if (!client.delete) {
          throw new Error('HTTP delete client is not configured')
        }
        return request(() =>
          client.delete!<void>(`/files/${id}`, authenticatedConfig()),
        )
      },

      async download(id: string): Promise<Blob> {
        if (!client.get) {
          throw new Error('HTTP get client is not configured')
        }
        return request(() =>
          client.get!<Blob>(`/files/${id}/download`, {
            ...authenticatedConfig(),
            responseType: 'blob',
          }),
        )
      },
    },

    dictionaries: {
      async options(typeCode: string): Promise<DictionaryOptionsResponse> {
        if (!client.get) {
          throw new Error('HTTP get client is not configured')
        }
        return request(() =>
          client.get!<DictionaryOptionsResponse>(
            `/dictionaries/${typeCode}/options`,
            authenticatedConfig(),
          ),
        )
      },

      async optionsMap(
        typeCodes: string[],
      ): Promise<DictionaryOptionsMapResponse> {
        if (!client.get) {
          throw new Error('HTTP get client is not configured')
        }
        return request(() =>
          client.get!<DictionaryOptionsMapResponse>(
            '/dictionaries/options',
            authenticatedConfig(undefined, { types: typeCodes.join(',') }),
          ),
        )
      },

      types: {
        async list(
          query: DictionaryTypeListQuery,
        ): Promise<DictionaryTypeListResponse> {
          if (!client.get) {
            throw new Error('HTTP get client is not configured')
          }
          return request(() =>
            client.get!<DictionaryTypeListResponse>(
              '/dictionary-types',
              authenticatedConfig(undefined, query),
            ),
          )
        },

        async get(id: string): Promise<DictionaryTypeRecord> {
          if (!client.get) {
            throw new Error('HTTP get client is not configured')
          }
          return request(() =>
            client.get!<DictionaryTypeRecord>(
              `/dictionary-types/${id}`,
              authenticatedConfig(),
            ),
          )
        },

        async create(
          payload: CreateDictionaryTypeRequest,
        ): Promise<DictionaryTypeRecord> {
          if (!client.post) {
            throw new Error('HTTP post client is not configured')
          }
          return request(() =>
            client.post!<DictionaryTypeRecord>(
              '/dictionary-types',
              payload,
              authenticatedConfig(),
            ),
          )
        },

        async update(
          id: string,
          payload: UpdateDictionaryTypeRequest,
        ): Promise<DictionaryTypeRecord> {
          if (!client.patch) {
            throw new Error('HTTP patch client is not configured')
          }
          return request(() =>
            client.patch!<DictionaryTypeRecord>(
              `/dictionary-types/${id}`,
              payload,
              authenticatedConfig(),
            ),
          )
        },

        async delete(id: string): Promise<void> {
          if (!client.delete) {
            throw new Error('HTTP delete client is not configured')
          }
          return request(() =>
            client.delete!<void>(
              `/dictionary-types/${id}`,
              authenticatedConfig(),
            ),
          )
        },
      },

      items: {
        async list(
          query: DictionaryItemListQuery,
        ): Promise<DictionaryItemListResponse> {
          if (!client.get) {
            throw new Error('HTTP get client is not configured')
          }
          return request(() =>
            client.get!<DictionaryItemListResponse>(
              '/dictionary-items',
              authenticatedConfig(undefined, query),
            ),
          )
        },

        async get(id: string): Promise<DictionaryItemRecord> {
          if (!client.get) {
            throw new Error('HTTP get client is not configured')
          }
          return request(() =>
            client.get!<DictionaryItemRecord>(
              `/dictionary-items/${id}`,
              authenticatedConfig(),
            ),
          )
        },

        async create(
          payload: CreateDictionaryItemRequest,
        ): Promise<DictionaryItemRecord> {
          if (!client.post) {
            throw new Error('HTTP post client is not configured')
          }
          return request(() =>
            client.post!<DictionaryItemRecord>(
              '/dictionary-items',
              payload,
              authenticatedConfig(),
            ),
          )
        },

        async update(
          id: string,
          payload: UpdateDictionaryItemRequest,
        ): Promise<DictionaryItemRecord> {
          if (!client.patch) {
            throw new Error('HTTP patch client is not configured')
          }
          return request(() =>
            client.patch!<DictionaryItemRecord>(
              `/dictionary-items/${id}`,
              payload,
              authenticatedConfig(),
            ),
          )
        },

        async delete(id: string): Promise<void> {
          if (!client.delete) {
            throw new Error('HTTP delete client is not configured')
          }
          return request(() =>
            client.delete!<void>(
              `/dictionary-items/${id}`,
              authenticatedConfig(),
            ),
          )
        },
      },
    },
  }
}
