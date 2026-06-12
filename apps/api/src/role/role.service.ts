import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionStatus, Prisma, RoleStatus } from '@prisma/client';
import {
  ListResponse,
  createListResponse,
} from '../common/dto/list-response.dto';
import { PermissionService } from '../permission/permission.service';
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
  CreateRoleDto,
  RoleListQueryDto,
  UpdateRoleDto,
} from './dto/role.request';
import { RoleResponseDto } from './dto/role.response';
import { toRoleResponse } from './role.mapper';

const ROLE_INCLUDE = {
  permissions: {
    include: {
      permission: true,
    },
  },
} as const;

const ACTIVE_ROLE_PERMISSIONS_INCLUDE = {
  permissions: {
    where: {
      permission: {
        status: PermissionStatus.ACTIVE,
      },
    },
    include: {
      permission: true,
    },
  },
} as const;

const ROLE_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'code', 'name']);

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listRoles(
    query: RoleListQueryDto,
  ): Promise<ListResponse<RoleResponseDto>> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.RoleWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
        include: ROLE_INCLUDE,
      }),
      this.prisma.role.count({ where }),
    ]);

    return createListResponse(roles.map(toRoleResponse), total, page, pageSize);
  }

  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return toRoleResponse(role);
  }

  async createRole(
    dto: CreateRoleDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<RoleResponseDto> {
    try {
      const response = await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await this.clearOtherDefaults(tx);
        }

        const role = await tx.role.create({
          data: {
            code: dto.code,
            name: dto.name,
            description: dto.description,
            isDefault: dto.isDefault ?? false,
          },
          include: ROLE_INCLUDE,
        });
        const response = toRoleResponse(role);

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.CREATE,
            resourceType: AUDIT_RESOURCE_TYPES.ROLE,
            resourceId: role.id,
            actor,
            requestMeta,
            ...(auditMetadata ? { metadata: auditMetadata } : {}),
            after: response,
          },
          tx,
        );

        return response;
      });

      await this.permissionService.invalidateAllPermissionContexts();

      return response;
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async updateRole(
    id: string,
    dto: UpdateRoleDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<RoleResponseDto> {
    const existing = await this.requireRole(id);

    if (existing.code === 'super_admin' && dto.status === RoleStatus.DISABLED) {
      throw new ForbiddenException('super_admin cannot be disabled');
    }

    if (
      existing.isDefault &&
      existing.status === RoleStatus.ACTIVE &&
      (dto.status === RoleStatus.DISABLED || dto.isDefault === false) &&
      !(await this.hasAnotherActiveDefault(id))
    ) {
      throw new ForbiddenException('Cannot remove the only default role');
    }

    try {
      const response = await this.prisma.$transaction(async (tx) => {
        const before = await tx.role.findUnique({
          where: { id },
          include: ROLE_INCLUDE,
        });

        if (!before) {
          throw new NotFoundException('Role not found');
        }

        if (dto.isDefault) {
          await this.clearOtherDefaults(tx, id);
        }

        const role = await tx.role.update({
          where: { id },
          data: dto,
          include: ROLE_INCLUDE,
        });
        const response = toRoleResponse(role);

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.UPDATE,
            resourceType: AUDIT_RESOURCE_TYPES.ROLE,
            resourceId: id,
            actor,
            requestMeta,
            ...(auditMetadata ? { metadata: auditMetadata } : {}),
            before: toRoleResponse(before),
            after: response,
          },
          tx,
        );

        return response;
      });

      await this.permissionService.invalidateAllPermissionContexts();

      return response;
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async deleteRole(
    id: string,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const role = await this.requireRole(id);

    if (role.isSystem) {
      throw new ForbiddenException('System role cannot be deleted');
    }

    const assignedUsers = await this.prisma.userRole.count({
      where: { roleId: id },
    });

    if (assignedUsers > 0) {
      throw new ConflictException('Role is assigned to users');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.role.delete({
          where: { id },
          include: ROLE_INCLUDE,
        });

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.DELETE,
            resourceType: AUDIT_RESOURCE_TYPES.ROLE,
            resourceId: id,
            actor,
            requestMeta,
            ...(auditMetadata ? { metadata: auditMetadata } : {}),
            before: toRoleResponse(deleted),
          },
          tx,
        );
      });
      await this.permissionService.invalidateAllPermissionContexts();
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async replaceRolePermissions(
    roleId: string,
    permissionCodes: string[],
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    auditMetadata?: Record<string, unknown>,
  ): Promise<RoleResponseDto> {
    await this.requireRole(roleId);
    const uniqueCodes = [...new Set(permissionCodes)].sort();
    const permissions = uniqueCodes.length
      ? await this.prisma.permission.findMany({
          where: {
            code: { in: uniqueCodes },
            status: PermissionStatus.ACTIVE,
          },
          select: { id: true, code: true, status: true },
        })
      : [];

    if (permissions.length !== uniqueCodes.length) {
      throw new NotFoundException('Permission not found or disabled');
    }

    const role = await this.prisma.$transaction(async (tx) => {
      const before = await tx.role.findUnique({
        where: { id: roleId },
        include: ACTIVE_ROLE_PERMISSIONS_INCLUDE,
      });

      if (!before) {
        throw new NotFoundException('Role not found');
      }

      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: this.toRolePermissionCreateManyData(
          roleId,
          uniqueCodes,
          permissions,
        ),
        skipDuplicates: true,
      });

      const updated = await tx.role.findUnique({
        where: { id: roleId },
        include: ACTIVE_ROLE_PERMISSIONS_INCLUDE,
      });

      if (!updated) {
        throw new NotFoundException('Role not found');
      }

      await this.auditLogService.record(
        {
          action: AUDIT_ACTIONS.REPLACE_PERMISSIONS,
          resourceType: AUDIT_RESOURCE_TYPES.ROLE,
          resourceId: roleId,
          actor,
          requestMeta,
          ...(auditMetadata ? { metadata: auditMetadata } : {}),
          before: { permissionCodes: this.toPermissionCodes(before) },
          after: { permissionCodes: this.toPermissionCodes(updated) },
        },
        tx,
      );

      return updated;
    });

    await this.permissionService.invalidateAllPermissionContexts();

    return toRoleResponse(role);
  }

  private toPermissionCodes(role: {
    permissions?: Array<{ permission: { code: string } }>;
  }): string[] {
    return (role.permissions ?? [])
      .map((rolePermission) => rolePermission.permission.code)
      .sort();
  }

  private toRolePermissionCreateManyData(
    roleId: string,
    uniqueCodes: string[],
    permissions: Array<{ id: string; code: string }>,
  ): Array<{ roleId: string; permissionId: string }> {
    const permissionsByCode = new Map(
      permissions.map((permission) => [permission.code, permission]),
    );

    return uniqueCodes.map((code) => ({
      roleId,
      permissionId: permissionsByCode.get(code)!.id,
    }));
  }

  private async requireRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private async hasAnotherActiveDefault(id: string): Promise<boolean> {
    const role = await this.prisma.role.findFirst({
      where: { id: { not: id }, isDefault: true, status: RoleStatus.ACTIVE },
      select: { id: true },
    });

    return Boolean(role);
  }

  private async clearOtherDefaults(
    tx: Pick<PrismaService, 'role'>,
    id?: string,
  ): Promise<void> {
    await tx.role.updateMany({
      where: {
        ...(id ? { id: { not: id } } : {}),
        status: RoleStatus.ACTIVE,
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  private parseSort(sort = 'createdAt:desc'): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const [field, direction] = sort.split(':');

    if (
      !field ||
      !ROLE_SORT_FIELDS.has(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid role sort');
    }

    return { field, direction };
  }

  private handlePrismaWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Role already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Role not found');
      }
    }

    throw error;
  }
}
