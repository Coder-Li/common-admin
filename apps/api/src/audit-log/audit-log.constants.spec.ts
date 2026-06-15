import { AUDIT_RESOURCE_TYPES } from './audit-log.constants';

describe('AUDIT_RESOURCE_TYPES', () => {
  it('includes organization resource types', () => {
    expect(AUDIT_RESOURCE_TYPES.DEPARTMENT).toBe('department');
    expect(AUDIT_RESOURCE_TYPES.POSITION).toBe('position');
  });
});
