import { useEffect, useMemo, useState } from 'react'
import type { PageId } from '../config'
import { useI18n } from '../i18n'
import { useAuth } from '../auth'
import {
  countryName, useCountryPool, useCustomPersonas, usePersonas,
  type CountryPersona, type CountryRec, type Persona,
} from '../personas'
import MultiSelect, { type MsOption } from '../components/MultiSelect'
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
  desc?: string
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
  const valueOf = (k: string) => (k === 'region' ? t.personas.regions[p.region as keyof typeof t.personas.regions] ?? p.region : t.values[k]?.[p.d[k]] ?? p.d[k])
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
            <h2 className="text-lg font-bold">{p.pool === 'custom' ? p.name : p.country ? `${countryName(p.country, lang)} · ${p.id}` : p.name}</h2>
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
          if (p.pool !== 'dev' && g === 'style') return null
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

        {p.pool !== 'dev' && p.desc && (
          <div className="mt-5 text-sm">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.personas.descriptionLabel}</h3>
            <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">{p.desc}</p>
          </div>
        )}

        {p.pool !== 'dev' && country && (
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
  const { admin } = useAuth()
  const custom = useCustomPersonas(admin)
  const { ids, pool: selPool, toggle, addMany, clear } = useSelection()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string[]>>({})
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
    if (pool === 'custom') {
      return custom.map((p) => {
        const c = p.c ? countryByIso.get(p.c) : undefined
        return {
          id: p.id, name: p.n || p.id, pool: 'custom', source: 'teknodoz-import', region: p.d.region ?? c?.region ?? '', sub: c?.sub ?? '',
          country: p.c ?? undefined, internet: p.i === 1, lang: p.l, desc: p.x, d: p.d,
        } as UIPersona
      })
    }
    return (cp?.personas ?? []).map((p: CountryPersona) => {
      const c = countryByIso.get(p.c)
      return {
        id: p.id, name: p.id, pool: 'country', source: 'teknodoz-synthetic', region: c?.region ?? '', sub: c?.sub ?? '',
        country: p.c, internet: p.i === 1, lang: p.l, d: p.d,
      } as UIPersona
    })
  }, [pool, dev, cp, countryByIso, custom])

  const facets = pool === 'dev' ? FACETS_DEV : FACETS_COUNTRY
  const facetLabel = (l: Facet['label']) =>
    ({
      age: t.personas.filters.age, region: t.personas.filters.region, life: t.personas.filters.life, econ: t.personas.filters.econ,
      risk: t.personas.filters.risk, sub: t.personas.fSub, employment: t.personas.fEmployment, income: t.personas.fIncome,
    })[l]

  const vl = (facet: string, v: string) => t.values[facet]?.[v] ?? v
  const optionLabel = (key: string, v: string) =>
    key === 'region' ? (t.personas.regions[v as keyof typeof t.personas.regions] ?? v) : key === 'sub' ? (t.personas.sub[v as keyof typeof t.personas.sub] ?? v) : vl(key, v)

  const options = useMemo(() => {
    const out: Record<string, MsOption[]> = {}
    for (const f of facets) {
      const base = f.key === 'sub' && filters.region?.length ? all.filter((p) => filters.region.includes(p.region)) : all
      const values = [...new Set(base.map((p) => f.get(p)).filter((v): v is string => Boolean(v)))]
      out[f.key] = values.map((v) => ({ value: v, label: optionLabel(f.key, v) })).sort((a, b) => a.label.localeCompare(b.label, lang, { numeric: true }))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, facets, filters.region, lang, t])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.country ? countryName(p.country, lang).toLowerCase().includes(q) : false)) &&
        facets.every((f) => !filters[f.key]?.length || filters[f.key].includes(f.get(p) ?? '')) &&
        (pool === 'dev' || ((countries.length === 0 || countries.includes(p.country ?? '')) && (pool !== 'country' || !internetOnly || p.internet))),
    )
  }, [all, query, filters, facets, pool, countries, internetOnly, lang])

  const reset = () => {
    setShown(PAGE)
    setNotice('')
  }
  const hasFilters = query !== '' || Object.values(filters).some((v) => v.length > 0) || countries.length > 0

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
        {([['country', t.personas.pCountry.replace('{n}', String(nCountry || '…'))], ['dev', t.personas.pDev.replace('{n}', String(dev?.personas.length ?? '…'))], ...(admin ? [['custom', t.personas.pCustom.replace('{n}', String(custom.length))]] : [])] as [PersonaPool, string][]).map(([k, label]) => (
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
      <p className="mt-2 text-xs text-slate-500">{pool === 'dev' ? t.personas.poolDevNote : pool === 'custom' ? t.personas.customNote : t.personas.poolCountryNote}</p>
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
        {pool !== 'dev' && cp && (
          <MultiSelect
            label={t.personas.fCountry}
            allLabel={t.personas.all}
            countLabel={(n) => t.personas.countriesN.replace('{n}', String(n))}
            searchPlaceholder={t.personas.searchCountry}
            clearLabel={t.personas.clearCountries}
            groupAllLabel={t.personas.regionAll}
            value={countries}
            onChange={(v) => { setCountries(v); reset() }}
            options={cp.countries
              .map((c) => ({ value: c.iso2, label: countryName(c.iso2, lang), group: t.personas.regions[c.region as keyof typeof t.personas.regions] ?? c.region, hint: c.iso2 }))
              .sort((a, b) => a.group.localeCompare(b.group, lang) || a.label.localeCompare(b.label, lang))}
          />
        )}
        {facets.map((f) => (
          <MultiSelect
            key={f.key}
            label={facetLabel(f.label)}
            allLabel={t.personas.all}
            countLabel={(n) => t.personas.selectedCount.replace('{n}', String(n))}
            clearLabel={t.personas.clearFilter}
            value={filters[f.key] ?? []}
            onChange={(v) => {
              setFilters((cur) => ({ ...cur, [f.key]: v, ...(f.key === 'region' ? { sub: [] } : {}) }))
              reset()
            }}
            options={options[f.key] ?? []}
          />
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
          {pool !== 'dev' && (
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
                    <div className="truncate text-sm font-semibold">{p.pool === 'custom' ? p.name : p.country ? countryName(p.country, lang) : p.name}</div>
                    <div className="text-xs text-slate-500">#{p.id}{p.pool === 'dev' ? ` · ${p.source}` : p.pool === 'custom' && p.country ? ` · ${countryName(p.country, lang)}` : ''}</div>
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
                  {[vl('age_bracket', p.d.age_bracket ?? ''), p.pool === 'dev' ? (t.personas.regions[p.region as keyof typeof t.personas.regions] ?? p.region) : vl('economic_motivation', p.d.economic_motivation ?? ''), vl('life_stage', p.d.life_stage ?? '')].filter(Boolean).map((v) => (
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
