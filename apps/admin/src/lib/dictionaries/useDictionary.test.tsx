// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DictionaryOptionsMapResponse } from './dictionaries.types'
import {
  useDictionaries,
  useDictionary,
} from './useDictionary'

const dictionariesApiMock = vi.hoisted(() => ({
  getDictionaryOptionsMap: vi.fn(),
  getGetDictionaryOptionsMapQueryKey: vi.fn((params?: { types: string[] }) => [
    '/dictionaries/options',
    ...(params ? [params] : []),
  ]),
  getDictionaryOptions: vi.fn(),
  getGetDictionaryOptionsQueryKey: vi.fn((typeCode: string) => [
    `/dictionaries/${typeCode}/options`,
  ]),
}))

vi.mock(
  '../../generated/api/endpoints/dictionaries/dictionaries',
  () => dictionariesApiMock,
)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

function createWrapper(queryClient = createQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

describe('dictionary hooks', () => {
  beforeEach(() => {
    dictionariesApiMock.getDictionaryOptionsMap.mockReset()
    dictionariesApiMock.getGetDictionaryOptionsMapQueryKey.mockClear()
    dictionariesApiMock.getDictionaryOptions.mockReset()
    dictionariesApiMock.getGetDictionaryOptionsQueryKey.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('exposes loading and success states for one dictionary', async () => {
    const response = deferred<{
      typeCode: string
      items: { value: string; label: string; isDefault: boolean }[]
    }>()
    dictionariesApiMock.getDictionaryOptions.mockReturnValue(response.promise)

    const { result } = renderHook(() => useDictionary('user_role'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    response.resolve({
      typeCode: 'user_role',
      items: [
        {
          value: 'ADMIN',
          label: 'Admin',
          isDefault: false,
        },
      ],
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.options).toEqual([
      {
        value: 'ADMIN',
        label: 'Admin',
        isDefault: false,
      },
    ])
  })

  it('normalizes multi-dictionary query keys so equivalent type sets share cache', async () => {
    const response: DictionaryOptionsMapResponse = {
      dictionaries: {
        common_status: [],
        user_role: [
          {
            value: 'ADMIN',
            label: 'Admin',
            isDefault: false,
          },
        ],
      },
    }
    dictionariesApiMock.getDictionaryOptionsMap.mockResolvedValue(response)
    const queryClient = createQueryClient()

    const first = renderHook(
      () => useDictionaries(['user_role', 'common_status']),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true)
    })

    const second = renderHook(
      () => useDictionaries(['common_status', 'user_role']),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(second.result.current.isSuccess).toBe(true)
    })
    expect(dictionariesApiMock.getDictionaryOptionsMap).toHaveBeenCalledOnce()
    expect(dictionariesApiMock.getDictionaryOptionsMap).toHaveBeenCalledWith({
      types: ['common_status', 'user_role'],
    })
    expect(second.result.current.dictionaries.user_role).toEqual([
      {
        value: 'ADMIN',
        label: 'Admin',
        isDefault: false,
      },
    ])
  })

  it('returns an empty option array for empty responses', async () => {
    dictionariesApiMock.getDictionaryOptions.mockResolvedValue({
      typeCode: 'user_role',
      items: undefined,
    })

    const { result } = renderHook(() => useDictionary('user_role'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.options).toEqual([])
  })

  it('does not request one dictionary when the type code is empty', () => {
    const { result } = renderHook(() => useDictionary(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.options).toEqual([])
    expect(dictionariesApiMock.getDictionaryOptions).not.toHaveBeenCalled()
  })

  it('does not request multiple dictionaries when no type codes are provided', () => {
    const { result } = renderHook(() => useDictionaries([]), {
      wrapper: createWrapper(),
    })

    expect(result.current.dictionaries).toEqual({})
    expect(dictionariesApiMock.getDictionaryOptionsMap).not.toHaveBeenCalled()
  })
})
