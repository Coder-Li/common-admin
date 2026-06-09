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
        AUTH_REFRESH_COOKIE_SECURE: 'true',
      }).JWT_ACCESS_TOKEN_SECRET,
    ).toBe('production-secret-change-me');
  });

  it('provides auth refresh defaults', () => {
    const env = validateEnv({});

    expect(env.AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS).toBe(14);
    expect(env.AUTH_REFRESH_COOKIE_NAME).toBe('common_admin_refresh');
    expect(env.AUTH_REFRESH_COOKIE_SECURE).toBe(false);
    expect(env.AUTH_REFRESH_COOKIE_SAME_SITE).toBe('lax');
    expect(env.AUTH_REFRESH_COOKIE_DOMAIN).toBe('');
  });

  it('rejects sameSite none without secure cookies in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
        AUTH_REFRESH_COOKIE_SAME_SITE: 'none',
        AUTH_REFRESH_COOKIE_SECURE: 'false',
      }),
    ).toThrow('AUTH_REFRESH_COOKIE_SECURE must be true');
  });

  it('rejects insecure refresh cookies in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
        AUTH_REFRESH_COOKIE_SECURE: 'false',
      }),
    ).toThrow('AUTH_REFRESH_COOKIE_SECURE must be true in production');
  });

  it('rejects wildcard allowed origins in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
        AUTH_REFRESH_COOKIE_SECURE: 'true',
        ALLOWED_ORIGINS: '*',
      }),
    ).toThrow('ALLOWED_ORIGINS cannot include wildcard');
  });

  it('includes local file storage defaults', () => {
    expect(validateEnv({})).toMatchObject({
      FILE_STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_ROOT: './storage/uploads',
      FILE_MAX_SIZE_MB: 20,
      FILE_ALLOWED_MIME_TYPES:
        'image/jpeg,image/png,image/webp,application/pdf,text/plain',
    });
  });

  it('rejects oss as a file storage driver in v1', () => {
    expect(() => validateEnv({ FILE_STORAGE_DRIVER: 'oss' })).toThrow();
  });

  it('rejects a non-positive max file size', () => {
    expect(() => validateEnv({ FILE_MAX_SIZE_MB: '0' })).toThrow();
  });

  it('rejects an empty allowed MIME type list', () => {
    expect(() => validateEnv({ FILE_ALLOWED_MIME_TYPES: '' })).toThrow(
      'FILE_ALLOWED_MIME_TYPES must include at least one MIME type',
    );
  });

  it('normalizes away blank MIME entries', () => {
    expect(
      validateEnv({
        FILE_ALLOWED_MIME_TYPES: 'image/jpeg,, image/png',
      }).FILE_ALLOWED_MIME_TYPES,
    ).toBe('image/jpeg,image/png');
  });

  it('accepts comma-separated MIME values', () => {
    expect(
      validateEnv({
        FILE_ALLOWED_MIME_TYPES: 'image/jpeg,image/png,application/pdf',
      }).FILE_ALLOWED_MIME_TYPES,
    ).toBe('image/jpeg,image/png,application/pdf');
  });
});
