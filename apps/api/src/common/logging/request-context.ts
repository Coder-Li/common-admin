import type { Request } from 'express';
import type { IncomingHttpHeaders } from 'node:http';

import type { JwtUserPayload } from '../../user/user.types';

const requestIdKey = Symbol.for('common-admin.requestId');

type RequestWithContext = object & { [requestIdKey]?: string };
type RequestLogContextSource = {
  headers: IncomingHttpHeaders;
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  user?: Pick<JwtUserPayload, 'sub'>;
};

export function setRequestId(request: Request, requestId: string) {
  (request as RequestWithContext)[requestIdKey] = requestId;
}

export function getRequestIdFromRequest(request: object): string {
  return (request as RequestWithContext)[requestIdKey] ?? 'unknown';
}

export function getRequestLogContext(request: RequestLogContextSource) {
  const userAgent = request.headers['user-agent'];

  return {
    requestId: getRequestIdFromRequest(request),
    method: request.method,
    path: request.originalUrl ?? request.url,
    userId: request.user?.sub,
    ip: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  };
}
