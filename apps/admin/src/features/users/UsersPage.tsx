import {
  useMemo,
  useState,
} from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '../../components/data-table/DataTable'
import { DataTableToolbar } from '../../components/data-table/DataTableToolbar'
import type {
  PaginationState,
  SortingState,
} from '../../components/data-table/DataTable'
import { useI18n } from '../../i18n/useI18n'
import { useServerTableQuery } from '../../lib/crud/useServerTableQuery'
import {
  getDictionaryLabel,
  mergeRoleFallbackOptions,
} from '../../lib/dictionaries/dictionary-label'
import { useDictionary } from '../../lib/dictionaries/useDictionary'
import { UserForm } from './UserForm'
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from './users.api'
import { createUserColumns } from './users.columns'
import type {
  CreateUserRequest,
  Role,
  UpdateUserRequest,
  UserListQuery,
  UserRecord,
} from './users.types'

type FormState =
  | { mode: 'create'; user?: undefined }
  | { mode: 'edit'; user: UserRecord }
  | null

const allRoleFilter = 'ALL'

function mutationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

function toSortParam(sorting: SortingState) {
  const firstSort = sorting[0]

  if (!firstSort) {
    return undefined
  }

  return `${firstSort.id}:${firstSort.desc ? 'desc' : 'asc'}`
}

export function UsersPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<Role | typeof allRoleFilter>(allRoleFilter)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [formState, setFormState] = useState<FormState>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const roleDictionary = useDictionary('user_role')

  const roleFallbackLabels = useMemo(
    () => ({
      ADMIN: t('users.role.admin'),
      STANDARD: t('users.role.standard'),
    }),
    [t],
  )
  const roleOptions = useMemo(
    () =>
      mergeRoleFallbackOptions(
        roleDictionary.options,
        roleFallbackLabels,
      ),
    [roleDictionary.options, roleFallbackLabels],
  )

  const usersQuery = useServerTableQuery<UserRecord, { role?: Role }, UserListQuery>({
    resource: 'users',
    state: {
      filters: role === allRoleFilter ? {} : { role },
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      search,
      sort: toSortParam(sorting),
    },
    queryFn: listUsers,
  })

  const invalidateUsers = () => queryClient.invalidateQueries({
    queryKey: ['users', 'list'],
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserRequest) => createUser(payload),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('users.error.create'))
    },
    onSuccess: async () => {
      toast.success(t('users.success.create'))
      setFormState(null)
      await invalidateUsers()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; value: UpdateUserRequest }) =>
      updateUser(payload.id, payload.value),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('users.error.update'))
    },
    onSuccess: async () => {
      toast.success(t('users.success.update'))
      setFormState(null)
      await invalidateUsers()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('users.delete.error'))
    },
    onSuccess: async () => {
      toast.success(t('users.delete.success'))
      setDeleteTarget(null)
      await invalidateUsers()
    },
  })

  const columns = useMemo(
    () =>
      createUserColumns(
        {
          actions: t('users.column.actions'),
          createdAt: t('users.column.createdAt'),
          delete: t('users.action.delete'),
          edit: t('users.action.edit'),
          email: t('users.column.email'),
          fullName: t('users.column.fullName'),
          role: t('users.column.role'),
          formatRole: (role) => getDictionaryLabel(roleOptions, role, role),
          username: t('users.column.username'),
        },
        {
          onDelete: setDeleteTarget,
          onEdit: (user) => setFormState({ mode: 'edit', user }),
        },
      ),
    [roleOptions, t],
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

  function handleRoleChange(value: Role | typeof allRoleFilter) {
    setRole(value)
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function handleSubmit(value: CreateUserRequest | UpdateUserRequest) {
    if (formState?.mode === 'edit') {
      updateMutation.mutate({
        id: formState.user.id,
        value: value as UpdateUserRequest,
      })
      return
    }

    createMutation.mutate(value as CreateUserRequest)
  }

  const listError =
    usersQuery.error instanceof Error
      ? usersQuery.error
      : usersQuery.error
        ? new Error(t('users.error.load'))
        : null

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('users.title')}
        </h2>
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-white transition hover:bg-cyan-600"
          onClick={() => setFormState({ mode: 'create' })}
          type="button"
        >
          <Plus size={16} />
          {t('users.action.create')}
        </button>
      </div>

      <DataTable
        columns={columns}
        data={usersQuery.data?.items ?? []}
        emptyLabel={t('users.state.empty')}
        error={listError}
        errorLabel={t('users.error.load')}
        isLoading={usersQuery.isLoading}
        loadingLabel={t('users.state.loading')}
        onPaginationChange={handlePaginationChange}
        onRetry={() => usersQuery.refetch()}
        onSortingChange={handleSortingChange}
        pagination={pagination}
        retryLabel={t('users.state.retry')}
        sorting={sorting}
        toolbar={
          <DataTableToolbar
            filters={
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span>{t('users.form.role')}</span>
                <select
                  aria-label={t('users.filter.role')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) =>
                    handleRoleChange(
                      event.target.value as Role | typeof allRoleFilter,
                    )
                  }
                  value={role}
                >
                  <option value={allRoleFilter}>
                    {t('users.filter.allRoles')}
                  </option>
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            }
            onSearchChange={handleSearchChange}
            searchLabel={t('users.searchPlaceholder')}
            searchPlaceholder={t('users.searchPlaceholder')}
            searchValue={search}
          />
        }
        total={usersQuery.data?.total ?? 0}
      />

      {formState ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">
                {formState.mode === 'create'
                  ? t('users.action.create')
                  : t('users.action.edit')}
              </h3>
            </div>
            <UserForm
              initialValue={formState.mode === 'edit' ? formState.user : undefined}
              isSubmitting={
                createMutation.isPending || updateMutation.isPending
              }
              mode={formState.mode}
              roleOptions={roleOptions}
              onCancel={() => setFormState(null)}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">
              {t('users.delete.confirmTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {deleteTarget.email}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                {t('users.form.cancel')}
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                type="button"
              >
                {t('users.delete.confirmTitle')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
