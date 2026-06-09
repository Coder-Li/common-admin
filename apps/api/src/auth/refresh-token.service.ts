import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class RefreshTokenService {
  createToken(sessionId: string): string {
    const secret = randomBytes(48).toString('base64url');
    return `${sessionId}.${secret}`;
  }

  parseToken(token: string): { sessionId: string; secret: string } {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      sessionId: token.slice(0, separatorIndex),
      secret: token.slice(separatorIndex + 1),
    };
  }

  hashSecret(secret: string): Promise<string> {
    return bcrypt.hash(secret, 10);
  }

  async verifySecret(secret: string, hash: string): Promise<boolean> {
    return bcrypt.compare(secret, hash);
  }
}
