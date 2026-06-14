import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from 'sonner'
import { getErrorMessage } from '../../app/api-error-messages'
import { useI18n } from '../../i18n/useI18n'
import { useAuthStore } from '../../stores/auth-store'
import {
  getGetUploadSettingsQueryKey,
  getUploadSettings,
  updateUploadSettings,
} from '../../generated/api/endpoints/settings/settings'
import type { UpdateUploadSettingsDto } from '../../generated/api/schemas'
import { hasPermission, joinMimeTypes } from './settings-form'

type UploadSettingsFormInput = {
  maxSizeMb: unknown
  allowedMimeTypes: string[]
}

type UploadSettingsFormValues = UpdateUploadSettingsDto

export function UploadSettingsPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.permissions)
  const canUpdate = hasPermission(permissions, 'setting.update')

  const settingsQuery = useQuery({
    queryKey: getGetUploadSettingsQueryKey(),
    queryFn: () => getUploadSettings(),
  })

  const schema = useMemo(
    () =>
      z.object({
        maxSizeMb: z.coerce
          .number()
          .int(t('settings.upload.validation.integer'))
          .min(1, t('settings.upload.validation.minSize'))
          .max(
            settingsQuery.data?.environmentMaxSizeMb ?? Number.MAX_SAFE_INTEGER,
            t('settings.upload.validation.maxSize', {
              max: settingsQuery.data?.environmentMaxSizeMb ?? '',
            }),
          ),
        allowedMimeTypes: z
          .array(z.string())
          .min(1, t('settings.upload.validation.mimeRequired'))
          .refine(
            (values) =>
              values.every((value) =>
                settingsQuery.data?.environmentAllowedMimeTypes.includes(value),
              ),
            t('settings.upload.validation.mimeAllowed'),
          ),
      }),
    [settingsQuery.data, t],
  )

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<
    UploadSettingsFormInput,
    unknown,
    UploadSettingsFormValues
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      maxSizeMb: 1,
      allowedMimeTypes: [],
    },
  })

  useEffect(() => {
    if (!settingsQuery.data || isDirty) {
      return
    }

    reset({
      maxSizeMb: settingsQuery.data.maxSizeMb,
      allowedMimeTypes: settingsQuery.data.allowedMimeTypes.filter((mimeType) =>
        settingsQuery.data.environmentAllowedMimeTypes.includes(mimeType),
      ),
    })
  }, [isDirty, reset, settingsQuery.data])

  const mutation = useMutation({
    mutationFn: (value: UpdateUploadSettingsDto) => updateUploadSettings(value),
    onSuccess: async (savedSettings) => {
      reset({
        maxSizeMb: savedSettings.maxSizeMb,
        allowedMimeTypes: savedSettings.allowedMimeTypes.filter((mimeType) =>
          savedSettings.environmentAllowedMimeTypes.includes(mimeType),
        ),
      })
      toast.success(t('settings.upload.success'))
      await queryClient.invalidateQueries({
        queryKey: getGetUploadSettingsQueryKey(),
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t('settings.upload.error'), t))
    },
  })

  function submitForm(value: UploadSettingsFormValues) {
    const environmentAllowedMimeTypes =
      settingsQuery.data?.environmentAllowedMimeTypes ?? []

    mutation.mutate({
      maxSizeMb: value.maxSizeMb,
      allowedMimeTypes: environmentAllowedMimeTypes.filter((mimeType) =>
        value.allowedMimeTypes.includes(mimeType),
      ),
    })
  }

  function resetForm() {
    if (!settingsQuery.data) {
      return
    }

    reset({
      maxSizeMb: settingsQuery.data.maxSizeMb,
      allowedMimeTypes: settingsQuery.data.allowedMimeTypes.filter((mimeType) =>
        settingsQuery.data.environmentAllowedMimeTypes.includes(mimeType),
      ),
    })
  }

  if (settingsQuery.isLoading) {
    return (
      <section className="grid gap-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.upload.title')}
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
          {t('settings.upload.loading')}
        </div>
      </section>
    )
  }

  if (settingsQuery.isError) {
    return (
      <section className="grid gap-4 p-5">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.upload.title')}
        </h2>
        <div className="rounded-lg border border-rose-200 bg-white p-5">
          <p className="text-sm text-rose-700">
            {getErrorMessage(
              settingsQuery.error,
              t('settings.upload.loadError'),
              t,
            )}
          </p>
          <button
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={() => settingsQuery.refetch()}
            type="button"
          >
            {t('settings.upload.retry')}
          </button>
        </div>
      </section>
    )
  }

  const environmentAllowedMimeTypes =
    settingsQuery.data?.environmentAllowedMimeTypes ?? []

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('settings.upload.title')}
        </h2>
        <p className="text-sm text-slate-600">
          {t('settings.upload.description')}
        </p>
      </div>

      {!canUpdate ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('settings.upload.readOnly')}
        </div>
      ) : null}

      <div className="grid w-full min-w-0 gap-3 sm:grid-cols-3">
        <ReadOnlyBadge
          label={t('settings.upload.environmentMaxSize')}
          value={t('settings.upload.megabytes', {
            value: settingsQuery.data?.environmentMaxSizeMb ?? '',
          })}
        />
        <ReadOnlyBadge
          label={t('settings.upload.environmentMimeTypes')}
          value={joinMimeTypes(environmentAllowedMimeTypes)}
        />
        <ReadOnlyBadge
          label={t('settings.upload.storageDriver')}
          value={settingsQuery.data?.storageDriver ?? ''}
        />
      </div>

      <form
        className="grid w-full min-w-0 gap-4 rounded-lg border border-slate-200 bg-white p-5"
        noValidate
        onSubmit={handleSubmit(submitForm)}
      >
        <Field
          error={errors.maxSizeMb?.message}
          label={t('settings.upload.field.maxSizeMb')}
        >
          <input
            aria-invalid={Boolean(errors.maxSizeMb)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            disabled={!canUpdate || mutation.isPending}
            min={1}
            max={settingsQuery.data?.environmentMaxSizeMb}
            type="number"
            {...register('maxSizeMb', { valueAsNumber: true })}
          />
        </Field>

        <Controller
          control={control}
          name="allowedMimeTypes"
          render={({ field }) => (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium text-slate-700">
                {t('settings.upload.field.allowedMimeTypes')}
              </legend>
              <div className="grid gap-2 rounded-md border border-slate-200 p-3">
                {environmentAllowedMimeTypes.map((mimeType) => (
                  <label
                    className="flex min-w-0 items-center gap-2 text-sm text-slate-700"
                    key={mimeType}
                  >
                    <input
                      checked={field.value.includes(mimeType)}
                      className="size-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500 disabled:cursor-not-allowed"
                      disabled={!canUpdate || mutation.isPending}
                      onBlur={field.onBlur}
                      onChange={(event) => {
                        if (event.target.checked) {
                          field.onChange([...field.value, mimeType])
                          return
                        }

                        field.onChange(
                          field.value.filter((value) => value !== mimeType),
                        )
                      }}
                      type="checkbox"
                    />
                    <span className="truncate">{mimeType}</span>
                  </label>
                ))}
              </div>
              <span className="min-h-5 text-xs text-rose-600">
                {errors.allowedMimeTypes?.message}
              </span>
            </fieldset>
          )}
        />

        {canUpdate ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={mutation.isPending}
              onClick={resetForm}
              type="button"
            >
              {t('settings.upload.reset')}
            </button>
            <button
              className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={mutation.isPending}
              type="submit"
            >
              {t('settings.upload.save')}
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

function ReadOnlyBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-xs font-medium uppercase text-slate-500">
        {label}
      </span>
      <span className="truncate text-sm font-medium text-slate-900">
        {value}
      </span>
    </div>
  )
}
