export interface ServerListState<
  TFilters extends object = Record<string, unknown>,
> {
  pageIndex: number
  pageSize?: number
  search: string
  sort?: string
  filters: TFilters
}

export interface ApiListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
}

const DEFAULT_PAGE_SIZE = 20

function resolvePageSize(pageSize: ServerListState['pageSize']) {
  return typeof pageSize === 'number' && Number.isFinite(pageSize) && pageSize > 0
    ? pageSize
    : DEFAULT_PAGE_SIZE
}

function resolvePage(pageIndex: ServerListState['pageIndex']) {
  return typeof pageIndex === 'number' && Number.isFinite(pageIndex) && pageIndex >= 0
    ? pageIndex + 1
    : 1
}

function compactSearch(search: ServerListState['search']) {
  const trimmedSearch = search.trim()
  return trimmedSearch ? trimmedSearch : undefined
}

function stableFilters<TFilters extends object>(filters: TFilters) {
  return Object.fromEntries(
    Object.entries(filters).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey),
    ),
  ) as TFilters
}

export function toApiListQuery<
  TFilters extends object,
  TQuery extends ApiListQuery & TFilters = ApiListQuery & TFilters,
>(
  state: ServerListState<TFilters>,
): TQuery {
  const search = compactSearch(state.search)

  return {
    page: resolvePage(state.pageIndex),
    pageSize: resolvePageSize(state.pageSize),
    ...(search ? { search } : {}),
    ...(state.sort ? { sort: state.sort } : {}),
    ...state.filters,
  } as TQuery
}

export function createListQueryKey<TFilters extends object>(
  resource: string,
  state: ServerListState<TFilters>,
) {
  const search = compactSearch(state.search)

  return [
    resource,
    'list',
    {
      page: resolvePage(state.pageIndex),
      pageSize: resolvePageSize(state.pageSize),
      ...(search ? { search } : {}),
      ...(state.sort ? { sort: state.sort } : {}),
      filters: stableFilters(state.filters),
    },
  ] as const
}
