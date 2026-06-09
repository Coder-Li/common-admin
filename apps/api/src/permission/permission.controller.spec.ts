import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { PermissionController } from './permission.controller';

describe('PermissionController', () => {
  const permissionService = {
    listPermissions: jest.fn(),
    listPermissionModules: jest.fn(),
  };

  const createController = () =>
    new PermissionController(permissionService as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it.each([
    ['listPermissions', ['permission.read']],
    ['listPermissionModules', ['permission.read']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PermissionController.prototype[method],
      ),
    ).toEqual(permissions);
  });

  it('returns grouped permissions by module and sort order', async () => {
    const modules = [
      {
        module: 'user',
        permissions: [
          {
            id: 'permission-1',
            code: 'user.read',
            module: 'user',
            action: 'read',
            name: 'View users',
            description: null,
            status: 'ACTIVE',
            sortOrder: 100,
          },
        ],
      },
    ];
    permissionService.listPermissionModules.mockResolvedValue(modules);

    await expect(createController().listPermissionModules()).resolves.toEqual(
      modules,
    );
  });
});
