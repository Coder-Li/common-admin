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

  constructor(configService: ConfigService) {
    this.allowedOrigins = new Set(
      configService
        .getOrThrow<string>('ALLOWED_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      cookies?: Record<string, string | undefined>;
    }>();
    const origin = request.headers.origin;

    if (!origin) {
      if (Object.keys(request.cookies ?? {}).length > 0) {
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
