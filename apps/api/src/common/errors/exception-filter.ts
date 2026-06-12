import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { getRequestIdFromRequest } from '../logging/request-context';
import { mapExceptionToErrorResponse } from './exception-mapper';

type RequestWithUser = Request & {
  user?: {
    sub?: string;
  };
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

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
        {
          err: exception,
          code: mapped.response.code,
          requestId: mapped.response.requestId,
          method: request.method,
          path: mapped.response.path,
          userId: request.user?.sub,
        },
        getLogMessage(mapped.response.statusCode),
      );
    }

    response.status(mapped.response.statusCode).json(mapped.response);
  }
}

function getLogMessage(statusCode: number): string {
  return statusCode >= 500 ? 'Unhandled exception' : 'Request exception';
}
