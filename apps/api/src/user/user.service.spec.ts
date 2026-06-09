/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { UserListQueryDto } from './dto/user.request';
import { toUserResponse } from './user.mapper';
import { UserService } from './user.service';

describe('ListQueryDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformQuery = (query: Record<string, unknown>) =>
    pipe.transform(query, {
      type: 'query',
      metatype: ListQueryDto,
    });

  it('defaults page and pageSize for empty query input', async () => {
    await expect(transformQuery({})).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });

  it.each([
    { page: 0 },
    { page: 'abc' },
    { pageSize: 101 },
    { sort: 'createdAt:sideways' },
  ])('rejects invalid list query %p', async (query) => {
    await expect(transformQuery(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('UserListQueryDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformQuery = (query: Record<string, unknown>) =>
    pipe.transform(query, {
      type: 'query',
      metatype: UserListQueryDto,
    });

  it('inherits list defaults and validates roleCode filters', async () => {
    await expect(transformQuery({ roleCode: 'admin' })).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      roleCode: 'admin',
    });
  });

  it('rejects sorting by role', async () => {
    await expect(transformQuery({ sort: 'role:asc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('user mapper', () => {
  const persistedUser = {
    id: 'user-1',
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Ada',
    lastName: 'Lovelace',
    passwordHash: 'hashed-password',
    roles: [{ role: { code: 'admin', name: 'Admin' } }],
    createdAt: new Date('2026-06-07T01:02:03.000Z'),
    updatedAt: new Date('2026-06-07T04:05:06.000Z'),
  };

  it('maps persisted users to public response fields', () => {
    expect(toUserResponse(persistedUser)).toEqual({
      id: 'user-1',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Ada',
      lastName: 'Lovelace',
      roles: [{ code: 'admin', name: 'Admin' }],
      createdAt: '2026-06-07T01:02:03.000Z',
      updatedAt: '2026-06-07T04:05:06.000Z',
    });
  });

  it('excludes passwordHash from public response output', () => {
    expect(toUserResponse(persistedUser)).not.toHaveProperty('passwordHash');
  });
});

describe('UserService', () => {
  const makeUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'ada@example.com',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    passwordHash: 'hashed-password',
    roles: [{ role: { code: 'admin', name: 'Admin' } }],
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
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
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

  const permissionService = {
    resolveUserPermissionContext: jest.fn(),
    invalidateUserPermissionContext: jest.fn(),
  };

  const createService = () => {
    const prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(prisma),
    );
    const service = new UserService(
      prisma as never,
      permissionService as never,
    );

    return { prisma, service };
  };

  function firstMockArg<TArg>(mock: { mock: { calls: unknown[][] } }): TArg {
    const firstCall = mock.mock.calls[0];

    if (!firstCall) {
      throw new Error('Expected mock to have been called');
    }

    return firstCall[0] as TArg;
  }

  const uniqueConstraintError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  const recordNotFoundError = () =>
    new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('create assigns active default role when role codes are omitted', async () => {
    const { prisma, service } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });
    prisma.user.create.mockResolvedValue(makeUser());

    await service.createUser({
      email: 'ada@example.com',
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'CorrectHorse123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: { create: [{ roleId: 'role-standard' }] },
        }),
      }),
    );
  });

  it('create assigns explicit active role codes when provided', async () => {
    const { prisma, service } = createService();
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-admin', code: 'admin' },
    ]);
    prisma.user.create.mockResolvedValue(makeUser());

    await service.createUser({
      email: 'ada@example.com',
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'CorrectHorse123',
      roleCodes: ['admin'],
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: { create: [{ roleId: 'role-admin' }] },
        }),
      }),
    );
  });

  it('create rejects disabled role codes', async () => {
    const { prisma, service } = createService();
    prisma.role.findMany.mockResolvedValue([]);

    await expect(
      service.createUser({
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        roleCodes: ['disabled'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update does not mutate roles', async () => {
    const { prisma, service } = createService();
    prisma.user.update.mockResolvedValue(makeUser({ firstName: 'Augusta' }));

    await service.updateUser('user-1', { firstName: 'Augusta' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { firstName: 'Augusta' },
      include: expect.any(Object),
    });
  });

  it('resetPassword hashes the new password', async () => {
    const { prisma, service } = createService();
    prisma.user.update.mockResolvedValue(makeUser());
    prisma.userSession.updateMany.mockResolvedValue({ count: 0 });

    await service.resetPassword('user-1', 'NewSecure123!');

    const updateArgs = firstMockArg<{
      data: { passwordHash: string };
    }>(prisma.user.update);
    expect(updateArgs.data.passwordHash).not.toBe('NewSecure123!');
    await expect(
      bcrypt.compare('NewSecure123!', updateArgs.data.passwordHash),
    ).resolves.toBe(true);
  });

  it('resetPassword revokes all target user sessions with admin_reset_password', async () => {
    const { prisma, service } = createService();
    prisma.user.update.mockResolvedValue(makeUser());
    prisma.userSession.updateMany.mockResolvedValue({ count: 2 });

    await service.resetPassword('user-1', 'NewSecure123!');

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'admin_reset_password',
      },
    });
  });

  it('resetPassword returns public user response without passwordHash', async () => {
    const { prisma, service } = createService();
    prisma.user.update.mockResolvedValue(makeUser());
    prisma.userSession.updateMany.mockResolvedValue({ count: 0 });

    const response = await service.resetPassword('user-1', 'NewSecure123!');

    expect(response).toEqual({
      id: 'user-1',
      email: 'ada@example.com',
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      roles: [{ code: 'admin', name: 'Admin' }],
      createdAt: '2026-06-07T01:02:03.000Z',
      updatedAt: '2026-06-07T04:05:06.000Z',
    });
    expect(response).not.toHaveProperty('passwordHash');
  });

  it('resetPassword throws NotFoundException for missing user', async () => {
    const { prisma, service } = createService();
    prisma.user.update.mockRejectedValue(recordNotFoundError());

    await expect(
      service.resetPassword('missing-user', 'NewSecure123!'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('replaceRoles replaces full role set atomically', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-admin', code: 'admin' },
    ]);

    await service.replaceRoles('user-1', ['admin'], 'actor-1');

    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId: 'role-admin' }],
      skipDuplicates: true,
    });
  });

  it('replaceRoles rejects removing the last active super_admin', async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        roles: [{ role: { code: 'super_admin', name: 'Super admin' } }],
      }),
    );
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-admin', code: 'admin' },
    ]);
    prisma.userRole.count.mockResolvedValue(1);

    await expect(
      service.replaceRoles('user-1', ['admin'], 'actor-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('list filters by any assigned role code', async () => {
    const { prisma, service } = createService();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.listUsers({ page: 1, pageSize: 20, roleCode: 'admin' });

    expect(
      firstMockArg<{ where: Prisma.UserWhereInput }>(prisma.user.findMany)
        .where,
    ).toEqual({
      roles: { some: { role: { code: 'admin' } } },
    });
  });

  it('list responses expose roles', async () => {
    const { prisma, service } = createService();
    prisma.user.findMany.mockResolvedValue([makeUser()]);
    prisma.user.count.mockResolvedValue(1);

    await expect(service.listUsers({ page: 1, pageSize: 20 })).resolves.toEqual(
      {
        items: [
          expect.objectContaining({
            roles: [{ code: 'admin', name: 'Admin' }],
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    );
  });

  it('sorting by role is rejected as unsupported', async () => {
    const { service } = createService();

    await expect(
      service.listUsers({ page: 1, pageSize: 20, sort: 'role:asc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps duplicate unique constraints to ConflictException', async () => {
    const { prisma, service } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });
    prisma.user.create.mockRejectedValue(uniqueConstraintError());

    await expect(
      service.createUser({
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
