export type DictionaryBadgeVariant =
  | 'DEFAULT'
  | 'SUCCESS'
  | 'WARNING'
  | 'DANGER'
  | 'NEUTRAL'

export interface DictionaryOption {
  value: string
  label: string
  badgeVariant?: DictionaryBadgeVariant
  isDefault: boolean
  metadata?: Record<string, unknown>
}

export interface DictionaryOptionsResponse {
  typeCode: string
  items: DictionaryOption[]
}

export interface DictionaryOptionsMapResponse {
  dictionaries: Record<string, DictionaryOption[]>
}
