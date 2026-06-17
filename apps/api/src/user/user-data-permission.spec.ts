import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserService data permissions', () => {
  const makeUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'ada@example.com',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    passwordHash: 'hashed-password',
    roles: [{ role: { code: 'admin', name: 'Admin' } }],
    departments: [],
    positions: [],
    createdAt: new Date('2026-06-07T01:02:03.000Z'),
    updatedAt: new Date('2026-06-07T04:05:06.000Z'),
    ...overrides,
  });

  const createPrismaMock = () => ({
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
    },
    position: {
      findMany: jest.fn(),
    },
    userDepartment: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    userPosition: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    userRole: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    userSession: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: Function) =>
      callback(createPrismaMock()),
    ),
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const tx = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(tx),
    );
    const permissionService = {
      resolveUserPermissionContext: jest.fn(),
      invalidateUserPermissionContext: jest.fn(),
    };
    const dataPermissionService = {
      buildUserVisibilityWhere: jest.fn().mockResolvedValue({
        departments: { some: { departmentId: { in: ['dept-1'] } } },
      }),
      assertCanAccessUser: jest.fn().mockResolvedValue(undefined),
      assertCanAssignDepartments: jest.fn().mockResolvedValue(undefined),
    };
    const auditLogService = {
      record: jest.fn(),
    };
    const service = new UserService(
      prisma as never,
      permissionService as never,
      dataPermissionService as never,
      auditLogService as never,
      {
        demoMode: false,
        defaultAdminEmail: 'admin@example.com',
      },
    );

    return { dataPermissionService, prisma, service, tx };
  };

  it('list combines base filters and visibility with AND', async () => {
    const { dataPermissionService, prisma, service } = createService();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.listUsers(
      { page: 1, pageSize: 20, roleCode: 'admin' },
      'actor-1',
    );

    const expectedWhere: Prisma.UserWhereInput = {
      AND: [
        { roles: { some: { role: { code: 'admin' } } } },
        { departments: { some: { departmentId: { in: ['dept-1'] } } } },
      ],
    };
    expect(dataPermissionService.buildUserVisibilityWhere).toHaveBeenCalledWith(
      'actor-1',
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(prisma.user.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('detail checks visibility before returning', async () => {
    const { dataPermissionService, prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(makeUser());

    await service.findById('user-1', 'actor-1');

    expect(dataPermissionService.assertCanAccessUser).toHaveBeenCalledWith(
      'actor-1',
      'user-1',
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });

  it('create with departments calls assertCanAssignDepartments', async () => {
    const { dataPermissionService, prisma, service, tx } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });
    tx.department.findMany.mockResolvedValue([{ id: 'dept-1' }]);
    tx.user.create.mockResolvedValue(makeUser());
    tx.user.findUnique.mockResolvedValue(
      makeUser({
        departments: [
          {
            isPrimary: true,
            department: {
              id: 'dept-1',
              code: 'engineering',
              name: 'Engineering',
              status: 'ACTIVE',
              sortOrder: 1,
            },
          },
        ],
      }),
    );

    await service.createUser(
      {
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        departmentIds: ['dept-1'],
      },
      undefined,
      undefined,
      undefined,
      'actor-1',
    );

    expect(dataPermissionService.assertCanAssignDepartments).toHaveBeenCalledWith(
      'actor-1',
      ['dept-1'],
    );
  });

  it('create without departments does not call assignment assertion', async () => {
    const { dataPermissionService, prisma, service, tx } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });
    tx.user.create.mockResolvedValue(makeUser());

    await service.createUser(
      {
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
      },
      undefined,
      undefined,
      undefined,
      'actor-1',
    );

    expect(
      dataPermissionService.assertCanAssignDepartments,
    ).not.toHaveBeenCalled();
  });

  it.each([
    [
      'updateUser',
      async (service: UserService) =>
        service.updateUser(
          'user-1',
          { firstName: 'Augusta' },
          undefined,
          undefined,
          undefined,
          'actor-1',
        ),
      (tx: ReturnType<typeof createPrismaMock>) => tx.user.update,
    ],
    [
      'deleteUser',
      async (service: UserService) =>
        service.deleteUser(
          'user-1',
          undefined,
          undefined,
          undefined,
          'actor-1',
        ),
      (tx: ReturnType<typeof createPrismaMock>) => tx.user.delete,
    ],
    [
      'resetPassword',
      async (service: UserService) =>
        service.resetPassword(
          'user-1',
          'NewSecure123!',
          undefined,
          undefined,
          undefined,
          'actor-1',
        ),
      (tx: ReturnType<typeof createPrismaMock>) => tx.user.update,
    ],
    [
      'replaceRoles',
      async (service: UserService) =>
        service.replaceRoles('user-1', ['admin'], 'actor-1'),
      (tx: ReturnType<typeof createPrismaMock>) => tx.userRole.deleteMany,
    ],
  ])(
    '%s rejects out-of-scope targets before mutation',
    async (_name, callService, mutationMock) => {
      const { dataPermissionService, service, tx } = createService();
      dataPermissionService.assertCanAccessUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(callService(service)).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(dataPermissionService.assertCanAccessUser).toHaveBeenCalledWith(
        'actor-1',
        'user-1',
      );
      expect(mutationMock(tx)).not.toHaveBeenCalled();
    },
  );
});

describe('UserController data permission actor wiring', () => {
  const user = {
    sub: 'actor-1',
    sid: 'session-1',
    email: 'actor@example.com',
    username: 'Actor',
  };

  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  };

  const createService = () => ({
    findProfileById: jest.fn(),
    listUsers: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    resetPassword: jest.fn(),
    replaceRoles: jest.fn(),
    deleteUser: jest.fn(),
  });

  it('GET /users/me remains unscoped through findProfileById', async () => {
    const service = createService();
    const controller = new UserController(service as unknown as UserService);

    await controller.getMe(user);

    expect(service.findProfileById).toHaveBeenCalledWith('actor-1');
    expect(service.findById).not.toHaveBeenCalled();
  });

  it('passes actor user id into scoped service methods', async () => {
    const service = createService();
    const controller = new UserController(service as unknown as UserService);

    await controller.listUsers({ page: 1, pageSize: 20 }, user);
    await controller.getUser('user-1', user);
    await controller.createUser(
      {
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
      },
      user,
      request as never,
    );
    await controller.updateUser('user-1', { firstName: 'Augusta' }, user, request as never);
    await controller.resetPassword(
      'user-1',
      { newPassword: 'NewSecure123!' },
      user,
      request as never,
    );
    await controller.replaceRoles(
      'user-1',
      { roleCodes: ['admin'] },
      user,
      request as never,
    );
    await controller.deleteUser('user-1', user, request as never);

    expect(service.listUsers).toHaveBeenCalledWith(
      { page: 1, pageSize: 20 },
      'actor-1',
    );
    expect(service.findById).toHaveBeenCalledWith('user-1', 'actor-1');
    expect(service.createUser).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
      { requestId: 'unknown' },
      'actor-1',
    );
    expect(service.updateUser).toHaveBeenCalledWith(
      'user-1',
      { firstName: 'Augusta' },
      expect.any(Object),
      expect.any(Object),
      { requestId: 'unknown' },
      'actor-1',
    );
    expect(service.resetPassword).toHaveBeenCalledWith(
      'user-1',
      'NewSecure123!',
      expect.any(Object),
      expect.any(Object),
      { requestId: 'unknown' },
      'actor-1',
    );
    expect(service.replaceRoles).toHaveBeenCalledWith(
      'user-1',
      ['admin'],
      'actor-1',
      expect.any(Object),
      expect.any(Object),
      { requestId: 'unknown' },
    );
    expect(service.deleteUser).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      expect.any(Object),
      { requestId: 'unknown' },
      'actor-1',
    );
  });
});
