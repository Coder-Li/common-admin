import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { AuditLogController } from './audit-log.controller';

describe('AuditLogController', () => {
  it.each([
    ['listAuditLogs', ['audit_log.read']],
    ['getAuditLog', ['audit_log.read']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AuditLogController.prototype[method],
      ),
    ).toEqual(permissions);
  });

  it.each(['create', 'update', 'delete', 'post', 'patch', 'remove'])(
    'does not expose %s',
    (method) => {
      expect(AuditLogController.prototype).not.toHaveProperty(method);
    },
  );
});
