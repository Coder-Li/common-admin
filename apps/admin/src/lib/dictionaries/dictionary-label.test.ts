import { describe, expect, it } from 'vitest'
import type { DictionaryOption } from './dictionaries.types'
import {
  filterRoleOptions,
  getDictionaryLabel,
  mergeRoleFallbackOptions,
} from './dictionary-label'

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

  it('filters role options to values supported by the local role union', () => {
    expect([
      ...filterRoleOptions([
        ...options,
        {
          value: 'MANAGER',
          label: 'Manager',
          isDefault: false,
        },
      ]),
    ]).toEqual(options)
  })

  it('merges missing role fallback options without replacing dictionary labels', () => {
    expect(
      mergeRoleFallbackOptions(
        [
          {
            value: 'ADMIN',
            label: 'Administrator',
            isDefault: false,
          },
        ],
        {
          ADMIN: 'Admin',
          STANDARD: 'Standard',
        },
      ),
    ).toEqual([
      {
        value: 'ADMIN',
        label: 'Administrator',
        isDefault: false,
      },
      {
        value: 'STANDARD',
        label: 'Standard',
        isDefault: false,
      },
    ])
  })
})
