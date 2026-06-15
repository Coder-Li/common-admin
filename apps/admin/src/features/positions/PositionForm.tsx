import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useI18n } from '../../i18n/useI18n'
import type {
  CreatePositionRequest,
  PositionRecord,
  UpdatePositionRequest,
} from './positions.types'

export type PositionFormSubmitValue =
  | CreatePositionRequest
  | UpdatePositionRequest

interface PositionFormProps {
  mode: 'create' | 'edit'
  initialValue?: PositionRecord
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (value: PositionFormSubmitValue) => void
}

interface PositionFormValues {
  code: string
  name: string
  status: 'ACTIVE' | 'DISABLED'
  sortOrder: number
  description: string
}

function descriptionToFormValue(
  description: PositionRecord['description'] | undefined,
) {
  return typeof description === 'string' ? description : ''
}

function normalizeDescription(value: string) {
  const trimmed = value.trim()

  return trimmed ? trimmed : null
}

export function PositionForm({
  mode,
  initialValue,
  isSubmitting,
  onCancel,
  onSubmit,
}: PositionFormProps) {
  const { t } = useI18n()
  const isCreate = mode === 'create'
  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .min(1, t('positions.validation.code'))
          .max(80, t('positions.validation.max80')),
        name: z
          .string()
          .trim()
          .min(1, t('positions.validation.name'))
          .max(120, t('positions.validation.max120')),
        status: z.enum(['ACTIVE', 'DISABLED']),
        sortOrder: z
          .number()
          .int(t('positions.validation.sortOrderInteger'))
          .min(0, t('positions.validation.sortOrderMinimum')),
        description: z.string().max(500, t('positions.validation.max500')),
      }),
    [t],
  )

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<PositionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initialValue?.code ?? '',
      name: initialValue?.name ?? '',
      status: initialValue?.status ?? 'ACTIVE',
      sortOrder: initialValue?.sortOrder ?? 0,
      description: descriptionToFormValue(initialValue?.description),
    },
  })

  function submitForm(value: PositionFormValues) {
    const description = normalizeDescription(value.description)
    const payload = {
      code: value.code.trim(),
      name: value.name.trim(),
      status: value.status,
      sortOrder: value.sortOrder,
      description,
    }

    if (isCreate) {
      onSubmit({
        code: payload.code,
        name: payload.name,
        status: payload.status,
        sortOrder: payload.sortOrder,
        ...(description ? { description } : {}),
      })
      return
    }

    onSubmit(payload)
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit(submitForm)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={errors.code?.message} label={t('positions.form.code')}>
          <input
            aria-invalid={Boolean(errors.code)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('code')}
          />
        </Field>

        <Field error={errors.name?.message} label={t('positions.form.name')}>
          <input
            aria-invalid={Boolean(errors.name)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('name')}
          />
        </Field>

        <Field label={t('positions.form.status')}>
          <select
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('status')}
          >
            <option value="ACTIVE">{t('positions.status.active')}</option>
            <option value="DISABLED">{t('positions.status.disabled')}</option>
          </select>
        </Field>

        <Field
          error={errors.sortOrder?.message}
          label={t('positions.form.sortOrder')}
        >
          <input
            aria-invalid={Boolean(errors.sortOrder)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            min={0}
            step={1}
            type="number"
            {...register('sortOrder', { valueAsNumber: true })}
          />
        </Field>

        <Field
          error={errors.description?.message}
          label={t('positions.form.description')}
        >
          <textarea
            aria-invalid={Boolean(errors.description)}
            className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
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
          {t('positions.form.cancel')}
        </button>
        <button
          className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isCreate
            ? t('positions.action.create')
            : t('positions.action.edit')}
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
