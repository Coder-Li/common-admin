import type {
  FileListResponseDto,
  FileResponseDto,
  FileResponseDtoStorageDriver,
  FileResponseDtoVisibility,
  ListFilesParams,
  UpdateFileDto,
} from '../../generated/api/schemas'

export type FileStorageDriver = FileResponseDtoStorageDriver
export type FileVisibility = FileResponseDtoVisibility

export interface FileListQuery extends Omit<ListFilesParams, 'page' | 'pageSize'> {
  page: number
  pageSize: number
}

export type FileRecord = FileResponseDto
export type FileListResponse = FileListResponseDto
export type UpdateFileRequest = UpdateFileDto
