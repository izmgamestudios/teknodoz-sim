import type { ReactNode } from 'react'
import { useI18n } from './i18n'
import { ownText, pickText, type CustomPage, type NavEntry, type Settings } from './settings'

export type Route = string // a built-in page id or `page:<slug>`

export function entryRoute(e: NavEntry): Route | null {
  return e.type === 'builtin' ? e.ref : e.type === 'page' ? `page:${e.ref}` : null
}

/** Whether a menu entry may be shown right now (page switched off or unpublished entries are hidden). */
export function entryAvailable(e: NavEntry, s: Settings): boolean {
  if (!e.visible) return false
  if (e.type === 'builtin') return e.ref === 'admin' || !s.pages.disabled.includes(e.ref)
  if (e.type === 'page') return s.pages.custom.some((p) => p.slug === e.ref && p.published)
  return true
}

export function routeAvailable(route: Route, s: Settings): boolean {
  if (route.startsWith('page:')) return s.pages.custom.some((p) => p.slug === route.slice(5) && p.published)
  return route === 'admin' || (!s.pages.disabled.includes(route))
}

export function useEntryLabel() {
  const { t, lang } = useI18n()
  return (e: NavEntry, s: Settings): string => {
    const own = e.type === 'builtin' ? ownText(e.label, lang) : pickText(e.label, lang)
    if (own) return own
    if (e.type === 'builtin') return t.nav[e.ref as keyof typeof t.nav] ?? e.ref
    if (e.type === 'page') return pickText(s.pages.custom.find((p) => p.slug === e.ref)?.title, lang) || e.ref
    try {
      return new URL(e.ref).hostname || e.ref
    } catch {
      return e.ref
    }
  }
}

export function pageTitle(p: CustomPage, lang: string): string {
  return pickText(p.title, lang) || p.slug
}

type LinkProps = { entry: NavEntry; label: string; go: (r: Route) => void; className?: string; activeClass?: string; active?: boolean; children?: ReactNode; onNavigate?: () => void }

/** A menu entry: in-app route (button) or external link (anchor, new tab). */
export function EntryLink({ entry, label, go, className = '', activeClass = '', active = false, children, onNavigate }: LinkProps) {
  const route = entryRoute(entry)
  const cls = `${className} ${active ? activeClass : ''}`
  if (route) {
    return (
      <button type="button" aria-current={active ? 'page' : undefined} className={cls} onClick={() => { go(route); onNavigate?.() }}>
        {children ?? label}
      </button>
    )
  }
  return (
    <a href={entry.ref} target="_blank" rel="noopener noreferrer" className={cls} onClick={onNavigate}>
      {children ?? label}
    </a>
  )
}
