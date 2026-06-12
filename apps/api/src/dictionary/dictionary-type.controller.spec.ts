import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { setRequestId } from '../common/logging/request-context';
import { DictionaryTypeController } from './dictionary-type.controller';
import { DictionaryTypeService } from './dictionary-type.service';

describe('DictionaryTypeController', () => {
  function controllerMethod(name: keyof DictionaryTypeController) {
    const descriptor = Object.getOwnPropertyDescriptor(
      DictionaryTypeController.prototype,
      name,
    );

    if (!descriptor?.value) {
      throw new Error(`Expected ${String(name)} controller method`);
    }

    return descriptor.value as unknown;
  }

  const responseDto = {
    id: 'type-1',
    code: 'user_role',
    name: 'User role',
    description: null,
    status: 'ACTIVE',
    isSystem: false,
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
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

  const createService = () => ({
    listTypes: jest.fn(),
    findById: jest.fn(),
    createType: jest.fn().mockResolvedValue(responseDto),
    updateType: jest.fn().mockResolvedValue(responseDto),
    deleteType: jest.fn().mockResolvedValue(undefined),
  });

  it.each([
    ['listTypes', ['dictionary.read']],
    ['getType', ['dictionary.read']],
    ['createType', ['dictionary.create']],
    ['updateType', ['dictionary.update']],
    ['deleteType', ['dictionary.delete']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod(method)),
    ).toEqual(permissions);
  });

  it('createType passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new DictionaryTypeController(
      service as unknown as DictionaryTypeService,
    );
    const body = { code: 'user_role', name: 'User role' };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.createType(body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.createType).toHaveBeenCalledWith(
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('updateType passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new DictionaryTypeController(
      service as unknown as DictionaryTypeService,
    );
    const body = { name: 'User roles' };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.updateType('type-1', body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.updateType).toHaveBeenCalledWith(
      'type-1',
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('deleteType passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new DictionaryTypeController(
      service as unknown as DictionaryTypeService,
    );
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.deleteType('type-1', user, request as never),
    ).resolves.toBeUndefined();

    expect(service.deleteType).toHaveBeenCalledWith(
      'type-1',
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, controllerMethod('deleteType')),
    ).toBe(204);
  });
});
