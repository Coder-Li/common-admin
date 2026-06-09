import { api as defaultApi } from '../../app/api-client'
import type {
  CreateUserRequest,
  ResetUserPasswordRequest,
  UpdateUserRequest,
  UserListQuery,
  UserListResponse,
  UserRecord,
} from './users.types'

export interface UsersApiClient {
  users: {
    list(query: UserListQuery): Promise<UserListResponse>
    create(payload: CreateUserRequest): Promise<UserRecord>
    update(id: string, payload: UpdateUserRequest): Promise<UserRecord>
    delete(id: string): Promise<void>
    replaceRoles(id: string, roleCodes: string[]): Promise<UserRecord>
    resetPassword(id: string, payload: ResetUserPasswordRequest): Promise<void>
  }
}

export function listUsers(
  query: UserListQuery,
  api: UsersApiClient = defaultApi,
) {
  return api.users.list(query)
}

export function createUser(
  payload: CreateUserRequest,
  api: UsersApiClient = defaultApi,
) {
  return api.users.create(payload)
}

export function updateUser(
  id: string,
  payload: UpdateUserRequest,
  api: UsersApiClient = defaultApi,
) {
  return api.users.update(id, payload)
}

export function deleteUser(id: string, api: UsersApiClient = defaultApi) {
  return api.users.delete(id)
}

export function replaceUserRoles(
  id: string,
  roleCodes: string[],
  api: UsersApiClient = defaultApi,
) {
  return api.users.replaceRoles(id, roleCodes)
}

export function resetUserPassword(
  id: string,
  payload: ResetUserPasswordRequest,
  api: UsersApiClient = defaultApi,
) {
  return api.users.resetPassword(id, payload)
}
