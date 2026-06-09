import type { PrismaClient } from '@prisma/client';

import type {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from './audit-log.constants';

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
export type AuditResourceType =
  (typeof AUDIT_RESOURCE_TYPES)[keyof typeof AUDIT_RESOURCE_TYPES];

export interface AuditActor {
  userId?: string;
  email?: string;
  name?: string;
}

export interface AuditRequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordAuditLogInput {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  actor?: AuditActor;
  requestMeta?: AuditRequestMeta;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

export type AuditPrismaClient = Pick<PrismaClient, 'auditLog'>;
