import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import {
  AUTH_TOKEN_CONFIG,
  RefreshCookieSameSite,
} from '../config/auth.config';
import { PermissionModule } from '../permission/permission.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { RefreshTokenService } from './refresh-token.service';
import { SessionCookieService } from './session-cookie.service';

@Module({
  imports: [PassportModule, JwtModule.register({}), PermissionModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
    RefreshTokenService,
    SessionCookieService,
    {
      provide: AUTH_TOKEN_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        accessTokenSecret: configService.getOrThrow<string>(
          'JWT_ACCESS_TOKEN_SECRET',
        ),
        accessTokenExpiresIn: configService.getOrThrow<string>(
          'JWT_ACCESS_TOKEN_EXPIRES_IN',
        ),
        refreshTokenExpiresInDays: configService.getOrThrow<number>(
          'AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS',
        ),
        refreshCookieName: configService.getOrThrow<string>(
          'AUTH_REFRESH_COOKIE_NAME',
        ),
        refreshCookieSecure: configService.getOrThrow<boolean>(
          'AUTH_REFRESH_COOKIE_SECURE',
        ),
        refreshCookieSameSite: configService.getOrThrow<RefreshCookieSameSite>(
          'AUTH_REFRESH_COOKIE_SAME_SITE',
        ),
        refreshCookieDomain: configService.getOrThrow<string>(
          'AUTH_REFRESH_COOKIE_DOMAIN',
        ),
      }),
    },
  ],
})
export class AuthModule {}
