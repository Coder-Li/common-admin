import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, RoleStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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
  CreateUserDto,
  ReplaceUserRolesDto,
  UpdateUserDto,
  UserListQueryDto,
} from './dto/user.request';
import { UserResponseDto } from './dto/user.response';
import { toUserProfile, toUserResponse } from './user.mapper';
import { UserProfile } from './user.types';
import { PermissionService } from '../permission/permission.service';
import { SYSTEM_ROLE_CODES } from '../permission/permission.constants';

const USER_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'email',
  'username',
  'firstName',
  'lastName',
]);

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listUsers(
    query: UserListQueryDto,
  ): Promise<ListResponse<UserResponseDto>> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildUserWhere(query);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return createListResponse(
      users.map((user) => toUserResponse(user)),
      total,
      page,
      pageSize,
    );
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toUserResponse(user);
  }

  async createUser(
    dto: CreateUserDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
  ): Promise<UserResponseDto> {
    const { password, roleCodes, ...data } = dto;
    const passwordHash = await bcrypt.hash(password, 10);
    const roles = await this.resolveCreateRoles(roleCodes);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            ...data,
            passwordHash,
            roles: {
              create: roles.map((role) => ({ roleId: role.id })),
            },
          },
          include: { roles: { include: { role: true } } },
        });
        const response = toUserResponse(user);

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.CREATE,
            resourceType: AUDIT_RESOURCE_TYPES.USER,
            resourceId: user.id,
            actor,
            requestMeta,
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

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
  ): Promise<UserResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.user.findUnique({
          where: { id },
          include: { roles: { include: { role: true } } },
        });

        if (!before) {
          throw new NotFoundException('User not found');
        }

        const user = await tx.user.update({
          where: { id },
          data: dto,
          include: { roles: { include: { role: true } } },
        });
        const response = toUserResponse(user);

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.UPDATE,
            resourceType: AUDIT_RESOURCE_TYPES.USER,
            resourceId: id,
            actor,
            requestMeta,
            before: toUserResponse(before),
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

  async resetPassword(
    id: string,
    newPassword: string,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
  ): Promise<UserResponseDto> {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const user = await tx.user.update({
          where: { id },
          data: { passwordHash },
          include: { roles: { include: { role: true } } },
        });

        await tx.userSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'admin_reset_password' },
        });

        const response = toUserResponse(user);

        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.RESET_PASSWORD,
            resourceType: AUDIT_RESOURCE_TYPES.USER,
            resourceId: id,
            actor,
            requestMeta,
            after: {
              id: response.id,
              email: response.email,
              username: response.username,
            },
          },
          tx,
        );

        return response;
      });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async deleteUser(
    id: string,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const before = await tx.user.findUnique({
          where: { id },
          include: { roles: { include: { role: true } } },
        });

        if (!before) {
          throw new NotFoundException('User not found');
        }

        await tx.user.delete({ where: { id } });
        await this.auditLogService.record(
          {
            action: AUDIT_ACTIONS.DELETE,
            resourceType: AUDIT_RESOURCE_TYPES.USER,
            resourceId: id,
            actor,
            requestMeta,
            before: toUserResponse(before),
          },
          tx,
        );
      });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async findProfileById(id: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissionContext =
      await this.permissionService.resolveUserPermissionContext(id);

    return toUserProfile(user, permissionContext.permissionCodes);
  }

  async replaceRoles(
    id: string,
    roleCodes: ReplaceUserRolesDto['roleCodes'],
    actorUserId: string,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.resolveExplicitRoles(roleCodes);
    await this.assertCanReplaceSuperAdminRoles(user, roles, actorUserId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id },
        include: { roles: { include: { role: true } } },
      });

      if (!before) {
        throw new NotFoundException('User not found');
      }

      const beforeRoleCodes = this.toRoleCodes(before);

      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId: id, roleId: role.id })),
        skipDuplicates: true,
      });

      const nextUser = await tx.user.findUnique({
        where: { id },
        include: { roles: { include: { role: true } } },
      });

      if (!nextUser) {
        throw new NotFoundException('User not found');
      }

      await this.auditLogService.record(
        {
          action: AUDIT_ACTIONS.REPLACE_ROLES,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          resourceId: id,
          actor,
          requestMeta,
          before: { roleCodes: beforeRoleCodes },
          after: { roleCodes: this.toRoleCodes(nextUser) },
        },
        tx,
      );

      return nextUser;
    });

    await this.permissionService.invalidateUserPermissionContext(id);

    return toUserResponse(updated);
  }

  private parseSort(sort = 'createdAt:desc'): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const [field, direction] = sort.split(':');

    if (
      !field ||
      !USER_SORT_FIELDS.has(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid user sort');
    }

    return { field, direction };
  }

  private buildUserWhere(query: UserListQueryDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (query.roleCode) {
      where.roles = { some: { role: { code: query.roleCode } } };
    }

    if (query.search) {
      const search = {
        contains: query.search,
        mode: 'insensitive' as const,
      };

      where.OR = [
        { email: search },
        { username: search },
        { firstName: search },
        { lastName: search },
      ];
    }

    return where;
  }

  private handlePrismaWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('User already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
    }

    throw error;
  }

  private async resolveCreateRoles(roleCodes?: string[]) {
    if (roleCodes?.length) {
      return this.resolveExplicitRoles(roleCodes);
    }

    const defaultRole = await this.prisma.role.findFirst({
      where: { isDefault: true, status: RoleStatus.ACTIVE },
      select: { id: true, code: true },
    });

    if (!defaultRole) {
      throw new NotFoundException('Default role not found');
    }

    return [defaultRole];
  }

  private async resolveExplicitRoles(roleCodes: string[]) {
    const uniqueCodes = [...new Set(roleCodes)].sort();
    const roles = await this.prisma.role.findMany({
      where: { code: { in: uniqueCodes }, status: RoleStatus.ACTIVE },
      select: { id: true, code: true },
    });

    if (roles.length !== uniqueCodes.length) {
      throw new NotFoundException('Role not found or disabled');
    }

    return roles;
  }

  private async assertCanReplaceSuperAdminRoles(
    user: {
      id: string;
      roles: Array<{ role: { code: string } }>;
    },
    nextRoles: Array<{ code: string }>,
    actorUserId: string,
  ) {
    const hadSuperAdmin = user.roles.some(
      (userRole) => userRole.role.code === SYSTEM_ROLE_CODES.superAdmin,
    );
    const keepsSuperAdmin = nextRoles.some(
      (role) => role.code === SYSTEM_ROLE_CODES.superAdmin,
    );

    if (!hadSuperAdmin || keepsSuperAdmin) {
      return;
    }

    const activeSuperAdminAssignments = await this.prisma.userRole.count({
      where: {
        role: {
          code: SYSTEM_ROLE_CODES.superAdmin,
          status: RoleStatus.ACTIVE,
        },
      },
    });

    if (activeSuperAdminAssignments <= 1 || actorUserId === user.id) {
      throw new ForbiddenException(
        'Cannot remove the last active super_admin assignment',
      );
    }
  }

  private toRoleCodes(user: { roles: Array<{ role: { code: string } }> }) {
    return user.roles.map((userRole) => userRole.role.code).sort();
  }
}
