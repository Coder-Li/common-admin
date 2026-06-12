import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';
import { AuditLogService } from '../audit-log/audit-log.service';
import type {
  AuditActor,
  AuditRequestMeta,
} from '../audit-log/audit-log.types';
import type { AppEnv } from '../config/env.config';
import { PrismaService } from '../prisma/prisma.service';
import { SETTING_KEYS, SETTINGS_GROUPS } from './settings.constants';
import { SettingsService } from './settings.service';
import { UpdateUploadSettingsDto } from './dto/settings-upload.request';

describe('SettingsService', () => {
  const env: AppEnv = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    LOG_PRETTY: false,
    SERVICE_NAME: 'api',
    APP_ENV: 'test',
    ENABLE_DIAGNOSTIC_ERROR_ENDPOINT: false,
    PORT: 13001,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/common_admin',
    REDIS_URL: 'redis://localhost:6379',
    ALLOWED_ORIGINS: 'http://localhost:15173',
    JWT_ACCESS_TOKEN_SECRET: 'local-access-secret-change-me',
    JWT_ACCESS_TOKEN_EXPIRES_IN: '15m',
    AUTH_REFRESH_TOKEN_EXPIRES_IN_DAYS: 14,
    AUTH_REFRESH_COOKIE_NAME: 'common_admin_refresh',
    AUTH_REFRESH_COOKIE_SECURE: false,
    AUTH_REFRESH_COOKIE_SAME_SITE: 'lax',
    AUTH_REFRESH_COOKIE_DOMAIN: '',
    FILE_STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_ROOT: './storage/uploads',
    FILE_MAX_SIZE_MB: 20,
    FILE_ALLOWED_MIME_TYPES: 'image/png,application/pdf,text/plain',
  };

  const auditActor: AuditActor = {
    userId: 'actor-1',
    email: 'actor@example.com',
    name: 'Actor',
  };

  const auditRequestMeta: AuditRequestMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  const auditMetadata = {
    requestId: 'req_12345678',
  };

  const createPrismaMock = () => ({
    systemSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  const createConfigMock = (overrides: Partial<AppEnv> = {}) => {
    const values = {
      ...env,
      ...overrides,
    };

    return {
      getOrThrow: jest.fn((key: keyof AppEnv) => values[key]),
    };
  };

  const createService = async (configOverrides: Partial<AppEnv> = {}) => {
    const prisma = createPrismaMock();
    const tx = createPrismaMock();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const auditLogService = {
      record: jest.fn(),
    };
    const logger = {
      error: jest.fn(),
    };
    const config = createConfigMock(configOverrides);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    const service = moduleRef.get(SettingsService);

    return {
      auditLogService,
      config,
      logger,
      prisma,
      service,
      tx,
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('limits upload MIME type entries to 120 characters at the DTO layer', async () => {
    const dto = new UpdateUploadSettingsDto();
    dto.maxSizeMb = 1;
    dto.allowedMimeTypes = [`image/${'x'.repeat(121)}`];

    const errors = await validate(dto);
    const mimeTypeError = errors.find(
      (error) => error.property === 'allowedMimeTypes',
    );

    expect(mimeTypeError?.constraints?.maxLength).toContain('120');
  });

  it('returns default basic and upload settings when no DB rows exist', async () => {
    const { prisma, service } = await createService();
    prisma.systemSetting.findMany.mockResolvedValue([]);

    await expect(service.getBasicSettings()).resolves.toEqual({
      siteName: 'Common Admin',
      siteSubtitle: 'Starter template',
      defaultLocale: 'zh-CN',
      defaultTheme: 'light',
    });
    await expect(service.getUploadSettings()).resolves.toEqual({
      maxSizeMb: 20,
      allowedMimeTypes: ['image/png', 'application/pdf', 'text/plain'],
      environmentMaxSizeMb: 20,
      environmentAllowedMimeTypes: [
        'image/png',
        'application/pdf',
        'text/plain',
      ],
      storageDriver: 'local',
    });
    expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
      where: { group: SETTINGS_GROUPS.BASIC },
    });
    expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
      where: { group: SETTINGS_GROUPS.UPLOAD },
    });
  });

  it('falls back to defaults and logs invalid stored setting values', async () => {
    const { logger, prisma, service } = await createService();
    prisma.systemSetting.findMany.mockResolvedValue([
      {
        key: SETTING_KEYS.BASIC_SITE_NAME,
        group: SETTINGS_GROUPS.BASIC,
        value: 'Stored Admin',
      },
      {
        key: SETTING_KEYS.BASIC_DEFAULT_LOCALE,
        group: SETTINGS_GROUPS.BASIC,
        value: 'fr-FR',
      },
    ]);

    await expect(service.getBasicSettings()).resolves.toEqual({
      siteName: 'Stored Admin',
      siteSubtitle: 'Starter template',
      defaultLocale: 'zh-CN',
      defaultTheme: 'light',
    });
    expect(logger.error).toHaveBeenCalledWith(
      `Invalid stored system setting value: ${SETTING_KEYS.BASIC_DEFAULT_LOCALE}`,
    );
  });

  it('includes request id when update reads invalid stored setting values', async () => {
    const { logger, prisma, service, tx } = await createService();
    tx.systemSetting.findMany.mockResolvedValue([
      {
        key: SETTING_KEYS.BASIC_DEFAULT_LOCALE,
        group: SETTINGS_GROUPS.BASIC,
        value: 'fr-FR',
      },
    ]);
    tx.systemSetting.upsert.mockResolvedValue(undefined);

    await service.updateBasicSettings(
      {
        siteName: 'Admin',
        siteSubtitle: 'Console',
        defaultLocale: 'en-US',
        defaultTheme: 'dark',
      },
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );

    expect(prisma.systemSetting.findMany).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Invalid stored system setting value: ${SETTING_KEYS.BASIC_DEFAULT_LOCALE}`,
      {
        key: SETTING_KEYS.BASIC_DEFAULT_LOCALE,
        requestId: 'req_12345678',
      },
    );
  });

  it('updates basic settings transactionally and records changed keys in audit', async () => {
    const { auditLogService, prisma, service, tx } = await createService();
    tx.systemSetting.findMany.mockResolvedValue([
      {
        key: SETTING_KEYS.BASIC_SITE_NAME,
        group: SETTINGS_GROUPS.BASIC,
        value: 'Common Admin',
      },
      {
        key: SETTING_KEYS.BASIC_SITE_SUBTITLE,
        group: SETTINGS_GROUPS.BASIC,
        value: 'Starter template',
      },
      {
        key: SETTING_KEYS.BASIC_DEFAULT_LOCALE,
        group: SETTINGS_GROUPS.BASIC,
        value: 'zh-CN',
      },
      {
        key: SETTING_KEYS.BASIC_DEFAULT_THEME,
        group: SETTINGS_GROUPS.BASIC,
        value: 'light',
      },
    ]);
    tx.systemSetting.upsert.mockResolvedValue(undefined);

    await expect(
      service.updateBasicSettings(
        {
          siteName: '  Admin Console  ',
          siteSubtitle: '  Operations  ',
          defaultLocale: 'en-US',
          defaultTheme: 'dark',
        },
        auditActor,
        auditRequestMeta,
        auditMetadata,
      ),
    ).resolves.toEqual({
      siteName: 'Admin Console',
      siteSubtitle: 'Operations',
      defaultLocale: 'en-US',
      defaultTheme: 'dark',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.systemSetting.findMany).toHaveBeenCalledWith({
      where: { group: SETTINGS_GROUPS.BASIC },
    });
    expect(prisma.systemSetting.findMany).not.toHaveBeenCalled();
    expect(tx.systemSetting.upsert).toHaveBeenCalledTimes(4);
    expect(tx.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: SETTING_KEYS.BASIC_SITE_NAME },
      create: {
        key: SETTING_KEYS.BASIC_SITE_NAME,
        group: SETTINGS_GROUPS.BASIC,
        value: 'Admin Console',
        updatedBy: 'actor-1',
      },
      update: {
        group: SETTINGS_GROUPS.BASIC,
        value: 'Admin Console',
        updatedBy: 'actor-1',
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: 'system_setting.update',
        resourceType: 'system_setting',
        resourceId: SETTINGS_GROUPS.BASIC,
        actor: auditActor,
        requestMeta: auditRequestMeta,
        before: {
          siteName: 'Common Admin',
          siteSubtitle: 'Starter template',
          defaultLocale: 'zh-CN',
          defaultTheme: 'light',
        },
        after: {
          siteName: 'Admin Console',
          siteSubtitle: 'Operations',
          defaultLocale: 'en-US',
          defaultTheme: 'dark',
        },
        metadata: {
          requestId: 'req_12345678',
          changedKeys: [
            SETTING_KEYS.BASIC_SITE_NAME,
            SETTING_KEYS.BASIC_SITE_SUBTITLE,
            SETTING_KEYS.BASIC_DEFAULT_LOCALE,
            SETTING_KEYS.BASIC_DEFAULT_THEME,
          ],
        },
      },
      tx,
    );
  });

  it('returns upload settings constrained by environment values', async () => {
    const { prisma, service } = await createService();
    prisma.systemSetting.findMany.mockResolvedValue([
      {
        key: SETTING_KEYS.UPLOAD_MAX_SIZE_MB,
        group: SETTINGS_GROUPS.UPLOAD,
        value: 30,
      },
      {
        key: SETTING_KEYS.UPLOAD_ALLOWED_MIME_TYPES,
        group: SETTINGS_GROUPS.UPLOAD,
        value: ['image/png', 'application/zip'],
      },
    ]);

    await expect(service.getUploadSettings()).resolves.toEqual({
      maxSizeMb: 20,
      allowedMimeTypes: ['image/png', 'application/pdf', 'text/plain'],
      environmentMaxSizeMb: 20,
      environmentAllowedMimeTypes: [
        'image/png',
        'application/pdf',
        'text/plain',
      ],
      storageDriver: 'local',
    });
  });

  it('updates upload settings transactionally and records changed keys in audit', async () => {
    const { auditLogService, prisma, service, tx } = await createService();
    tx.systemSetting.findMany.mockResolvedValue([
      {
        key: SETTING_KEYS.UPLOAD_MAX_SIZE_MB,
        group: SETTINGS_GROUPS.UPLOAD,
        value: 20,
      },
      {
        key: SETTING_KEYS.UPLOAD_ALLOWED_MIME_TYPES,
        group: SETTINGS_GROUPS.UPLOAD,
        value: ['image/png', 'application/pdf', 'text/plain'],
      },
    ]);
    tx.systemSetting.upsert.mockResolvedValue(undefined);

    await expect(
      service.updateUploadSettings(
        {
          maxSizeMb: 10,
          allowedMimeTypes: ['image/png', 'text/plain'],
        },
        auditActor,
        auditRequestMeta,
        auditMetadata,
      ),
    ).resolves.toEqual({
      maxSizeMb: 10,
      allowedMimeTypes: ['image/png', 'text/plain'],
      environmentMaxSizeMb: 20,
      environmentAllowedMimeTypes: [
        'image/png',
        'application/pdf',
        'text/plain',
      ],
      storageDriver: 'local',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.systemSetting.findMany).toHaveBeenCalledWith({
      where: { group: SETTINGS_GROUPS.UPLOAD },
    });
    expect(prisma.systemSetting.findMany).not.toHaveBeenCalled();
    expect(tx.systemSetting.upsert).toHaveBeenCalledTimes(2);
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: 'system_setting.update',
        resourceType: 'system_setting',
        resourceId: SETTINGS_GROUPS.UPLOAD,
        actor: auditActor,
        requestMeta: auditRequestMeta,
        before: {
          maxSizeMb: 20,
          allowedMimeTypes: ['image/png', 'application/pdf', 'text/plain'],
        },
        after: {
          maxSizeMb: 10,
          allowedMimeTypes: ['image/png', 'text/plain'],
        },
        metadata: {
          requestId: 'req_12345678',
          changedKeys: [
            SETTING_KEYS.UPLOAD_MAX_SIZE_MB,
            SETTING_KEYS.UPLOAD_ALLOWED_MIME_TYPES,
          ],
        },
      },
      tx,
    );
  });

  it('rejects upload settings that exceed environment constraints with BadRequestException', async () => {
    const { prisma, service } = await createService();
    prisma.systemSetting.findMany.mockResolvedValue([]);

    await expect(
      service.updateUploadSettings({
        maxSizeMb: 21,
        allowedMimeTypes: ['image/png'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns only allow-listed safe system info', async () => {
    const { service } = await createService();

    await expect(service.getSystemInfo()).resolves.toEqual({
      serviceName: 'api',
      appEnv: 'test',
      nodeEnv: 'test',
      logLevel: 'silent',
      storageDriver: 'local',
      uploadMaxSizeMb: 20,
      uploadAllowedMimeTypes: ['image/png', 'application/pdf', 'text/plain'],
    });
  });

  it('records dictionary cache refresh audit and returns refreshed timestamp', async () => {
    const { auditLogService, service } = await createService();
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2026-06-12T00:00:00.000Z');

    await expect(
      service.refreshDictionaryCache(
        auditActor,
        auditRequestMeta,
        auditMetadata,
      ),
    ).resolves.toEqual({
      refreshedAt: '2026-06-12T00:00:00.000Z',
    });

    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: 'system_setting.cache_refresh',
        resourceType: 'system_setting',
        resourceId: 'cache.dictionary',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        metadata: {
          requestId: 'req_12345678',
          refreshedAt: '2026-06-12T00:00:00.000Z',
        },
      },
      undefined,
    );
  });

  it('returns effective upload policy from DB settings constrained by env', async () => {
    const { prisma, service } = await createService();
    prisma.systemSetting.findMany.mockResolvedValue([
      {
        key: SETTING_KEYS.UPLOAD_MAX_SIZE_MB,
        group: SETTINGS_GROUPS.UPLOAD,
        value: 5,
      },
      {
        key: SETTING_KEYS.UPLOAD_ALLOWED_MIME_TYPES,
        group: SETTINGS_GROUPS.UPLOAD,
        value: ['image/png'],
      },
    ]);

    await expect(service.getEffectiveUploadPolicy()).resolves.toEqual({
      maxSizeMb: 5,
      maxSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/png'],
      allowedMimeTypeSet: new Set(['image/png']),
    });
  });
});
