export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RESET_PASSWORD: 'reset_password',
  REPLACE_ROLES: 'replace_roles',
  REPLACE_PERMISSIONS: 'replace_permissions',
} as const;

export const AUDIT_RESOURCE_TYPES = {
  USER: 'user',
  ROLE: 'role',
  PERMISSION: 'permission',
  DICTIONARY_TYPE: 'dictionary_type',
  DICTIONARY_ITEM: 'dictionary_item',
  FILE: 'file',
} as const;

export const AUDIT_LOG_SORT_FIELDS = new Set([
  'createdAt',
  'action',
  'resourceType',
  'actorEmail',
  'actorName',
]);

export const AUDIT_SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'refreshtokenhash',
  'cookie',
  'authorization',
  'secret',
  'apikey',
  'checksum',
  'objectkey',
  'bucket',
]);
