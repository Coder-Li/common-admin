import { useQuery } from '@tanstack/react-query'
import type { ListResponse } from '../api'
import {
  type ApiListQuery,
  createListQueryKey,
  toApiListQuery,
  type ServerListState,
} from './list-query'

export function useServerTableQuery<
  TItem,
  TFilters extends object = Record<string, unknown>,
  TQuery extends ApiListQuery & TFilters = ApiListQuery & TFilters,
>(options: {
  resource: string
  state: ServerListState<TFilters>
  queryFn: (query: TQuery) => Promise<ListResponse<TItem>>
}) {
  return useQuery({
    queryKey: createListQueryKey(options.resource, options.state),
    queryFn: () => options.queryFn(toApiListQuery<TFilters, TQuery>(options.state)),
  })
}
