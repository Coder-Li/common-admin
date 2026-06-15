import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createListResponse } from '../common/dto/list-response.dto';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit-log/audit-log.constants';
import { AuditLogService } from '../audit-log/audit-log.service';
import type {
  AuditActor,
  AuditRequestMeta,
} from '../audit-log/audit-log.types';
import { PrismaService } from '../prisma/prisma.service';
import { UserSessionListQueryDto } from './dto/user-session.request';
import { UserSessionListResponseDto } from './dto/user-session.response';
import {
  USER_SESSION_REVOKED_REASONS,
  USER_SESSION_SORT_FIELDS,
} from './user-session.constants';
import {
  deriveUserSessionStatus,
  toUserSessionResponse,
} from './user-session.mapper';

@Injectable()
export class UserSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listUserSessions(
    query: UserSessionListQueryDto,
    currentSessionId: string,
  ): Promise<UserSessionListResponseDto> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const now = this.getNow();
    const where = this.buildUserSessionWhere(query, now);

    const [sessions, total] = await Promise.all([
      this.prisma.userSession.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
        include: { user: true },
      }),
      this.prisma.userSession.count({ where }),
    ]);

    return createListResponse(
      sessions.map((session) =>
        toUserSessionResponse(session, currentSessionId, now),
      ),
      total,
      page,
      pageSize,
    );
  }

  async revokeUserSession(
    sessionId: string,
    currentSessionId: string,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<void> {
    if (sessionId === currentSessionId) {
      throw new BadRequestException('Cannot revoke current session');
    }

    const target = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!target) {
      throw new NotFoundException('User session not found');
    }

    const now = this.getNow();
    const status = deriveUserSessionStatus(target, now);

    if (status !== 'active') {
      throw new BadRequestException('Session cannot be revoked');
    }

    const metadata = {
      ...(auditMetadata ?? {}),
      targetUserId: target.user.id,
      targetUsername: target.user.username,
      targetEmail: target.user.email,
      ipAddress: target.ipAddress ?? undefined,
      userAgent: target.userAgent ?? undefined,
      createdAt: target.createdAt.toISOString(),
      expiresAt: target.expiresAt.toISOString(),
      revokedReason: USER_SESSION_REVOKED_REASONS.ADMIN_REVOKED,
    };

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.userSession.updateMany({
        where: {
          id: sessionId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
          revokedReason: USER_SESSION_REVOKED_REASONS.ADMIN_REVOKED,
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException('Session cannot be revoked');
      }

      await this.auditLogService.record(
        {
          action: AUDIT_ACTIONS.REVOKE,
          resourceType: AUDIT_RESOURCE_TYPES.USER_SESSION,
          resourceId: sessionId,
          actor,
          requestMeta,
          metadata,
        },
        tx,
      );
    });
  }

  private parseSort(sort = 'createdAt:desc'): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const sortParts = sort.split(':');
    const [field, direction] = sortParts;

    if (
      sortParts.length !== 2 ||
      !field ||
      !USER_SESSION_SORT_FIELDS.has(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid user session sort');
    }

    return { field, direction };
  }

  protected getNow(): Date {
    return new Date();
  }

  private buildUserSessionWhere(
    query: UserSessionListQueryDto,
    now: Date,
  ): Prisma.UserSessionWhereInput {
    const where: Prisma.UserSessionWhereInput = {};

    if (query.status === 'active') {
      where.revokedAt = null;
      where.expiresAt = { gt: now };
    }

    if (query.status === 'expired') {
      where.revokedAt = null;
      where.expiresAt = { lte: now };
    }

    if (query.status === 'revoked') {
      where.revokedAt = { not: null };
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.ipAddress) {
      where.ipAddress = { contains: query.ipAddress };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};

      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }

      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    if (query.search) {
      const search = {
        contains: query.search,
        mode: 'insensitive' as const,
      };

      where.user = {
        OR: [
          { username: search },
          { email: search },
          { firstName: search },
          { lastName: search },
        ],
      };
    }

    return where;
  }
}
