import { validateEnv } from './env.config';

describe('validateEnv', () => {
  it('rejects the default local access token secret in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'local-access-secret-change-me',
      }),
    ).toThrow('JWT_ACCESS_TOKEN_SECRET must be configured in production');
  });

  it('allows an explicit production access token secret', () => {
    expect(
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
      }).JWT_ACCESS_TOKEN_SECRET,
    ).toBe('production-secret-change-me');
  });
});
