function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function toRoleResponse(role: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'DISABLED';
  isSystem: boolean;
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  permissions?: Array<{
    permission: {
      code: string;
      name: string;
    };
  }>;
}) {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    status: role.status,
    isSystem: role.isSystem,
    isDefault: role.isDefault,
    permissions: (role.permissions ?? [])
      .map((rolePermission) => ({
        code: rolePermission.permission.code,
        name: rolePermission.permission.name,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    createdAt: toIsoString(role.createdAt),
    updatedAt: toIsoString(role.updatedAt),
  };
}
