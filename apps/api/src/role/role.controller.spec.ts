import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { RoleController } from './role.controller';

describe('RoleController permissions', () => {
  const permissionFor = (method: keyof RoleController) =>
    Reflect.getMetadata(PERMISSIONS_KEY, RoleController.prototype[method]) as
      | string[]
      | undefined;

  it.each([
    ['listRoles', ['role.read']],
    ['createRole', ['role.create']],
    ['getRole', ['role.read']],
    ['updateRole', ['role.update']],
    ['deleteRole', ['role.delete']],
    ['replaceRolePermissions', ['role.assign_permissions']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(permissionFor(method)).toEqual(permissions);
  });
});
