import { sanitizeAuditPayload } from './audit-log.sanitizer';

describe('sanitizeAuditPayload', () => {
  it('redacts sensitive keys recursively', () => {
    expect(
      sanitizeAuditPayload({
        email: 'admin@example.com',
        password: 'secret',
        profile: {
          refreshTokenHash: 'hash',
          sessions: [
            {
              apiKey: 'api-key',
              device: 'Chrome',
            },
          ],
        },
      }),
    ).toEqual({
      email: 'admin@example.com',
      password: '[REDACTED]',
      profile: {
        refreshTokenHash: '[REDACTED]',
        sessions: [
          {
            apiKey: '[REDACTED]',
            device: 'Chrome',
          },
        ],
      },
    });
  });

  it('redacts file storage fields while preserving display name', () => {
    expect(
      sanitizeAuditPayload({
        displayName: 'Quarterly Report.pdf',
        bucket: 'private-files',
        objectKey: 'uploads/report.pdf',
        checksum: 'sha256',
      }),
    ).toEqual({
      displayName: 'Quarterly Report.pdf',
      bucket: '[REDACTED]',
      objectKey: '[REDACTED]',
      checksum: '[REDACTED]',
    });
  });

  it('preserves null and primitive values', () => {
    expect(sanitizeAuditPayload(null)).toBeNull();
    expect(sanitizeAuditPayload('created')).toBe('created');
    expect(sanitizeAuditPayload(1)).toBe(1);
    expect(sanitizeAuditPayload(true)).toBe(true);
  });
});
