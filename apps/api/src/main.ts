import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { configureApp } from './app.setup';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const configService = app.get(ConfigService);

  configureApp(app, configService);

  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(configService.getOrThrow<number>('PORT'), '0.0.0.0');
}
void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
