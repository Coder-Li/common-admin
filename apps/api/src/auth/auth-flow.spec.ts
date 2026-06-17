/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { decode } from 'jsonwebtoken';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../app.module';
import { PermissionService } from '../permission/permission.service';
import type { EffectiveDataScope } from '../permission/permission.types';
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
  user?: ReturnType<typeof persistedUser>;
};

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

function decodeAccessToken(accessToken: string): { sid: string; sub: string } {
  const payload = decode(accessToken);

  if (!payload || typeof payload === 'string') {
    throw new Error('Expected JWT object payload');
  }

  return payload as { sid: string; sub: string };
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
    auditLog: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
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
      dataScope?: EffectiveDataScope;
    }
  >();
  const sessions = new Map<string, SessionRecord>();

  const permissionService = {
    resolveUserPermissionContext: jest.fn(async (userId: string) => {
      const context = permissionContexts.get(userId) ?? {
        roleCodes: [],
        permissionCodes: [],
        isSuperAdmin: false,
        dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
      };

      return {
        userId,
        dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
        ...context,
      };
    }),
    invalidateUserPermissionContext: jest.fn(),
    invalidateAllPermissionContexts: jest.fn(),
  };
  const allowedOrigin = 'http://localhost:15173';

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

  function departmentAssignment(departmentId: string) {
    return {
      isPrimary: false,
      departmentId,
      department: {
        id: departmentId,
        code: departmentId,
        name: departmentId,
        status: 'ACTIVE',
        sortOrder: 1,
      },
    };
  }

  function userMatchesWhere(
    user: ReturnType<typeof persistedUser>,
    where?: Record<string, unknown>,
  ): boolean {
    if (!where || Object.keys(where).length === 0) {
      return true;
    }

    if (Array.isArray(where.AND)) {
      return where.AND.every((clause) =>
        userMatchesWhere(user, clause as Record<string, unknown>),
      );
    }

    if (Array.isArray(where.OR)) {
      return where.OR.some((clause) =>
        userMatchesWhere(user, clause as Record<string, unknown>),
      );
    }

    const id = where.id as { in?: string[] } | string | undefined;
    if (typeof id === 'string' && user.id !== id) {
      return false;
    }
    if (typeof id === 'object' && id.in && !id.in.includes(user.id)) {
      return false;
    }

    const departments = where.departments as
      | { some?: { departmentId?: { in?: string[] } | string } }
      | undefined;
    const departmentIdFilter = departments?.some?.departmentId;
    if (typeof departmentIdFilter === 'string') {
      return (
        (
          user.departments as
            | Array<{ departmentId?: string; department?: { id: string } }>
            | undefined
        )?.some(
          (department) =>
            department.departmentId === departmentIdFilter ||
            department.department?.id === departmentIdFilter,
        ) ?? false
      );
    }
    if (departmentIdFilter?.in) {
      return (
        (
          user.departments as
            | Array<{ departmentId?: string; department?: { id: string } }>
            | undefined
        )?.some(
          (department) =>
            departmentIdFilter.in?.includes(department.departmentId ?? '') ||
            departmentIdFilter.in?.includes(department.department?.id ?? ''),
        ) ?? false
      );
    }

    return true;
  }

  function mockUsers(users: Array<ReturnType<typeof persistedUser>>) {
    prisma.user.findMany.mockImplementation(
      async ({ where }: { where?: Record<string, unknown> }) =>
        users.filter((user) => userMatchesWhere(user, where)),
    );
    prisma.user.count.mockImplementation(
      async ({ where }: { where?: Record<string, unknown> }) =>
        users.filter((user) => userMatchesWhere(user, where)).length,
    );
    prisma.user.findFirst.mockImplementation(
      async ({ where }: { where?: Record<string, unknown> }) =>
        users.find((user) => userMatchesWhere(user, where)) ?? null,
    );
    prisma.user.findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; email?: string } }) =>
        users.find(
          (user) =>
            (where.id && user.id === where.id) ||
            (where.email && user.email === where.email),
        ) ?? null,
    );
  }

  async function signIn(user: ReturnType<typeof persistedUser>) {
    prisma.user.findFirst.mockResolvedValueOnce(user);
    prisma.user.findUnique.mockResolvedValue(user);

    const loginResponse = await request(httpServer)
      .post('/api/auth/login')
      .set('Origin', allowedOrigin)
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
    app.use(cookieParser());
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
    sessions.clear();
    [
      prisma.user,
      prisma.role,
      prisma.userRole,
      prisma.userSession,
      prisma.dictionaryType,
      prisma.dictionaryItem,
      prisma.managedFile,
      prisma.auditLog,
    ].forEach((model) => {
      Object.values(model).forEach((mock) => {
        mock.mockReset();
      });
    });
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(prisma),
    );
    prisma.userSession.create.mockImplementation(
      async ({ data }: { data: SessionRecord }) => {
        sessions.set(data.id, {
          ...data,
          createdAt: new Date(),
          revokedAt: null,
        });
        return sessions.get(data.id);
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

        const user =
          session.user ??
          (await prisma.user.findUnique({ where: { id: session.userId } }));

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
      async ({
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

        if (matchingSessions.length === 0) {
          return { count: 0 };
        }

        matchingSessions.forEach((session) => {
          sessions.set(session.id, { ...session, ...data });
        });
        return { count: matchingSessions.length };
      },
    );
    prisma.user.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ReturnType<typeof persistedUser>>;
      }) => persistedUser({ id: where.id, ...data }),
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
      .set('Origin', allowedOrigin)
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

  it('login sets refresh cookie and omits refresh token JSON', async () => {
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
      .set('Origin', allowedOrigin)
      .send({ usernameOrEmail: 'admin@example.com', password: 'Admin123!' })
      .expect(201);

    expect(loginResponse.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=',
    );
    expect(loginResponse.body).not.toHaveProperty('refreshToken');
  });

  it('refresh with cookie returns new access token and rotated cookie', async () => {
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
      .set('Origin', allowedOrigin)
      .send({ usernameOrEmail: 'admin@example.com', password: 'Admin123!' })
      .expect(201);

    const refreshResponse = await request(httpServer)
      .post('/api/auth/refresh')
      .set('Origin', allowedOrigin)
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(201);

    expect(loginBody(refreshResponse).accessToken).toEqual(expect.any(String));
    expect(refreshResponse.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=',
    );
    expect(refreshResponse.headers['set-cookie'][0]).not.toBe(
      loginResponse.headers['set-cookie'][0],
    );
    expect(refreshResponse.body).not.toHaveProperty('refreshToken');
  });

  it('old refresh cookie fails after rotation', async () => {
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
      .set('Origin', allowedOrigin)
      .send({ usernameOrEmail: 'admin@example.com', password: 'Admin123!' })
      .expect(201);

    await request(httpServer)
      .post('/api/auth/refresh')
      .set('Origin', allowedOrigin)
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(201);

    await request(httpServer)
      .post('/api/auth/refresh')
      .set('Origin', allowedOrigin)
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(401)
      .expect((response: Response) => {
        expect(response.headers['set-cookie'][0]).toContain(
          'common_admin_refresh=;',
        );
      });
  });

  it('logout clears cookie and revokes session', async () => {
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
      .set('Origin', allowedOrigin)
      .send({ usernameOrEmail: 'admin@example.com', password: 'Admin123!' })
      .expect(201);

    const logoutResponse = await request(httpServer)
      .post('/api/auth/logout')
      .set('Origin', allowedOrigin)
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(201);
    const revokedSession = [...sessions.values()][0];

    expect(logoutResponse.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=;',
    );
    expect(revokedSession.revokedAt).toBeInstanceOf(Date);
    expect(revokedSession.revokedReason).toBe('logout');
  });

  it('changePassword clears refresh cookie in controller', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(user);

    const response = await request(httpServer)
      .post('/api/auth/change-password')
      .set('Origin', allowedOrigin)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'Admin123!',
        newPassword: 'NewAdmin123!',
      })
      .expect(204);

    expect(response.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=;',
    );
  });

  it('changePassword revokes active sessions and blocks the old access token', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const firstAccessToken = await signIn(user);
    const secondAccessToken = await signIn(user);

    await request(httpServer)
      .post('/api/auth/change-password')
      .set('Origin', allowedOrigin)
      .set('Authorization', `Bearer ${firstAccessToken}`)
      .send({
        currentPassword: 'Admin123!',
        newPassword: 'NewAdmin123!',
      })
      .expect(204);

    const sessionRecords = [...sessions.values()];
    expect(sessionRecords).toHaveLength(2);
    expect(sessionRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          revokedAt: expect.any(Date),
          revokedReason: 'password_changed',
        }),
        expect.objectContaining({
          revokedAt: expect.any(Date),
          revokedReason: 'password_changed',
        }),
      ]),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: expect.any(String) },
    });

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${secondAccessToken}`)
      .expect(401);
  });

  it("admin reset password revokes target user's existing access token", async () => {
    const adminUser = persistedUser({
      id: 'admin-1',
      email: 'admin@example.com',
      username: 'admin',
      passwordHash: await bcrypt.hash('Admin123!', 4),
      roles: [{ role: { code: 'admin', name: 'Admin' } }],
    });
    const targetUser = persistedUser({
      id: 'target-1',
      email: 'target@example.com',
      username: 'target',
      passwordHash: await bcrypt.hash('Admin123!', 4),
      roles: [{ role: { code: 'standard', name: 'Standard' } }],
    });
    permissionContexts.set('admin-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.update'],
      isSuperAdmin: false,
      dataScope: { mode: 'ALL', selfUserIds: [], departmentIds: [] },
    });
    permissionContexts.set('target-1', {
      roleCodes: ['standard'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const targetAccessToken = await signIn(targetUser);
    const adminAccessToken = await signIn(adminUser);
    mockUsers([adminUser, targetUser]);
    prisma.user.update.mockImplementationOnce(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ReturnType<typeof persistedUser>>;
      }) => persistedUser({ ...targetUser, id: where.id, ...data }),
    );

    await request(httpServer)
      .post('/api/users/target-1/reset-password')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ newPassword: 'ResetTarget123!' })
      .expect(201)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          id: 'target-1',
          email: 'target@example.com',
          username: 'target',
        });
        expect(response.body).not.toHaveProperty('passwordHash');
      });

    const targetSessions = [...sessions.values()].filter(
      (session) => session.userId === 'target-1',
    );
    const adminSessions = [...sessions.values()].filter(
      (session) => session.userId === 'admin-1',
    );
    expect(targetSessions).toEqual([
      expect.objectContaining({
        revokedAt: expect.any(Date),
        revokedReason: 'admin_reset_password',
      }),
    ]);
    expect(adminSessions).toEqual([
      expect.objectContaining({
        revokedAt: null,
      }),
    ]);

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${targetAccessToken}`)
      .expect(401);
  });

  it('protected request fails after logout', async () => {
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
      .set('Origin', allowedOrigin)
      .send({ usernameOrEmail: 'admin@example.com', password: 'Admin123!' })
      .expect(201);
    const accessToken = loginBody(loginResponse).accessToken;

    await request(httpServer)
      .post('/api/auth/logout')
      .set('Origin', allowedOrigin)
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(201);

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('protected request fails when session is revoked', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(user);
    const { sid } = decodeAccessToken(accessToken);
    const session = sessions.get(sid);

    sessions.set(sid, {
      ...session!,
      revokedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('admin revoke session endpoint blocks the old access token', async () => {
    const adminUser = persistedUser({
      id: 'admin-1',
      email: 'admin@example.com',
      username: 'admin',
      passwordHash: await bcrypt.hash('Admin123!', 4),
      roles: [{ role: { code: 'admin', name: 'Admin' } }],
    });
    const targetUser = persistedUser({
      id: 'target-1',
      email: 'target@example.com',
      username: 'target',
      passwordHash: await bcrypt.hash('Admin123!', 4),
      roles: [{ role: { code: 'standard', name: 'Standard' } }],
    });
    permissionContexts.set('admin-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user_session.revoke'],
      isSuperAdmin: false,
    });
    permissionContexts.set('target-1', {
      roleCodes: ['standard'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const targetAccessToken = await signIn(targetUser);
    const adminAccessToken = await signIn(adminUser);
    const { sid: targetSessionId } = decodeAccessToken(targetAccessToken);

    await request(httpServer)
      .post(`/api/user-sessions/${targetSessionId}/revoke`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(204);

    expect(sessions.get(targetSessionId)).toEqual(
      expect.objectContaining({
        revokedAt: expect.any(Date),
        revokedReason: 'admin_revoked',
      }),
    );

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${targetAccessToken}`)
      .expect(401);
  });

  it('protected request fails when session is expired', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(user);
    const { sid } = decodeAccessToken(accessToken);
    const session = sessions.get(sid);

    sessions.set(sid, {
      ...session!,
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('protected request fails when token sub and sid belong to different users', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(user);
    const { sid } = decodeAccessToken(accessToken);
    const session = sessions.get(sid);

    sessions.set(sid, {
      ...session!,
      userId: 'other-user',
      user: persistedUser({
        id: 'other-user',
        email: 'other@example.com',
        username: 'other',
      }),
    });

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('audit log list rejects unauthenticated requests', async () => {
    await request(httpServer).get('/api/audit-logs').expect(401);
  });

  it('audit log list rejects authenticated users without audit log read permission', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(user);

    await request(httpServer)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('audit log list allows users with audit log read permission', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['audit_log.read'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(user);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-log-1',
        actorUserId: 'user-1',
        actorEmail: 'admin@example.com',
        actorName: 'Admin User',
        action: 'user.create',
        resourceType: 'user',
        resourceId: 'target-user-1',
        before: null,
        after: null,
        metadata: null,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    await request(httpServer)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          items: [
            {
              id: 'audit-log-1',
              actorUserId: 'user-1',
              actorEmail: 'admin@example.com',
              actorName: 'Admin User',
              action: 'user.create',
              resourceType: 'user',
              resourceId: 'target-user-1',
              ipAddress: '127.0.0.1',
              createdAt: '2026-01-02T00:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      });
  });

  it('users/me returns fresh email/username from database after token was signed', async () => {
    const signedUser = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    const freshUser = persistedUser({
      email: 'fresh@example.com',
      username: 'fresh-admin',
      passwordHash: signedUser.passwordHash,
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(signedUser);
    const { sid } = decodeAccessToken(accessToken);
    const session = sessions.get(sid);

    sessions.set(sid, { ...session!, user: freshUser });
    prisma.user.findUnique.mockResolvedValue(freshUser);

    await request(httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          email: 'fresh@example.com',
          username: 'fresh-admin',
        });
      });
    expect(prisma.userSession.findUnique).toHaveBeenLastCalledWith({
      where: { id: sid },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });
  });

  it('logout succeeds and clears cookie when refresh cookie is missing', async () => {
    const logoutResponse = await request(httpServer)
      .post('/api/auth/logout')
      .expect(201);

    expect(logoutResponse.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=;',
    );
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('logout revokes the bearer session when refresh cookie is missing', async () => {
    const user = persistedUser({
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    permissionContexts.set('user-1', {
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
    const accessToken = await signIn(user);
    const { sid } = decodeAccessToken(accessToken);

    const logoutResponse = await request(httpServer)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const session = sessions.get(sid);

    expect(logoutResponse.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=;',
    );
    expect(session?.revokedAt).toBeInstanceOf(Date);
    expect(session?.revokedReason).toBe('logout');
  });

  it('logout with forged refresh cookie succeeds without revoking the session', async () => {
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
      .set('Origin', allowedOrigin)
      .send({ usernameOrEmail: 'admin@example.com', password: 'Admin123!' })
      .expect(201);
    const sessionId = [...sessions.keys()][0];
    const forgedCookie = loginResponse.headers['set-cookie'][0].replace(
      /common_admin_refresh=[^;]+/,
      `common_admin_refresh=${sessionId}.forged-secret`,
    );

    const logoutResponse = await request(httpServer)
      .post('/api/auth/logout')
      .set('Origin', allowedOrigin)
      .set('Cookie', forgedCookie)
      .expect(201);
    const session = sessions.get(sessionId);

    expect(logoutResponse.headers['set-cookie'][0]).toContain(
      'common_admin_refresh=;',
    );
    expect(session?.revokedAt).toBeNull();
    expect(session?.revokedReason).toBeUndefined();
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
              departments: [],
              primaryDepartment: null,
              positions: [],
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
      where: { AND: [{}, { id: { in: [] } }] },
      include: {
        roles: { include: { role: true } },
        departments: { include: { department: true } },
        positions: { include: { position: true } },
      },
    });
  });

  it('self-scoped user list returns only the actor row', async () => {
    const selfUser = persistedUser({
      id: 'self-1',
      email: 'self@example.com',
      username: 'self',
      passwordHash: await bcrypt.hash('Admin123!', 4),
    });
    const marketingTarget = persistedUser({
      id: 'marketing-1',
      email: 'marketing@example.com',
      username: 'marketing',
      departments: [departmentAssignment('marketing')],
    });
    permissionContexts.set('self-1', {
      roleCodes: ['standard'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: ['self-1'],
        departmentIds: [],
      },
    });
    mockUsers([selfUser, marketingTarget]);
    const accessToken = await signIn(selfUser);

    await request(httpServer)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(userListBody(response).items.map((user) => user.id)).toEqual([
          'self-1',
        ]);
        expect(userListBody(response).total).toBe(1);
      });
  });

  it('out-of-scope user update returns 404 and does not mutate', async () => {
    const deptUser = persistedUser({
      id: 'dept-user-1',
      email: 'dept-user@example.com',
      username: 'dept-user',
      passwordHash: await bcrypt.hash('Admin123!', 4),
      departments: [departmentAssignment('engineering')],
    });
    const marketingTarget = persistedUser({
      id: 'marketing-1',
      email: 'marketing@example.com',
      username: 'marketing',
      departments: [departmentAssignment('marketing')],
    });
    permissionContexts.set('dept-user-1', {
      roleCodes: ['dept-user'],
      permissionCodes: ['user.update'],
      isSuperAdmin: false,
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: [],
        departmentIds: ['engineering'],
      },
    });
    mockUsers([deptUser, marketingTarget]);
    const accessToken = await signIn(deptUser);

    await request(httpServer)
      .patch('/api/users/marketing-1')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Blocked' })
      .expect(404)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({ message: 'User not found' });
      });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('super admin can read and mutate all users', async () => {
    const superAdmin = persistedUser({
      id: 'super-1',
      email: 'super@example.com',
      username: 'super',
      passwordHash: await bcrypt.hash('Admin123!', 4),
      roles: [{ role: { code: 'super_admin', name: 'Super admin' } }],
    });
    const marketingTarget = persistedUser({
      id: 'marketing-1',
      email: 'marketing@example.com',
      username: 'marketing',
      departments: [departmentAssignment('marketing')],
    });
    permissionContexts.set('super-1', {
      roleCodes: ['super_admin'],
      permissionCodes: ['user.read', 'user.update'],
      isSuperAdmin: true,
      dataScope: { mode: 'ALL', selfUserIds: [], departmentIds: [] },
    });
    mockUsers([superAdmin, marketingTarget]);
    prisma.user.update.mockImplementationOnce(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ReturnType<typeof persistedUser>>;
      }) => persistedUser({ ...marketingTarget, id: where.id, ...data }),
    );
    const accessToken = await signIn(superAdmin);

    await request(httpServer)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(userListBody(response).items.map((user) => user.id).sort()).toEqual(
          ['marketing-1', 'super-1'],
        );
      });

    await request(httpServer)
      .patch('/api/users/marketing-1')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Updated' })
      .expect(200)
      .expect((response: Response) => {
        expect(response.body).toMatchObject({
          id: 'marketing-1',
          firstName: 'Updated',
        });
      });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'marketing-1' } }),
    );
  });

  it('missing RBAC permission still returns 403 before data scope checks', async () => {
    const customUser = persistedUser({
      id: 'custom-1',
      email: 'custom@example.com',
      username: 'custom',
      passwordHash: await bcrypt.hash('Admin123!', 4),
      departments: [departmentAssignment('platform')],
    });
    permissionContexts.set('custom-1', {
      roleCodes: ['custom-user'],
      permissionCodes: ['dashboard.view'],
      isSuperAdmin: false,
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: [],
        departmentIds: ['platform'],
      },
    });
    mockUsers([customUser]);
    const accessToken = await signIn(customUser);

    await request(httpServer)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(
      prisma.user.findFirst.mock.calls.some((call) =>
        JSON.stringify(call[0]).includes('departmentId'),
      ),
    ).toBe(false);
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
