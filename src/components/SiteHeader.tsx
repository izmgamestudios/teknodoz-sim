import { useI18n } from '../i18n'
import { EntryLink, entryAvailable, entryRoute, useEntryLabel, type Route } from '../nav'
import { pickText } from '../settings'
import { useSiteSettings } from '../siteSettings'

export default function SiteHeader({ active, go }: { active: Route; go: (r: Route) => void }) {
  const { lang } = useI18n()
  const { settings } = useSiteSettings()
  const label = useEntryLabel()
  const h = settings.header
  if (!h.enabled) return null
  const links = h.links.filter((e) => entryAvailable(e, settings))
  const title = pickText(h.title, lang)
  if (!title && !links.length) return null
  return (
    <header
      className={`${h.sticky ? 'sticky top-0 z-20' : ''} flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-200 bg-white/90 py-3 pl-14 pr-5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 md:ml-[var(--sidebar-w)] md:px-10`}
    >
      {title && <div className="font-semibold">{title}</div>}
      <nav aria-label="header" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {links.map((e, i) => (
          <EntryLink
            key={i}
            entry={e}
            label={label(e, settings)}
            go={go}
            active={entryRoute(e) === active}
            className="text-slate-600 hover:text-brand dark:text-slate-400"
            activeClass="!text-brand font-medium"
          />
        ))}
      </nav>
    </header>
  )
}
