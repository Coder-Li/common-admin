import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DictionaryOptionsQueryDto } from './dto/dictionary-options.request';
import { toDictionaryOption } from './dictionary-options.mapper';

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
    ['more than 30 codes', { types: Array.from({ length: 31 }, (_, index) => `code_${index}`).join(',') }],
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
