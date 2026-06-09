import {
  buildDefaultRolePermissionLinks,
  buildPermissionUpserts,
} from '../../prisma/permission-seed';
import type { PermissionRegistryEntry } from './permission.types';

describe('permission seed helpers', () => {
  const registry: PermissionRegistryEntry[] = [
    {
      code: 'user.read',
      module: 'user',
      action: 'read',
      name: 'View users',
      description: 'View user records',
      defaultRoles: ['admin'],
      sortOrder: 100,
    },
    {
      code: 'user.delete',
      module: 'user',
      action: 'delete',
      name: 'Delete user',
      defaultRoles: [],
      sortOrder: 130,
    },
  ];

  const rolesByCode = new Map([
    ['admin', { id: 'role-admin', code: 'admin' }],
    ['standard', { id: 'role-standard', code: 'standard' }],
  ]);

  it('normalizes registry entries into upsert data', () => {
    expect(buildPermissionUpserts(registry)).toEqual([
      {
        where: { code: 'user.read' },
        create: {
          code: 'user.read',
          module: 'user',
          action: 'read',
          name: 'View users',
          description: 'View user records',
          isSystem: true,
          sortOrder: 100,
        },
        update: {
          module: 'user',
          action: 'read',
          name: 'View users',
          description: 'View user records',
          isSystem: true,
          sortOrder: 100,
        },
      },
      {
        where: { code: 'user.delete' },
        create: {
          code: 'user.delete',
          module: 'user',
          action: 'delete',
          name: 'Delete user',
          description: null,
          isSystem: true,
          sortOrder: 130,
        },
        update: {
          module: 'user',
          action: 'delete',
          name: 'Delete user',
          description: null,
          isSystem: true,
          sortOrder: 130,
        },
      },
    ]);
  });

  it('applies defaultRoles only when permission was newly inserted', () => {
    const links = buildDefaultRolePermissionLinks(
      new Set(['user.read']),
      registry,
      rolesByCode,
      new Map([['user.read', { id: 'permission-user-read' }]]),
    );

    expect(links).toEqual([
      {
        roleId: 'role-admin',
        permissionId: 'permission-user-read',
      },
    ]);
  });

  it('does not re-grant manually removed permissions on later seed runs', () => {
    const links = buildDefaultRolePermissionLinks(
      new Set(),
      registry,
      rolesByCode,
      new Map([['user.read', { id: 'permission-user-read' }]]),
    );

    expect(links).toEqual([]);
  });
});
