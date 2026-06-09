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

  beforeEach(() => {
    jest.resetAllMocks();
    configService.getOrThrow.mockReturnValue(
      'http://localhost:5173, https://admin.example.com',
    );
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
});
