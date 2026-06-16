import { validateEnv } from './env.config';

describe('validateEnv', () => {
  it('rejects the default local access token secret in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'local-access-secret-change-me',
        AUTH_REFRESH_COOKIE_SECURE: 'true',
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

  it('uses local admin and API defaults that stay connected', () => {
    expect(validateEnv({})).toMatchObject({
      PORT: 13001,
      ALLOWED_ORIGINS: 'http://localhost:15173,http://127.0.0.1:15173',
    });
  });

  it('provides logging and application defaults', () => {
    expect(validateEnv({}).LOG_LEVEL).toBe('debug');
    expect(validateEnv({}).LOG_PRETTY).toBe(true);
    expect(validateEnv({ NODE_ENV: 'test' }).LOG_LEVEL).toBe('silent');
    expect(
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'configured-secret-123',
        AUTH_REFRESH_COOKIE_SECURE: 'true',
      }).LOG_LEVEL,
    ).toBe('info');
    expect(
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'configured-secret-123',
        AUTH_REFRESH_COOKIE_SECURE: 'true',
      }).LOG_PRETTY,
    ).toBe(false);
    expect(validateEnv({}).SERVICE_NAME).toBe('api');
    expect(validateEnv({}).APP_ENV).toBe('development');
    expect(validateEnv({}).ENABLE_DIAGNOSTIC_ERROR_ENDPOINT).toBe(false);
    expect(validateEnv({}).DEMO_MODE).toBe(false);
    expect(validateEnv({ DEMO_MODE: 'true' }).DEMO_MODE).toBe(true);
    expect(
      validateEnv({ ENABLE_DIAGNOSTIC_ERROR_ENDPOINT: 'true' })
        .ENABLE_DIAGNOSTIC_ERROR_ENDPOINT,
    ).toBe(true);
    expect(
      validateEnv({ ENABLE_DIAGNOSTIC_ERROR_ENDPOINT: '0' })
        .ENABLE_DIAGNOSTIC_ERROR_ENDPOINT,
    ).toBe(false);
    expect(
      validateEnv({ ENABLE_DIAGNOSTIC_ERROR_ENDPOINT: 'yes' })
        .ENABLE_DIAGNOSTIC_ERROR_ENDPOINT,
    ).toBe(false);
  });

  it('allows sameSite none with secure cookies in production', () => {
    expect(
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
        AUTH_REFRESH_COOKIE_SAME_SITE: 'none',
        AUTH_REFRESH_COOKIE_SECURE: 'true',
      }).AUTH_REFRESH_COOKIE_SAME_SITE,
    ).toBe('none');
  });

  it('rejects sameSite none without secure cookies', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
        AUTH_REFRESH_COOKIE_SAME_SITE: 'none',
        AUTH_REFRESH_COOKIE_SECURE: 'false',
      }),
    ).toThrow(
      'AUTH_REFRESH_COOKIE_SECURE must be true when AUTH_REFRESH_COOKIE_SAME_SITE is none',
    );
  });

  it('allows insecure refresh cookies in production when explicitly configured for HTTP deployments', () => {
    expect(
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
        AUTH_REFRESH_COOKIE_SECURE: 'false',
        ALLOWED_ORIGINS: 'http://localhost:8080',
      }).AUTH_REFRESH_COOKIE_SECURE,
    ).toBe(false);
  });

  it('requires refresh cookie secure mode to be explicit in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
        ALLOWED_ORIGINS: 'http://localhost:8080',
      }),
    ).toThrow(
      'AUTH_REFRESH_COOKIE_SECURE must be explicitly configured in production',
    );
  });

  it('rejects insecure refresh cookies in production for non-HTTP origins', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_TOKEN_SECRET: 'production-secret-change-me',
        AUTH_REFRESH_COOKIE_SECURE: 'false',
        ALLOWED_ORIGINS: 'https://admin.example.com',
      }),
    ).toThrow(
      'AUTH_REFRESH_COOKIE_SECURE=false is only allowed with HTTP origins',
    );
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
