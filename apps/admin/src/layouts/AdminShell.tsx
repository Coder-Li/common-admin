import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { Circle, KeyRound, Lock, LogOut } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { api } from '../app/api-client'
import { clearQueryCache } from '../app/query-client'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useI18n } from '../i18n/useI18n'
import {
  findAdminRouteByPath,
  getBreadcrumbsForRoute,
  getVisibleAdminMenuGroups,
} from '../routes/admin-route-registry'
import { useAuthStore } from '../stores/auth-store'
import { ThemeSwitcher } from '../theme/ThemeSwitcher'

function navItemClass(isActive: boolean) {
  return [
    'inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition',
    isActive
      ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
  ].join(' ')
}

export function AdminShell() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const accessToken = useAuthStore((state) => state.accessToken)
  const permissions = useAuthStore((state) => state.permissions)
  const setUser = useAuthStore((state) => state.setUser)
  const reset = useAuthStore((state) => state.reset)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useQuery({
    queryKey: ['me', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const profile = await api.me()
      setUser(profile)
      return profile
    },
  })

  function leaveSession() {
    reset()
    clearQueryCache()
    void navigate({ to: '/login' })
  }

  async function signOut() {
    try {
      await api.logout()
    } finally {
      leaveSession()
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsChangingPassword(true)

    try {
      await api.changePassword({ currentPassword, newPassword })
      toast.success(t('page.changePassword.success'))
      setIsPasswordDialogOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      leaveSession()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('page.changePassword.error'),
      )
    } finally {
      setIsChangingPassword(false)
    }
  }

  const visibleGroups = getVisibleAdminMenuGroups(permissions)
  const currentRoute = findAdminRouteByPath(location.pathname)
  const breadcrumbs = currentRoute
    ? getBreadcrumbsForRoute(currentRoute.id).map((breadcrumb) =>
        t(breadcrumb.labelKey),
      )
    : []
  const pageTitle = currentRoute
    ? t(currentRoute.titleKey ?? currentRoute.labelKey)
    : ''

  function renderNavItem(
    route: (typeof visibleGroups)[number]['children'][number],
    mobile = false,
  ) {
    const Icon = route.icon ?? Circle
    const testPrefix = mobile ? 'mobile-nav' : 'nav'
    const isActive = location.pathname === route.path

    return (
      <Link
        className={navItemClass(isActive)}
        data-testid={`${testPrefix}-${route.id}`}
        key={`${testPrefix}-${route.path}`}
        to={route.path}
      >
        <Icon size={16} />
        {t(route.labelKey)}
      </Link>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--color-app)] text-[var(--color-text)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-5 md:block">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
            <Lock size={18} />
          </div>
          <div>
            <p className="font-semibold">Common Admin</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        <nav className="mt-8 grid gap-5 text-sm">
          {visibleGroups.map((group) => (
            <div data-testid={`nav-group-${group.id}`} key={group.id}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
                {t(group.labelKey)}
              </p>
              <div className="grid gap-1">
                {group.children.map((route) => renderNavItem(route))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <section className="md:pl-64">
        <nav className="flex gap-2 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 md:hidden">
          {visibleGroups.map((group) =>
            group.children.map((route) => renderNavItem(route, true)),
          )}
        </nav>

        <header className="flex h-16 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{pageTitle}</h1>
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {breadcrumbs.length > 0 ? breadcrumbs.join(' / ') : t('page.apiActive')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher
              className="border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
              tone="light"
            />
            <button
              aria-label={`Open ${t('page.changePassword')} dialog`}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-3 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              onClick={() => setIsPasswordDialogOpen(true)}
              type="button"
            >
              <KeyRound size={16} />
              {t('page.changePassword')}
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-3 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              onClick={() => {
                void signOut().catch(() => undefined)
              }}
              type="button"
            >
              <LogOut size={16} />
              {t('page.signOut')}
            </button>
          </div>
        </header>

        <Outlet />
      </section>

      {isPasswordDialogOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
        >
          <form
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              void changePassword(event)
            }}
          >
            <h3 className="text-base font-semibold text-slate-950">
              {t('page.changePassword.title')}
            </h3>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">
                  {t('page.changePassword.currentPassword')}
                </span>
                <input
                  aria-label={t('page.changePassword.currentPassword')}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  type="password"
                  value={currentPassword}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">
                  {t('page.changePassword.newPassword')}
                </span>
                <input
                  aria-label={t('page.changePassword.newPassword')}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500"
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  value={newPassword}
                />
              </label>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isChangingPassword}
                onClick={() => {
                  setIsPasswordDialogOpen(false)
                  setCurrentPassword('')
                  setNewPassword('')
                }}
                type="button"
              >
                {t('users.form.cancel')}
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md bg-cyan-500 px-4 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={
                  isChangingPassword ||
                  currentPassword.length === 0 ||
                  newPassword.length < 8
                }
                type="submit"
              >
                {t('page.changePassword')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}
