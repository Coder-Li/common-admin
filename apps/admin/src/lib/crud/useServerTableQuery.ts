import { useQuery } from '@tanstack/react-query'
import type { ListResponse } from '../api'
import {
  createListQueryKey,
  toApiListQuery,
  type ServerListState,
} from './list-query'

export function useServerTableQuery<
  TItem,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
>(options: {
  resource: string
  state: ServerListState<TFilters>
  queryFn: (query: Record<string, unknown>) => Promise<ListResponse<TItem>>
}) {
  return useQuery({
    queryKey: createListQueryKey(options.resource, options.state),
    queryFn: () => options.queryFn(toApiListQuery(options.state)),
  })
}
