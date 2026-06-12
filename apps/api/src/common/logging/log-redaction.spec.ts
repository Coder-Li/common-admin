import { LOG_REDACTION_PATHS } from './log-redaction';

describe('LOG_REDACTION_PATHS', () => {
  it('redacts sensitive headers and auth credential fields', () => {
    expect(LOG_REDACTION_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        'password',
        'oldPassword',
        'newPassword',
        'accessToken',
        'refreshToken',
      ]),
    );
  });
});
