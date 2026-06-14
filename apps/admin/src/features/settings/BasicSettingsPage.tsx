import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'
import { getErrorMessage } from '../../app/api-error-messages'
import { useI18n } from '../../i18n/useI18n'
import { useAuthStore } from '../../stores/auth-store'
import {
  getBasicSettings,
  getGetBasicSettingsQueryKey,
  updateBasicSettings,
} from '../../generated/api/endpoints/settings/settings'
import type { UpdateBasicSettingsDto } from '../../generated/api/schemas'
import { hasPermission } from './settings-form'

type BasicSettingsFormValues = UpdateBasicSettingsDto

const localeOptions = ['en-US', 'zh-CN'] as const
const themeOptions = ['light', 'dark'] as const

export function BasicSettingsPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.permissions)
  const canUpdate = hasPermission(permissions, 'setting.update')

  const settingsQuery = useQuery({
    queryKey: getGetBasicSettingsQueryKey(),
    queryFn: () => getBasicSettings(),
  })

  const schema = useMemo(
    () =>
      z.object({
        siteName: z
          .string()
          .trim()
          .min(1, t('settings.basic.validation.siteName'))
          .max(80, t('settings.basic.validation.max80')),
        siteSubtitle: z
          .string()
          .trim()
          .max(160, t('settings.basic.validation.max160')),
        defaultLocale: z.enum(localeOptions),
        defaultTheme: z.enum(themeOptions),
      }),
    [t],
  )

  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<BasicSettingsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      siteName: '',
      siteSubtitle: '',
      defaultLocale: 'en-US',
      defaultTheme: 'light',
    },
  })

  useEffect(() => {
    if (!settingsQuery.data || isDirty) {
      return
    }

    reset({
      siteName: settingsQuery.data.siteName,
      siteSubtitle: settingsQuery.data.siteSubtitle,
      defaultLocale: settingsQuery.data.defaultLocale,
      defaultTheme: settingsQuery.data.defaultTheme,
    })
  }, [isDirty, reset, settingsQuery.data])

  const mutation = useMutation({
    mutationFn: (value: UpdateBasicSettingsDto) => updateBasicSettings(value),
    onSuccess: async (savedSettings) => {
      reset({
        siteName: savedSettings.siteName,
        siteSubtitle: savedSettings.siteSubtitle,
        defaultLocale: savedSettings.defaultLocale,
        defaultTheme: savedSettings.defaultTheme,
      })
      toast.success(t('settings.basic.success'))
      await queryClient.invalidateQueries({
        queryKey: getGetBasicSettingsQueryKey(),
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t('settings.basic.error'), t))
    },
  })

  function submitForm(value: BasicSettingsFormValues) {
    mutation.mutate({
      siteName: value.siteName.trim(),
      siteSubtitle: value.siteSubtitle.trim(),
      defaultLocale: value.defaultLocale,
      defaultTheme: value.defaultTheme,
    })
  }

  function resetForm() {
    if (!settingsQuery.data) {
      return
    }

    reset({
      siteName: settingsQuery.data.siteName,
      siteSubtitle: settingsQuery.data.siteSubtitle,
      defaultLocale: settingsQuery.data.defaultLocale,
      defaultTheme: settingsQuery.data.defaultTheme,
    })
  }

  if (settingsQuery.isLoading) {
    return (
      <section className="grid gap-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.basic.title')}
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
          {t('settings.basic.loading')}
        </div>
      </section>
    )
  }

  if (settingsQuery.isError) {
    return (
      <section className="grid gap-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.basic.title')}
        </h2>
        <div className="rounded-lg border border-rose-200 bg-white p-5">
          <p className="text-sm text-rose-700">
            {getErrorMessage(
              settingsQuery.error,
              t('settings.basic.loadError'),
              t,
            )}
          </p>
          <button
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={() => settingsQuery.refetch()}
            type="button"
          >
            {t('settings.basic.retry')}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.basic.title')}
        </h2>
        <p className="text-sm text-slate-600">
          {t('settings.basic.description')}
        </p>
      </div>

      {!canUpdate ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('settings.basic.readOnly')}
        </div>
      ) : null}

      <form
        className="grid w-full min-w-0 gap-4 rounded-lg border border-slate-200 bg-white p-5"
        onSubmit={handleSubmit(submitForm)}
      >
        <Field
          error={errors.siteName?.message}
          label={t('settings.basic.field.siteName')}
        >
          <input
            aria-invalid={Boolean(errors.siteName)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!canUpdate || mutation.isPending}
            {...register('siteName')}
          />
        </Field>

        <Field
          error={errors.siteSubtitle?.message}
          label={t('settings.basic.field.siteSubtitle')}
        >
          <input
            aria-invalid={Boolean(errors.siteSubtitle)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!canUpdate || mutation.isPending}
            {...register('siteSubtitle')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            error={errors.defaultLocale?.message}
            label={t('settings.basic.field.defaultLocale')}
          >
            <select
              aria-invalid={Boolean(errors.defaultLocale)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              disabled={!canUpdate || mutation.isPending}
              {...register('defaultLocale')}
            >
              {localeOptions.map((locale) => (
                <option key={locale} value={locale}>
                  {t(`settings.basic.locale.${locale}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field
            error={errors.defaultTheme?.message}
            label={t('settings.basic.field.defaultTheme')}
          >
            <select
              aria-invalid={Boolean(errors.defaultTheme)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              disabled={!canUpdate || mutation.isPending}
              {...register('defaultTheme')}
            >
              {themeOptions.map((theme) => (
                <option key={theme} value={theme}>
                  {t(`settings.basic.theme.${theme}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {canUpdate ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={mutation.isPending}
              onClick={resetForm}
              type="button"
            >
              {t('settings.basic.reset')}
            </button>
            <button
              className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={mutation.isPending}
              type="submit"
            >
              {t('settings.basic.save')}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  )
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode
  error?: string
  label: string
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      <span className="min-h-5 text-xs text-rose-600">{error}</span>
    </label>
  )
}
