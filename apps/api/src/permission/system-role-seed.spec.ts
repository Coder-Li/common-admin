import { buildSystemRoleUpserts } from '../../prisma/seed-system-roles';

describe('system role seed helpers', () => {
  it('assigns the expected data scopes to system roles', () => {
    const roles = buildSystemRoleUpserts();
    const rolesByCode = new Map(roles.map((role) => [role.code, role]));

    expect(rolesByCode.get('super_admin')?.dataScope).toBe('ALL');
    expect(rolesByCode.get('admin')?.dataScope).toBe('ALL');
    expect(rolesByCode.get('standard')?.dataScope).toBe('SELF');
  });

  it('returns seed payloads shaped for role upserts without custom departments', () => {
    const roles = buildSystemRoleUpserts();
    const rolesByCode = new Map(roles.map((role) => [role.code, role]));

    expect(roles).toHaveLength(3);
    expect(rolesByCode.get('admin')).toMatchObject({
      status: 'ACTIVE',
      isSystem: true,
      dataScope: 'ALL',
    });
    expect(roles.some((role) => 'dataScopeDepartments' in role)).toBe(false);
  });
});
