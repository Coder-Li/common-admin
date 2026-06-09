/* eslint-disable @typescript-eslint/no-unsafe-return */
import { AUDIT_SENSITIVE_KEYS } from './audit-log.constants';

const REDACTED_VALUE = '[REDACTED]';

export function sanitizeAuditPayload<T>(payload: T): T {
  if (payload === null || typeof payload !== 'object') {
    return payload;
  }

  if (payload instanceof Date) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeAuditPayload(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      AUDIT_SENSITIVE_KEYS.has(key.toLowerCase())
        ? REDACTED_VALUE
        : sanitizeAuditPayload(value),
    ]),
  ) as T;
}
