import { useI18n } from './useI18n'
import type { Locale } from './messages'

const localeOptions: Array<{ locale: Locale; labelKey: 'language.chinese' | 'language.english' }> = [
  { locale: 'zh-CN', labelKey: 'language.chinese' },
  { locale: 'en-US', labelKey: 'language.english' },
]

export function LanguageSwitcher({
  className = '',
  tone = 'dark',
}: {
  className?: string
  tone?: 'dark' | 'light'
}) {
  const { locale, setLocale, t } = useI18n()
  const inactiveClass =
    tone === 'dark'
      ? 'text-slate-400 hover:text-slate-100'
      : 'text-slate-600 hover:text-slate-950'

  return (
    <div
      aria-label={t('language.label')}
      className={[
        'inline-flex h-8 shrink-0 items-center rounded-md border border-slate-700 p-0.5 text-xs',
        className,
      ].join(' ')}
      role="group"
    >
      {localeOptions.map((option) => {
        const isActive = option.locale === locale

        return (
          <button
            aria-pressed={isActive}
            className={[
              'grid h-7 min-w-11 place-items-center rounded px-2 transition',
              isActive
                ? 'bg-cyan-400 font-medium text-slate-950'
                : inactiveClass,
            ].join(' ')}
            key={option.locale}
            onClick={() => setLocale(option.locale)}
            type="button"
          >
            {t(option.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
