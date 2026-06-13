import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import {
  getGetDictionaryOptionsMapQueryKey,
  getGetDictionaryOptionsQueryKey,
} from '../../generated/api/endpoints/dictionaries/dictionaries'
import { invalidateDictionaryOptionQueries } from './settings-query'

describe('invalidateDictionaryOptionQueries', () => {
  it('invalidates dictionary option query families', async () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    queryClient.setQueryData(getGetDictionaryOptionsQueryKey('status'), [
      { label: 'Active', value: 'active' },
    ])
    queryClient.setQueryData(
      getGetDictionaryOptionsMapQueryKey({ types: ['status', 'role'] }),
      {
        status: [{ label: 'Active', value: 'active' }],
        role: [{ label: 'Admin', value: 'admin' }],
      },
    )

    await invalidateDictionaryOptionQueries(queryClient)

    expect(invalidateSpy).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    })
    expect(
      queryClient.getQueryState(getGetDictionaryOptionsQueryKey('status'))
        ?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(
        getGetDictionaryOptionsMapQueryKey({ types: ['status', 'role'] }),
      )?.isInvalidated,
    ).toBe(true)
  })

  it('does not invalidate dictionary type or item management list keys', async () => {
    const queryClient = new QueryClient()
    const dictionaryTypesQueryKey = ['/dictionary-types', { page: 1 }]
    const dictionaryItemsQueryKey = [
      '/dictionary-items',
      { typeCode: 'status', page: 1 },
    ]

    queryClient.setQueryData(dictionaryTypesQueryKey, { items: [] })
    queryClient.setQueryData(dictionaryItemsQueryKey, { items: [] })

    await invalidateDictionaryOptionQueries(queryClient)

    expect(queryClient.getQueryState(dictionaryTypesQueryKey)?.isInvalidated).toBe(
      false,
    )
    expect(queryClient.getQueryState(dictionaryItemsQueryKey)?.isInvalidated).toBe(
      false,
    )
  })
})
