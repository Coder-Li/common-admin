import type { Request } from 'express';

import type { JwtUserPayload } from '../../user/user.types';

const requestIdKey = Symbol.for('common-admin.requestId');

type RequestWithContext = Request & { [requestIdKey]?: string };
type RequestWithJwtUser = Request & { user?: JwtUserPayload };

export function setRequestId(request: Request, requestId: string) {
  (request as RequestWithContext)[requestIdKey] = requestId;
}

export function getRequestIdFromRequest(request: Request): string {
  return (request as RequestWithContext)[requestIdKey] ?? 'unknown';
}

export function getRequestLogContext(request: Request) {
  const userAgent = request.headers['user-agent'];

  return {
    requestId: getRequestIdFromRequest(request),
    method: request.method,
    path: request.originalUrl ?? request.url,
    userId: (request as RequestWithJwtUser).user?.sub,
    ip: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  };
}
