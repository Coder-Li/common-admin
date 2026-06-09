// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  adminRoutes,
  findAdminRoute,
  getFirstVisibleRoute,
  getVisibleAdminRoutes,
} from './admin-routes'

describe('admin routes', () => {
  it('defines route metadata with permission codes', () => {
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
    expect(findAdminRoute('/roles')?.requiredPermissions).toEqual(['role.read'])
    expect(findAdminRoute('/permissions')?.requiredPermissions).toEqual([
      'permission.read',
    ])
    expect(findAdminRoute('/audit-logs')?.requiredPermissions).toEqual([
      'audit_log.read',
    ])
  })

  it('filters visible routes by required permissions', () => {
    const routes = getVisibleAdminRoutes([
      'dashboard.view',
      'user.read',
      'audit_log.read',
    ])

    expect(routes.map((route) => route.path)).toEqual([
      '/dashboard',
      '/users',
      '/audit-logs',
    ])
  })

  it('hides the audit logs route without audit log read permission', () => {
    const routes = getVisibleAdminRoutes(['dashboard.view', 'user.read'])

    expect(routes.map((route) => route.path)).not.toContain('/audit-logs')
  })

  it('returns the first visible route for login redirects', () => {
    expect(getFirstVisibleRoute(['role.read'])?.path).toBe('/roles')
  })

  it('returns null when no route is visible', () => {
    expect(getFirstVisibleRoute([])).toBeNull()
  })
})
