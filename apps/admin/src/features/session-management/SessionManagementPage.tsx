import { useMemo, useState } from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '../../app/api-error-messages'
import { DataTable } from '../../components/data-table/DataTable'
import { DataTableToolbar } from '../../components/data-table/DataTableToolbar'
import type {
  PaginationState,
  SortingState,
} from '../../components/data-table/DataTable'
import {
  getListUserSessionsQueryKey,
  listUserSessions,
  revokeUserSession,
} from '../../generated/api/endpoints/user-sessions/user-sessions'
import type { ListUserSessionsParams } from '../../generated/api/schemas'
import { useI18n } from '../../i18n/useI18n'
import { can } from '../../lib/permissions'
import { useAuthStore } from '../../stores/auth-store'
import { createSessionManagementColumns } from './session-management.columns'
import type {
  SessionListQuery,
  SessionRecord,
  SessionStatus,
} from './session-management.types'

type SessionFilters = Pick<
  SessionListQuery,
  'dateFrom' | 'dateTo' | 'ipAddress' | 'status'
>

const sessionStatuses = ['active', 'expired', 'revoked'] as const

function toSortParam(sorting: SortingState) {
  const firstSort = sorting[0]

  if (!firstSort) {
    return undefined
  }

  return `${firstSort.id}:${firstSort.desc ? 'desc' : 'asc'}`
}

function compactFilters(filters: SessionFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value)),
  ) as SessionFilters
}

function toStartOfDayIso(date: string) {
  return `${date}T00:00:00.000Z`
}

function toEndOfDayIso(date: string) {
  return `${date}T23:59:59.999Z`
}

function toListUserSessionsQuery(query: SessionListQuery): SessionListQuery {
  const dateFrom = query.dateFrom ? toStartOfDayIso(query.dateFrom) : undefined
  const dateTo = query.dateTo ? toEndOfDayIso(query.dateTo) : undefined

  return {
    ...query,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }
}

export function SessionManagementPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.permissions)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [filters, setFilters] = useState<SessionFilters>({})
  const [revokeTarget, setRevokeTarget] = useState<SessionRecord | null>(null)

  const canRevoke = can(permissions, 'user_session.revoke')

  const queryParams = useMemo(() => {
    const trimmedSearch = search.trim()

    return toListUserSessionsQuery({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
      ...(toSortParam(sorting) ? { sort: toSortParam(sorting) } : {}),
      ...compactFilters(filters),
    }) as unknown as ListUserSessionsParams
  }, [filters, pagination.pageIndex, pagination.pageSize, search, sorting])

  const sessionsQuery = useQuery({
    queryKey: getListUserSessionsQueryKey(
      queryParams as unknown as ListUserSessionsParams,
    ),
    queryFn: () =>
      listUserSessions(queryParams as unknown as ListUserSessionsParams),
  })

  const invalidateSessions = async () => {
    await queryClient.invalidateQueries({
      queryKey: getListUserSessionsQueryKey(),
    })
  }

  const revokeMutation = useMutation({
    mutationFn: (session: SessionRecord) => revokeUserSession(session.id),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('sessionManagement.error.revoke'), t))
    },
    onSuccess: async () => {
      toast.success(t('sessionManagement.success.revoke'))
      setRevokeTarget(null)
      await invalidateSessions()
    },
  })

  const columns = useMemo(
    () =>
      createSessionManagementColumns(
        {
          actions: t('sessionManagement.column.actions'),
          currentSession: t('sessionManagement.action.currentSession'),
          device: t('sessionManagement.column.device'),
          expiresAt: t('sessionManagement.column.expiresAt'),
          ipAddress: t('sessionManagement.column.ipAddress'),
          lastUsedAt: t('sessionManagement.column.lastUsedAt'),
          loginTime: t('sessionManagement.column.loginTime'),
          revoke: t('sessionManagement.action.revoke'),
          status: t('sessionManagement.column.status'),
          statusLabels: {
            active: t('sessionManagement.status.active'),
            expired: t('sessionManagement.status.expired'),
            revoked: t('sessionManagement.status.revoked'),
          },
          user: t('sessionManagement.column.user'),
        },
        {
          canRevoke,
          onRevoke: setRevokeTarget,
        },
      ),
    [canRevoke, t],
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

  function resetToFirstPage() {
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    resetToFirstPage()
  }

  function handleFilterChange(key: keyof SessionFilters, value: string) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value || undefined,
    }) as SessionFilters)
    resetToFirstPage()
  }

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('sessionManagement.title')}
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={sessionsQuery.data?.items ?? []}
        emptyLabel={t('sessionManagement.state.empty')}
        error={sessionsQuery.error}
        errorLabel={t('sessionManagement.error.load')}
        formatError={(error, fallback) => getErrorMessage(error, fallback, t)}
        isLoading={sessionsQuery.isLoading}
        loadingLabel={t('sessionManagement.state.loading')}
        onPaginationChange={handlePaginationChange}
        onRetry={() => sessionsQuery.refetch()}
        onSortingChange={handleSortingChange}
        pagination={pagination}
        retryLabel={t('sessionManagement.state.retry')}
        sorting={sorting}
        toolbar={
          <DataTableToolbar
            filters={
              <>
                <select
                  aria-label={t('sessionManagement.filter.status')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) =>
                    handleFilterChange(
                      'status',
                      event.target.value as SessionStatus,
                    )
                  }
                  value={filters.status ?? ''}
                >
                  <option value="">{t('sessionManagement.filter.status')}</option>
                  {sessionStatuses.map((status) => (
                    <option key={status} value={status}>
                      {t(`sessionManagement.status.${status}`)}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={t('sessionManagement.filter.ipAddress')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) =>
                    handleFilterChange('ipAddress', event.target.value)
                  }
                  placeholder={t('sessionManagement.filter.ipAddress')}
                  type="search"
                  value={filters.ipAddress ?? ''}
                />
                <input
                  aria-label={t('sessionManagement.filter.dateFrom')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) =>
                    handleFilterChange('dateFrom', event.target.value)
                  }
                  type="date"
                  value={filters.dateFrom ?? ''}
                />
                <input
                  aria-label={t('sessionManagement.filter.dateTo')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) =>
                    handleFilterChange('dateTo', event.target.value)
                  }
                  type="date"
                  value={filters.dateTo ?? ''}
                />
              </>
            }
            onSearchChange={handleSearchChange}
            searchLabel={t('sessionManagement.searchPlaceholder')}
            searchPlaceholder={t('sessionManagement.searchPlaceholder')}
            searchValue={search}
          />
        }
        total={sessionsQuery.data?.total ?? 0}
      />

      {revokeTarget ? (
        <div
          aria-label={t('sessionManagement.revoke.confirmTitle')}
          aria-modal="true"
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">
              {t('sessionManagement.revoke.confirmTitle')}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('sessionManagement.revoke.confirmDescription')}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {revokeTarget.user.email}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                disabled={revokeMutation.isPending}
                onClick={() => setRevokeTarget(null)}
                type="button"
              >
                {t('sessionManagement.action.cancel')}
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(revokeTarget)}
                type="button"
              >
                {t('sessionManagement.revoke.confirmAction')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
