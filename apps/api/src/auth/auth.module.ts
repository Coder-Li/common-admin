import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH_TOKEN_CONFIG } from '../config/auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './jwt-access.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
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
      }),
    },
  ],
})
export class AuthModule {}
