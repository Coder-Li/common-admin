import { HttpException } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

interface AppExceptionInput {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: unknown;
  log?: boolean;
}

export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details: unknown;
  readonly shouldLog: boolean;

  constructor(input: AppExceptionInput) {
    super(input.message, input.statusCode);
    this.code = input.code;
    this.details = input.details;
    this.shouldLog = input.log ?? false;
  }
}
