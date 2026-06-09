export interface AuditLogListQuery {
  page: number
  pageSize: number
  search?: string
  sort?: string
  actorUserId?: string
  action?: string
  resourceType?: string
  resourceId?: string
  dateFrom?: string
  dateTo?: string
}

export interface AuditLogListItem {
  id: string
  actorUserId?: string
  actorEmail?: string
  actorName?: string
  action: string
  resourceType: string
  resourceId?: string
  ipAddress?: string
  createdAt: string
}

export interface AuditLogRecord extends AuditLogListItem {
  before?: unknown
  after?: unknown
  metadata?: unknown
  userAgent?: string
}

export interface AuditLogListResponse {
  items: AuditLogListItem[]
  total: number
  page: number
  pageSize: number
}
