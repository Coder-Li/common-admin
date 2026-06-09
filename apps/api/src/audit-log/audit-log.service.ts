import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ListResponse,
  createListResponse,
} from '../common/dto/list-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_LOG_SORT_FIELDS } from './audit-log.constants';
import {
  toAuditLogListItemResponse,
  toAuditLogResponse,
} from './audit-log.mapper';
import { sanitizeAuditPayload } from './audit-log.sanitizer';
import {
  AuditLogListItemResponseDto,
  AuditLogResponseDto,
} from './dto/audit-log.response';
import { AuditLogListQueryDto } from './dto/audit-log.request';
import type { AuditPrismaClient, RecordAuditLogInput } from './audit-log.types';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordAuditLogInput,
    tx?: AuditPrismaClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.auditLog.create({
      data: {
        actorUserId: input.actor?.userId,
        actorEmail: input.actor?.email,
        actorName: input.actor?.name,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ...this.toJsonCreateField('before', input.before),
        ...this.toJsonCreateField('after', input.after),
        ...this.toJsonCreateField('metadata', input.metadata),
        ipAddress: input.requestMeta?.ipAddress,
        userAgent: input.requestMeta?.userAgent,
      },
    });
  }

  async listAuditLogs(
    query: AuditLogListQueryDto,
  ): Promise<ListResponse<AuditLogListItemResponseDto>> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildAuditLogWhere(query);

    const [auditLogs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return createListResponse(
      auditLogs.map(toAuditLogListItemResponse),
      total,
      page,
      pageSize,
    );
  }

  async findById(id: string): Promise<AuditLogResponseDto> {
    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id },
    });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    return toAuditLogResponse(auditLog);
  }

  private parseSort(sort = 'createdAt:desc'): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const [field, direction] = sort.split(':');

    if (
      !field ||
      !AUDIT_LOG_SORT_FIELDS.has(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid audit log sort');
    }

    return { field, direction };
  }

  private buildAuditLogWhere(
    query: AuditLogListQueryDto,
  ): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
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

      where.OR = [
        { actorEmail: search },
        { actorName: search },
        { resourceId: search },
      ];
    }

    return where;
  }

  private toJsonCreateField(
    field: 'before' | 'after' | 'metadata',
    value: unknown,
  ):
    | Record<
        'before' | 'after' | 'metadata',
        Prisma.InputJsonValue | typeof Prisma.JsonNull
      >
    | Record<string, never> {
    if (value === undefined) {
      return {};
    }

    if (value === null) {
      return { [field]: Prisma.JsonNull } as Record<
        'before' | 'after' | 'metadata',
        typeof Prisma.JsonNull
      >;
    }

    return {
      [field]: sanitizeAuditPayload(value) as Prisma.InputJsonValue,
    } as Record<'before' | 'after' | 'metadata', Prisma.InputJsonValue>;
  }
}
