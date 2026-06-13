export function splitMimeInput(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function joinMimeTypes(values: readonly string[]) {
  return values.join(', ')
}

export function hasPermission(
  permissions: readonly string[],
  permission: string,
) {
  return permissions.includes(permission)
}
