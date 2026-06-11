import type {
  AuditLogListItemResponseDto,
  AuditLogListResponseDto,
  AuditLogResponseDto,
  ListAuditLogsParams,
} from '../../generated/api/schemas'

export type AuditLogListQuery = Omit<
  ListAuditLogsParams,
  'action' | 'page' | 'pageSize' | 'resourceType'
> & {
  page: number
  pageSize: number
  action?: string
  resourceType?: string
}

export type AuditLogListItem = AuditLogListItemResponseDto
export type AuditLogRecord = AuditLogResponseDto
export type AuditLogListResponse = AuditLogListResponseDto
