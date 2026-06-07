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

function loginBody(response: Response): LoginResponseBody {
  return response.body as LoginResponseBody;
}

function userProfileBody(response: Response): UserProfileResponseBody {
  return response.body as UserProfileResponseBody;
}

describe('Auth flow', () => {
  let app: INestApplication;
  let httpServer: Server;

  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

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
});
