/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../app.module';
import { PermissionService } from '../permission/permission.service';
import { PrismaService } from '../prisma/prisma.service';

interface LoginResponseBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    roles: Array<{ code: string; name: string }>;
    permissions: string[];
  };
}

interface UserListResponseBody {
  items: Array<{
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    roles: Array<{ code: string; name: string }>;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

function loginBody(response: Response): LoginResponseBody {
  return response.body as LoginResponseBody;
}

function userListBody(response: Response): UserListResponseBody {
  return response.body as UserListResponseBody;
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
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    userRole: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    dictionaryType: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dictionaryItem: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    managedFile: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  const permissionContexts = new Map<
    string,
    {
      roleCodes: string[];
      permissionCodes: string[];
      isSuperAdmin: boolean;
    }
  >();

  const permissionService = {
    resolveUserPermissionContext: jest.fn(async (userId: string) => {
      const context = permissionContexts.get(userId) ?? {
        roleCodes: [],
        permissionCodes: [],
        isSuperAdmin: false,
      };

      return { userId, ...context };
    }),
    invalidateUserPermissionContext: jest.fn(),
    invalidateAllPermissionContexts: jest.fn(),
  };

  function persistedUser(overrides: Record<string, unknown> = {}) {
    const roles = (overrides.roles as Array<{
      role: { code: string; name: string };
    }>) ?? [{ role: { code: 'admin', name: 'Admin' } }];

    return {
      id: 'user-1',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash: '$2a$04$test',
      roles,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
      roles,
    };
  }

  async function signIn(user: ReturnType<typeof persistedUser>) {
    prisma.user.findFirst.mockResolvedValueOnce(user);
    prisma.user.findUnique.mockResolvedValue(user);

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
      .overrideProvider(PermissionService)
      .useValue(permissionService)
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
    permissionContexts.clear();
    [
      prisma.user,
      prisma.role,
      prisma.userRole,
      prisma.userSession,
      prisma.dictionaryType,
      prisma.dictionaryItem,
      prisma.managedFile,
    ].forEach((model) => {
      Object.values(model).forEach((mock) => {
        mock.mockReset();
      });
    });
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(prisma),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with minimal JWT payload and returns RBAC auth context', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
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
      roles: [{ code: 'admin', name: 'Admin' }],
      permissions: ['user.read'],
    });
    expect(body.accessToken).toEqual(expect.any(String));
    expect(loginResponse.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=',
    );
    expect(loginResponse.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(loginResponse.body).not.toHaveProperty('refreshToken');

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          email: 'admin@example.com',
          roles: [{ code: 'admin', name: 'Admin' }],
          permissions: ['user.read'],
        });
      });
  });

  it('rejects current-user requests without a bearer token', async () => {
    await request(httpServer).get('/api/users/me').expect(401);
  });

  it('forbids a user missing the required permission', async () => {
    const user = persistedUser({
      id: 'standard-1',
      email: 'standard@example.com',
      username: 'standard',
      roles: [{ role: { code: 'standard', name: 'Standard' } }],
    });
    user.passwordHash = await bcrypt.hash('Admin123!', 4);
    permissionContexts.set('standard-1', {
      roleCodes: ['standard'],
      permissionCodes: ['dashboard.view'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(user);

    await request(httpServer)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('allows a user with user.read to list users', async () => {
    const adminUser = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
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
              roles: [{ code: 'admin', name: 'Admin' }],
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
      include: { roles: { include: { role: true } } },
    });
  });

  it('allows active super_admin through permission guard', async () => {
    const superAdmin = persistedUser({
      id: 'super-1',
      email: 'super@example.com',
      username: 'super',
      passwordHash: await bcrypt.hash('Admin123!', 4),
      roles: [{ role: { code: 'super_admin', name: 'Super admin' } }],
    });
    permissionContexts.set('super-1', {
      roleCodes: ['super_admin'],
      permissionCodes: [],
      isSuperAdmin: true,
    });
    const accessToken = await signIn(superAdmin);
    prisma.user.findMany.mockResolvedValueOnce([]);
    prisma.user.count.mockResolvedValueOnce(0);

    await request(httpServer)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('protects dictionary and file admin endpoints with permissions', async () => {
    const adminUser = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['dictionary.read', 'file.read'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(adminUser);
    prisma.dictionaryType.findMany.mockResolvedValueOnce([]);
    prisma.dictionaryType.count.mockResolvedValueOnce(0);
    prisma.managedFile.findMany.mockResolvedValueOnce([]);
    prisma.managedFile.count.mockResolvedValueOnce(0);

    await request(httpServer)
      .get('/api/dictionary-types')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(httpServer)
      .get('/api/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
