import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generatePool } from './personagen.mjs'
import { ROOT } from './paths.mjs'

const DATA_DIR = join(ROOT, 'data')
const LIVE_COUNTRIES = join(DATA_DIR, 'countries.live.json')
const LIVE_POOL = join(DATA_DIR, 'personas-country.live.json')
const BASE_COUNTRIES = join(ROOT, 'shared', 'countries.json')
const BASE_POOL = join(ROOT, 'shared', 'personas-country.json')
const PER_COUNTRY = 24
const SEED = 42

// World Bank WDI (CC BY 4.0). Fixed host and indicators only; no user-controlled URLs.
const WB_BASE = 'https://api.worldbank.org/v2'
export const WB_INDICATORS = {
  y: 'SP.POP.0014.TO.ZS',
  e: 'SP.POP.65UP.TO.ZS',
  urban: 'SP.URB.TOTL.IN.ZS',
  gdp: 'NY.GDP.PCAP.PP.CD',
  net: 'IT.NET.USER.ZS',
  unemp: 'SL.UEM.TOTL.ZS',
  pop: 'SP.POP.TOTL',
}

let cache = { key: '', value: null }

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function stamp() {
  const f = (p) => (existsSync(p) ? statSync(p).mtimeMs : 0)
  return `${f(LIVE_COUNTRIES)}:${f(LIVE_POOL)}`
}

/** Returns { meta, countries, personas }, preferring live (refreshed) data over the committed baseline. */
export function loadCountryPool() {
  const key = stamp()
  if (cache.key === key && cache.value) return cache.value
  const live = existsSync(LIVE_COUNTRIES) && existsSync(LIVE_POOL)
  const c = readJson(live ? LIVE_COUNTRIES : BASE_COUNTRIES)
  const p = readJson(live ? LIVE_POOL : BASE_POOL)
  const value = {
    meta: { source: c.source, asOf: c.asOf, fetchedAt: c.fetchedAt ?? null, note: c._note ?? '', indicators: c.indicators ?? null, perCountry: p.meta?.perCountry ?? PER_COUNTRY },
    countries: c.countries,
    personas: p.personas,
  }
  cache = { key, value }
  return value
}

export function buildPoolFile(countries, meta) {
  return { meta: { generator: 'teknodoz-country-sampler', perCountry: PER_COUNTRY, seed: SEED, ...meta }, personas: generatePool(countries, PER_COUNTRY, SEED) }
}

/** Parse a World Bank v2 JSON response ([meta, records]) into iso3 -> { value, date }. */
export function parseWbResponse(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) throw new Error('unexpected World Bank response')
  const out = new Map()
  for (const r of payload[1]) {
    const iso3 = r?.countryiso3code
    if (!iso3 || r.value === null || r.value === undefined) continue
    const value = Number(r.value)
    if (!Number.isFinite(value)) continue
    out.set(iso3, { value, date: String(r.date) })
  }
  return out
}

async function fetchIndicator(id, iso3List, fetchImpl) {
  const url = `${WB_BASE}/country/${iso3List.join(';')}/indicator/${id}?format=json&mrnev=1&per_page=300`
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(25_000), headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (text.length > 2_000_000) throw new Error('response too large')
  return parseWbResponse(JSON.parse(text))
}

export async function refreshFromWorldBank({ fetchImpl = fetch } = {}) {
  const base = readJson(BASE_COUNTRIES)
  const iso3List = base.countries.map((c) => c.iso3)
  const results = {}
  const status = {}
  await Promise.all(
    Object.entries(WB_INDICATORS).map(async ([field, id]) => {
      try {
        results[field] = await fetchIndicator(id, iso3List, fetchImpl)
        status[field] = { id, ok: true, countries: results[field].size }
      } catch (e) {
        status[field] = { id, ok: false, error: String(e.message ?? e) }
      }
    }),
  )
  const okFields = Object.keys(results)
  if (okFields.length === 0) throw new Error('World Bank unreachable: ' + JSON.stringify(status))

  let years = []
  const fallbacks = []
  const countries = base.countries.map((c) => {
    const next = { ...c }
    for (const field of okFields) {
      const hit = results[field].get(c.iso3)
      if (hit) {
        next[field] = field === 'pop' ? Math.round((hit.value / 1e6) * 10) / 10 : Math.round(hit.value * 10) / 10
        years.push(Number(hit.date))
      } else {
        fallbacks.push(`${c.iso2}.${field}`)
      }
    }
    return next
  })
  years = years.filter(Number.isFinite)
  const asOf = years.length ? `${Math.min(...years)}-${Math.max(...years)} (most recent per indicator)` : 'unknown'
  const meta = { source: 'world-bank', asOf, fetchedAt: new Date().toISOString() }
  const countriesFile = { _note: 'World Bank WDI (CC BY 4.0). Fields not available fall back to the approximate baseline.', ...meta, indicators: status, countries }
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(LIVE_COUNTRIES, JSON.stringify(countriesFile))
  writeFileSync(LIVE_POOL, JSON.stringify(buildPoolFile(countries, meta)))
  cache = { key: '', value: null }
  return { asOf, fetchedAt: meta.fetchedAt, indicators: status, fallbackCount: fallbacks.length, fallbacks: fallbacks.slice(0, 30) }
}

const EDIT_RANGES = { y: [0, 100], e: [0, 100], urban: [0, 100], net: [0, 100], unemp: [0, 100], gdp: [0, 300000], pop: [0, 2000] }
export const EDIT_FIELDS = Object.keys(EDIT_RANGES)

/**
 * Admin edits of the country table. `edits` is [{ iso2, y?, e?, ... }]; unknown countries/fields and out-of-range values
 * are rejected. The synthetic pool is regenerated from the edited table with `perCountry` personas and `seed`.
 */
export function saveCountryEdits(edits, { perCountry = PER_COUNTRY, seed = SEED } = {}) {
  if (!Array.isArray(edits) || edits.length > 400) throw new Error('invalid_edits')
  if (!Number.isInteger(perCountry) || perCountry < 4 || perCountry > 60) throw new Error('invalid_per_country')
  if (!Number.isInteger(seed) || seed < 0 || seed > 2 ** 31) throw new Error('invalid_seed')
  const live = existsSync(LIVE_COUNTRIES)
  const file = readJson(live ? LIVE_COUNTRIES : BASE_COUNTRIES)
  const byIso = new Map(file.countries.map((c) => [c.iso2, c]))
  const next = new Map()
  for (const e of edits) {
    const c = byIso.get(e?.iso2)
    if (!c) throw new Error('unknown_country')
    const copy = { ...(next.get(c.iso2) ?? c) }
    for (const f of EDIT_FIELDS) {
      if (e[f] === undefined) continue
      const v = Number(e[f])
      const [lo, hi] = EDIT_RANGES[f]
      if (!Number.isFinite(v) || v < lo || v > hi) throw new Error('out_of_range')
      copy[f] = Math.round(v * 10) / 10
    }
    if (copy.y + copy.e > 100) throw new Error('out_of_range')
    next.set(c.iso2, copy)
  }
  const countries = file.countries.map((c) => next.get(c.iso2) ?? c)
  const meta = { source: file.source, asOf: file.asOf, fetchedAt: file.fetchedAt ?? null, edited: new Date().toISOString() }
  const out = { ...file, ...meta, countries }
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(LIVE_COUNTRIES, JSON.stringify(out))
  writeFileSync(LIVE_POOL, JSON.stringify({ meta: { generator: 'teknodoz-country-sampler', perCountry, seed, ...meta }, personas: generatePool(countries, perCountry, seed) }))
  cache = { key: '', value: null }
  return { countries: countries.length, personas: countries.length * perCountry, perCountry, seed }
}
