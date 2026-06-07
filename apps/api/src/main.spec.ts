import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('main bootstrap', () => {
  it('handles the bootstrap promise with void and catch', () => {
    const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');

    expect(mainSource).toMatch(/void\s+bootstrap\(\)\.catch\(/);
  });
});
