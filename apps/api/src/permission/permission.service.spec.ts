import { PERMISSION_CACHE_PREFIX } from './permission.constants';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  const createPrismaMock = () => ({
    permission: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  });

  const createRedisMock = () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const redis = createRedisMock();
    const service = new PermissionService(prisma as never, redis as never);

    redis.get.mockImplementation((key: string) =>
      Promise.resolve(key === 'permission_cache_version' ? '1' : null),
    );
    return { prisma, redis, service };
  };

  function userWithRoles(roles: unknown[]) {
    return { id: 'user-1', roles };
  }

  it('returns all active permissions for active super_admin role', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(
      userWithRoles([{ role: { code: 'super_admin', status: 'ACTIVE' } }]),
    );
    prisma.permission.findMany.mockResolvedValue([
      { code: 'user.read' },
      { code: 'role.read' },
    ]);

    await expect(
      service.resolveUserPermissionContext('user-1'),
    ).resolves.toEqual({
      userId: 'user-1',
      roleCodes: ['super_admin'],
      permissionCodes: ['role.read', 'user.read'],
      isSuperAdmin: true,
    });
    expect(prisma.permission.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
      select: { code: true },
    });
  });

  it('returns the union of active permissions from multiple active roles', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(
      userWithRoles([
        {
          role: {
            code: 'admin',
            status: 'ACTIVE',
            permissions: [
              { permission: { code: 'user.read', status: 'ACTIVE' } },
            ],
          },
        },
        {
          role: {
            code: 'operator',
            status: 'ACTIVE',
            permissions: [
              { permission: { code: 'file.read', status: 'ACTIVE' } },
              { permission: { code: 'user.read', status: 'ACTIVE' } },
            ],
          },
        },
      ]),
    );

    await expect(
      service.resolveUserPermissionContext('user-1'),
    ).resolves.toMatchObject({
      roleCodes: ['admin', 'operator'],
      permissionCodes: ['file.read', 'user.read'],
      isSuperAdmin: false,
    });
  });

  it('ignores disabled roles', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(
      userWithRoles([
        {
          role: {
            code: 'admin',
            status: 'DISABLED',
            permissions: [
              { permission: { code: 'user.read', status: 'ACTIVE' } },
            ],
          },
        },
      ]),
    );

    await expect(
      service.resolveUserPermissionContext('user-1'),
    ).resolves.toMatchObject({
      roleCodes: [],
      permissionCodes: [],
      isSuperAdmin: false,
    });
  });

  it('ignores disabled permissions', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(
      userWithRoles([
        {
          role: {
            code: 'admin',
            status: 'ACTIVE',
            permissions: [
              { permission: { code: 'user.read', status: 'ACTIVE' } },
              { permission: { code: 'user.delete', status: 'DISABLED' } },
            ],
          },
        },
      ]),
    );

    await expect(
      service.resolveUserPermissionContext('user-1'),
    ).resolves.toMatchObject({
      permissionCodes: ['user.read'],
    });
  });

  it('returns an empty permission set for users without active roles', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(userWithRoles([]));

    await expect(
      service.resolveUserPermissionContext('user-1'),
    ).resolves.toEqual({
      userId: 'user-1',
      roleCodes: [],
      permissionCodes: [],
      isSuperAdmin: false,
    });
  });

  it('invalidates a user permission cache key', async () => {
    const { redis, service } = createService();

    await service.invalidateUserPermissionContext('user-1');

    expect(redis.del).toHaveBeenCalledWith(
      `${PERMISSION_CACHE_PREFIX}:1:user-1`,
    );
  });
});
