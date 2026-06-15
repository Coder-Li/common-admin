import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentStatus, Prisma } from '@prisma/client';
import {
  ListResponse,
  createListResponse,
} from '../common/dto/list-response.dto';
import { PrismaService } from '../prisma/prisma.service';
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
  DEPARTMENT_DEFAULT_SORT,
  DEPARTMENT_SORT_FIELDS,
} from './department.constants';
import {
  CreateDepartmentDto,
  DepartmentListQueryDto,
  DepartmentOptionsQueryDto,
  UpdateDepartmentDto,
} from './dto/department.request';
import {
  DepartmentOptionDto,
  DepartmentResponseDto,
  DepartmentTreeNodeDto,
} from './dto/department.response';
import {
  toDepartmentOption,
  toDepartmentResponse,
  toDepartmentTree,
} from './department.mapper';

const DEPARTMENT_WITH_PARENT = {
  parent: { select: { name: true } },
} as const;

@Injectable()
export class DepartmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listDepartments(
    query: DepartmentListQueryDto,
  ): Promise<ListResponse<DepartmentResponseDto>> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);

    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
        include: DEPARTMENT_WITH_PARENT,
      }),
      this.prisma.department.count({ where }),
    ]);

    return createListResponse(
      departments.map((department) => toDepartmentResponse(department)),
      total,
      page,
      pageSize,
    );
  }

  async getDepartmentTree(): Promise<DepartmentTreeNodeDto[]> {
    const departments = await this.prisma.department.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        parentId: true,
        status: true,
        sortOrder: true,
      },
    });

    return toDepartmentTree(departments);
  }

  async getDepartmentOptions(
    query: DepartmentOptionsQueryDto,
  ): Promise<DepartmentOptionDto[]> {
    const includeIds = this.parseIncludeIds(query.includeIds);
    const status = query.status ?? DepartmentStatus.ACTIVE;
    const where: Prisma.DepartmentWhereInput =
      includeIds.length > 0
        ? { OR: [{ status }, { id: { in: includeIds } }] }
        : { status };

    const departments = await this.prisma.department.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        parentId: true,
        status: true,
      },
    });

    const uniqueDepartments = new Map(
      departments.map((department) => [department.id, department]),
    );

    return [...uniqueDepartments.values()].map((department) =>
      toDepartmentOption(department),
    );
  }

  async findById(id: string): Promise<DepartmentResponseDto> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: DEPARTMENT_WITH_PARENT,
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return toDepartmentResponse(department);
  }

  async createDepartment(
    dto: CreateDepartmentDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<DepartmentResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (Object.prototype.hasOwnProperty.call(dto, 'parentId')) {
          this.validateParentIdValue(dto.parentId);

          if (dto.parentId) {
            await this.validateSelectableParent(tx, dto.parentId);
          }
        }

        const department = await tx.department.create({
          data: dto,
          include: DEPARTMENT_WITH_PARENT,
        });
        const response = toDepartmentResponse(department);

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.CREATE,
            resourceType: AUDIT_RESOURCE_TYPES.DEPARTMENT,
            resourceId: department.id,
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

  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<DepartmentResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.department.findUnique({
          where: { id },
          include: DEPARTMENT_WITH_PARENT,
        });

        if (!before) {
          throw new NotFoundException('Department not found');
        }

        const data: Prisma.DepartmentUncheckedUpdateInput = { ...dto };

        if (Object.prototype.hasOwnProperty.call(dto, 'parentId')) {
          this.validateParentIdValue(dto.parentId);

          if (dto.parentId === null) {
            data.parentId = null;
          } else if (dto.parentId) {
            await this.validateSelectableParent(tx, dto.parentId, id);
          }
        }

        const department = await tx.department.update({
          where: { id },
          data,
          include: DEPARTMENT_WITH_PARENT,
        });
        const response = toDepartmentResponse(department);

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.UPDATE,
            resourceType: AUDIT_RESOURCE_TYPES.DEPARTMENT,
            resourceId: id,
            actor,
            requestMeta,
            ...(auditMetadata ? { metadata: auditMetadata } : {}),
            before: toDepartmentResponse(before),
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

  async deleteDepartment(
    id: string,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: DEPARTMENT_WITH_PARENT,
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const childCount = await this.prisma.department.count({
      where: { parentId: id },
    });

    if (childCount > 0) {
      throw new BadRequestException('Department still has child departments');
    }

    const assignedUserCount = await this.prisma.userDepartment.count({
      where: { departmentId: id },
    });

    if (assignedUserCount > 0) {
      throw new BadRequestException('Department still has assigned users');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.department.delete({
          where: { id },
          include: DEPARTMENT_WITH_PARENT,
        });

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.DELETE,
            resourceType: AUDIT_RESOURCE_TYPES.DEPARTMENT,
            resourceId: id,
            actor,
            requestMeta,
            ...(auditMetadata ? { metadata: auditMetadata } : {}),
            before: toDepartmentResponse(deleted),
          },
          tx,
        );
      });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  private parseSort(sort = DEPARTMENT_DEFAULT_SORT): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const [field, direction] = sort.split(':');

    if (
      !field ||
      !DEPARTMENT_SORT_FIELDS.includes(
        field as (typeof DEPARTMENT_SORT_FIELDS)[number],
      ) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid department sort');
    }

    return { field, direction };
  }

  private buildWhere(
    query: DepartmentListQueryDto,
  ): Prisma.DepartmentWhereInput {
    const where: Prisma.DepartmentWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.parentId) {
      where.parentId = query.parentId;
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

  private async validateSelectableParent(
    tx: Prisma.TransactionClient,
    parentId: string,
    departmentId?: string,
  ): Promise<void> {
    if (departmentId && parentId === departmentId) {
      throw new BadRequestException('Department cannot use itself as parent');
    }

    let parent = await tx.department.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, status: true },
    });

    if (!parent) {
      throw new BadRequestException('Parent department not found');
    }

    if (parent.status !== DepartmentStatus.ACTIVE) {
      throw new BadRequestException('Parent department must be active');
    }

    while (departmentId && parent) {
      if (parent.parentId === departmentId) {
        throw new BadRequestException(
          'Department cannot use a descendant as parent',
        );
      }

      parent = parent.parentId
        ? await tx.department.findUnique({
            where: { id: parent.parentId },
            select: { id: true, parentId: true, status: true },
          })
        : null;
    }
  }

  private validateParentIdValue(parentId: string | null | undefined): void {
    if (parentId === '') {
      throw new BadRequestException('Parent department id cannot be blank');
    }
  }

  private handlePrismaWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Department already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Department not found');
      }

      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Department has invalid or dependent relationships',
        );
      }
    }

    throw error;
  }
}
