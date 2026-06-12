import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { setRequestId } from '../common/logging/request-context';
import { DictionaryItemController } from './dictionary-item.controller';
import { DictionaryItemService } from './dictionary-item.service';

describe('DictionaryItemController', () => {
  function controllerMethod(name: keyof DictionaryItemController) {
    const descriptor = Object.getOwnPropertyDescriptor(
      DictionaryItemController.prototype,
      name,
    );

    if (!descriptor?.value) {
      throw new Error(`Expected ${String(name)} controller method`);
    }

    return descriptor.value as unknown;
  }

  const responseDto = {
    id: 'item-1',
    typeId: 'type-1',
    typeCode: 'user_role',
    typeName: 'User role',
    value: 'admin',
    label: 'Admin',
    sortOrder: 0,
    status: 'ACTIVE',
    isSystem: false,
    isDefault: false,
    badgeVariant: null,
    metadata: null,
    description: null,
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
    listItems: jest.fn(),
    findById: jest.fn(),
    createItem: jest.fn().mockResolvedValue(responseDto),
    updateItem: jest.fn().mockResolvedValue(responseDto),
    deleteItem: jest.fn().mockResolvedValue(undefined),
  });

  it.each([
    ['listItems', ['dictionary.read']],
    ['getItem', ['dictionary.read']],
    ['createItem', ['dictionary.create']],
    ['updateItem', ['dictionary.update']],
    ['deleteItem', ['dictionary.delete']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod(method)),
    ).toEqual(permissions);
  });

  it('createItem passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new DictionaryItemController(
      service as unknown as DictionaryItemService,
    );
    const body = { typeId: 'type-1', value: 'admin', label: 'Admin' };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.createItem(body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.createItem).toHaveBeenCalledWith(
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('updateItem passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new DictionaryItemController(
      service as unknown as DictionaryItemService,
    );
    const body = { label: 'Administrator' };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.updateItem('item-1', body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.updateItem).toHaveBeenCalledWith(
      'item-1',
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('deleteItem passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new DictionaryItemController(
      service as unknown as DictionaryItemService,
    );
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.deleteItem('item-1', user, request as never),
    ).resolves.toBeUndefined();

    expect(service.deleteItem).toHaveBeenCalledWith(
      'item-1',
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, controllerMethod('deleteItem')),
    ).toBe(204);
  });
});
