import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { setRequestId } from '../common/logging/request-context';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  function controllerMethod(name: keyof UserController) {
    const descriptor = Object.getOwnPropertyDescriptor(
      UserController.prototype,
      name,
    );

    if (!descriptor?.value) {
      throw new Error(`Expected ${String(name)} controller method`);
    }

    return descriptor.value as unknown;
  }

  const responseDto = {
    id: 'user-1',
    email: 'ada@example.com',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    roles: [{ code: 'admin', name: 'Admin' }],
    createdAt: '2026-06-07T01:02:03.000Z',
    updatedAt: '2026-06-07T04:05:06.000Z',
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
    findProfileById: jest.fn(),
    listUsers: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn().mockResolvedValue(responseDto),
    updateUser: jest.fn().mockResolvedValue(responseDto),
    resetPassword: jest.fn().mockResolvedValue(responseDto),
    replaceRoles: jest.fn().mockResolvedValue(responseDto),
    deleteUser: jest.fn().mockResolvedValue(undefined),
  });

  it.each([
    ['listUsers', ['user.read']],
    ['getUser', ['user.read']],
    ['createUser', ['user.create']],
    ['updateUser', ['user.update']],
    ['resetPassword', ['user.update']],
    ['replaceRoles', ['user.assign_roles']],
    ['deleteUser', ['user.delete']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod(method)),
    ).toEqual(permissions);
  });

  it('createUser passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new UserController(service as unknown as UserService);
    const body = {
      email: 'ada@example.com',
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'CorrectHorse123',
    };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.createUser(body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.createUser).toHaveBeenCalledWith(
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
      'actor-1',
    );
  });

  it('updateUser passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new UserController(service as unknown as UserService);
    const body = { firstName: 'Augusta' };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.updateUser('user-1', body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.updateUser).toHaveBeenCalledWith(
      'user-1',
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
      'actor-1',
    );
  });

  it('resetPassword passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new UserController(service as unknown as UserService);
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.resetPassword(
        'user-1',
        { newPassword: 'NewSecure123!' },
        user,
        request as never,
      ),
    ).resolves.toBe(responseDto);

    expect(service.resetPassword).toHaveBeenCalledWith(
      'user-1',
      'NewSecure123!',
      auditActor,
      auditRequestMeta,
      auditMetadata,
      'actor-1',
    );
  });

  it('replaceRoles passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new UserController(service as unknown as UserService);
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.replaceRoles(
        'user-1',
        { roleCodes: ['admin'] },
        user,
        request as never,
      ),
    ).resolves.toBe(responseDto);

    expect(service.replaceRoles).toHaveBeenCalledWith(
      'user-1',
      ['admin'],
      'actor-1',
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('deleteUser passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new UserController(service as unknown as UserService);
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.deleteUser('user-1', user, request as never),
    ).resolves.toBeUndefined();

    expect(service.deleteUser).toHaveBeenCalledWith(
      'user-1',
      auditActor,
      auditRequestMeta,
      auditMetadata,
      'actor-1',
    );
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, controllerMethod('deleteUser')),
    ).toBe(204);
  });
});
