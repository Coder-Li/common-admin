import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5432/common_admin'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_ACCESS_TOKEN_SECRET: z
    .string()
    .min(16)
    .default('local-access-secret-change-me'),
  JWT_ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const env = envSchema.parse(config);

  if (
    env.NODE_ENV === 'production' &&
    env.JWT_ACCESS_TOKEN_SECRET === 'local-access-secret-change-me'
  ) {
    throw new Error('JWT_ACCESS_TOKEN_SECRET must be configured in production');
  }

  return env;
}
