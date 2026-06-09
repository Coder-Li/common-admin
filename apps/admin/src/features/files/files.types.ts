import type { ListResponse } from '../../lib/api'

export type FileStorageDriver = 'LOCAL'
export type FileVisibility = 'PRIVATE'

export interface FileRecord {
  id: string
  originalName: string
  displayName: string
  mimeType: string
  extension: string | null
  size: string
  storageDriver: FileStorageDriver
  visibility: FileVisibility
  description: string | null
  metadata: Record<string, unknown> | null
  uploadedById: string | null
  createdAt: string
  updatedAt: string
}

export interface FileListQuery {
  page?: number
  pageSize?: number
  search?: string
  sort?: string
  mimeType?: string
  storageDriver?: FileStorageDriver
}

export type FileListResponse = ListResponse<FileRecord>

export interface UpdateFileRequest {
  displayName?: string
  description?: string | null
}
