import type { AuditLog } from '@prisma/client';
import {
  AuditLogListItemResponseDto,
  AuditLogResponseDto,
} from './dto/audit-log.response';

export function toAuditLogListItemResponse(
  auditLog: AuditLog,
): AuditLogListItemResponseDto {
  return {
    id: auditLog.id,
    ...(auditLog.actorUserId ? { actorUserId: auditLog.actorUserId } : {}),
    ...(auditLog.actorEmail ? { actorEmail: auditLog.actorEmail } : {}),
    ...(auditLog.actorName ? { actorName: auditLog.actorName } : {}),
    action: auditLog.action,
    resourceType: auditLog.resourceType,
    ...(auditLog.resourceId ? { resourceId: auditLog.resourceId } : {}),
    ...(auditLog.ipAddress ? { ipAddress: auditLog.ipAddress } : {}),
    createdAt: auditLog.createdAt.toISOString(),
  };
}

export function toAuditLogResponse(auditLog: AuditLog): AuditLogResponseDto {
  const response: AuditLogResponseDto = {
    ...toAuditLogListItemResponse(auditLog),
  };

  if (auditLog.before !== null) {
    response.before = auditLog.before;
  }

  if (auditLog.after !== null) {
    response.after = auditLog.after;
  }

  if (auditLog.metadata !== null) {
    response.metadata = auditLog.metadata;
  }

  if (auditLog.userAgent) {
    response.userAgent = auditLog.userAgent;
  }

  return response;
}
