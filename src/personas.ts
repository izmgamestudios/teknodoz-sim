import { useEffect, useState } from 'react'
import { api } from './api'

export type Persona = { id: string; name: string; source: string; d: Record<string, string> }
export type PersonaData = { groups: Record<'profile' | 'decision' | 'style', string[]>; valueKeys: string[]; personas: Persona[] }

let cache: PersonaData | null = null

export function usePersonas(): PersonaData | null {
  const [data, setData] = useState<PersonaData | null>(cache)
  useEffect(() => {
    if (cache) return
    import('../shared/personas.json').then((m) => {
      cache = m.default as PersonaData
      setData(cache)
    })
  }, [])
  return data
}

// ---- country-based synthetic pool (served by /api/country-pool) ----
export type CountryRec = {
  iso2: string
  iso3: string
  region: string
  sub: string
  cur: string
  langs: [string, number][]
  pop: number
  y: number
  e: number
  urban: number
  gdp: number
  net: number
  unemp: number
}
export type CountryPersona = { id: string; c: string; i: 0 | 1; l: string | null; d: Record<string, string> }
export type CountryPool = {
  meta: {
    source: string
    asOf: string
    fetchedAt: string | null
    note: string
    indicators: Record<string, { id: string; ok: boolean; countries?: number; error?: string }> | null
    perCountry: number
  }
  countries: CountryRec[]
  personas: CountryPersona[]
}

let poolPromise: Promise<CountryPool> | null = null
export function reloadCountryPool() {
  poolPromise = null
}

export function useCountryPool(enabled = true): { data: CountryPool | null; error: boolean } {
  const [state, setState] = useState<{ data: CountryPool | null; error: boolean }>({ data: null, error: false })
  useEffect(() => {
    if (!enabled) return
    poolPromise ??= api<CountryPool>('/api/country-pool')
    let alive = true
    poolPromise
      .then((data) => alive && setState({ data, error: false }))
      .catch(() => {
        poolPromise = null
        if (alive) setState({ data: null, error: true })
      })
    return () => {
      alive = false
    }
  }, [enabled])
  return state
}

export function countryName(iso2: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(iso2) ?? iso2
  } catch {
    return iso2
  }
}

// ---- imported (CSV) personas, admin only ----
export type CustomPersona = { id: string; c: string | null; i: 0 | 1; l: string | null; d: Record<string, string>; n?: string; x?: string }

export function useCustomPersonas(enabled: boolean, version = 0): CustomPersona[] {
  const [list, setList] = useState<CustomPersona[]>([])
  useEffect(() => {
    if (!enabled) return setList([])
    let alive = true
    api<{ personas: CustomPersona[] }>('/api/custom-personas')
      .then((r) => alive && setList(r.personas))
      .catch(() => alive && setList([]))
    return () => {
      alive = false
    }
  }, [enabled, version])
  return list
}
