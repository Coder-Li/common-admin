import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PositionStatus, Prisma } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit-log/audit-log.constants';
import { AuditLogService } from '../audit-log/audit-log.service';
import type {
  AuditActor,
  AuditRequestMeta,
} from '../audit-log/audit-log.types';
import {
  ListResponse,
  createListResponse,
} from '../common/dto/list-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  POSITION_DEFAULT_SORT,
  POSITION_SORT_FIELDS,
} from './position.constants';
import {
  CreatePositionDto,
  PositionListQueryDto,
  PositionOptionsQueryDto,
  UpdatePositionDto,
} from './dto/position.request';
import {
  PositionOptionDto,
  PositionResponseDto,
} from './dto/position.response';
import { toPositionOption, toPositionResponse } from './position.mapper';

@Injectable()
export class PositionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listPositions(
    query: PositionListQueryDto,
  ): Promise<ListResponse<PositionResponseDto>> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);

    const [positions, total] = await Promise.all([
      this.prisma.position.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
      }),
      this.prisma.position.count({ where }),
    ]);

    return createListResponse(
      positions.map((position) => toPositionResponse(position)),
      total,
      page,
      pageSize,
    );
  }

  async getPositionOptions(
    query: PositionOptionsQueryDto,
  ): Promise<PositionOptionDto[]> {
    const includeIds = this.parseIncludeIds(query.includeIds);
    const status = query.status ?? PositionStatus.ACTIVE;
    const where: Prisma.PositionWhereInput =
      includeIds.length > 0
        ? { OR: [{ status }, { id: { in: includeIds } }] }
        : { status };

    const positions = await this.prisma.position.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });

    const uniquePositions = new Map(
      positions.map((position) => [position.id, position]),
    );

    return [...uniquePositions.values()].map((position) =>
      toPositionOption(position),
    );
  }

  async findById(id: string): Promise<PositionResponseDto> {
    const position = await this.prisma.position.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Position not found');
    }

    return toPositionResponse(position);
  }

  async createPosition(
    dto: CreatePositionDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<PositionResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const position = await tx.position.create({
          data: dto,
        });
        const response = toPositionResponse(position);

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.CREATE,
            resourceType: AUDIT_RESOURCE_TYPES.POSITION,
            resourceId: position.id,
            actor,
            requestMeta,
            ...(auditMetadata ? { metadata: auditMetadata } : {}),
            after: response,
          },
          tx,
        );

        return response;
      });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async updatePosition(
    id: string,
    dto: UpdatePositionDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<PositionResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.position.findUnique({
          where: { id },
        });

        if (!before) {
          throw new NotFoundException('Position not found');
        }

        const position = await tx.position.update({
          where: { id },
          data: dto,
        });
        const response = toPositionResponse(position);

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.UPDATE,
            resourceType: AUDIT_RESOURCE_TYPES.POSITION,
            resourceId: id,
            actor,
            requestMeta,
            ...(auditMetadata ? { metadata: auditMetadata } : {}),
            before: toPositionResponse(before),
            after: response,
          },
          tx,
        );

        return response;
      });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async deletePosition(
    id: string,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const position = await this.prisma.position.findUnique({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Position not found');
    }

    const assignedUserCount = await this.prisma.userPosition.count({
      where: { positionId: id },
    });

    if (assignedUserCount > 0) {
      throw new BadRequestException('Position still has assigned users');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.position.delete({
          where: { id },
        });

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.DELETE,
            resourceType: AUDIT_RESOURCE_TYPES.POSITION,
            resourceId: id,
            actor,
            requestMeta,
            ...(auditMetadata ? { metadata: auditMetadata } : {}),
            before: toPositionResponse(deleted),
          },
          tx,
        );
      });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  private parseSort(sort = POSITION_DEFAULT_SORT): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const [field, direction] = sort.split(':');

    if (
      !field ||
      !POSITION_SORT_FIELDS.includes(
        field as (typeof POSITION_SORT_FIELDS)[number],
      ) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid position sort');
    }

    return { field, direction };
  }

  private buildWhere(query: PositionListQueryDto): Prisma.PositionWhereInput {
    const where: Prisma.PositionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const search = {
        contains: query.search,
        mode: 'insensitive' as const,
      };

      where.OR = [{ code: search }, { name: search }, { description: search }];
    }

    return where;
  }

  private parseIncludeIds(includeIds?: string): string[] {
    if (!includeIds) {
      return [];
    }

    return [
      ...new Set(
        includeIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
  }

  private handlePrismaWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Position already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Position not found');
      }

      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Position has invalid or dependent relationships',
        );
      }
    }

    throw error;
  }
}
