import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useI18n } from '../../i18n/useI18n'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserRecord,
  UserRoleSummary,
} from './users.types'

interface UserFormProps {
  mode: 'create' | 'edit'
  initialValue?: UserRecord
  isSubmitting: boolean
  canAssignRoles: boolean
  roleOptions: UserRoleSummary[]
  onSubmit: (value: CreateUserRequest | UpdateUserRequest) => void
  onCancel: () => void
}

type UserFormValues = {
  email: string
  username: string
  firstName: string
  lastName: string
  password?: string
  roleCodes: string[]
}

export function UserForm({
  mode,
  initialValue,
  isSubmitting,
  canAssignRoles,
  roleOptions,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const { t } = useI18n()
  const isCreate = mode === 'create'

  const schema = useMemo(() => {
    const baseSchema = z.object({
      email: z.string().trim().email(t('users.validation.email')),
      username: z.string().trim().min(3, t('users.validation.username')),
      firstName: z.string().trim().min(1, t('users.validation.firstName')),
      lastName: z.string().trim().min(1, t('users.validation.lastName')),
      roleCodes: z.array(z.string()),
    })

    return isCreate
      ? baseSchema.extend({
          password: z
            .string()
            .min(8, t('users.validation.password')),
        })
      : baseSchema.extend({
          password: z.string().optional(),
        })
  }, [isCreate, t])

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialValue?.email ?? '',
      username: initialValue?.username ?? '',
      firstName: initialValue?.firstName ?? '',
      lastName: initialValue?.lastName ?? '',
      password: '',
      roleCodes: initialValue?.roles.map((role) => role.code) ?? [],
    },
  })

  function submitForm(value: UserFormValues) {
    const updateValue = {
      email: value.email,
      username: value.username,
      firstName: value.firstName,
      lastName: value.lastName,
    }

    if (isCreate) {
      onSubmit({
        ...updateValue,
        password: value.password ?? '',
        roleCodes: canAssignRoles ? value.roleCodes : undefined,
      })
      return
    }

    onSubmit(updateValue)
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submitForm)}>
      <div className="grid gap-4 sm:grid-cols-2">
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
