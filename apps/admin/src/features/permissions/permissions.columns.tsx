import type { ColumnDef } from '../../components/data-table/DataTable'
import type { PermissionRecord } from '../roles/roles.types'

export interface PermissionColumnLabels {
  action: string
  code: string
  module: string
  name: string
  sortOrder: string
  status: string
}

export function createPermissionColumns(
  labels: PermissionColumnLabels,
): ColumnDef<PermissionRecord>[] {
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
    },
    {
      accessorKey: 'module',
      header: labels.module,
      size: 140,
    },
    {
      accessorKey: 'action',
      header: labels.action,
      size: 180,
    },
    {
      accessorKey: 'status',
      header: labels.status,
      size: 120,
    },
    {
      accessorKey: 'sortOrder',
      header: labels.sortOrder,
      size: 120,
    },
  ]
}
