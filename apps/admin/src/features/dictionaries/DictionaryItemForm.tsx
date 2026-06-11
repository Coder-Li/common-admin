import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useI18n } from '../../i18n/useI18n'
import type {
  CreateDictionaryItemRequest,
  DictionaryBadgeVariant,
  DictionaryItemRecord,
  DictionaryStatus,
  UpdateDictionaryItemRequest,
} from './dictionaries.types'

const statuses = ['ACTIVE', 'DISABLED'] as const satisfies readonly DictionaryStatus[]
const badgeVariants = [
  'DEFAULT',
  'SUCCESS',
  'WARNING',
  'DANGER',
  'NEUTRAL',
] as const satisfies readonly DictionaryBadgeVariant[]

interface DictionaryItemFormProps {
  mode: 'create' | 'edit'
  typeId: string
  initialValue?: DictionaryItemRecord
  isSubmitting: boolean
  onSubmit: (value: CreateDictionaryItemRequest | UpdateDictionaryItemRequest) => void
  onCancel: () => void
}

type DictionaryItemFormValues = {
  value: string
  label: string
  sortOrder: number
  status: DictionaryStatus
  isDefault: boolean
  badgeVariant: DictionaryBadgeVariant | ''
  description?: string
}

export function DictionaryItemForm({
  mode,
  typeId,
  initialValue,
  isSubmitting,
  onSubmit,
  onCancel,
}: DictionaryItemFormProps) {
  const { t } = useI18n()
  const isCreate = mode === 'create'

  const schema = useMemo(
    () =>
      z.object({
        value: z
          .string()
          .trim()
          .min(1, t('dictionaries.validation.value'))
          .max(120, t('dictionaries.validation.max120')),
        label: z
          .string()
          .trim()
          .min(1, t('dictionaries.validation.label'))
          .max(120, t('dictionaries.validation.max120')),
        sortOrder: z
          .number()
          .int()
          .min(0, t('dictionaries.validation.sortOrder')),
        status: z.enum(statuses, {
          error: t('dictionaries.validation.status'),
        }),
        isDefault: z.boolean(),
        badgeVariant: z.union([z.enum(badgeVariants), z.literal('')]),
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
  } = useForm<DictionaryItemFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      value: initialValue?.value ?? '',
      label: initialValue?.label ?? '',
      sortOrder: initialValue?.sortOrder ?? 0,
      status: initialValue?.status ?? 'ACTIVE',
      isDefault: initialValue?.isDefault ?? false,
      badgeVariant: initialValue?.badgeVariant ?? '',
      description: initialValue?.description ?? '',
    },
  })

  function submitForm(value: DictionaryItemFormValues) {
    const description = value.description?.trim()
    const basePayload = {
      label: value.label,
      sortOrder: value.sortOrder,
      status: value.status,
      isDefault: value.isDefault,
    }

    if (isCreate) {
      const payload: CreateDictionaryItemRequest = {
        ...basePayload,
        typeId,
        value: value.value,
        ...(value.badgeVariant ? { badgeVariant: value.badgeVariant } : {}),
        ...(description ? { description } : {}),
      }

      onSubmit(payload)
      return
    }

    const payload: UpdateDictionaryItemRequest = {
      ...basePayload,
      badgeVariant: value.badgeVariant || null,
      description: description || null,
    }

    onSubmit(payload)
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submitForm)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors.value?.message}
          label={t('dictionaries.form.value')}
        >
          <input
            aria-invalid={Boolean(errors.value)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:bg-slate-100"
            disabled={!isCreate}
            {...register('value')}
          />
        </Field>

        <Field
          error={errors.label?.message}
          label={t('dictionaries.form.label')}
        >
          <input
            aria-invalid={Boolean(errors.label)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('label')}
          />
        </Field>

        <Field
          error={errors.sortOrder?.message}
          label={t('dictionaries.form.sortOrder')}
        >
          <input
            aria-invalid={Boolean(errors.sortOrder)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            type="number"
            {...register('sortOrder', { valueAsNumber: true })}
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
          error={errors.badgeVariant?.message}
          label={t('dictionaries.form.badgeVariant')}
        >
          <select
            aria-invalid={Boolean(errors.badgeVariant)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('badgeVariant')}
          >
            <option value="">{t('dictionaries.form.none')}</option>
            {badgeVariants.map((variant) => (
              <option key={variant} value={variant}>
                {variant}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex min-h-9 items-center gap-2 pt-6 text-sm text-slate-700">
          <input
            className="size-4 rounded border-slate-300 text-cyan-500"
            type="checkbox"
            {...register('isDefault')}
          />
          {t('dictionaries.form.isDefault')}
        </label>

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
            ? t('dictionaries.action.createItem')
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
