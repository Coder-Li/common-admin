export interface UserRoleSummary {
  code: string
  name: string
}

export interface UserProfile {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  roles: UserRoleSummary[]
  permissions: string[]
}

export interface AuthSession {
  accessToken: string
  user: UserProfile
}
