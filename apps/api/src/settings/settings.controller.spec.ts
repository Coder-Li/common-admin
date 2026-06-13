import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { setRequestId } from '../common/logging/request-context';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  const basicSettings = {
    siteName: 'Common Admin',
    siteSubtitle: 'Admin console',
    defaultLocale: 'en-US',
    defaultTheme: 'dark',
  };
  const uploadSettings = {
    maxSizeMb: 20,
    allowedMimeTypes: ['image/png'],
    environmentMaxSizeMb: 20,
    environmentAllowedMimeTypes: ['image/png'],
    storageDriver: 'local',
  };
  const refreshResult = {
    refreshedAt: '2026-06-12T00:00:00.000Z',
  };
  const systemInfo = {
    serviceName: 'api',
    appEnv: 'local',
    nodeEnv: 'test',
    logLevel: 'info',
    storageDriver: 'local',
    uploadMaxSizeMb: 20,
    uploadAllowedMimeTypes: ['image/png'],
  };
  const user = {
    sub: 'actor-1',
    sid: 'session-1',
    email: 'actor@example.com',
    username: 'Actor',
  };
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  };
  const auditActor = {
    userId: 'actor-1',
    email: 'actor@example.com',
    name: 'Actor',
  };
  const auditRequestMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
  const auditMetadata = {
    requestId: 'req_12345678',
  };

  const permissionFor = (method: keyof SettingsController) =>
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      SettingsController.prototype[method],
    ) as string[] | undefined;

  const createService = () => ({
    getBasicSettings: jest.fn().mockResolvedValue(basicSettings),
    updateBasicSettings: jest.fn().mockResolvedValue(basicSettings),
    getUploadSettings: jest.fn().mockResolvedValue(uploadSettings),
    updateUploadSettings: jest.fn().mockResolvedValue(uploadSettings),
    refreshDictionaryCache: jest.fn().mockResolvedValue(refreshResult),
    getSystemInfo: jest.fn().mockResolvedValue(systemInfo),
  });

  const createController = (service = createService()) =>
    new SettingsController(service as unknown as SettingsService);

  it.each([
    ['getBasicSettings', ['setting.read']],
    ['updateBasicSettings', ['setting.update']],
    ['getUploadSettings', ['setting.read']],
    ['updateUploadSettings', ['setting.update']],
    ['refreshDictionaryCache', ['setting.update']],
    ['getSystemInfo', ['setting.read']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(permissionFor(method)).toEqual(permissions);
  });

  it('getBasicSettings calls the service', async () => {
    const service = createService();
    const controller = createController(service);

    await expect(controller.getBasicSettings()).resolves.toBe(basicSettings);

    expect(service.getBasicSettings).toHaveBeenCalledWith();
  });

  it('updateBasicSettings passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = createController(service);
    const body = {
      siteName: 'Operations',
      siteSubtitle: 'Console',
      defaultLocale: 'en-US',
      defaultTheme: 'dark',
    };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.updateBasicSettings(body, user, request as never),
    ).resolves.toBe(basicSettings);

    expect(service.updateBasicSettings).toHaveBeenCalledWith(
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('getUploadSettings calls the service', async () => {
    const service = createService();
    const controller = createController(service);

    await expect(controller.getUploadSettings()).resolves.toBe(uploadSettings);

    expect(service.getUploadSettings).toHaveBeenCalledWith();
  });

  it('updateUploadSettings passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = createController(service);
    const body = {
      maxSizeMb: 10,
      allowedMimeTypes: ['image/png'],
    };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.updateUploadSettings(body, user, request as never),
    ).resolves.toBe(uploadSettings);

    expect(service.updateUploadSettings).toHaveBeenCalledWith(
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('refreshDictionaryCache passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = createController(service);
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.refreshDictionaryCache(user, request as never),
    ).resolves.toBe(refreshResult);

    expect(service.refreshDictionaryCache).toHaveBeenCalledWith(
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('getSystemInfo calls the service', async () => {
    const service = createService();
    const controller = createController(service);

    await expect(controller.getSystemInfo()).resolves.toBe(systemInfo);

    expect(service.getSystemInfo).toHaveBeenCalledWith();
  });
});
