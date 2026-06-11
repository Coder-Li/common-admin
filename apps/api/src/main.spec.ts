import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('main bootstrap', () => {
  it('handles the bootstrap promise with void and catch', () => {
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');

    expect(mainSource).toMatch(/void\s+bootstrap\(\)\.catch\(/);
  });

  it('registers the global exception filter from the Nest container', () => {
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');

    expect(mainSource).toContain(
      "import { GlobalExceptionFilter } from './common/errors/exception-filter';",
    );
    expect(mainSource).toMatch(
      /app\.useGlobalFilters\(app\.get\(GlobalExceptionFilter\)\);/,
    );
  });

  it('uses AppException for validation pipe failures', () => {
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');

    expect(mainSource).toContain(
      "import { AppException } from './common/errors/app-exception';",
    );
    expect(mainSource).toContain(
      "import { ERROR_CODES } from './common/errors/error-codes';",
    );
    expect(mainSource).toContain(
      "import { flattenValidationErrors } from './common/errors/validation-errors';",
    );
    expect(mainSource).toMatch(
      /exceptionFactory:\s*\(errors\)\s*=>\s*new AppException\(\{/,
    );
    expect(mainSource).toContain('code: ERROR_CODES.VALIDATION_ERROR');
    expect(mainSource).toContain("message: 'Request validation failed'");
    expect(mainSource).toContain(
      'details: { fields: flattenValidationErrors(errors) }',
    );
  });
});
