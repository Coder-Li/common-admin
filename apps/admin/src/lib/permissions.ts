export function can(permissions: readonly string[], permission: string) {
  return permissions.includes(permission)
}

export function canAll(
  permissions: readonly string[],
  required: readonly string[] = [],
) {
  return required.every((permission) => can(permissions, permission))
}

export function canAny(
  permissions: readonly string[],
  required: readonly string[] = [],
) {
  return (
    required.length === 0 ||
    required.some((permission) => can(permissions, permission))
  )
}
