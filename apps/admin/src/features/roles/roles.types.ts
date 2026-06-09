import type { ListResponse } from '../../lib/api'

export type RoleStatus = 'ACTIVE' | 'DISABLED'
export type PermissionStatus = 'ACTIVE' | 'DISABLED'

export interface RoleListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
  status?: RoleStatus
}

export interface RolePermissionSummary {
  code: string
  name: string
}

export interface RoleRecord {
  id: string
  code: string
  name: string
  description: string | null
  status: RoleStatus
  isSystem: boolean
  isDefault: boolean
  permissions: RolePermissionSummary[]
  createdAt: string
  updatedAt: string
}

export type RoleListResponse = ListResponse<RoleRecord>

export interface CreateRoleRequest {
  code: string
  name: string
  description?: string | null
  isDefault?: boolean
}

export interface UpdateRoleRequest {
  name?: string
  description?: string | null
  status?: RoleStatus
  isDefault?: boolean
}

export interface PermissionRecord {
  id: string
  code: string
  module: string
  action: string
  name: string
  description: string | null
  status: PermissionStatus
  sortOrder: number
}

export interface PermissionModule {
  module: string
  permissions: PermissionRecord[]
}
