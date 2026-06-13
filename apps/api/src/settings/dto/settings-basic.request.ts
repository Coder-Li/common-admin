import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export enum SettingsLocale {
  ZH_CN = 'zh-CN',
  EN_US = 'en-US',
}

export enum SettingsTheme {
  LIGHT = 'light',
  DARK = 'dark',
}

export class UpdateBasicSettingsDto {
  @ApiProperty({ example: 'Common Admin', minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  siteName!: string;

  @ApiProperty({ example: 'Starter template', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  siteSubtitle!: string;

  @ApiProperty({ enum: SettingsLocale, example: SettingsLocale.ZH_CN })
  @IsEnum(SettingsLocale)
  defaultLocale!: SettingsLocale;

  @ApiProperty({ enum: SettingsTheme, example: SettingsTheme.LIGHT })
  @IsEnum(SettingsTheme)
  defaultTheme!: SettingsTheme;
}
