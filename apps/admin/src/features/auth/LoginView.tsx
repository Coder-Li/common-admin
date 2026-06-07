import { useState } from 'react'
import type { FormEvent } from 'react'
import { LogIn, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../app/api-client'
import { clearQueryCache } from '../../app/query-client'
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher'
import { useI18n } from '../../i18n/useI18n'
import { navigateTo } from '../../lib/navigation'
import { useAuthStore } from '../../stores/auth-store'

export function LoginView() {
  const { t } = useI18n()
  const [usernameOrEmail, setUsernameOrEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('Admin123!')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const setSession = useAuthStore((state) => state.setSession)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const session = await api.login({ usernameOrEmail, password })
      clearQueryCache()
      setSession(session)
      navigateTo('/dashboard')
      toast.success(t('auth.welcomeBack', { firstName: session.user.firstName }))
    } catch {
      toast.error(t('auth.invalidCredentials'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-cyan-400 text-slate-950">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-normal">
              Common Admin
            </h1>
            <p className="text-sm text-slate-400">{t('auth.signInSubtitle')}</p>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm">
            <span className="text-slate-300">{t('auth.usernameOrEmail')}</span>
            <input
              aria-label={t('auth.usernameOrEmail')}
              className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm outline-none transition focus:border-cyan-400"
              value={usernameOrEmail}
              onChange={(event) => setUsernameOrEmail(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-slate-300">{t('auth.password')}</span>
            <input
              aria-label={t('auth.password')}
              className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm outline-none transition focus:border-cyan-400"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button
            className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cyan-400 px-4 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            <LogIn size={16} />
            {isSubmitting ? t('auth.signingIn') : t('auth.signInCta')}
          </button>
        </form>
      </section>
    </main>
  )
}
