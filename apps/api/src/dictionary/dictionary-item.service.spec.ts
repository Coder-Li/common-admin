import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { DictionaryStatus, Prisma } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit-log/audit-log.constants';
import type {
  AuditActor,
  AuditRequestMeta,
} from '../audit-log/audit-log.types';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { DictionaryItemController } from './dictionary-item.controller';
import {
  CreateDictionaryItemDto,
  DictionaryItemListQueryDto,
  UpdateDictionaryItemDto,
} from './dto/dictionary-item.request';
import { toDictionaryItemResponse } from './dictionary-item.mapper';
import { DictionaryItemService } from './dictionary-item.service';

describe('DictionaryItemListQueryDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformQuery = (query: Record<string, unknown>) =>
    pipe.transform(query, {
      type: 'query',
      metatype: DictionaryItemListQueryDto,
    });

  it('validates typeId, typeCode, status, and isDefault filters', async () => {
    await expect(
      transformQuery({
        typeId: '23b9e330-0126-4ab7-90c3-0c67cfc6846c',
        typeCode: 'user_role',
        status: 'ACTIVE',
        isDefault: 'false',
      }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      typeId: '23b9e330-0126-4ab7-90c3-0c67cfc6846c',
      typeCode: 'user_role',
      status: 'ACTIVE',
      isDefault: false,
    });

    await expect(
      transformQuery({ typeId: 'not-a-uuid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      transformQuery({ typeCode: 'User Role' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(transformQuery({ status: 'ARCHIVED' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      transformQuery({ isDefault: 'sometimes' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects disallowed sort fields and accepts allowed sort fields', async () => {
    await expect(transformQuery({ sort: 'typeId:asc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(
      transformQuery({ sort: 'sortOrder:asc' }),
    ).resolves.toMatchObject({
      sort: 'sortOrder:asc',
    });
  });
});

describe('DictionaryItemController', () => {
  function controllerMethod(name: keyof DictionaryItemController) {
    const descriptor = Object.getOwnPropertyDescriptor(
      DictionaryItemController.prototype,
      name,
    );

    if (!descriptor?.value) {
      throw new Error(`Expected ${String(name)} controller method`);
    }

    return descriptor.value as unknown;
  }

  it('delegates delete requests, uses 204, and requires delete permission', async () => {
    const service = {
      deleteItem: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new DictionaryItemController(service as never);
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

    await expect(
      controller.deleteItem('item-1', user, request as never),
    ).resolves.toBeUndefined();

    expect(service.deleteItem).toHaveBeenCalledWith(
      'item-1',
      {
        userId: 'actor-1',
        email: 'actor@example.com',
        name: 'Actor',
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    );
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, controllerMethod('deleteItem')),
    ).toBe(204);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod('deleteItem')),
    ).toEqual(['dictionary.delete']);
  });

  it('requires permission metadata on every management method', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod('listItems')),
    ).toEqual(['dictionary.read']);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod('getItem')),
    ).toEqual(['dictionary.read']);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod('createItem')),
    ).toEqual(['dictionary.create']);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod('updateItem')),
    ).toEqual(['dictionary.update']);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod('deleteItem')),
    ).toEqual(['dictionary.delete']);
  });
});

describe('CreateDictionaryItemDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformBody = (
    body: Record<string, unknown>,
    metatype:
      | typeof CreateDictionaryItemDto
      | typeof UpdateDictionaryItemDto = CreateDictionaryItemDto,
  ) =>
    pipe.transform(body, {
      type: 'body',
      metatype,
    });

  const validBody = {
    typeId: '23b9e330-0126-4ab7-90c3-0c67cfc6846c',
    value: 'ADMIN',
    label: 'Admin',
  };

  it.each([
    ['scalar', 'red'],
    ['array', ['red']],
    ['null', null],
  ])('rejects %s metadata', async (_name, metadata) => {
    await expect(
      transformBody({ ...validBody, metadata }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts plain object metadata', async () => {
    await expect(
      transformBody({ ...validBody, metadata: { tone: 'critical' } }),
    ).resolves.toMatchObject({
      metadata: { tone: 'critical' },
    });
  });

  it.each([
    ['Date', new Date('2026-06-08T00:00:00.000Z')],
    [
      'class instance',
      new (class BadgeMetadata {
        tone = 'critical';
      })(),
    ],
  ])(
    'rejects %s metadata because it is not a plain object',
    async (_name, metadata) => {
      await expect(
        transformBody({ ...validBody, metadata }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('validates badgeVariant', async () => {
    await expect(
      transformBody({ ...validBody, badgeVariant: 'PRIMARY' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      transformBody({ ...validBody, badgeVariant: 'DANGER' }),
    ).resolves.toMatchObject({
      badgeVariant: 'DANGER',
    });
  });

  it('rejects isSystem in create and update bodies', async () => {
    await expect(
      transformBody({ ...validBody, isSystem: true }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      transformBody(
        { label: 'Admin', isSystem: false },
        UpdateDictionaryItemDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('dictionary item mapper', () => {
  it('includes typeCode and typeName', () => {
    expect(
      toDictionaryItemResponse({
        id: 'item-1',
        typeId: 'type-1',
        value: 'ADMIN',
        label: 'Admin',
        sortOrder: 10,
        status: 'ACTIVE',
        isSystem: true,
        isDefault: false,
        badgeVariant: 'DANGER',
        metadata: { tone: 'critical' },
        description: 'Administrator role',
        createdAt: new Date('2026-06-08T01:02:03.000Z'),
        updatedAt: new Date('2026-06-08T04:05:06.000Z'),
        type: {
          code: 'user_role',
          name: 'User role',
        },
      }),
    ).toEqual({
      id: 'item-1',
      typeId: 'type-1',
      typeCode: 'user_role',
      typeName: 'User role',
      value: 'ADMIN',
      label: 'Admin',
      sortOrder: 10,
      status: 'ACTIVE',
      isSystem: true,
      isDefault: false,
      badgeVariant: 'DANGER',
      metadata: { tone: 'critical' },
      description: 'Administrator role',
      createdAt: '2026-06-08T01:02:03.000Z',
      updatedAt: '2026-06-08T04:05:06.000Z',
    });
  });

  it('omits optional nullable fields when they are null', () => {
    const response = toDictionaryItemResponse({
      id: 'item-1',
      typeId: 'type-1',
      value: 'ADMIN',
      label: 'Admin',
      sortOrder: 10,
      status: 'ACTIVE',
      isSystem: true,
      isDefault: false,
      badgeVariant: null,
      metadata: null,
      description: null,
      createdAt: new Date('2026-06-08T01:02:03.000Z'),
      updatedAt: new Date('2026-06-08T04:05:06.000Z'),
      type: {
        code: 'user_role',
        name: 'User role',
      },
    });

    expect(response).not.toHaveProperty('badgeVariant');
    expect(response).not.toHaveProperty('metadata');
    expect(response).not.toHaveProperty('description');
  });
});

describe('DictionaryItemService', () => {
  const makeType = (overrides: Record<string, unknown> = {}) => ({
    id: 'type-1',
    code: 'user_role',
    name: 'User role',
    status: 'ACTIVE',
    isSystem: true,
    description: 'Role labels',
    createdAt: new Date('2026-06-08T00:00:00.000Z'),
    updatedAt: new Date('2026-06-08T00:00:00.000Z'),
    ...overrides,
  });

  const makeItem = (overrides: Record<string, unknown> = {}) => ({
    id: 'item-1',
    typeId: 'type-1',
    value: 'admin',
    label: 'Admin',
    sortOrder: 10,
    status: DictionaryStatus.ACTIVE,
    isSystem: true,
    isDefault: false,
    badgeVariant: 'DANGER',
    metadata: { tone: 'critical' },
    description: 'Administrator role',
    createdAt: new Date('2026-06-08T01:02:03.000Z'),
    updatedAt: new Date('2026-06-08T04:05:06.000Z'),
    type: makeType(),
    ...overrides,
  });

  const createPrismaMock = () => ({
    dictionaryType: {
      findUnique: jest.fn(),
    },
    dictionaryItem: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const tx = createPrismaMock();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const auditLogService = {
      record: jest.fn(),
    };
    const ServiceCtor = DictionaryItemService as unknown as new (
      prisma: never,
      auditLogService: never,
    ) => DictionaryItemService;
    const service = new ServiceCtor(prisma as never, auditLogService as never);

    return { auditLogService, prisma, service, tx };
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

  const auditActor: AuditActor = {
    userId: 'actor-1',
    email: 'actor@example.com',
    name: 'Actor',
  };

  const auditRequestMeta: AuditRequestMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('listItems', () => {
    it('applies pagination, default sort, and stable filters', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryItem.findMany.mockResolvedValue([makeItem()]);
      prisma.dictionaryItem.count.mockResolvedValue(1);

      await service.listItems({
        page: 2,
        pageSize: 10,
        typeId: 'type-1',
        typeCode: 'user_role',
        status: DictionaryStatus.ACTIVE,
        isDefault: false,
      });

      expect(prisma.dictionaryItem.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        orderBy: { sortOrder: 'asc' },
        where: {
          typeId: 'type-1',
          type: { code: 'user_role' },
          status: DictionaryStatus.ACTIVE,
          isDefault: false,
        },
        include: { type: true },
      });
    });

    it('maps search to OR over value, label, and description', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryItem.findMany.mockResolvedValue([]);
      prisma.dictionaryItem.count.mockResolvedValue(0);

      await service.listItems({ page: 1, pageSize: 20, search: 'adm' });

      expect(prisma.dictionaryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { value: { contains: 'adm', mode: 'insensitive' } },
              { label: { contains: 'adm', mode: 'insensitive' } },
              { description: { contains: 'adm', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('passes the same where object to findMany and count', async () => {
      const { prisma, service } = createService();
      prisma.dictionaryItem.findMany.mockResolvedValue([]);
      prisma.dictionaryItem.count.mockResolvedValue(0);

      await service.listItems({
        page: 1,
        pageSize: 20,
        typeCode: 'user_role',
        search: 'Admin',
      });

      const findManyWhere = firstMockArg<{
        where: Prisma.DictionaryItemWhereInput;
      }>(prisma.dictionaryItem.findMany).where;
      const countWhere = firstMockArg<{
        where: Prisma.DictionaryItemWhereInput;
      }>(prisma.dictionaryItem.count).where;

      expect(findManyWhere).toBe(countWhere);
      expect(prisma.dictionaryItem.count).toHaveBeenCalledWith({
        where: findManyWhere,
      });
    });

    it('rejects invalid sort fields and directions', async () => {
      const { service } = createService();

      await expect(
        service.listItems({ page: 1, pageSize: 20, sort: 'typeId:asc' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.listItems({
          page: 1,
          pageSize: 20,
          sort: 'sortOrder:sideways',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createItem', () => {
    it('maps missing type to NotFoundException', async () => {
      const { auditLogService, prisma, service } = createService();
      prisma.dictionaryType.findUnique.mockResolvedValue(null);

      await expect(
        service.createItem({
          typeId: 'missing-type',
          value: 'value',
          label: 'Value',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('maps duplicate typeId and value to ConflictException', async () => {
      const { prisma, service, tx } = createService();
      prisma.dictionaryType.findUnique.mockResolvedValue(makeType());
      tx.dictionaryItem.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.createItem({
          typeId: 'type-1',
          value: 'admin',
          label: 'Admin',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not validate user_role values against the removed backend role enum', async () => {
      const { prisma, service, tx } = createService();
      const createdItem = makeItem({ value: 'custom_role' });
      prisma.dictionaryType.findUnique.mockResolvedValue(makeType());
      tx.dictionaryItem.create.mockResolvedValue(createdItem);

      await expect(
        service.createItem({
          typeId: 'type-1',
          value: 'custom_role',
          label: 'Custom role',
          status: DictionaryStatus.DISABLED,
        }),
      ).resolves.toMatchObject({ value: 'custom_role' });
    });

    it('creates a non-default item and writes create audit with after snapshot in one transaction', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const createdItem = makeItem({ isDefault: false });
      prisma.dictionaryType.findUnique.mockResolvedValue(makeType());
      tx.dictionaryItem.create.mockResolvedValue(createdItem);

      await expect(
        service.createItem(
          {
            typeId: 'type-1',
            value: 'admin',
            label: 'Admin',
          },
          auditActor,
          auditRequestMeta,
        ),
      ).resolves.toEqual(toDictionaryItemResponse(createdItem));

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.dictionaryItem.create).toHaveBeenCalledWith({
        data: {
          typeId: 'type-1',
          value: 'admin',
          label: 'Admin',
        },
        include: { type: true },
      });
      expect(prisma.dictionaryItem.create).not.toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.CREATE,
          resourceType: AUDIT_RESOURCE_TYPES.DICTIONARY_ITEM,
          resourceId: 'item-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          after: toDictionaryItemResponse(createdItem),
        },
        tx,
      );
    });

    it('clears previous defaults, creates, and audits in the same transaction when creating a default item', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const createdItem = makeItem({ isDefault: true });
      prisma.dictionaryType.findUnique.mockResolvedValue(makeType());
      tx.dictionaryItem.updateMany.mockResolvedValue({ count: 1 });
      tx.dictionaryItem.create.mockResolvedValue(createdItem);

      await service.createItem(
        {
          typeId: 'type-1',
          value: 'admin',
          label: 'Admin',
          isDefault: true,
        },
        auditActor,
        auditRequestMeta,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.dictionaryItem.updateMany).toHaveBeenCalledWith({
        where: { typeId: 'type-1', isDefault: true },
        data: { isDefault: false },
      });
      const createArg = firstMockArg<{
        data: Record<string, unknown>;
        include: { type: true };
      }>(tx.dictionaryItem.create);
      expect(createArg.data).toMatchObject({
        typeId: 'type-1',
        value: 'admin',
        label: 'Admin',
        isDefault: true,
      });
      expect(createArg).toMatchObject({
        include: { type: true },
      });
      expect(prisma.dictionaryItem.updateMany).not.toHaveBeenCalled();
      expect(prisma.dictionaryItem.create).not.toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.CREATE,
          resourceType: AUDIT_RESOURCE_TYPES.DICTIONARY_ITEM,
          resourceId: 'item-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          after: toDictionaryItemResponse(createdItem),
        },
        tx,
      );
    });
  });

  describe('updateItem', () => {
    it('rejects disabling a system item', async () => {
      const { auditLogService, prisma, service } = createService();
      prisma.dictionaryItem.findUnique.mockResolvedValue(
        makeItem({ isSystem: true }),
      );

      await expect(
        service.updateItem('item-1', { status: DictionaryStatus.DISABLED }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('allows enabling user_role items because roles are managed by RBAC records', async () => {
      const { prisma, service, tx } = createService();
      const updatedItem = makeItem({
        value: 'custom_role',
        status: DictionaryStatus.ACTIVE,
      });
      prisma.dictionaryItem.findUnique.mockResolvedValue(
        makeItem({ value: 'custom_role', status: DictionaryStatus.DISABLED }),
      );
      tx.dictionaryItem.update.mockResolvedValue(updatedItem);

      await expect(
        service.updateItem('item-1', { status: DictionaryStatus.ACTIVE }),
      ).resolves.toMatchObject({ value: 'custom_role', status: 'ACTIVE' });
    });

    it('allows system item editable fields and returns type context', async () => {
      const { prisma, service, tx } = createService();
      const existingItem = makeItem({ isSystem: true });
      const updatedItem = makeItem({
        label: 'Administrator',
        sortOrder: 5,
        badgeVariant: 'SUCCESS',
        isDefault: false,
        metadata: { tone: 'success' },
        description: 'Updated role',
      });
      prisma.dictionaryItem.findUnique.mockResolvedValue(existingItem);
      tx.dictionaryItem.update.mockResolvedValue(updatedItem);

      await expect(
        service.updateItem('item-1', {
          label: 'Administrator',
          sortOrder: 5,
          badgeVariant: 'SUCCESS',
          isDefault: false,
          metadata: { tone: 'success' },
          description: 'Updated role',
        }),
      ).resolves.toMatchObject({
        id: 'item-1',
        typeCode: 'user_role',
        typeName: 'User role',
        label: 'Administrator',
        sortOrder: 5,
        badgeVariant: 'SUCCESS',
        isDefault: false,
        metadata: { tone: 'success' },
        description: 'Updated role',
      });
      expect(tx.dictionaryItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          label: 'Administrator',
          sortOrder: 5,
          badgeVariant: 'SUCCESS',
          isDefault: false,
          metadata: { tone: 'success' },
          description: 'Updated role',
        },
        include: { type: true },
      });
    });

    it('clears previous defaults, updates, and audits in the same transaction when updating to default', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const existingItem = makeItem({ isDefault: false });
      const updatedItem = makeItem({ isDefault: true });
      prisma.dictionaryItem.findUnique.mockResolvedValue(existingItem);
      tx.dictionaryItem.updateMany.mockResolvedValue({ count: 1 });
      tx.dictionaryItem.update.mockResolvedValue(updatedItem);

      await service.updateItem(
        'item-1',
        { isDefault: true },
        auditActor,
        auditRequestMeta,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.dictionaryItem.updateMany).toHaveBeenCalledWith({
        where: { typeId: 'type-1', isDefault: true, id: { not: 'item-1' } },
        data: { isDefault: false },
      });
      expect(tx.dictionaryItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { isDefault: true },
        include: { type: true },
      });
      expect(prisma.dictionaryItem.updateMany).not.toHaveBeenCalled();
      expect(prisma.dictionaryItem.update).not.toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.UPDATE,
          resourceType: AUDIT_RESOURCE_TYPES.DICTIONARY_ITEM,
          resourceId: 'item-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          before: toDictionaryItemResponse(existingItem),
          after: toDictionaryItemResponse(updatedItem),
        },
        tx,
      );
    });

    it('updates a non-default item and writes update audit with before and after snapshots in one transaction', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const before = makeItem({ label: 'Admin' });
      const after = makeItem({ label: 'Administrator' });
      prisma.dictionaryItem.findUnique.mockResolvedValue(before);
      tx.dictionaryItem.update.mockResolvedValue(after);

      await expect(
        service.updateItem(
          'item-1',
          { label: 'Administrator' },
          auditActor,
          auditRequestMeta,
        ),
      ).resolves.toEqual(toDictionaryItemResponse(after));

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.dictionaryItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { label: 'Administrator' },
        include: { type: true },
      });
      expect(prisma.dictionaryItem.update).not.toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.UPDATE,
          resourceType: AUDIT_RESOURCE_TYPES.DICTIONARY_ITEM,
          resourceId: 'item-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          before: toDictionaryItemResponse(before),
          after: toDictionaryItemResponse(after),
        },
        tx,
      );
    });

    it('maps missing item to NotFoundException', async () => {
      const { auditLogService, prisma, service } = createService();
      prisma.dictionaryItem.findUnique.mockResolvedValue(null);

      await expect(
        service.updateItem('missing-item', { label: 'Missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('rejects deleting a system item', async () => {
      const { auditLogService, prisma, service } = createService();
      prisma.dictionaryItem.findUnique.mockResolvedValue(
        makeItem({ isSystem: true }),
      );

      await expect(service.deleteItem('item-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('maps missing item to NotFoundException', async () => {
      const { prisma, service, tx } = createService();
      prisma.dictionaryItem.findUnique.mockResolvedValue(
        makeItem({ isSystem: false }),
      );
      tx.dictionaryItem.delete.mockRejectedValue(notFoundError());

      await expect(service.deleteItem('missing-item')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes an item and writes delete audit with before snapshot in one transaction', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const before = makeItem({ isSystem: false });
      prisma.dictionaryItem.findUnique.mockResolvedValue(before);
      tx.dictionaryItem.delete.mockResolvedValue(before);

      await service.deleteItem('item-1', auditActor, auditRequestMeta);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.dictionaryItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        include: { type: true },
      });
      expect(prisma.dictionaryItem.delete).not.toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.DELETE,
          resourceType: AUDIT_RESOURCE_TYPES.DICTIONARY_ITEM,
          resourceId: 'item-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          before: toDictionaryItemResponse(before),
        },
        tx,
      );
    });
  });
});
