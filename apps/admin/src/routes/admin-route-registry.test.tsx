// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { messages } from '../i18n/messages'
import {
  adminMenuGroups,
  adminRoutes,
  findAdminRouteByPath,
  getFirstAccessibleRoute,
} from './admin-route-registry'

describe('admin route registry', () => {
  it('flattens grouped routes in menu order', () => {
    expect(adminRoutes.map((route) => route.path)).toEqual([
      '/dashboard',
      '/users',
      '/roles',
      '/permissions',
      '/dictionaries',
      '/files',
      '/audit-logs',
      '/settings',
    ])
  })

  it('keeps existing permission metadata on protected routes', () => {
    expect(findAdminRouteByPath('/roles')?.requiredPermissions).toEqual([
      'role.read',
    ])
    expect(findAdminRouteByPath('/permissions')?.requiredPermissions).toEqual([
      'permission.read',
    ])
    expect(findAdminRouteByPath('/audit-logs')?.requiredPermissions).toEqual([
      'audit_log.read',
    ])
    expect(findAdminRouteByPath('/settings')?.requiredPermissions).toEqual([
      'setting.read',
    ])
  })

  it('defines the admin menu groups', () => {
    expect(adminMenuGroups.map((group) => group.id)).toEqual([
      'workspace',
      'system',
      'resources',
      'observability',
      'configuration',
    ])
  })

  it('defines translations for every admin menu group label', () => {
    for (const group of adminMenuGroups) {
      expect(messages['en-US']).toHaveProperty(group.labelKey)
      expect(messages['zh-CN']).toHaveProperty(group.labelKey)
    }
  })

  it('returns the first accessible route from grouped menu order', () => {
    expect(getFirstAccessibleRoute(['user.read'])?.path).toBe('/users')
  })
})
