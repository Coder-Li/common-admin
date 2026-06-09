export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'reset_password',
  'replace_roles',
  'replace_permissions',
] as const;

export const AUDIT_RESOURCE_TYPES = [
  'user',
  'role',
  'permission',
  'dictionary_type',
  'dictionary_item',
  'file',
] as const;

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
