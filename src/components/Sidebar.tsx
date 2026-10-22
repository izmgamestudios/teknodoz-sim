import { useState } from 'react'
import { useI18n, LANGS, type Lang } from '../i18n'
import { EntryLink, entryAvailable, entryRoute, useEntryLabel, type Route } from '../nav'
import { ownText } from '../settings'
import { useSiteSettings } from '../siteSettings'
import { useTheme } from '../theme'

type Props = { active: Route; onSelect: (id: Route) => void }

export default function Sidebar({ active, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const { t, lang, setLang, langs } = useI18n()
  const { settings } = useSiteSettings()
  const label = useEntryLabel()
  const { brand, design } = settings
  const pad = design.density === 'compact' ? 'py-1' : 'py-2'

  return (
    <>
      <button
        type="button"
        aria-label={t.sidebar.menu}
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 rounded-lg bg-slate-200 px-3 py-2 text-lg dark:bg-slate-800 md:hidden"
      >
        ☰
      </button>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} />}
      <aside
        style={{ width: 'var(--sidebar-w)' }}
        className={`fixed inset-y-0 left-0 z-40 flex max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 pb-4 pt-6">
          {brand.logoUrl && <img src={brand.logoUrl} alt="" className="mb-2 h-8 max-w-full object-contain object-left" />}
          <div className="text-xl font-bold tracking-tight">
            {brand.nameA}
            {brand.nameB && <span className="text-brand">{brand.nameB}</span>}
          </div>
          <div lang="en" className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
            {ownText(brand.subtitle, lang) || t.brand.simulation}
          </div>
          {brand.showBeta && (
            <span className="mt-3 inline-block rounded-full border border-amber-500/40 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
              {ownText(brand.beta, lang) || t.brand.beta}
            </span>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {settings.sidebar.items.filter((e) => entryAvailable(e, settings)).map((e, i) => (
            <EntryLink
              key={`${e.type}:${e.ref}:${i}`}
              entry={e}
              label={label(e, settings)}
              go={onSelect}
              onNavigate={() => setOpen(false)}
              active={entryRoute(e) === active}
              className={`flex w-full items-center gap-3 rounded-lg px-3 ${pad} text-left text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white`}
              activeClass="!bg-brand/15 font-medium !text-brand-dark dark:!bg-brand/20 dark:!text-white"
            >
              <span className="w-5 text-center" aria-hidden>{e.icon}</span>
              <span className="min-w-0 flex-1 truncate">{label(e, settings)}</span>
              {e.type === 'link' && <span aria-hidden className="text-xs opacity-60">↗</span>}
            </EntryLink>
          ))}
        </nav>
        <div className="space-y-3 border-t border-slate-200 px-5 py-4 text-xs text-slate-500 dark:border-slate-800">
          {design.showLangSwitcher && langs.length > 1 && (
            <label className="block">
              <span className="sr-only">{t.sidebar.language}</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              >
                {langs.map((l) => (
                  <option key={l} value={l}>
                    {LANGS[l].langName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-center justify-between">
            <span>{ownText(brand.version, lang) || t.sidebar.version}</span>
            {design.showThemeToggle && (
              <button type="button" onClick={toggle} aria-label={t.sidebar.theme} className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700">
                {theme === 'dark' ? t.sidebar.light : t.sidebar.dark}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
