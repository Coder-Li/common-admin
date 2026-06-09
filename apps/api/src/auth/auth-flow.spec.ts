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

interface DictionaryTypeListResponseBody {
  items: Array<{
    id: string;
    code: string;
    name: string;
    status: 'ACTIVE' | 'DISABLED';
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

interface DictionaryOptionsResponseBody {
  typeCode: string;
  items: Array<{
    value: string;
    label: string;
    isDefault: boolean;
    badgeVariant?: string;
  }>;
}

interface FileListResponseBody {
  items: Array<{
    id: string;
    originalName: string;
    displayName: string;
    mimeType: string;
    extension: string | null;
    size: string;
    storageDriver: 'LOCAL';
    visibility: 'PRIVATE';
    description: string | null;
    metadata: Record<string, unknown> | null;
    uploadedById: string | null;
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

function userProfileBody(response: Response): UserProfileResponseBody {
  return response.body as UserProfileResponseBody;
}

function userListBody(response: Response): UserListResponseBody {
  return response.body as UserListResponseBody;
}

function userDetailBody(response: Response): UserDetailResponseBody {
  return response.body as UserDetailResponseBody;
}

function dictionaryTypeListBody(
  response: Response,
): DictionaryTypeListResponseBody {
  return response.body as DictionaryTypeListResponseBody;
}

function dictionaryOptionsBody(
  response: Response,
): DictionaryOptionsResponseBody {
  return response.body as DictionaryOptionsResponseBody;
}

function fileListBody(response: Response): FileListResponseBody {
  return response.body as FileListResponseBody;
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
    [
      prisma.user,
      prisma.dictionaryType,
      prisma.dictionaryItem,
      prisma.managedFile,
    ].forEach((model) => {
      Object.values(model).forEach((mock) => {
        mock.mockReset();
      });
    });
    prisma.$transaction.mockReset();
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

  it('forbids a standard user from listing dictionary types', async () => {
    const standardUser = persistedUser({
      id: 'standard-1',
      email: 'standard@example.com',
      username: 'standard',
      role: Role.STANDARD,
    });
    standardUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(standardUser);

    await request(httpServer)
      .get('/api/dictionary-types')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(prisma.dictionaryType.findMany).not.toHaveBeenCalled();
  });

  it('allows an admin user to list dictionary types', async () => {
    const adminUser = persistedUser();
    adminUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(adminUser);
    prisma.dictionaryType.findMany.mockResolvedValueOnce([
      {
        id: 'type-1',
        code: 'user_role',
        name: 'User role',
        status: 'ACTIVE',
        isSystem: true,
        description: null,
        createdAt: new Date('2026-06-08T01:02:03.000Z'),
        updatedAt: new Date('2026-06-08T04:05:06.000Z'),
      },
    ]);
    prisma.dictionaryType.count.mockResolvedValueOnce(1);

    await request(httpServer)
      .get('/api/dictionary-types')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(dictionaryTypeListBody(response)).toEqual({
          items: [
            {
              id: 'type-1',
              code: 'user_role',
              name: 'User role',
              status: 'ACTIVE',
              isSystem: true,
              createdAt: '2026-06-08T01:02:03.000Z',
              updatedAt: '2026-06-08T04:05:06.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      });
  });

  it('allows an authenticated standard user to fetch dictionary options', async () => {
    const standardUser = persistedUser({
      id: 'standard-1',
      email: 'standard@example.com',
      username: 'standard',
      role: Role.STANDARD,
    });
    standardUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(standardUser);
    prisma.dictionaryType.findFirst.mockResolvedValueOnce({
      id: 'type-1',
      code: 'user_role',
      name: 'User role',
      status: 'ACTIVE',
      isSystem: true,
      description: null,
      createdAt: new Date('2026-06-08T00:00:00.000Z'),
      updatedAt: new Date('2026-06-08T00:00:00.000Z'),
      items: [
        {
          id: 'item-1',
          typeId: 'type-1',
          value: Role.STANDARD,
          label: 'Standard',
          sortOrder: 20,
          status: 'ACTIVE',
          isSystem: true,
          isDefault: true,
          badgeVariant: 'NEUTRAL',
          metadata: null,
          description: null,
          createdAt: new Date('2026-06-08T01:02:03.000Z'),
          updatedAt: new Date('2026-06-08T04:05:06.000Z'),
        },
      ],
    });

    await request(httpServer)
      .get('/api/dictionaries/user_role/options')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(dictionaryOptionsBody(response)).toEqual({
          typeCode: 'user_role',
          items: [
            {
              value: Role.STANDARD,
              label: 'Standard',
              isDefault: true,
              badgeVariant: 'NEUTRAL',
            },
          ],
        });
      });
  });

  it('rejects unauthenticated dictionary option requests', async () => {
    await request(httpServer)
      .get('/api/dictionaries/user_role/options')
      .expect(401);
  });

  it('returns 204 when an admin deletes a dictionary type', async () => {
    const adminUser = persistedUser();
    adminUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(adminUser);
    prisma.dictionaryType.findUnique.mockResolvedValueOnce({
      id: 'type-1',
      code: 'custom_status',
      name: 'Custom status',
      status: 'ACTIVE',
      isSystem: false,
      description: null,
      createdAt: new Date('2026-06-08T01:02:03.000Z'),
      updatedAt: new Date('2026-06-08T04:05:06.000Z'),
    });
    prisma.dictionaryItem.count.mockResolvedValueOnce(0);
    prisma.dictionaryType.delete.mockResolvedValueOnce({
      id: 'type-1',
      code: 'custom_status',
    });

    await request(httpServer)
      .delete('/api/dictionary-types/type-1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204)
      .expect((response: Response) => {
        expect(response.text).toBe('');
      });

    expect(prisma.dictionaryType.delete).toHaveBeenCalledWith({
      where: { id: 'type-1' },
    });
  });

  it('rejects unauthenticated file list requests', async () => {
    await request(httpServer).get('/api/files').expect(401);
  });

  it('forbids a standard user from listing files', async () => {
    const standardUser = persistedUser({
      id: 'standard-1',
      email: 'standard@example.com',
      username: 'standard',
      role: Role.STANDARD,
    });
    standardUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(standardUser);

    await request(httpServer)
      .get('/api/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(prisma.managedFile.findMany).not.toHaveBeenCalled();
  });

  it('allows an admin user to list files', async () => {
    const adminUser = persistedUser();
    adminUser.passwordHash = await bcrypt.hash('Admin123!', 4);
    const accessToken = await signIn(adminUser);
    prisma.managedFile.findMany.mockResolvedValueOnce([
      {
        id: 'file-1',
        originalName: 'report.pdf',
        displayName: 'Report',
        mimeType: 'application/pdf',
        extension: 'pdf',
        size: 5n,
        storageDriver: 'LOCAL',
        bucket: null,
        objectKey: '2026/06/object.pdf',
        checksum: 'abc123',
        visibility: 'PRIVATE',
        description: null,
        metadata: null,
        uploadedById: 'user-1',
        createdAt: new Date('2026-06-09T01:02:03.000Z'),
        updatedAt: new Date('2026-06-09T04:05:06.000Z'),
        deletedAt: null,
      },
    ]);
    prisma.managedFile.count.mockResolvedValueOnce(1);

    await request(httpServer)
      .get('/api/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response: Response) => {
        expect(fileListBody(response)).toEqual({
          items: [
            {
              id: 'file-1',
              originalName: 'report.pdf',
              displayName: 'Report',
              mimeType: 'application/pdf',
              extension: 'pdf',
              size: '5',
              storageDriver: 'LOCAL',
              visibility: 'PRIVATE',
              description: null,
              metadata: null,
              uploadedById: 'user-1',
              createdAt: '2026-06-09T01:02:03.000Z',
              updatedAt: '2026-06-09T04:05:06.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      });

    expect(prisma.managedFile.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
      where: { deletedAt: null },
    });
    expect(prisma.managedFile.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });
});
