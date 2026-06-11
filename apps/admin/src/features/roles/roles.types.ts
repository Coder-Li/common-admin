import type {
  CreateRoleDto,
  ListRolesParams as GeneratedListRolesParams,
  PermissionModuleResponseDto,
  PermissionResponseDto,
  RoleListResponseDto,
  RolePermissionSummaryDto,
  RoleResponseDto,
  UpdateRoleDto,
} from '../../generated/api/schemas'

export type RoleStatus = RoleResponseDto['status']
export type PermissionStatus = PermissionResponseDto['status']

export type RolePermissionSummary = RolePermissionSummaryDto

export type RoleRecord = RoleResponseDto

export type RoleListResponse = RoleListResponseDto

export type CreateRoleRequest = Omit<CreateRoleDto, 'description'> & {
  description?: string | null
}

export type UpdateRoleRequest = Omit<UpdateRoleDto, 'description'> & {
  description?: string | null
}

export type ListRolesParams = GeneratedListRolesParams

export interface RoleListQuery
  extends Omit<GeneratedListRolesParams, 'page' | 'pageSize'> {
  page: number
  pageSize: number
}

export type PermissionRecord = PermissionResponseDto

export type PermissionModule = PermissionModuleResponseDto
