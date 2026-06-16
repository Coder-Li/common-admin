import { Inject, Injectable } from '@nestjs/common';
import {
  DataScope,
  DepartmentStatus,
  PermissionStatus,
  Prisma,
  RoleStatus,
} from '@prisma/client';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  PERMISSION_CACHE_PREFIX,
  PERMISSION_CACHE_VERSION_KEY,
  SYSTEM_ROLE_CODES,
} from './permission.constants';
import { toPermissionResponse } from './permission.mapper';
import type {
  EffectiveDataScope,
  UserPermissionContext,
} from './permission.types';

const CACHE_TTL_SECONDS = 300;

const userPermissionContextArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: {
    departments: { include: { department: true } },
    roles: {
      include: {
        role: {
          include: {
            dataScopeDepartments: { include: { department: true } },
            permissions: { include: { permission: true } },
          },
        },
      },
    },
  },
});

type LoadedPermissionUser = Prisma.UserGetPayload<
  typeof userPermissionContextArgs
>;
type LoadedRole = LoadedPermissionUser['roles'][number]['role'];

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      where: { status: PermissionStatus.ACTIVE },
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });

    return permissions.map(toPermissionResponse);
  }

  async listPermissionModules() {
    const permissions = await this.listPermissions();
    const modules = new Map<string, typeof permissions>();

    for (const permission of permissions) {
      const modulePermissions = modules.get(permission.module) ?? [];
      modulePermissions.push(permission);
      modules.set(permission.module, modulePermissions);
    }

    return [...modules.entries()].map(([module, modulePermissions]) => ({
      module,
      permissions: modulePermissions,
    }));
  }

  async resolveUserPermissionContext(
    userId: string,
  ): Promise<UserPermissionContext> {
    const cacheKey = await this.userCacheKey(userId);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const cachedContext = this.parseCachedUserPermissionContext(cached);

      if (cachedContext) {
        return cachedContext;
      }
    }

    const context = await this.loadUserPermissionContext(userId);

    await this.redis.set(
      cacheKey,
      JSON.stringify(context),
      'EX',
      CACHE_TTL_SECONDS,
    );

    return context;
  }

  async invalidateUserPermissionContext(userId: string): Promise<void> {
    await this.redis.del(await this.userCacheKey(userId));
  }

  async invalidateAllPermissionContexts(): Promise<void> {
    await this.redis.incr(PERMISSION_CACHE_VERSION_KEY);
  }

  private async loadUserPermissionContext(
    userId: string,
  ): Promise<UserPermissionContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userPermissionContextArgs.include,
    });

    if (!user) {
      return {
        userId,
        roleCodes: [],
        permissionCodes: [],
        isSuperAdmin: false,
        dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
      };
    }

    const activeRoles = user.roles
      .map((userRole) => userRole.role)
      .filter((role) => role.status === RoleStatus.ACTIVE);
    const roleCodes = [...new Set(activeRoles.map((role) => role.code))].sort();
    const isSuperAdmin = roleCodes.includes(SYSTEM_ROLE_CODES.superAdmin);
    const permissionCodes = isSuperAdmin
      ? await this.listAllActivePermissionCodes()
      : [
          ...new Set(
            activeRoles.flatMap((role) =>
              role.permissions
                .filter(
                  (rolePermission) =>
                    rolePermission.permission.status ===
                    PermissionStatus.ACTIVE,
                )
                .map((rolePermission) => rolePermission.permission.code),
            ),
          ),
        ].sort();
    const dataScope = await this.buildEffectiveDataScope(user, activeRoles);

    return {
      userId,
      roleCodes,
      permissionCodes,
      isSuperAdmin,
      dataScope,
    };
  }

  private async buildEffectiveDataScope(
    user: LoadedPermissionUser,
    activeRoles: LoadedRole[],
  ): Promise<EffectiveDataScope> {
    if (
      activeRoles.some(
        (role) =>
          role.code === SYSTEM_ROLE_CODES.superAdmin ||
          role.dataScope === DataScope.ALL,
      )
    ) {
      return { mode: 'ALL', selfUserIds: [], departmentIds: [] };
    }

    const selfUserIds: string[] = [];
    const departmentIds: string[] = [];
    const activeUserDepartmentIds = this.toUniqueSorted(
      user.departments
        .filter(
          (userDepartment) =>
            userDepartment.department.status === DepartmentStatus.ACTIVE,
        )
        .map((userDepartment) => userDepartment.departmentId),
    );
    const descendantDepartmentIds = activeRoles.some(
      (role) => role.dataScope === DataScope.DEPT_AND_CHILDREN,
    )
      ? await this.listActiveDescendantDepartmentIds(activeUserDepartmentIds)
      : [];

    for (const role of activeRoles) {
      if (role.dataScope === DataScope.SELF) {
        selfUserIds.push(user.id);
        continue;
      }

      if (role.dataScope === DataScope.DEPT) {
        departmentIds.push(...activeUserDepartmentIds);
        continue;
      }

      if (role.dataScope === DataScope.DEPT_AND_CHILDREN) {
        departmentIds.push(...activeUserDepartmentIds);
        departmentIds.push(...descendantDepartmentIds);
        continue;
      }

      if (role.dataScope === DataScope.CUSTOM_DEPT) {
        departmentIds.push(
          ...role.dataScopeDepartments
            .filter(
              (dataScopeDepartment) =>
                dataScopeDepartment.department.status ===
                DepartmentStatus.ACTIVE,
            )
            .map((dataScopeDepartment) => dataScopeDepartment.departmentId),
        );
      }
    }

    return {
      mode: 'LIMITED',
      selfUserIds: this.toUniqueSorted(selfUserIds),
      departmentIds: this.toUniqueSorted(departmentIds),
    };
  }

  private async listActiveDescendantDepartmentIds(
    rootIds: string[],
  ): Promise<string[]> {
    const visitedIds = new Set(rootIds);
    let parentIds = this.toUniqueSorted(rootIds);
    const descendantIds: string[] = [];

    while (parentIds.length > 0) {
      const children = await this.prisma.department.findMany({
        where: {
          status: DepartmentStatus.ACTIVE,
          parentId: { in: parentIds },
        },
        select: { id: true, parentId: true },
      });
      const childIds = children
        .map((department) => department.id)
        .filter((id) => !visitedIds.has(id));

      descendantIds.push(...childIds);
      for (const childId of childIds) {
        visitedIds.add(childId);
      }
      parentIds = this.toUniqueSorted(childIds);
    }

    return this.toUniqueSorted(descendantIds);
  }

  private toUniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort();
  }

  private parseCachedUserPermissionContext(
    cached: string,
  ): UserPermissionContext | null {
    try {
      const context = JSON.parse(cached) as unknown;

      return this.isUserPermissionContext(context) ? context : null;
    } catch {
      return null;
    }
  }

  private isUserPermissionContext(
    context: unknown,
  ): context is UserPermissionContext {
    if (!context || typeof context !== 'object') {
      return false;
    }

    const value = context as Record<string, unknown>;

    return (
      typeof value.userId === 'string' &&
      Array.isArray(value.roleCodes) &&
      value.roleCodes.every((roleCode) => typeof roleCode === 'string') &&
      Array.isArray(value.permissionCodes) &&
      value.permissionCodes.every(
        (permissionCode) => typeof permissionCode === 'string',
      ) &&
      typeof value.isSuperAdmin === 'boolean' &&
      this.isEffectiveDataScope(value.dataScope)
    );
  }

  private isEffectiveDataScope(
    dataScope: unknown,
  ): dataScope is EffectiveDataScope {
    if (!dataScope || typeof dataScope !== 'object') {
      return false;
    }

    const value = dataScope as Record<string, unknown>;

    if (
      !Array.isArray(value.selfUserIds) ||
      !Array.isArray(value.departmentIds)
    ) {
      return false;
    }

    if (
      !value.selfUserIds.every((userId) => typeof userId === 'string') ||
      !value.departmentIds.every(
        (departmentId) => typeof departmentId === 'string',
      )
    ) {
      return false;
    }

    if (value.mode === 'ALL') {
      return value.selfUserIds.length === 0 && value.departmentIds.length === 0;
    }

    return value.mode === 'LIMITED';
  }

  private async listAllActivePermissionCodes(): Promise<string[]> {
    const permissions = await this.prisma.permission.findMany({
      where: { status: PermissionStatus.ACTIVE },
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
      select: { code: true },
    });

    return permissions.map((permission) => permission.code).sort();
  }

  private async userCacheKey(userId: string): Promise<string> {
    const version = (await this.redis.get(PERMISSION_CACHE_VERSION_KEY)) ?? '1';

    return `${PERMISSION_CACHE_PREFIX}:${version}:${userId}`;
  }
}
