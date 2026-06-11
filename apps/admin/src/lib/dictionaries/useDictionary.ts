import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getDictionaryOptionsMap,
  getGetDictionaryOptionsMapQueryKey,
  getGetDictionaryOptionsQueryKey,
  getDictionaryOptions,
} from '../../generated/api/endpoints/dictionaries/dictionaries'
import type { DictionaryOption } from './dictionaries.types'

const dictionaryStaleTime = 5 * 60 * 1000

function normalizeTypeCodes(typeCodes: string[]) {
  return Array.from(
    new Set(typeCodes.map((typeCode) => typeCode.trim()).filter(Boolean)),
  ).sort()
}

export function useDictionary(typeCode: string) {
  const normalizedTypeCode = typeCode.trim()
  const query = useQuery({
    queryKey: getGetDictionaryOptionsQueryKey(normalizedTypeCode),
    queryFn: () => getDictionaryOptions(normalizedTypeCode),
    enabled: Boolean(normalizedTypeCode),
    staleTime: dictionaryStaleTime,
  })

  return {
    ...query,
    options: query.data?.items ?? [],
  }
}

export function useDictionaries(typeCodes: string[]) {
  const normalizedTypeCodes = useMemo(
    () => normalizeTypeCodes(typeCodes),
    [typeCodes],
  )
  const query = useQuery({
    queryKey: getGetDictionaryOptionsMapQueryKey({ types: normalizedTypeCodes }),
    queryFn: () => getDictionaryOptionsMap({ types: normalizedTypeCodes }),
    enabled: normalizedTypeCodes.length > 0,
    staleTime: dictionaryStaleTime,
  })

  return {
    ...query,
    dictionaries: query.data?.dictionaries ?? {},
    getOptions(typeCode: string): DictionaryOption[] {
      return query.data?.dictionaries[typeCode] ?? []
    },
  }
}
