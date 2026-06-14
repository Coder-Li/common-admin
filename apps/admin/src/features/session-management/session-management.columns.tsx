import type { ColumnDef } from '../../components/data-table/DataTable'
import type { SessionRecord, SessionStatus } from './session-management.types'

export interface SessionManagementColumnLabels {
  actions: string
  currentSession: string
  device: string
  expiresAt: string
  ipAddress: string
  lastUsedAt: string
  loginTime: string
  revoke: string
  status: string
  statusLabels: Record<SessionStatus, string>
  user: string
}

export interface SessionManagementRowActions {
  canRevoke: boolean
  onRevoke: (session: SessionRecord) => void
}

function formatDateTime(value?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDevice(session: SessionRecord) {
  const { browser, deviceType, os } = session.deviceSummary

  return [browser, os, deviceType].filter(Boolean).join(' / ')
}

function statusClassName(status: SessionStatus) {
  if (status === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (status === 'expired') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  return 'border-slate-200 bg-slate-100 text-slate-600'
}

export function createSessionManagementColumns(
  labels: SessionManagementColumnLabels,
  actions: SessionManagementRowActions,
): ColumnDef<SessionRecord>[] {
  return [
    {
      id: 'user',
      header: labels.user,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span className="font-medium text-slate-950">
            {row.original.user.email}
          </span>
          <span className="text-xs text-slate-500">
            {row.original.user.username}
          </span>
        </div>
      ),
      size: 220,
    },
    {
      accessorKey: 'status',
      header: labels.status,
      enableSorting: false,
      cell: ({ row }) => (
        <span
          className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${statusClassName(row.original.status)}`}
        >
          {labels.statusLabels[row.original.status]}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: 'createdAt',
      header: labels.loginTime,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
      size: 180,
    },
    {
      accessorKey: 'lastUsedAt',
      header: labels.lastUsedAt,
      cell: ({ row }) => formatDateTime(row.original.lastUsedAt),
      size: 180,
    },
    {
      accessorKey: 'expiresAt',
      header: labels.expiresAt,
      cell: ({ row }) => formatDateTime(row.original.expiresAt),
      size: 180,
    },
    {
      accessorKey: 'ipAddress',
      header: labels.ipAddress,
      enableSorting: false,
      cell: ({ row }) => row.original.ipAddress || '-',
      size: 140,
    },
    {
      id: 'device',
      header: labels.device,
      enableSorting: false,
      cell: ({ row }) => (
        <span title={row.original.userAgent ?? undefined}>
          {formatDevice(row.original)}
        </span>
      ),
      size: 220,
    },
    {
      id: 'actions',
      header: labels.actions,
      enableSorting: false,
      size: 140,
      cell: ({ row }) => {
        const session = row.original

        if (session.isCurrentSession) {
          return (
            <span className="text-sm font-medium text-slate-500">
              {labels.currentSession}
            </span>
          )
        }

        if (!actions.canRevoke || session.status !== 'active') {
          return null
        }

        return (
          <button
            className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
            onClick={() => actions.onRevoke(session)}
            type="button"
          >
            {labels.revoke}
          </button>
        )
      },
    },
  ]
}
