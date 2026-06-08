import { Moon, Sun } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'
import { useTheme } from './useTheme'

interface ThemeSwitcherProps {
  className?: string
}

export function ThemeSwitcher({ className = '' }: ThemeSwitcherProps) {
  const { t } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? t('theme.switchToLight') : t('theme.switchToDark')
  const Icon = isDark ? Sun : Moon

  return (
    <button
      aria-label={label}
      className={[
        'grid size-9 shrink-0 place-items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
        className,
      ].join(' ')}
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={16} />
    </button>
  )
}
