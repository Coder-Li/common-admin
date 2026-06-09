import { UserRound } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'
import type { UserProfile } from '../types/auth'

export function DashboardContent({
  isLoading,
  user,
}: {
  isLoading: boolean
  user: UserProfile | null
}) {
  const { t } = useI18n()

  return (
    <div className="grid gap-4 p-5 lg:grid-cols-3">
      <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-slate-100 text-slate-700">
            <UserRound size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              {t('dashboard.currentUser')}
            </h2>
            <p className="text-sm text-slate-500">
              {t('dashboard.loadedFrom')} <code>/api/users/me</code>
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">
            {t('dashboard.loadingProfile')}
          </p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t('dashboard.name')}</dt>
              <dd className="font-medium">
                {user?.firstName} {user?.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('dashboard.email')}</dt>
              <dd className="font-medium">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('dashboard.username')}</dt>
              <dd className="font-medium">{user?.username}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('dashboard.role')}</dt>
              <dd className="font-medium">
                {user?.roles.map((role) => role.name).join(', ')}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">
          {t('dashboard.nextSlice')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('dashboard.nextSliceDescription')}
        </p>
      </section>
    </div>
  )
}
