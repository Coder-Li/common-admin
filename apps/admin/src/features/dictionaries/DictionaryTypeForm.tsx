import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useI18n } from '../../i18n/useI18n'
import type {
  CreateDictionaryTypeRequest,
  DictionaryStatus,
  DictionaryTypeRecord,
  UpdateDictionaryTypeRequest,
} from './dictionaries.types'

const statuses = ['ACTIVE', 'DISABLED'] as const satisfies readonly DictionaryStatus[]

interface DictionaryTypeFormProps {
  mode: 'create' | 'edit'
  initialValue?: DictionaryTypeRecord
  isSubmitting: boolean
  onSubmit: (value: CreateDictionaryTypeRequest | UpdateDictionaryTypeRequest) => void
  onCancel: () => void
}

type DictionaryTypeFormValues = {
  code: string
  name: string
  status: DictionaryStatus
  description?: string
}

export function DictionaryTypeForm({
  mode,
  initialValue,
  isSubmitting,
  onSubmit,
  onCancel,
}: DictionaryTypeFormProps) {
  const { t } = useI18n()
  const isCreate = mode === 'create'

  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .min(1, t('dictionaries.validation.code'))
          .regex(/^[a-z0-9_]{2,80}$/, t('dictionaries.validation.codeFormat')),
        name: z
          .string()
          .trim()
          .min(1, t('dictionaries.validation.name'))
          .max(120, t('dictionaries.validation.max120')),
        status: z.enum(statuses, {
          error: t('dictionaries.validation.status'),
        }),
        description: z
          .string()
          .trim()
          .max(500, t('dictionaries.validation.max500'))
          .optional(),
      }),
    [t],
  )

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<DictionaryTypeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initialValue?.code ?? '',
      name: initialValue?.name ?? '',
      status: initialValue?.status ?? 'ACTIVE',
      description: initialValue?.description ?? '',
    },
  })

  function submitForm(value: DictionaryTypeFormValues) {
    const description = value.description?.trim()
    const payload = {
      name: value.name,
      status: value.status,
      ...(description ? { description } : {}),
    }

    if (isCreate) {
      onSubmit({
        ...payload,
        code: value.code,
      })
      return
    }

    onSubmit(payload)
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submitForm)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={errors.code?.message} label={t('dictionaries.form.code')}>
          <input
            aria-invalid={Boolean(errors.code)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:bg-slate-100"
            disabled={!isCreate}
            {...register('code')}
          />
        </Field>

        <Field error={errors.name?.message} label={t('dictionaries.form.name')}>
          <input
            aria-invalid={Boolean(errors.name)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('name')}
          />
        </Field>

        <Field
          error={errors.status?.message}
          label={t('dictionaries.form.status')}
        >
          <select
            aria-invalid={Boolean(errors.status)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('status')}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field
          error={errors.description?.message}
          label={t('dictionaries.form.description')}
        >
          <textarea
            aria-invalid={Boolean(errors.description)}
            className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('description')}
          />
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          {t('dictionaries.form.cancel')}
        </button>
        <button
          className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isCreate
            ? t('dictionaries.action.createType')
            : t('dictionaries.action.edit')}
        </button>
      </div>
    </form>
  )
}

function Field({
  children,
  error,
  label,
}: {
  children: ReactNode
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
