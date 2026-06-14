import type { UserSessionStatus } from './user-session.constants';
import { UserSessionResponseDto } from './dto/user-session.response';
import { summarizeUserAgent } from './user-session-device';

export interface UserSessionWithUser {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
  lastUsedAt?: Date | null;
  expiresAt: Date;
  revokedAt?: Date | null;
  revokedReason?: string | null;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export function deriveUserSessionStatus(
  session: Pick<UserSessionWithUser, 'expiresAt' | 'revokedAt'>,
  now = new Date(),
): UserSessionStatus {
  if (session.revokedAt) {
    return 'revoked';
  }

  return session.expiresAt > now ? 'active' : 'expired';
}

export function toUserSessionResponse(
  session: UserSessionWithUser,
  currentSessionId: string,
  now = new Date(),
): UserSessionResponseDto {
  return {
    id: session.id,
    user: {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
    },
    ipAddress: session.ipAddress ?? undefined,
    userAgent: session.userAgent ?? undefined,
    deviceSummary: summarizeUserAgent(session.userAgent),
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: session.lastUsedAt?.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString(),
    revokedReason: session.revokedReason ?? undefined,
    status: deriveUserSessionStatus(session, now),
    isCurrentSession: session.id === currentSessionId,
  };
}
