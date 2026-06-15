import type {
  CreateDepartmentDto,
  DepartmentListResponseDto,
  DepartmentResponseDto,
  DepartmentTreeNodeDto,
  ListDepartmentsParams,
  UpdateDepartmentDto,
} from '../../generated/api/schemas'

export type DepartmentRecord = DepartmentResponseDto
export type DepartmentTreeNode = DepartmentTreeNodeDto
export type DepartmentListResponse = DepartmentListResponseDto
export type DepartmentListQuery = ListDepartmentsParams & {
  page: number
  pageSize: number
}
export type CreateDepartmentRequest = CreateDepartmentDto
export type UpdateDepartmentRequest = UpdateDepartmentDto

export interface DepartmentFormValue {
  code: string
  name: string
  parentId: string | null
  status: 'ACTIVE' | 'DISABLED'
  sortOrder: number
  description?: string
}
