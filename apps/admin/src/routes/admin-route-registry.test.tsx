// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { messages } from '../i18n/messages'
import {
  adminMenuGroups,
  adminRoutes,
  findAdminRouteByPath,
  getFirstAccessibleRoute,
  getVisibleAdminRoutes,
} from './admin-route-registry'

describe('admin route registry', () => {
  it('flattens grouped routes in menu order', () => {
    expect(adminRoutes.map((route) => route.path)).toEqual([
      '/dashboard',
      '/users',
      '/roles',
      '/permissions',
      '/session-management',
      '/departments',
      '/positions',
      '/dictionaries',
      '/files',
      '/audit-logs',
      '/settings/basic',
      '/settings/upload',
      '/settings/cache',
      '/settings/system-info',
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
    expect(findAdminRouteByPath('/session-management')).toMatchObject({
      id: 'session-management',
      labelKey: 'nav.sessionManagement',
      requiredPermissions: ['user_session.read'],
    })
    expect(findAdminRouteByPath('/departments')).toMatchObject({
      requiredPermissions: ['department.read'],
    })
    expect(findAdminRouteByPath('/positions')).toMatchObject({
      requiredPermissions: ['position.read'],
    })
    expect(findAdminRouteByPath('/audit-logs')?.requiredPermissions).toEqual([
      'audit_log.read',
    ])
    expect(findAdminRouteByPath('/settings/basic')?.requiredPermissions).toEqual([
      'setting.read',
    ])
    expect(findAdminRouteByPath('/settings')?.requiredPermissions).toEqual([
      'setting.read',
    ])
    expect(findAdminRouteByPath('/settings')?.hideInMenu).toBe(true)
  })

  it('defines the admin menu groups', () => {
    expect(adminMenuGroups.map((group) => group.id)).toEqual([
      'workspace',
      'system',
      'resources',
      'observability',
      'settings',
    ])
    expect(adminMenuGroups.find((group) => group.id === 'settings')?.labelKey).toBe(
      'nav.group.settings',
    )
  })

  it('defines translations for every admin menu group label', () => {
    for (const group of adminMenuGroups) {
      expect(messages['en-US']).toHaveProperty(group.labelKey)
      expect(messages['zh-CN']).toHaveProperty(group.labelKey)
    }
  })

  it('defines translations for the session management nav label', () => {
    expect(messages['en-US']).toHaveProperty('nav.sessionManagement')
    expect(messages['zh-CN']).toHaveProperty('nav.sessionManagement')
  })

  it('defines translations for the organization nav labels', () => {
    expect(messages['en-US']).toHaveProperty('nav.departments')
    expect(messages['zh-CN']).toHaveProperty('nav.departments')
    expect(messages['en-US']).toHaveProperty('nav.positions')
    expect(messages['zh-CN']).toHaveProperty('nav.positions')
  })

  it('shows organization routes only with their read permissions', () => {
    expect(
      getVisibleAdminRoutes(['department.read', 'position.read']).map(
        (route) => route.path,
      ),
    ).toEqual(['/departments', '/positions'])
    expect(
      getVisibleAdminRoutes(['department.read']).map((route) => route.path),
    ).toEqual(['/departments'])
    expect(
      getVisibleAdminRoutes(['position.read']).map((route) => route.path),
    ).toEqual(['/positions'])
    const paths = getVisibleAdminRoutes(['user.read']).map((route) => route.path)

    expect(paths).not.toContain('/departments')
    expect(paths).not.toContain('/positions')
  })

  it('returns the first accessible route from grouped menu order', () => {
    expect(getFirstAccessibleRoute(['user.read'])?.path).toBe('/users')
  })
})
