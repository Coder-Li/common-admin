import type { ColumnDef } from '../../components/data-table/DataTable'
import type { UserRecord } from './users.types'

export interface UserColumnLabels {
  username: string
  email: string
  fullName: string
  positions: string
  primaryDepartment: string
  role: string
  createdAt: string
  actions: string
  edit: string
  resetPassword: string
  delete: string
}

export interface UserRowActions {
  canDelete: boolean
  canResetPassword: boolean
  canUpdate: boolean
  onEdit: (user: UserRecord) => void
  onResetPassword: (user: UserRecord) => void
  onDelete: (user: UserRecord) => void
}

function formatFullName(user: UserRecord) {
  return `${user.firstName} ${user.lastName}`.trim()
}

function formatPrimaryDepartment(user: UserRecord) {
  return user.primaryDepartment?.name ?? '-'
}

function formatPositions(user: UserRecord) {
  const summary = (user.positions ?? [])
    .map((position) => position.name)
    .join(', ')

  return summary || '-'
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

export function createUserColumns(
  labels: UserColumnLabels,
  actions: UserRowActions,
): ColumnDef<UserRecord>[] {
  return [
    {
      accessorKey: 'username',
      header: labels.username,
      cell: ({ row }) => (
        <span className="font-medium text-slate-950">
          {row.original.username}
        </span>
      ),
    },
    {
      accessorKey: 'email',
      header: labels.email,
    },
    {
      id: 'fullName',
      header: labels.fullName,
      enableSorting: false,
      cell: ({ row }) => formatFullName(row.original),
    },
    {
      id: 'roles',
      header: labels.role,
      cell: ({ row }) =>
        row.original.roles.map((role) => role.name).join(', '),
      size: 120,
    },
    {
      id: 'primaryDepartment',
      header: labels.primaryDepartment,
      enableSorting: false,
      cell: ({ row }) => formatPrimaryDepartment(row.original),
      size: 160,
    },
    {
      id: 'positions',
      header: labels.positions,
      enableSorting: false,
      cell: ({ row }) => formatPositions(row.original),
      size: 160,
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
          {actions.canResetPassword ? (
            <button
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={() => actions.onResetPassword(row.original)}
              type="button"
            >
              {labels.resetPassword}
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
