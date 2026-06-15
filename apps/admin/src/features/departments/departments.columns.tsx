import type { ColumnDef } from '../../components/data-table/DataTable'
import type { DepartmentRecord } from './departments.types'

export interface DepartmentColumnLabels {
  actions: string
  code: string
  delete: string
  description: string
  edit: string
  name: string
  parent: string
  sortOrder: string
  status: string
  statusActive: string
  statusDisabled: string
  updatedAt: string
}

export interface DepartmentRowActions {
  canDelete: boolean
  canUpdate: boolean
  onDelete: (department: DepartmentRecord) => void
  onEdit: (department: DepartmentRecord) => void
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

function statusLabel(department: DepartmentRecord, labels: DepartmentColumnLabels) {
  return department.status === 'ACTIVE'
    ? labels.statusActive
    : labels.statusDisabled
}

export function createDepartmentColumns(
  labels: DepartmentColumnLabels,
  actions: DepartmentRowActions,
): ColumnDef<DepartmentRecord>[] {
  return [
    {
      accessorKey: 'name',
      header: labels.name,
      cell: ({ row }) => (
        <span className="font-medium text-slate-950">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'code',
      header: labels.code,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-700">
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'parentName',
      header: labels.parent,
      enableSorting: false,
      cell: ({ row }) => row.original.parentName ?? '-',
    },
    {
      accessorKey: 'status',
      header: labels.status,
      enableSorting: false,
      cell: ({ row }) => (
        <span
          className={
            row.original.status === 'ACTIVE'
              ? 'inline-flex h-6 items-center rounded-md bg-emerald-50 px-2 text-xs font-medium text-emerald-700'
              : 'inline-flex h-6 items-center rounded-md bg-slate-100 px-2 text-xs font-medium text-slate-600'
          }
        >
          {statusLabel(row.original, labels)}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'sortOrder',
      header: labels.sortOrder,
      size: 100,
    },
    {
      id: 'description',
      header: labels.description,
      enableSorting: false,
      cell: ({ row }) => row.original.description ?? '-',
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
      size: 140,
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
              className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
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
