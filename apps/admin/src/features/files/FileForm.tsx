import { zodResolver } from '@hookform/resolvers/zod'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useI18n } from '../../i18n/useI18n'
import type { FileRecord, UpdateFileRequest } from './files.types'

interface FileFormProps {
  initialValue: FileRecord
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (value: UpdateFileRequest) => void
}

interface FileFormValues {
  displayName: string
  description: string
}

export function FileForm({
  initialValue,
  isSubmitting,
  onCancel,
  onSubmit,
}: FileFormProps) {
  const { t } = useI18n()
  const schema = useMemo(
    () =>
      z.object({
        displayName: z
          .string()
          .trim()
          .min(1, t('files.validation.displayName'))
          .max(255, t('files.validation.max255')),
        description: z.string().trim().max(500, t('files.validation.max500')),
      }),
    [t],
  )
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: initialValue.displayName,
      description: initialValue.description ?? '',
    },
  })

  function submitForm(value: FileFormValues) {
    onSubmit({
      displayName: value.displayName.trim(),
      description: value.description.trim() || null,
    })
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submitForm)}>
      <Field error={errors.displayName?.message} label={t('files.form.displayName')}>
        <input
          aria-invalid={Boolean(errors.displayName)}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
          {...register('displayName')}
        />
      </Field>
      <Field error={errors.description?.message} label={t('files.form.description')}>
        <textarea
          aria-invalid={Boolean(errors.description)}
          className="min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
          {...register('description')}
        />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          {t('files.form.cancel')}
        </button>
        <button
          className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {t('files.action.save')}
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
