import { api } from '../../app/api-client'

export const permissionsApi = {
  listModules: () => api.permissions.modules(),
}
