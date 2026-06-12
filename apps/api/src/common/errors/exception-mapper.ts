import { HttpException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { AppException } from './app-exception';
import { ERROR_CODES, type ErrorCode } from './error-codes';
import { flattenValidationErrors } from './validation-errors';

interface ErrorMappingContext {
  path: string;
  requestId: string;
  timestamp: string;
}

interface ErrorResponse {
  code: ErrorCode;
  message: string;
  statusCode: number;
  requestId: string;
  path: string;
  timestamp: string;
  details?: unknown;
}

export interface MappedException {
  response: ErrorResponse;
  logLevel: 'warn' | 'error';
  shouldLogException: boolean;
  error: unknown;
}

const STATUS_CODE_TO_ERROR_CODE: Partial<Record<number, ErrorCode>> = {
  400: ERROR_CODES.BAD_REQUEST,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  413: ERROR_CODES.PAYLOAD_TOO_LARGE,
  415: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
  429: ERROR_CODES.RATE_LIMITED,
  500: ERROR_CODES.INTERNAL_SERVER_ERROR,
  503: ERROR_CODES.SERVICE_UNAVAILABLE,
};

export function mapExceptionToErrorResponse(
  exception: unknown,
  context: ErrorMappingContext,
): MappedException {
  if (exception instanceof AppException) {
    const statusCode = exception.getStatus();
    return buildMappedException({
      exception,
      context,
      code: exception.code,
      message: statusCode >= 500 ? 'Internal server error' : exception.message,
      statusCode,
      details: exception.details,
      shouldLogException: exception.shouldLog || statusCode >= 500,
    });
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const validationErrors = getValidationErrors(response);

    if (validationErrors) {
      return buildMappedException({
        exception,
        context,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request validation failed',
        statusCode,
        details: { fields: flattenValidationErrors(validationErrors) },
        shouldLogException: statusCode >= 500,
      });
    }

    return buildMappedException({
      exception,
      context,
      code: mapStatusCodeToErrorCode(statusCode),
      message:
        statusCode >= 500
          ? 'Internal server error'
          : getHttpExceptionMessage(response, exception.message),
      statusCode,
      shouldLogException: statusCode >= 500,
    });
  }

  if (isPrismaErrorCode(exception, 'P2002')) {
    return buildMappedException({
      exception,
      context,
      code: ERROR_CODES.CONFLICT,
      message: 'Resource already exists',
      statusCode: 409,
      shouldLogException: false,
    });
  }

  if (isPrismaErrorCode(exception, 'P2025')) {
    return buildMappedException({
      exception,
      context,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Resource not found',
      statusCode: 404,
      shouldLogException: false,
    });
  }

  if (isMulterError(exception)) {
    const isFileSizeLimit = exception.code === 'LIMIT_FILE_SIZE';
    return buildMappedException({
      exception,
      context,
      code: isFileSizeLimit
        ? ERROR_CODES.PAYLOAD_TOO_LARGE
        : ERROR_CODES.BAD_REQUEST,
      message: isFileSizeLimit
        ? 'Uploaded file is too large'
        : 'Invalid upload',
      statusCode: isFileSizeLimit ? 413 : 400,
      details: isFileSizeLimit
        ? getMulterFileSizeLimitDetails(exception)
        : undefined,
      shouldLogException: false,
    });
  }

  return buildMappedException({
    exception,
    context,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
    statusCode: 500,
    shouldLogException: true,
  });
}

function buildMappedException(input: {
  exception: unknown;
  context: ErrorMappingContext;
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: unknown;
  shouldLogException: boolean;
}): MappedException {
  const response: ErrorResponse = {
    code: input.code,
    message: input.message,
    statusCode: input.statusCode,
    requestId: input.context.requestId,
    path: input.context.path,
    timestamp: input.context.timestamp,
  };

  if (input.details !== undefined) {
    response.details = input.details;
  }

  return {
    response,
    logLevel: input.statusCode >= 500 ? 'error' : 'warn',
    shouldLogException: input.shouldLogException,
    error: input.exception,
  };
}

function mapStatusCodeToErrorCode(statusCode: number): ErrorCode {
  return (
    STATUS_CODE_TO_ERROR_CODE[statusCode] ?? ERROR_CODES.INTERNAL_SERVER_ERROR
  );
}

function getHttpExceptionMessage(response: unknown, fallback: string): string {
  if (typeof response === 'string') {
    return response;
  }

  if (isRecord(response)) {
    const message = response.message;
    if (typeof message === 'string') {
      return message;
    }

    const error = response.error;
    if (typeof error === 'string') {
      return error;
    }
  }

  return fallback;
}

function getValidationErrors(response: unknown): ValidationError[] | undefined {
  if (isValidationErrorArray(response)) {
    return response;
  }

  if (isRecord(response) && isValidationErrorArray(response.message)) {
    return response.message;
  }

  return undefined;
}

function isValidationErrorArray(value: unknown): value is ValidationError[] {
  return Array.isArray(value) && value.every(isValidationError);
}

function isValidationError(value: unknown): value is ValidationError {
  return isRecord(value) && typeof value.property === 'string';
}

function isPrismaErrorCode(
  exception: unknown,
  code: 'P2002' | 'P2025',
): boolean {
  return isRecord(exception) && exception.code === code;
}

function getMulterFileSizeLimitDetails(
  exception: { limit?: unknown },
): { limit: number } | undefined {
  return typeof exception.limit === 'number' && Number.isFinite(exception.limit)
    ? { limit: exception.limit }
    : undefined;
}

function isMulterError(
  exception: unknown,
): exception is { code: string; limit?: unknown } {
  return (
    isRecord(exception) &&
    typeof exception.code === 'string' &&
    exception.code.startsWith('LIMIT_')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
