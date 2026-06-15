import {
  useMemo,
  useState,
} from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '../../app/api-error-messages'
import { DataTable } from '../../components/data-table/DataTable'
import { DataTableToolbar } from '../../components/data-table/DataTableToolbar'
import type {
  PaginationState,
  SortingState,
} from '../../components/data-table/DataTable'
import {
  createDepartment,
  deleteDepartment,
  getDepartmentOptions,
  getDepartmentTree,
  getGetDepartmentOptionsQueryKey,
  getGetDepartmentTreeQueryKey,
  getListDepartmentsQueryKey,
  listDepartments,
  updateDepartment,
} from '../../generated/api/endpoints/departments/departments'
import type {
  GetDepartmentOptionsParams,
  ListDepartmentsParams,
} from '../../generated/api/schemas'
import { useI18n } from '../../i18n/useI18n'
import { toApiListQuery } from '../../lib/crud/list-query'
import { can } from '../../lib/permissions'
import { useAuthStore } from '../../stores/auth-store'
import {
  DepartmentForm,
  type DepartmentFormSubmitValue,
} from './DepartmentForm'
import { createDepartmentColumns } from './departments.columns'
import type {
  CreateDepartmentRequest,
  DepartmentListQuery,
  DepartmentRecord,
  DepartmentTreeNode,
  UpdateDepartmentRequest,
} from './departments.types'

type FormState =
  | { mode: 'create'; department?: undefined }
  | { mode: 'edit'; department: DepartmentRecord }
  | null

const allStatusFilter = 'ALL'

function toSortParam(sorting: SortingState) {
  const firstSort = sorting[0]

  if (!firstSort) {
    return undefined
  }

  return `${firstSort.id}:${firstSort.desc ? 'desc' : 'asc'}`
}

function toListDepartmentsParams(
  query: DepartmentListQuery,
): ListDepartmentsParams {
  return {
    ...query,
    page: query.page as unknown as ListDepartmentsParams['page'],
    pageSize: query.pageSize as unknown as ListDepartmentsParams['pageSize'],
  }
}

function findPath(
  nodes: DepartmentTreeNode[],
  departmentId: string,
  ancestors: string[] = [],
): string[] | null {
  for (const node of nodes) {
    const nextPath = [...ancestors, node.name]

    if (node.id === departmentId) {
      return nextPath
    }

    const childPath = findPath(node.children, departmentId, nextPath)

    if (childPath) {
      return childPath
    }
  }

  return null
}

function withTreePaths(
  records: DepartmentRecord[],
  tree: DepartmentTreeNode[],
): DepartmentRecord[] {
  return records.map((record) => {
    const path = findPath(tree, record.id)

    return path && path.length > 1
      ? { ...record, parentName: path.join(' / ') }
      : record
  })
}

export function DepartmentsPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.permissions)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<
    'ACTIVE' | 'DISABLED' | typeof allStatusFilter
  >(allStatusFilter)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [formState, setFormState] = useState<FormState>(null)
  const [deleteTarget, setDeleteTarget] = useState<DepartmentRecord | null>(null)

  const canCreate = can(permissions, 'department.create')
  const canUpdate = can(permissions, 'department.update')
  const canDelete = can(permissions, 'department.delete')

  const listParams = useMemo(
    () =>
      toListDepartmentsParams(
        toApiListQuery<
          { status?: 'ACTIVE' | 'DISABLED' },
          DepartmentListQuery
        >({
          filters: status === allStatusFilter ? {} : { status },
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
          search,
          sort: toSortParam(sorting),
        }),
      ),
    [pagination.pageIndex, pagination.pageSize, search, sorting, status],
  )

  const departmentsQuery = useQuery({
    queryKey: getListDepartmentsQueryKey(listParams),
    queryFn: () => listDepartments(listParams),
  })

  const treeQuery = useQuery({
    queryKey: getGetDepartmentTreeQueryKey(),
    queryFn: () => getDepartmentTree(),
  })

  const optionsParams = useMemo(() => {
    const currentParentId =
      formState?.mode === 'edit' ? formState.department.parentId : null

    return {
      status: 'ACTIVE',
      ...(currentParentId ? { includeIds: currentParentId } : {}),
    } as GetDepartmentOptionsParams
  }, [formState])

  const optionsQuery = useQuery({
    queryKey: getGetDepartmentOptionsQueryKey(optionsParams),
    queryFn: () => getDepartmentOptions(optionsParams),
  })

  const invalidateDepartments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getGetDepartmentTreeQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetDepartmentOptionsQueryKey(),
      }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateDepartmentRequest) => createDepartment(payload),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('departments.error.create'), t))
    },
    onSuccess: async () => {
      toast.success(t('departments.success.create'))
      setFormState(null)
      await invalidateDepartments()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; value: UpdateDepartmentRequest }) =>
      updateDepartment(payload.id, payload.value),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('departments.error.update'), t))
    },
    onSuccess: async () => {
      toast.success(t('departments.success.update'))
      setFormState(null)
      await invalidateDepartments()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('departments.delete.error'), t))
    },
    onSuccess: async () => {
      toast.success(t('departments.delete.success'))
      setDeleteTarget(null)
      await invalidateDepartments()
    },
  })

  const columns = useMemo(
    () =>
      createDepartmentColumns(
        {
          actions: t('departments.column.actions'),
          code: t('departments.column.code'),
          delete: t('departments.action.delete'),
          description: t('departments.column.description'),
          edit: t('departments.action.edit'),
          name: t('departments.column.name'),
          parent: t('departments.column.parent'),
          sortOrder: t('departments.column.sortOrder'),
          status: t('departments.column.status'),
          statusActive: t('departments.status.active'),
          statusDisabled: t('departments.status.disabled'),
          updatedAt: t('departments.column.updatedAt'),
        },
        {
          canDelete,
          canUpdate,
          onDelete: setDeleteTarget,
          onEdit: (department) => setFormState({ mode: 'edit', department }),
        },
      ),
    [canDelete, canUpdate, t],
  )

  const tableData = useMemo(
    () => withTreePaths(departmentsQuery.data?.items ?? [], treeQuery.data ?? []),
    [departmentsQuery.data?.items, treeQuery.data],
  )

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setPagination((currentPagination) =>
      typeof updater === 'function' ? updater(currentPagination) : updater,
    )
  }

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
    setSorting((currentSorting) =>
      typeof updater === 'function' ? updater(currentSorting) : updater,
    )
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function handleStatusChange(value: string) {
    setStatus(
      value === 'ACTIVE' || value === 'DISABLED' ? value : allStatusFilter,
    )
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function handleSubmit(value: DepartmentFormSubmitValue) {
    if (formState?.mode === 'edit') {
      updateMutation.mutate({
        id: formState.department.id,
        value: value as UpdateDepartmentRequest,
      })
      return
    }

    createMutation.mutate(value as CreateDepartmentRequest)
  }

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('departments.title')}
        </h2>
        {canCreate ? (
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-white transition hover:bg-cyan-600"
            onClick={() => setFormState({ mode: 'create' })}
            type="button"
          >
            <Plus size={16} />
            {t('departments.action.create')}
          </button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={tableData}
        emptyLabel={t('departments.state.empty')}
        error={departmentsQuery.error}
        errorLabel={t('departments.error.load')}
        formatError={(error, fallback) => getErrorMessage(error, fallback, t)}
        isLoading={departmentsQuery.isLoading}
        loadingLabel={t('departments.state.loading')}
        onPaginationChange={handlePaginationChange}
        onRetry={() => departmentsQuery.refetch()}
        onSortingChange={handleSortingChange}
        pagination={pagination}
        retryLabel={t('departments.state.retry')}
        sorting={sorting}
        toolbar={
          <DataTableToolbar
            filters={
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span>{t('departments.form.status')}</span>
                <select
                  aria-label={t('departments.filter.status')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) => handleStatusChange(event.target.value)}
                  value={status}
                >
                  <option value={allStatusFilter}>
                    {t('departments.filter.allStatuses')}
                  </option>
                  <option value="ACTIVE">{t('departments.status.active')}</option>
                  <option value="DISABLED">
                    {t('departments.status.disabled')}
                  </option>
                </select>
              </label>
            }
            onSearchChange={handleSearchChange}
            searchLabel={t('departments.searchPlaceholder')}
            searchPlaceholder={t('departments.searchPlaceholder')}
            searchValue={search}
          />
        }
        total={departmentsQuery.data?.total ?? 0}
      />

      {formState ? (
        <div
          aria-modal="true"
          aria-label={
            formState.mode === 'create'
              ? t('departments.action.create')
              : t('departments.action.edit')
          }
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">
                {formState.mode === 'create'
                  ? t('departments.action.create')
                  : t('departments.action.edit')}
              </h3>
            </div>
            <DepartmentForm
              initialValue={
                formState.mode === 'edit' ? formState.department : undefined
              }
              isSubmitting={
                createMutation.isPending || updateMutation.isPending
              }
              mode={formState.mode}
              parentOptions={optionsQuery.data ?? []}
              tree={treeQuery.data ?? []}
              onCancel={() => setFormState(null)}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          aria-label={t('departments.delete.confirmTitle')}
          aria-modal="true"
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">
              {t('departments.delete.confirmTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{deleteTarget.code}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                {t('departments.form.cancel')}
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                type="button"
              >
                {t('departments.delete.confirmTitle')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
