import type { ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, RefreshCw } from 'lucide-react'
import { DataTablePagination } from './DataTablePagination'

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  total: number
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
  loadingLabel?: string
  emptyLabel?: string
  errorLabel?: string
  retryLabel?: string
  toolbar?: ReactNode
}

export function DataTable<TData>({
  columns,
  data,
  total,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  isLoading = false,
  error,
  onRetry,
  loadingLabel = 'Loading rows',
  emptyLabel = 'No rows found',
  errorLabel = 'Unable to load rows',
  retryLabel = 'Retry',
  toolbar,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    rowCount: total,
    state: {
      pagination,
      sorting,
    },
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    onPaginationChange,
    onSortingChange,
  })

  const leafColumnCount = table.getVisibleLeafColumns().length
  const hasRows = table.getRowModel().rows.length > 0

  function handlePageChange(pageIndex: number) {
    onPaginationChange((currentPagination) => ({
      ...currentPagination,
      pageIndex,
    }))
  }

  function handlePageSizeChange(pageSize: number) {
    onPaginationChange((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
      pageSize,
    }))
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {toolbar}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sortDirection = header.column.getIsSorted()

                  return (
                    <th
                      className="h-11 border-b border-slate-200 px-4 font-semibold"
                      key={header.id}
                      style={{
                        width:
                          header.getSize() === 150
                            ? undefined
                            : header.getSize(),
                      }}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="inline-flex h-8 items-center gap-1.5 rounded-md text-left transition hover:text-slate-950"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sortDirection === 'asc' ? (
                            <ArrowUp size={14} />
                          ) : sortDirection === 'desc' ? (
                            <ArrowDown size={14} />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td
                  className="h-24 px-4 text-center text-sm text-slate-500"
                  colSpan={leafColumnCount}
                >
                  {loadingLabel}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  className="h-24 px-4 text-center text-sm text-slate-500"
                  colSpan={leafColumnCount}
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <span>{error.message || errorLabel}</span>
                    {onRetry ? (
                      <button
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        onClick={onRetry}
                        type="button"
                      >
                        <RefreshCw size={16} />
                        {retryLabel}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : hasRows ? (
              table.getRowModel().rows.map((row) => (
                <tr className="transition hover:bg-slate-50" key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      className="h-12 whitespace-nowrap px-4 text-slate-700"
                      key={cell.id}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="h-24 px-4 text-center text-sm text-slate-500"
                  colSpan={leafColumnCount}
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DataTablePagination
        pageIndex={pagination.pageIndex}
        pageSize={pagination.pageSize}
        total={total}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </section>
  )
}

export type { ColumnDef, PaginationState, SortingState }
