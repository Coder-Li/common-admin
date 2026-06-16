import { SYSTEM_ROLE_CODES } from '../src/permission/permission.constants';

export function buildSystemRoleUpserts() {
  return [
    {
      code: SYSTEM_ROLE_CODES.superAdmin,
      name: 'Super admin',
      description: 'Full access to every active permission',
      status: 'ACTIVE' as const,
      isSystem: true,
      isDefault: false,
      dataScope: 'ALL' as const,
    },
    {
      code: SYSTEM_ROLE_CODES.admin,
      name: 'Admin',
      description: 'Default administrator role',
      status: 'ACTIVE' as const,
      isSystem: true,
      isDefault: false,
      dataScope: 'ALL' as const,
    },
    {
      code: SYSTEM_ROLE_CODES.standard,
      name: 'Standard',
      description: 'Default role for newly created users',
      status: 'ACTIVE' as const,
      isSystem: true,
      isDefault: true,
      dataScope: 'SELF' as const,
    },
  ];
}
