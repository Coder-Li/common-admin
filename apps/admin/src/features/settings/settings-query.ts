import type { QueryClient, QueryKey } from '@tanstack/react-query'

function isDictionaryOptionsQueryKey(queryKey: QueryKey) {
  const first = queryKey[0]

  return (
    first === '/dictionaries/options' ||
    (typeof first === 'string' &&
      /^\/dictionaries\/[^/]+\/options$/.test(first))
  )
}

export function invalidateDictionaryOptionQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => isDictionaryOptionsQueryKey(query.queryKey),
  })
}
