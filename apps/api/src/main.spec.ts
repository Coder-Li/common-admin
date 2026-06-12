import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('main bootstrap', () => {
  it('handles the bootstrap promise with void and catch', () => {
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');

    expect(mainSource).toMatch(/void\s+bootstrap\(\)\.catch\(/);
    expect(mainSource).toContain('console.error(error);');
  });

  it('buffers bootstrap logs and switches to the nestjs-pino logger', () => {
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');

    expect(mainSource).toContain("import { Logger } from 'nestjs-pino';");
    expect(mainSource).toMatch(
      /NestFactory\.create\(AppModule,\s*\{\s*bufferLogs:\s*true\s*\}\)/,
    );
    expect(mainSource).toMatch(/app\.useLogger\(app\.get\(Logger\)\);/);
  });

  it('delegates shared HTTP setup and keeps Swagger setup in main', () => {
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');

    expect(mainSource).toContain("import { configureApp } from './app.setup';");
    expect(mainSource).toMatch(/configureApp\(app,\s*configService\);/);
    expect(mainSource).toContain(
      'const document = createOpenApiDocument(app);',
    );
    expect(mainSource).toContain(
      "SwaggerModule.setup('api/docs', app, document);",
    );
  });

  it('registers the global exception filter from the Nest container', () => {
    const appSetupSource = readFileSync(join(__dirname, 'app.setup.ts'), 'utf8');

    expect(appSetupSource).toContain(
      "import { GlobalExceptionFilter } from './common/errors/exception-filter';",
    );
    expect(appSetupSource).toMatch(
      /app\.useGlobalFilters\(app\.get\(GlobalExceptionFilter\)\);/,
    );
  });

  it('uses AppException for validation pipe failures', () => {
    const appSetupSource = readFileSync(join(__dirname, 'app.setup.ts'), 'utf8');

    expect(appSetupSource).toContain(
      "import { AppException } from './common/errors/app-exception';",
    );
    expect(appSetupSource).toContain(
      "import { ERROR_CODES } from './common/errors/error-codes';",
    );
    expect(appSetupSource).toContain(
      "import { flattenValidationErrors } from './common/errors/validation-errors';",
    );
    expect(appSetupSource).toMatch(
      /exceptionFactory:\s*\(errors\)\s*=>\s*new AppException\(\{/,
    );
    expect(appSetupSource).toContain('code: ERROR_CODES.VALIDATION_ERROR');
    expect(appSetupSource).toContain("message: 'Request validation failed'");
    expect(appSetupSource).toContain(
      'details: { fields: flattenValidationErrors(errors) }',
    );
  });

  it('allows and exposes request id CORS headers', () => {
    const appSetupSource = readFileSync(join(__dirname, 'app.setup.ts'), 'utf8');

    expect(appSetupSource).toContain(
      "allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']",
    );
    expect(appSetupSource).toContain("exposedHeaders: ['x-request-id']");
  });
});
