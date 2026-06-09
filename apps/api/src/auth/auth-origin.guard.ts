import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;
  private readonly refreshCookieName: string;

  constructor(configService: ConfigService) {
    this.allowedOrigins = new Set(
      configService
        .getOrThrow<string>('ALLOWED_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
    this.refreshCookieName = configService.getOrThrow<string>(
      'AUTH_REFRESH_COOKIE_NAME',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      cookies?: Record<string, string | undefined>;
    }>();
    const origin = request.headers.origin;

    if (!origin) {
      if (request.cookies?.[this.refreshCookieName]) {
        throw new ForbiddenException(
          'Origin is required for cookie auth endpoints',
        );
      }

      return true;
    }

    if (!this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Origin is not allowed');
    }

    return true;
  }
}
