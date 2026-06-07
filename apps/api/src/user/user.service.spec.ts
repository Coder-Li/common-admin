import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { UserListQueryDto } from './dto/user.request';
import { toUserResponse } from './user.mapper';
import { Role } from './role.enum';

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
