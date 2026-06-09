import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload } from '../user/user.types';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_TOKEN_SECRET'),
    });
  }

  async validate(payload: JwtUserPayload): Promise<JwtUserPayload> {
    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException();
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });
    const now = new Date();

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.user
    ) {
      throw new UnauthorizedException();
    }

    return {
      sub: session.user.id,
      sid: session.id,
      email: session.user.email,
      username: session.user.username,
    };
  }
}
