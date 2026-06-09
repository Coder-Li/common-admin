import type { PermissionStatus } from '@prisma/client';

export function toPermissionResponse(permission: {
  id: string;
  code: string;
  module: string;
  action: string;
  name: string;
  description: string | null;
  status: PermissionStatus;
  sortOrder: number;
}) {
  return {
    id: permission.id,
    code: permission.code,
    module: permission.module,
    action: permission.action,
    name: permission.name,
    description: permission.description,
    status: permission.status,
    sortOrder: permission.sortOrder,
  };
}
