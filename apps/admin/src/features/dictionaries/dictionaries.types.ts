export type DictionaryStatus = 'ACTIVE' | 'DISABLED'

export type DictionaryBadgeVariant =
  | 'DEFAULT'
  | 'SUCCESS'
  | 'WARNING'
  | 'DANGER'
  | 'NEUTRAL'

export interface DictionaryTypeListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
  status?: DictionaryStatus
  isSystem?: boolean
}

export interface DictionaryTypeRecord {
  id: string
  code: string
  name: string
  status: DictionaryStatus
  isSystem: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export interface DictionaryTypeListResponse {
  items: DictionaryTypeRecord[]
  total: number
  page: number
  pageSize: number
}

export interface CreateDictionaryTypeRequest {
  code: string
  name: string
  status?: DictionaryStatus
  description?: string
}

export interface UpdateDictionaryTypeRequest {
  name?: string
  status?: DictionaryStatus
  description?: string | null
}

export interface DictionaryItemListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
  typeId?: string
  typeCode?: string
  status?: DictionaryStatus
  isDefault?: boolean
}

export interface DictionaryItemRecord {
  id: string
  typeId: string
  typeCode: string
  typeName: string
  value: string
  label: string
  sortOrder: number
  status: DictionaryStatus
  isSystem: boolean
  isDefault: boolean
  badgeVariant?: DictionaryBadgeVariant
  metadata?: Record<string, unknown>
  description?: string
  createdAt: string
  updatedAt: string
}

export interface DictionaryItemListResponse {
  items: DictionaryItemRecord[]
  total: number
  page: number
  pageSize: number
}

export interface CreateDictionaryItemRequest {
  typeId: string
  value: string
  label: string
  sortOrder?: number
  status?: DictionaryStatus
  isDefault?: boolean
  badgeVariant?: DictionaryBadgeVariant
  metadata?: Record<string, unknown>
  description?: string
}

export interface UpdateDictionaryItemRequest {
  label?: string
  sortOrder?: number
  status?: DictionaryStatus
  isDefault?: boolean
  badgeVariant?: DictionaryBadgeVariant | null
  metadata?: Record<string, unknown>
  description?: string | null
}
