import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../user/role.enum';

interface LoginResponseBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: Role;
  };
}

interface UserProfileResponseBody {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
}

interface UserListResponseBody {
  items: UserDetailResponseBody[];
  total: number;
  page: number;
  pageSize: number;
}

interface UserDetailResponseBody extends UserProfileResponseBody {
  createdAt: string;
  updatedAt: string;
}

function loginBody(response: Response): LoginResponseBody {
  return response.body as LoginResponseBody;
}

function userProfileBody(response: Response): UserProfileResponseBody {
  return response.body as UserProfileResponseBody;
}

function userListBody(response: Response): UserListResponseBody {
  return response.body as UserListResponseBody;
}

function userDetailBody(response: Response): UserDetailResponseBody {
  return response.body as UserDetailResponseBody;
}

function firstMockArg<TArg>(mock: { mock: { calls: unknown[][] } }): TArg {
  const firstCall = mock.mock.calls[0];

  if (!firstCall) {
    throw new Error('Expected mock to have been called');
  }

  return firstCall[0] as TArg;
}

describe('Auth flow', () => {
  let app: INestApplication;
  let httpServer: Server;

  const prisma = {
    user: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  function persistedUser(overrides: Partial<UserDetailResponseBody> = {}) {
    return {
      id: 'user-1',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash: '$2a$04$test',
      role: Role.ADMIN,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  async function signIn(user: ReturnType<typeof persistedUser>) {
    prisma.user.findFirst.mockResolvedValueOnce(user);

    const loginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({ usernameOrEmail: user.email, password: 'Admin123!' })
      .expect(201);

    return loginBody(loginResponse).accessToken;
  }

  beforeAll(async () => {
    process.env.JWT_ACCESS_TOKEN_SECRET = 'test-access-secret-change-me';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(prisma.user).forEach((mock) => {
      mock.mockReset();
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in and returns the current user with the issued bearer token', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash: await bcrypt.hash('Admin123!', 4),
      role: Role.ADMIN,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.findUnique.mockResolvedValue(user);

    const loginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({ usernameOrEmail: 'admin@example.com', password: 'Admin123!' })
      .expect(201);
    const body = loginBody(loginResponse);

    expect(body.user).toEqual({
      id: 'user-1',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
    });
    expect(body.accessToken).toEqual(expect.any(String));
    expect(loginResponse.body).not.toHaveProperty('refreshToken');

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(userProfileBody(response).email).toBe('admin@example.com');
      });
  });

  it('rejects login requests with unknown properties', async () => {
    await request(httpServer)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'admin@example.com',
        password: 'Admin123!',
        role: 'ADMIN',
      })
      .expect(400);
  });

  it('rejects current-user requests without a bearer token', async () => {
    await request(httpServer).get('/api/users/me').expect(401);
  });

  it('allows an authenticated standard user to fetch their current profile', async () => {
    const standardUser = persistedUser({
      id: 'standard-1',
      email: 'standard@example.com',
      username: 'standard',
      firstName: 'Standard',
      role: Role.STANDARD,
    });
    standardUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(standardUser);
    prisma.user.findUnique.mockResolvedValueOnce(standardUser);

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(userProfileBody(response)).toEqual({
          id: 'standard-1',
          email: 'standard@example.com',
          username: 'standard',
          firstName: 'Standard',
          lastName: 'User',
          role: Role.STANDARD,
        });
      });
  });

  it('forbids a standard user from listing users', async () => {
    const standardUser = persistedUser({
      id: 'standard-1',
      email: 'standard@example.com',
      username: 'standard',
      role: Role.STANDARD,
    });
    standardUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(standardUser);

    await request(httpServer)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('allows an admin user to list users with pagination metadata', async () => {
    const adminUser = persistedUser();
    adminUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const listedUser = persistedUser({
      id: 'listed-1',
      email: 'listed@example.com',
      username: 'listed',
    });
    const accessToken = await signIn(adminUser);
    prisma.user.findMany.mockResolvedValueOnce([listedUser]);
    prisma.user.count.mockResolvedValueOnce(1);

    await request(httpServer)
      .get('/api/users')
      .query({ page: 2, pageSize: 5, sort: 'email:asc' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(userListBody(response)).toEqual({
          items: [
            {
              id: 'listed-1',
              email: 'listed@example.com',
              username: 'listed',
              firstName: 'Admin',
              lastName: 'User',
              role: Role.ADMIN,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 2,
          pageSize: 5,
        });
      });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      skip: 5,
      take: 5,
      orderBy: { email: 'asc' },
      where: {},
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: {} });
  });

  it('routes admin create, detail, and update requests through user persistence', async () => {
    const adminUser = persistedUser();
    adminUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(adminUser);
    const createdUser = persistedUser({
      id: 'created-1',
      email: 'created@example.com',
      username: 'created',
      role: Role.STANDARD,
    });
    const detailUser = persistedUser({ id: 'detail-1' });
    const updatedUser = persistedUser({
      id: 'detail-1',
      firstName: 'Renamed',
    });
    prisma.user.create.mockResolvedValueOnce(createdUser);
    prisma.user.findUnique.mockResolvedValueOnce(detailUser);
    prisma.user.update.mockResolvedValueOnce(updatedUser);

    await request(httpServer)
      .post('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: 'created@example.com',
        username: 'created',
        firstName: 'Created',
        lastName: 'User',
        password: 'Created123!',
        role: Role.STANDARD,
      })
      .expect(201)
      .expect((response: Response) => {
        expect(userDetailBody(response).id).toBe('created-1');
      });

    await request(httpServer)
      .get('/api/users/detail-1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(userDetailBody(response).id).toBe('detail-1');
      });

    await request(httpServer)
      .patch('/api/users/detail-1')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Renamed' })
      .expect(200)
      .expect((response: Response) => {
        expect(userDetailBody(response).firstName).toBe('Renamed');
      });

    const createArgs = firstMockArg<{
      data: {
        email: string;
        firstName: string;
        lastName: string;
        passwordHash: string;
        role: Role;
        username: string;
      };
    }>(prisma.user.create);

    expect(createArgs.data).toMatchObject({
      email: 'created@example.com',
      username: 'created',
      firstName: 'Created',
      lastName: 'User',
      role: Role.STANDARD,
    });
    expect(createArgs.data.passwordHash).toEqual(expect.any(String));
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'detail-1' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'detail-1' },
      data: { firstName: 'Renamed' },
    });
  });

  it('keeps GET /users/me ahead of GET /users/:id routing', async () => {
    const adminUser = persistedUser();
    adminUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(adminUser);
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(userProfileBody(response).id).toBe('user-1');
      });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalledWith({
      where: { id: 'me' },
    });
  });

  it('returns 204 when an admin deletes a user', async () => {
    const adminUser = persistedUser();
    adminUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(adminUser);
    prisma.user.delete.mockResolvedValueOnce(persistedUser({ id: 'delete-1' }));

    await request(httpServer)
      .delete('/api/users/delete-1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204)
      .expect((response: Response) => {
        expect(response.text).toBe('');
      });

    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'delete-1' },
    });
  });
});
