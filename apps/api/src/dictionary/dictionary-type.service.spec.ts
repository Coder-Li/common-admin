import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { DictionaryStatus, Prisma } from '@prisma/client';
import {
  CreateDictionaryTypeDto,
  DictionaryTypeListQueryDto,
  UpdateDictionaryTypeDto,
} from './dto/dictionary-type.request';
import { toDictionaryTypeResponse } from './dictionary-type.mapper';
import { DictionaryTypeController } from './dictionary-type.controller';
import { DictionaryTypeService } from './dictionary-type.service';

describe('DictionaryTypeListQueryDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformQuery = (query: Record<string, unknown>) =>
    pipe.transform(query, {
      type: 'query',
      metatype: DictionaryTypeListQueryDto,
    });

  it('defaults page and pageSize and validates status and isSystem filters', async () => {
    await expect(
      transformQuery({ status: 'ACTIVE', isSystem: 'true' }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      status: 'ACTIVE',
      isSystem: true,
    });

    await expect(transformQuery({ status: 'ARCHIVED' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(transformQuery({ isSystem: 'maybe' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects disallowed sort fields and accepts allowed sort fields', async () => {
    await expect(transformQuery({ sort: 'id:asc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(transformQuery({ sort: 'code:asc' })).resolves.toMatchObject({
      sort: 'code:asc',
    });
  });
});

describe('CreateDictionaryTypeDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformBody = (
    body: Record<string, unknown>,
    metatype: typeof CreateDictionaryTypeDto | typeof UpdateDictionaryTypeDto,
  ) =>
    pipe.transform(body, {
      type: 'body',
      metatype,
    });

  it('validates dictionary codes', async () => {
    await expect(
      transformBody(
        { code: 'User Role', name: 'User role' },
        CreateDictionaryTypeDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      transformBody(
        { code: 'user_role', name: 'User role' },
        CreateDictionaryTypeDto,
      ),
    ).resolves.toMatchObject({
      code: 'user_role',
      name: 'User role',
    });
  });

  it('rejects isSystem in create and update bodies', async () => {
    await expect(
      transformBody(
        { code: 'common_status', name: 'Common status', isSystem: true },
        CreateDictionaryTypeDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      transformBody({ name: 'Common status', isSystem: false }, UpdateDictionaryTypeDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('dictionary type mapper', () => {
  it('returns ISO timestamps and includes read-only isSystem', () => {
    expect(
      toDictionaryTypeResponse({
        id: 'type-1',
        code: 'user_role',
        name: 'User role',
        status: 'ACTIVE',
        isSystem: true,
        description: 'Role labels',
        createdAt: new Date('2026-06-08T01:02:03.000Z'),
        updatedAt: new Date('2026-06-08T04:05:06.000Z'),
      }),
    ).toEqual({
      id: 'type-1',
      code: 'user_role',
      name: 'User role',
      status: 'ACTIVE',
      isSystem: true,
      description: 'Role labels',
      createdAt: '2026-06-08T01:02:03.000Z',
      updatedAt: '2026-06-08T04:05:06.000Z',
    });
  });

  it('omits optional description when it is null', () => {
    expect(
      toDictionaryTypeResponse({
        id: 'type-1',
        code: 'user_role',
        name: 'User role',
        status: 'ACTIVE',
        isSystem: true,
        description: null,
        createdAt: new Date('2026-06-08T01:02:03.000Z'),
        updatedAt: new Date('2026-06-08T04:05:06.000Z'),
      }),
    ).not.toHaveProperty('description');
  });
});

describe('DictionaryTypeService', () => {
  const makeType = (overrides: Record<string, unknown> = {}) => ({
    id: 'type-1',
    code: 'user_role',
    name: 'User role',
    status: DictionaryStatus.ACTIVE,
    isSystem: false,
    description: 'Role labels',
    createdAt: new Date('2026-06-08T01:02:03.000Z'),
    updatedAt: new Date('2026-06-08T04:05:06.000Z'),
    ...overrides,
  });

  const createPrismaMock = () => ({
    dictionaryType: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    dictionaryItem: {
      count: jest.fn(),
    },
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const service = new DictionaryTypeService(prisma as never);

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

  const foreignKeyError = () =>
    new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: 'test',
    });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('listTypes', () => {
    it('applies pagination, default sort, search, and status/isSystem filters', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.findMany.mockResolvedValue([makeType()]);
      prisma.dictionaryType.count.mockResolvedValue(1);

      await service.listTypes({
        page: 2,
        pageSize: 10,
        search: 'role',
        status: DictionaryStatus.ACTIVE,
        isSystem: true,
      });

      expect(prisma.dictionaryType.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: {
          status: DictionaryStatus.ACTIVE,
          isSystem: true,
          OR: [
            { code: { contains: 'role', mode: 'insensitive' } },
            { name: { contains: 'role', mode: 'insensitive' } },
            { description: { contains: 'role', mode: 'insensitive' } },
          ],
        },
      });
    });

    it('passes the same where object to findMany and count', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.findMany.mockResolvedValue([]);
      prisma.dictionaryType.count.mockResolvedValue(0);

      await service.listTypes({
        page: 1,
        pageSize: 20,
        search: 'role',
        status: DictionaryStatus.DISABLED,
      });

      const findManyWhere = firstMockArg<{
        where: Prisma.DictionaryTypeWhereInput;
      }>(prisma.dictionaryType.findMany).where;
      const countWhere = firstMockArg<{
        where: Prisma.DictionaryTypeWhereInput;
      }>(prisma.dictionaryType.count).where;

      expect(findManyWhere).toBe(countWhere);
      expect(countWhere.status).toBe(DictionaryStatus.DISABLED);
    });

    it.each(['id:asc', 'createdAt:sideways'])(
      'rejects invalid sort %s',
      async (sort) => {
        const { service } = createService();

        await expect(
          service.listTypes({ page: 1, pageSize: 20, sort }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );
  });

  describe('createType', () => {
    it('maps duplicate code writes to ConflictException', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.createType({
          code: 'user_role',
          name: 'User role',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findById', () => {
    it('maps null finds to NotFoundException', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing-type')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateType', () => {
    it('maps missing records to NotFoundException', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.update.mockRejectedValue(notFoundError());

      await expect(
        service.updateType('missing-type', { name: 'Missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates only DTO fields and cannot change code or isSystem', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.update.mockResolvedValue(
        makeType({ name: 'User roles', status: DictionaryStatus.DISABLED }),
      );

      await service.updateType('type-1', {
        name: 'User roles',
        status: DictionaryStatus.DISABLED,
        description: 'Updated labels',
      });

      expect(prisma.dictionaryType.update).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        data: {
          name: 'User roles',
          status: DictionaryStatus.DISABLED,
          description: 'Updated labels',
        },
      });
      expect(
        firstMockArg<{ data: Record<string, unknown> }>(
          prisma.dictionaryType.update,
        ).data,
      ).not.toMatchObject({
        code: expect.anything(),
        isSystem: expect.anything(),
      });
    });
  });

  describe('deleteType', () => {
    it('maps missing records to NotFoundException', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.findUnique.mockResolvedValue(null);

      await expect(service.deleteType('missing-type')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects system dictionary types', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.findUnique.mockResolvedValue(
        makeType({ isSystem: true }),
      );

      await expect(service.deleteType('type-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.dictionaryType.delete).not.toHaveBeenCalled();
    });

    it('rejects non-system dictionary types with existing items', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.findUnique.mockResolvedValue(makeType());
      prisma.dictionaryItem.count.mockResolvedValue(2);

      await expect(service.deleteType('type-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.dictionaryType.delete).not.toHaveBeenCalled();
    });

    it('deletes non-system dictionary types without items', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.findUnique.mockResolvedValue(makeType());
      prisma.dictionaryItem.count.mockResolvedValue(0);
      prisma.dictionaryType.delete.mockResolvedValue(makeType());

      await service.deleteType('type-1');

      expect(prisma.dictionaryType.delete).toHaveBeenCalledWith({
        where: { id: 'type-1' },
      });
    });

    it('maps delete P2025 to NotFoundException', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.findUnique.mockResolvedValue(makeType());
      prisma.dictionaryItem.count.mockResolvedValue(0);
      prisma.dictionaryType.delete.mockRejectedValue(notFoundError());

      await expect(service.deleteType('missing-type')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps delete P2003 races to ConflictException', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryType.findUnique.mockResolvedValue(makeType());
      prisma.dictionaryItem.count.mockResolvedValue(0);
      prisma.dictionaryType.delete.mockRejectedValue(foreignKeyError());

      await expect(service.deleteType('type-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});

describe('DictionaryTypeController', () => {
  it('uses 204 status for successful delete responses', async () => {
    const service = {
      deleteType: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new DictionaryTypeController(service as never);

    await expect(controller.deleteType('type-1')).resolves.toBeUndefined();

    expect(service.deleteType).toHaveBeenCalledWith('type-1');
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, controller.deleteType),
    ).toBe(204);
  });
});
