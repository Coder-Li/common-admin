/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Response } from 'supertest';
import { configureApp } from '../../app.setup';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

interface ErrorEnvelope {
  code: string;
  message: string;
  statusCode: number;
  requestId: string;
  path: string;
  timestamp: string;
  details?: {
    fields?: Array<{
      field: string;
      message: string;
    }>;
  };
}

function errorBody(response: Response): ErrorEnvelope {
  return response.body as ErrorEnvelope;
}

describe('Error flow', () => {
  let app: INestApplication;
  let httpServer: Server;

  const allowedOrigin = 'http://localhost:15173';
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_TOKEN_SECRET = 'test-access-secret-change-me';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.ALLOWED_ORIGINS = allowedOrigin;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns an error envelope with a request id for unknown API routes', async () => {
    const response = await request(httpServer)
      .get('/api/does-not-exist')
      .set('Origin', allowedOrigin)
      .expect(404);
    const body = errorBody(response);

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(body).toMatchObject({
      code: 'NOT_FOUND',
      message: expect.any(String),
      statusCode: 404,
      requestId: response.headers['x-request-id'],
      path: '/api/does-not-exist',
      timestamp: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('returns validation error details for invalid login payloads', async () => {
    const response = await request(httpServer)
      .post('/api/auth/login')
      .set('Origin', allowedOrigin)
      .send({ usernameOrEmail: 123, password: 'short' })
      .expect(400);
    const body = errorBody(response);

    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      statusCode: 400,
      requestId: response.headers['x-request-id'],
      path: '/api/auth/login',
    });
    expect(body.details?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'usernameOrEmail',
          message: expect.any(String),
        }),
        expect.objectContaining({
          field: 'password',
          message: expect.any(String),
        }),
      ]),
    );
  });

  it('echoes a valid incoming request id', async () => {
    const incomingRequestId = 'client-request-123';

    const response = await request(httpServer)
      .get('/api/does-not-exist')
      .set('x-request-id', incomingRequestId)
      .expect(404);

    expect(response.headers['x-request-id']).toBe(incomingRequestId);
    expect(errorBody(response).requestId).toBe(incomingRequestId);
  });

  it('replaces an invalid incoming request id', async () => {
    const response = await request(httpServer)
      .get('/api/does-not-exist')
      .set('x-request-id', 'bad id')
      .expect(404);
    const selectedRequestId = response.headers['x-request-id'] as string;

    expect(selectedRequestId).toEqual(expect.any(String));
    expect(selectedRequestId).not.toBe('bad id');
    expect(selectedRequestId).toMatch(/^req_[0-9a-f-]{36}$/);
    expect(errorBody(response).requestId).toBe(selectedRequestId);
  });

  it('exposes the request id response header to browser clients', async () => {
    const response = await request(httpServer)
      .get('/api/does-not-exist')
      .set('Origin', allowedOrigin)
      .expect(404);

    expect(response.headers['access-control-expose-headers']).toContain(
      'x-request-id',
    );
  });
});
