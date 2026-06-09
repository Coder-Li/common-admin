import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { AuthOriginGuard } from './auth-origin.guard';

describe('AuthOriginGuard', () => {
  const configService = {
    getOrThrow: jest.fn(),
  };

  const createGuard = () => new AuthOriginGuard(configService as never);

  const createContext = (origin?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: origin === undefined ? {} : { origin },
          cookies: {},
        }),
      }),
    }) as unknown as ExecutionContext;

  const createContextWithCookie = (origin?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: origin === undefined ? {} : { origin },
          cookies: { common_admin_refresh: 'session.secret' },
        }),
      }),
    }) as unknown as ExecutionContext;

  const createContextWithUnrelatedCookie = () =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          cookies: { analytics_session: 'opaque' },
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    configService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'ALLOWED_ORIGINS') {
        return 'http://localhost:5173, https://admin.example.com';
      }

      if (key === 'AUTH_REFRESH_COOKIE_NAME') {
        return 'common_admin_refresh';
      }

      throw new Error(`Unexpected config key: ${key}`);
    });
  });

  it('allows configured browser origins', () => {
    expect(
      createGuard().canActivate(createContext('http://localhost:5173')),
    ).toBe(true);
  });

  it('rejects unexpected browser origins', () => {
    expect(() =>
      createGuard().canActivate(createContext('http://evil.example')),
    ).toThrow(new ForbiddenException('Origin is not allowed'));
  });

  it('allows requests without origin headers', () => {
    expect(createGuard().canActivate(createContext())).toBe(true);
  });

  it('rejects requests without origin headers when refresh cookie is present', () => {
    expect(() => createGuard().canActivate(createContextWithCookie())).toThrow(
      new ForbiddenException('Origin is required for cookie auth endpoints'),
    );
  });

  it('allows requests without origin headers when only unrelated cookies are present', () => {
    expect(createGuard().canActivate(createContextWithUnrelatedCookie())).toBe(
      true,
    );
  });
});
