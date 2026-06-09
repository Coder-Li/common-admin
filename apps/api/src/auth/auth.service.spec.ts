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

  it('returns sanitized user and tokens for valid username or email credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(user);
    const signAsync = jest
      .spyOn(jwtService, 'signAsync')
      .mockResolvedValueOnce('access-token');

    const service = new AuthService(
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
    const service = new AuthService(
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

    await expect(
      service.login({
        usernameOrEmail: 'admin@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login fails when user cannot be found', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const service = new AuthService(
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

    await expect(
      service.login({
        usernameOrEmail: 'missing@example.com',
        password: 'Admin123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
