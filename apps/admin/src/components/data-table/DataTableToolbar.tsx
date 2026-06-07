import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

interface DataTableToolbarProps {
  searchValue: string
  searchLabel?: string
  searchPlaceholder?: string
  onSearchChange: (value: string) => void
  filters?: ReactNode
  primaryAction?: ReactNode
}

export function DataTableToolbar({
  searchValue,
  searchLabel = 'Search table',
  searchPlaceholder = 'Search',
  onSearchChange,
  filters,
  primaryAction,
}: DataTableToolbarProps) {
  return (
    <div className="flex min-h-14 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            aria-label={searchLabel}
            className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={searchValue}
          />
        </label>
        {filters ? (
          <div className="flex min-h-9 flex-wrap items-center gap-2">
            {filters}
          </div>
        ) : null}
      </div>

      {primaryAction ? (
        <div className="flex shrink-0 items-center justify-end">
          {primaryAction}
        </div>
      ) : null}
    </div>
  )
}
