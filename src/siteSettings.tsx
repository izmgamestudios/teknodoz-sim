import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { defaultSettings, type Settings } from './settings'

type Ctx = { settings: Settings; loaded: boolean; reload: () => Promise<void> }
const SettingsCtx = createContext<Ctx>({ settings: defaultSettings(), loaded: false, reload: async () => {} })

const RADII = {
  none: ['0px', '0px', '0px'],
  sm: ['0.25rem', '0.3rem', '0.5rem'],
  md: ['0.375rem', '0.5rem', '0.75rem'],
  lg: ['0.5rem', '0.75rem', '1rem'],
  xl: ['0.75rem', '1rem', '1.5rem'],
} as const

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
export function contrastWithWhite(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = rgb(hex).map(lin)
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (l + 0.05)
}

/** Writes the design settings into CSS variables on <html>. */
export function applyDesign(s: Settings['design']) {
  const root = document.documentElement
  const [r, g, b] = rgb(s.brandColor)
  root.style.setProperty('--brand', `${r} ${g} ${b}`)
  root.style.setProperty('--brand-dark', `${Math.round(r * 0.8)} ${Math.round(g * 0.8)} ${Math.round(b * 0.8)}`)
  const [md, lg, xl] = RADII[s.radius]
  root.style.setProperty('--r-md', md)
  root.style.setProperty('--r-lg', lg)
  root.style.setProperty('--r-xl', xl)
  root.style.setProperty('--sidebar-w', `${s.sidebarWidth / 16}rem`)
  root.style.fontSize = `${s.fontScale}%`
  root.dataset.density = s.density
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ settings: Settings; loaded: boolean }>({ settings: defaultSettings(), loaded: false })

  const reload = useCallback(async () => {
    try {
      const settings = await api<Settings>('/api/settings')
      setState({ settings, loaded: true })
    } catch {
      setState((s) => ({ ...s, loaded: true }))
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => applyDesign(state.settings.design), [state.settings.design])

  const value = useMemo(() => ({ ...state, reload }), [state, reload])
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>
}

export const useSiteSettings = () => useContext(SettingsCtx)
