import { CREDITS } from '../config'
import { useI18n } from '../i18n'
import { EntryLink, entryAvailable, useEntryLabel, type Route } from '../nav'
import { pickText } from '../settings'
import { useSiteSettings } from '../siteSettings'

export default function SiteFooter({ go }: { go: (r: Route) => void }) {
  const { lang } = useI18n()
  const { settings } = useSiteSettings()
  const label = useEntryLabel()
  const f = settings.footer
  if (!f.enabled) return null
  const text = pickText(f.text, lang)
  const copyright = pickText(f.copyright, lang) || `© ${new Date().getFullYear()} Teknodoz · ${CREDITS.studio}`
  const columns = f.columns
    .map((c) => ({ title: pickText(c.title, lang), links: c.links.filter((e) => entryAvailable(e, settings)) }))
    .filter((c) => c.links.length)
  const social = f.social.filter((e) => entryAvailable(e, settings))
  const linkCls = 'block py-0.5 text-left hover:text-brand'
  return (
    <footer className="border-t border-slate-200 px-5 py-6 text-xs text-slate-500 dark:border-slate-800 md:ml-[var(--sidebar-w)] md:px-10">
      {(text || columns.length > 0) && (
        <div className="mb-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {text && <p className="max-w-xs">{text}</p>}
          {columns.map((c, i) => (
            <div key={i}>
              {c.title && <div className="mb-1 font-semibold text-slate-700 dark:text-slate-300">{c.title}</div>}
              {c.links.map((e, j) => <EntryLink key={j} entry={e} label={label(e, settings)} go={go} className={linkCls} />)}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{copyright}</span>
        <nav aria-label="social" className="flex flex-wrap gap-4">
          {social.map((e, i) => <EntryLink key={i} entry={e} label={label(e, settings)} go={go} className="hover:text-brand" />)}
        </nav>
      </div>
    </footer>
  )
}
