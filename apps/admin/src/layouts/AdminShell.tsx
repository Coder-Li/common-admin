import { useQuery } from '@tanstack/react-query'
import { BookOpen, Lock, LogOut, Settings, Users } from 'lucide-react'
import { api } from '../app/api-client'
import { clearQueryCache } from '../app/query-client'
import { DictionariesPage } from '../features/dictionaries/DictionariesPage'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useI18n } from '../i18n/useI18n'
import { navigateTo } from '../lib/navigation'
import { UsersPage } from '../features/users/UsersPage'
import { DashboardContent } from '../pages/DashboardContent'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { useAuthStore } from '../stores/auth-store'

interface AdminShellProps {
  currentPath: string
}

function navItemClass(isActive: boolean) {
  return [
    'inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition',
    isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100',
  ].join(' ')
}

export function AdminShell({ currentPath }: AdminShellProps) {
  const { t } = useI18n()
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
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

  const pageTitle =
    currentPath === '/users'
      ? t('nav.users')
      : currentPath === '/dictionaries'
        ? t('nav.dictionaries')
      : currentPath === '/settings'
        ? t('nav.settings')
        : t('nav.dashboard')

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 md:block">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-cyan-500 text-white">
            <Lock size={18} />
          </div>
          <div>
            <p className="font-semibold">Common Admin</p>
            <p className="text-xs text-slate-500">{t('app.subtitle')}</p>
          </div>
        </div>

        <nav className="mt-8 grid gap-1 text-sm">
          <button
            className={navItemClass(currentPath === '/dashboard')}
            data-testid="nav-dashboard"
            onClick={() => navigateTo('/dashboard')}
            type="button"
          >
            <Lock size={16} />
            {t('nav.dashboard')}
          </button>
          <button
            className={navItemClass(currentPath === '/users')}
            data-testid="nav-users"
            onClick={() => navigateTo('/users')}
            type="button"
          >
            <Users size={16} />
            {t('nav.users')}
          </button>
          <button
            className={navItemClass(currentPath === '/dictionaries')}
            data-testid="nav-dictionaries"
            onClick={() => navigateTo('/dictionaries')}
            type="button"
          >
            <BookOpen size={16} />
            {t('nav.dictionaries')}
          </button>
          <button
            className={navItemClass(currentPath === '/settings')}
            data-testid="nav-settings"
            onClick={() => navigateTo('/settings')}
            type="button"
          >
            <Settings size={16} />
            {t('nav.settings')}
          </button>
        </nav>
      </aside>

      <section className="md:pl-64">
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-3 md:hidden">
          <button
            className={navItemClass(currentPath === '/dashboard')}
            data-testid="mobile-nav-dashboard"
            onClick={() => navigateTo('/dashboard')}
            type="button"
          >
            <Lock size={16} />
            {t('nav.dashboard')}
          </button>
          <button
            className={navItemClass(currentPath === '/users')}
            data-testid="mobile-nav-users"
            onClick={() => navigateTo('/users')}
            type="button"
          >
            <Users size={16} />
            {t('nav.users')}
          </button>
          <button
            className={navItemClass(currentPath === '/dictionaries')}
            data-testid="mobile-nav-dictionaries"
            onClick={() => navigateTo('/dictionaries')}
            type="button"
          >
            <BookOpen size={16} />
            {t('nav.dictionaries')}
          </button>
          <button
            className={navItemClass(currentPath === '/settings')}
            data-testid="mobile-nav-settings"
            onClick={() => navigateTo('/settings')}
            type="button"
          >
            <Settings size={16} />
            {t('nav.settings')}
          </button>
        </nav>

        <header className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{pageTitle}</h1>
            <p className="truncate text-xs text-slate-500">
              {t('page.apiActive')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher
              className="border-slate-300 bg-white text-slate-600"
              tone="light"
            />
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm"
              onClick={signOut}
              type="button"
            >
              <LogOut size={16} />
              {t('page.signOut')}
            </button>
          </div>
        </header>

        {currentPath === '/users' ? (
          <UsersPage />
        ) : currentPath === '/dictionaries' ? (
          <DictionariesPage />
        ) : currentPath === '/settings' ? (
          <PlaceholderPage
            icon={<Settings size={20} />}
            title={t('nav.settings')}
            description={t('page.settingsDescription')}
          />
        ) : (
          <DashboardContent isLoading={meQuery.isLoading} user={user} />
        )}
      </section>
    </main>
  )
}
