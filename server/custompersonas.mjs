// Custom (imported) personas: CSV -> validated MatrAIx-compatible persona records.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCsv } from '../src/importers.ts'
import { loadCountryPool } from './countries.mjs'
import { LANGS, loadDict } from './i18n.mjs'
import { ROOT } from './paths.mjs'

const FILE = join(ROOT, 'data', 'custom-personas.json')
const ENUMS = JSON.parse(readFileSync(join(ROOT, 'shared', 'persona-enums.json'), 'utf8'))
export const MAX_CUSTOM = 500
export const MAX_CSV_BYTES = 250_000
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

const DIM_FIELDS = ['age_bracket', 'gender_identity', 'region', 'life_stage', 'economic_motivation', 'risk_tolerance', 'demo_employment_status', 'socioeconomic_band', 'urbanicity']

const ALIASES = {
  id: ['id', 'persona_id'],
  name: ['name', 'display_name'],
  country: ['country', 'country_code', 'iso2'],
  age_bracket: ['age_bracket', 'age'],
  gender_identity: ['gender_identity', 'gender'],
  region: ['region'],
  life_stage: ['life_stage', 'lifestage'],
  economic_motivation: ['economic_motivation', 'spending', 'economic'],
  risk_tolerance: ['risk_tolerance', 'risk'],
  demo_employment_status: ['demo_employment_status', 'employment', 'employment_status'],
  socioeconomic_band: ['socioeconomic_band', 'income', 'income_level', 'income_band'],
  urbanicity: ['urbanicity', 'setting'],
  language: ['language', 'native_language'],
  description: ['description', 'notes', 'about'],
  internet: ['internet', 'internet_user'],
}

const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()

let lookupCache = null
async function lookups() {
  if (lookupCache) return lookupCache
  const maps = {}
  for (const f of DIM_FIELDS) maps[f] = new Map(ENUMS[f].map((v) => [fold(v), v]))
  for (const lang of LANGS) {
    const t = await loadDict(lang)
    for (const f of DIM_FIELDS) {
      if (f === 'region') {
        for (const [canon, label] of Object.entries(t.personas.regions)) maps.region.set(fold(label), canon)
      } else if (t.values?.[f]) {
        for (const [canon, label] of Object.entries(t.values[f])) if (ENUMS[f].includes(canon)) maps[f].set(fold(label), canon)
      }
    }
  }
  const langs = new Map(ENUMS.languages.map((l) => [l, l]))
  for (const [k, v] of Object.entries((await import('./personagen.mjs')).LANG_NAMES)) langs.set(fold(v), k)
  lookupCache = { maps, langs }
  return lookupCache
}

function readStore() {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return { updatedAt: null, personas: [] }
  }
}

export const loadCustomPersonas = () => readStore().personas

function writeStore(personas) {
  mkdirSync(join(ROOT, 'data'), { recursive: true })
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify({ updatedAt: Date.now(), personas }))
  renameSync(tmp, FILE)
}

export const clearCustomPersonas = () => writeStore([])

const bool = (v) => (/^(1|true|yes|y|evet|ja|si|sí)$/i.test(String(v).trim()) ? true : /^(0|false|no|n|hayir|hayır|nein)$/i.test(String(v).trim()) ? false : null)

/** Validate CSV text. Returns { personas, errors, warnings }. Nothing is stored. */
export async function parsePersonaCsv(text, { existing = [] } = {}) {
  const errors = []
  const warnings = []
  const raw = String(text ?? '').replace(/^﻿/, '')
  if (!raw.trim()) return { personas: [], errors: [{ row: 0, field: '', message: 'empty' }], warnings }
  if (Buffer.byteLength(raw) > MAX_CSV_BYTES) return { personas: [], errors: [{ row: 0, field: '', message: 'too_large' }], warnings }
  const rows = parseCsv(raw)
  if (rows.length < 2) return { personas: [], errors: [{ row: 0, field: '', message: 'no_rows' }], warnings }
  const header = rows[0].map((h) => fold(h).replace(/[\s-]+/g, '_'))
  const col = {}
  for (const [field, names] of Object.entries(ALIASES)) col[field] = header.findIndex((h) => names.includes(h))
  const known = new Set(Object.values(ALIASES).flat())
  header.forEach((h, i) => h && !known.has(h) && warnings.push({ row: 1, field: rows[0][i], message: 'unknown_column' }))
  if (!DIM_FIELDS.some((f) => col[f] >= 0) && col.country < 0) return { personas: [], errors: [{ row: 1, field: '', message: 'no_known_columns' }], warnings }

  const { maps, langs } = await lookups()
  const countries = new Map(loadCountryPool().countries.map((c) => [c.iso2, c]))
  const usedIds = new Set(existing.map((p) => p.id))
  let auto = existing.reduce((m, p) => Math.max(m, Number(/^CU-(\d+)$/.exec(p.id)?.[1] ?? 0)), 0)
  const personas = []
  const cell = (r, f) => (col[f] >= 0 ? String(r[col[f]] ?? '').replace(CONTROL, '').trim() : '')

  rows.slice(1).forEach((r, idx) => {
    const rowNo = idx + 2
    const fail = (field, message, value) => errors.push({ row: rowNo, field, message, value })
    const d = {}
    let ok = true
    for (const f of DIM_FIELDS) {
      const v = cell(r, f)
      if (!v) continue
      const canon = maps[f].get(fold(v))
      if (!canon) {
        fail(f, 'invalid_value', v)
        ok = false
      } else d[f] = canon
    }
    const iso = cell(r, 'country').toUpperCase()
    let country = null
    if (iso) {
      country = countries.get(iso)
      if (!country) {
        fail('country', 'unknown_country', iso)
        ok = false
      } else if (!d.region) d.region = country.region
    }
    if (!iso && Object.keys(d).length === 0) {
      fail('', 'empty_row')
      ok = false
    }
    const lang = cell(r, 'language')
    let l = null
    if (lang) {
      l = langs.get(fold(lang)) ?? null
      if (!l) {
        fail('language', 'invalid_value', lang)
        ok = false
      }
    }
    let internet = true
    if (cell(r, 'internet')) {
      const b = bool(cell(r, 'internet'))
      if (b === null) {
        fail('internet', 'invalid_value', cell(r, 'internet'))
        ok = false
      } else internet = b
    }
    const description = cell(r, 'description')
    if (description.length > 600) {
      fail('description', 'too_long')
      ok = false
    }
    const name = cell(r, 'name')
    if (name.length > 60) {
      fail('name', 'too_long')
      ok = false
    }
    let id
    const given = cell(r, 'id')
    if (given) {
      if (!/^[A-Za-z0-9_-]{1,24}$/.test(given)) {
        fail('id', 'invalid_id', given)
        ok = false
      } else id = `CU-${given.toUpperCase()}`
    } else id = `CU-${String(++auto).padStart(3, '0')}`
    if (id && usedIds.has(id)) {
      fail('id', 'duplicate_id', id)
      ok = false
    }
    if (!ok) return
    usedIds.add(id)
    personas.push({ id, c: iso || null, i: internet ? 1 : 0, l, d, ...(name ? { n: name } : {}), ...(description ? { x: description } : {}) })
  })
  if (existing.length + personas.length > MAX_CUSTOM) errors.push({ row: 0, field: '', message: 'too_many' })
  return { personas, errors, warnings }
}

export async function importPersonaCsv(text, mode = 'append') {
  const existing = mode === 'replace' ? [] : loadCustomPersonas()
  const result = await parsePersonaCsv(text, { existing })
  if (result.errors.length) return { ...result, saved: 0 }
  writeStore([...existing, ...result.personas])
  return { ...result, saved: result.personas.length, total: existing.length + result.personas.length }
}
