import type { AxiosRequestConfig } from 'axios'

export async function apiMutator<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> {
  void config
  void options

  throw new Error('apiMutator is not implemented yet')
}
