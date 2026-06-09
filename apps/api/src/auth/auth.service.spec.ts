import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

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
  };

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;
  const permissionService = {
    resolveUserPermissionContext: jest.fn(),
  };

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
      {
        accessTokenSecret: 'access-secret',
        accessTokenExpiresIn: '15m',
      },
    );

    const result = await service.login({
      usernameOrEmail: 'admin@example.com',
      password: 'Admin123!',
    });

    expect(result).toEqual({
      accessToken: 'access-token',
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
      {
        accessTokenSecret: 'access-secret',
        accessTokenExpiresIn: '15m',
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
      {
        accessTokenSecret: 'access-secret',
        accessTokenExpiresIn: '15m',
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
