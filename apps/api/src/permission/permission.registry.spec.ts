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
});
