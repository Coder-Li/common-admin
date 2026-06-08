import type { Role } from '../../features/users/users.types'
import type { DictionaryOption } from './dictionaries.types'

const roleValues = ['ADMIN', 'STANDARD'] as const satisfies readonly Role[]
const roleValueSet = new Set<string>(roleValues)

export type RoleFallbackLabels = Record<Role, string>
export type RoleDictionaryOption = DictionaryOption & { value: Role }

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

export function filterRoleOptions(options: DictionaryOption[]) {
  return options.filter((option): option is RoleDictionaryOption =>
    roleValueSet.has(option.value),
  )
}

export function mergeRoleFallbackOptions(
  options: DictionaryOption[],
  fallbackLabels: RoleFallbackLabels,
): RoleDictionaryOption[] {
  const filteredOptions = filterRoleOptions(options)
  const existingValues = new Set(filteredOptions.map((option) => option.value))
  const fallbackOptions = roleValues
    .filter((role) => !existingValues.has(role))
    .map((role): RoleDictionaryOption => ({
      value: role,
      label: fallbackLabels[role],
      isDefault: false,
    }))

  return [...filteredOptions, ...fallbackOptions]
}
