import type { ColumnDef } from '../../components/data-table/DataTable'
import type { DictionaryItemRecord } from './dictionaries.types'

export interface DictionaryItemColumnLabels {
  actions: string
  badgeVariant: string
  default: string
  defaultNo: string
  defaultYes: string
  delete: string
  edit: string
  label: string
  sortOrder: string
  status: string
  updatedAt: string
  value: string
}

export interface DictionaryItemRowActions {
  canDelete: boolean
  canUpdate: boolean
  onDelete: (item: DictionaryItemRecord) => void
  onEdit: (item: DictionaryItemRecord) => void
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

export function createDictionaryItemColumns(
  labels: DictionaryItemColumnLabels,
  actions: DictionaryItemRowActions,
): ColumnDef<DictionaryItemRecord>[] {
  return [
    {
      accessorKey: 'value',
      header: labels.value,
      cell: ({ row }) => (
        <span className="font-medium text-slate-950">
          {row.original.value}
        </span>
      ),
    },
    {
      accessorKey: 'label',
      header: labels.label,
    },
    {
      accessorKey: 'sortOrder',
      header: labels.sortOrder,
      size: 110,
    },
    {
      accessorKey: 'status',
      header: labels.status,
      size: 110,
    },
    {
      accessorKey: 'isDefault',
      header: labels.default,
      cell: ({ row }) =>
        row.original.isDefault ? labels.defaultYes : labels.defaultNo,
      size: 110,
    },
    {
      accessorKey: 'badgeVariant',
      header: labels.badgeVariant,
      cell: ({ row }) => row.original.badgeVariant ?? '',
      enableSorting: false,
      size: 130,
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
      size: 160,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          {actions.canUpdate ? (
            <button
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={() => actions.onEdit(row.original)}
              type="button"
            >
              {labels.edit}
            </button>
          ) : null}
          {actions.canDelete ? (
            <button
              className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={row.original.isSystem}
              onClick={() => actions.onDelete(row.original)}
              type="button"
            >
              {labels.delete}
            </button>
          ) : null}
        </div>
      ),
    },
  ]
}
