import { api } from '../../app/api-client'
import type { CreateRoleRequest, RoleListQuery, UpdateRoleRequest } from './roles.types'

export const rolesApi = {
  list: (query: RoleListQuery) => api.roles.list(query),
  create: (input: CreateRoleRequest) => api.roles.create(input),
  update: (id: string, input: UpdateRoleRequest) => api.roles.update(id, input),
  remove: (id: string) => api.roles.delete(id),
  replacePermissions: (id: string, permissionCodes: string[]) =>
    api.roles.replacePermissions(id, permissionCodes),
  listPermissionModules: () => api.permissions.modules(),
}
