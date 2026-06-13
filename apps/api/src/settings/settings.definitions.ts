import { z } from 'zod';
import type { AppEnv } from '../config/env.config';
import { SETTING_KEYS, SETTINGS_GROUPS } from './settings.constants';

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];
export type SettingGroup =
  (typeof SETTINGS_GROUPS)[keyof typeof SETTINGS_GROUPS];
export type LocaleSetting = 'zh-CN' | 'en-US';
export type ThemeSetting = 'light' | 'dark';

export interface BasicSettings {
  siteName: string;
  siteSubtitle: string;
  defaultLocale: LocaleSetting;
  defaultTheme: ThemeSetting;
}

export interface UploadSettings {
  maxSizeMb: number;
  allowedMimeTypes: string[];
}

export interface EffectiveUploadPolicy extends UploadSettings {
  maxSizeBytes: number;
  allowedMimeTypeSet: Set<string>;
}

type UploadEnv = Pick<AppEnv, 'FILE_MAX_SIZE_MB' | 'FILE_ALLOWED_MIME_TYPES'>;

const localeSchema = z.enum(['zh-CN', 'en-US']);
const themeSchema = z.enum(['light', 'dark']);
const basicSettingsSchema = z.object({
  siteName: z.string().trim().min(1).max(80),
  siteSubtitle: z.string().trim().max(160),
  defaultLocale: localeSchema,
  defaultTheme: themeSchema,
});
const uploadSettingsSchema = z.object({
  maxSizeMb: z.number().int().positive(),
  allowedMimeTypes: z.array(z.string().trim().min(1)).min(1),
});

export function parseAllowedMimeTypes(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function getDefaultBasicSettings(): BasicSettings {
  return {
    siteName: 'Common Admin',
    siteSubtitle: 'Starter template',
    defaultLocale: 'zh-CN',
    defaultTheme: 'light',
  };
}

export function getDefaultUploadSettings(env: UploadEnv): UploadSettings {
  return {
    maxSizeMb: env.FILE_MAX_SIZE_MB,
    allowedMimeTypes: parseAllowedMimeTypes(env.FILE_ALLOWED_MIME_TYPES),
  };
}

export function validateBasicSettingsInput(input: unknown): BasicSettings {
  return basicSettingsSchema.parse(input);
}

export function validateUploadSettingsInput(
  input: unknown,
  env: UploadEnv,
): UploadSettings {
  const parsed = uploadSettingsSchema.parse(input);
  const allowedMimeTypes = Array.from(new Set(parsed.allowedMimeTypes));
  const environmentAllowed = new Set(
    parseAllowedMimeTypes(env.FILE_ALLOWED_MIME_TYPES),
  );

  if (parsed.maxSizeMb > env.FILE_MAX_SIZE_MB) {
    throw new Error('maxSizeMb must not exceed environment max');
  }

  for (const mimeType of allowedMimeTypes) {
    if (!environmentAllowed.has(mimeType)) {
      throw new Error(
        `allowedMimeTypes contains unsupported MIME type: ${mimeType}`,
      );
    }
  }

  return {
    maxSizeMb: parsed.maxSizeMb,
    allowedMimeTypes,
  };
}

export function validateStoredSettingValue(
  key: SettingKey,
  value: unknown,
  env: UploadEnv,
): { ok: true; value: unknown } | { ok: false; value: unknown } {
  try {
    switch (key) {
      case SETTING_KEYS.BASIC_SITE_NAME:
        return {
          ok: true,
          value: z.string().trim().min(1).max(80).parse(value),
        };
      case SETTING_KEYS.BASIC_SITE_SUBTITLE:
        return {
          ok: true,
          value: z.string().trim().max(160).parse(value),
        };
      case SETTING_KEYS.BASIC_DEFAULT_LOCALE:
        return { ok: true, value: localeSchema.parse(value) };
      case SETTING_KEYS.BASIC_DEFAULT_THEME:
        return { ok: true, value: themeSchema.parse(value) };
      case SETTING_KEYS.UPLOAD_MAX_SIZE_MB:
        return {
          ok: true,
          value: validateUploadSettingsInput(
            {
              maxSizeMb: value,
              allowedMimeTypes: getDefaultUploadSettings(env).allowedMimeTypes,
            },
            env,
          ).maxSizeMb,
        };
      case SETTING_KEYS.UPLOAD_ALLOWED_MIME_TYPES:
        return {
          ok: true,
          value: validateUploadSettingsInput(
            {
              maxSizeMb: env.FILE_MAX_SIZE_MB,
              allowedMimeTypes: value,
            },
            env,
          ).allowedMimeTypes,
        };
    }
  } catch {
    return { ok: false, value: defaultValueForKey(key, env) };
  }
}

export function defaultValueForKey(key: SettingKey, env: UploadEnv): unknown {
  const basic = getDefaultBasicSettings();
  const upload = getDefaultUploadSettings(env);

  switch (key) {
    case SETTING_KEYS.BASIC_SITE_NAME:
      return basic.siteName;
    case SETTING_KEYS.BASIC_SITE_SUBTITLE:
      return basic.siteSubtitle;
    case SETTING_KEYS.BASIC_DEFAULT_LOCALE:
      return basic.defaultLocale;
    case SETTING_KEYS.BASIC_DEFAULT_THEME:
      return basic.defaultTheme;
    case SETTING_KEYS.UPLOAD_MAX_SIZE_MB:
      return upload.maxSizeMb;
    case SETTING_KEYS.UPLOAD_ALLOWED_MIME_TYPES:
      return upload.allowedMimeTypes;
  }
}

export function getEffectiveUploadPolicyFromSettings(
  settings: UploadSettings,
  env: UploadEnv,
): EffectiveUploadPolicy {
  const validated = validateUploadSettingsInput(settings, env);

  return {
    ...validated,
    maxSizeBytes: validated.maxSizeMb * 1024 * 1024,
    allowedMimeTypeSet: new Set(validated.allowedMimeTypes),
  };
}
