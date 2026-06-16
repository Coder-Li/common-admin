export interface PermissionRegistryEntry {
  code: string;
  module: string;
  action: string;
  name: string;
  description?: string;
  defaultRoles: string[];
  sortOrder: number;
}

export type EffectiveDataScope =
  | { mode: 'ALL'; selfUserIds: []; departmentIds: [] }
  | { mode: 'LIMITED'; selfUserIds: string[]; departmentIds: string[] };

export interface UserPermissionContext {
  userId: string;
  roleCodes: string[];
  permissionCodes: string[];
  isSuperAdmin: boolean;
  dataScope: EffectiveDataScope;
}
