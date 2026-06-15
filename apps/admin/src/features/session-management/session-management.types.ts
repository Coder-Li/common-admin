import type {
  UserSessionListResponseDto,
  UserSessionResponseDto,
  UserSessionResponseDtoStatus,
} from '../../generated/api/schemas'

export type SessionRecord = UserSessionResponseDto
export type SessionStatus = UserSessionResponseDtoStatus
export type SessionListResponse = UserSessionListResponseDto
export interface SessionListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
  status?: SessionStatus
  userId?: string
  ipAddress?: string
  dateFrom?: string
  dateTo?: string
}
