import type { ColumnDef } from '../../components/data-table/DataTable'
import type { RoleRecord } from './roles.types'

export interface RoleColumnLabels {
  actions: string
  code: string
  dataScope: string
  dataScopes: Record<RoleRecord['dataScope'], string>
  customDataScopeCount: string
  delete: string
  edit: string
  isDefault: string
  isSystem: string
  name: string
  permissions: string
  status: string
  yes: string
  no: string
}

export interface RoleRowActions {
  canAssignPermissions: boolean
  canDelete: boolean
  canUpdate: boolean
  onDelete: (role: RoleRecord) => void
  onEdit: (role: RoleRecord) => void
  onPermissions: (role: RoleRecord) => void
}

export function createRoleColumns(
  labels: RoleColumnLabels,
  actions: RoleRowActions,
): ColumnDef<RoleRecord>[] {
  return [
    {
      accessorKey: 'code',
      header: labels.code,
      cell: ({ row }) => (
        <span className="font-medium text-slate-950">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: labels.name,
    },
    {
      accessorKey: 'status',
      header: labels.status,
      size: 120,
    },
    {
      accessorKey: 'dataScope',
      header: labels.dataScope,
      cell: ({ row }) =>
        row.original.dataScope === 'CUSTOM_DEPT'
          ? `${labels.customDataScopeCount} (${row.original.dataScopeDepartments.length})`
          : labels.dataScopes[row.original.dataScope],
    },
    {
      accessorKey: 'isSystem',
      header: labels.isSystem,
      cell: ({ row }) => (row.original.isSystem ? labels.yes : labels.no),
      size: 120,
    },
    {
      accessorKey: 'isDefault',
      header: labels.isDefault,
      cell: ({ row }) => (row.original.isDefault ? labels.yes : labels.no),
      size: 120,
    },
    {
      id: 'actions',
      header: labels.actions,
      enableSorting: false,
      size: 260,
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
          {actions.canAssignPermissions ? (
            <button
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={() => actions.onPermissions(row.original)}
              type="button"
            >
              {labels.permissions}
            </button>
          ) : null}
          {actions.canDelete ? (
            <button
              className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
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
