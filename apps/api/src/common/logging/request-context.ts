import type { Request } from 'express';

const requestIdKey = Symbol.for('common-admin.requestId');

type RequestWithContext = Request & { [requestIdKey]?: string };

export function setRequestId(request: Request, requestId: string) {
  (request as RequestWithContext)[requestIdKey] = requestId;
}

export function getRequestIdFromRequest(request: Request): string {
  return (request as RequestWithContext)[requestIdKey] ?? 'unknown';
}
