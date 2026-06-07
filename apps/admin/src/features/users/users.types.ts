export type Role = 'ADMIN' | 'STANDARD'

export interface UserListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
  role?: Role
}

export interface UserRecord {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  role: Role
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
  role: Role
}

export interface UpdateUserRequest {
  email?: string
  username?: string
  firstName?: string
  lastName?: string
  role?: Role
}
