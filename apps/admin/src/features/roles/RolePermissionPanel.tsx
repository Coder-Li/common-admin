import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import type { PermissionModule, RoleRecord } from './roles.types'

interface RolePermissionPanelProps {
  isSubmitting: boolean
  modules: PermissionModule[]
  role: RoleRecord
  onCancel: () => void
  onSubmit: (permissionCodes: string[]) => void
}

export function RolePermissionPanel({
  isSubmitting,
  modules,
  role,
  onCancel,
  onSubmit,
}: RolePermissionPanelProps) {
  const { t } = useI18n()
  const initialCodes = useMemo(
    () => role.permissions.map((permission) => permission.code),
    [role.permissions],
  )
  const [selectedCodes, setSelectedCodes] = useState(() => new Set(initialCodes))

  function togglePermission(code: string) {
    setSelectedCodes((currentCodes) => {
      const nextCodes = new Set(currentCodes)
      if (nextCodes.has(code)) {
        nextCodes.delete(code)
      } else {
        nextCodes.add(code)
      }
      return nextCodes
    })
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
      role="dialog"
    >
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-950">
            {t('roles.permissions.title')}
          </h3>
          <p className="text-sm text-slate-500">{role.name}</p>
        </div>

        <div className="grid gap-4">
          {modules.map((module) => (
            <section
              className="rounded-md border border-slate-200 p-4"
              key={module.module}
            >
              <h4 className="mb-3 text-sm font-semibold text-slate-950">
                {module.module}
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {module.permissions.map((permission) => (
                  <label
                    className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm"
                    key={permission.code}
                  >
                    <input
                      aria-label={permission.name}
                      checked={selectedCodes.has(permission.code)}
                      className="mt-0.5 size-4"
                      onChange={() => togglePermission(permission.code)}
                      type="checkbox"
                    />
                    <span>
                      <span className="block font-medium text-slate-800">
                        {permission.name}
                      </span>
                      <code className="text-xs text-slate-500">
                        {permission.code}
                      </code>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
          >
            {t('roles.form.cancel')}
          </button>
          <button
            className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            onClick={() => onSubmit([...selectedCodes].sort())}
            type="button"
          >
            {t('roles.permissions.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
