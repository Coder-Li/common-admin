import { zodResolver } from '@hookform/resolvers/zod'
import {
  useEffect,
  useMemo,
} from 'react'
import type {
  ChangeEvent,
  ReactNode,
} from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useI18n } from '../../i18n/useI18n'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserDepartmentOption,
  UserPositionOption,
  UserRecord,
  UserRoleSummary,
} from './users.types'

export type UserFormSubmitValue =
  | CreateUserRequest
  | (UpdateUserRequest & { roleCodes?: string[] })

interface UserFormProps {
  mode: 'create' | 'edit'
  initialValue?: UserRecord
  isSubmitting: boolean
  canEditProfile: boolean
  canAssignRoles: boolean
  canEditDepartments: boolean
  canEditPositions: boolean
  departmentOptions: UserDepartmentOption[]
  positionOptions: UserPositionOption[]
  roleOptions: UserRoleSummary[]
  onSubmit: (value: UserFormSubmitValue) => void
  onCancel: () => void
}

type UserFormValues = {
  email: string
  username: string
  firstName: string
  lastName: string
  password?: string
  roleCodes: string[]
  departmentIds: string[]
  primaryDepartmentId: string
  positionIds: string[]
}

function equalSets(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  const rightSet = new Set(right)

  return left.every((value) => rightSet.has(value))
}

function selectedValues(event: ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.target.selectedOptions).map((option) => option.value)
}

function assignedDepartmentIds(initialValue?: UserRecord) {
  return initialValue?.departments?.map((department) => department.id) ?? []
}

function assignedPositionIds(initialValue?: UserRecord) {
  return initialValue?.positions?.map((position) => position.id) ?? []
}

function selectedOptions<TOption extends { id: string }>(
  options: TOption[],
  selectedIds: string[],
) {
  const selectedIdSet = new Set(selectedIds)

  return options.filter((option) => selectedIdSet.has(option.id))
}

function activeOptionIds(options: Array<{ id: string; status: string }>) {
  return new Set(
    options
      .filter((option) => option.status === 'ACTIVE')
      .map((option) => option.id),
  )
}

function activeSelectedIds(selectedIds: string[], activeIds: Set<string>) {
  return selectedIds.filter((id) => activeIds.has(id))
}

export function UserForm({
  mode,
  initialValue,
  isSubmitting,
  canEditProfile,
  canAssignRoles,
  canEditDepartments,
  canEditPositions,
  departmentOptions,
  positionOptions,
  roleOptions,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const { t } = useI18n()
  const isCreate = mode === 'create'
  const initialDepartmentIds = useMemo(
    () => assignedDepartmentIds(initialValue),
    [initialValue],
  )
  const initialPositionIds = useMemo(
    () => assignedPositionIds(initialValue),
    [initialValue],
  )
  const initialPrimaryDepartmentId = initialValue?.primaryDepartment?.id ?? ''

  const schema = useMemo(() => {
    const baseSchema = z.object({
      email: z.string().trim().email(t('users.validation.email')),
      username: z.string().trim().min(3, t('users.validation.username')),
      firstName: z.string().trim().min(1, t('users.validation.firstName')),
      lastName: z.string().trim().min(1, t('users.validation.lastName')),
      roleCodes: z.array(z.string()),
      departmentIds: z.array(z.string()),
      primaryDepartmentId: z.string(),
      positionIds: z.array(z.string()),
    })

    const schemaWithMode = isCreate
      ? baseSchema.extend({
          password: z
            .string()
            .min(8, t('users.validation.password')),
        })
      : baseSchema.extend({
          password: z.string().optional(),
        })

    return schemaWithMode.superRefine((value, context) => {
      if (value.departmentIds.length > 1 && !value.primaryDepartmentId) {
        context.addIssue({
          code: 'custom',
          message: t('users.validation.primaryDepartment'),
          path: ['primaryDepartmentId'],
        })
      }
    })
  }, [isCreate, t])

  const {
    formState: { errors },
    handleSubmit,
    control,
    register,
    setValue,
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialValue?.email ?? '',
      username: initialValue?.username ?? '',
      firstName: initialValue?.firstName ?? '',
      lastName: initialValue?.lastName ?? '',
      password: '',
      roleCodes: initialValue?.roles.map((role) => role.code) ?? [],
      departmentIds: initialDepartmentIds,
      primaryDepartmentId: initialPrimaryDepartmentId,
      positionIds: initialPositionIds,
    },
  })

  const departmentIds = useWatch({
    control,
    name: 'departmentIds',
  })
  const primaryDepartmentId = useWatch({
    control,
    name: 'primaryDepartmentId',
  })
  const primaryDepartmentOptions = useMemo(
    () => selectedOptions(departmentOptions, departmentIds),
    [departmentIds, departmentOptions],
  )
  const activeDepartmentIds = useMemo(
    () => activeOptionIds(departmentOptions),
    [departmentOptions],
  )
  const activePositionIds = useMemo(
    () => activeOptionIds(positionOptions),
    [positionOptions],
  )

  useEffect(() => {
    if (departmentIds.length === 0 && primaryDepartmentId) {
      setValue('primaryDepartmentId', '')
      return
    }

    if (departmentIds.length === 1 && primaryDepartmentId !== departmentIds[0]) {
      setValue('primaryDepartmentId', departmentIds[0])
      return
    }

    if (
      primaryDepartmentId &&
      !departmentIds.includes(primaryDepartmentId)
    ) {
      setValue('primaryDepartmentId', '')
    }
  }, [departmentIds, primaryDepartmentId, setValue])

  function submitForm(value: UserFormValues) {
    const updateValue = {
      email: value.email,
      username: value.username,
      firstName: value.firstName,
      lastName: value.lastName,
    }
    const submittedDepartmentIds = isCreate
      ? value.departmentIds
      : activeSelectedIds(value.departmentIds, activeDepartmentIds)
    const submittedPrimaryDepartmentId = submittedDepartmentIds.includes(
      value.primaryDepartmentId,
    )
      ? value.primaryDepartmentId
      : ''
    const submittedPositionIds = isCreate
      ? value.positionIds
      : activeSelectedIds(value.positionIds, activePositionIds)
    const organizationValue = {
      departmentIds: submittedDepartmentIds,
      ...(submittedPrimaryDepartmentId
        ? { primaryDepartmentId: submittedPrimaryDepartmentId }
        : {}),
      positionIds: submittedPositionIds,
    }

    if (isCreate) {
      onSubmit({
        ...updateValue,
        password: value.password ?? '',
        roleCodes: canAssignRoles ? value.roleCodes : undefined,
        ...(canEditDepartments
          ? {
              departmentIds: organizationValue.departmentIds,
              ...(organizationValue.primaryDepartmentId
                ? {
                    primaryDepartmentId:
                      organizationValue.primaryDepartmentId,
                  }
                : {}),
            }
          : {}),
        ...(canEditPositions ? { positionIds: organizationValue.positionIds } : {}),
      })
      return
    }

    const changedDepartmentIds = !equalSets(
      initialDepartmentIds,
      value.departmentIds,
    )
    const changedPrimaryDepartmentId =
      initialPrimaryDepartmentId !== value.primaryDepartmentId
    const changedPositionIds = !equalSets(initialPositionIds, value.positionIds)
    const shouldSubmitPrimaryDepartmentId =
      Boolean(submittedPrimaryDepartmentId) &&
      (changedDepartmentIds || changedPrimaryDepartmentId)
    const shouldSubmitDepartmentIds =
      canEditDepartments && (changedDepartmentIds || changedPrimaryDepartmentId)

    onSubmit({
      ...(canEditProfile ? updateValue : {}),
      roleCodes: canAssignRoles ? value.roleCodes : undefined,
      ...(shouldSubmitDepartmentIds
        ? { departmentIds: submittedDepartmentIds }
        : {}),
      ...(canEditDepartments && shouldSubmitPrimaryDepartmentId
        ? { primaryDepartmentId: submittedPrimaryDepartmentId }
        : {}),
      ...(canEditPositions && changedPositionIds
        ? { positionIds: submittedPositionIds }
        : {}),
    })
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submitForm)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {canEditProfile ? (
          <>
            <Field
              error={errors.email?.message}
              label={t('users.form.email')}
            >
              <input
                aria-invalid={Boolean(errors.email)}
                autoComplete="email"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                type="email"
                {...register('email')}
              />
            </Field>

            <Field
              error={errors.username?.message}
              label={t('users.form.username')}
            >
              <input
                aria-invalid={Boolean(errors.username)}
                autoComplete="username"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                {...register('username')}
              />
            </Field>

            <Field
              error={errors.firstName?.message}
              label={t('users.form.firstName')}
            >
              <input
                aria-invalid={Boolean(errors.firstName)}
                autoComplete="given-name"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                {...register('firstName')}
              />
            </Field>

            <Field
              error={errors.lastName?.message}
              label={t('users.form.lastName')}
            >
              <input
                aria-invalid={Boolean(errors.lastName)}
                autoComplete="family-name"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                {...register('lastName')}
              />
            </Field>
          </>
        ) : null}

        {isCreate ? (
          <Field
            error={errors.password?.message}
            label={t('users.form.password')}
          >
            <input
              aria-invalid={Boolean(errors.password)}
              autoComplete="new-password"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
              type="password"
              {...register('password')}
            />
          </Field>
        ) : null}

        {canAssignRoles ? (
          <Field
            error={errors.roleCodes?.message}
            label={t('users.form.role')}
          >
            <select
              aria-invalid={Boolean(errors.roleCodes)}
              className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
              multiple
              {...register('roleCodes')}
            >
              {roleOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {canEditDepartments ? (
          <>
            <Field label={t('users.form.departments')}>
              <select
                aria-label={t('users.form.departments')}
                className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                multiple
                {...register('departmentIds', {
                  onChange: (event) => {
                    setValue('departmentIds', selectedValues(event))
                  },
                })}
              >
                {departmentOptions.map((option) => (
                  <option
                    disabled={option.status === 'DISABLED'}
                    key={option.id}
                    value={option.id}
                  >
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              error={errors.primaryDepartmentId?.message}
              label={t('users.form.primaryDepartment')}
            >
              <select
                aria-invalid={Boolean(errors.primaryDepartmentId)}
                aria-label={t('users.form.primaryDepartment')}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                {...register('primaryDepartmentId')}
              >
                <option value="">
                  {t('users.form.primaryDepartmentPlaceholder')}
                </option>
                {primaryDepartmentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}

        {canEditPositions ? (
          <Field label={t('users.form.positions')}>
            <select
              aria-label={t('users.form.positions')}
              className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
              multiple
              {...register('positionIds', {
                onChange: (event) => {
                  setValue('positionIds', selectedValues(event))
                },
              })}
            >
              {positionOptions.map((option) => (
                <option
                  disabled={option.status === 'DISABLED'}
                  key={option.id}
                  value={option.id}
                >
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          {t('users.form.cancel')}
        </button>
        <button
          className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isCreate ? t('users.action.create') : t('users.action.edit')}
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
