import type { JwtSignOptions } from '@nestjs/jwt';

export type RefreshCookieSameSite = 'lax' | 'strict' | 'none';

export interface AuthTokenConfig {
  accessTokenSecret: string;
  accessTokenExpiresIn: JwtSignOptions['expiresIn'];
  refreshTokenExpiresInDays: number;
  refreshCookieName: string;
  refreshCookieSecure: boolean;
  refreshCookieSameSite: RefreshCookieSameSite;
  refreshCookieDomain: string;
}

export const AUTH_TOKEN_CONFIG = Symbol('AUTH_TOKEN_CONFIG');
