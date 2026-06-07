import { describe, expect, it } from 'vitest'
import { createListQueryKey, toApiListQuery } from './list-query'

describe('list query helpers', () => {
  it('converts zero-based table page index to one-based API page', () => {
    const query = toApiListQuery({
      pageIndex: 2,
      pageSize: 50,
      search: '',
      filters: {},
    })

    expect(query).toMatchObject({ page: 3, pageSize: 50 })
  })

  it('uses the default page size when table state page size is missing or invalid-ish', () => {
    const missingPageSize = toApiListQuery({
      pageIndex: 0,
      pageSize: undefined,
      search: '',
      filters: {},
    })
    const invalidPageSize = toApiListQuery({
      pageIndex: 0,
      pageSize: 0,
      search: '',
      filters: {},
    })

    expect(missingPageSize.pageSize).toBe(20)
    expect(invalidPageSize.pageSize).toBe(20)
  })

  it('returns stable query key parts for pagination, search, sort, and filters', () => {
    const firstKey = createListQueryKey('users', {
      pageIndex: 1,
      pageSize: 25,
      search: ' admin ',
      sort: 'createdAt:desc',
      filters: { role: 'ADMIN', active: true },
    })
    const secondKey = createListQueryKey('users', {
      pageIndex: 1,
      pageSize: 25,
      search: 'admin',
      sort: 'createdAt:desc',
      filters: { active: true, role: 'ADMIN' },
    })

    expect(firstKey).toEqual(secondKey)
    expect(firstKey).toEqual([
      'users',
      'list',
      {
        page: 2,
        pageSize: 25,
        search: 'admin',
        sort: 'createdAt:desc',
        filters: { active: true, role: 'ADMIN' },
      },
    ])
  })

  it('omits empty search from API query', () => {
    const query = toApiListQuery({
      pageIndex: 0,
      pageSize: 20,
      search: '   ',
      sort: 'createdAt:desc',
      filters: { role: 'ADMIN' },
    })

    expect(query).toEqual({
      page: 1,
      pageSize: 20,
      sort: 'createdAt:desc',
      role: 'ADMIN',
    })
  })
})
