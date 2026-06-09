import { X } from 'lucide-react'
import type { AuditLogRecord } from './audit-logs.types'
import { formatAuditDateTime } from './audit-logs.columns'

interface AuditLogDetailsDialogLabels {
  action: string
  after: string
  actor: string
  before: string
  close: string
  ipAddress: string
  metadata: string
  resource: string
  resourceId: string
  time: string
  title: string
  userAgent: string
}

interface AuditLogDetailsDialogProps {
  auditLog: AuditLogRecord
  labels: AuditLogDetailsDialogLabels
  onClose: () => void
}

function jsonBlock(value: unknown) {
  return JSON.stringify(value ?? null, null, 2)
}

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-normal text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm text-slate-950">{value ?? '-'}</dd>
    </div>
  )
}

function JsonSection({ label, value }: { label: string; value: unknown }) {
  return (
    <section className="min-w-0">
      <h4 className="text-sm font-semibold text-slate-950">{label}</h4>
      <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-50">
        {jsonBlock(value)}
      </pre>
    </section>
  )
}

export function AuditLogDetailsDialog({
  auditLog,
  labels,
  onClose,
}: AuditLogDetailsDialogProps) {
  return (
    <div
      aria-labelledby="audit-log-details-title"
      aria-modal="true"
      className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
      role="dialog"
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h3
            className="text-base font-semibold text-slate-950"
            id="audit-log-details-title"
          >
            {labels.title}
          </h3>
          <button
            aria-label={labels.close}
            className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField
            label={labels.time}
            value={formatAuditDateTime(auditLog.createdAt)}
          />
          <DetailField
            label={labels.actor}
            value={
              auditLog.actorName ??
              auditLog.actorEmail ??
              auditLog.actorUserId
            }
          />
          <DetailField label={labels.action} value={auditLog.action} />
          <DetailField label={labels.resource} value={auditLog.resourceType} />
          <DetailField label={labels.resourceId} value={auditLog.resourceId} />
          <DetailField label={labels.ipAddress} value={auditLog.ipAddress} />
          <DetailField label={labels.userAgent} value={auditLog.userAgent} />
        </dl>

        <div className="mt-5 grid gap-4">
          <JsonSection label={labels.before} value={auditLog.before} />
          <JsonSection label={labels.after} value={auditLog.after} />
          <JsonSection label={labels.metadata} value={auditLog.metadata} />
        </div>
      </div>
    </div>
  )
}
