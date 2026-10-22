import { useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api'
import { LANGS, useI18n } from '../i18n'
import { BUILTIN_PAGES, flattenStrings, ICONS, SETTINGS_LANGS, SLUG_RE, type CustomPage, type LText, type NavEntry, type Settings } from '../settings'
import { contrastWithWhite, useSiteSettings } from '../siteSettings'
import { reloadCountryPool, useCountryPool, countryName } from '../personas'
import { TASKS } from '../tasks'

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950'
const small = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950'
const btn = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:border-brand disabled:opacity-40 dark:border-slate-700'

type Update = (fn: (d: Settings) => void) => void

function LTextField({ label, value, onChange, placeholder, rows = 0 }: { label: string; value: LText; onChange: (v: LText) => void; placeholder?: Record<string, string>; rows?: number }) {
  const set = (l: string, v: string) => {
    const next = { ...value }
    if (v) next[l] = v
    else delete next[l]
    onChange(next)
  }
  return (
    <fieldset className="text-sm">
      <legend className="text-sm">{label}</legend>
      <div className={`mt-1 grid gap-2 ${rows ? 'sm:grid-cols-2' : 'sm:grid-cols-4'}`}>
        {SETTINGS_LANGS.map((l) => (
          <label key={l} className="block">
            <span className="text-[10px] font-semibold uppercase text-slate-500">{l}</span>
            {rows ? (
              <textarea rows={rows} aria-label={`${label} ${l}`} className={`${input} !mt-0 font-mono text-xs`} value={value[l] ?? ''} placeholder={placeholder?.[l]} onChange={(e) => set(l, e.target.value)} />
            ) : (
              <input aria-label={`${label} ${l}`} className={`${input} !mt-0`} value={value[l] ?? ''} placeholder={placeholder?.[l]} onChange={(e) => set(l, e.target.value)} />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Check({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="accent-indigo-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function EntryEditor({ entries, onChange, settings, lockBuiltin = false, max = 24 }: { entries: NavEntry[]; onChange: (e: NavEntry[]) => void; settings: Settings; lockBuiltin?: boolean; max?: number }) {
  const { t } = useI18n()
  const e = t.admin.set.entry
  const pages = settings.pages.custom
  const patch = (i: number, p: Partial<NavEntry>) => onChange(entries.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= entries.length) return
    const next = [...entries]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {entries.map((en, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={e.icon} className={small} value={en.icon} onChange={(ev) => patch(i, { icon: ev.target.value })}>
              {ICONS.map((ic) => <option key={ic}>{ic}</option>)}
            </select>
            {lockBuiltin && en.type === 'builtin' ? (
              <span className="text-sm font-medium">{t.nav[en.ref as keyof typeof t.nav]}</span>
            ) : (
              <>
                <select aria-label={e.target} className={small} value={en.type} onChange={(ev) => {
                  const type = ev.target.value as NavEntry['type']
                  patch(i, { type, ref: type === 'builtin' ? 'dashboard' : type === 'page' ? pages[0]?.slug ?? '' : '' })
                }}>
                  <option value="builtin">{e.builtin}</option>
                  <option value="page" disabled={!pages.length}>{e.page}</option>
                  <option value="link">{e.link}</option>
                </select>
                {en.type === 'builtin' && (
                  <select aria-label={e.target} className={small} value={en.ref} onChange={(ev) => patch(i, { ref: ev.target.value })}>
                    {BUILTIN_PAGES.map((id) => <option key={id} value={id}>{t.nav[id as keyof typeof t.nav]}</option>)}
                  </select>
                )}
                {en.type === 'page' && (
                  <select aria-label={e.target} className={small} value={en.ref} onChange={(ev) => patch(i, { ref: ev.target.value })}>
                    {pages.map((p) => <option key={p.slug} value={p.slug}>{p.slug}</option>)}
                  </select>
                )}
                {en.type === 'link' && (
                  <input aria-label={e.url} className={`${small} min-w-[14rem] flex-1`} placeholder={e.url} value={en.ref} onChange={(ev) => patch(i, { ref: ev.target.value })} />
                )}
              </>
            )}
            <Check label={e.visible} checked={en.visible} onChange={(v) => patch(i, { visible: v })} />
            <span className="ml-auto flex gap-1">
              <button type="button" aria-label={e.up} className={small} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" aria-label={e.down} className={small} onClick={() => move(i, 1)} disabled={i === entries.length - 1}>↓</button>
              {!(lockBuiltin && en.type === 'builtin') && (
                <button type="button" aria-label={e.remove} className={`${small} text-red-500`} onClick={() => onChange(entries.filter((_, j) => j !== i))}>✕</button>
              )}
            </span>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-500">{e.label} · {e.labelHint}</summary>
            <div className="mt-2"><LTextField label={e.label} value={en.label} onChange={(v) => patch(i, { label: v })} /></div>
          </details>
        </div>
      ))}
      {entries.length < max && (
        <button type="button" className={btn} onClick={() => onChange([...entries, { type: 'link', ref: '', label: {}, icon: '●', visible: true }])}>
          + {t.admin.set.addEntry}
        </button>
      )}
    </div>
  )
}

function BrandTab({ d, update }: { d: Settings; update: Update }) {
  const { t, lang } = useI18n()
  const s = t.admin.set
  const low = contrastWithWhite(d.design.brandColor) < 3
  return (
    <div className="space-y-6">
      <div className={`${card} space-y-4`}>
        <h2 className="font-semibold">{s.brandTitle}</h2>
        <p className="text-xs text-slate-500">{s.langHint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{s.nameA}<input className={input} maxLength={30} value={d.brand.nameA} onChange={(e) => update((x) => { x.brand.nameA = e.target.value })} /></label>
          <label className="text-sm">{s.nameB}<input className={input} maxLength={30} value={d.brand.nameB} onChange={(e) => update((x) => { x.brand.nameB = e.target.value })} /></label>
        </div>
        <LTextField label={s.subtitle} value={d.brand.subtitle} onChange={(v) => update((x) => { x.brand.subtitle = v })} placeholder={Object.fromEntries(SETTINGS_LANGS.map((l) => [l, LANGS[l as keyof typeof LANGS].brand.simulation]))} />
        <LTextField label={s.beta} value={d.brand.beta} onChange={(v) => update((x) => { x.brand.beta = v })} placeholder={Object.fromEntries(SETTINGS_LANGS.map((l) => [l, LANGS[l as keyof typeof LANGS].brand.beta]))} />
        <Check label={s.showBeta} checked={d.brand.showBeta} onChange={(v) => update((x) => { x.brand.showBeta = v })} />
        <LTextField label={s.version} value={d.brand.version} onChange={(v) => update((x) => { x.brand.version = v })} placeholder={Object.fromEntries(SETTINGS_LANGS.map((l) => [l, LANGS[l as keyof typeof LANGS].sidebar.version]))} />
        <label className="block text-sm">{s.logoUrl}<input className={input} type="url" placeholder="https://" value={d.brand.logoUrl} onChange={(e) => update((x) => { x.brand.logoUrl = e.target.value })} /></label>
      </div>

      <div className={`${card} space-y-4`}>
        <h2 className="font-semibold">{s.designTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="text-sm">
            <label>{s.color}
              <span className="mt-1 flex items-center gap-2">
                <input type="color" aria-label={s.color} value={d.design.brandColor} onChange={(e) => update((x) => { x.design.brandColor = e.target.value })} className="h-9 w-12 rounded border border-slate-300 dark:border-slate-700" />
                <code className="text-xs">{d.design.brandColor}</code>
              </span>
            </label>
            {low && <p role="alert" className="mt-1 text-xs text-amber-600 dark:text-amber-300">{s.contrastWarn}</p>}
          </div>
          <label className="text-sm">{s.radius}
            <select className={input} value={d.design.radius} onChange={(e) => update((x) => { x.design.radius = e.target.value as Settings['design']['radius'] })}>
              {(Object.keys(s.radii) as (keyof typeof s.radii)[]).map((k) => <option key={k} value={k}>{s.radii[k]}</option>)}
            </select>
          </label>
          <label className="text-sm">{s.density}
            <select className={input} value={d.design.density} onChange={(e) => update((x) => { x.design.density = e.target.value as Settings['design']['density'] })}>
              {(Object.keys(s.densities) as (keyof typeof s.densities)[]).map((k) => <option key={k} value={k}>{s.densities[k]}</option>)}
            </select>
          </label>
          <label className="text-sm">{s.defaultTheme}
            <select className={input} value={d.design.defaultTheme} onChange={(e) => update((x) => { x.design.defaultTheme = e.target.value as Settings['design']['defaultTheme'] })}>
              {(Object.keys(s.themes) as (keyof typeof s.themes)[]).map((k) => <option key={k} value={k}>{s.themes[k]}</option>)}
            </select>
          </label>
          <label className="text-sm">{s.sidebarWidth}: {d.design.sidebarWidth}
            <input type="range" min={224} max={320} step={8} className="mt-2 w-full accent-indigo-500" value={d.design.sidebarWidth} onChange={(e) => update((x) => { x.design.sidebarWidth = Number(e.target.value) })} />
          </label>
          <label className="text-sm">{s.fontScale}: {d.design.fontScale}
            <input type="range" min={90} max={120} step={5} className="mt-2 w-full accent-indigo-500" value={d.design.fontScale} onChange={(e) => update((x) => { x.design.fontScale = Number(e.target.value) })} />
          </label>
          <label className="text-sm">{s.defaultLang}
            <select className={input} value={d.design.defaultLang} onChange={(e) => update((x) => { x.design.defaultLang = e.target.value })}>
              <option value="">{s.autoLang}</option>
              {d.design.enabledLangs.map((l) => <option key={l} value={l}>{LANGS[l as keyof typeof LANGS].langName}</option>)}
            </select>
          </label>
          <fieldset className="text-sm">
            <legend>{s.enabledLangs}</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {SETTINGS_LANGS.map((l) => (
                <Check key={l} label={LANGS[l as keyof typeof LANGS].langName} checked={d.design.enabledLangs.includes(l)}
                  onChange={(v) => update((x) => {
                    const next = v ? [...x.design.enabledLangs, l] : x.design.enabledLangs.filter((y) => y !== l)
                    if (next.length) x.design.enabledLangs = SETTINGS_LANGS.filter((y) => next.includes(y))
                  })} />
              ))}
            </div>
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-6">
          <Check label={s.showLang} checked={d.design.showLangSwitcher} onChange={(v) => update((x) => { x.design.showLangSwitcher = v })} />
          <Check label={s.showTheme} checked={d.design.showThemeToggle} onChange={(v) => update((x) => { x.design.showThemeToggle = v })} />
        </div>
        <p className="text-xs text-slate-500" lang={lang}>{s.hashHint}</p>
      </div>
    </div>
  )
}

function MenusTab({ d, update }: { d: Settings; update: Update }) {
  const { t } = useI18n()
  const s = t.admin.set
  return (
    <div className="space-y-6">
      <div className={card}>
        <h2 className="mb-1 font-semibold">{s.sidebar}</h2>
        <p className="mb-3 text-xs text-slate-500">{s.hashHint}</p>
        <EntryEditor entries={d.sidebar.items} settings={d} lockBuiltin max={32} onChange={(items) => update((x) => { x.sidebar.items = items })} />
      </div>

      <div className={`${card} space-y-4`}>
        <h2 className="font-semibold">{s.header}</h2>
        <div className="flex flex-wrap gap-6">
          <Check label={s.headerEnabled} checked={d.header.enabled} onChange={(v) => update((x) => { x.header.enabled = v })} />
          <Check label={s.headerSticky} checked={d.header.sticky} onChange={(v) => update((x) => { x.header.sticky = v })} />
        </div>
        <LTextField label={s.headerTitle} value={d.header.title} onChange={(v) => update((x) => { x.header.title = v })} />
        <div>
          <div className="mb-2 text-sm">{s.links}</div>
          <EntryEditor entries={d.header.links} settings={d} onChange={(links) => update((x) => { x.header.links = links })} />
        </div>
      </div>

      <div className={`${card} space-y-4`}>
        <h2 className="font-semibold">{s.footer}</h2>
        <Check label={s.footerEnabled} checked={d.footer.enabled} onChange={(v) => update((x) => { x.footer.enabled = v })} />
        <LTextField label={s.footerText} value={d.footer.text} onChange={(v) => update((x) => { x.footer.text = v })} />
        <LTextField label={s.copyright} value={d.footer.copyright} onChange={(v) => update((x) => { x.footer.copyright = v })} />
        <div className="space-y-3">
          <div className="text-sm">{s.columns}</div>
          {d.footer.columns.map((c, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <LTextField label={s.columnTitle} value={c.title} onChange={(v) => update((x) => { x.footer.columns[i].title = v })} />
              <EntryEditor entries={c.links} settings={d} max={12} onChange={(links) => update((x) => { x.footer.columns[i].links = links })} />
              <button type="button" className={`${small} text-red-500`} onClick={() => update((x) => { x.footer.columns.splice(i, 1) })}>✕ {s.entry.remove}</button>
            </div>
          ))}
          {d.footer.columns.length < 4 && (
            <button type="button" className={btn} onClick={() => update((x) => { x.footer.columns.push({ title: {}, links: [] }) })}>+ {s.addColumn}</button>
          )}
        </div>
        <div>
          <div className="mb-2 text-sm">{s.social}</div>
          <EntryEditor entries={d.footer.social} settings={d} max={8} onChange={(social) => update((x) => { x.footer.social = social })} />
        </div>
      </div>
    </div>
  )
}

function PagesTab({ d, update }: { d: Settings; update: Update }) {
  const { t } = useI18n()
  const s = t.admin.set
  const slugOk = (p: CustomPage, i: number) => SLUG_RE.test(p.slug) && !BUILTIN_PAGES.includes(p.slug) && d.pages.custom.findIndex((x) => x.slug === p.slug) === i
  return (
    <div className="space-y-6">
      <div className={card}>
        <h2 className="font-semibold">{s.pagesTitle}</h2>
        <p className="mb-3 mt-1 text-sm text-slate-500 dark:text-slate-400">{s.pagesText}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BUILTIN_PAGES.map((id) => (
            <Check key={id} label={t.nav[id as keyof typeof t.nav]} checked={id === 'admin' || !d.pages.disabled.includes(id)}
              onChange={(v) => update((x) => { if (id !== 'admin') x.pages.disabled = v ? x.pages.disabled.filter((y) => y !== id) : [...x.pages.disabled, id] })} />
          ))}
        </div>
      </div>

      <div className={`${card} space-y-4`}>
        <h2 className="font-semibold">{s.customTitle}</h2>
        <p className="text-xs text-slate-500">{s.mdHelp}</p>
        {d.pages.custom.map((p, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">{s.slug}
                <input aria-invalid={!slugOk(p, i)} className={`${input} ${slugOk(p, i) ? '' : 'border-red-500'}`} value={p.slug} maxLength={40}
                  onChange={(e) => update((x) => { x.pages.custom[i].slug = e.target.value.toLowerCase() })} />
              </label>
              <Check label={s.published} checked={p.published} onChange={(v) => update((x) => { x.pages.custom[i].published = v })} />
              <code className="text-xs text-slate-500">#/page:{p.slug}</code>
              <button type="button" className={`${small} ml-auto text-red-500`} onClick={() => update((x) => { x.pages.custom.splice(i, 1) })}>✕ {s.removePage}</button>
            </div>
            <LTextField label={s.pageTitle} value={p.title} onChange={(v) => update((x) => { x.pages.custom[i].title = v })} />
            <LTextField label={s.pageBody} rows={6} value={p.body} onChange={(v) => update((x) => { x.pages.custom[i].body = v })} />
          </div>
        ))}
        {d.pages.custom.length < 20 && (
          <button type="button" className={btn} onClick={() => update((x) => { x.pages.custom.push({ slug: `page-${x.pages.custom.length + 1}`, title: {}, body: {}, published: true }) })}>
            + {s.addPage}
          </button>
        )}
      </div>
    </div>
  )
}

const PAGE_SIZE = 40

function ContentTab({ d, update }: { d: Settings; update: Update }) {
  const { t } = useI18n()
  const s = t.admin.set
  const [lang, setLang] = useState<keyof typeof LANGS>('tr')
  const [section, setSection] = useState('nav')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const flat = useMemo(() => flattenStrings(LANGS[lang]), [lang])
  const sections = useMemo(() => [...new Set(Object.keys(flat).map((k) => k.split('.')[0]))], [flat])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return Object.entries(flat).filter(([k, v]) => (needle ? k.toLowerCase().includes(needle) || v.toLowerCase().includes(needle) : k.split('.')[0] === section))
  }, [flat, section, q])
  const over = d.content[lang] ?? {}
  const count = Object.keys(over).length
  const set = (path: string, v: string) => update((x) => {
    const m = { ...(x.content[lang] ?? {}) }
    if (v) m[path] = v
    else delete m[path]
    if (Object.keys(m).length) x.content[lang] = m
    else delete x.content[lang]
  })
  return (
    <div className={`${card} space-y-4`}>
      <h2 className="font-semibold">{s.contentTitle}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{s.contentText}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">{s.language}
          <select className={input} value={lang} onChange={(e) => { setLang(e.target.value as keyof typeof LANGS); setLimit(PAGE_SIZE) }}>
            {SETTINGS_LANGS.map((l) => <option key={l} value={l}>{LANGS[l as keyof typeof LANGS].langName}</option>)}
          </select>
        </label>
        <label className="text-sm">{s.section}
          <select className={input} value={section} disabled={Boolean(q.trim())} onChange={(e) => { setSection(e.target.value); setLimit(PAGE_SIZE) }}>
            {sections.map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className="text-sm">{s.search}
          <input className={input} value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE_SIZE) }} placeholder={s.search} />
        </label>
      </div>
      <p className="text-xs text-slate-500">{s.overridden.replace('{n}', String(count))}</p>
      <div className="space-y-3">
        {rows.slice(0, limit).map(([path, def]) => (
          <div key={path} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <code className="break-all text-[11px] text-slate-500">{path}</code>
              {over[path] !== undefined && <button type="button" className="text-xs text-brand underline" onClick={() => set(path, '')}>{s.resetText}</button>}
            </div>
            <textarea aria-label={path} rows={def.length > 120 ? 3 : 1} className={`${input} text-xs`} value={over[path] ?? ''} placeholder={def} onChange={(e) => set(path, e.target.value)} />
          </div>
        ))}
      </div>
      {rows.length > limit && <button type="button" className={btn} onClick={() => setLimit(limit + PAGE_SIZE)}>{s.showMore} ({rows.length - limit})</button>}
    </div>
  )
}

function ToggleList({ title, ids, label, hidden, onChange }: { title: string; ids: string[]; label: (id: string) => string; hidden: string[]; onChange: (h: string[]) => void }) {
  return (
    <fieldset className="text-sm">
      <legend className="font-medium">{title} <span className="text-xs font-normal text-slate-500">({hidden.length}/{ids.length})</span></legend>
      <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
        {ids.map((id) => (
          <Check key={id} label={label(id)} checked={hidden.includes(id)} onChange={(v) => onChange(v ? [...hidden, id] : hidden.filter((y) => y !== id))} />
        ))}
      </div>
    </fieldset>
  )
}

const FIELDS = ['y', 'e', 'urban', 'gdp', 'net', 'unemp', 'pop'] as const

function CountryTable() {
  const { t, lang } = useI18n()
  const s = t.admin.set
  const { data } = useCountryPool(true, true)
  const [edits, setEdits] = useState<Record<string, Partial<Record<(typeof FIELDS)[number], number>>>>({})
  const [perCountry, setPerCountry] = useState<number | null>(null)
  const [seed, setSeed] = useState(42)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!data) return null
  const per = perCountry ?? data.meta.perCountry
  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await api<{ countries: number; personas: number }>('/api/countries', {
        method: 'PUT',
        body: { edits: Object.entries(edits).map(([iso2, v]) => ({ iso2, ...v })), perCountry: per, seed },
      })
      reloadCountryPool()
      setEdits({})
      setMsg({ ok: true, text: s.ctDone.replace('{p}', String(r.personas)).replace('{c}', String(r.countries)) })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? s.ctFail : s.ctFail })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={`${card} space-y-3`}>
      <h2 className="font-semibold">{s.ctTitle}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{s.ctText}</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <label>{s.perCountry}<input type="number" min={4} max={60} className={`${input} w-28`} value={per} onChange={(e) => setPerCountry(Math.max(4, Math.min(60, Math.trunc(Number(e.target.value)) || 4)))} /></label>
        <label>{s.seed}<input type="number" min={0} className={`${input} w-28`} value={seed} onChange={(e) => setSeed(Math.max(0, Math.trunc(Number(e.target.value)) || 0))} /></label>
      </div>
      <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
            <tr><th className="p-2">ISO</th>{FIELDS.map((f) => <th key={f} className="p-2">{s.fields[f]}</th>)}</tr>
          </thead>
          <tbody>
            {data.countries.map((c) => (
              <tr key={c.iso2} className="border-t border-slate-200 dark:border-slate-800">
                <td className="whitespace-nowrap p-2 font-medium">{c.iso2} <span className="font-normal text-slate-500">{countryName(c.iso2, lang)}</span></td>
                {FIELDS.map((f) => (
                  <td key={f} className="p-1">
                    <input type="number" step="0.1" aria-label={`${c.iso2} ${s.fields[f]}`} className={`${small} w-20`} value={edits[c.iso2]?.[f] ?? c[f]}
                      onChange={(e) => setEdits((m) => ({ ...m, [c.iso2]: { ...m[c.iso2], [f]: Number(e.target.value) } }))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{s.ctSave}</button>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{msg.text}</p>}
    </div>
  )
}

function DataTab({ d, update }: { d: Settings; update: Update }) {
  const { t, lang } = useI18n()
  const s = t.admin.set
  const { data } = useCountryPool(true, true)
  return (
    <div className="space-y-6">
      <div className={`${card} space-y-5`}>
        <h2 className="font-semibold">{s.dataTitle}</h2>
        <ToggleList title={s.hiddenTasks} ids={TASKS.map((x) => x.id)} label={(id) => t.tasks[id]?.title ?? id} hidden={d.seed.hiddenTasks} onChange={(h) => update((x) => { x.seed.hiddenTasks = h })} />
        <ToggleList title={s.hiddenTemplates} ids={['website', 'appstore', 'product']} label={(id) => t.study.tpl[id as 'website']} hidden={d.seed.hiddenTemplates} onChange={(h) => update((x) => { x.seed.hiddenTemplates = h })} />
        <ToggleList title={s.hiddenExamples} ids={Object.keys(t.seed.examples)} label={(id) => id} hidden={d.seed.hiddenExamples} onChange={(h) => update((x) => { x.seed.hiddenExamples = h })} />
        {data && <ToggleList title={s.hiddenCountries} ids={data.countries.map((c) => c.iso2)} label={(id) => `${id} · ${countryName(id, lang)}`} hidden={d.seed.hiddenCountries} onChange={(h) => update((x) => { x.seed.hiddenCountries = h })} />}
        <label className="block text-sm">{s.extraModels}
          <textarea rows={3} className={`${input} font-mono text-xs`} value={d.seed.models.join('\n')} onChange={(e) => update((x) => { x.seed.models = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })} />
          <span className="text-xs text-slate-500">{s.modelsHint}</span>
        </label>
      </div>
      <CountryTable />
    </div>
  )
}

export type SettingsTab = 'brand' | 'menus' | 'pages' | 'content' | 'data'

export default function AdminSettings({ tab }: { tab: SettingsTab }) {
  const { t } = useI18n()
  const s = t.admin.set
  const { settings, reload } = useSiteSettings()
  const [draft, setDraft] = useState<Settings>(() => structuredClone(settings))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const update: Update = (fn) => setDraft((prev) => { const next = structuredClone(prev); fn(next); return next })

  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const stored = await api<Settings>('/api/settings', { method: 'PUT', body: draft })
      await reload()
      setDraft(stored)
      setMsg({ ok: true, text: s.saved })
    } catch {
      setMsg({ ok: false, text: s.saveFail })
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!window.confirm(s.confirmReset)) return
    setBusy(true)
    try {
      const stored = await api<Settings>('/api/settings/reset', { method: 'POST', body: {} })
      await reload()
      setDraft(stored)
      setMsg({ ok: true, text: s.saved })
    } catch {
      setMsg({ ok: false, text: s.saveFail })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {tab === 'brand' && <BrandTab d={draft} update={update} />}
      {tab === 'menus' && <MenusTab d={draft} update={update} />}
      {tab === 'pages' && <PagesTab d={draft} update={update} />}
      {tab === 'content' && <ContentTab d={draft} update={update} />}
      {tab === 'data' && <DataTab d={draft} update={update} />}
      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <button type="button" disabled={busy || !dirty} onClick={save} className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? s.saving : s.save}</button>
        {dirty && <span className="text-xs text-amber-600 dark:text-amber-300">{s.dirty}</span>}
        {msg && <span role="status" className={`text-sm ${msg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{msg.text}</span>}
        <button type="button" disabled={busy} onClick={reset} className="ml-auto text-xs text-red-500 underline">{s.reset}</button>
      </div>
    </div>
  )
}
