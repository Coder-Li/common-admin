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
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit-log/audit-log.constants';
import type {
  AuditActor,
  AuditRequestMeta,
} from '../audit-log/audit-log.types';
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
    auditLog: {
      create: jest.fn(),
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
    const tx = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(tx),
    );
    const auditLogService = {
      record: jest.fn(),
    };
    const service = new UserService(
      prisma as never,
      permissionService as never,
      auditLogService as never,
    );

    return { auditLogService, prisma, service, tx };
  };

  const auditActor: AuditActor = {
    userId: 'actor-1',
    email: 'actor@example.com',
    name: 'actor',
  };

  const auditRequestMeta: AuditRequestMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
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
    const { prisma, service, tx } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });
    tx.user.create.mockResolvedValue(makeUser());

    await service.createUser({
      email: 'ada@example.com',
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'CorrectHorse123',
    });

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: { create: [{ roleId: 'role-standard' }] },
        }),
      }),
    );
  });

  it('create assigns explicit active role codes when provided', async () => {
    const { prisma, service, tx } = createService();
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-admin', code: 'admin' },
    ]);
    tx.user.create.mockResolvedValue(makeUser());

    await service.createUser({
      email: 'ada@example.com',
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'CorrectHorse123',
      roleCodes: ['admin'],
    });

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: { create: [{ roleId: 'role-admin' }] },
        }),
      }),
    );
  });

  it('createUser writes create user audit log with after snapshot', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    const created = makeUser();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });
    tx.user.create.mockResolvedValue(created);

    await service.createUser(
      {
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
      },
      auditActor,
      auditRequestMeta,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.any(Object),
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: AUDIT_ACTIONS.CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        after: toUserResponse(created),
      },
      tx,
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
    const { service, tx } = createService();
    tx.user.findUnique.mockResolvedValue(makeUser());
    tx.user.update.mockResolvedValue(makeUser({ firstName: 'Augusta' }));

    await service.updateUser('user-1', { firstName: 'Augusta' });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { firstName: 'Augusta' },
      include: expect.any(Object),
    });
  });

  it('updateUser reads before, updates, and writes before and after audit in the same transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    const before = makeUser({ firstName: 'Ada' });
    const after = makeUser({ firstName: 'Augusta' });
    tx.user.findUnique.mockResolvedValue(before);
    tx.user.update.mockResolvedValue(after);

    await service.updateUser(
      'user-1',
      { firstName: 'Augusta' },
      auditActor,
      auditRequestMeta,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: expect.any(Object),
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { firstName: 'Augusta' },
      include: expect.any(Object),
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        before: toUserResponse(before),
        after: toUserResponse(after),
      },
      tx,
    );
  });

  it('resetPassword hashes the new password', async () => {
    const { service, tx } = createService();
    tx.user.update.mockResolvedValue(makeUser());
    tx.userSession.updateMany.mockResolvedValue({ count: 0 });

    await service.resetPassword('user-1', 'NewSecure123!');

    const updateArgs = firstMockArg<{
      data: { passwordHash: string };
    }>(tx.user.update);
    expect(updateArgs.data.passwordHash).not.toBe('NewSecure123!');
    await expect(
      bcrypt.compare('NewSecure123!', updateArgs.data.passwordHash),
    ).resolves.toBe(true);
  });

  it('resetPassword revokes all target user sessions with admin_reset_password', async () => {
    const { service, tx } = createService();
    tx.user.update.mockResolvedValue(makeUser());
    tx.userSession.updateMany.mockResolvedValue({ count: 2 });

    await service.resetPassword('user-1', 'NewSecure123!');

    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'admin_reset_password',
      },
    });
  });

  it('resetPassword returns public user response without passwordHash', async () => {
    const { service, tx } = createService();
    tx.user.update.mockResolvedValue(makeUser());
    tx.userSession.updateMany.mockResolvedValue({ count: 0 });

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

  it('resetPassword writes reset_password audit without password fields', async () => {
    const { auditLogService, service, tx } = createService();
    tx.user.update.mockResolvedValue(makeUser());
    tx.userSession.updateMany.mockResolvedValue({ count: 0 });

    await service.resetPassword(
      'user-1',
      'NewSecure123!',
      auditActor,
      auditRequestMeta,
    );

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RESET_PASSWORD,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        after: {
          id: 'user-1',
          email: 'ada@example.com',
          username: 'ada',
        },
      }),
      tx,
    );
    const auditInput = auditLogService.record.mock.calls[0][0];
    expect(
      JSON.stringify({
        before: auditInput.before,
        after: auditInput.after,
        metadata: auditInput.metadata,
      }),
    ).not.toMatch(/password|newPassword|passwordHash/i);
  });

  it('resetPassword throws NotFoundException for missing user', async () => {
    const { service, tx } = createService();
    tx.user.update.mockRejectedValue(recordNotFoundError());

    await expect(
      service.resetPassword('missing-user', 'NewSecure123!'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('replaceRoles replaces full role set atomically', async () => {
    const { prisma, service, tx } = createService();
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-admin', code: 'admin' },
    ]);
    tx.user.findUnique
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValue(makeUser());

    await service.replaceRoles('user-1', ['admin'], 'actor-1');

    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId: 'role-admin' }],
      skipDuplicates: true,
    });
  });

  it('deleteUser writes delete user audit with before snapshot in the same transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    const before = makeUser();
    tx.user.findUnique.mockResolvedValue(before);
    tx.user.delete.mockResolvedValue(before);

    await service.deleteUser('user-1', auditActor, auditRequestMeta);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: expect.any(Object),
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: AUDIT_ACTIONS.DELETE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        before: toUserResponse(before),
      },
      tx,
    );
  });

  it('replaceRoles writes before and after role code lists in the same transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    const validationUser = makeUser({
      roles: [
        { role: { code: 'old_root_snapshot', name: 'Old root snapshot' } },
      ],
    });
    const transactionalBefore = makeUser({
      roles: [{ role: { code: 'standard', name: 'Standard' } }],
    });
    const after = makeUser({
      roles: [{ role: { code: 'admin', name: 'Admin' } }],
    });
    prisma.user.findUnique.mockResolvedValue(validationUser);
    tx.user.findUnique
      .mockResolvedValueOnce(transactionalBefore)
      .mockResolvedValueOnce(after);
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-admin', code: 'admin' },
    ]);

    await service.replaceRoles(
      'user-1',
      ['admin'],
      'actor-1',
      auditActor,
      auditRequestMeta,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: 'user-1' },
      include: expect.any(Object),
    });
    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId: 'role-admin' }],
      skipDuplicates: true,
    });
    expect(tx.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 'user-1' },
      include: expect.any(Object),
    });
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
    expect(prisma.userRole.createMany).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: AUDIT_ACTIONS.REPLACE_ROLES,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        before: { roleCodes: ['standard'] },
        after: { roleCodes: ['admin'] },
      },
      tx,
    );
    expect(
      permissionService.invalidateUserPermissionContext,
    ).toHaveBeenCalledWith('user-1');
  });

  it('rejects the business request when audit recording fails inside a Prisma transaction', async () => {
    const { auditLogService, service, tx } = createService();
    tx.user.findUnique.mockResolvedValue(makeUser());
    tx.user.update.mockResolvedValue(makeUser({ firstName: 'Augusta' }));
    auditLogService.record.mockRejectedValue(new Error('audit failed'));

    await expect(
      service.updateUser(
        'user-1',
        { firstName: 'Augusta' },
        auditActor,
        auditRequestMeta,
      ),
    ).rejects.toThrow('audit failed');
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
    const { prisma, service, tx } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });
    tx.user.create.mockRejectedValue(uniqueConstraintError());

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
