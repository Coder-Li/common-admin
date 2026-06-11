import { useMemo, useState } from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '../../components/data-table/DataTable'
import { DataTableToolbar } from '../../components/data-table/DataTableToolbar'
import type {
  PaginationState,
  SortingState,
} from '../../components/data-table/DataTable'
import {
  getListPermissionModulesQueryKey,
  listPermissionModules,
} from '../../generated/api/endpoints/permissions/permissions'
import {
  createRole,
  deleteRole,
  getListRolesQueryKey,
  listRoles,
  replaceRolePermissions,
  updateRole,
} from '../../generated/api/endpoints/roles/roles'
import type {
  CreateRoleDto,
  ListRolesParams,
  UpdateRoleDto,
} from '../../generated/api/schemas'
import { useI18n } from '../../i18n/useI18n'
import { can } from '../../lib/permissions'
import { useAuthStore } from '../../stores/auth-store'
import { RoleForm } from './RoleForm'
import { RolePermissionPanel } from './RolePermissionPanel'
import { createRoleColumns } from './roles.columns'
import { rolePermissions } from './roles.permissions'
import type {
  CreateRoleRequest,
  RoleRecord,
  UpdateRoleRequest,
} from './roles.types'

type FormState =
  | { mode: 'create'; role?: undefined }
  | { mode: 'edit'; role: RoleRecord }
  | null

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

function toListRolesParams(params: {
  page: number
  pageSize: number
  search?: string
  sort?: string
}): ListRolesParams {
  return {
    ...params,
    page: params.page as unknown as ListRolesParams['page'],
    pageSize: params.pageSize as unknown as ListRolesParams['pageSize'],
  }
}

export function RolesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.permissions)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [formState, setFormState] = useState<FormState>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleRecord | null>(null)
  const [permissionTarget, setPermissionTarget] = useState<RoleRecord | null>(
    null,
  )

  const canCreate = can(permissions, rolePermissions.create)
  const canUpdate = can(permissions, rolePermissions.update)
  const canDelete = can(permissions, rolePermissions.delete)
  const canAssignPermissions = can(
    permissions,
    rolePermissions.assignPermissions,
  )
  const canReadPermissions = can(permissions, rolePermissions.readPermissions)

  const listParams = useMemo(
    () =>
      toListRolesParams({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        search: search || undefined,
        sort: toSortParam(sorting),
      }),
    [pagination.pageIndex, pagination.pageSize, search, sorting],
  )

  const rolesQuery = useQuery({
    queryKey: getListRolesQueryKey(listParams),
    queryFn: () => listRoles(listParams),
  })

  const modulesQuery = useQuery({
    queryKey: getListPermissionModulesQueryKey(),
    enabled: canReadPermissions,
    queryFn: () => listPermissionModules(),
  })

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() })

  const createMutation = useMutation({
    mutationFn: (payload: CreateRoleRequest) =>
      createRole(payload as CreateRoleDto),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('roles.error.create'))
    },
    onSuccess: async () => {
      toast.success(t('roles.success.create'))
      setFormState(null)
      await invalidateRoles()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; value: UpdateRoleRequest }) =>
      updateRole(payload.id, payload.value as UpdateRoleDto),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('roles.error.update'))
    },
    onSuccess: async () => {
      toast.success(t('roles.success.update'))
      setFormState(null)
      await invalidateRoles()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('roles.error.delete'))
    },
    onSuccess: async () => {
      toast.success(t('roles.success.delete'))
      setDeleteTarget(null)
      await invalidateRoles()
    },
  })

  const permissionsMutation = useMutation({
    mutationFn: (payload: { id: string; permissionCodes: string[] }) =>
      replaceRolePermissions(payload.id, {
        permissionCodes: payload.permissionCodes,
      }),
    onError: (error) => {
      toast.error(
        mutationErrorMessage(error) ?? t('roles.error.permissions'),
      )
    },
    onSuccess: async () => {
      toast.success(t('roles.success.permissions'))
      setPermissionTarget(null)
      await invalidateRoles()
    },
  })

  const columns = useMemo(
    () =>
      createRoleColumns(
        {
          actions: t('roles.column.actions'),
          code: t('roles.column.code'),
          delete: t('roles.action.delete'),
          edit: t('roles.action.edit'),
          isDefault: t('roles.column.default'),
          isSystem: t('roles.column.system'),
          name: t('roles.column.name'),
          permissions: t('roles.action.permissions'),
          status: t('roles.column.status'),
          yes: t('roles.value.yes'),
          no: t('roles.value.no'),
        },
        {
          canAssignPermissions,
          canDelete,
          canUpdate,
          onDelete: setDeleteTarget,
          onEdit: (role) => setFormState({ mode: 'edit', role }),
          onPermissions: setPermissionTarget,
        },
      ),
    [canAssignPermissions, canDelete, canUpdate, t],
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

  function handleSubmit(value: CreateRoleRequest | UpdateRoleRequest) {
    if (formState?.mode === 'edit') {
      updateMutation.mutate({
        id: formState.role.id,
        value: value as UpdateRoleRequest,
      })
      return
    }

    createMutation.mutate(value as CreateRoleRequest)
  }

  const listError =
    rolesQuery.error instanceof Error
      ? rolesQuery.error
      : rolesQuery.error
        ? new Error(t('roles.error.load'))
        : null

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('roles.title')}
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={rolesQuery.data?.items ?? []}
        emptyLabel={t('roles.state.empty')}
        error={listError}
        errorLabel={t('roles.error.load')}
        isLoading={rolesQuery.isLoading}
        loadingLabel={t('roles.state.loading')}
        onPaginationChange={handlePaginationChange}
        onRetry={() => rolesQuery.refetch()}
        onSortingChange={handleSortingChange}
        pagination={pagination}
        retryLabel={t('roles.state.retry')}
        sorting={sorting}
        toolbar={
          <DataTableToolbar
            onSearchChange={handleSearchChange}
            primaryAction={
              canCreate ? (
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-white transition hover:bg-cyan-600"
                  onClick={() => setFormState({ mode: 'create' })}
                  type="button"
                >
                  <Plus size={16} />
                  {t('roles.action.create')}
                </button>
              ) : null
            }
            searchLabel={t('roles.searchPlaceholder')}
            searchPlaceholder={t('roles.searchPlaceholder')}
            searchValue={search}
          />
        }
        total={rolesQuery.data?.total ?? 0}
      />

      {formState ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="mb-4 text-base font-semibold text-slate-950">
              {formState.mode === 'create'
                ? t('roles.action.create')
                : t('roles.action.edit')}
            </h3>
            <RoleForm
              initialValue={
                formState.mode === 'edit' ? formState.role : undefined
              }
              isSubmitting={
                createMutation.isPending || updateMutation.isPending
              }
              mode={formState.mode}
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
              {t('roles.delete.confirmTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {deleteTarget.name}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                {t('roles.form.cancel')}
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                type="button"
              >
                {t('roles.delete.confirmTitle')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {permissionTarget ? (
        <RolePermissionPanel
          isSubmitting={permissionsMutation.isPending}
          modules={modulesQuery.data ?? []}
          role={permissionTarget}
          onCancel={() => setPermissionTarget(null)}
          onSubmit={(permissionCodes) =>
            permissionsMutation.mutate({
              id: permissionTarget.id,
              permissionCodes,
            })
          }
        />
      ) : null}
    </section>
  )
}
