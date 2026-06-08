import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DictionaryStatus } from '@prisma/client';
import { DictionaryOptionsQueryDto } from './dto/dictionary-options.request';
import { toDictionaryOption } from './dictionary-options.mapper';
import { DictionaryOptionsService } from './dictionary-options.service';

describe('DictionaryOptionsQueryDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformQuery = (query: Record<string, unknown>) =>
    pipe.transform(query, {
      type: 'query',
      metatype: DictionaryOptionsQueryDto,
    });

  it.each([
    ['missing types', {}],
    ['empty entry', { types: 'user_role,,common_status' }],
    ['invalid code', { types: 'User Role' }],
    [
      'more than 30 codes',
      {
        types: Array.from({ length: 31 }, (_, index) => `code_${index}`).join(
          ',',
        ),
      },
    ],
  ])('rejects %s', async (_name, query) => {
    await expect(transformQuery(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts comma-separated dictionary codes', async () => {
    await expect(
      transformQuery({ types: 'user_role,common_status' }),
    ).resolves.toMatchObject({
      types: ['user_role', 'common_status'],
    });
  });
});

describe('dictionary option mapper', () => {
  it('emits compact option fields only', () => {
    expect(
      toDictionaryOption({
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
      }),
    ).toEqual({
      value: 'ADMIN',
      label: 'Admin',
      isDefault: false,
      badgeVariant: 'DANGER',
      metadata: { tone: 'critical' },
    });
  });

  it('omits optional nullable fields when they are null', () => {
    const option = toDictionaryOption({
      id: 'item-1',
      typeId: 'type-1',
      value: 'STANDARD',
      label: 'Standard',
      sortOrder: 20,
      status: 'ACTIVE',
      isSystem: true,
      isDefault: true,
      badgeVariant: null,
      metadata: null,
      description: null,
      createdAt: new Date('2026-06-08T01:02:03.000Z'),
      updatedAt: new Date('2026-06-08T04:05:06.000Z'),
    });

    expect(option).toEqual({
      value: 'STANDARD',
      label: 'Standard',
      isDefault: true,
    });
  });
});

describe('DictionaryOptionsService', () => {
  const makeItem = (overrides: Record<string, unknown> = {}) => ({
    id: 'item-1',
    typeId: 'type-1',
    value: 'ADMIN',
    label: 'Admin',
    sortOrder: 10,
    status: DictionaryStatus.ACTIVE,
    isSystem: true,
    isDefault: false,
    badgeVariant: 'DANGER',
    metadata: null,
    description: null,
    createdAt: new Date('2026-06-08T01:02:03.000Z'),
    updatedAt: new Date('2026-06-08T04:05:06.000Z'),
    ...overrides,
  });

  const makeType = (overrides: Record<string, unknown> = {}) => ({
    id: 'type-1',
    code: 'user_role',
    name: 'User role',
    status: DictionaryStatus.ACTIVE,
    isSystem: true,
    description: null,
    createdAt: new Date('2026-06-08T00:00:00.000Z'),
    updatedAt: new Date('2026-06-08T00:00:00.000Z'),
    items: [makeItem()],
    ...overrides,
  });

  const createPrismaMock = () => ({
    dictionaryType: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const service = new DictionaryOptionsService(prisma as never);

    return { prisma, service };
  };

  function firstMockArg<TArg>(mock: { mock: { calls: unknown[][] } }): TArg {
    const firstCall = mock.mock.calls[0];

    if (!firstCall) {
      throw new Error('Expected mock to have been called');
    }

    return firstCall[0] as TArg;
  }

  it('returns an empty item list for unknown, disabled, or empty types', async () => {
    const { prisma, service } = createService();
    prisma.dictionaryType.findFirst.mockResolvedValueOnce(null);
    await expect(service.getOptions('unknown_type')).resolves.toEqual({
      typeCode: 'unknown_type',
      items: [],
    });

    prisma.dictionaryType.findFirst.mockResolvedValueOnce(null);
    await expect(service.getOptions('disabled_type')).resolves.toEqual({
      typeCode: 'disabled_type',
      items: [],
    });

    prisma.dictionaryType.findFirst.mockResolvedValueOnce(
      makeType({ code: 'empty_type', items: [] }),
    );
    await expect(service.getOptions('empty_type')).resolves.toEqual({
      typeCode: 'empty_type',
      items: [],
    });
  });

  it('returns only active items for an active type', async () => {
    const { prisma, service } = createService();
    prisma.dictionaryType.findFirst.mockResolvedValueOnce(
      makeType({
        items: [makeItem({ value: 'ADMIN', label: 'Admin' })],
      }),
    );

    await expect(service.getOptions('user_role')).resolves.toEqual({
      typeCode: 'user_role',
      items: [
        {
          value: 'ADMIN',
          label: 'Admin',
          isDefault: false,
          badgeVariant: 'DANGER',
        },
      ],
    });

    expect(prisma.dictionaryType.findFirst).toHaveBeenCalledWith({
      where: { code: 'user_role', status: DictionaryStatus.ACTIVE },
      include: {
        items: {
          where: { status: DictionaryStatus.ACTIVE },
          orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
        },
      },
    });
  });

  it('de-duplicates multi-type codes while preserving first-seen order', async () => {
    const { prisma, service } = createService();
    prisma.dictionaryType.findMany.mockResolvedValueOnce([
      makeType({ code: 'user_role', items: [makeItem()] }),
      makeType({ code: 'common_status', items: [] }),
    ]);

    await service.getOptionsMap(['user_role', 'common_status', 'user_role']);

    expect(prisma.dictionaryType.findMany).toHaveBeenCalledWith({
      where: {
        code: { in: ['user_role', 'common_status'] },
        status: DictionaryStatus.ACTIVE,
      },
      include: {
        items: {
          where: { status: DictionaryStatus.ACTIVE },
          orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
        },
      },
    });
  });

  it('includes every requested code in multi-type responses', async () => {
    const { prisma, service } = createService();
    prisma.dictionaryType.findMany.mockResolvedValueOnce([
      makeType({ code: 'user_role', items: [makeItem()] }),
    ]);

    await expect(
      service.getOptionsMap(['user_role', 'missing_type', 'empty_type']),
    ).resolves.toEqual({
      dictionaries: {
        user_role: [
          {
            value: 'ADMIN',
            label: 'Admin',
            isDefault: false,
            badgeVariant: 'DANGER',
          },
        ],
        missing_type: [],
        empty_type: [],
      },
    });
  });

  it('requests option items sorted by sortOrder then value', async () => {
    const { prisma, service } = createService();
    prisma.dictionaryType.findFirst.mockResolvedValueOnce(makeType());

    await service.getOptions('user_role');

    const query = firstMockArg<{
      include: {
        items: {
          orderBy: Array<Record<string, string>>;
        };
      };
    }>(prisma.dictionaryType.findFirst);
    expect(query.include.items.orderBy).toEqual([
      { sortOrder: 'asc' },
      { value: 'asc' },
    ]);
  });
});
