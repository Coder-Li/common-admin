import { useQuery, type QueryClient, type QueryKey } from '@tanstack/react-query'
import {
  getBasicSettings,
  getGetBasicSettingsQueryKey,
} from '../../generated/api/endpoints/settings/settings'

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

export function useBasicSettingsQuery() {
  return useQuery({
    queryKey: getGetBasicSettingsQueryKey(),
    queryFn: async () => (await getBasicSettings()) ?? null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
