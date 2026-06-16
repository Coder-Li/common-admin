import { PERMISSION_CACHE_PREFIX } from './permission.constants';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  const createPrismaMock = () => ({
    permission: {
      findMany: jest.fn(),
    },
    department: {
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

  function role(overrides: Record<string, unknown>) {
    return {
      code: 'role',
      status: 'ACTIVE',
      dataScope: 'SELF',
      permissions: [],
      dataScopeDepartments: [],
      ...overrides,
    };
  }

  function userRole(rolePayload: Record<string, unknown>) {
    return { role: role(rolePayload) };
  }

  function department(
    id: string,
    status = 'ACTIVE',
    overrides: Record<string, unknown> = {},
  ) {
    return {
      userId: 'user-1',
      departmentId: id,
      department: {
        id,
        status,
        parentId: null,
        ...overrides,
      },
    };
  }

  function scopedDepartment(id: string, status = 'ACTIVE') {
    return {
      roleId: 'role-1',
      departmentId: id,
      department: { id, status },
    };
  }

  function userWithRoles(roles: unknown[], departments: unknown[] = []) {
    return { id: 'user-1', roles, departments };
  }

  it('returns all active permissions for active super_admin role', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(
      userWithRoles([userRole({ code: 'super_admin', dataScope: 'SELF' })]),
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
      dataScope: { mode: 'ALL', selfUserIds: [], departmentIds: [] },
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
            dataScope: 'SELF',
            dataScopeDepartments: [],
            permissions: [
              { permission: { code: 'user.read', status: 'ACTIVE' } },
            ],
          },
        },
        {
          role: {
            code: 'operator',
            status: 'ACTIVE',
            dataScope: 'SELF',
            dataScopeDepartments: [],
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
            dataScope: 'ALL',
            dataScopeDepartments: [],
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
      dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
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
            dataScope: 'SELF',
            dataScopeDepartments: [],
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
      dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
    });
  });

  it('ignores legacy cached permission context without data scope and refreshes the cache', async () => {
    const { prisma, redis, service } = createService();
    redis.get.mockImplementation((key: string) =>
      Promise.resolve(
        key === 'permission_cache_version'
          ? '1'
          : JSON.stringify({
              userId: 'user-1',
              roleCodes: ['legacy-admin'],
              permissionCodes: ['legacy.permission'],
              isSuperAdmin: false,
            }),
      ),
    );
    prisma.user.findUnique.mockResolvedValue(
      userWithRoles([userRole({ code: 'standard', dataScope: 'SELF' })]),
    );

    const context = await service.resolveUserPermissionContext('user-1');

    expect(context).toMatchObject({
      userId: 'user-1',
      roleCodes: ['standard'],
      permissionCodes: [],
      isSuperAdmin: false,
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: ['user-1'],
        departmentIds: [],
      },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      `${PERMISSION_CACHE_PREFIX}:1:user-1`,
      expect.stringContaining('"dataScope"'),
      'EX',
      300,
    );
  });

  it('ignores cached permission context with malformed data scope and refreshes the cache', async () => {
    const { prisma, redis, service } = createService();
    redis.get.mockImplementation((key: string) =>
      Promise.resolve(
        key === 'permission_cache_version'
          ? '1'
          : JSON.stringify({
              userId: 'user-1',
              roleCodes: ['cached-admin'],
              permissionCodes: ['cached.permission'],
              isSuperAdmin: false,
              dataScope: {
                mode: 'EVERYTHING',
                selfUserIds: [],
                departmentIds: [],
              },
            }),
      ),
    );
    prisma.user.findUnique.mockResolvedValue(userWithRoles([]));

    const context = await service.resolveUserPermissionContext('user-1');

    expect(context.dataScope).toEqual({
      mode: 'LIMITED',
      selfUserIds: [],
      departmentIds: [],
    });
    expect(context.roleCodes).toEqual([]);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      `${PERMISSION_CACHE_PREFIX}:1:user-1`,
      expect.stringContaining('"dataScope"'),
      'EX',
      300,
    );
  });

  describe('effective data scope', () => {
    it('returns all data scope for active super_admin role', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles([userRole({ code: 'super_admin', dataScope: 'SELF' })]),
      );
      prisma.permission.findMany.mockResolvedValue([]);

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: { mode: 'ALL', selfUserIds: [], departmentIds: [] },
      });
    });

    it('returns all data scope when any active role grants all', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles([
          userRole({ code: 'operator', dataScope: 'SELF' }),
          userRole({ code: 'auditor', dataScope: 'ALL' }),
        ]),
      );

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: { mode: 'ALL', selfUserIds: [], departmentIds: [] },
      });
    });

    it('returns limited self data scope for self roles', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles([userRole({ code: 'standard', dataScope: 'SELF' })]),
      );

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: {
          mode: 'LIMITED',
          selfUserIds: ['user-1'],
          departmentIds: [],
        },
      });
    });

    it('returns active current-user departments for department roles', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles(
          [userRole({ code: 'dept-user', dataScope: 'DEPT' })],
          [department('dept-b'), department('dept-disabled', 'DISABLED')],
        ),
      );

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: {
          mode: 'LIMITED',
          selfUserIds: [],
          departmentIds: ['dept-b'],
        },
      });
    });

    it('returns current-user departments and active descendants for department-and-children roles', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles(
          [userRole({ code: 'dept-tree-user', dataScope: 'DEPT_AND_CHILDREN' })],
          [department('dept-parent')],
        ),
      );
      prisma.department.findMany
        .mockResolvedValueOnce([
          { id: 'dept-child-b', parentId: 'dept-parent', status: 'ACTIVE' },
          { id: 'dept-child-a', parentId: 'dept-parent', status: 'ACTIVE' },
        ])
        .mockResolvedValueOnce([
          { id: 'dept-grandchild', parentId: 'dept-child-a', status: 'ACTIVE' },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: {
          mode: 'LIMITED',
          selfUserIds: [],
          departmentIds: [
            'dept-child-a',
            'dept-child-b',
            'dept-grandchild',
            'dept-parent',
          ],
        },
      });
      expect(prisma.department.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          parentId: { in: ['dept-parent'] },
        },
        select: { id: true, parentId: true },
      });
      expect(prisma.department.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          status: 'ACTIVE',
          parentId: { in: ['dept-child-a', 'dept-child-b'] },
        },
        select: { id: true, parentId: true },
      });
      expect(prisma.department.findMany).toHaveBeenNthCalledWith(3, {
        where: {
          status: 'ACTIVE',
          parentId: { in: ['dept-grandchild'] },
        },
        select: { id: true, parentId: true },
      });
    });

    it('terminates descendant traversal when departments form a cycle', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles(
          [userRole({ code: 'dept-tree-user', dataScope: 'DEPT_AND_CHILDREN' })],
          [department('dept-parent')],
        ),
      );
      prisma.department.findMany
        .mockResolvedValueOnce([
          { id: 'dept-child', parentId: 'dept-parent', status: 'ACTIVE' },
          { id: 'dept-child', parentId: 'dept-parent', status: 'ACTIVE' },
        ])
        .mockResolvedValueOnce([
          { id: 'dept-parent', parentId: 'dept-child', status: 'ACTIVE' },
        ]);

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: {
          mode: 'LIMITED',
          selfUserIds: [],
          departmentIds: ['dept-child', 'dept-parent'],
        },
      });
      expect(prisma.department.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.department.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          status: 'ACTIVE',
          parentId: { in: ['dept-parent'] },
        },
        select: { id: true, parentId: true },
      });
      expect(prisma.department.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          status: 'ACTIVE',
          parentId: { in: ['dept-child'] },
        },
        select: { id: true, parentId: true },
      });
    });

    it('traverses descendants once for repeated department-and-children roles', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles(
          [
            userRole({
              code: 'dept-tree-user-a',
              dataScope: 'DEPT_AND_CHILDREN',
            }),
            userRole({
              code: 'dept-tree-user-b',
              dataScope: 'DEPT_AND_CHILDREN',
            }),
          ],
          [department('dept-parent')],
        ),
      );
      prisma.department.findMany
        .mockResolvedValueOnce([
          { id: 'dept-child', parentId: 'dept-parent', status: 'ACTIVE' },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: {
          mode: 'LIMITED',
          selfUserIds: [],
          departmentIds: ['dept-child', 'dept-parent'],
        },
      });
      expect(prisma.department.findMany).toHaveBeenCalledTimes(2);
    });

    it('returns active linked departments for custom-department roles', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles([
          userRole({
            code: 'custom-user',
            dataScope: 'CUSTOM_DEPT',
            dataScopeDepartments: [
              scopedDepartment('dept-active'),
              scopedDepartment('dept-disabled', 'DISABLED'),
            ],
          }),
        ]),
      );

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: {
          mode: 'LIMITED',
          selfUserIds: [],
          departmentIds: ['dept-active'],
        },
      });
    });

    it('does not let disabled roles contribute data scope', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles([
          userRole({
            code: 'disabled-all',
            status: 'DISABLED',
            dataScope: 'ALL',
          }),
        ]),
      );

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
      });
    });

    it('sorts and de-duplicates department ids from multiple roles', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles(
          [
            userRole({ code: 'dept-user', dataScope: 'DEPT' }),
            userRole({
              code: 'custom-user',
              dataScope: 'CUSTOM_DEPT',
              dataScopeDepartments: [
                scopedDepartment('dept-a'),
                scopedDepartment('dept-c'),
              ],
            }),
          ],
          [department('dept-c'), department('dept-b')],
        ),
      );

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: {
          mode: 'LIMITED',
          selfUserIds: [],
          departmentIds: ['dept-a', 'dept-b', 'dept-c'],
        },
      });
    });

    it('returns empty limited data scope for limited users with no departments', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(
        userWithRoles([userRole({ code: 'dept-user', dataScope: 'DEPT' })]),
      );

      await expect(
        service.resolveUserPermissionContext('user-1'),
      ).resolves.toMatchObject({
        dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
      });
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
