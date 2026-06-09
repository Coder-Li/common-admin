export const SYSTEM_ROLE_CODES = {
  superAdmin: 'super_admin',
  admin: 'admin',
  standard: 'standard',
} as const;

export const PERMISSION_CACHE_PREFIX = 'user_permissions';
export const PERMISSION_CACHE_VERSION_KEY = 'permission_cache_version';
