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
    actorUserId: auditLog.actorUserId,
    actorEmail: auditLog.actorEmail,
    actorName: auditLog.actorName,
    action: auditLog.action,
    resourceType: auditLog.resourceType,
    resourceId: auditLog.resourceId,
    ipAddress: auditLog.ipAddress,
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
