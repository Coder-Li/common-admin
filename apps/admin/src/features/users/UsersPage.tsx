import {
  useMemo,
  useState,
} from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '../../app/api-error-messages'
import { clearQueryCache } from '../../app/query-client'
import { DataTable } from '../../components/data-table/DataTable'
import { DataTableToolbar } from '../../components/data-table/DataTableToolbar'
import type {
  PaginationState,
  SortingState,
} from '../../components/data-table/DataTable'
import { useI18n } from '../../i18n/useI18n'
import { toApiListQuery } from '../../lib/crud/list-query'
import { can } from '../../lib/permissions'
import { useAuthStore } from '../../stores/auth-store'
import { UserForm } from './UserForm'
import {
  getDepartmentOptions,
  getGetDepartmentOptionsQueryKey,
} from '../../generated/api/endpoints/departments/departments'
import {
  getGetPositionOptionsQueryKey,
  getPositionOptions,
} from '../../generated/api/endpoints/positions/positions'
import {
  getListRolesQueryKey,
  listRoles,
} from '../../generated/api/endpoints/roles/roles'
import {
  createUser,
  deleteUser,
  getListUsersQueryKey,
  listUsers,
  replaceUserRoles,
  resetUserPassword,
  updateUser,
} from '../../generated/api/endpoints/users/users'
import type {
  ListRolesParams,
  ListUsersParams,
} from '../../generated/api/schemas'
import { createUserColumns } from './users.columns'
import type {
  CreateUserRequest,
  DepartmentOptionsParams,
  PositionOptionsParams,
  ResetUserPasswordRequest,
  UpdateUserRequest,
  UserListQuery,
  UserRecord,
} from './users.types'
import type { UserFormSubmitValue } from './UserForm'

type FormState =
  | { mode: 'create'; user?: undefined }
  | { mode: 'edit'; user: UserRecord }
  | null

const allRoleFilter = 'ALL'
const allDepartmentFilter = 'ALL'
const allPositionFilter = 'ALL'

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
  const permissions = useAuthStore((state) => state.permissions)
  const currentUserId = useAuthStore((state) => state.user?.id)
  const resetAuth = useAuthStore((state) => state.reset)
  const [search, setSearch] = useState('')
  const [roleCode, setRoleCode] = useState<string | typeof allRoleFilter>(
    allRoleFilter,
  )
  const [departmentId, setDepartmentId] = useState<
    string | typeof allDepartmentFilter
  >(allDepartmentFilter)
  const [positionId, setPositionId] = useState<string | typeof allPositionFilter>(
    allPositionFilter,
  )
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [formState, setFormState] = useState<FormState>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [resetPasswordTarget, setResetPasswordTarget] =
    useState<UserRecord | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const canCreate = can(permissions, 'user.create')
  const canUpdate = can(permissions, 'user.update')
  const canDelete = can(permissions, 'user.delete')
  const canAssignRoles = can(permissions, 'user.assign_roles')
  const canResetPassword = canUpdate

  const rolesQueryParams = useMemo(
    () =>
      ({
        page: 1,
        pageSize: 100,
        status: 'ACTIVE',
      }) as unknown as ListRolesParams,
    [],
  )

  const rolesQuery = useQuery({
    queryKey: getListRolesQueryKey(rolesQueryParams),
    queryFn: () => listRoles(rolesQueryParams),
  })
  const roleOptions = rolesQuery.data?.items ?? []

  const assignedDepartmentIds = useMemo(
    () =>
      formState?.mode === 'edit'
        ? (formState.user.departments ?? []).map((department) => department.id)
        : [],
    [formState],
  )
  const assignedPositionIds = useMemo(
    () =>
      formState?.mode === 'edit'
        ? (formState.user.positions ?? []).map((position) => position.id)
        : [],
    [formState],
  )
  const assignedDepartmentIncludeIds = useMemo(
    () => assignedDepartmentIds.join(',') || undefined,
    [assignedDepartmentIds],
  )
  const assignedPositionIncludeIds = useMemo(
    () => assignedPositionIds.join(',') || undefined,
    [assignedPositionIds],
  )

  const departmentOptionParams = useMemo(
    () =>
      ({
        status: 'ACTIVE',
        includeIds: assignedDepartmentIncludeIds,
      }) as DepartmentOptionsParams,
    [assignedDepartmentIncludeIds],
  )

  const positionOptionParams = useMemo(
    () =>
      ({
        status: 'ACTIVE',
        includeIds: assignedPositionIncludeIds,
      }) as PositionOptionsParams,
    [assignedPositionIncludeIds],
  )

  const activeOptionParams = useMemo(
    () => ({ status: 'ACTIVE' }) as DepartmentOptionsParams,
    [],
  )

  const activePositionOptionParams = useMemo(
    () => ({ status: 'ACTIVE' }) as PositionOptionsParams,
    [],
  )

  const departmentOptionsQuery = useQuery({
    queryKey: getGetDepartmentOptionsQueryKey(departmentOptionParams),
    queryFn: () => getDepartmentOptions(departmentOptionParams),
  })

  const positionOptionsQuery = useQuery({
    queryKey: getGetPositionOptionsQueryKey(positionOptionParams),
    queryFn: () => getPositionOptions(positionOptionParams),
  })

  const activeDepartmentOptionsQuery = useQuery({
    queryKey: getGetDepartmentOptionsQueryKey(activeOptionParams),
    queryFn: () => getDepartmentOptions(activeOptionParams),
  })

  const activePositionOptionsQuery = useQuery({
    queryKey: getGetPositionOptionsQueryKey(activePositionOptionParams),
    queryFn: () => getPositionOptions(activePositionOptionParams),
  })

  const departmentOptions = departmentOptionsQuery.data ?? []
  const positionOptions = positionOptionsQuery.data ?? []
  const activeDepartmentOptions = activeDepartmentOptionsQuery.data ?? []
  const activePositionOptions = activePositionOptionsQuery.data ?? []

  const usersQueryParams = useMemo(
    () =>
      toApiListQuery<
        {
          departmentId?: string
          positionId?: string
          roleCode?: string
        },
        UserListQuery
      >({
        filters: {
          ...(roleCode === allRoleFilter ? {} : { roleCode }),
          ...(departmentId === allDepartmentFilter ? {} : { departmentId }),
          ...(positionId === allPositionFilter ? {} : { positionId }),
        },
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        search,
        sort: toSortParam(sorting),
      }),
    [
      departmentId,
      pagination.pageIndex,
      pagination.pageSize,
      positionId,
      roleCode,
      search,
      sorting,
    ],
  )

  const usersQuery = useQuery({
    queryKey: getListUsersQueryKey(
      usersQueryParams as unknown as ListUsersParams,
    ),
    queryFn: () => listUsers(usersQueryParams as unknown as ListUsersParams),
  })

  const invalidateUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() })
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserRequest) => createUser(payload),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('users.error.create'), t))
    },
    onSuccess: async () => {
      toast.success(t('users.success.create'))
      setFormState(null)
      await invalidateUsers()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string
      roleCodes: string[]
      value: UpdateUserRequest
    }) => {
      let updatedUser: UserRecord | undefined
      if (canUpdate) {
        updatedUser = await updateUser(payload.id, payload.value)
      }

      if (canAssignRoles) {
        return replaceUserRoles(payload.id, { roleCodes: payload.roleCodes })
      }

      return updatedUser
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t('users.error.update'), t))
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
      toast.error(getErrorMessage(error, t('users.delete.error'), t))
    },
    onSuccess: async () => {
      toast.success(t('users.delete.success'))
      setDeleteTarget(null)
      await invalidateUsers()
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (payload: { id: string } & ResetUserPasswordRequest) =>
      resetUserPassword(payload.id, { newPassword: payload.newPassword }),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('users.resetPassword.error'), t))
    },
    onSuccess: async (_data, variables) => {
      toast.success(t('users.resetPassword.success'))
      setResetPasswordTarget(null)
      setNewPassword('')
      if (variables.id === currentUserId) {
        resetAuth()
        clearQueryCache()
        return
      }

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
          positions: t('users.column.positions'),
          primaryDepartment: t('users.column.primaryDepartment'),
          resetPassword: t('users.action.resetPassword'),
          role: t('users.column.role'),
          username: t('users.column.username'),
        },
        {
          canDelete,
          canResetPassword,
          canUpdate: canUpdate || canAssignRoles,
          onDelete: setDeleteTarget,
          onEdit: (user) => setFormState({ mode: 'edit', user }),
          onResetPassword: (user) => {
            setNewPassword('')
            setResetPasswordTarget(user)
          },
        },
      ),
    [canAssignRoles, canDelete, canResetPassword, canUpdate, t],
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

  function handleRoleChange(value: string | typeof allRoleFilter) {
    setRoleCode(value)
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function handleDepartmentChange(value: string | typeof allDepartmentFilter) {
    setDepartmentId(value)
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function handlePositionChange(value: string | typeof allPositionFilter) {
    setPositionId(value)
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function handleSubmit(value: UserFormSubmitValue) {
    if (formState?.mode === 'edit') {
      const { roleCodes, ...updateValue } = value as UpdateUserRequest & {
        roleCodes?: string[]
      }

      updateMutation.mutate({
        id: formState.user.id,
        roleCodes:
          Array.isArray(roleCodes)
            ? roleCodes
            : formState.user.roles.map((role) => role.code),
        value: updateValue,
      })
      return
    }

    createMutation.mutate(value as CreateUserRequest)
  }

  function handleResetPassword() {
    if (!resetPasswordTarget) {
      return
    }

    resetPasswordMutation.mutate({
      id: resetPasswordTarget.id,
      newPassword,
    })
  }

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('users.title')}
        </h2>
        {canCreate ? (
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-white transition hover:bg-cyan-600"
            onClick={() => setFormState({ mode: 'create' })}
            type="button"
          >
            <Plus size={16} />
            {t('users.action.create')}
          </button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={usersQuery.data?.items ?? []}
        emptyLabel={t('users.state.empty')}
        error={usersQuery.error}
        errorLabel={t('users.error.load')}
        formatError={(error, fallback) => getErrorMessage(error, fallback, t)}
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
              <>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <span>{t('users.form.role')}</span>
                  <select
                    aria-label={t('users.filter.role')}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                    onChange={(event) =>
                      handleRoleChange(event.target.value)
                    }
                    value={roleCode}
                  >
                    <option value={allRoleFilter}>
                      {t('users.filter.allRoles')}
                    </option>
                    {roleOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <span>{t('users.form.departmentFilter')}</span>
                  <select
                    aria-label={t('users.filter.department')}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                    onChange={(event) =>
                      handleDepartmentChange(event.target.value)
                    }
                    value={departmentId}
                  >
                    <option value={allDepartmentFilter}>
                      {t('users.filter.allDepartments')}
                    </option>
                    {activeDepartmentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <span>{t('users.form.positionFilter')}</span>
                  <select
                    aria-label={t('users.filter.position')}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                    onChange={(event) =>
                      handlePositionChange(event.target.value)
                    }
                    value={positionId}
                  >
                    <option value={allPositionFilter}>
                      {t('users.filter.allPositions')}
                    </option>
                    {activePositionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
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
              canAssignRoles={canAssignRoles}
              departmentOptions={departmentOptions}
              positionOptions={positionOptions}
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

      {resetPasswordTarget ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">
              {t('users.resetPassword.title')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {resetPasswordTarget.email}
            </p>
            <label className="mt-4 grid gap-1.5 text-sm">
              <span className="font-medium text-slate-700">
                {t('users.resetPassword.newPassword')}
              </span>
              <input
                aria-label={t('users.resetPassword.newPassword')}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </label>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                disabled={resetPasswordMutation.isPending}
                onClick={() => {
                  setResetPasswordTarget(null)
                  setNewPassword('')
                }}
                type="button"
              >
                {t('users.form.cancel')}
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={
                  resetPasswordMutation.isPending || newPassword.length < 8
                }
                onClick={handleResetPassword}
                type="button"
              >
                {t('users.action.resetPassword')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
