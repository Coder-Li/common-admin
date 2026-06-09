import { Eye } from 'lucide-react'
import type { ColumnDef } from '../../components/data-table/DataTable'
import type { AuditLogListItem } from './audit-logs.types'

export interface AuditLogColumnLabels {
  actions: string
  action: string
  actor: string
  createdAt: string
  ipAddress: string
  resourceId: string
  resourceType: string
  viewDetails: string
}

export interface AuditLogRowActions {
  onViewDetails: (auditLog: AuditLogListItem) => void
}

export function formatAuditDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function actorLabel(auditLog: AuditLogListItem) {
  return auditLog.actorEmail ?? auditLog.actorName ?? auditLog.actorUserId ?? '-'
}

export function createAuditLogColumns(
  labels: AuditLogColumnLabels,
  actions: AuditLogRowActions,
): ColumnDef<AuditLogListItem>[] {
  return [
    {
      accessorKey: 'createdAt',
      header: labels.createdAt,
      cell: ({ row }) => formatAuditDateTime(row.original.createdAt),
      size: 180,
    },
    {
      accessorKey: 'actorEmail',
      header: labels.actor,
      cell: ({ row }) => (
        <span className="font-medium text-slate-950">
          {actorLabel(row.original)}
        </span>
      ),
      size: 220,
    },
    {
      accessorKey: 'action',
      header: labels.action,
      size: 160,
    },
    {
      accessorKey: 'resourceType',
      header: labels.resourceType,
      size: 160,
    },
    {
      accessorKey: 'resourceId',
      header: labels.resourceId,
      enableSorting: false,
      size: 180,
      cell: ({ row }) => row.original.resourceId ?? '-',
    },
    {
      accessorKey: 'ipAddress',
      header: labels.ipAddress,
      enableSorting: false,
      size: 140,
      cell: ({ row }) => row.original.ipAddress ?? '-',
    },
    {
      id: 'actions',
      header: labels.actions,
      enableSorting: false,
      size: 96,
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <button
            aria-label={labels.viewDetails}
            className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
            onClick={() => actions.onViewDetails(row.original)}
            title={labels.viewDetails}
            type="button"
          >
            <Eye size={16} />
          </button>
        </div>
      ),
    },
  ]
}
