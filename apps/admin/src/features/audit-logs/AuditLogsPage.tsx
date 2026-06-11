import { useMemo, useState } from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useMutation } from '@tanstack/react-query'
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
  getAuditLog,
  listAuditLogs,
} from '../../generated/api/endpoints/audit-logs/audit-logs'
import type { ListAuditLogsParams } from '../../generated/api/schemas'
import { AuditLogDetailsDialog } from './AuditLogDetailsDialog'
import { createAuditLogColumns } from './audit-logs.columns'
import type {
  AuditLogListItem,
  AuditLogListQuery,
  AuditLogRecord,
} from './audit-logs.types'

type AuditLogFilters = Pick<
  AuditLogListQuery,
  'action' | 'dateFrom' | 'dateTo' | 'resourceType'
>

type AuditLogTableQuery = AuditLogListQuery & {
  page: number
  pageSize: number
}

const ACTION_OPTIONS = [
  'create',
  'update',
  'delete',
  'reset_password',
  'replace_roles',
  'replace_permissions',
] as const

const RESOURCE_TYPE_OPTIONS = [
  'user',
  'role',
  'permission',
  'dictionary_type',
  'dictionary_item',
  'file',
] as const

function toSortParam(sorting: SortingState) {
  const firstSort = sorting[0]

  if (!firstSort) {
    return undefined
  }

  return `${firstSort.id}:${firstSort.desc ? 'desc' : 'asc'}`
}

function compactFilters(filters: AuditLogFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value)),
  ) as AuditLogFilters
}

function mutationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

function toListAuditLogsParams(query: AuditLogTableQuery): ListAuditLogsParams {
  return {
    ...query,
    page: query.page as unknown as ListAuditLogsParams['page'],
    pageSize: query.pageSize as unknown as ListAuditLogsParams['pageSize'],
  } as unknown as ListAuditLogsParams
}

export function AuditLogsPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [filters, setFilters] = useState<AuditLogFilters>({})
  const [details, setDetails] = useState<AuditLogRecord | null>(null)

  const auditLogsQuery = useServerTableQuery<
    AuditLogListItem,
    AuditLogFilters,
    AuditLogTableQuery
  >({
    resource: 'auditLogs',
    state: {
      filters: compactFilters(filters),
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      search,
      sort: toSortParam(sorting),
    },
    queryFn: (query) => listAuditLogs(toListAuditLogsParams(query)),
  })

  const detailsMutation = useMutation({
    mutationFn: (auditLog: AuditLogListItem) => getAuditLog(auditLog.id),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('auditLogs.error.detail'))
    },
    onSuccess: (auditLog) => setDetails(auditLog),
  })

  const columns = useMemo(
    () =>
      createAuditLogColumns(
        {
          action: t('auditLogs.column.action'),
          actions: t('auditLogs.column.actions'),
          actor: t('auditLogs.column.actor'),
          createdAt: t('auditLogs.column.createdAt'),
          ipAddress: t('auditLogs.column.ipAddress'),
          resourceId: t('auditLogs.column.resourceId'),
          resourceType: t('auditLogs.column.resourceType'),
          viewDetails: t('auditLogs.action.viewDetails'),
        },
        {
          onViewDetails: (auditLog) => detailsMutation.mutate(auditLog),
        },
      ),
    [detailsMutation, t],
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

  function handleFilterChange(key: keyof AuditLogFilters, value: string) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value || undefined,
    }) as AuditLogFilters)
    resetToFirstPage()
  }

  const listError =
    auditLogsQuery.error instanceof Error
      ? auditLogsQuery.error
      : auditLogsQuery.error
        ? new Error(t('auditLogs.error.load'))
        : null

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('auditLogs.title')}
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={auditLogsQuery.data?.items ?? []}
        emptyLabel={t('auditLogs.state.empty')}
        error={listError}
        errorLabel={t('auditLogs.error.load')}
        isLoading={auditLogsQuery.isLoading}
        loadingLabel={t('auditLogs.state.loading')}
        onPaginationChange={handlePaginationChange}
        onRetry={() => auditLogsQuery.refetch()}
        onSortingChange={handleSortingChange}
        pagination={pagination}
        retryLabel={t('auditLogs.state.retry')}
        sorting={sorting}
        toolbar={
          <DataTableToolbar
            filters={
              <>
                <select
                  aria-label={t('auditLogs.filter.action')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) =>
                    handleFilterChange('action', event.target.value)
                  }
                  value={filters.action ?? ''}
                >
                  <option value="">{t('auditLogs.filter.action')}</option>
                  {ACTION_OPTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t('auditLogs.filter.resourceType')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) =>
                    handleFilterChange('resourceType', event.target.value)
                  }
                  value={filters.resourceType ?? ''}
                >
                  <option value="">{t('auditLogs.filter.resourceType')}</option>
                  {RESOURCE_TYPE_OPTIONS.map((resourceType) => (
                    <option key={resourceType} value={resourceType}>
                      {resourceType}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={t('auditLogs.filter.dateFrom')}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) =>
                    handleFilterChange('dateFrom', event.target.value)
                  }
                  type="date"
                  value={filters.dateFrom ?? ''}
                />
                <input
                  aria-label={t('auditLogs.filter.dateTo')}
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
            searchLabel={t('auditLogs.searchPlaceholder')}
            searchPlaceholder={t('auditLogs.searchPlaceholder')}
            searchValue={search}
          />
        }
        total={auditLogsQuery.data?.total ?? 0}
      />

      {details ? (
        <AuditLogDetailsDialog
          auditLog={details}
          labels={{
            action: t('auditLogs.details.action'),
            after: t('auditLogs.details.after'),
            actor: t('auditLogs.details.actor'),
            before: t('auditLogs.details.before'),
            close: t('auditLogs.details.close'),
            ipAddress: t('auditLogs.details.ipAddress'),
            metadata: t('auditLogs.details.metadata'),
            resource: t('auditLogs.details.resource'),
            resourceId: t('auditLogs.details.resourceId'),
            time: t('auditLogs.details.time'),
            title: t('auditLogs.details.title'),
            userAgent: t('auditLogs.details.userAgent'),
          }}
          onClose={() => setDetails(null)}
        />
      ) : null}
    </section>
  )
}
