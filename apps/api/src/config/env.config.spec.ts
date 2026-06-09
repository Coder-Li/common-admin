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
