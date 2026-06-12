import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule, type Params } from 'nestjs-pino';

import type { AppEnv } from '../../config/env.config';
import { LOG_REDACTION_PATHS } from './log-redaction';
import { getRequestLogContext } from './request-context';

type LoggingEnv = Pick<
  AppEnv,
  'LOG_LEVEL' | 'LOG_PRETTY' | 'SERVICE_NAME' | 'APP_ENV'
>;

export function createPinoHttpOptions(env: LoggingEnv): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      base: {
        service: env.SERVICE_NAME,
        env: env.APP_ENV,
      },
      redact: {
        paths: LOG_REDACTION_PATHS,
        censor: '[Redacted]',
      },
      transport: env.LOG_PRETTY
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:standard',
            },
          }
        : undefined,
      customProps: (request) => getRequestLogContext(request),
      customAttributeKeys: {
        req: 'req',
        res: 'res',
        err: 'err',
        responseTime: 'durationMs',
      },
      customLogLevel: (_request, response, error) => {
        if (error || response.statusCode >= 500) {
          return 'error';
        }
        if (response.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      customSuccessMessage: () => 'request completed',
      customSuccessObject: (_request, response, value) =>
        withStatusCode(value, response.statusCode),
      customErrorObject: (_request, response, _error, value) =>
        withStatusCode(value, response.statusCode),
    },
  };
}

function withStatusCode(value: unknown, statusCode: number) {
  return {
    ...(isRecord(value) ? value : {}),
    statusCode,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnv, true>) =>
        createPinoHttpOptions({
          LOG_LEVEL: configService.getOrThrow('LOG_LEVEL'),
          LOG_PRETTY: configService.getOrThrow('LOG_PRETTY'),
          SERVICE_NAME: configService.getOrThrow('SERVICE_NAME'),
          APP_ENV: configService.getOrThrow('APP_ENV'),
        }),
    }),
  ],
})
export class LoggingModule {}
