import { toUserSessionResponse } from './user-session.mapper';

describe('user session mapper', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  const makeSession = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: 'sensitive-hash',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    ipAddress: '203.0.113.10',
    createdAt: new Date('2026-06-14T08:00:00.000Z'),
    lastUsedAt: new Date('2026-06-14T09:00:00.000Z'),
    expiresAt: new Date('2026-06-15T08:00:00.000Z'),
    revokedAt: null,
    revokedReason: null,
    user: {
      id: 'user-1',
      username: 'ada',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    ...overrides,
  });

  it('maps revoked sessions to revoked status', () => {
    expect(
      toUserSessionResponse(
        makeSession({
          revokedAt: new Date('2026-06-14T10:00:00.000Z'),
          revokedReason: 'admin_revoked',
        }),
        'current-session',
        now,
      ),
    ).toMatchObject({
      status: 'revoked',
      revokedAt: '2026-06-14T10:00:00.000Z',
      revokedReason: 'admin_revoked',
    });
  });

  it('maps unreclaimed sessions expiring at or before now to expired status', () => {
    expect(
      toUserSessionResponse(
        makeSession({ expiresAt: new Date('2026-06-14T12:00:00.000Z') }),
        'current-session',
        now,
      ),
    ).toMatchObject({ status: 'expired' });
  });

  it('maps unrevoked future sessions to active status and marks current session', () => {
    expect(
      toUserSessionResponse(makeSession(), 'session-1', now),
    ).toMatchObject({
      status: 'active',
      isCurrentSession: true,
      createdAt: '2026-06-14T08:00:00.000Z',
      lastUsedAt: '2026-06-14T09:00:00.000Z',
      expiresAt: '2026-06-15T08:00:00.000Z',
    });
  });

  it('falls back for missing user agents', () => {
    expect(
      toUserSessionResponse(
        makeSession({ userAgent: null, lastUsedAt: null }),
        'current-session',
        now,
      ),
    ).toMatchObject({
      userAgent: undefined,
      lastUsedAt: undefined,
      deviceSummary: {
        browser: 'Unknown browser',
        os: 'Unknown OS',
        deviceType: 'Unknown device',
      },
    });
  });

  it('maps a common Chrome macOS user agent to a useful device summary', () => {
    expect(
      toUserSessionResponse(makeSession(), 'current-session', now),
    ).toEqual(
      expect.objectContaining({
        deviceSummary: {
          browser: 'Chrome',
          os: 'macOS',
          deviceType: 'Desktop',
        },
      }),
    );
  });

  it('does not expose refreshTokenHash', () => {
    expect(
      toUserSessionResponse(makeSession(), 'current-session', now),
    ).not.toHaveProperty('refreshTokenHash');
  });
});
