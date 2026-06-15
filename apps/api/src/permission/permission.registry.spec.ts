import { PERMISSION_REGISTRY } from './permission.registry';

describe('PERMISSION_REGISTRY', () => {
  it('includes the audit log read permission without default roles', () => {
    expect(PERMISSION_REGISTRY).toContainEqual(
      expect.objectContaining({
        code: 'audit_log.read',
        module: 'audit_log',
        action: 'read',
        defaultRoles: [],
      }),
    );
  });

  it('includes user session permissions for admins', () => {
    expect(PERMISSION_REGISTRY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'user_session.read',
          module: 'user_session',
          action: 'read',
          defaultRoles: ['admin'],
        }),
        expect.objectContaining({
          code: 'user_session.revoke',
          module: 'user_session',
          action: 'revoke',
          defaultRoles: ['admin'],
        }),
      ]),
    );
  });

  it('includes department and position permissions', () => {
    expect(PERMISSION_REGISTRY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'department.read',
          module: 'department',
          action: 'read',
          defaultRoles: ['admin'],
        }),
        expect.objectContaining({
          code: 'department.create',
          module: 'department',
          action: 'create',
          defaultRoles: ['admin'],
        }),
        expect.objectContaining({
          code: 'department.update',
          module: 'department',
          action: 'update',
          defaultRoles: ['admin'],
        }),
        expect.objectContaining({
          code: 'department.delete',
          module: 'department',
          action: 'delete',
          defaultRoles: [],
        }),
        expect.objectContaining({
          code: 'position.read',
          module: 'position',
          action: 'read',
          defaultRoles: ['admin'],
        }),
        expect.objectContaining({
          code: 'position.create',
          module: 'position',
          action: 'create',
          defaultRoles: ['admin'],
        }),
        expect.objectContaining({
          code: 'position.update',
          module: 'position',
          action: 'update',
          defaultRoles: ['admin'],
        }),
        expect.objectContaining({
          code: 'position.delete',
          module: 'position',
          action: 'delete',
          defaultRoles: [],
        }),
      ]),
    );
  });
});
