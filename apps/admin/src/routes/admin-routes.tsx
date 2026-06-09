import type { ComponentType } from 'react'
import {
  BookOpen,
  ClipboardList,
  Folder,
  KeyRound,
  Lock,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { PermissionsPage } from '../features/permissions/PermissionsPage'
import { AuditLogsPage } from '../features/audit-logs/AuditLogsPage'
import { DictionariesPage } from '../features/dictionaries/DictionariesPage'
import { FilesPage } from '../features/files/FilesPage'
import { RolesPage } from '../features/roles/RolesPage'
import { UsersPage } from '../features/users/UsersPage'
import type { MessageKey } from '../i18n/messages'
import { DashboardContent } from '../pages/DashboardContent'
import { SettingsPlaceholderPage } from '../pages/SettingsPlaceholderPage'
import { canAll } from '../lib/permissions'
import type { UserProfile } from '../types/auth'

export interface RouteComponentProps {
  isLoading: boolean
  user: UserProfile | null
}

export interface AdminRoute {
  path: string
  labelKey: MessageKey
  requiredPermissions: string[]
  icon: LucideIcon
  component: ComponentType<RouteComponentProps>
}

export const adminRoutes: AdminRoute[] = [
  {
    path: '/dashboard',
    labelKey: 'nav.dashboard',
    requiredPermissions: ['dashboard.view'],
    icon: Lock,
    component: DashboardContent,
  },
  {
    path: '/users',
    labelKey: 'nav.users',
    requiredPermissions: ['user.read'],
    icon: Users,
    component: UsersPage,
  },
  {
    path: '/roles',
    labelKey: 'nav.roles',
    requiredPermissions: ['role.read'],
    icon: KeyRound,
    component: RolesPage,
  },
  {
    path: '/permissions',
    labelKey: 'nav.permissions',
    requiredPermissions: ['permission.read'],
    icon: ShieldCheck,
    component: PermissionsPage,
  },
  {
    path: '/dictionaries',
    labelKey: 'nav.dictionaries',
    requiredPermissions: ['dictionary.read'],
    icon: BookOpen,
    component: DictionariesPage,
  },
  {
    path: '/files',
    labelKey: 'nav.files',
    requiredPermissions: ['file.read'],
    icon: Folder,
    component: FilesPage,
  },
  {
    path: '/audit-logs',
    labelKey: 'nav.auditLogs',
    requiredPermissions: ['audit_log.read'],
    icon: ClipboardList,
    component: AuditLogsPage,
  },
  {
    path: '/settings',
    labelKey: 'nav.settings',
    requiredPermissions: ['setting.read'],
    icon: Settings,
    component: SettingsPlaceholderPage,
  },
]

export function findAdminRoute(path: string) {
  return adminRoutes.find((route) => route.path === path) ?? null
}

export function getVisibleAdminRoutes(permissions: readonly string[]) {
  return adminRoutes.filter((route) =>
    canAll(permissions, route.requiredPermissions),
  )
}

export function getFirstVisibleRoute(permissions: readonly string[]) {
  return getVisibleAdminRoutes(permissions)[0] ?? null
}
