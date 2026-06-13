import type { BasicSettings, UploadSettings } from './settings.definitions';
import { BasicSettingsResponseDto } from './dto/settings-basic.response';
import { UploadSettingsResponseDto } from './dto/settings-upload.response';

export function toBasicSettingsResponse(
  settings: BasicSettings,
): BasicSettingsResponseDto {
  return {
    siteName: settings.siteName,
    siteSubtitle: settings.siteSubtitle,
    defaultLocale: settings.defaultLocale,
    defaultTheme: settings.defaultTheme,
  };
}

export function toUploadSettingsResponse(
  settings: UploadSettings,
  environment: UploadSettings,
): UploadSettingsResponseDto {
  return {
    maxSizeMb: settings.maxSizeMb,
    allowedMimeTypes: settings.allowedMimeTypes,
    environmentMaxSizeMb: environment.maxSizeMb,
    environmentAllowedMimeTypes: environment.allowedMimeTypes,
    storageDriver: 'local',
  };
}
