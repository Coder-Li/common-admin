import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext } from './theme-context'
import {
  persistTheme,
  resolveInitialTheme,
  type Theme,
} from './theme-storage'

interface ThemeProviderProps {
  children: ReactNode
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => resolveInitialTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme(nextTheme: Theme) {
        setThemeState(nextTheme)
        persistTheme(nextTheme)
      },
      toggleTheme() {
        setThemeState((currentTheme) => {
          const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
          persistTheme(nextTheme)
          return nextTheme
        })
      },
    }),
    [theme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
