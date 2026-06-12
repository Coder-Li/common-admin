import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { IS_PUBLIC_KEY } from '../common/decorators/is-public.decorator';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsModule } from './diagnostics.module';

describe('DiagnosticsController', () => {
  const originalDiagnosticFlag = process.env.ENABLE_DIAGNOSTIC_ERROR_ENDPOINT;
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;

    if (originalDiagnosticFlag === undefined) {
      delete process.env.ENABLE_DIAGNOSTIC_ERROR_ENDPOINT;
    } else {
      process.env.ENABLE_DIAGNOSTIC_ERROR_ENDPOINT = originalDiagnosticFlag;
    }
  });

  async function createDiagnosticsApp(enabled: boolean) {
    process.env.ENABLE_DIAGNOSTIC_ERROR_ENDPOINT = enabled ? 'true' : 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [DiagnosticsModule.register()],
    }).compile();
    const nestApp = moduleRef.createNestApplication();

    await nestApp.init();
    app = nestApp;

    return {
      app: nestApp,
      httpServer: nestApp.getHttpServer() as Server,
      moduleRef,
    };
  }

  it('does not register diagnostics routes when disabled', async () => {
    const { httpServer } = await createDiagnosticsApp(false);

    await request(httpServer).get('/diagnostics/error').expect(404);
  });

  it('throws a normal Error when enabled', async () => {
    const { moduleRef } = await createDiagnosticsApp(true);
    const controller = moduleRef.get(DiagnosticsController);

    expect(() => controller.throwError()).toThrow(
      new Error('Diagnostic error'),
    );
  });

  it('marks only the diagnostic error route as public', async () => {
    const { moduleRef } = await createDiagnosticsApp(true);
    const reflector = moduleRef.get(Reflector);
    const handler = Object.getOwnPropertyDescriptor(
      DiagnosticsController.prototype,
      'throwError',
    )?.value as DiagnosticsController['throwError'];

    expect(reflector.get(IS_PUBLIC_KEY, DiagnosticsController)).toBeUndefined();
    expect(reflector.get(IS_PUBLIC_KEY, handler)).toBe(true);
  });
});
