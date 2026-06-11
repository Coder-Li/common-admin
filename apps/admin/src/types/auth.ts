import type {
  AuthResponseDto,
  UserProfileDto,
  UserRoleSummaryDto,
} from '../generated/api/schemas'

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous'

export type UserRoleSummary = UserRoleSummaryDto
export type UserProfile = UserProfileDto
export type AuthSession = AuthResponseDto
