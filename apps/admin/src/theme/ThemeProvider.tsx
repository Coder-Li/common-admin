import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext } from './theme-context'
import {
  getSavedTheme,
  persistTheme,
  resolveInitialTheme,
  type Theme,
} from './theme-storage'

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme | null
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({
  children,
  defaultTheme = null,
}: ThemeProviderProps) {
  const userChangedThemeRef = useRef(false)
  const [theme, setThemeState] = useState<Theme>(() =>
    resolveInitialTheme(undefined, defaultTheme),
  )

  useEffect(() => {
    if (userChangedThemeRef.current || !defaultTheme || getSavedTheme()) {
      return
    }

    setThemeState(defaultTheme)
  }, [defaultTheme])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme(nextTheme: Theme) {
        userChangedThemeRef.current = true
        setThemeState(nextTheme)
        persistTheme(nextTheme)
      },
      toggleTheme() {
        userChangedThemeRef.current = true
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
