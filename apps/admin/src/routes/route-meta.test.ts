import type { ComponentType } from 'react'
import { describe, expect, it } from 'vitest'
import type { MessageKey } from '../i18n/messages'
import {
  findAdminRouteById,
  findAdminRouteByPath,
  flattenAdminMenuGroups,
  getBreadcrumbsForRoute,
  getFirstAccessibleRoute,
  getMenuGroupForRoute,
  getVisibleAdminMenuGroups,
  type AdminMenuGroup,
  type RouteComponentProps,
} from './route-meta'

const FakePage: ComponentType<RouteComponentProps> = () => null

const route = (
  id: string,
  path: string,
  requiredPermissions: string[],
  options: {
    labelKey?: MessageKey
    breadcrumbKey?: MessageKey
    hideInMenu?: boolean
  } = {},
) => ({
  id,
  path,
  labelKey: options.labelKey ?? 'nav.users',
  breadcrumbKey: options.breadcrumbKey,
  requiredPermissions,
  component: FakePage,
  hideInMenu: options.hideInMenu,
})

const groups: AdminMenuGroup[] = [
  {
    id: 'workspace',
    labelKey: 'nav.dashboard',
    children: [
      route('dashboard', '/dashboard', ['dashboard.view']),
      route('reports', '/reports', ['reports.read']),
    ],
  },
  {
    id: 'system',
    labelKey: 'nav.users',
    children: [
      route('users', '/users', ['user.read'], {
        labelKey: 'nav.users',
        breadcrumbKey: 'users.title',
      }),
      route('roles', '/roles', ['role.read'], { labelKey: 'nav.roles' }),
    ],
  },
]

describe('route metadata helpers', () => {
  it('flattens admin menu groups while preserving group and child order', () => {
    expect(flattenAdminMenuGroups(groups).map((item) => item.id)).toEqual([
      'dashboard',
      'reports',
      'users',
      'roles',
    ])
  })

  it('filters visible admin menu groups by required permissions', () => {
    const visibleGroups = getVisibleAdminMenuGroups(groups, [
      'user.read',
      'role.read',
    ])

    expect(visibleGroups.map((group) => group.id)).toEqual(['system'])
    expect(visibleGroups[0].children.map((child) => child.id)).toEqual([
      'users',
      'roles',
    ])
  })

  it('hides empty groups from visible menus', () => {
    expect(getVisibleAdminMenuGroups(groups, []).map((group) => group.id)).toEqual(
      [],
    )
  })

  it('excludes hideInMenu routes from visible menus', () => {
    const hiddenGroups: AdminMenuGroup[] = [
      {
        id: 'system',
        labelKey: 'nav.users',
        children: [
          route('users', '/users', ['user.read'], { hideInMenu: true }),
          route('roles', '/roles', ['role.read']),
        ],
      },
    ]

    const visibleGroups = getVisibleAdminMenuGroups(hiddenGroups, [
      'user.read',
      'role.read',
    ])

    expect(visibleGroups[0].children.map((child) => child.id)).toEqual([
      'roles',
    ])
  })

  it('returns the first accessible route by group order and child order', () => {
    const orderedGroups: AdminMenuGroup[] = [
      {
        id: 'second',
        labelKey: 'nav.users',
        order: 20,
        children: [route('users', '/users', ['user.read'])],
      },
      {
        id: 'first',
        labelKey: 'nav.dashboard',
        order: 10,
        children: [
          route('dashboard', '/dashboard', ['dashboard.view']),
          route('reports', '/reports', ['reports.read']),
        ],
      },
    ]

    expect(
      getFirstAccessibleRoute(orderedGroups, ['reports.read', 'user.read'])
        ?.path,
    ).toBe('/reports')
  })

  it('finds admin routes by id and path', () => {
    const routes = flattenAdminMenuGroups(groups)

    expect(findAdminRouteById(routes, 'roles')?.path).toBe('/roles')
    expect(findAdminRouteByPath(routes, '/users')?.id).toBe('users')
  })

  it('returns the owning menu group for a route', () => {
    expect(getMenuGroupForRoute(groups, 'roles')?.id).toBe('system')
  })

  it('returns group and route breadcrumbs for a route', () => {
    expect(getBreadcrumbsForRoute(groups, 'users')).toEqual([
      { id: 'system', labelKey: 'nav.users' },
      { id: 'users', labelKey: 'users.title' },
    ])
  })
})
