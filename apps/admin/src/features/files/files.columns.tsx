import { Download, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '../../components/data-table/DataTable'
import type { FileRecord } from './files.types'

export interface FileColumnLabels {
  actions: string
  createdAt: string
  delete: string
  displayName: string
  download: string
  edit: string
  mimeType: string
  size: string
  storageDriver: string
}

export interface FileRowActions {
  onDelete: (file: FileRecord) => void
  onDownload: (file: FileRecord) => void
  onEdit: (file: FileRecord) => void
}

export function formatFileSize(value: string) {
  const size = Number(value)

  if (!Number.isFinite(size)) {
    return value
  }

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
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

export function createFileColumns(
  labels: FileColumnLabels,
  actions: FileRowActions,
): ColumnDef<FileRecord>[] {
  return [
    {
      accessorKey: 'displayName',
      header: labels.displayName,
      cell: ({ row }) => (
        <span className="font-medium text-slate-950">
          {row.original.displayName}
        </span>
      ),
    },
    {
      accessorKey: 'mimeType',
      header: labels.mimeType,
      size: 180,
    },
    {
      accessorKey: 'size',
      header: labels.size,
      cell: ({ row }) => formatFileSize(row.original.size),
      size: 120,
    },
    {
      accessorKey: 'storageDriver',
      header: labels.storageDriver,
      size: 120,
    },
    {
      accessorKey: 'createdAt',
      header: labels.createdAt,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
      size: 180,
    },
    {
      id: 'actions',
      header: labels.actions,
      enableSorting: false,
      size: 160,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            aria-label={labels.download}
            className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
            onClick={() => actions.onDownload(row.original)}
            title={labels.download}
            type="button"
          >
            <Download size={16} />
          </button>
          <button
            aria-label={labels.edit}
            className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
            onClick={() => actions.onEdit(row.original)}
            title={labels.edit}
            type="button"
          >
            <Pencil size={16} />
          </button>
          <button
            aria-label={labels.delete}
            className="inline-flex size-8 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-50"
            onClick={() => actions.onDelete(row.original)}
            title={labels.delete}
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ]
}
