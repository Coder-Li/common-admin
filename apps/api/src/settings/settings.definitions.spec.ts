import {
  getDefaultBasicSettings,
  getDefaultUploadSettings,
  getEffectiveUploadPolicyFromSettings,
  parseAllowedMimeTypes,
  validateBasicSettingsInput,
  validateStoredSettingValue,
  validateUploadSettingsInput,
} from './settings.definitions';

const env = {
  SERVICE_NAME: 'api',
  APP_ENV: 'test',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  FILE_STORAGE_DRIVER: 'local',
  FILE_MAX_SIZE_MB: 20,
  FILE_ALLOWED_MIME_TYPES: 'image/png,application/pdf,text/plain',
} as const;

describe('settings definitions', () => {
  it('returns concrete defaults from env', () => {
    expect(getDefaultBasicSettings()).toEqual({
      siteName: 'Common Admin',
      siteSubtitle: 'Starter template',
      defaultLocale: 'zh-CN',
      defaultTheme: 'light',
    });
    expect(getDefaultUploadSettings(env)).toEqual({
      maxSizeMb: 20,
      allowedMimeTypes: ['image/png', 'application/pdf', 'text/plain'],
    });
  });

  it('validates and trims basic settings input', () => {
    expect(
      validateBasicSettingsInput({
        siteName: '  Admin  ',
        siteSubtitle: '  Console  ',
        defaultLocale: 'en-US',
        defaultTheme: 'dark',
      }),
    ).toEqual({
      siteName: 'Admin',
      siteSubtitle: 'Console',
      defaultLocale: 'en-US',
      defaultTheme: 'dark',
    });
  });

  it('rejects invalid basic settings input', () => {
    expect(() =>
      validateBasicSettingsInput({
        siteName: '',
        siteSubtitle: '',
        defaultLocale: 'fr-FR',
        defaultTheme: 'system',
      }),
    ).toThrow();
  });

  it('requires upload settings to stay within env constraints', () => {
    expect(
      validateUploadSettingsInput(
        {
          maxSizeMb: 10,
          allowedMimeTypes: ['image/png', 'text/plain'],
        },
        env,
      ),
    ).toEqual({
      maxSizeMb: 10,
      allowedMimeTypes: ['image/png', 'text/plain'],
    });
    expect(() =>
      validateUploadSettingsInput(
        { maxSizeMb: 21, allowedMimeTypes: ['image/png'] },
        env,
      ),
    ).toThrow('maxSizeMb');
    expect(() =>
      validateUploadSettingsInput(
        { maxSizeMb: 10, allowedMimeTypes: ['application/zip'] },
        env,
      ),
    ).toThrow('allowedMimeTypes');
  });

  it('falls back on invalid stored setting values', () => {
    expect(
      validateStoredSettingValue('basic.defaultLocale', 'fr-FR', env),
    ).toEqual({ ok: false, value: 'zh-CN' });
  });

  it('builds an effective upload policy in bytes and MIME set', () => {
    expect(
      getEffectiveUploadPolicyFromSettings(
        { maxSizeMb: 5, allowedMimeTypes: ['image/png'] },
        env,
      ),
    ).toEqual({
      maxSizeMb: 5,
      maxSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/png'],
      allowedMimeTypeSet: new Set(['image/png']),
    });
  });

  it('parses normalized environment MIME types', () => {
    expect(parseAllowedMimeTypes(' image/png, text/plain ,,')).toEqual([
      'image/png',
      'text/plain',
    ]);
  });
});
