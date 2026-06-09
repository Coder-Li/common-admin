export interface UserRoleSummary {
  code: string
  name: string
}

export interface UserListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
  roleCode?: string
}

export interface UserRecord {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  roles: UserRoleSummary[]
  createdAt: string
  updatedAt: string
}

export interface UserListResponse {
  items: UserRecord[]
  total: number
  page: number
  pageSize: number
}

export interface CreateUserRequest {
  email: string
  username: string
  firstName: string
  lastName: string
  password: string
  roleCodes?: string[]
}

export interface UpdateUserRequest {
  email?: string
  username?: string
  firstName?: string
  lastName?: string
}
