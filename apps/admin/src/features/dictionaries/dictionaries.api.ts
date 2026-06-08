import { api as defaultApi } from '../../app/api-client'
import type {
  CreateDictionaryItemRequest,
  CreateDictionaryTypeRequest,
  DictionaryItemListQuery,
  DictionaryItemListResponse,
  DictionaryItemRecord,
  DictionaryTypeListQuery,
  DictionaryTypeListResponse,
  DictionaryTypeRecord,
  UpdateDictionaryItemRequest,
  UpdateDictionaryTypeRequest,
} from './dictionaries.types'

export interface DictionariesManagementApiClient {
  dictionaries: {
    types: {
      list(query: DictionaryTypeListQuery): Promise<DictionaryTypeListResponse>
      create(payload: CreateDictionaryTypeRequest): Promise<DictionaryTypeRecord>
      update(
        id: string,
        payload: UpdateDictionaryTypeRequest,
      ): Promise<DictionaryTypeRecord>
      delete(id: string): Promise<void>
    }
    items: {
      list(query: DictionaryItemListQuery): Promise<DictionaryItemListResponse>
      create(payload: CreateDictionaryItemRequest): Promise<DictionaryItemRecord>
      update(
        id: string,
        payload: UpdateDictionaryItemRequest,
      ): Promise<DictionaryItemRecord>
      delete(id: string): Promise<void>
    }
  }
}

export function listDictionaryTypes(
  query: DictionaryTypeListQuery,
  api: DictionariesManagementApiClient = defaultApi,
) {
  return api.dictionaries.types.list(query)
}

export function createDictionaryType(
  payload: CreateDictionaryTypeRequest,
  api: DictionariesManagementApiClient = defaultApi,
) {
  return api.dictionaries.types.create(payload)
}

export function updateDictionaryType(
  id: string,
  payload: UpdateDictionaryTypeRequest,
  api: DictionariesManagementApiClient = defaultApi,
) {
  return api.dictionaries.types.update(id, payload)
}

export function deleteDictionaryType(
  id: string,
  api: DictionariesManagementApiClient = defaultApi,
) {
  return api.dictionaries.types.delete(id)
}

export function listDictionaryItems(
  query: DictionaryItemListQuery,
  api: DictionariesManagementApiClient = defaultApi,
) {
  return api.dictionaries.items.list(query)
}

export function createDictionaryItem(
  payload: CreateDictionaryItemRequest,
  api: DictionariesManagementApiClient = defaultApi,
) {
  return api.dictionaries.items.create(payload)
}

export function updateDictionaryItem(
  id: string,
  payload: UpdateDictionaryItemRequest,
  api: DictionariesManagementApiClient = defaultApi,
) {
  return api.dictionaries.items.update(id, payload)
}

export function deleteDictionaryItem(
  id: string,
  api: DictionariesManagementApiClient = defaultApi,
) {
  return api.dictionaries.items.delete(id)
}
