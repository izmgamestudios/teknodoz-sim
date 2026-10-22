import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { tr, type Dict } from './tr'
import { en } from './en'
import { de } from './de'
import { es } from './es'

export const LANGS = { tr, en, de, es } as const
export type Lang = keyof typeof LANGS
const KEY = 'teknodoz-lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && saved in LANGS) return saved as Lang
  } catch {
    /* storage unavailable */
  }
  const nav = navigator.language.slice(0, 2).toLowerCase()
  return nav in LANGS ? (nav as Lang) : 'en'
}

const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({
  lang: 'tr', t: tr, setLang: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initial)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  return <Ctx.Provider value={{ lang, t: LANGS[lang], setLang }}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
