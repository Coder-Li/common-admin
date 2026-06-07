import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { UserListQueryDto } from './dto/user.request';
import { toUserResponse } from './user.mapper';
import { Role } from './role.enum';
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

  it('inherits list defaults and validates role filters', async () => {
    await expect(transformQuery({ role: Role.ADMIN })).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      role: Role.ADMIN,
    });

    await expect(transformQuery({ role: 'OWNER' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects sorting by passwordHash', async () => {
    await expect(
      transformQuery({ sort: 'passwordHash:asc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects sorting by id', async () => {
    await expect(transformQuery({ sort: 'id:asc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects invalid sort directions', async () => {
    await expect(
      transformQuery({ sort: 'createdAt:sideways' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('user mapper', () => {
  const persistedUser = {
    id: 'user-1',
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: Role.ADMIN,
    passwordHash: 'hashed-password',
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
      role: Role.ADMIN,
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
    role: Role.ADMIN,
    passwordHash: 'hashed-password',
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
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const service = new UserService(prisma as never);

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

  const notFoundError = () =>
    new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('listUsers', () => {
    it('calls findMany with skip, take, allowed orderBy, and role where', async () => {
      const { prisma, service } = createService();
      prisma.user.findMany.mockResolvedValue([makeUser()]);
      prisma.user.count.mockResolvedValue(1);

      await service.listUsers({
        page: 2,
        pageSize: 10,
        sort: 'email:asc',
        role: Role.ADMIN,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        orderBy: { email: 'asc' },
        where: { role: Role.ADMIN },
      });
    });

    it('calls count with the same where object passed to findMany', async () => {
      const { prisma, service } = createService();
      prisma.user.findMany.mockResolvedValue([makeUser()]);
      prisma.user.count.mockResolvedValue(1);

      await service.listUsers({
        page: 1,
        pageSize: 20,
        search: 'ada',
        role: Role.ADMIN,
      });

      const findManyWhere = firstMockArg<{ where: Prisma.UserWhereInput }>(
        prisma.user.findMany,
      ).where;

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: findManyWhere,
      });
    });

    it('maps search to OR over public name and identity fields', async () => {
      const { prisma, service } = createService();
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.listUsers({ page: 1, pageSize: 20, search: 'Ada' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'Ada', mode: 'insensitive' } },
              { username: { contains: 'Ada', mode: 'insensitive' } },
              { firstName: { contains: 'Ada', mode: 'insensitive' } },
              { lastName: { contains: 'Ada', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('passes the same case-insensitive search where object to findMany and count', async () => {
      const { prisma, service } = createService();
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.listUsers({ page: 1, pageSize: 20, search: 'Ada' });

      const findManyWhere = firstMockArg<{ where: Prisma.UserWhereInput }>(
        prisma.user.findMany,
      ).where;
      const countWhere = firstMockArg<{ where: Prisma.UserWhereInput }>(
        prisma.user.count,
      ).where;

      expect(findManyWhere).toBe(countWhere);
      expect(countWhere.OR?.[0]).toEqual({
        email: { contains: 'Ada', mode: 'insensitive' },
      });
    });

    it('maps role to where.role', async () => {
      const { prisma, service } = createService();
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.listUsers({ page: 1, pageSize: 20, role: Role.STANDARD });

      expect(
        firstMockArg<{ where: Prisma.UserWhereInput }>(prisma.user.findMany)
          .where,
      ).toEqual({
        role: Role.STANDARD,
      });
    });

    it('rejects invalid sort fields', async () => {
      const { service } = createService();

      await expect(
        service.listUsers({
          page: 1,
          pageSize: 20,
          sort: 'passwordHash:asc',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createUser', () => {
    it('hashes the password and writes passwordHash without password', async () => {
      const { prisma, service } = createService();
      prisma.user.create.mockResolvedValue(makeUser());

      const result = await service.createUser({
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'CorrectHorse123',
        role: Role.ADMIN,
      });

      const createData = firstMockArg<{
        data: { passwordHash: string; password?: string };
      }>(prisma.user.create).data;

      expect(createData).not.toHaveProperty('password');
      expect(createData.passwordHash).toEqual(expect.any(String));
      expect(createData.passwordHash).not.toBe('CorrectHorse123');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('maps duplicate unique constraints to ConflictException', async () => {
      const { prisma, service } = createService();
      prisma.user.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.createUser({
          email: 'ada@example.com',
          username: 'ada',
          firstName: 'Ada',
          lastName: 'Lovelace',
          password: 'CorrectHorse123',
          role: Role.ADMIN,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findById', () => {
    it('returns a public user when found', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(makeUser());

      await expect(service.findById('user-1')).resolves.toEqual({
        id: 'user-1',
        email: 'ada@example.com',
        username: 'ada',
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: Role.ADMIN,
        createdAt: '2026-06-07T01:02:03.000Z',
        updatedAt: '2026-06-07T04:05:06.000Z',
      });
    });

    it('throws NotFoundException when the user is missing', async () => {
      const { prisma, service } = createService();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing-user')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('returns a public updated user', async () => {
      const { prisma, service } = createService();
      prisma.user.update.mockResolvedValue(
        makeUser({ firstName: 'Augusta', updatedAt: new Date('2026-06-08') }),
      );

      await expect(
        service.updateUser('user-1', { firstName: 'Augusta' }),
      ).resolves.toMatchObject({
        id: 'user-1',
        firstName: 'Augusta',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { firstName: 'Augusta' },
      });
    });

    it('maps missing users to NotFoundException', async () => {
      const { prisma, service } = createService();
      prisma.user.update.mockRejectedValue(notFoundError());

      await expect(
        service.updateUser('missing-user', { firstName: 'Augusta' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps duplicate unique conflicts to ConflictException', async () => {
      const { prisma, service } = createService();
      prisma.user.update.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.updateUser('user-1', { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('deleteUser', () => {
    it('returns void when deletion succeeds', async () => {
      const { prisma, service } = createService();
      prisma.user.delete.mockResolvedValue(makeUser());

      await expect(service.deleteUser('user-1')).resolves.toBeUndefined();
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('throws NotFoundException when the user is missing', async () => {
      const { prisma, service } = createService();
      prisma.user.delete.mockRejectedValue(notFoundError());

      await expect(service.deleteUser('missing-user')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
