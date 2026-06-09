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
  AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(14),
  AUTH_REFRESH_COOKIE_NAME: z.string().min(1).default('common_admin_refresh'),
  AUTH_REFRESH_COOKIE_SECURE: z
    .preprocess((value) => {
      if (value === 'true') {
        return true;
      }

      if (value === 'false') {
        return false;
      }

      return value;
    }, z.coerce.boolean())
    .default(false),
  AUTH_REFRESH_COOKIE_SAME_SITE: z
    .enum(['lax', 'strict', 'none'])
    .default('lax'),
  AUTH_REFRESH_COOKIE_DOMAIN: z.string().default(''),
  FILE_STORAGE_DRIVER: z.enum(['local']).default('local'),
  LOCAL_STORAGE_ROOT: z.string().min(1).default('./storage/uploads'),
  FILE_MAX_SIZE_MB: z.coerce.number().int().positive().default(20),
  FILE_ALLOWED_MIME_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/webp,application/pdf,text/plain')
    .transform((value, ctx) => {
      const mimeTypes = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      if (mimeTypes.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'FILE_ALLOWED_MIME_TYPES must include at least one MIME type',
        });
        return z.NEVER;
      }

      return mimeTypes.join(',');
    }),
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

  if (env.NODE_ENV === 'production' && !env.AUTH_REFRESH_COOKIE_SECURE) {
    throw new Error('AUTH_REFRESH_COOKIE_SECURE must be true in production');
  }

  if (
    env.NODE_ENV === 'production' &&
    env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .includes('*')
  ) {
    throw new Error('ALLOWED_ORIGINS cannot include wildcard in production');
  }

  return env;
}
