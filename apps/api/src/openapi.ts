import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ErrorResponseDto } from './common/errors/error-response.dto';

export function createOpenApiDocument(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Common Admin API')
    .setDescription('API for the common admin starter template')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: true,
    extraModels: [ErrorResponseDto],
  });
  assertPrefixFreeOpenApiPaths(document);

  return document;
}

export function assertPrefixFreeOpenApiPaths(document: {
  paths?: Record<string, unknown>;
}) {
  const prefixedPath = Object.keys(document.paths ?? {}).find((path) =>
    path.startsWith('/api/'),
  );

  if (prefixedPath) {
    throw new Error(
      `Generated OpenAPI paths must not include the runtime API prefix: ${prefixedPath}`,
    );
  }
}
