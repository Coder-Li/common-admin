import { Inject, Injectable } from '@nestjs/common';
import { PermissionStatus, RoleStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  PERMISSION_CACHE_PREFIX,
  PERMISSION_CACHE_VERSION_KEY,
  SYSTEM_ROLE_CODES,
} from './permission.constants';
import { toPermissionResponse } from './permission.mapper';
import type { UserPermissionContext } from './permission.types';

const CACHE_TTL_SECONDS = 300;

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
      return JSON.parse(cached) as UserPermissionContext;
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
      select: {
        id: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return {
        userId,
        roleCodes: [],
        permissionCodes: [],
        isSuperAdmin: false,
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

    return {
      userId,
      roleCodes,
      permissionCodes,
      isSuperAdmin,
    };
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
