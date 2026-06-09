import type { Request } from 'express';

import type { JwtUserPayload } from '../user/user.types';
import type { AuditActor, AuditRequestMeta } from './audit-log.types';

type MinimalRequest = Pick<Request, 'ip' | 'headers'>;

export function buildAuditActor(user: JwtUserPayload): AuditActor {
  return {
    userId: user.sub,
    ...(user.email ? { email: user.email } : {}),
    ...(user.username ? { name: user.username } : {}),
  };
}

export function getAuditRequestMeta(request: MinimalRequest): AuditRequestMeta {
  const userAgent = request.headers['user-agent'];

  return {
    ...(request.ip ? { ipAddress: request.ip } : {}),
    ...(typeof userAgent === 'string' ? { userAgent } : {}),
  };
}
