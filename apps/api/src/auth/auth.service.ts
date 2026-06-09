import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AUTH_TOKEN_CONFIG } from '../config/auth.config';
import type { AuthTokenConfig } from '../config/auth.config';
import { PermissionService } from '../permission/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { toUserProfile } from '../user/user.mapper';
import { JwtUserPayload, UserProfile } from '../user/user.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenService } from './refresh-token.service';

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

interface LoginMetadata {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly permissionService: PermissionService,
    private readonly refreshTokenService: RefreshTokenService,
    @Inject(AUTH_TOKEN_CONFIG)
    private readonly tokenConfig: AuthTokenConfig,
  ) {}

  async login(
    credentials: LoginDto,
    metadata: LoginMetadata = {},
  ): Promise<AuthResponse & { refreshToken: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: credentials.usernameOrEmail },
          { username: credentials.usernameOrEmail },
        ],
      },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await bcrypt.compare(
      credentials.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const permissionContext =
      await this.permissionService.resolveUserPermissionContext(user.id);
    const profile = toUserProfile(user, permissionContext.permissionCodes);
    const sessionId = randomUUID();
    const refreshToken = this.refreshTokenService.createToken(sessionId);
    const { secret } = this.refreshTokenService.parseToken(refreshToken);
    const refreshTokenHash =
      await this.refreshTokenService.hashSecret(secret);
    const expiresAt = new Date(
      Date.now() +
        this.tokenConfig.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: profile.id,
        refreshTokenHash,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        expiresAt,
      },
    });

    const payload: JwtUserPayload = {
      sub: profile.id,
      sid: sessionId,
      email: profile.email,
      username: profile.username,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.tokenConfig.accessTokenSecret,
      expiresIn: this.tokenConfig.accessTokenExpiresIn,
    });

    return { accessToken, refreshToken, user: profile };
  }

  async refresh(
    refreshToken: string,
  ): Promise<AuthResponse & { refreshToken: string }> {
    const { sessionId, secret } =
      this.refreshTokenService.parseToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    const now = new Date();

    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException();
    }

    const secretMatches = await this.refreshTokenService.verifySecret(
      secret,
      session.refreshTokenHash,
    );

    if (!secretMatches) {
      throw new UnauthorizedException();
    }

    const permissionContext =
      await this.permissionService.resolveUserPermissionContext(session.userId);
    const profile = toUserProfile(
      session.user,
      permissionContext.permissionCodes,
    );
    const nextRefreshToken = this.refreshTokenService.createToken(session.id);
    const { secret: nextSecret } =
      this.refreshTokenService.parseToken(nextRefreshToken);
    const nextHash = await this.refreshTokenService.hashSecret(nextSecret);
    const updateResult = await this.prisma.userSession.updateMany({
      where: {
        id: session.id,
        userId: session.userId,
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        refreshTokenHash: nextHash,
        lastUsedAt: now,
      },
    });

    if (updateResult.count !== 1) {
      throw new UnauthorizedException();
    }

    const payload: JwtUserPayload = {
      sub: profile.id,
      sid: session.id,
      email: profile.email,
      username: profile.username,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.tokenConfig.accessTokenSecret,
      expiresIn: this.tokenConfig.accessTokenExpiresIn,
    });

    return { accessToken, refreshToken: nextRefreshToken, user: profile };
  }

  async logoutBySessionId(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'logout' },
    });
  }

  async logoutByRefreshToken(refreshToken: string): Promise<void> {
    const { sessionId } = this.refreshTokenService.parseToken(refreshToken);
    await this.logoutBySessionId(sessionId);
  }
}
