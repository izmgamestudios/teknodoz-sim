import { useEffect, useMemo, useState } from 'react'
import type { PageId } from '../config'
import { useI18n } from '../i18n'
import { usePersonas, type Persona } from '../personas'
import { useSelection } from '../selection'

const PAGE = 24
const FACETS = [
  ['age_bracket', 'age'],
  ['region', 'region'],
  ['life_stage', 'life'],
  ['economic_motivation', 'econ'],
  ['risk_tolerance', 'risk'],
] as const
type FacetKey = (typeof FACETS)[number][0]

const select =
  'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950'
const WEIGHT: Record<string, number> = { Important: 3, Moderate: 2, Minor: 1 }

const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7)
const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

function Avatar({ p }: { p: Persona }) {
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ background: `hsl(${hue(p.name + p.id)} 55% 45%)` }}
    >
      {initials(p.name)}
    </span>
  )
}

function Detail({ p, onClose }: { p: Persona; onClose: () => void }) {
  const { t } = useI18n()
  const data = usePersonas()!
  const { ids, toggle } = useSelection()
  const chosen = ids.includes(p.id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const label = (k: string) => t.personas.dims[k as keyof typeof t.personas.dims] ?? k
  const groupKeys = (g: 'profile' | 'decision' | 'style') => data.groups[g].filter((k) => p.d[k])
  const values = data.valueKeys.filter((k) => p.d[k])

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
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="text-xs text-slate-500">#{p.id} · {t.personas.source}: {p.source}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700">
            {t.personas.close}
          </button>
        </div>

        {(['profile', 'decision', 'style'] as const).map((g) => {
          const keys = groupKeys(g)
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
                      <dd className="text-right font-medium">{p.d[k]}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )
        })}

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
          onClick={() => toggle(p.id)}
          className={`mt-6 w-full rounded-lg px-4 py-2 text-sm font-medium ${
            chosen ? 'border border-brand text-brand' : 'bg-brand text-white'
          }`}
        >
          {chosen ? '✓ ' : ''}{t.personas.select}
        </button>
        <p className="mt-3 text-[11px] text-slate-500">{t.personas.note}</p>
      </div>
    </div>
  )
}

export default function Personas({ go }: { go: (p: PageId) => void }) {
  const { t } = useI18n()
  const data = usePersonas()
  const { ids, toggle, clear } = useSelection()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Partial<Record<FacetKey, string>>>({})
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<Persona | null>(null)

  const options = useMemo(() => {
    const out = {} as Record<FacetKey, string[]>
    for (const [key] of FACETS) {
      out[key] = [...new Set((data?.personas ?? []).map((p) => p.d[key]).filter(Boolean))].sort()
    }
    return out
  }, [data])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.personas ?? []).filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.id.includes(q)) &&
        FACETS.every(([k]) => !filters[k] || p.d[k] === filters[k]),
    )
  }, [data, query, filters])

  const hasFilters = query !== '' || Object.values(filters).some(Boolean)

  return (
    <section className="max-w-5xl pb-20">
      <h1 className="text-2xl font-bold">{t.personas.title}</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">
        {t.personas.intro.replace('{n}', String(data?.personas.length ?? '…'))}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }}
          placeholder={t.personas.search}
          aria-label={t.personas.search}
          className={`${select} w-48`}
        />
        {FACETS.map(([key, name]) => (
          <select
            key={key}
            aria-label={t.personas.filters[name]}
            value={filters[key] ?? ''}
            onChange={(e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setShown(PAGE) }}
            className={select}
          >
            <option value="">{t.personas.filters[name]}: {t.personas.all}</option>
            {options[key].map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
        {hasFilters && (
          <button type="button" className="text-sm text-brand underline" onClick={() => { setQuery(''); setFilters({}); setShown(PAGE) }}>
            {t.personas.clear}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">{t.personas.results.replace('{n}', String(list.length))}</p>

      {data && list.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.personas.noResults}</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.slice(0, shown).map((p) => {
            const chosen = ids.includes(p.id)
            return (
              <li
                key={p.id}
                className={`rounded-xl border bg-white p-3 dark:bg-slate-900 ${
                  chosen ? 'border-brand' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar p={p} />
                  <button type="button" onClick={() => setOpen(p)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500">#{p.id} · {p.source}</div>
                  </button>
                  <input
                    type="checkbox"
                    checked={chosen}
                    onChange={() => toggle(p.id)}
                    aria-label={`${t.personas.select}: ${p.name}`}
                    className="h-4 w-4 accent-indigo-500"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {[p.d.age_bracket, p.d.region, p.d.life_stage].filter(Boolean).map((v) => (
                    <span key={v} className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{v}</span>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {shown < list.length && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">
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

      {open && <Detail p={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
