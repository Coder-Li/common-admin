import type { ExecutionContext } from '@nestjs/common';
import type { EffectiveDataScope } from '../permission/permission.types';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const allDataScope: EffectiveDataScope = {
    mode: 'ALL',
    selfUserIds: [],
    departmentIds: [],
  };
  const emptyLimitedDataScope: EffectiveDataScope = {
    mode: 'LIMITED',
    selfUserIds: [],
    departmentIds: [],
  };
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const permissionService = {
    resolveUserPermissionContext: jest.fn(),
  };

  const createGuard = () =>
    new PermissionsGuard(reflector as never, permissionService as never);

  const createContext = (user?: { sub: string }) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows routes without permission metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(createGuard().canActivate(createContext())).resolves.toBe(
      true,
    );
  });

  it('allows super_admin', async () => {
    reflector.getAllAndOverride.mockReturnValue(['user.delete']);
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      userId: 'user-1',
      roleCodes: ['super_admin'],
      permissionCodes: [],
      isSuperAdmin: true,
      dataScope: allDataScope,
    });

    await expect(
      createGuard().canActivate(createContext({ sub: 'user-1' })),
    ).resolves.toBe(true);
  });

  it('allows when user has all required permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(['user.read', 'user.update']);
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      userId: 'user-1',
      roleCodes: ['admin'],
      permissionCodes: ['user.read', 'user.update'],
      isSuperAdmin: false,
      dataScope: emptyLimitedDataScope,
    });

    await expect(
      createGuard().canActivate(createContext({ sub: 'user-1' })),
    ).resolves.toBe(true);
  });

  it('denies when any required permission is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(['user.read', 'user.delete']);
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      userId: 'user-1',
      roleCodes: ['admin'],
      permissionCodes: ['user.read'],
      isSuperAdmin: false,
      dataScope: emptyLimitedDataScope,
    });

    await expect(
      createGuard().canActivate(createContext({ sub: 'user-1' })),
    ).resolves.toBe(false);
  });

  it('denies when request has no user', async () => {
    reflector.getAllAndOverride.mockReturnValue(['user.read']);

    await expect(createGuard().canActivate(createContext())).resolves.toBe(
      false,
    );
  });
});
