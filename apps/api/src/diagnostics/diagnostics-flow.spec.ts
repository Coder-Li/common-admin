/* eslint-disable @typescript-eslint/no-require-imports */
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Response } from 'supertest';
import { configureApp } from '../app.setup';

interface ErrorEnvelope {
  code: string;
  message: string;
  statusCode: number;
  requestId: string;
  path: string;
  timestamp: string;
}

function errorBody(response: Response): ErrorEnvelope {
  return response.body as ErrorEnvelope;
}

describe('Diagnostics error flow', () => {
  let app: INestApplication;
  let httpServer: Server;

  const touchedEnvKeys = [
    'ENABLE_DIAGNOSTIC_ERROR_ENDPOINT',
    'JWT_ACCESS_TOKEN_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
    'ALLOWED_ORIGINS',
  ] as const;
  const originalEnv = Object.fromEntries(
    touchedEnvKeys.map((key) => [key, process.env[key]]),
  );
  const allowedOrigin = 'http://localhost:15173';
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
    setContext: jest.fn(),
  };

  beforeAll(async () => {
    process.env.ENABLE_DIAGNOSTIC_ERROR_ENDPOINT = 'true';
    process.env.JWT_ACCESS_TOKEN_SECRET = 'test-access-secret-change-me';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.ALLOWED_ORIGINS = allowedOrigin;

    const { AppModule } =
      require('../app.module') as typeof import('../app.module');
    const { PrismaService } =
      require('../prisma/prisma.service') as typeof import('../prisma/prisma.service');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PinoLogger)
      .useValue(logger)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();

    for (const key of touchedEnvKeys) {
      const originalValue = originalEnv[key];

      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  it('returns a logged unified 500 envelope for unauthenticated diagnostic errors', async () => {
    const response = await request(httpServer)
      .get('/api/diagnostics/error')
      .set('Origin', allowedOrigin)
      .expect(500);
    const body = errorBody(response);
    const requestId = response.headers['x-request-id'];

    expect(requestId).toEqual(expect.any(String));
    expect(body).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      statusCode: 500,
      requestId,
      path: '/api/diagnostics/error',
    });
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        requestId,
        method: 'GET',
        path: '/api/diagnostics/error',
      }),
      'Unhandled exception',
    );
  });
});
