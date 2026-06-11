import { zodResolver } from '@hookform/resolvers/zod'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useI18n } from '../../i18n/useI18n'
import type { CreateRoleRequest, RoleRecord, UpdateRoleRequest } from './roles.types'

interface RoleFormProps {
  mode: 'create' | 'edit'
  initialValue?: RoleRecord
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (value: CreateRoleRequest | UpdateRoleRequest) => void
}

interface RoleFormValues {
  code: string
  name: string
  description: string
  status: 'ACTIVE' | 'DISABLED'
  isDefault: boolean
}

function descriptionToFormValue(
  description: RoleRecord['description'] | undefined,
) {
  return typeof description === 'string' ? description : ''
}

export function RoleForm({
  mode,
  initialValue,
  isSubmitting,
  onCancel,
  onSubmit,
}: RoleFormProps) {
  const { t } = useI18n()
  const isCreate = mode === 'create'
  const schema = useMemo(
    () =>
      z.object({
        code: isCreate
          ? z
              .string()
              .trim()
              .min(2, t('roles.validation.code'))
              .regex(/^[a-z][a-z0-9_]*$/, t('roles.validation.codeFormat'))
          : z.string(),
        name: z.string().trim().min(1, t('roles.validation.name')),
        description: z.string(),
        status: z.enum(['ACTIVE', 'DISABLED']),
        isDefault: z.boolean(),
      }),
    [isCreate, t],
  )

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<RoleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initialValue?.code ?? '',
      name: initialValue?.name ?? '',
      description: descriptionToFormValue(initialValue?.description),
      status: initialValue?.status ?? 'ACTIVE',
      isDefault: initialValue?.isDefault ?? false,
    },
  })

  function submitForm(value: RoleFormValues) {
    const description = value.description.trim()
    const payload = {
      name: value.name,
      isDefault: value.isDefault,
    }

    if (isCreate) {
      onSubmit({
        ...payload,
        ...(description ? { description } : {}),
        code: value.code,
      })
      return
    }

    onSubmit({
      ...payload,
      description: (description || null) as UpdateRoleRequest['description'],
      status: value.status,
    })
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submitForm)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={errors.code?.message} label={t('roles.form.code')}>
          <input
            aria-invalid={Boolean(errors.code)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:bg-slate-100"
            disabled={!isCreate}
            {...register('code')}
          />
        </Field>

        <Field error={errors.name?.message} label={t('roles.form.name')}>
          <input
            aria-invalid={Boolean(errors.name)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('name')}
          />
        </Field>

        <Field label={t('roles.form.status')}>
          <select
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            disabled={isCreate}
            {...register('status')}
          >
            <option value="ACTIVE">{t('roles.status.active')}</option>
            <option value="DISABLED">{t('roles.status.disabled')}</option>
          </select>
        </Field>

        <label className="flex min-h-9 items-center gap-2 self-end text-sm font-medium text-slate-700">
          <input className="size-4" type="checkbox" {...register('isDefault')} />
          {t('roles.form.isDefault')}
        </label>

        <Field label={t('roles.form.description')}>
          <textarea
            className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-500 sm:col-span-2"
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
          {t('roles.form.cancel')}
        </button>
        <button
          className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isCreate ? t('roles.action.create') : t('roles.action.edit')}
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
