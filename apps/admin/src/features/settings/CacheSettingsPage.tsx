import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '../../app/api-error-messages'
import { useI18n } from '../../i18n/useI18n'
import { useAuthStore } from '../../stores/auth-store'
import { refreshDictionaryCache } from '../../generated/api/endpoints/settings/settings'
import { hasPermission } from './settings-form'
import { invalidateDictionaryOptionQueries } from './settings-query'

export function CacheSettingsPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.permissions)
  const canUpdate = hasPermission(permissions, 'setting.update')

  const mutation = useMutation({
    mutationFn: () => refreshDictionaryCache(),
    onSuccess: async () => {
      await invalidateDictionaryOptionQueries(queryClient)
      toast.success(t('settings.cache.success'))
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t('settings.cache.error'), t))
    },
  })

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.cache.title')}
        </h2>
        <p className="text-sm text-slate-600">
          {t('settings.cache.description')}
        </p>
      </div>

      {!canUpdate ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('settings.cache.readOnly')}
        </div>
      ) : null}

      <div className="grid w-full min-w-0 gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-1">
          <h3 className="text-sm font-semibold text-slate-950">
            {t('settings.cache.dictionaryTitle')}
          </h3>
          <p className="text-sm text-slate-600">
            {t('settings.cache.dictionaryDescription')}
          </p>
        </div>
        <div className="flex justify-end">
          <button
            className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={!canUpdate || mutation.isPending}
            onClick={() => mutation.mutate()}
            type="button"
          >
            {t('settings.cache.refreshDictionary')}
          </button>
        </div>
      </div>
    </section>
  )
}
