import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  assertPrefixFreeOpenApiPaths,
  createOpenApiDocument,
} from '../src/openapi';

process.env.NODE_ENV ??= 'test';

async function generateOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  try {
    const document = createOpenApiDocument(app);
    assertPrefixFreeOpenApiPaths(document);

    const outputPath = resolve(__dirname, '../openapi.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

generateOpenApi().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
