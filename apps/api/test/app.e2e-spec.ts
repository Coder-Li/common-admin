import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PermissionService } from './../src/permission/permission.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { REDIS_CLIENT } from './../src/redis/redis.constants';
import type { EffectiveDataScope } from './../src/permission/permission.types';

type PersistedUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  roles: Array<{ role: { code: string; name: string } }>;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRecord = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
  revokedReason?: string | null;
  user?: PersistedUser;
};

type PermissionContext = {
  roleCodes: string[];
  permissionCodes: string[];
  isSuperAdmin: boolean;
  dataScope: EffectiveDataScope;
};

type LoginResponseBody = {
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
};

function loginBody(response: Response): LoginResponseBody {
  return response.body as LoginResponseBody;
}

type UserListResponseBody = {
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
};

function userListBody(response: Response): UserListResponseBody {
  return response.body as UserListResponseBody;
}

type ErrorResponseBody = {
  code: string;
  message: string;
  statusCode: number;
  requestId: string;
  path: string;
  timestamp: string;
  details?: {
    fields?: unknown[];
  };
};

function errorBody(response: Response): ErrorResponseBody {
  return response.body as ErrorResponseBody;
}

function createRedisMock() {
  const values = new Map<string, string>();

  return {
    get: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn((key: string) => {
      values.delete(key);
      return Promise.resolve(1);
    }),
    incr: jest.fn((key: string) => {
      const next = Number(values.get(key) ?? '0') + 1;
      values.set(key, String(next));
      return Promise.resolve(next);
    }),
    quit: jest.fn(),
  };
}

function createPrismaMock() {
  return {
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
    systemSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}

function persistedUser(overrides: Partial<PersistedUser> = {}): PersistedUser {
  const roles = overrides.roles ?? [{ role: { code: 'admin', name: 'Admin' } }];

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

function resetModelMocks(model: Record<string, jest.Mock>) {
  Object.values(model).forEach((mock) => mock.mockReset());
}

function resetPrismaMocks(
  prisma: ReturnType<typeof createPrismaMock>,
  sessions: Map<string, SessionRecord>,
) {
  [
    prisma.user,
    prisma.role,
    prisma.userRole,
    prisma.userSession,
    prisma.dictionaryType,
    prisma.dictionaryItem,
    prisma.managedFile,
    prisma.systemSetting,
    prisma.auditLog,
    prisma.permission,
  ].forEach(resetModelMocks);

  prisma.$transaction.mockReset();
  prisma.$transaction.mockImplementation(
    (callback: (client: typeof prisma) => unknown) =>
      Promise.resolve(callback(prisma)),
  );
  prisma.systemSetting.findMany.mockResolvedValue([]);
  prisma.userSession.create.mockImplementation(
    ({ data }: { data: SessionRecord }) => {
      sessions.set(data.id, { ...data, revokedAt: null });
      return Promise.resolve(sessions.get(data.id));
    },
  );
  prisma.userSession.findUnique.mockImplementation(
    async ({
      where,
      include,
      select,
    }: {
      where: { id: string };
      include?: unknown;
      select?: unknown;
    }) => {
      const session = sessions.get(where.id);

      if (!session) {
        return null;
      }

      const user = (session.user ??
        (await prisma.user.findUnique({
          where: { id: session.userId },
        }))) as PersistedUser | null;

      if (select) {
        return {
          id: session.id,
          userId: session.userId,
          expiresAt: session.expiresAt,
          revokedAt: session.revokedAt,
          user: user
            ? {
                id: user.id,
                email: user.email,
                username: user.username,
              }
            : null,
        };
      }

      return {
        ...session,
        user: include ? user : session.user,
      };
    },
  );
  prisma.userSession.updateMany.mockImplementation(
    ({
      where,
      data,
    }: {
      where: {
        id?: string;
        userId?: string;
        refreshTokenHash?: string;
        revokedAt?: null;
        expiresAt?: { gt: Date };
      };
      data: Partial<SessionRecord>;
    }) => {
      const matchingSessions = [...sessions.values()].filter((session) => {
        return (
          (!where.id || session.id === where.id) &&
          (!where.userId || session.userId === where.userId) &&
          (!where.refreshTokenHash ||
            session.refreshTokenHash === where.refreshTokenHash) &&
          (where.revokedAt !== null || !session.revokedAt) &&
          (!where.expiresAt?.gt || session.expiresAt > where.expiresAt.gt)
        );
      });

      matchingSessions.forEach((session) => {
        sessions.set(session.id, { ...session, ...data });
      });

      return Promise.resolve({ count: matchingSessions.length });
    },
  );
}

describe('Common Admin API (e2e)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  const prisma = createPrismaMock();
  const redis = createRedisMock();
  const sessions = new Map<string, SessionRecord>();
  const permissionContexts = new Map<string, PermissionContext>();
  const allowedOrigin = 'http://localhost:15173';

  const envKeys = [
    'ALLOWED_ORIGINS',
    'JWT_ACCESS_TOKEN_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
  ] as const;

  const originalEnv = new Map<string, string | undefined>();

  const permissionService = {
    resolveUserPermissionContext: jest.fn((userId: string) => {
      const context = permissionContexts.get(userId) ?? {
        roleCodes: [],
        permissionCodes: [],
        isSuperAdmin: false,
        dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
      };

      return Promise.resolve({ userId, ...context });
    }),
    invalidateUserPermissionContext: jest.fn(),
    invalidateAllPermissionContexts: jest.fn(),
  };

  async function signIn(
    user: PersistedUser,
    permissions: string[] = ['user.read'],
  ) {
    permissionContexts.set(user.id, {
      roleCodes: user.roles.map(({ role }) => role.code),
      permissionCodes: permissions,
      isSuperAdmin: false,
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: [user.id],
        departmentIds: [],
      },
    });
    prisma.user.findFirst.mockResolvedValueOnce(user);
    prisma.user.findUnique.mockResolvedValue(user);

    return request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', allowedOrigin)
      .send({ usernameOrEmail: user.email, password: 'Admin123!' })
      .expect(201);
  }

  beforeAll(async () => {
    envKeys.forEach((key) => originalEnv.set(key, process.env[key]));
    process.env.ALLOWED_ORIGINS = allowedOrigin;
    process.env.JWT_ACCESS_TOKEN_SECRET = 'test-access-secret-change-me';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(REDIS_CLIENT)
      .useValue(redis)
      .overrideProvider(PermissionService)
      .useValue(permissionService)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessions.clear();
    permissionContexts.clear();
    resetPrismaMocks(prisma, sessions);
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();

    envKeys.forEach((key) => {
      const value = originalEnv.get(key);

      if (value === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = value;
    });
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('logs in and returns access token, refresh cookie, and RBAC context', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });

    const response = await signIn(user, ['user.read']);
    const body = loginBody(response);

    expect(typeof body.accessToken).toBe('string');
    expect(body.user).toEqual({
      id: 'user-1',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      roles: [{ code: 'admin', name: 'Admin' }],
      permissions: ['user.read'],
    });
    expect(response.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=',
    );
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.body).not.toHaveProperty('refreshToken');
  });

  it('refreshes a session through the refresh cookie', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    const loginResponse = await signIn(user, ['user.read']);

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Origin', allowedOrigin)
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(201);

    expect(loginBody(refreshResponse).accessToken).toEqual(expect.any(String));
    expect(refreshResponse.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=',
    );
    expect(refreshResponse.body).not.toHaveProperty('refreshToken');
  });

  it('logs out and clears the refresh cookie', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    const loginResponse = await signIn(user, ['user.read']);
    const accessToken = loginBody(loginResponse).accessToken;

    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', allowedOrigin)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(201);

    expect(response.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=;',
    );
    const revokedSession = [...sessions.values()][0];

    expect(revokedSession?.revokedAt).toBeInstanceOf(Date);
    expect(revokedSession?.revokedReason).toBe('logout');
  });

  it('rejects unauthenticated access to protected resources', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('returns 403 when authenticated user lacks required permission', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    const loginResponse = await signIn(user, []);

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${loginBody(loginResponse).accessToken}`)
      .expect(403);
  });

  it('allows an authenticated user with permission to read a protected resource', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    const loginResponse = await signIn(user, ['user.read']);
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([user]);

    const response = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${loginBody(loginResponse).accessToken}`)
      .expect(200);

    expect(userListBody(response)).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [
        {
          id: 'user-1',
          email: 'admin@example.com',
          username: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          roles: [{ code: 'admin', name: 'Admin' }],
        },
      ],
    });
  });

  it('returns normalized validation error envelope with request id', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', allowedOrigin)
      .set('x-request-id', 'req_test_quality_gate')
      .send({ usernameOrEmail: '', password: '' })
      .expect(400);

    const body = errorBody(response);

    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      statusCode: 400,
      requestId: 'req_test_quality_gate',
      path: '/api/auth/login',
    });
    expect(typeof body.timestamp).toBe('string');
    expect(Array.isArray(body.details?.fields)).toBe(true);
  });
});
