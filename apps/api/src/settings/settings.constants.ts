export const SETTINGS_GROUPS = {
  BASIC: 'basic',
  UPLOAD: 'upload',
} as const;

export const SETTING_KEYS = {
  BASIC_SITE_NAME: 'basic.siteName',
  BASIC_SITE_SUBTITLE: 'basic.siteSubtitle',
  BASIC_DEFAULT_LOCALE: 'basic.defaultLocale',
  BASIC_DEFAULT_THEME: 'basic.defaultTheme',
  UPLOAD_MAX_SIZE_MB: 'upload.maxSizeMb',
  UPLOAD_ALLOWED_MIME_TYPES: 'upload.allowedMimeTypes',
} as const;
