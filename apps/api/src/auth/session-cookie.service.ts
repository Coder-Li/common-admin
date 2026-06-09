import { Inject, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AUTH_TOKEN_CONFIG } from '../config/auth.config';
import type { AuthTokenConfig } from '../config/auth.config';

@Injectable()
export class SessionCookieService {
  constructor(
    @Inject(AUTH_TOKEN_CONFIG) private readonly config: AuthTokenConfig,
  ) {}

  setRefreshCookie(response: Response, token: string) {
    response.cookie(this.config.refreshCookieName, token, this.cookieOptions());
  }

  clearRefreshCookie(response: Response) {
    response.clearCookie(this.config.refreshCookieName, this.clearOptions());
  }

  private cookieOptions() {
    const options = {
      httpOnly: true,
      secure: this.config.refreshCookieSecure,
      sameSite: this.config.refreshCookieSameSite,
      path: '/api/auth',
      maxAge: this.config.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
      ...(this.config.refreshCookieDomain
        ? { domain: this.config.refreshCookieDomain }
        : {}),
    } as const;

    return options;
  }

  private clearOptions() {
    return {
      httpOnly: true,
      secure: this.config.refreshCookieSecure,
      sameSite: this.config.refreshCookieSameSite,
      path: '/api/auth',
      ...(this.config.refreshCookieDomain
        ? { domain: this.config.refreshCookieDomain }
        : {}),
    } as const;
  }
}
