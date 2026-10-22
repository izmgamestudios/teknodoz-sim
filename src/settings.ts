// Site settings shared by the browser and the server (the server imports this file through Node's type stripping,
// so keep it to erasable TypeScript: no enums, no parameter properties).
export const SETTINGS_LANGS = ['tr', 'en', 'de', 'es']
export const BUILTIN_PAGES = ['dashboard', 'personas', 'runs', 'study', 'guide', 'faq', 'admin', 'credits']

export type LText = Record<string, string>
export type NavEntry = { type: 'builtin' | 'page' | 'link'; ref: string; label: LText; icon: string; visible: boolean }
export type CustomPage = { slug: string; title: LText; body: LText; published: boolean }
export type Settings = {
  brand: { nameA: string; nameB: string; subtitle: LText; beta: LText; showBeta: boolean; logoUrl: string; version: LText }
  design: {
    brandColor: string
    radius: 'none' | 'sm' | 'md' | 'lg' | 'xl'
    density: 'compact' | 'comfortable'
    sidebarWidth: number
    fontScale: number
    defaultTheme: 'system' | 'dark' | 'light'
    defaultLang: string
    enabledLangs: string[]
    showLangSwitcher: boolean
    showThemeToggle: boolean
  }
  sidebar: { items: NavEntry[] }
  header: { enabled: boolean; sticky: boolean; title: LText; links: NavEntry[] }
  footer: { enabled: boolean; text: LText; copyright: LText; columns: { title: LText; links: NavEntry[] }[]; social: NavEntry[] }
  pages: { disabled: string[]; custom: CustomPage[] }
  content: Record<string, Record<string, string>>
  seed: { hiddenTasks: string[]; hiddenTemplates: string[]; hiddenExamples: string[]; hiddenCountries: string[]; models: string[] }
}

export const ICONS = ['◈', '☺', '▶', '✚', '❖', '?', '⚙', '★', '●', '■', '▲', '♥', '✉', '☰', '⌂', '⚑', '✎', '☎', '☁', '✔']
export const DEFAULT_ICONS: Record<string, string> = {
  dashboard: '◈', personas: '☺', runs: '▶', study: '✚', guide: '❖', faq: '?', admin: '⚙', credits: '★',
}
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/
export const LIMITS = { entries: 24, columns: 4, pages: 20, label: 60, title: 120, body: 20_000, text: 400, overrides: 3000, override: 4000, list: 200 }

export function defaultSettings(): Settings {
  const items: NavEntry[] = BUILTIN_PAGES.map((id) => ({ type: 'builtin', ref: id, label: {}, icon: DEFAULT_ICONS[id], visible: true }))
  return {
    brand: { nameA: 'Tekno', nameB: 'doz', subtitle: {}, beta: {}, showBeta: true, logoUrl: '', version: {} },
    design: {
      brandColor: '#6366f1', radius: 'md', density: 'comfortable', sidebarWidth: 256, fontScale: 100,
      defaultTheme: 'system', defaultLang: '', enabledLangs: [...SETTINGS_LANGS], showLangSwitcher: true, showThemeToggle: true,
    },
    sidebar: { items },
    header: { enabled: false, sticky: true, title: {}, links: [] },
    footer: { enabled: true, text: {}, copyright: {}, columns: [], social: [] },
    pages: { disabled: [], custom: [] },
    content: {},
    seed: { hiddenTasks: [], hiddenTemplates: [], hiddenExamples: [], hiddenCountries: [], models: [] },
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : fallback)
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)
const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback
}

export function lText(v: unknown, max: number): LText {
  const out: LText = {}
  if (!isObj(v)) return out
  for (const l of SETTINGS_LANGS) {
    const s = str(v[l], max).trim()
    if (s) out[l] = s
  }
  return out
}

/** Only http(s) and mailto links, or site-relative paths, may be stored. */
export function safeUrl(v: unknown): string {
  const s = str(v, 500).trim()
  if (!s) return ''
  if (/^(https?:\/\/|mailto:)/i.test(s)) {
    try {
      const u = new URL(s)
      if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') return u.href
    } catch {
      return ''
    }
    return ''
  }
  return ''
}

function navEntry(v: unknown, customSlugs: Set<string>): NavEntry | null {
  if (!isObj(v)) return null
  const type = pick(v.type, ['builtin', 'page', 'link'] as const, 'link')
  let ref = ''
  if (type === 'builtin') ref = BUILTIN_PAGES.includes(v.ref as string) ? (v.ref as string) : ''
  else if (type === 'page') ref = customSlugs.has(v.ref as string) ? (v.ref as string) : ''
  else ref = safeUrl(v.ref)
  if (!ref) return null
  const icon = ICONS.includes(v.icon as string) ? (v.icon as string) : type === 'builtin' ? DEFAULT_ICONS[ref] : '●'
  return { type, ref, label: lText(v.label, LIMITS.label), icon, visible: bool(v.visible, true) }
}

function navList(v: unknown, customSlugs: Set<string>, max: number): NavEntry[] {
  if (!Array.isArray(v)) return []
  const out: NavEntry[] = []
  for (const item of v.slice(0, max)) {
    const e = navEntry(item, customSlugs)
    if (e) out.push(e)
  }
  return out
}

/** Flattens a dictionary into { 'a.b.0.c': 'text' } for its string leaves. */
export function flattenStrings(dict: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof dict === 'string') {
    out[prefix] = dict
  } else if (Array.isArray(dict)) {
    dict.forEach((v, i) => flattenStrings(v, prefix ? `${prefix}.${i}` : String(i), out))
  } else if (isObj(dict)) {
    for (const k of Object.keys(dict)) flattenStrings(dict[k], prefix ? `${prefix}.${k}` : k, out)
  }
  return out
}

const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

/** Returns a copy of `dict` with string leaves replaced; unknown or unsafe paths are ignored. */
export function applyOverrides<T>(dict: T, overrides: Record<string, string> | undefined): T {
  if (!overrides) return dict
  const paths = Object.keys(overrides)
  if (!paths.length) return dict
  const clone = (v: unknown): unknown => (Array.isArray(v) ? v.map(clone) : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v)
  const copy = clone(dict) as Record<string, unknown>
  for (const path of paths) {
    const parts = path.split('.')
    if (parts.some((p) => BAD_KEYS.has(p))) continue
    let node: unknown = copy
    for (let i = 0; i < parts.length - 1 && node !== undefined; i++) {
      node = (node as Record<string, unknown>)[parts[i]]
    }
    const last = parts[parts.length - 1]
    if (node && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, last) && typeof (node as Record<string, unknown>)[last] === 'string') {
      ;(node as Record<string, unknown>)[last] = overrides[path]
    }
  }
  return copy as T
}

/** `knownPaths` maps a language to the flattened default dictionary, used to reject invented paths. */
export function sanitizeSettings(raw: unknown, knownPaths: Record<string, Record<string, string>> | null): Settings {
  const d = defaultSettings()
  const r = isObj(raw) ? raw : {}
  const b = isObj(r.brand) ? r.brand : {}
  const g = isObj(r.design) ? r.design : {}
  const sb = isObj(r.sidebar) ? r.sidebar : {}
  const h = isObj(r.header) ? r.header : {}
  const f = isObj(r.footer) ? r.footer : {}
  const p = isObj(r.pages) ? r.pages : {}
  const sd = isObj(r.seed) ? r.seed : {}

  // Custom pages first: menu entries may point at them.
  const custom: CustomPage[] = []
  const slugs = new Set<string>()
  for (const c of Array.isArray(p.custom) ? p.custom.slice(0, LIMITS.pages) : []) {
    if (!isObj(c)) continue
    const slug = str(c.slug, 40).trim().toLowerCase()
    if (!SLUG_RE.test(slug) || slugs.has(slug) || BUILTIN_PAGES.includes(slug)) continue
    slugs.add(slug)
    custom.push({ slug, title: lText(c.title, LIMITS.title), body: lText(c.body, LIMITS.body), published: bool(c.published, true) })
  }

  const brand = {
    nameA: str(b.nameA, 30, d.brand.nameA).trim() || d.brand.nameA,
    nameB: str(b.nameB, 30, d.brand.nameB).trim(),
    subtitle: lText(b.subtitle, 40),
    beta: lText(b.beta, 40),
    showBeta: bool(b.showBeta, true),
    logoUrl: safeUrl(b.logoUrl),
    version: lText(b.version, 40),
  }

  const enabled = (Array.isArray(g.enabledLangs) ? g.enabledLangs : d.design.enabledLangs).filter((l, i, a) => SETTINGS_LANGS.includes(l as string) && a.indexOf(l) === i) as string[]
  const enabledLangs = enabled.length ? enabled : [...SETTINGS_LANGS]
  const design = {
    brandColor: COLOR_RE.test(String(g.brandColor)) ? String(g.brandColor).toLowerCase() : d.design.brandColor,
    radius: pick(g.radius, ['none', 'sm', 'md', 'lg', 'xl'] as const, 'md'),
    density: pick(g.density, ['compact', 'comfortable'] as const, 'comfortable'),
    sidebarWidth: num(g.sidebarWidth, 224, 320, 256),
    fontScale: num(g.fontScale, 90, 120, 100),
    defaultTheme: pick(g.defaultTheme, ['system', 'dark', 'light'] as const, 'system'),
    defaultLang: enabledLangs.includes(g.defaultLang as string) ? (g.defaultLang as string) : '',
    enabledLangs,
    showLangSwitcher: bool(g.showLangSwitcher, true),
    showThemeToggle: bool(g.showThemeToggle, true),
  }

  // Sidebar: every built-in page appears exactly once; custom/link entries keep the admin's order.
  const items = navList(sb.items, slugs, LIMITS.entries + BUILTIN_PAGES.length)
  const seenBuiltin = new Set<string>()
  const seenPage = new Set<string>()
  const sidebarItems = items.filter((e) => {
    if (e.type === 'builtin') {
      if (seenBuiltin.has(e.ref)) return false
      seenBuiltin.add(e.ref)
    }
    if (e.type === 'page') {
      if (seenPage.has(e.ref)) return false
      seenPage.add(e.ref)
    }
    return true
  })
  for (const id of BUILTIN_PAGES) {
    if (!seenBuiltin.has(id)) sidebarItems.push({ type: 'builtin', ref: id, label: {}, icon: DEFAULT_ICONS[id], visible: true })
  }

  const disabled = (Array.isArray(p.disabled) ? p.disabled : []).filter((x, i, a) => BUILTIN_PAGES.includes(x as string) && x !== 'admin' && a.indexOf(x) === i) as string[]

  const columns: Settings['footer']['columns'] = []
  for (const c of Array.isArray(f.columns) ? f.columns.slice(0, LIMITS.columns) : []) {
    if (isObj(c)) columns.push({ title: lText(c.title, LIMITS.label), links: navList(c.links, slugs, 12) })
  }

  const ids = (v: unknown, re: RegExp) => (Array.isArray(v) ? v.filter((x, i, a): x is string => typeof x === 'string' && re.test(x) && a.indexOf(x) === i).slice(0, LIMITS.list * 2) : [])
  const seed = {
    hiddenTasks: ids(sd.hiddenTasks, /^[\w.-]{1,120}$/),
    hiddenTemplates: ids(sd.hiddenTemplates, /^[a-z]{1,20}$/),
    hiddenExamples: ids(sd.hiddenExamples, /^[a-z]{1,20}$/),
    hiddenCountries: ids(sd.hiddenCountries, /^[A-Z]{2}$/),
    models: ids(sd.models, /^[\w.:/@-]{1,80}$/).slice(0, 30),
  }

  const content: Settings['content'] = {}
  let total = 0
  if (isObj(r.content)) {
    for (const l of SETTINGS_LANGS) {
      const m = (r.content as Record<string, unknown>)[l]
      if (!isObj(m)) continue
      const clean: Record<string, string> = {}
      for (const path of Object.keys(m)) {
        if (total >= LIMITS.overrides) break
        const v = m[path]
        if (typeof v !== 'string' || path.split('.').some((s) => BAD_KEYS.has(s))) continue
        if (knownPaths && !(path in (knownPaths[l] ?? {}))) continue
        clean[path] = str(v, LIMITS.override)
        total++
      }
      if (Object.keys(clean).length) content[l] = clean
    }
  }

  return {
    brand,
    design,
    sidebar: { items: sidebarItems },
    header: { enabled: bool(h.enabled, false), sticky: bool(h.sticky, true), title: lText(h.title, LIMITS.label), links: navList(h.links, slugs, LIMITS.entries) },
    footer: { enabled: bool(f.enabled, true), text: lText(f.text, LIMITS.text), copyright: lText(f.copyright, LIMITS.text), columns, social: navList(f.social, slugs, 8) },
    pages: { disabled, custom },
    content,
    seed,
  }
}

/** Picks the text for `lang`, falling back through en, tr and any other language. */
export function pickText(v: LText | undefined, lang: string): string {
  if (!v) return ''
  return v[lang] || v.en || v.tr || SETTINGS_LANGS.map((l) => v[l]).find(Boolean) || ''
}

/** Text for exactly `lang`, without falling back to another language (callers then use the built-in default). */
export function ownText(v: LText | undefined, lang: string): string {
  return v?.[lang] ?? ''
}
