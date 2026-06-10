import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { MessageKey } from '../i18n/messages'
import { canAll } from '../lib/permissions'
import type { UserProfile } from '../types/auth'

export interface RouteComponentProps {
  isLoading: boolean
  user: UserProfile | null
}

export interface AdminRouteMeta {
  id: string
  path: string
  labelKey: MessageKey
  requiredPermissions: string[]
  component: ComponentType<RouteComponentProps>
  icon?: LucideIcon
  breadcrumbKey?: MessageKey
  titleKey?: MessageKey
  hideInMenu?: boolean
}

export interface AdminMenuGroup {
  id: string
  labelKey: MessageKey
  icon?: LucideIcon
  order?: number
  children: AdminRouteMeta[]
}

export interface AdminBreadcrumb {
  id: string
  labelKey: MessageKey
}

export function flattenAdminMenuGroups(
  groups: readonly AdminMenuGroup[],
): AdminRouteMeta[] {
  return groups.flatMap((group) => group.children)
}

export function getVisibleAdminMenuGroups(
  groups: readonly AdminMenuGroup[],
  permissions: readonly string[],
): AdminMenuGroup[] {
  return groups
    .map((group) => ({
      ...group,
      children: group.children.filter((route) =>
        isVisibleRoute(route, permissions),
      ),
    }))
    .filter((group) => group.children.length > 0)
}

export function getVisibleAdminRoutes(
  groups: readonly AdminMenuGroup[],
  permissions: readonly string[],
): AdminRouteMeta[] {
  return flattenAdminMenuGroups(getVisibleAdminMenuGroups(groups, permissions))
}

export function getFirstAccessibleRoute(
  groups: readonly AdminMenuGroup[],
  permissions: readonly string[],
): AdminRouteMeta | null {
  const sortedGroups = groups
    .map((group, index) => ({ group, index }))
    .sort((left, right) => {
      const leftOrder = left.group.order ?? left.index
      const rightOrder = right.group.order ?? right.index

      return leftOrder - rightOrder
    })

  for (const { group } of sortedGroups) {
    const route = group.children.find((child) =>
      isVisibleRoute(child, permissions),
    )

    if (route) {
      return route
    }
  }

  return null
}

export function findAdminRouteById(
  routes: readonly AdminRouteMeta[],
  id: string,
): AdminRouteMeta | null {
  return routes.find((route) => route.id === id) ?? null
}

export function findAdminRouteByPath(
  routes: readonly AdminRouteMeta[],
  path: string,
): AdminRouteMeta | null {
  return routes.find((route) => route.path === path) ?? null
}

export function getMenuGroupForRoute(
  groups: readonly AdminMenuGroup[],
  routeId: string,
): AdminMenuGroup | null {
  return (
    groups.find((group) =>
      group.children.some((route) => route.id === routeId),
    ) ?? null
  )
}

export function getBreadcrumbsForRoute(
  groups: readonly AdminMenuGroup[],
  routeId: string,
): AdminBreadcrumb[] {
  const group = getMenuGroupForRoute(groups, routeId)
  const route = group?.children.find((child) => child.id === routeId)

  if (!group || !route || route.hideInMenu) {
    return []
  }

  return [
    { id: group.id, labelKey: group.labelKey },
    { id: route.id, labelKey: route.breadcrumbKey ?? route.labelKey },
  ]
}

function isVisibleRoute(
  route: AdminRouteMeta,
  permissions: readonly string[],
): boolean {
  return !route.hideInMenu && canAll(permissions, route.requiredPermissions)
}
