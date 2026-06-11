import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getRequestIdFromRequest } from '../logging/request-context';
import { mapExceptionToErrorResponse } from './exception-mapper';

type RequestWithUser = Request & {
  user?: {
    sub?: string;
  };
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithUser>();
    const response = http.getResponse<Response>();
    const mapped = mapExceptionToErrorResponse(exception, {
      path: request.originalUrl ?? request.url,
      requestId: getRequestIdFromRequest(request),
      timestamp: new Date().toISOString(),
    });

    if (mapped.shouldLogException) {
      this.logger.error(
        JSON.stringify({
          err: serializeExceptionForLog(exception),
          code: mapped.response.code,
          requestId: mapped.response.requestId,
          method: request.method,
          path: mapped.response.path,
          userId: request.user?.sub,
        }),
        exception instanceof Error ? exception.stack : undefined,
        getLogContext(mapped.response.statusCode),
      );
    }

    response.status(mapped.response.statusCode).json(mapped.response);
  }
}

function serializeExceptionForLog(exception: unknown) {
  if (exception instanceof Error) {
    return {
      name: exception.name,
      message: exception.message,
    };
  }

  return {
    name: 'NonErrorException',
    message: String(exception),
  };
}

function getLogContext(statusCode: number): string {
  return statusCode >= 500 ? 'Unhandled exception' : 'Request exception';
}
