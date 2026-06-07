import type { JwtSignOptions } from '@nestjs/jwt';

export interface AuthTokenConfig {
  accessTokenSecret: string;
  accessTokenExpiresIn: JwtSignOptions['expiresIn'];
}

export const AUTH_TOKEN_CONFIG = Symbol('AUTH_TOKEN_CONFIG');
