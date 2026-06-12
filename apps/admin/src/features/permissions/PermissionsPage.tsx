import { useMemo, useState } from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '../../components/data-table/DataTable'
import { DataTableToolbar } from '../../components/data-table/DataTableToolbar'
import type {
  PaginationState,
  SortingState,
} from '../../components/data-table/DataTable'
import {
  getListPermissionsQueryKey,
  listPermissions,
} from '../../generated/api/endpoints/permissions/permissions'
import { useI18n } from '../../i18n/useI18n'
import type { PermissionRecord } from '../roles/roles.types'
import { createPermissionColumns } from './permissions.columns'

function matchesPermission(permission: PermissionRecord, search: string) {
  const keyword = search.trim().toLowerCase()

  if (!keyword) {
    return true
  }

  return [
    permission.name,
    permission.code,
    permission.module,
    permission.action,
    permission.status,
    permission.description ?? '',
  ].some((value) => String(value ?? '').toLowerCase().includes(keyword))
}

function compareValues(left: unknown, right: unknown) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return String(left ?? '').localeCompare(String(right ?? ''))
}

export function PermissionsPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  const permissionsQuery = useQuery({
    queryKey: getListPermissionsQueryKey(),
    queryFn: () => listPermissions(),
  })

  const permissions = useMemo(
    () => permissionsQuery.data ?? [],
    [permissionsQuery.data],
  )

  const filteredPermissions = useMemo(() => {
    const nextPermissions = permissions.filter((permission) =>
      matchesPermission(permission, search),
    )
    const firstSort = sorting[0]

    if (!firstSort) {
      return nextPermissions
    }

    return [...nextPermissions].sort((left, right) => {
      const result = compareValues(
        left[firstSort.id as keyof PermissionRecord],
        right[firstSort.id as keyof PermissionRecord],
      )

      return firstSort.desc ? -result : result
    })
  }, [permissions, search, sorting])

  const pagePermissions = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize
    return filteredPermissions.slice(start, start + pagination.pageSize)
  }, [filteredPermissions, pagination.pageIndex, pagination.pageSize])

  const columns = useMemo(
    () =>
      createPermissionColumns({
        action: t('permissions.column.action'),
        code: t('permissions.column.code'),
        module: t('permissions.column.module'),
        name: t('permissions.column.name'),
        sortOrder: t('permissions.column.sortOrder'),
        status: t('permissions.column.status'),
      }),
    [t],
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

  const error =
    permissionsQuery.error instanceof Error
      ? permissionsQuery.error
      : permissionsQuery.error
        ? new Error(t('permissions.error.load'))
        : null

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('permissions.title')}
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={pagePermissions}
        emptyLabel={t('permissions.state.empty')}
        error={error}
        errorLabel={t('permissions.error.load')}
        isLoading={permissionsQuery.isLoading}
        loadingLabel={t('permissions.state.loading')}
        onPaginationChange={handlePaginationChange}
        onRetry={() => permissionsQuery.refetch()}
        onSortingChange={handleSortingChange}
        pagination={pagination}
        retryLabel={t('permissions.state.retry')}
        sorting={sorting}
        toolbar={
          <DataTableToolbar
            onSearchChange={handleSearchChange}
            searchLabel={t('permissions.searchPlaceholder')}
            searchPlaceholder={t('permissions.searchPlaceholder')}
            searchValue={search}
          />
        }
        total={filteredPermissions.length}
      />
    </section>
  )
}
