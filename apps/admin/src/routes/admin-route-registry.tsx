import {
  BarChart3,
  ClipboardList,
  Database,
  FileArchive,
  Folder,
  Lock,
  Shield,
  Settings,
  Users,
} from 'lucide-react'
import { PermissionsPage } from '../features/permissions/PermissionsPage'
import { AuditLogsPage } from '../features/audit-logs/AuditLogsPage'
import { DictionariesPage } from '../features/dictionaries/DictionariesPage'
import { FilesPage } from '../features/files/FilesPage'
import { RolesPage } from '../features/roles/RolesPage'
import { UsersPage } from '../features/users/UsersPage'
import { DashboardContent } from '../pages/DashboardContent'
import { SettingsPlaceholderPage } from '../pages/SettingsPlaceholderPage'
import {
  findAdminRouteById as findRouteById,
  findAdminRouteByPath as findRouteByPath,
  flattenAdminMenuGroups,
  getBreadcrumbsForRoute as getRouteBreadcrumbs,
  getFirstAccessibleRoute as getFirstRoute,
  getMenuGroupForRoute as getRouteMenuGroup,
  getVisibleAdminMenuGroups as getVisibleGroups,
  getVisibleAdminRoutes as getVisibleRoutes,
  type AdminMenuGroup,
  type AdminRouteMeta,
} from './route-meta'

export const dashboardRoute: AdminRouteMeta = {
  id: 'dashboard',
  path: '/dashboard',
  labelKey: 'nav.dashboard',
  requiredPermissions: ['dashboard.view'],
  component: DashboardContent,
  icon: BarChart3,
}

export const usersRoute: AdminRouteMeta = {
  id: 'users',
  path: '/users',
  labelKey: 'nav.users',
  requiredPermissions: ['user.read'],
  component: UsersPage,
  icon: Users,
}

export const rolesRoute: AdminRouteMeta = {
  id: 'roles',
  path: '/roles',
  labelKey: 'nav.roles',
  requiredPermissions: ['role.read'],
  component: RolesPage,
  icon: Shield,
}

export const permissionsRoute: AdminRouteMeta = {
  id: 'permissions',
  path: '/permissions',
  labelKey: 'nav.permissions',
  requiredPermissions: ['permission.read'],
  component: PermissionsPage,
  icon: Lock,
}

export const dictionariesRoute: AdminRouteMeta = {
  id: 'dictionaries',
  path: '/dictionaries',
  labelKey: 'nav.dictionaries',
  requiredPermissions: ['dictionary.read'],
  component: DictionariesPage,
  icon: Database,
}

export const filesRoute: AdminRouteMeta = {
  id: 'files',
  path: '/files',
  labelKey: 'nav.files',
  requiredPermissions: ['file.read'],
  component: FilesPage,
  icon: FileArchive,
}

export const auditLogsRoute: AdminRouteMeta = {
  id: 'audit-logs',
  path: '/audit-logs',
  labelKey: 'nav.auditLogs',
  requiredPermissions: ['audit_log.read'],
  component: AuditLogsPage,
  icon: ClipboardList,
}

export const settingsRoute: AdminRouteMeta = {
  id: 'settings',
  path: '/settings',
  labelKey: 'nav.settings',
  requiredPermissions: ['setting.read'],
  component: SettingsPlaceholderPage,
  icon: Settings,
}

export const adminMenuGroups: AdminMenuGroup[] = [
  {
    id: 'workspace',
    labelKey: 'nav.group.workspace',
    icon: Lock,
    children: [dashboardRoute],
  },
  {
    id: 'system',
    labelKey: 'nav.group.system',
    icon: Users,
    children: [usersRoute, rolesRoute, permissionsRoute],
  },
  {
    id: 'resources',
    labelKey: 'nav.group.resources',
    icon: Folder,
    children: [dictionariesRoute, filesRoute],
  },
  {
    id: 'observability',
    labelKey: 'nav.group.observability',
    icon: ClipboardList,
    children: [auditLogsRoute],
  },
  {
    id: 'configuration',
    labelKey: 'nav.group.configuration',
    icon: Settings,
    children: [settingsRoute],
  },
]

export const adminRoutes = flattenAdminMenuGroups(adminMenuGroups)

export function getVisibleAdminMenuGroups(permissions: readonly string[]) {
  return getVisibleGroups(adminMenuGroups, permissions)
}

export function getVisibleAdminRoutes(permissions: readonly string[]) {
  return getVisibleRoutes(adminMenuGroups, permissions)
}

export function getFirstAccessibleRoute(permissions: readonly string[]) {
  return getFirstRoute(adminMenuGroups, permissions)
}

export function findAdminRouteByPath(path: string) {
  return findRouteByPath(adminRoutes, path)
}

export function findAdminRouteById(id: string) {
  return findRouteById(adminRoutes, id)
}

export function getMenuGroupForRoute(routeId: string) {
  return getRouteMenuGroup(adminMenuGroups, routeId)
}

export function getBreadcrumbsForRoute(routeId: string) {
  return getRouteBreadcrumbs(adminMenuGroups, routeId)
}
