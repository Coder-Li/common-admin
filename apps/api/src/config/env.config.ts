import { z } from 'zod';

function parseBooleanLike(value: unknown): unknown {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}

function parseExplicitTrue(value: unknown): boolean {
  return value === true || value === 'true';
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional(),
  LOG_PRETTY: z.preprocess(parseBooleanLike, z.coerce.boolean()).optional(),
  SERVICE_NAME: z.string().min(1).default('api'),
  APP_ENV: z.string().min(1).optional(),
  ENABLE_DIAGNOSTIC_ERROR_ENDPOINT: z
    .preprocess(parseExplicitTrue, z.boolean())
    .default(false),
  DEMO_MODE: z.preprocess(parseExplicitTrue, z.boolean()).default(false),
  PORT: z.coerce.number().int().positive().default(13001),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5432/common_admin'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:15173,http://127.0.0.1:15173'),
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
    .preprocess(parseBooleanLike, z.coerce.boolean())
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

type LogLevel = NonNullable<z.infer<typeof envSchema>['LOG_LEVEL']>;

export type AppEnv = z.infer<typeof envSchema> & {
  LOG_LEVEL: LogLevel;
  LOG_PRETTY: boolean;
  APP_ENV: string;
};

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsedEnv = envSchema.parse(config);
  const defaultLogLevel =
    parsedEnv.NODE_ENV === 'production'
      ? 'info'
      : parsedEnv.NODE_ENV === 'test'
        ? 'silent'
        : 'debug';
  const env = {
    ...parsedEnv,
    LOG_LEVEL: parsedEnv.LOG_LEVEL ?? defaultLogLevel,
    LOG_PRETTY: parsedEnv.LOG_PRETTY ?? parsedEnv.NODE_ENV !== 'production',
    APP_ENV: parsedEnv.APP_ENV ?? parsedEnv.NODE_ENV,
  };

  if (
    env.NODE_ENV === 'production' &&
    config.AUTH_REFRESH_COOKIE_SECURE === undefined
  ) {
    throw new Error(
      'AUTH_REFRESH_COOKIE_SECURE must be explicitly configured in production',
    );
  }

  if (
    env.AUTH_REFRESH_COOKIE_SAME_SITE === 'none' &&
    !env.AUTH_REFRESH_COOKIE_SECURE
  ) {
    throw new Error(
      'AUTH_REFRESH_COOKIE_SECURE must be true when AUTH_REFRESH_COOKIE_SAME_SITE is none',
    );
  }

  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((origin) =>
    origin.trim(),
  );

  if (
    env.NODE_ENV === 'production' &&
    !env.AUTH_REFRESH_COOKIE_SECURE &&
    allowedOrigins.some((origin) => !origin.startsWith('http://'))
  ) {
    throw new Error(
      'AUTH_REFRESH_COOKIE_SECURE=false is only allowed with HTTP origins',
    );
  }

  if (
    env.NODE_ENV === 'production' &&
    env.JWT_ACCESS_TOKEN_SECRET === 'local-access-secret-change-me'
  ) {
    throw new Error('JWT_ACCESS_TOKEN_SECRET must be configured in production');
  }

  if (env.NODE_ENV === 'production' && allowedOrigins.includes('*')) {
    throw new Error('ALLOWED_ORIGINS cannot include wildcard in production');
  }

  return env;
}
