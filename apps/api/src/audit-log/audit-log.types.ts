import type { PrismaClient } from '@prisma/client';

import type {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from './audit-log.constants';

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export interface AuditActor {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface AuditRequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RecordAuditLogInput {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  actor?: AuditActor | null;
  requestMeta?: AuditRequestMeta | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

export type AuditPrismaClient = Pick<PrismaClient, 'auditLog'>;
