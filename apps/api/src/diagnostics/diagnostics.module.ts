import { DynamicModule, Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';

@Module({})
export class DiagnosticsModule {
  static register(): DynamicModule {
    const diagnosticsEnabled =
      process.env.ENABLE_DIAGNOSTIC_ERROR_ENDPOINT === 'true';

    return {
      module: DiagnosticsModule,
      controllers: diagnosticsEnabled ? [DiagnosticsController] : [],
    };
  }
}
