import { useSiteSettings } from './siteSettings'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'teknodoz-theme'

const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })

function saved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* storage unavailable */
  }
  return null
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSiteSettings()
  const [chosen, setChosen] = useState<Theme | null>(saved)
  const def = settings.design.defaultTheme
  const theme: Theme = chosen ?? (def === 'dark' || def === 'light' ? def : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setChosen(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* ignore */
    }
  }

  return (
    <Ctx.Provider value={{ theme, toggle }}>
      {children}
    </Ctx.Provider>
  )
}

export const useTheme = () => useContext(Ctx)
