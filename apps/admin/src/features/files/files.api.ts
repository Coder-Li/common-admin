import { api as defaultApi } from '../../app/api-client'
import type {
  FileListQuery,
  FileListResponse,
  FileRecord,
  UpdateFileRequest,
} from './files.types'

export interface FilesApiClient {
  files: {
    list(query: FileListQuery): Promise<FileListResponse>
    upload(formData: FormData): Promise<FileRecord>
    update(id: string, payload: UpdateFileRequest): Promise<FileRecord>
    delete(id: string): Promise<void>
    download(id: string): Promise<Blob>
  }
}

export function listFiles(
  query: FileListQuery,
  api: FilesApiClient = defaultApi,
) {
  return api.files.list(query)
}

export function uploadFile(
  formData: FormData,
  api: FilesApiClient = defaultApi,
) {
  return api.files.upload(formData)
}

export function updateFile(
  id: string,
  payload: UpdateFileRequest,
  api: FilesApiClient = defaultApi,
) {
  return api.files.update(id, payload)
}

export function deleteFile(id: string, api: FilesApiClient = defaultApi) {
  return api.files.delete(id)
}

export function downloadFile(id: string, api: FilesApiClient = defaultApi) {
  return api.files.download(id)
}
