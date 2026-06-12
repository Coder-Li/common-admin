import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { AppException } from './app-exception';
import { ERROR_CODES } from './error-codes';
import { ErrorResponseDto } from './error-response.dto';
import { mapExceptionToErrorResponse } from './exception-mapper';

const context = {
  path: '/api/users',
  requestId: 'req_test123',
  timestamp: '2026-06-11T10:20:30.000Z',
};

describe('AppException', () => {
  it('stores a stable code, status, message, and details', () => {
    const exception = new AppException({
      code: ERROR_CODES.CONFLICT,
      message: 'Conflict',
      statusCode: 409,
      details: { field: 'email' },
    });

    expect(exception.getStatus()).toBe(409);
    expect(exception.code).toBe(ERROR_CODES.CONFLICT);
    expect(exception.message).toBe('Conflict');
    expect(exception.details).toEqual({ field: 'email' });
  });

  it('exports the public error response DTO', () => {
    expect(ErrorResponseDto).toEqual(expect.any(Function));
  });
});

describe('mapExceptionToErrorResponse', () => {
  it('preserves AppException code, status, message, and details', () => {
    const exception = new AppException({
      code: ERROR_CODES.USER_EMAIL_ALREADY_EXISTS,
      message: 'Email is already registered',
      statusCode: 409,
      details: { field: 'email' },
    });

    const mapped = mapExceptionToErrorResponse(exception, context);

    expect(mapped).toEqual({
      response: {
        code: ERROR_CODES.USER_EMAIL_ALREADY_EXISTS,
        message: 'Email is already registered',
        statusCode: 409,
        requestId: context.requestId,
        path: context.path,
        timestamp: context.timestamp,
        details: { field: 'email' },
      },
      logLevel: 'warn',
      shouldLogException: false,
      error: exception,
    });
  });

  it('maps 5xx AppException instances to a safe public message', () => {
    const exception = new AppException({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'database password leaked',
      statusCode: 500,
      details: { safe: false },
    });

    const mapped = mapExceptionToErrorResponse(exception, context);

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      statusCode: 500,
      details: { safe: false },
    });
    expect(mapped.logLevel).toBe('error');
    expect(mapped.shouldLogException).toBe(true);
    expect(mapped.error).toBe(exception);
  });

  it('maps BadRequestException to BAD_REQUEST', () => {
    const mapped = mapExceptionToErrorResponse(
      new BadRequestException('Bad input'),
      context,
    );

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Bad input',
      statusCode: 400,
    });
    expect(mapped.logLevel).toBe('warn');
    expect(mapped.shouldLogException).toBe(false);
  });

  it('maps validation arrays to VALIDATION_ERROR details fields', () => {
    const validationErrors: ValidationError[] = [
      {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
      },
      {
        property: 'profile',
        children: [
          {
            property: 'name',
            constraints: { isString: 'name must be a string' },
          },
        ],
      },
    ];
    const exception = new BadRequestException(validationErrors);

    const mapped = mapExceptionToErrorResponse(exception, context);

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Request validation failed',
      statusCode: 400,
      details: {
        fields: [
          { field: 'email', message: 'email must be an email' },
          { field: 'profile.name', message: 'name must be a string' },
        ],
      },
    });
    expect(mapped.logLevel).toBe('warn');
    expect(mapped.shouldLogException).toBe(false);
  });

  it.each([
    [new UnauthorizedException('Unauthorized'), ERROR_CODES.UNAUTHORIZED, 401],
    [new ForbiddenException('Forbidden'), ERROR_CODES.FORBIDDEN, 403],
    [new NotFoundException('Not found'), ERROR_CODES.NOT_FOUND, 404],
  ])('maps %p to its matching base code', (exception, code, statusCode) => {
    const mapped = mapExceptionToErrorResponse(exception, context);

    expect(mapped.response).toMatchObject({
      code,
      statusCode,
    });
    expect(mapped.logLevel).toBe('warn');
    expect(mapped.shouldLogException).toBe(false);
  });

  it('maps HTTP 429 exceptions to RATE_LIMITED', () => {
    const mapped = mapExceptionToErrorResponse(
      new HttpException('Too many requests', 429),
      context,
    );

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many requests',
      statusCode: 429,
    });
  });

  it('maps HTTP 415 exceptions to UNSUPPORTED_MEDIA_TYPE', () => {
    const mapped = mapExceptionToErrorResponse(
      new HttpException('Unsupported media type', 415),
      context,
    );

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      message: 'Unsupported media type',
      statusCode: 415,
    });
  });

  it('maps 5xx HttpException instances to a safe public message', () => {
    const exception = new InternalServerErrorException(
      'database password leaked',
    );

    const mapped = mapExceptionToErrorResponse(exception, context);

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      statusCode: 500,
    });
    expect(mapped.logLevel).toBe('error');
    expect(mapped.shouldLogException).toBe(true);
    expect(mapped.error).toBe(exception);
  });

  it('maps Prisma P2002 errors to CONFLICT', () => {
    const mapped = mapExceptionToErrorResponse({ code: 'P2002' }, context);

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.CONFLICT,
      message: 'Resource already exists',
      statusCode: 409,
    });
  });

  it('maps Prisma P2025 errors to NOT_FOUND', () => {
    const mapped = mapExceptionToErrorResponse({ code: 'P2025' }, context);

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Resource not found',
      statusCode: 404,
    });
  });

  it('maps Multer LIMIT_FILE_SIZE errors to PAYLOAD_TOO_LARGE', () => {
    const mapped = mapExceptionToErrorResponse(
      { code: 'LIMIT_FILE_SIZE', field: 'file', limit: 20 * 1024 * 1024 },
      context,
    );

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      message: 'Uploaded file is too large',
      statusCode: 413,
      details: { limit: 20 * 1024 * 1024 },
    });
  });

  it('maps unsupported MIME upload validation to UNSUPPORTED_MEDIA_TYPE', () => {
    const exception = new AppException({
      code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      message: 'File type is not allowed',
      statusCode: 415,
    });

    const mapped = mapExceptionToErrorResponse(exception, context);

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      message: 'File type is not allowed',
      statusCode: 415,
    });
    expect(mapped.logLevel).toBe('warn');
    expect(mapped.shouldLogException).toBe(false);
  });

  it('maps missing upload file validation to FILE_UPLOAD_REQUIRED', () => {
    const exception = new AppException({
      code: ERROR_CODES.FILE_UPLOAD_REQUIRED,
      message: 'File upload is required',
      statusCode: 400,
    });

    const mapped = mapExceptionToErrorResponse(exception, context);

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.FILE_UPLOAD_REQUIRED,
      message: 'File upload is required',
      statusCode: 400,
    });
    expect(mapped.logLevel).toBe('warn');
    expect(mapped.shouldLogException).toBe(false);
  });

  it('maps other Multer errors to BAD_REQUEST', () => {
    const mapped = mapExceptionToErrorResponse(
      { code: 'LIMIT_UNEXPECTED_FILE' },
      context,
    );

    expect(mapped.response).toMatchObject({
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Invalid upload',
      statusCode: 400,
    });
    expect(mapped.logLevel).toBe('warn');
    expect(mapped.shouldLogException).toBe(false);
  });

  it('maps unknown Error instances to a safe internal server error', () => {
    const exception = new Error('database password leaked in stack');

    const mapped = mapExceptionToErrorResponse(exception, context);

    expect(mapped.response).toEqual({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      statusCode: 500,
      requestId: context.requestId,
      path: context.path,
      timestamp: context.timestamp,
    });
    expect(mapped.logLevel).toBe('error');
    expect(mapped.shouldLogException).toBe(true);
    expect(mapped.error).toBe(exception);
  });
});
