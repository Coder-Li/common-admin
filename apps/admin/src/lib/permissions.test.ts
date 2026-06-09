import { describe, expect, it } from 'vitest'
import { can, canAll, canAny } from './permissions'

describe('permission helpers', () => {
  const permissions = ['user.read', 'user.create', 'role.read']

  it('checks a single permission', () => {
    expect(can(permissions, 'user.read')).toBe(true)
    expect(can(permissions, 'user.delete')).toBe(false)
  })

  it('requires every permission for canAll', () => {
    expect(canAll(permissions, ['user.read', 'role.read'])).toBe(true)
    expect(canAll(permissions, ['user.read', 'role.delete'])).toBe(false)
  })

  it('allows an empty canAll requirement', () => {
    expect(canAll(permissions)).toBe(true)
  })

  it('requires at least one permission for canAny', () => {
    expect(canAny(permissions, ['role.delete', 'role.read'])).toBe(true)
    expect(canAny(permissions, ['role.delete', 'user.delete'])).toBe(false)
  })

  it('allows an empty canAny requirement', () => {
    expect(canAny(permissions)).toBe(true)
  })
})
