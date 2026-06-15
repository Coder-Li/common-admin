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
  createPosition,
  deletePosition,
  getListPositionsQueryKey,
  listPositions,
  updatePosition,
} from '../../generated/api/endpoints/positions/positions'
import type { ListPositionsParams } from '../../generated/api/schemas'
import { useI18n } from '../../i18n/useI18n'
import { toApiListQuery } from '../../lib/crud/list-query'
import { can } from '../../lib/permissions'
import { useAuthStore } from '../../stores/auth-store'
import {
  PositionForm,
  type PositionFormSubmitValue,
} from './PositionForm'
import { createPositionColumns } from './positions.columns'
import type {
  CreatePositionRequest,
  PositionListQuery,
  PositionRecord,
  UpdatePositionRequest,
} from './positions.types'

type FormState =
  | { mode: 'create'; position?: undefined }
  | { mode: 'edit'; position: PositionRecord }
  | null

const allStatusFilter = 'ALL'

function toSortParam(sorting: SortingState) {
  const firstSort = sorting[0]

  if (!firstSort) {
    return 'sortOrder:asc'
  }

  return `${firstSort.id}:${firstSort.desc ? 'desc' : 'asc'}`
}

function toListPositionsParams(query: PositionListQuery): ListPositionsParams {
  return {
    ...query,
    page: query.page as unknown as ListPositionsParams['page'],
    pageSize: query.pageSize as unknown as ListPositionsParams['pageSize'],
  }
}

export function PositionsPage() {
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
  const [deleteTarget, setDeleteTarget] = useState<PositionRecord | null>(null)

  const canCreate = can(permissions, 'position.create')
  const canUpdate = can(permissions, 'position.update')
  const canDelete = can(permissions, 'position.delete')

  const listParams = useMemo(
    () =>
      toListPositionsParams(
        toApiListQuery<{ status?: 'ACTIVE' | 'DISABLED' }, PositionListQuery>({
          filters: status === allStatusFilter ? {} : { status },
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
          search,
          sort: toSortParam(sorting),
        }),
      ),
    [pagination.pageIndex, pagination.pageSize, search, sorting, status],
  )

  const positionsQuery = useQuery({
    queryKey: getListPositionsQueryKey(listParams),
    queryFn: () => listPositions(listParams),
  })

  const invalidatePositions = async () => {
    await queryClient.invalidateQueries({
      queryKey: getListPositionsQueryKey(),
    })
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreatePositionRequest) => createPosition(payload),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('positions.error.create'), t))
    },
    onSuccess: async () => {
      toast.success(t('positions.success.create'))
      setFormState(null)
      await invalidatePositions()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; value: UpdatePositionRequest }) =>
      updatePosition(payload.id, payload.value),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('positions.error.update'), t))
    },
    onSuccess: async () => {
      toast.success(t('positions.success.update'))
      setFormState(null)
      await invalidatePositions()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePosition(id),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('positions.delete.error'), t))
    },
    onSuccess: async () => {
      toast.success(t('positions.delete.success'))
      setDeleteTarget(null)
      await invalidatePositions()
    },
  })

  const columns = useMemo(
    () =>
      createPositionColumns(
        {
          actions: t('positions.column.actions'),
          code: t('positions.column.code'),
          delete: t('positions.action.delete'),
          description: t('positions.column.description'),
          edit: t('positions.action.edit'),
          name: t('positions.column.name'),
          sortOrder: t('positions.column.sortOrder'),
          status: t('positions.column.status'),
          statusActive: t('positions.status.active'),
          statusDisabled: t('positions.status.disabled'),
          updatedAt: t('positions.column.updatedAt'),
        },
        {
          canDelete,
          canUpdate,
          onDelete: setDeleteTarget,
          onEdit: (position) => setFormState({ mode: 'edit', position }),
        },
      ),
    [canDelete, canUpdate, t],
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

  function handleSubmit(value: PositionFormSubmitValue) {
    if (formState?.mode === 'edit') {
      updateMutation.mutate({
        id: formState.position.id,
        value: value as UpdatePositionRequest,
      })
      return
    }

    createMutation.mutate(value as CreatePositionRequest)
  }

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('positions.title')}
        </h2>
        {canCreate ? (
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-white transition hover:bg-cyan-600"
            onClick={() => setFormState({ mode: 'create' })}
            type="button"
          >
            <Plus size={16} />
            {t('positions.action.create')}
          </button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={positionsQuery.data?.items ?? []}
        emptyLabel={t('positions.state.empty')}
        error={positionsQuery.error}
        errorLabel={t('positions.error.load')}
        formatError={(error, fallback) => getErrorMessage(error, fallback, t)}
        isLoading={positionsQuery.isLoading}
        loadingLabel={t('positions.state.loading')}
        onPaginationChange={handlePaginationChange}
        onRetry={() => positionsQuery.refetch()}
        onSortingChange={handleSortingChange}
        pagination={pagination}
        retryLabel={t('positions.state.retry')}
        sorting={sorting}
        toolbar={
          <DataTableToolbar
            filters={
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span>{t('positions.form.status')}</span>
                <select
                  aria-label={t('positions.filter.status')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) => handleStatusChange(event.target.value)}
                  value={status}
                >
                  <option value={allStatusFilter}>
                    {t('positions.filter.allStatuses')}
                  </option>
                  <option value="ACTIVE">{t('positions.status.active')}</option>
                  <option value="DISABLED">
                    {t('positions.status.disabled')}
                  </option>
                </select>
              </label>
            }
            onSearchChange={handleSearchChange}
            searchLabel={t('positions.searchPlaceholder')}
            searchPlaceholder={t('positions.searchPlaceholder')}
            searchValue={search}
          />
        }
        total={positionsQuery.data?.total ?? 0}
      />

      {formState ? (
        <div
          aria-modal="true"
          aria-label={
            formState.mode === 'create'
              ? t('positions.action.create')
              : t('positions.action.edit')
          }
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">
                {formState.mode === 'create'
                  ? t('positions.action.create')
                  : t('positions.action.edit')}
              </h3>
            </div>
            <PositionForm
              initialValue={
                formState.mode === 'edit' ? formState.position : undefined
              }
              isSubmitting={createMutation.isPending || updateMutation.isPending}
              mode={formState.mode}
              onCancel={() => setFormState(null)}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          aria-label={t('positions.delete.confirmTitle')}
          aria-modal="true"
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">
              {t('positions.delete.confirmTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{deleteTarget.code}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                {t('positions.form.cancel')}
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                type="button"
              >
                {t('positions.delete.confirmTitle')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
