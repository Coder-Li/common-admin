import type {
  CreateDictionaryItemDto,
  CreateDictionaryTypeDto,
  DictionaryItemListResponseDto,
  DictionaryItemResponseDto,
  DictionaryItemResponseDtoBadgeVariant,
  DictionaryItemResponseDtoStatus,
  DictionaryTypeListResponseDto,
  DictionaryTypeResponseDto,
  DictionaryTypeResponseDtoStatus,
  ListDictionaryItemsParams,
  ListDictionaryTypesParams,
  UpdateDictionaryItemDto,
  UpdateDictionaryTypeDto,
} from '../../generated/api/schemas'

export type DictionaryStatus =
  | DictionaryTypeResponseDtoStatus
  | DictionaryItemResponseDtoStatus

export type DictionaryBadgeVariant = DictionaryItemResponseDtoBadgeVariant

export type DictionaryTypeListQuery = Omit<
  ListDictionaryTypesParams,
  'page' | 'pageSize'
> & {
  page: number
  pageSize: number
}
export type DictionaryTypeRecord = DictionaryTypeResponseDto
export type DictionaryTypeListResponse = DictionaryTypeListResponseDto
export type CreateDictionaryTypeRequest = CreateDictionaryTypeDto
export type UpdateDictionaryTypeRequest = UpdateDictionaryTypeDto

export type DictionaryItemListQuery = Omit<
  ListDictionaryItemsParams,
  'page' | 'pageSize'
> & {
  page: number
  pageSize: number
}
export type DictionaryItemRecord = DictionaryItemResponseDto
export type DictionaryItemListResponse = DictionaryItemListResponseDto
export type CreateDictionaryItemRequest = CreateDictionaryItemDto
export type UpdateDictionaryItemRequest = UpdateDictionaryItemDto
