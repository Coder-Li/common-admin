import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PermissionService } from '../permission/permission.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataPermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  async buildUserVisibilityWhere(
    actorUserId: string,
  ): Promise<Prisma.UserWhereInput> {
    const context =
      await this.permissionService.resolveUserPermissionContext(actorUserId);

    if (context.dataScope.mode === 'ALL') {
      return {};
    }

    const clauses: Prisma.UserWhereInput[] = [];

    if (context.dataScope.selfUserIds.length > 0) {
      clauses.push({ id: { in: context.dataScope.selfUserIds } });
    }

    if (context.dataScope.departmentIds.length > 0) {
      clauses.push({
        departments: {
          some: { departmentId: { in: context.dataScope.departmentIds } },
        },
      });
    }

    if (clauses.length === 0) {
      return { id: { in: [] } };
    }

    return { OR: clauses };
  }

  async assertCanAccessUser(
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const visibilityWhere = await this.buildUserVisibilityWhere(actorUserId);
    const visibleUser = await this.prisma.user.findFirst({
      where: {
        AND: [{ id: targetUserId }, visibilityWhere],
      },
      select: { id: true },
    });

    if (!visibleUser) {
      throw new NotFoundException('User not found');
    }
  }

  async assertCanAssignDepartments(
    actorUserId: string,
    departmentIds: string[],
  ): Promise<void> {
    if (departmentIds.length === 0) {
      return;
    }

    const context =
      await this.permissionService.resolveUserPermissionContext(actorUserId);

    if (context.dataScope.mode === 'ALL') {
      return;
    }

    const allowedDepartmentIds = new Set(context.dataScope.departmentIds);
    const disallowedDepartmentIds = departmentIds.filter(
      (departmentId) => !allowedDepartmentIds.has(departmentId),
    );

    if (disallowedDepartmentIds.length > 0) {
      throw new BadRequestException('Department not in data scope');
    }
  }
}
