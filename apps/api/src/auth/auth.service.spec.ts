import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    roles: [
      {
        role: {
          code: 'admin',
          name: 'Admin',
        },
      },
    ],
  };

  const prisma = {
    user: {
      findFirst: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;
  const permissionService = {
    resolveUserPermissionContext: jest.fn(),
  };
  const refreshTokenService = new RefreshTokenService();

  beforeEach(async () => {
    jest.resetAllMocks();
    user.passwordHash = await bcrypt.hash('Admin123!', 4);
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      userId: 'user-1',
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
    });
  });

  function createService() {
    return new AuthService(
      prisma as never,
      jwtService,
      permissionService as never,
      refreshTokenService,
      {
        accessTokenSecret: 'access-secret',
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresInDays: 30,
        refreshCookieName: 'common_admin_refresh',
        refreshCookieSecure: false,
        refreshCookieSameSite: 'lax',
        refreshCookieDomain: '',
      },
    );
  }

  it('returns sanitized user and tokens for valid username or email credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(user);
    const signAsync = jest
      .spyOn(jwtService, 'signAsync')
      .mockResolvedValueOnce('access-token');

    const service = createService();

    const result = await service.login(
      {
        usernameOrEmail: 'admin@example.com',
        password: 'Admin123!',
      },
      {
        userAgent: 'Jest Agent',
        ipAddress: '203.0.113.10',
      },
    );

    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: expect.stringMatching(/^[^.]+\./),
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        roles: [{ code: 'admin', name: 'Admin' }],
        permissions: ['user.read'],
      },
    });
    const sessionId = result.refreshToken.split('.')[0];
    const { secret } = refreshTokenService.parseToken(result.refreshToken);
    expect(prisma.userSession.create).toHaveBeenCalledWith({
      data: {
        id: sessionId,
        userId: 'user-1',
        refreshTokenHash: expect.any(String),
        userAgent: 'Jest Agent',
        ipAddress: '203.0.113.10',
        expiresAt: expect.any(Date),
      },
    });
    const session = prisma.userSession.create.mock.calls[0][0].data;
    expect(session.refreshTokenHash).not.toBe(secret);
    await expect(
      refreshTokenService.verifySecret(secret, session.refreshTokenHash),
    ).resolves.toBe(true);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(signAsync).toHaveBeenCalledTimes(1);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'admin@example.com' }, { username: 'admin@example.com' }],
      },
      include: { roles: { include: { role: true } } },
    });
    expect(signAsync).toHaveBeenCalledWith(
      {
        sub: 'user-1',
        sid: sessionId,
        email: 'admin@example.com',
        username: 'admin',
      },
      {
        secret: 'access-secret',
        expiresIn: '15m',
      },
    );
  });

  it('rejects invalid credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(user);
    const service = createService();

    await expect(
      service.login({
        usernameOrEmail: 'admin@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login fails when user cannot be found', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const service = createService();

    await expect(
      service.login({
        usernameOrEmail: 'missing@example.com',
        password: 'Admin123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('refresh', () => {
    async function createSession() {
      const refreshToken = refreshTokenService.createToken('session-1');
      const { secret } = refreshTokenService.parseToken(refreshToken);
      const refreshTokenHash =
        await refreshTokenService.hashSecret(secret);

      return {
        refreshToken,
        session: {
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          user,
        },
      };
    }

    it('rotates refresh token hash, updates last used time, and returns new tokens', async () => {
      const { refreshToken, session } = await createSession();
      prisma.userSession.findUnique.mockResolvedValue(session);
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      jest.spyOn(jwtService, 'signAsync').mockResolvedValueOnce('access-token');
      const service = createService();

      const result = await service.refresh(refreshToken);

      expect(result).toMatchObject({
        accessToken: 'access-token',
        refreshToken: expect.stringMatching(/^session-1\./),
        user: {
          id: 'user-1',
          email: 'admin@example.com',
          username: 'admin',
          roles: [{ code: 'admin', name: 'Admin' }],
          permissions: ['user.read'],
        },
      });
      expect(result.refreshToken).not.toBe(refreshToken);
      expect(prisma.userSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        include: { user: { include: { roles: { include: { role: true } } } } },
      });
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash: session.refreshTokenHash,
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        data: {
          refreshTokenHash: expect.any(String),
          lastUsedAt: expect.any(Date),
        },
      });
      const nextHash =
        prisma.userSession.updateMany.mock.calls[0][0].data.refreshTokenHash;
      expect(nextHash).not.toBe(session.refreshTokenHash);
      const { secret: nextSecret } = refreshTokenService.parseToken(
        result.refreshToken,
      );
      await expect(
        refreshTokenService.verifySecret(nextSecret, nextHash),
      ).resolves.toBe(true);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-1',
          sid: 'session-1',
          email: 'admin@example.com',
          username: 'admin',
        },
        {
          secret: 'access-secret',
          expiresIn: '15m',
        },
      );
    });

    it('rejects the old refresh token after rotation', async () => {
      const { refreshToken, session } = await createSession();
      const rotatedToken = refreshTokenService.createToken('session-1');
      const { secret: rotatedSecret } =
        refreshTokenService.parseToken(rotatedToken);
      prisma.userSession.findUnique.mockResolvedValue({
        ...session,
        refreshTokenHash: await refreshTokenService.hashSecret(rotatedSecret),
      });
      const service = createService();

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
    });

    it('throws unauthorized without marking token reuse when conditional update loses the race', async () => {
      const { refreshToken, session } = await createSession();
      prisma.userSession.findUnique.mockResolvedValue(session);
      prisma.userSession.updateMany.mockResolvedValue({ count: 0 });
      const service = createService();

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            revokedReason: 'token_reuse_detected',
          }),
        }),
      );
    });
  });

  describe('logout', () => {
    it('revokes an active session by session id', async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      const service = createService();

      await expect(
        service.logoutBySessionId('session-1'),
      ).resolves.toBeUndefined();

      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null },
        data: { revokedAt: expect.any(Date), revokedReason: 'logout' },
      });
    });

    it('revokes a session by refresh token when access token is absent or expired', async () => {
      const refreshToken = refreshTokenService.createToken('session-1');
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      const service = createService();

      await expect(
        service.logoutByRefreshToken(refreshToken),
      ).resolves.toBeUndefined();

      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null },
        data: { revokedAt: expect.any(Date), revokedReason: 'logout' },
      });
    });

    it('remains successful when the session is already missing', async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 0 });
      const service = createService();

      await expect(
        service.logoutBySessionId('missing-session'),
      ).resolves.toBeUndefined();
    });
  });
});
