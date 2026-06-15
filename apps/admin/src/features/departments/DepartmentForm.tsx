import { zodResolver } from '@hookform/resolvers/zod'
import {
  useEffect,
  useMemo,
} from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { DepartmentOptionDto } from '../../generated/api/schemas'
import { useI18n } from '../../i18n/useI18n'
import type {
  CreateDepartmentRequest,
  DepartmentFormValue,
  DepartmentRecord,
  DepartmentTreeNode,
  UpdateDepartmentRequest,
} from './departments.types'

export type DepartmentFormSubmitValue =
  | CreateDepartmentRequest
  | UpdateDepartmentRequest

interface DepartmentFormProps {
  mode: 'create' | 'edit'
  initialValue?: DepartmentRecord
  isSubmitting: boolean
  parentOptions: DepartmentOptionDto[]
  tree: DepartmentTreeNode[]
  onCancel: () => void
  onSubmit: (value: DepartmentFormSubmitValue) => void
}

type ParentOptionState = DepartmentOptionDto & {
  disabledReason?: 'current' | 'descendant' | 'disabled'
}

function descriptionToFormValue(
  description: DepartmentRecord['description'] | undefined,
) {
  return typeof description === 'string' ? description : ''
}

function collectDescendantIds(
  nodes: DepartmentTreeNode[],
  departmentId: string,
  isInsideTarget = false,
): string[] {
  return nodes.flatMap((node) => {
    const isTarget = node.id === departmentId
    const insideTarget = isInsideTarget || isTarget
    const ownId = insideTarget && !isTarget ? [node.id] : []

    return [
      ...ownId,
      ...collectDescendantIds(node.children, departmentId, insideTarget),
    ]
  })
}

function toParentOptionStates(
  options: DepartmentOptionDto[],
  tree: DepartmentTreeNode[],
  currentDepartmentId?: string,
): ParentOptionState[] {
  const descendantIds = currentDepartmentId
    ? new Set(collectDescendantIds(tree, currentDepartmentId))
    : new Set<string>()

  return options.map((option) => {
    if (currentDepartmentId && option.id === currentDepartmentId) {
      return { ...option, disabledReason: 'current' }
    }

    if (descendantIds.has(option.id)) {
      return { ...option, disabledReason: 'descendant' }
    }

    if (option.status === 'DISABLED') {
      return { ...option, disabledReason: 'disabled' }
    }

    return option
  })
}

function normalizeParentId(value: string) {
  return value ? value : null
}

function normalizeDescription(value: string) {
  const trimmed = value.trim()

  return trimmed ? trimmed : null
}

export function DepartmentForm({
  mode,
  initialValue,
  isSubmitting,
  parentOptions,
  tree,
  onCancel,
  onSubmit,
}: DepartmentFormProps) {
  const { t } = useI18n()
  const isCreate = mode === 'create'
  const parentOptionStates = useMemo(
    () => toParentOptionStates(parentOptions, tree, initialValue?.id),
    [initialValue?.id, parentOptions, tree],
  )
  const selectableParentIds = useMemo(
    () =>
      new Set(
        parentOptionStates
          .filter((option) => !option.disabledReason)
          .map((option) => option.id),
      ),
    [parentOptionStates],
  )
  const initialParentId = initialValue?.parentId ?? ''

  const schema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .min(1, t('departments.validation.code'))
          .max(80, t('departments.validation.max80')),
        name: z
          .string()
          .trim()
          .min(1, t('departments.validation.name'))
          .max(120, t('departments.validation.max120')),
        parentId: z.string(),
        status: z.enum(['ACTIVE', 'DISABLED']),
        sortOrder: z.coerce
          .number()
          .int(t('departments.validation.sortOrderInteger'))
          .min(0, t('departments.validation.sortOrderMinimum')),
        description: z
          .string()
          .max(500, t('departments.validation.max500')),
      }),
    [t],
  )

  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<DepartmentFormValue & { description: string }>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initialValue?.code ?? '',
      name: initialValue?.name ?? '',
      parentId: initialParentId,
      status: initialValue?.status ?? 'ACTIVE',
      sortOrder: initialValue?.sortOrder ?? 0,
      description: descriptionToFormValue(initialValue?.description),
    },
  })

  useEffect(() => {
    if (
      initialParentId &&
      parentOptions.some((option) => option.id === initialParentId)
    ) {
      setValue('parentId', initialParentId)
    }
  }, [initialParentId, parentOptions, setValue])

  function submitForm(value: DepartmentFormValue & { description: string }) {
    const parentId = normalizeParentId(value.parentId)
    const unchangedParentId = parentId === (initialValue?.parentId ?? null)
    const changedParentIsSelectable =
      parentId === null || selectableParentIds.has(parentId)
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
        ...(parentId && changedParentIsSelectable ? { parentId } : {}),
        ...(description ? { description } : {}),
      })
      return
    }

    onSubmit({
      ...payload,
      ...(unchangedParentId || !changedParentIsSelectable ? {} : { parentId }),
    })
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit(submitForm)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={errors.code?.message} label={t('departments.form.code')}>
          <input
            aria-invalid={Boolean(errors.code)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('code')}
          />
        </Field>

        <Field error={errors.name?.message} label={t('departments.form.name')}>
          <input
            aria-invalid={Boolean(errors.name)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('name')}
          />
        </Field>

        <Field label={t('departments.form.parent')}>
          <select
            aria-label={t('departments.form.parent')}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('parentId')}
          >
            <option value="">{t('departments.form.rootParent')}</option>
            {parentOptionStates.map((option) => (
              <option
                disabled={Boolean(option.disabledReason)}
                key={option.id}
                value={option.id}
              >
                {optionLabel(option, t)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('departments.form.status')}>
          <select
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
            {...register('status')}
          >
            <option value="ACTIVE">{t('departments.status.active')}</option>
            <option value="DISABLED">{t('departments.status.disabled')}</option>
          </select>
        </Field>

        <Field
          error={errors.sortOrder?.message}
          label={t('departments.form.sortOrder')}
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
          label={t('departments.form.description')}
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
          {t('departments.form.cancel')}
        </button>
        <button
          className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isCreate
            ? t('departments.action.create')
            : t('departments.action.edit')}
        </button>
      </div>
    </form>
  )
}

function optionLabel(
  option: ParentOptionState,
  t: ReturnType<typeof useI18n>['t'],
) {
  const baseLabel = `${option.name} (${option.code})`

  if (option.disabledReason === 'current') {
    return `${baseLabel} - ${t('departments.parent.current')}`
  }

  if (option.disabledReason === 'descendant') {
    return `${baseLabel} - ${t('departments.parent.descendant')}`
  }

  if (option.disabledReason === 'disabled') {
    return `${baseLabel} - ${t('departments.status.disabled')}`
  }

  return baseLabel
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
