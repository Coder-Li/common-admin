export type Role = 'ADMIN' | 'STANDARD'

export interface UserProfile {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  role: Role
}

export interface AuthSession {
  accessToken: string
  user: UserProfile
}
