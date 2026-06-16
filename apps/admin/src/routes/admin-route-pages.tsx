import { lazy } from 'react'

export const DashboardContent = lazy(() =>
  import('../pages/DashboardContent').then((module) => ({
    default: module.DashboardContent,
  })),
)

export const UsersPage = lazy(() =>
  import('../features/users/UsersPage').then((module) => ({
    default: module.UsersPage,
  })),
)

export const RolesPage = lazy(() =>
  import('../features/roles/RolesPage').then((module) => ({
    default: module.RolesPage,
  })),
)

export const PermissionsPage = lazy(() =>
  import('../features/permissions/PermissionsPage').then((module) => ({
    default: module.PermissionsPage,
  })),
)

export const SessionManagementPage = lazy(() =>
  import('../features/session-management/SessionManagementPage').then(
    (module) => ({
      default: module.SessionManagementPage,
    }),
  ),
)

export const DepartmentsPage = lazy(() =>
  import('../features/departments/DepartmentsPage').then((module) => ({
    default: module.DepartmentsPage,
  })),
)

export const PositionsPage = lazy(() =>
  import('../features/positions/PositionsPage').then((module) => ({
    default: module.PositionsPage,
  })),
)

export const DictionariesPage = lazy(() =>
  import('../features/dictionaries/DictionariesPage').then((module) => ({
    default: module.DictionariesPage,
  })),
)

export const FilesPage = lazy(() =>
  import('../features/files/FilesPage').then((module) => ({
    default: module.FilesPage,
  })),
)

export const AuditLogsPage = lazy(() =>
  import('../features/audit-logs/AuditLogsPage').then((module) => ({
    default: module.AuditLogsPage,
  })),
)

export const BasicSettingsPage = lazy(() =>
  import('../features/settings/BasicSettingsPage').then((module) => ({
    default: module.BasicSettingsPage,
  })),
)

export const UploadSettingsPage = lazy(() =>
  import('../features/settings/UploadSettingsPage').then((module) => ({
    default: module.UploadSettingsPage,
  })),
)

export const CacheSettingsPage = lazy(() =>
  import('../features/settings/CacheSettingsPage').then((module) => ({
    default: module.CacheSettingsPage,
  })),
)

export const SystemInfoPage = lazy(() =>
  import('../features/settings/SystemInfoPage').then((module) => ({
    default: module.SystemInfoPage,
  })),
)
