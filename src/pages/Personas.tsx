import { useEffect, useMemo, useState } from 'react'
import type { PageId } from '../config'
import { useI18n } from '../i18n'
import {
  countryName, useCountryPool, usePersonas,
  type CountryPersona, type CountryRec, type Persona,
} from '../personas'
import { MAX_SELECTION, useSelection, type PersonaPool } from '../selection'

const PAGE = 24
const WEIGHT: Record<string, number> = { Important: 3, Moderate: 2, Minor: 1 }
const field =
  'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950'
const btn = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700'

type UIPersona = {
  id: string
  name: string
  pool: PersonaPool
  source: string
  region: string
  sub: string
  country?: string
  internet?: boolean
  lang?: string | null
  d: Record<string, string>
}

type Facet = { key: string; label: 'age' | 'region' | 'sub' | 'life' | 'econ' | 'risk' | 'employment' | 'income'; get: (p: UIPersona) => string | undefined }
const FACETS_DEV: Facet[] = [
  { key: 'age_bracket', label: 'age', get: (p) => p.d.age_bracket },
  { key: 'region', label: 'region', get: (p) => p.region },
  { key: 'life_stage', label: 'life', get: (p) => p.d.life_stage },
  { key: 'economic_motivation', label: 'econ', get: (p) => p.d.economic_motivation },
  { key: 'risk_tolerance', label: 'risk', get: (p) => p.d.risk_tolerance },
]
const FACETS_COUNTRY: Facet[] = [
  { key: 'age_bracket', label: 'age', get: (p) => p.d.age_bracket },
  { key: 'region', label: 'region', get: (p) => p.region },
  { key: 'sub', label: 'sub', get: (p) => p.sub },
  { key: 'life_stage', label: 'life', get: (p) => p.d.life_stage },
  { key: 'economic_motivation', label: 'econ', get: (p) => p.d.economic_motivation },
  { key: 'risk_tolerance', label: 'risk', get: (p) => p.d.risk_tolerance },
  { key: 'demo_employment_status', label: 'employment', get: (p) => p.d.demo_employment_status },
  { key: 'socioeconomic_band', label: 'income', get: (p) => p.d.socioeconomic_band },
]

const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7)
const initials = (name: string) => name.split(/[\s-]/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

function Avatar({ p }: { p: UIPersona }) {
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ background: `hsl(${hue(p.name + p.id)} 55% 45%)` }}
    >
      {p.country ?? initials(p.name)}
    </span>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function CountryPicker({ countries, value, onChange }: { countries: CountryRec[]; value: string[]; onChange: (v: string[]) => void }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const named = useMemo(
    () => countries.map((c) => ({ ...c, label: countryName(c.iso2, lang) })).sort((a, b) => a.label.localeCompare(b.label, lang)),
    [countries, lang],
  )
  const regions = useMemo(() => [...new Set(countries.map((c) => c.region))], [countries])
  const toggle = (iso: string) => onChange(value.includes(iso) ? value.filter((x) => x !== iso) : [...value, iso])
  const toggleRegion = (region: string) => {
    const inRegion = countries.filter((c) => c.region === region).map((c) => c.iso2)
    const all = inRegion.every((i) => value.includes(i))
    onChange(all ? value.filter((v) => !inRegion.includes(v)) : [...new Set([...value, ...inRegion])])
  }
  const ql = q.trim().toLowerCase()

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${field} min-w-40 text-left`}>
        {t.personas.fCountry}: {value.length ? t.personas.countriesN.replace('{n}', String(value.length)) : t.personas.all}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <input
              type="search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.personas.searchCountry}
              aria-label={t.personas.searchCountry}
              className={`${field} mb-2 w-full`}
            />
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="mb-2 text-xs text-brand underline">
                {t.personas.clearCountries}
              </button>
            )}
            {regions.map((region) => {
              const rows = named.filter((c) => c.region === region && (!ql || c.label.toLowerCase().includes(ql) || c.iso2.toLowerCase() === ql))
              if (!rows.length) return null
              return (
                <div key={region} className="mb-2">
                  <button type="button" onClick={() => toggleRegion(region)} className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-brand">
                    {t.personas.regions[region as keyof typeof t.personas.regions] ?? region} · {t.personas.regionAll}
                  </button>
                  {rows.map((c) => (
                    <label key={c.iso2} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
                      <input type="checkbox" checked={value.includes(c.iso2)} onChange={() => toggle(c.iso2)} className="accent-indigo-500" />
                      <span className="flex-1">{c.label}</span>
                      <span className="text-xs text-slate-500">{c.iso2}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Detail({ p, onClose, countries, meta }: { p: UIPersona; onClose: () => void; countries: CountryRec[]; meta: { source: string; asOf: string } | null }) {
  const { t, lang } = useI18n()
  const devData = usePersonas()
  const { ids, toggle } = useSelection()
  const chosen = ids.includes(p.id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const label = (k: string) => t.personas.dims[k as keyof typeof t.personas.dims] ?? k
  const country = countries.find((c) => c.iso2 === p.country)
  const groups: ('profile' | 'decision' | 'style')[] = ['profile', 'decision', 'style']
  const keysFor = (g: 'profile' | 'decision' | 'style') => {
    if (p.pool === 'dev') return (devData?.groups[g] ?? []).filter((k) => p.d[k])
    if (g === 'profile') return ['age_bracket', 'gender_identity', 'region', 'life_stage', 'demo_employment_status', 'urbanicity', 'socioeconomic_band'].filter((k) => k === 'region' || p.d[k])
    if (g === 'decision') return ['economic_motivation', 'risk_tolerance'].filter((k) => p.d[k])
    return []
  }
  const valueOf = (k: string) => (k === 'region' ? t.personas.regions[p.region as keyof typeof t.personas.regions] ?? p.region : p.d[k])
  const values = p.pool === 'dev' ? (devData?.valueKeys ?? []).filter((k) => p.d[k]) : []

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p.name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <Avatar p={p} />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{p.country ? `${countryName(p.country, lang)} · ${p.id}` : p.name}</h2>
            <p className="text-xs text-slate-500">
              #{p.id} · {t.personas.source}: {p.source}
              {p.pool === 'country' && <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">{t.personas.syntheticBadge}</span>}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700">
            {t.personas.close}
          </button>
        </div>

        {groups.map((g) => {
          const keys = keysFor(g)
          if (p.pool === 'country' && g === 'style') return null
          return (
            <div key={g} className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.personas.groups[g]}</h3>
              {keys.length === 0 ? (
                <p className="text-sm text-slate-500">{t.personas.noData}</p>
              ) : (
                <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                  {keys.map((k) => (
                    <div key={k} className="flex justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
                      <dt className="text-slate-500">{label(k)}</dt>
                      <dd className="text-right font-medium">{valueOf(k)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )
        })}

        {p.pool === 'country' && country && (
          <div className="mt-5 text-sm">
            <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              <div className="flex justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
                <dt className="text-slate-500">{t.personas.country}</dt>
                <dd className="font-medium">{countryName(country.iso2, lang)} ({country.cur})</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
                <dt className="text-slate-500">{t.personas.sub_label}</dt>
                <dd className="font-medium">{t.personas.sub[country.sub as keyof typeof t.personas.sub] ?? country.sub}</dd>
              </div>
              {p.lang && (
                <div className="flex justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
                  <dt className="text-slate-500">{t.personas.language}</dt>
                  <dd className="font-medium">{p.lang}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
                <dt className="text-slate-500">Internet</dt>
                <dd className="font-medium">{p.internet ? t.personas.internetYes : t.personas.internetNo}</dd>
              </div>
            </dl>
            {meta && (
              <p className="mt-3 text-[11px] text-slate-500">
                {t.personas.dataSource}: {meta.source === 'world-bank' ? t.personas.dataWorldBank : t.personas.dataBaseline} · {t.personas.dataAsOf}: {meta.asOf}
              </p>
            )}
          </div>
        )}

        {values.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.personas.valuesTitle}</h3>
            <ul className="space-y-1.5">
              {values.map((k) => {
                const w = WEIGHT[p.d[k]] ?? 2
                return (
                  <li key={k} className="grid grid-cols-[9rem_1fr_5rem] items-center gap-2 text-xs">
                    <span className="truncate text-slate-500">{label(k)}</span>
                    <span className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${(w / 3) * 100}%` }} />
                    </span>
                    <span className="text-right">{t.personas.imp[p.d[k] as keyof typeof t.personas.imp] ?? p.d[k]}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={() => toggle(p.id, p.pool)}
          className={`mt-6 w-full rounded-lg px-4 py-2 text-sm font-medium ${chosen ? 'border border-brand text-brand' : 'bg-brand text-white'}`}
        >
          {chosen ? '✓ ' : ''}{t.personas.select}
        </button>
        <p className="mt-3 text-[11px] text-slate-500">{t.personas.note}</p>
      </div>
    </div>
  )
}

export default function Personas({ go }: { go: (p: PageId) => void }) {
  const { t, lang } = useI18n()
  const [pool, setPool] = useState<PersonaPool>('country')
  const dev = usePersonas()
  const { data: cp, error: cpError } = useCountryPool()
  const { ids, pool: selPool, toggle, addMany, clear } = useSelection()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [countries, setCountries] = useState<string[]>([])
  const [internetOnly, setInternetOnly] = useState(true)
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<UIPersona | null>(null)
  const [bulkN, setBulkN] = useState(10)
  const [notice, setNotice] = useState('')

  const countryByIso = useMemo(() => new Map((cp?.countries ?? []).map((c) => [c.iso2, c])), [cp])

  const all: UIPersona[] = useMemo(() => {
    if (pool === 'dev') {
      return (dev?.personas ?? []).map((p: Persona) => ({ id: p.id, name: p.name, pool: 'dev', source: p.source, region: p.d.region ?? '', sub: '', d: p.d }))
    }
    return (cp?.personas ?? []).map((p: CountryPersona) => {
      const c = countryByIso.get(p.c)
      return {
        id: p.id, name: p.id, pool: 'country', source: 'teknodoz-synthetic', region: c?.region ?? '', sub: c?.sub ?? '',
        country: p.c, internet: p.i === 1, lang: p.l, d: p.d,
      } as UIPersona
    })
  }, [pool, dev, cp, countryByIso])

  const facets = pool === 'dev' ? FACETS_DEV : FACETS_COUNTRY
  const facetLabel = (l: Facet['label']) =>
    ({
      age: t.personas.filters.age, region: t.personas.filters.region, life: t.personas.filters.life, econ: t.personas.filters.econ,
      risk: t.personas.filters.risk, sub: t.personas.fSub, employment: t.personas.fEmployment, income: t.personas.fIncome,
    })[l]

  const options = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const f of facets) out[f.key] = [...new Set(all.map((p) => f.get(p)).filter((v): v is string => Boolean(v)))].sort()
    if (pool === 'country' && filters.region) {
      out.sub = [...new Set(all.filter((p) => p.region === filters.region).map((p) => p.sub))].sort()
    }
    return out
  }, [all, facets, pool, filters.region])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.country ? countryName(p.country, lang).toLowerCase().includes(q) : false)) &&
        facets.every((f) => !filters[f.key] || f.get(p) === filters[f.key]) &&
        (pool !== 'country' || ((countries.length === 0 || countries.includes(p.country ?? '')) && (!internetOnly || p.internet))),
    )
  }, [all, query, filters, facets, pool, countries, internetOnly, lang])

  const reset = () => {
    setShown(PAGE)
    setNotice('')
  }
  const hasFilters = query !== '' || Object.values(filters).some(Boolean) || countries.length > 0

  const applyBulk = (picked: UIPersona[]) => {
    if (!picked.length) return setNotice(t.personas.bulkNone)
    const r = addMany(picked.map((p) => p.id), pool)
    setNotice([r.switched ? t.personas.poolSwitch : '', t.personas.bulkAdded.replace('{n}', String(r.added)), r.capped ? t.personas.bulkCap : ''].filter(Boolean).join(' '))
  }
  const bulkAll = () => applyBulk(list.slice(0, MAX_SELECTION))
  const bulkRandom = () => applyBulk(shuffle(list).slice(0, Math.min(bulkN, MAX_SELECTION)))
  const bulkPerCountry = () => {
    const groups = new Map<string, UIPersona[]>()
    for (const p of list) groups.set(p.country ?? '', [...(groups.get(p.country ?? '') ?? []), p])
    applyBulk([...groups.values()].flatMap((g) => shuffle(g).slice(0, bulkN)).slice(0, MAX_SELECTION * 10))
  }

  const onToggle = (id: string) => {
    if (toggle(id, pool)) setNotice(t.personas.poolSwitch)
    else setNotice('')
  }
  const nCountry = cp?.personas.length ?? 0
  const loadingCountry = pool === 'country' && !cp && !cpError

  return (
    <section className="max-w-5xl pb-24">
      <h1 className="text-2xl font-bold">{t.personas.title}</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">
        {t.personas.intro.replace('{n}', String(dev?.personas.length ?? '…'))}
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist">
        {([['country', t.personas.pCountry.replace('{n}', String(nCountry || '…'))], ['dev', t.personas.pDev.replace('{n}', String(dev?.personas.length ?? '…'))]] as [PersonaPool, string][]).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={pool === k}
            onClick={() => { setPool(k); setFilters({}); setCountries([]); reset() }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${pool === k ? 'bg-brand text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{pool === 'dev' ? t.personas.poolDevNote : t.personas.poolCountryNote}</p>
      {pool === 'country' && cp && (
        <p className="mt-1 text-xs text-slate-500">
          {t.personas.dataTitle}: {cp.meta.source === 'world-bank' ? t.personas.dataWorldBank : t.personas.dataBaseline} · {t.personas.dataAsOf}: {cp.meta.asOf}
        </p>
      )}
      {pool === 'country' && cpError && <p role="alert" className="mt-3 text-sm text-red-500">{t.sim.errors.server_error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); reset() }}
          placeholder={t.personas.search}
          aria-label={t.personas.search}
          className={`${field} w-44`}
        />
        {pool === 'country' && cp && (
          <CountryPicker countries={cp.countries} value={countries} onChange={(v) => { setCountries(v); reset() }} />
        )}
        {facets.map((f) => (
          <select
            key={f.key}
            aria-label={facetLabel(f.label)}
            value={filters[f.key] ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setFilters((cur) => ({ ...cur, [f.key]: v, ...(f.key === 'region' ? { sub: '' } : {}) }))
              reset()
            }}
            className={field}
          >
            <option value="">
              {facetLabel(f.label)}: {t.personas.all}
            </option>
            {(options[f.key] ?? []).map((o) => (
              <option key={o} value={o}>
                {f.key === 'region' ? t.personas.regions[o as keyof typeof t.personas.regions] ?? o : f.key === 'sub' ? t.personas.sub[o as keyof typeof t.personas.sub] ?? o : o}
              </option>
            ))}
          </select>
        ))}
        {pool === 'country' && (
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={internetOnly} onChange={(e) => { setInternetOnly(e.target.checked); reset() }} className="accent-indigo-500" />
            {t.personas.internetOnly}
          </label>
        )}
        {hasFilters && (
          <button type="button" className="text-sm text-brand underline" onClick={() => { setQuery(''); setFilters({}); setCountries([]); reset() }}>
            {t.personas.clear}
          </button>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.personas.bulkTitle}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={bulkAll} disabled={!list.length} className={`${btn} disabled:opacity-50`}>
            {t.personas.bulkAll.replace('{n}', String(Math.min(list.length, MAX_SELECTION)) + (list.length > MAX_SELECTION ? '+' : ''))}
          </button>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">{t.personas.bulkCount}</span>
            <input
              type="number"
              min={1}
              max={MAX_SELECTION}
              value={bulkN}
              onChange={(e) => setBulkN(Math.max(1, Math.min(MAX_SELECTION, Math.trunc(Number(e.target.value)) || 1)))}
              className={`${field} w-20`}
            />
          </label>
          <button type="button" onClick={bulkRandom} disabled={!list.length} className={`${btn} disabled:opacity-50`}>
            {t.personas.bulkRandom}
          </button>
          {pool === 'country' && (
            <button type="button" onClick={bulkPerCountry} disabled={!list.length} className={`${btn} disabled:opacity-50`}>
              {t.personas.bulkPerCountry}
            </button>
          )}
        </div>
        {notice && <p role="status" className="mt-2 text-xs text-slate-500">{notice}</p>}
      </div>

      <p className="mt-3 text-xs text-slate-500">{t.personas.results.replace('{n}', String(list.length))}</p>

      {loadingCountry ? (
        <p className="mt-6 text-sm text-slate-500">…</p>
      ) : list.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.personas.noResults}</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.slice(0, shown).map((p) => {
            const chosen = ids.includes(p.id) && selPool === p.pool
            return (
              <li key={p.id} className={`rounded-xl border bg-white p-3 dark:bg-slate-900 ${chosen ? 'border-brand' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center gap-3">
                  <Avatar p={p} />
                  <button type="button" onClick={() => setOpen(p)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold">{p.country ? countryName(p.country, lang) : p.name}</div>
                    <div className="text-xs text-slate-500">#{p.id}{p.pool === 'dev' ? ` · ${p.source}` : ''}</div>
                  </button>
                  <input
                    type="checkbox"
                    checked={chosen}
                    onChange={() => onToggle(p.id)}
                    aria-label={`${t.personas.select}: ${p.name}`}
                    className="h-4 w-4 accent-indigo-500"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {[p.d.age_bracket, p.pool === 'dev' ? (t.personas.regions[p.region as keyof typeof t.personas.regions] ?? p.region) : p.d.economic_motivation, p.d.life_stage].filter(Boolean).map((v) => (
                    <span key={v} className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{v}</span>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {shown < list.length && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className={`mt-4 ${btn}`}>
          {t.personas.more}
        </button>
      )}

      {ids.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 text-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:left-64">
          <span className="font-medium">{t.personas.selectedN.replace('{n}', String(ids.length))}</span>
          <button type="button" onClick={clear} className="text-slate-500 underline">{t.personas.clearSel}</button>
          <button type="button" onClick={() => go('runs')} className="rounded-lg bg-brand px-4 py-1.5 font-medium text-white">
            {t.personas.useInSim} →
          </button>
        </div>
      )}

      {open && <Detail p={open} onClose={() => setOpen(null)} countries={cp?.countries ?? []} meta={cp ? { source: cp.meta.source, asOf: cp.meta.asOf } : null} />}
    </section>
  )
}
