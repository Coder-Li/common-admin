import { api as defaultApi } from '../../app/api-client'
import type {
  DictionaryOptionsMapResponse,
  DictionaryOptionsResponse,
} from './dictionaries.types'

export interface DictionariesApiClient {
  dictionaries: {
    options(typeCode: string): Promise<DictionaryOptionsResponse>
    optionsMap(typeCodes: string[]): Promise<DictionaryOptionsMapResponse>
  }
}

export function getDictionaryOptions(
  typeCode: string,
  api: DictionariesApiClient = defaultApi,
) {
  return api.dictionaries.options(typeCode)
}

export function getDictionariesOptions(
  typeCodes: string[],
  api: DictionariesApiClient = defaultApi,
) {
  return api.dictionaries.optionsMap(typeCodes)
}
