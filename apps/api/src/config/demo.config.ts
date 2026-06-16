import { ConfigService } from '@nestjs/config';

export const DEFAULT_ADMIN_EMAIL = 'admin@example.com';

export interface DemoModeConfig {
  demoMode: boolean;
  defaultAdminEmail: string;
}

export const DEMO_MODE_CONFIG = Symbol('DEMO_MODE_CONFIG');

export function createDemoModeConfig(
  configService: ConfigService,
): DemoModeConfig {
  return {
    demoMode: configService.getOrThrow<boolean>('DEMO_MODE'),
    defaultAdminEmail: DEFAULT_ADMIN_EMAIL,
  };
}

export function isProtectedDefaultAdminEmail(
  email: string | null | undefined,
  config: DemoModeConfig,
): boolean {
  return (
    config.demoMode &&
    email?.toLowerCase() === config.defaultAdminEmail.toLowerCase()
  );
}
