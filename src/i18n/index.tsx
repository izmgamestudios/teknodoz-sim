import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyOverrides } from '../settings'
import { useSiteSettings } from '../siteSettings'
import { tr, type Dict } from './tr'
import { en } from './en'
import { de } from './de'
import { es } from './es'

export const LANGS = { tr, en, de, es } as const
export type Lang = keyof typeof LANGS
const KEY = 'teknodoz-lang'

function saved(): Lang | null {
  try {
    const v = localStorage.getItem(KEY)
    if (v && v in LANGS) return v as Lang
  } catch {
    /* storage unavailable */
  }
  return null
}

const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void; langs: Lang[] }>({
  lang: 'tr', t: tr, setLang: () => {}, langs: Object.keys(LANGS) as Lang[],
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSiteSettings()
  const langs = settings.design.enabledLangs.filter((l): l is Lang => l in LANGS)
  const [chosen, setChosen] = useState<Lang | null>(saved)
  const navLang = navigator.language.slice(0, 2).toLowerCase()
  const wanted = chosen ?? (settings.design.defaultLang in LANGS ? (settings.design.defaultLang as Lang) : navLang in LANGS ? (navLang as Lang) : 'en')
  const lang = langs.includes(wanted) ? wanted : langs[0] ?? 'en'

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (l: Lang) => {
    setChosen(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {
      /* ignore */
    }
  }

  const t = useMemo(() => applyOverrides(LANGS[lang] as Dict, settings.content[lang]), [lang, settings.content])
  return <Ctx.Provider value={{ lang, t, setLang, langs }}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
