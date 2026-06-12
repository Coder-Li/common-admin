import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import type {
  AuditActor,
  AuditRequestMeta,
  RecordAuditLogInput,
} from '../audit-log/audit-log.types';
import type { AppEnv } from '../config/env.config';
import { PrismaService } from '../prisma/prisma.service';
import { DictionaryCacheRefreshResponseDto } from './dto/settings-cache.response';
import { UpdateBasicSettingsDto } from './dto/settings-basic.request';
import { BasicSettingsResponseDto } from './dto/settings-basic.response';
import { SystemInfoResponseDto } from './dto/settings-system-info.response';
import { UpdateUploadSettingsDto } from './dto/settings-upload.request';
import { UploadSettingsResponseDto } from './dto/settings-upload.response';
import { SETTING_KEYS, SETTINGS_GROUPS } from './settings.constants';
import {
  BasicSettings,
  EffectiveUploadPolicy,
  SettingGroup,
  SettingKey,
  UploadSettings,
  getDefaultBasicSettings,
  getDefaultUploadSettings,
  getEffectiveUploadPolicyFromSettings,
  parseAllowedMimeTypes,
  validateBasicSettingsInput,
  validateStoredSettingValue,
  validateUploadSettingsInput,
} from './settings.definitions';
import {
  toBasicSettingsResponse,
  toUploadSettingsResponse,
} from './settings.mapper';

type SystemSettingRow = {
  key: string;
  value: unknown;
};

type SettingsReadClient = Pick<PrismaClient, 'systemSetting'>;
type SettingsTransactionClient = Pick<
  PrismaClient,
  'auditLog' | 'systemSetting'
>;
type SystemSettingJsonValue = Prisma.InputJsonValue | typeof Prisma.JsonNull;
type AuditMetadata = Record<string, unknown> | undefined;

const SETTINGS_UPDATE_ACTION = 'system_setting.update';
const SETTINGS_CACHE_REFRESH_ACTION = 'system_setting.cache_refresh';
const SETTINGS_RESOURCE_TYPE = 'system_setting';

const BASIC_SETTING_ENTRIES = [
  ['siteName', SETTING_KEYS.BASIC_SITE_NAME],
  ['siteSubtitle', SETTING_KEYS.BASIC_SITE_SUBTITLE],
  ['defaultLocale', SETTING_KEYS.BASIC_DEFAULT_LOCALE],
  ['defaultTheme', SETTING_KEYS.BASIC_DEFAULT_THEME],
] as const;

const UPLOAD_SETTING_ENTRIES = [
  ['maxSizeMb', SETTING_KEYS.UPLOAD_MAX_SIZE_MB],
  ['allowedMimeTypes', SETTING_KEYS.UPLOAD_ALLOWED_MIME_TYPES],
] as const;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly auditLogService: AuditLogService,
    @Inject(Logger) private readonly logger: Logger,
  ) {}

  async getBasicSettings(): Promise<BasicSettingsResponseDto> {
    const settings = await this.readBasicSettings();

    return toBasicSettingsResponse(settings);
  }

  async updateBasicSettings(
    dto: UpdateBasicSettingsDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    metadata?: AuditMetadata,
  ): Promise<BasicSettingsResponseDto> {
    const after = validateBasicSettingsInput(dto);

    await this.prisma.$transaction(async (tx: SettingsTransactionClient) => {
      const before = await this.readBasicSettings(tx, metadata);
      const changedKeys = getChangedKeys(before, after, BASIC_SETTING_ENTRIES);

      await Promise.all(
        BASIC_SETTING_ENTRIES.map(([property, key]) =>
          this.upsertSetting(
            tx,
            key,
            SETTINGS_GROUPS.BASIC,
            after[property],
            actor,
          ),
        ),
      );
      await this.auditLogService.record(
        this.createUpdateAuditInput(
          SETTINGS_GROUPS.BASIC,
          before,
          after,
          changedKeys,
          actor,
          requestMeta,
          metadata,
        ),
        tx,
      );
    });

    return toBasicSettingsResponse(after);
  }

  async getUploadSettings(): Promise<UploadSettingsResponseDto> {
    const settings = await this.readUploadSettings();

    return toUploadSettingsResponse(
      settings,
      this.getEnvironmentUploadSettings(),
    );
  }

  async updateUploadSettings(
    dto: UpdateUploadSettingsDto,
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    metadata?: AuditMetadata,
  ): Promise<UploadSettingsResponseDto> {
    const after = this.validateUploadSettingsForRequest(dto);

    await this.prisma.$transaction(async (tx: SettingsTransactionClient) => {
      const before = await this.readUploadSettings(tx, metadata);
      const changedKeys = getChangedKeys(before, after, UPLOAD_SETTING_ENTRIES);

      await Promise.all(
        UPLOAD_SETTING_ENTRIES.map(([property, key]) =>
          this.upsertSetting(
            tx,
            key,
            SETTINGS_GROUPS.UPLOAD,
            after[property],
            actor,
          ),
        ),
      );
      await this.auditLogService.record(
        this.createUpdateAuditInput(
          SETTINGS_GROUPS.UPLOAD,
          before,
          after,
          changedKeys,
          actor,
          requestMeta,
          metadata,
        ),
        tx,
      );
    });

    return toUploadSettingsResponse(after, this.getEnvironmentUploadSettings());
  }

  async refreshDictionaryCache(
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    metadata?: AuditMetadata,
  ): Promise<DictionaryCacheRefreshResponseDto> {
    const refreshedAt = new Date().toISOString();

    await this.auditLogService.record(
      {
        action: SETTINGS_CACHE_REFRESH_ACTION,
        resourceType: SETTINGS_RESOURCE_TYPE,
        resourceId: 'cache.dictionary',
        actor,
        requestMeta,
        metadata: {
          ...metadata,
          refreshedAt,
        },
      } as unknown as RecordAuditLogInput,
      undefined,
    );

    return { refreshedAt };
  }

  getSystemInfo(): Promise<SystemInfoResponseDto> {
    const uploadEnv = this.getUploadEnv();

    return Promise.resolve({
      serviceName: this.config.getOrThrow('SERVICE_NAME'),
      appEnv: this.config.getOrThrow('APP_ENV'),
      nodeEnv: this.config.getOrThrow('NODE_ENV'),
      logLevel: this.config.getOrThrow('LOG_LEVEL'),
      storageDriver: this.config.getOrThrow('FILE_STORAGE_DRIVER'),
      uploadMaxSizeMb: uploadEnv.FILE_MAX_SIZE_MB,
      uploadAllowedMimeTypes: parseAllowedMimeTypes(
        uploadEnv.FILE_ALLOWED_MIME_TYPES,
      ),
    });
  }

  async getEffectiveUploadPolicy(): Promise<EffectiveUploadPolicy> {
    const settings = await this.readUploadSettings();

    return getEffectiveUploadPolicyFromSettings(settings, this.getUploadEnv());
  }

  private async readBasicSettings(
    client: SettingsReadClient = this.prisma,
    metadata?: AuditMetadata,
  ): Promise<BasicSettings> {
    const rows = await this.readGroupRows(SETTINGS_GROUPS.BASIC, client);
    const settings = getDefaultBasicSettings();

    for (const [property, key] of BASIC_SETTING_ENTRIES) {
      const row = rows.find((item) => item.key === key);

      if (!row) {
        continue;
      }

      settings[property] = this.validateStoredValue(
        key,
        row.value,
        metadata,
      ) as never;
    }

    return settings;
  }

  private async readUploadSettings(
    client: SettingsReadClient = this.prisma,
    metadata?: AuditMetadata,
  ): Promise<UploadSettings> {
    const rows = await this.readGroupRows(SETTINGS_GROUPS.UPLOAD, client);
    const settings = getDefaultUploadSettings(this.getUploadEnv());

    for (const [property, key] of UPLOAD_SETTING_ENTRIES) {
      const row = rows.find((item) => item.key === key);

      if (!row) {
        continue;
      }

      settings[property] = this.validateStoredValue(
        key,
        row.value,
        metadata,
      ) as never;
    }

    return settings;
  }

  private async readGroupRows(
    group: SettingGroup,
    client: SettingsReadClient,
  ): Promise<SystemSettingRow[]> {
    return client.systemSetting.findMany({
      where: { group },
    });
  }

  private validateStoredValue(
    key: SettingKey,
    value: unknown,
    metadata?: AuditMetadata,
  ): unknown {
    const result = validateStoredSettingValue(key, value, this.getUploadEnv());

    if (!result.ok) {
      const requestId = metadata?.requestId;

      if (typeof requestId === 'string') {
        this.logger.error(`Invalid stored system setting value: ${key}`, {
          key,
          requestId,
        });
      } else {
        this.logger.error(`Invalid stored system setting value: ${key}`);
      }
    }

    return result.value;
  }

  private validateUploadSettingsForRequest(input: unknown): UploadSettings {
    try {
      return validateUploadSettingsInput(input, this.getUploadEnv());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid upload settings';

      throw new BadRequestException(message);
    }
  }

  private getEnvironmentUploadSettings(): UploadSettings {
    return getDefaultUploadSettings(this.getUploadEnv());
  }

  private getUploadEnv(): Pick<
    AppEnv,
    'FILE_MAX_SIZE_MB' | 'FILE_ALLOWED_MIME_TYPES'
  > {
    return {
      FILE_MAX_SIZE_MB: this.config.getOrThrow('FILE_MAX_SIZE_MB'),
      FILE_ALLOWED_MIME_TYPES: this.config.getOrThrow(
        'FILE_ALLOWED_MIME_TYPES',
      ),
    };
  }

  private async upsertSetting(
    tx: SettingsTransactionClient,
    key: SettingKey,
    group: SettingGroup,
    value: SystemSettingJsonValue,
    actor?: AuditActor,
  ): Promise<void> {
    await tx.systemSetting.upsert({
      where: { key },
      create: {
        key,
        group,
        value,
        updatedBy: actor?.userId,
      },
      update: {
        group,
        value,
        updatedBy: actor?.userId,
      },
    });
  }

  private createUpdateAuditInput(
    resourceId: SettingGroup,
    before: BasicSettings | UploadSettings,
    after: BasicSettings | UploadSettings,
    changedKeys: string[],
    actor?: AuditActor,
    requestMeta?: AuditRequestMeta,
    metadata?: AuditMetadata,
  ): RecordAuditLogInput {
    return {
      action: SETTINGS_UPDATE_ACTION,
      resourceType: SETTINGS_RESOURCE_TYPE,
      resourceId,
      actor,
      requestMeta,
      before,
      after,
      metadata: {
        ...metadata,
        changedKeys,
      },
    } as unknown as RecordAuditLogInput;
  }
}

function getChangedKeys<
  TSettings extends object,
  TEntries extends ReadonlyArray<readonly [keyof TSettings, SettingKey]>,
>(before: TSettings, after: TSettings, entries: TEntries): string[] {
  return entries
    .filter(
      ([property]) =>
        JSON.stringify(before[property]) !== JSON.stringify(after[property]),
    )
    .map(([, key]) => key);
}
