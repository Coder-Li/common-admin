import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppException } from './common/errors/app-exception';
import { ERROR_CODES } from './common/errors/error-codes';
import { GlobalExceptionFilter } from './common/errors/exception-filter';
import { flattenValidationErrors } from './common/errors/validation-errors';

export function configureApp(
  app: INestApplication,
  configService: ConfigService,
) {
  const allowedOrigins = configService
    .getOrThrow<string>('ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.useGlobalFilters(app.get(GlobalExceptionFilter));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new AppException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Request validation failed',
          statusCode: 400,
          details: { fields: flattenValidationErrors(errors) },
        }),
    }),
  );
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });
  app.setGlobalPrefix('api');
}
