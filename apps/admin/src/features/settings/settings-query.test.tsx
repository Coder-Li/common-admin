import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import {
  getGetDictionaryOptionsMapQueryKey,
  getGetDictionaryOptionsQueryKey,
} from '../../generated/api/endpoints/dictionaries/dictionaries'
import { getListDictionaryItemsQueryKey } from '../../generated/api/endpoints/dictionary-items/dictionary-items'
import { getListDictionaryTypesQueryKey } from '../../generated/api/endpoints/dictionary-types/dictionary-types'
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

    queryClient.setQueryData(getListDictionaryTypesQueryKey({ page: 1 }), {
      items: [],
    })
    queryClient.setQueryData(
      getListDictionaryItemsQueryKey({ typeCode: 'status', page: 1 }),
      { items: [] },
    )

    await invalidateDictionaryOptionQueries(queryClient)

    expect(
      queryClient.getQueryState(getListDictionaryTypesQueryKey({ page: 1 }))
        ?.isInvalidated,
    ).toBe(false)
    expect(
      queryClient.getQueryState(
        getListDictionaryItemsQueryKey({ typeCode: 'status', page: 1 }),
      )?.isInvalidated,
    ).toBe(false)
  })
})
