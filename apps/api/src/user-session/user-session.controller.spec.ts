import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { setRequestId } from '../common/logging/request-context';
import { UserSessionController } from './user-session.controller';
import { UserSessionService } from './user-session.service';

describe('UserSessionController', () => {
  function controllerMethod(name: keyof UserSessionController) {
    const descriptor = Object.getOwnPropertyDescriptor(
      UserSessionController.prototype,
      name,
    );

    if (!descriptor?.value) {
      throw new Error(`Expected ${String(name)} controller method`);
    }

    return descriptor.value as unknown;
  }

  const listResponse = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  const user = {
    sub: 'actor-1',
    sid: 'current-session',
    email: 'actor@example.com',
    username: 'Actor',
  };
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  };

  const createService = () => ({
    listUserSessions: jest.fn().mockResolvedValue(listResponse),
    revokeUserSession: jest.fn().mockResolvedValue(undefined),
  });

  it.each([
    ['listUserSessions', ['user_session.read']],
    ['revokeUserSession', ['user_session.revoke']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod(method)),
    ).toEqual(permissions);
  });

  it('passes query and current session id to the list service', async () => {
    const service = createService();
    const controller = new UserSessionController(
      service as unknown as UserSessionService,
    );
    const query = { status: 'active' };

    await expect(controller.listUserSessions(query, user)).resolves.toBe(
      listResponse,
    );

    expect(service.listUserSessions).toHaveBeenCalledWith(
      query,
      'current-session',
    );
  });

  it('passes audit context and returns undefined for revoke', async () => {
    const service = createService();
    const controller = new UserSessionController(
      service as unknown as UserSessionService,
    );
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.revokeUserSession('session-1', user, request as never),
    ).resolves.toBeUndefined();

    expect(service.revokeUserSession).toHaveBeenCalledWith(
      'session-1',
      'current-session',
      {
        userId: 'actor-1',
        email: 'actor@example.com',
        name: 'Actor',
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
      { requestId: 'req_12345678' },
    );
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        controllerMethod('revokeUserSession'),
      ),
    ).toBe(204);
  });
});
