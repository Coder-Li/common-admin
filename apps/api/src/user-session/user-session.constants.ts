export const USER_SESSION_STATUSES = ['active', 'expired', 'revoked'] as const;

export type UserSessionStatus = (typeof USER_SESSION_STATUSES)[number];

export const USER_SESSION_REVOKED_REASONS = {
  ADMIN_REVOKED: 'admin_revoked',
} as const;

export const USER_SESSION_SORT_FIELDS = new Set([
  'createdAt',
  'lastUsedAt',
  'expiresAt',
]);
