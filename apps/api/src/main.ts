import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppException } from './common/errors/app-exception';
import { ERROR_CODES } from './common/errors/error-codes';
import { GlobalExceptionFilter } from './common/errors/exception-filter';
import { flattenValidationErrors } from './common/errors/validation-errors';
import { createOpenApiDocument } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const configService = app.get(ConfigService);
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

  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(configService.getOrThrow<number>('PORT'), '0.0.0.0');
}
void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
