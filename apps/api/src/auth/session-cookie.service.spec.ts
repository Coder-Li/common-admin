import { SessionCookieService } from './session-cookie.service';
import type { AuthTokenConfig } from '../config/auth.config';

describe('SessionCookieService', () => {
  const config: AuthTokenConfig = {
    accessTokenSecret: 'access-secret',
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresInDays: 14,
    refreshCookieName: 'refreshToken',
    refreshCookieSecure: false,
    refreshCookieSameSite: 'lax',
    refreshCookieDomain: '',
  };

  let service: SessionCookieService;
  let response: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };

  beforeEach(() => {
    service = new SessionCookieService(config);
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
  });

  it('sets refresh cookies with secure http-only options', () => {
    service.setRefreshCookie(response as never, 'refresh-token');

    expect(response.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 14 * 24 * 60 * 60 * 1000,
      },
    );
  });

  it('clears refresh cookies with matching options', () => {
    service.clearRefreshCookie(response as never);

    expect(response.clearCookie).toHaveBeenCalledWith('refreshToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/auth',
    });
  });
});
