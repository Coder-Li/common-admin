import { api as defaultApi } from '../../app/api-client'
import type {
  AuditLogListQuery,
  AuditLogListResponse,
  AuditLogRecord,
} from './audit-logs.types'

export interface AuditLogsApiClient {
  auditLogs: {
    list(query: AuditLogListQuery): Promise<AuditLogListResponse>
    get(id: string): Promise<AuditLogRecord>
  }
}

export function listAuditLogs(
  query: AuditLogListQuery,
  api: AuditLogsApiClient = defaultApi,
) {
  return api.auditLogs.list(query)
}

export function getAuditLog(id: string, api: AuditLogsApiClient = defaultApi) {
  return api.auditLogs.get(id)
}
