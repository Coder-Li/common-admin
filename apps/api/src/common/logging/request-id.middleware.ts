import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { setRequestId } from './request-context';

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && requestIdPattern.test(value);
}

export function createRequestId(): string {
  return `req_${randomUUID()}`;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const incoming = request.headers['x-request-id'];
    const requestId = isValidRequestId(incoming) ? incoming : createRequestId();

    setRequestId(request, requestId);
    response.setHeader('x-request-id', requestId);
    next();
  }
}
