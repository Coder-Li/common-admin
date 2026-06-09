import type { DictionaryOption } from './dictionaries.types'

export function getDictionaryOption(
  options: DictionaryOption[],
  value: string,
) {
  return options.find((option) => option.value === value)
}

export function getDictionaryLabel(
  options: DictionaryOption[],
  value: string,
  fallback = value,
) {
  return getDictionaryOption(options, value)?.label ?? fallback
}
