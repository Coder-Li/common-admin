export interface PermissionRegistryEntry {
  code: string;
  module: string;
  action: string;
  name: string;
  description?: string;
  defaultRoles: string[];
  sortOrder: number;
}

export interface UserPermissionContext {
  userId: string;
  roleCodes: string[];
  permissionCodes: string[];
  isSuperAdmin: boolean;
}
