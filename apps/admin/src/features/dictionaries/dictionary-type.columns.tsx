import type { ColumnDef } from '../../components/data-table/DataTable'
import type { DictionaryTypeRecord } from './dictionaries.types'

export interface DictionaryTypeColumnLabels {
  actions: string
  code: string
  delete: string
  edit: string
  name: string
  select: string
  status: string
  system: string
  systemNo: string
  systemYes: string
  updatedAt: string
}

export interface DictionaryTypeRowActions {
  onDelete: (type: DictionaryTypeRecord) => void
  onEdit: (type: DictionaryTypeRecord) => void
  onSelect: (type: DictionaryTypeRecord) => void
  selectedTypeId?: string
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function createDictionaryTypeColumns(
  labels: DictionaryTypeColumnLabels,
  actions: DictionaryTypeRowActions,
): ColumnDef<DictionaryTypeRecord>[] {
  return [
    {
      accessorKey: 'code',
      header: labels.code,
      cell: ({ row }) => (
        <button
          aria-label={`${labels.select} ${row.original.code}`}
          className="font-medium text-cyan-700 transition hover:text-cyan-900"
          onClick={() => actions.onSelect(row.original)}
          type="button"
        >
          {row.original.code}
        </button>
      ),
    },
    {
      accessorKey: 'name',
      header: labels.name,
    },
    {
      accessorKey: 'status',
      header: labels.status,
      size: 110,
    },
    {
      accessorKey: 'isSystem',
      header: labels.system,
      cell: ({ row }) =>
        row.original.isSystem ? labels.systemYes : labels.systemNo,
      size: 110,
    },
    {
      accessorKey: 'updatedAt',
      header: labels.updatedAt,
      cell: ({ row }) => formatDateTime(row.original.updatedAt),
      size: 180,
    },
    {
      id: 'actions',
      header: labels.actions,
      enableSorting: false,
      size: 220,
      cell: ({ row }) => {
        const isSelected = actions.selectedTypeId === row.original.id

        return (
          <div className="flex items-center justify-end gap-2">
            <button
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSelected}
              onClick={() => actions.onSelect(row.original)}
              type="button"
            >
              {labels.select}
            </button>
            <button
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={() => actions.onEdit(row.original)}
              type="button"
            >
              {labels.edit}
            </button>
            <button
              className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={row.original.isSystem}
              onClick={() => actions.onDelete(row.original)}
              type="button"
            >
              {labels.delete}
            </button>
          </div>
        )
      },
    },
  ]
}
