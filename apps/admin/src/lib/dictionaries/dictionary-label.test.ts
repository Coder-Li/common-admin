import { describe, expect, it } from 'vitest'
import type { DictionaryOption } from './dictionaries.types'
import { getDictionaryLabel } from './dictionary-label'

const options: DictionaryOption[] = [
  {
    value: 'ADMIN',
    label: 'Admin',
    badgeVariant: 'DANGER',
    isDefault: false,
  },
  {
    value: 'STANDARD',
    label: 'Standard',
    badgeVariant: 'NEUTRAL',
    isDefault: true,
  },
]

describe('dictionary label helpers', () => {
  it('returns the option label when the dictionary value exists', () => {
    expect(getDictionaryLabel(options, 'ADMIN', 'ADMIN')).toBe('Admin')
  })

  it('returns the fallback when the dictionary value is missing', () => {
    expect(getDictionaryLabel(options, 'MISSING', 'MISSING')).toBe('MISSING')
  })
})
