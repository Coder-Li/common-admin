/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { RefreshTokenService } from './refresh-token.service';

describe('RefreshTokenService', () => {
  const service = new RefreshTokenService();

  it('creates parseable session-bound tokens', async () => {
    const token = service.createToken('session-1');

    expect(service.parseToken(token)).toEqual({
      sessionId: 'session-1',
      secret: expect.any(String),
    });
  });

  it('hashes and verifies secrets without storing raw tokens', async () => {
    const token = service.createToken('session-1');
    const parsed = service.parseToken(token);
    const hash = await service.hashSecret(parsed.secret);

    await expect(service.verifySecret(parsed.secret, hash)).resolves.toBe(true);
    await expect(service.verifySecret('wrong-secret', hash)).resolves.toBe(
      false,
    );
  });

  it('rejects malformed tokens', () => {
    expect(() => service.parseToken('broken')).toThrow('Invalid refresh token');
  });
});
