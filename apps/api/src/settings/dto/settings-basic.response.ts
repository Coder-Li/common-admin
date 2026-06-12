import { ApiProperty } from '@nestjs/swagger';
import { SettingsLocale, SettingsTheme } from './settings-basic.request';
import type { LocaleSetting, ThemeSetting } from '../settings.definitions';

export class BasicSettingsResponseDto {
  @ApiProperty()
  siteName!: string;

  @ApiProperty()
  siteSubtitle!: string;

  @ApiProperty({ enum: SettingsLocale })
  defaultLocale!: LocaleSetting;

  @ApiProperty({ enum: SettingsTheme })
  defaultTheme!: ThemeSetting;
}
