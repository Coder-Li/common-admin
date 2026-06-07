import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

interface DataTablePaginationProps {
  pageIndex: number
  pageSize: number
  total: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}

function getPageCount(total: number, pageSize: number) {
  if (pageSize <= 0) {
    return 1
  }

  return Math.max(1, Math.ceil(total / pageSize))
}

export function DataTablePagination({
  pageIndex,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const pageCount = getPageCount(total, pageSize)
  const currentPage = Math.min(pageIndex + 1, pageCount)
  const canPreviousPage = pageIndex > 0
  const canNextPage = currentPage < pageCount

  function handlePageSizeChange(nextPageSize: number) {
    onPageSizeChange(nextPageSize)
    onPageChange(0)
  }

  return (
    <div className="flex min-h-14 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Page {currentPage} of {pageCount}
        <span className="ml-2 text-slate-400">({total} total)</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 items-center rounded-md border border-slate-300 bg-white p-0.5">
          {PAGE_SIZE_OPTIONS.map((option) => (
            <button
              className={[
                'h-8 min-w-10 rounded px-2 text-sm transition',
                option === pageSize
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
              key={option}
              onClick={() => handlePageSizeChange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            aria-label="Previous page"
            className="grid size-9 place-items-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canPreviousPage}
            onClick={() => onPageChange(pageIndex - 1)}
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            aria-label="Next page"
            className="grid size-9 place-items-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canNextPage}
            onClick={() => onPageChange(pageIndex + 1)}
            type="button"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
