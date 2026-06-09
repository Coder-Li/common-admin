import { useQuery } from '@tanstack/react-query'
import { Lock, LogOut } from 'lucide-react'
import { api } from '../app/api-client'
import { clearQueryCache } from '../app/query-client'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useI18n } from '../i18n/useI18n'
import { navigateTo } from '../lib/navigation'
import { findAdminRoute, getVisibleAdminRoutes } from '../routes/admin-routes'
import { useAuthStore } from '../stores/auth-store'
import { ThemeSwitcher } from '../theme/ThemeSwitcher'

interface AdminShellProps {
  currentPath: string
}

function navItemClass(isActive: boolean) {
  return [
    'inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition',
    isActive
      ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
  ].join(' ')
}

export function AdminShell({ currentPath }: AdminShellProps) {
  const { t } = useI18n()
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const permissions = useAuthStore((state) => state.permissions)
  const setUser = useAuthStore((state) => state.setUser)
  const reset = useAuthStore((state) => state.reset)

  const meQuery = useQuery({
    queryKey: ['me', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const profile = await api.me()
      setUser(profile)
      return profile
    },
  })

  function signOut() {
    reset()
    clearQueryCache()
    navigateTo('/login')
  }

  const visibleRoutes = getVisibleAdminRoutes(permissions)
  const currentRoute = findAdminRoute(currentPath) ?? visibleRoutes[0]
  const pageTitle = currentRoute ? t(currentRoute.labelKey) : ''
  const PageComponent = currentRoute?.component

  function renderNavItem(route: (typeof visibleRoutes)[number], mobile = false) {
    const Icon = route.icon
    const testPrefix = mobile ? 'mobile-nav' : 'nav'
    const testId = `${testPrefix}-${route.path.replace('/', '')}`

    return (
      <button
        className={navItemClass(currentPath === route.path)}
        data-testid={testId}
        key={`${testPrefix}-${route.path}`}
        onClick={() => navigateTo(route.path)}
        type="button"
      >
        <Icon size={16} />
        {t(route.labelKey)}
      </button>
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

        <nav className="mt-8 grid gap-1 text-sm">
          {visibleRoutes.map((route) => renderNavItem(route))}
        </nav>
      </aside>

      <section className="md:pl-64">
        <nav className="flex gap-2 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 md:hidden">
          {visibleRoutes.map((route) => renderNavItem(route, true))}
        </nav>

        <header className="flex h-16 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{pageTitle}</h1>
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {t('page.apiActive')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher
              className="border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
              tone="light"
            />
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-3 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              onClick={signOut}
              type="button"
            >
              <LogOut size={16} />
              {t('page.signOut')}
            </button>
          </div>
        </header>

        {PageComponent ? (
          <PageComponent isLoading={meQuery.isLoading} user={user} />
        ) : null}
      </section>
    </main>
  )
}
