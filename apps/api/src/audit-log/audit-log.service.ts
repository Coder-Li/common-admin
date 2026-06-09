import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Prisma as PrismaTypes } from '@prisma/client';
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

type AuditJsonValue = PrismaTypes.InputJsonValue | typeof Prisma.JsonNull;
type JsonCompatible =
  | string
  | number
  | boolean
  | null
  | JsonCompatible[]
  | { [key: string]: JsonCompatible };

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordAuditLogInput,
    tx?: AuditPrismaClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const data: Prisma.AuditLogCreateInput = {
      action: input.action,
      resourceType: input.resourceType,
      ...this.toOptionalCreateField('actorUserId', input.actor?.userId),
      ...this.toOptionalCreateField('actorEmail', input.actor?.email),
      ...this.toOptionalCreateField('actorName', input.actor?.name),
      ...this.toOptionalCreateField('resourceId', input.resourceId),
      ...this.toJsonCreateField('before', input.before),
      ...this.toJsonCreateField('after', input.after),
      ...this.toJsonCreateField('metadata', input.metadata),
      ...this.toOptionalCreateField('ipAddress', input.requestMeta?.ipAddress),
      ...this.toOptionalCreateField('userAgent', input.requestMeta?.userAgent),
    };

    await client.auditLog.create({
      data,
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
    const sortParts = sort.split(':');
    const [field, direction] = sortParts;

    if (
      sortParts.length !== 2 ||
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
    | Partial<Record<'before' | 'after' | 'metadata', AuditJsonValue>>
    | Record<string, never> {
    if (value === undefined) {
      return {};
    }

    if (value === null) {
      return { [field]: Prisma.JsonNull };
    }

    return {
      [field]: toAuditJsonValue(sanitizeAuditPayload(value)),
    };
  }

  private toOptionalCreateField<TField extends string>(
    field: TField,
    value: string | undefined,
  ): Record<string, string> | Record<string, never> {
    return value === undefined ? {} : { [field]: value };
  }
}

function toAuditJsonValue(value: unknown): AuditJsonValue {
  const normalized = toJsonCompatibleValue(value);

  return normalized === null ? Prisma.JsonNull : normalized;
}

function toJsonCompatibleValue(value: unknown): JsonCompatible {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (
    value === undefined ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    return null;
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonCompatibleValue(item));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([, item]) =>
          item !== undefined &&
          typeof item !== 'function' &&
          typeof item !== 'symbol',
      )
      .map(([key, item]) => [key, toJsonCompatibleValue(item)]),
  );
}
