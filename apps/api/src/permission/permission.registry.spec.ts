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
});
