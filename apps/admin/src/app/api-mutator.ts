import type { AxiosRequestConfig } from 'axios'

export async function apiMutator<T>(
  _config: AxiosRequestConfig,
  _options?: AxiosRequestConfig,
): Promise<T> {
  throw new Error('apiMutator is not implemented yet')
}
