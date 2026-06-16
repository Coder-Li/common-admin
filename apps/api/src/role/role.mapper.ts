import { DataScope, DepartmentStatus } from '@prisma/client';

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
  dataScope: DataScope;
  dataScopeDepartments?: Array<{
    department: {
      id: string;
      code: string;
      name: string;
      status: DepartmentStatus;
    };
  }>;
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
    dataScope: role.dataScope,
    dataScopeDepartments:
      role.dataScope === DataScope.CUSTOM_DEPT
        ? (role.dataScopeDepartments ?? [])
            .map((link) => ({
              id: link.department.id,
              code: link.department.code,
              name: link.department.name,
              status: link.department.status,
            }))
            .sort((a, b) => a.code.localeCompare(b.code))
        : [],
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
