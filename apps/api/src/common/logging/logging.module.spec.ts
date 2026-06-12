import {
  Controller,
  Get,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { LoggerModule, type Params } from 'nestjs-pino';
import type { Server } from 'node:http';
import { PassThrough } from 'node:stream';
import request from 'supertest';
import { createPinoHttpOptions } from './logging.module';
import { RequestIdMiddleware } from './request-id.middleware';
import { setRequestId } from './request-context';

type PinoHttpOptions = {
  level?: string;
  base?: unknown;
  transport?: unknown;
  customProps?: (request: Request, response: Response) => object;
  customAttributeKeys?: Record<string, string | undefined>;
  customLogLevel?: (
    request: Request,
    response: Response,
    error?: Error,
  ) => string;
  customSuccessMessage?: (
    request: Request,
    response: Response,
    responseTime: number,
  ) => string;
  customSuccessObject?: (
    request: Request,
    response: Response,
    value: Record<string, unknown>,
  ) => Record<string, unknown>;
  customErrorObject?: (
    request: Request,
    response: Response,
    error: Error,
    value: Record<string, unknown>,
  ) => Record<string, unknown>;
};

const baseEnv = {
  LOG_LEVEL: 'info',
  LOG_PRETTY: false,
  SERVICE_NAME: 'common-admin-api',
  APP_ENV: 'production',
} as const;

type RequestLog = {
  msg?: string;
  requestId?: string;
  statusCode?: number;
  durationMs?: number;
};

function createOptions(
  overrides: Partial<typeof baseEnv> = {},
): PinoHttpOptions {
  const pinoHttp = createPinoHttpOptions({
    ...baseEnv,
    ...overrides,
  }).pinoHttp;

  if (!pinoHttp || Array.isArray(pinoHttp) || typeof pinoHttp === 'function') {
    throw new Error('Expected object pinoHttp options');
  }

  return pinoHttp;
}

function createRequest(
  overrides: Partial<Request> & {
    user?: { sub?: string };
  } = {},
): Request {
  const request = {
    method: 'POST',
    originalUrl: '/api/auth/login',
    url: '/auth/login',
    ip: '203.0.113.10',
    headers: {
      authorization: 'Bearer secret',
      cookie: 'refresh=secret',
      'user-agent': 'jest',
    },
    body: {
      password: 'secret',
      accessToken: 'token',
    },
    ...overrides,
  } as Request & { user?: { sub?: string } };

  setRequestId(request, 'req_123');

  return request;
}

function createMemoryLoggingParams(stream: PassThrough): Params {
  const params = createPinoHttpOptions({
    ...baseEnv,
    LOG_LEVEL: 'info',
    LOG_PRETTY: false,
  });

  if (!params.pinoHttp || Array.isArray(params.pinoHttp)) {
    throw new Error('Expected object pinoHttp options');
  }

  return {
    ...params,
    pinoHttp: [
      {
        ...params.pinoHttp,
        stream,
      },
      stream,
    ],
  };
}

async function readRequestLogs(stream: PassThrough): Promise<RequestLog[]> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  const chunk = stream.read() as unknown;
  const logText = Buffer.isBuffer(chunk)
    ? chunk.toString('utf8')
    : typeof chunk === 'string'
      ? chunk
      : '';

  return logText
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RequestLog);
}

@Controller('logging-test')
class LoggingTestController {
  @Get()
  get() {
    return { ok: true };
  }
}

@Module({})
class RequestIdFirstLoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('createPinoHttpOptions', () => {
  it('uses JSON production logging without pretty transport', () => {
    const options = createOptions({ LOG_PRETTY: false });

    expect(options.level).toBe('info');
    expect(options.base).toEqual({
      service: 'common-admin-api',
      env: 'production',
    });
    expect(options.transport).toBeUndefined();
  });

  it('enables pino-pretty for local pretty logging', () => {
    const options = createOptions({
      LOG_PRETTY: true,
      APP_ENV: 'development',
    });

    expect(options.transport).toEqual(
      expect.objectContaining({
        target: 'pino-pretty',
      }),
    );
  });

  it('defers request context until completion logs', () => {
    const options = createOptions();
    const request = createRequest({ user: { sub: 'user_123' } });

    expect(options.customProps?.(request, {} as Response)).toEqual({});
    expect(options.customAttributeKeys).toEqual(
      expect.objectContaining({
        responseTime: 'durationMs',
        req: 'req',
        res: 'res',
        err: 'err',
      }),
    );
  });

  it('adds request context and status code to completion logs', () => {
    const options = createOptions();

    expect(
      options.customSuccessObject?.(
        createRequest(),
        { statusCode: 201 } as Response,
        { durationMs: 12 },
      ),
    ).toEqual(
      expect.objectContaining({
        requestId: 'req_123',
        method: 'POST',
        path: '/api/auth/login',
        statusCode: 201,
        durationMs: 12,
      }),
    );
    expect(
      options.customErrorObject?.(
        createRequest(),
        { statusCode: 503 } as Response,
        new Error('boom'),
        { durationMs: 12 },
      ),
    ).toEqual(
      expect.objectContaining({
        requestId: 'req_123',
        method: 'POST',
        path: '/api/auth/login',
        statusCode: 503,
        durationMs: 12,
      }),
    );
  });

  it.each([
    [200, 'info'],
    [302, 'info'],
    [404, 'warn'],
    [500, 'error'],
  ] as const)('uses %s response status as %s severity', (statusCode, level) => {
    const options = createOptions();

    expect(
      options.customLogLevel?.(
        createRequest(),
        { statusCode } as Response,
        undefined,
      ),
    ).toBe(level);
  });

  it('logs errors at error severity regardless of status code', () => {
    const options = createOptions();

    expect(
      options.customLogLevel?.(
        createRequest(),
        { statusCode: 200 } as Response,
        new Error('boom'),
      ),
    ).toBe('error');
  });

  it('keeps sensitive headers and credential fields out of custom props', () => {
    const options = createOptions();
    const props = options.customProps?.(createRequest(), {} as Response);

    expect(JSON.stringify(props)).not.toContain('authorization');
    expect(JSON.stringify(props)).not.toContain('cookie');
    expect(JSON.stringify(props)).not.toContain('password');
    expect(JSON.stringify(props)).not.toContain('accessToken');
    expect(JSON.stringify(props)).not.toContain('refreshToken');
  });

  it('sets the request completion message', () => {
    const options = createOptions();

    expect(
      options.customSuccessMessage?.(createRequest(), {} as Response, 10),
    ).toBe('request completed');
  });

  it('emits request logs with middleware request id, status code, and duration', async () => {
    const stream = new PassThrough();
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot(createMemoryLoggingParams(stream)),
        RequestIdFirstLoggingModule,
      ],
      controllers: [LoggingTestController],
    }).compile();
    const app = moduleRef.createNestApplication();

    await app.init();

    await request(app.getHttpServer() as Server)
      .get('/logging-test')
      .set('x-request-id', 'request-id-123')
      .expect(200);

    const logs = await readRequestLogs(stream);

    await app.close();

    expect(logs).toContainEqual(
      expect.objectContaining({
        msg: 'request completed',
        requestId: 'request-id-123',
        statusCode: 200,
        durationMs: expect.any(Number) as number,
      }),
    );
  });
});
