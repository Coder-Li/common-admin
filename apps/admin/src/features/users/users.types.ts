import type {
  CreateUserDto,
  DepartmentOptionDto,
  GetDepartmentOptionsParams,
  GetPositionOptionsParams,
  ListUsersParams as GeneratedListUsersParams,
  PositionOptionDto,
  ReplaceUserRolesDto,
  ResetUserPasswordDto,
  UpdateUserDto,
  UserListResponseDto,
  UserOrganizationSummaryDto,
  UserResponseDto,
  UserRoleResponseDto,
} from '../../generated/api/schemas'

export type UserOrganizationSummary = UserOrganizationSummaryDto
export type UserDepartmentOption = DepartmentOptionDto
export type UserPositionOption = PositionOptionDto
export type UserRoleSummary = UserRoleResponseDto
export type UserRecord = UserResponseDto
export type UserListResponse = UserListResponseDto
export type CreateUserRequest = CreateUserDto
export type UpdateUserRequest = UpdateUserDto
export type ResetUserPasswordRequest = ResetUserPasswordDto
export type ReplaceUserRolesRequest = ReplaceUserRolesDto
export type ListUsersParams = GeneratedListUsersParams
export type DepartmentOptionsParams = GetDepartmentOptionsParams
export type PositionOptionsParams = GetPositionOptionsParams

export interface UserListQuery
  extends Omit<GeneratedListUsersParams, 'page' | 'pageSize'> {
  page: number
  pageSize: number
}
