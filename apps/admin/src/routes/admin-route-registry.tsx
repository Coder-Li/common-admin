import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Database,
  FileArchive,
  Folder,
  Info,
  Lock,
  MonitorCog,
  RefreshCcw,
  Shield,
  Settings,
  Upload,
  Users,
} from 'lucide-react'
import { PermissionsPage } from '../features/permissions/PermissionsPage'
import { AuditLogsPage } from '../features/audit-logs/AuditLogsPage'
import { DepartmentsPage } from '../features/departments/DepartmentsPage'
import { DictionariesPage } from '../features/dictionaries/DictionariesPage'
import { FilesPage } from '../features/files/FilesPage'
import { PositionsPage } from '../features/positions/PositionsPage'
import { RolesPage } from '../features/roles/RolesPage'
import { SessionManagementPage } from '../features/session-management/SessionManagementPage'
import { BasicSettingsPage } from '../features/settings/BasicSettingsPage'
import { CacheSettingsPage } from '../features/settings/CacheSettingsPage'
import { SystemInfoPage } from '../features/settings/SystemInfoPage'
import { UploadSettingsPage } from '../features/settings/UploadSettingsPage'
import { UsersPage } from '../features/users/UsersPage'
import { DashboardContent } from '../pages/DashboardContent'
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

export const sessionManagementRoute: AdminRouteMeta = {
  id: 'session-management',
  path: '/session-management',
  labelKey: 'nav.sessionManagement',
  requiredPermissions: ['user_session.read'],
  component: SessionManagementPage,
  icon: MonitorCog,
}

export const departmentsRoute: AdminRouteMeta = {
  id: 'departments',
  path: '/departments',
  labelKey: 'nav.departments',
  requiredPermissions: ['department.read'],
  component: DepartmentsPage,
  icon: Building2,
}

export const positionsRoute: AdminRouteMeta = {
  id: 'positions',
  path: '/positions',
  labelKey: 'nav.positions',
  requiredPermissions: ['position.read'],
  component: PositionsPage,
  icon: BriefcaseBusiness,
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

export const settingsBasicRoute: AdminRouteMeta = {
  id: 'settings-basic',
  path: '/settings/basic',
  labelKey: 'nav.settingsBasic',
  requiredPermissions: ['setting.read'],
  component: BasicSettingsPage,
  icon: Settings,
}

export const settingsUploadRoute: AdminRouteMeta = {
  id: 'settings-upload',
  path: '/settings/upload',
  labelKey: 'nav.settingsUpload',
  requiredPermissions: ['setting.read'],
  component: UploadSettingsPage,
  icon: Upload,
}

export const settingsCacheRoute: AdminRouteMeta = {
  id: 'settings-cache',
  path: '/settings/cache',
  labelKey: 'nav.settingsCache',
  requiredPermissions: ['setting.read'],
  component: CacheSettingsPage,
  icon: RefreshCcw,
}

export const settingsSystemInfoRoute: AdminRouteMeta = {
  id: 'settings-system-info',
  path: '/settings/system-info',
  labelKey: 'nav.settingsSystemInfo',
  requiredPermissions: ['setting.read'],
  component: SystemInfoPage,
  icon: Info,
}

export const settingsIndexRoute: AdminRouteMeta = {
  id: 'settings-index',
  path: '/settings',
  labelKey: 'nav.settings',
  requiredPermissions: ['setting.read'],
  component: BasicSettingsPage,
  icon: Settings,
  hideInMenu: true,
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
    children: [
      usersRoute,
      rolesRoute,
      permissionsRoute,
      sessionManagementRoute,
      departmentsRoute,
      positionsRoute,
    ],
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
    id: 'settings',
    labelKey: 'nav.group.settings',
    icon: Settings,
    children: [
      settingsBasicRoute,
      settingsUploadRoute,
      settingsCacheRoute,
      settingsSystemInfoRoute,
      settingsIndexRoute,
    ],
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
