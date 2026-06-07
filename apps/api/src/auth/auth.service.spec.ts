import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { Role } from '../user/role.enum';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    passwordHash: '',
    role: Role.ADMIN,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const prisma = {
    user: {
      findFirst: jest.fn(),
    },
  };

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  beforeEach(async () => {
    jest.resetAllMocks();
    user.passwordHash = await bcrypt.hash('Admin123!', 4);
  });

  it('returns sanitized user and tokens for valid username or email credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(user);
    const signAsync = jest
      .spyOn(jwtService, 'signAsync')
      .mockResolvedValueOnce('access-token');

    const service = new AuthService(prisma as never, jwtService, {
      accessTokenSecret: 'access-secret',
      accessTokenExpiresIn: '15m',
    });

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
        role: Role.ADMIN,
      },
    });
    expect(signAsync).toHaveBeenCalledTimes(1);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'admin@example.com' }, { username: 'admin@example.com' }],
      },
    });
  });

  it('rejects invalid credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(user);
    const service = new AuthService(prisma as never, jwtService, {
      accessTokenSecret: 'access-secret',
      accessTokenExpiresIn: '15m',
    });

    await expect(
      service.login({
        usernameOrEmail: 'admin@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
