import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AUTH_TOKEN_CONFIG } from '../config/auth.config';
import type { AuthTokenConfig } from '../config/auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { toUserProfile } from '../user/user.mapper';
import { JwtUserPayload, UserProfile } from '../user/user.types';
import { LoginDto } from './dto/login.dto';

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(AUTH_TOKEN_CONFIG)
    private readonly tokenConfig: AuthTokenConfig,
  ) {}

  async login(credentials: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: credentials.usernameOrEmail },
          { username: credentials.usernameOrEmail },
        ],
      },
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

    const profile = toUserProfile(user);
    const payload: JwtUserPayload = {
      ...profile,
      sub: profile.id,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.tokenConfig.accessTokenSecret,
      expiresIn: this.tokenConfig.accessTokenExpiresIn,
    });

    return { accessToken, user: profile };
  }
}
