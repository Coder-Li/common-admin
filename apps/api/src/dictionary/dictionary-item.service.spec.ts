import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreateDictionaryItemDto,
  DictionaryItemListQueryDto,
  UpdateDictionaryItemDto,
} from './dto/dictionary-item.request';
import { toDictionaryItemResponse } from './dictionary-item.mapper';

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

    await expect(transformQuery({ typeId: 'not-a-uuid' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(transformQuery({ typeCode: 'User Role' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(transformQuery({ status: 'ARCHIVED' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(transformQuery({ isDefault: 'sometimes' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects disallowed sort fields and accepts allowed sort fields', async () => {
    await expect(transformQuery({ sort: 'typeId:asc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(transformQuery({ sort: 'sortOrder:asc' })).resolves.toMatchObject({
      sort: 'sortOrder:asc',
    });
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
    metatype: typeof CreateDictionaryItemDto | typeof UpdateDictionaryItemDto =
      CreateDictionaryItemDto,
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
    await expect(transformBody({ ...validBody, metadata })).rejects.toBeInstanceOf(
      BadRequestException,
    );
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
    ['class instance', new (class BadgeMetadata {
      tone = 'critical';
    })()],
  ])('rejects %s metadata because it is not a plain object', async (_name, metadata) => {
    await expect(transformBody({ ...validBody, metadata })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

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
      transformBody({ label: 'Admin', isSystem: false }, UpdateDictionaryItemDto),
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
