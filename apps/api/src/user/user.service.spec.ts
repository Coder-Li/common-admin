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
import {
  CreateUserDto,
  UpdateUserDto,
  UserListQueryDto,
} from './dto/user.request';
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

  it('inherits list defaults and validates organization filters', async () => {
    await expect(
      transformQuery({
        roleCode: 'admin',
        departmentId: 'dept-1',
        positionId: 'pos-1',
      }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      roleCode: 'admin',
      departmentId: 'dept-1',
      positionId: 'pos-1',
    });
  });

  it('rejects sorting by role', async () => {
    await expect(transformQuery({ sort: 'role:asc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('user organization assignment DTOs', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformBody = (
    dto: typeof CreateUserDto | typeof UpdateUserDto,
    body: Record<string, unknown>,
  ) =>
    pipe.transform(body, {
      type: 'body',
      metatype: dto,
    });

  it('accepts optional organization assignment fields on create', async () => {
    await expect(
      transformBody(CreateUserDto, {
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        departmentIds: ['dept-1'],
        primaryDepartmentId: 'dept-1',
        positionIds: ['pos-1'],
      }),
    ).resolves.toMatchObject({
      departmentIds: ['dept-1'],
      primaryDepartmentId: 'dept-1',
      positionIds: ['pos-1'],
    });
  });

  it('accepts optional organization assignment fields on update', async () => {
    await expect(
      transformBody(UpdateUserDto, {
        departmentIds: [],
        positionIds: [],
      }),
    ).resolves.toMatchObject({
      departmentIds: [],
      positionIds: [],
    });
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
      departments: [],
      primaryDepartment: null,
      positions: [],
      createdAt: '2026-06-07T01:02:03.000Z',
      updatedAt: '2026-06-07T04:05:06.000Z',
    });
  });

  it('excludes passwordHash from public response output', () => {
    expect(toUserResponse(persistedUser)).not.toHaveProperty('passwordHash');
  });

  it('maps organization assignments to ordered public summaries', () => {
    const response = toUserResponse({
      ...persistedUser,
      departments: [
        {
          isPrimary: false,
          department: {
            id: 'dept-2',
            code: 'operations',
            name: 'Operations',
            status: 'ACTIVE',
            sortOrder: 1,
          },
        },
        {
          isPrimary: true,
          department: {
            id: 'dept-1',
            code: 'engineering',
            name: 'Engineering',
            status: 'ACTIVE',
            sortOrder: 99,
          },
        },
      ],
      positions: [
        {
          position: {
            id: 'pos-2',
            code: 'architect',
            name: 'Architect',
            status: 'ACTIVE',
            sortOrder: 2,
          },
        },
        {
          position: {
            id: 'pos-1',
            code: 'developer',
            name: 'Developer',
            status: 'ACTIVE',
            sortOrder: 1,
          },
        },
      ],
    });

    expect(response.departments).toEqual([
      expect.objectContaining({
        id: 'dept-1',
        code: 'engineering',
        name: 'Engineering',
        status: 'ACTIVE',
      }),
      expect.objectContaining({
        id: 'dept-2',
        code: 'operations',
      }),
    ]);
    expect(response.primaryDepartment).toMatchObject({ id: 'dept-1' });
    expect(response.positions).toEqual([
      expect.objectContaining({ id: 'pos-1', code: 'developer' }),
      expect.objectContaining({ id: 'pos-2', code: 'architect' }),
    ]);
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
    department: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    position: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
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
  const auditMetadata = {
    requestId: 'req_12345678',
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
      auditMetadata,
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
        metadata: expect.objectContaining({ requestId: 'req_12345678' }),
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

  it('create assigns organization relations and defaults a single department as primary', async () => {
    const { prisma, service, tx } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });
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
        positions: [
          {
            position: {
              id: 'pos-1',
              code: 'developer',
              name: 'Developer',
              status: 'ACTIVE',
              sortOrder: 1,
            },
          },
        ],
      }),
    );
    tx.department.findMany.mockResolvedValue([
      {
        id: 'dept-1',
        code: 'engineering',
        name: 'Engineering',
        status: 'ACTIVE',
        sortOrder: 1,
      },
    ]);
    tx.position.findMany.mockResolvedValue([
      {
        id: 'pos-1',
        code: 'developer',
        name: 'Developer',
        status: 'ACTIVE',
        sortOrder: 1,
      },
    ]);

    await service.createUser({
      email: 'ada@example.com',
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'CorrectHorse123',
      departmentIds: ['dept-1'],
      positionIds: ['pos-1'],
    });

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          departmentIds: expect.anything(),
          primaryDepartmentId: expect.anything(),
          positionIds: expect.anything(),
        }),
      }),
    );
    expect(tx.userDepartment.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', departmentId: 'dept-1', isPrimary: true }],
    });
    expect(tx.userPosition.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', positionId: 'pos-1' }],
    });
  });

  it('create rejects multiple departments without a primary department', async () => {
    const { prisma, service } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });

    await expect(
      service.createUser({
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        departmentIds: ['dept-1', 'dept-2'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rejects a primary department outside the submitted departments', async () => {
    const { prisma, service } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });

    await expect(
      service.createUser({
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        departmentIds: ['dept-1'],
        primaryDepartmentId: 'dept-2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rejects blank primaryDepartmentId with a single department', async () => {
    const { prisma, service } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });

    await expect(
      service.createUser({
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        departmentIds: ['dept-1'],
        primaryDepartmentId: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rejects primaryDepartmentId when departmentIds is omitted', async () => {
    const { prisma, service } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });

    await expect(
      service.createUser({
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        primaryDepartmentId: 'dept-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rejects blank primaryDepartmentId when departmentIds is omitted', async () => {
    const { prisma, service } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });

    await expect(
      service.createUser({
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        primaryDepartmentId: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['departmentIds', ['dept-1', 'dept-1']],
    ['departmentIds', ['missing-dept']],
    ['departmentIds', ['disabled-dept']],
    ['positionIds', ['pos-1', 'pos-1']],
    ['positionIds', ['missing-pos']],
    ['positionIds', ['disabled-pos']],
  ])('create rejects invalid %s payloads', async (field, ids) => {
    const { prisma, service, tx } = createService();
    prisma.role.findFirst.mockResolvedValue({ id: 'role-standard' });
    tx.department.findMany.mockResolvedValue([]);
    tx.position.findMany.mockResolvedValue([]);

    await expect(
      service.createUser({
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        [field]: ids,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['departmentIds', ['disabled-dept']],
    ['positionIds', ['disabled-pos']],
  ])('update rejects disabled submitted %s payloads', async (field, ids) => {
    const { service, tx } = createService();
    tx.user.findUnique.mockResolvedValue(makeUser());
    tx.department.findMany.mockResolvedValue([]);
    tx.position.findMany.mockResolvedValue([]);

    await expect(
      service.updateUser('user-1', {
        [field]: ids,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('update replaces departments when departmentIds are provided', async () => {
    const { service, tx } = createService();
    tx.user.findUnique
      .mockResolvedValueOnce(
        makeUser({
          departments: [
            {
              isPrimary: true,
              department: {
                id: 'dept-old',
                code: 'old',
                name: 'Old',
                status: 'ACTIVE',
                sortOrder: 1,
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        makeUser({
          departments: [
            {
              isPrimary: true,
              department: {
                id: 'dept-new',
                code: 'new',
                name: 'New',
                status: 'ACTIVE',
                sortOrder: 1,
              },
            },
          ],
        }),
      );
    tx.department.findMany.mockResolvedValue([
      {
        id: 'dept-new',
        code: 'new',
        name: 'New',
        status: 'ACTIVE',
        sortOrder: 1,
      },
    ]);
    tx.user.update.mockResolvedValue(makeUser());

    await service.updateUser('user-1', {
      departmentIds: ['dept-new'],
    });

    expect(tx.userDepartment.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.userDepartment.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', departmentId: 'dept-new', isPrimary: true }],
    });
  });

  it('update clears departments when departmentIds is an empty array', async () => {
    const { service, tx } = createService();
    tx.user.findUnique
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce(makeUser({ departments: [] }));
    tx.user.update.mockResolvedValue(makeUser());

    await service.updateUser('user-1', {
      departmentIds: [],
    });

    expect(tx.userDepartment.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.userDepartment.createMany).not.toHaveBeenCalled();
  });

  it('update rejects blank primaryDepartmentId when clearing departments', async () => {
    const { service, tx } = createService();
    tx.user.findUnique.mockResolvedValue(makeUser());

    await expect(
      service.updateUser('user-1', {
        departmentIds: [],
        primaryDepartmentId: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update leaves departments unchanged when departmentIds is omitted', async () => {
    const { service, tx } = createService();
    tx.user.findUnique.mockResolvedValue(
      makeUser({
        departments: [
          {
            isPrimary: false,
            department: {
              id: 'dept-disabled',
              code: 'disabled',
              name: 'Disabled',
              status: 'DISABLED',
              sortOrder: 5,
            },
          },
        ],
      }),
    );
    tx.user.update.mockResolvedValue(makeUser());

    await service.updateUser('user-1', {
      firstName: 'Augusta',
    });

    expect(tx.userDepartment.deleteMany).not.toHaveBeenCalled();
    expect(tx.userDepartment.createMany).not.toHaveBeenCalled();
  });

  it('update rejects primaryDepartmentId when departmentIds is omitted', async () => {
    const { service } = createService();

    await expect(
      service.updateUser('user-1', {
        primaryDepartmentId: 'dept-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update rejects blank primaryDepartmentId when departmentIds is omitted', async () => {
    const { service } = createService();

    await expect(
      service.updateUser('user-1', {
        primaryDepartmentId: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update preserves existing disabled departments when departmentIds is omitted', async () => {
    const { service, tx } = createService();
    const before = makeUser({
      departments: [
        {
          isPrimary: false,
          department: {
            id: 'dept-disabled',
            code: 'disabled',
            name: 'Disabled',
            status: 'DISABLED',
            sortOrder: 5,
          },
        },
      ],
    });
    tx.user.findUnique.mockResolvedValue(before);
    tx.user.update.mockResolvedValue(before);

    const response = await service.updateUser('user-1', {
      firstName: 'Augusta',
    });

    expect(response.departments).toEqual([
      expect.objectContaining({ id: 'dept-disabled', status: 'DISABLED' }),
    ]);
  });

  it('update replaces positions when positionIds are provided', async () => {
    const { service, tx } = createService();
    tx.user.findUnique
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce(makeUser({ positions: [] }));
    tx.position.findMany.mockResolvedValue([
      {
        id: 'pos-new',
        code: 'new',
        name: 'New',
        status: 'ACTIVE',
        sortOrder: 1,
      },
    ]);
    tx.user.update.mockResolvedValue(makeUser());

    await service.updateUser('user-1', {
      positionIds: ['pos-new'],
    });

    expect(tx.userPosition.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.userPosition.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', positionId: 'pos-new' }],
    });
  });

  it('update clears positions when positionIds is an empty array', async () => {
    const { service, tx } = createService();
    tx.user.findUnique
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce(makeUser({ positions: [] }));
    tx.user.update.mockResolvedValue(makeUser());

    await service.updateUser('user-1', {
      positionIds: [],
    });

    expect(tx.userPosition.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.userPosition.createMany).not.toHaveBeenCalled();
  });

  it('update leaves positions unchanged when positionIds is omitted', async () => {
    const { service, tx } = createService();
    tx.user.findUnique.mockResolvedValue(
      makeUser({
        positions: [
          {
            position: {
              id: 'pos-disabled',
              code: 'disabled',
              name: 'Disabled',
              status: 'DISABLED',
              sortOrder: 5,
            },
          },
        ],
      }),
    );
    tx.user.update.mockResolvedValue(makeUser());

    await service.updateUser('user-1', {
      firstName: 'Augusta',
    });

    expect(tx.userPosition.deleteMany).not.toHaveBeenCalled();
    expect(tx.userPosition.createMany).not.toHaveBeenCalled();
  });

  it('update preserves existing disabled positions when positionIds is omitted', async () => {
    const { service, tx } = createService();
    const before = makeUser({
      positions: [
        {
          position: {
            id: 'pos-disabled',
            code: 'disabled',
            name: 'Disabled',
            status: 'DISABLED',
            sortOrder: 5,
          },
        },
      ],
    });
    tx.user.findUnique.mockResolvedValue(before);
    tx.user.update.mockResolvedValue(before);

    const response = await service.updateUser('user-1', {
      firstName: 'Augusta',
    });

    expect(response.positions).toEqual([
      expect.objectContaining({ id: 'pos-disabled', status: 'DISABLED' }),
    ]);
  });

  it('list filters by departmentId and positionId', async () => {
    const { prisma, service } = createService();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.listUsers({
      page: 1,
      pageSize: 20,
      departmentId: 'dept-1',
      positionId: 'pos-1',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          departments: { some: { departmentId: 'dept-1' } },
          positions: { some: { positionId: 'pos-1' } },
        }),
      }),
    );
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        departments: { some: { departmentId: 'dept-1' } },
        positions: { some: { positionId: 'pos-1' } },
      }),
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
      auditMetadata,
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
        metadata: expect.objectContaining({ requestId: 'req_12345678' }),
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
      departments: [],
      primaryDepartment: null,
      positions: [],
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
      auditMetadata,
    );

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RESET_PASSWORD,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        metadata: expect.objectContaining({ requestId: 'req_12345678' }),
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

    await service.deleteUser(
      'user-1',
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );

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
        metadata: expect.objectContaining({ requestId: 'req_12345678' }),
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
      auditMetadata,
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
        metadata: expect.objectContaining({ requestId: 'req_12345678' }),
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
