import type {
  CreateUserDto,
  ListUsersParams as GeneratedListUsersParams,
  ReplaceUserRolesDto,
  ResetUserPasswordDto,
  UpdateUserDto,
  UserListResponseDto,
  UserResponseDto,
  UserRoleResponseDto,
} from '../../generated/api/schemas'

export type UserRoleSummary = UserRoleResponseDto
export type UserRecord = UserResponseDto
export type UserListResponse = UserListResponseDto
export type CreateUserRequest = CreateUserDto
export type UpdateUserRequest = UpdateUserDto
export type ResetUserPasswordRequest = ResetUserPasswordDto
export type ReplaceUserRolesRequest = ReplaceUserRolesDto
export type ListUsersParams = GeneratedListUsersParams

export interface UserListQuery
  extends Omit<GeneratedListUsersParams, 'page' | 'pageSize'> {
  page: number
  pageSize: number
}
