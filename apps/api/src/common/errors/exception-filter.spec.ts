import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AppException } from './app-exception';
import { ERROR_CODES } from './error-codes';
import { GlobalExceptionFilter } from './exception-filter';

type ErrorResponseBody = {
  code: string;
  message: string;
  statusCode: number;
  requestId: string;
  path: string;
  timestamp: string;
  details?: unknown;
};

type MockResponse = {
  status: jest.MockedFunction<(statusCode: number) => MockResponse>;
  json: jest.MockedFunction<(body: ErrorResponseBody) => MockResponse>;
};

type MockLogger = {
  error: jest.MockedFunction<
    (message: string, trace?: string, context?: string) => void
  >;
};

function createHttpHost(request: Record<string, unknown> = {}) {
  const response = {} as MockResponse;
  response.status = jest.fn(() => response);
  response.json = jest.fn(() => response);
  const host = {
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => ({
        originalUrl: '/api/auth/login',
        url: '/auth/login',
        method: 'POST',
        ...request,
      })),
      getResponse: jest.fn(() => response),
    })),
  } as unknown as ArgumentsHost;

  return { host, response };
}

function createFilter(logger: MockLogger) {
  const filter = new GlobalExceptionFilter();

  (filter as unknown as { logger: MockLogger }).logger = logger;

  return filter;
}

function createLogger(): MockLogger {
  return {
    error: jest.fn(),
  };
}

function getFirstJsonBody(response: MockResponse): ErrorResponseBody {
  const [firstCall] = response.json.mock.calls;

  if (!firstCall) {
    throw new Error('Expected response.json to be called');
  }

  const [body] = firstCall;

  return body;
}

describe('GlobalExceptionFilter', () => {
  const timestamp = new Date('2026-06-11T10:20:30.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(timestamp);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('writes a unified JSON response for BadRequestException', () => {
    const logger = createLogger();
    const filter = createFilter(logger);
    const { host, response } = createHttpHost();

    filter.catch(new BadRequestException('Bad input'), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Bad input',
      statusCode: 400,
      requestId: 'unknown',
      path: '/api/auth/login',
      timestamp: timestamp.toISOString(),
    });
  });

  it('writes INTERNAL_SERVER_ERROR without stack details for unknown errors', () => {
    const logger = createLogger();
    const filter = createFilter(logger);
    const { host, response } = createHttpHost();

    filter.catch(new Error('database password leaked in stack'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      statusCode: 500,
      requestId: 'unknown',
      path: '/api/auth/login',
      timestamp: timestamp.toISOString(),
    });
    expect(JSON.stringify(getFirstJsonBody(response))).not.toContain(
      'database password leaked in stack',
    );
    expect(getFirstJsonBody(response)).not.toHaveProperty('stack');
  });

  it('logs unknown errors with diagnostic details and stack trace', () => {
    const logger = createLogger();
    const filter = createFilter(logger);
    const { host } = createHttpHost({ user: { sub: 'user_123' } });
    const exception = new Error('boom');

    filter.catch(exception, host);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('"code":"INTERNAL_SERVER_ERROR"'),
      exception.stack,
      'Unhandled exception',
    );
    expect(logger.error.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('"err":{"name":"Error","message":"boom"}'),
    );
    expect(logger.error.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('"userId":"user_123"'),
    );
  });

  it('does not log expected validation 4xx errors', () => {
    const logger = createLogger();
    const filter = createFilter(logger);
    const { host } = createHttpHost();

    filter.catch(
      new AppException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request validation failed',
        statusCode: 400,
        details: {
          fields: [{ field: 'email', message: 'email must be an email' }],
        },
      }),
      host,
    );

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('falls back to unknown request id when request context is missing', () => {
    const logger = createLogger();
    const filter = createFilter(logger);
    const { host, response } = createHttpHost();

    filter.catch(new BadRequestException('Bad input'), host);

    expect(getFirstJsonBody(response)).toEqual(
      expect.objectContaining({ requestId: 'unknown' }),
    );
  });
});
