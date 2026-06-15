import type {
  CreatePositionDto,
  ListPositionsParams,
  PositionListResponseDto,
  PositionResponseDto,
  UpdatePositionDto,
} from '../../generated/api/schemas'

export type PositionRecord = PositionResponseDto
export type PositionListResponse = PositionListResponseDto
export type PositionListQuery = ListPositionsParams & {
  page: number
  pageSize: number
}
export type CreatePositionRequest = CreatePositionDto
export type UpdatePositionRequest = UpdatePositionDto

export interface PositionFormValue {
  code: string
  name: string
  status: 'ACTIVE' | 'DISABLED'
  sortOrder: number
  description: string
}
