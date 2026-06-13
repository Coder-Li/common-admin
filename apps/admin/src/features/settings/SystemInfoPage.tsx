import { useQuery } from '@tanstack/react-query'
import { getErrorMessage } from '../../app/api-error-messages'
import { useI18n } from '../../i18n/useI18n'
import {
  getGetSystemInfoQueryKey,
  getSystemInfo,
} from '../../generated/api/endpoints/settings/settings'
import { joinMimeTypes } from './settings-form'

export function SystemInfoPage() {
  const { t } = useI18n()

  const systemInfoQuery = useQuery({
    queryKey: getGetSystemInfoQueryKey(),
    queryFn: () => getSystemInfo(),
  })

  if (systemInfoQuery.isLoading) {
    return (
      <section className="grid gap-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.systemInfo.title')}
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
          {t('settings.systemInfo.loading')}
        </div>
      </section>
    )
  }

  if (systemInfoQuery.isError) {
    return (
      <section className="grid gap-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.systemInfo.title')}
        </h2>
        <div className="rounded-lg border border-rose-200 bg-white p-5">
          <p className="text-sm text-rose-700">
            {getErrorMessage(
              systemInfoQuery.error,
              t('settings.systemInfo.loadError'),
              t,
            )}
          </p>
        </div>
      </section>
    )
  }

  const systemInfo = systemInfoQuery.data

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.systemInfo.title')}
        </h2>
        <p className="text-sm text-slate-600">
          {t('settings.systemInfo.description')}
        </p>
      </div>

      <div className="grid max-w-3xl gap-3 rounded-lg border border-slate-200 bg-white p-5">
        <ReadOnlyRow
          label={t('settings.systemInfo.serviceName')}
          value={systemInfo?.serviceName ?? ''}
        />
        <ReadOnlyRow
          label={t('settings.systemInfo.appEnv')}
          value={systemInfo?.appEnv ?? ''}
        />
        <ReadOnlyRow
          label={t('settings.systemInfo.nodeEnv')}
          value={systemInfo?.nodeEnv ?? ''}
        />
        <ReadOnlyRow
          label={t('settings.systemInfo.logLevel')}
          value={systemInfo?.logLevel ?? ''}
        />
        <ReadOnlyRow
          label={t('settings.systemInfo.storageDriver')}
          value={systemInfo?.storageDriver ?? ''}
        />
        <ReadOnlyRow
          label={t('settings.systemInfo.uploadMaxSize')}
          value={t('settings.systemInfo.megabytes', {
            value: systemInfo?.uploadMaxSizeMb ?? '',
          })}
        />
        <ReadOnlyRow
          label={t('settings.systemInfo.uploadMimeTypes')}
          value={joinMimeTypes(systemInfo?.uploadAllowedMimeTypes ?? [])}
        />
      </div>
    </section>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="break-words text-sm text-slate-950">{value}</span>
    </div>
  )
}
