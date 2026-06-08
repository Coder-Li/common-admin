import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreateDictionaryTypeDto,
  DictionaryTypeListQueryDto,
  UpdateDictionaryTypeDto,
} from './dto/dictionary-type.request';
import { toDictionaryTypeResponse } from './dictionary-type.mapper';

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
