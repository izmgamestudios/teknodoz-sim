// Tests for the World Bank refresh (mocked fetch) and country dataset writing. Run: node scripts/test-countries.mjs
import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { loadCountryPool, parseWbResponse, refreshFromWorldBank, WB_INDICATORS } from '../server/countries.mjs'

// parse
const parsed = parseWbResponse([{ page: 1 }, [
  { countryiso3code: 'TUR', date: '2023', value: 83.2 },
  { countryiso3code: 'DEU', date: '2022', value: null },
  { countryiso3code: 'BRA', date: '2023', value: '81.0' },
]])
assert.equal(parsed.size, 2)
assert.deepEqual(parsed.get('TUR'), { value: 83.2, date: '2023' })
assert.throws(() => parseWbResponse({ nope: 1 }))

// refresh with mocked fetch: IT.NET.USER.ZS fails, others return values for TUR only
const calls = []
const mock = async (url) => {
  calls.push(url)
  assert.ok(url.startsWith('https://api.worldbank.org/v2/'), 'fixed host only')
  if (url.includes(WB_INDICATORS.net)) return { ok: false, status: 500, text: async () => '' }
  const field = Object.entries(WB_INDICATORS).find(([, id]) => url.includes(`/indicator/${id}?`))[0]
  const value = field === 'pop' ? 85_000_000 : 11.1
  return { ok: true, status: 200, text: async () => JSON.stringify([{ page: 1 }, [{ countryiso3code: 'TUR', date: '2024', value }]]) }
}
const summary = await refreshFromWorldBank({ fetchImpl: mock })
assert.equal(calls.length, Object.keys(WB_INDICATORS).length)
assert.equal(summary.indicators.net.ok, false)
assert.equal(summary.indicators.gdp.ok, true)
assert.ok(summary.fallbackCount > 0, 'countries without data fall back to baseline')
const pool = loadCountryPool()
assert.equal(pool.meta.source, 'world-bank')
const tr = pool.countries.find((c) => c.iso2 === 'TR')
assert.equal(tr.gdp, 11.1)
assert.equal(tr.pop, 85)
assert.equal(tr.net, 83, 'failed indicator keeps baseline')
const de = pool.countries.find((c) => c.iso2 === 'DE')
assert.equal(de.gdp, 66000, 'country missing from response keeps baseline')
assert.equal(pool.personas.length, pool.countries.length * 24)

// all indicators failing -> error, no live file replaced
for (const f of ['countries.live.json', 'personas-country.live.json']) rmSync(new URL(`../data/${f}`, import.meta.url), { force: true })
await assert.rejects(() => refreshFromWorldBank({ fetchImpl: async () => ({ ok: false, status: 403, text: async () => '' }) }), /unreachable/)
assert.equal(loadCountryPool().meta.source, 'baseline')
assert.ok(!existsSync(new URL('../data/countries.live.json', import.meta.url)))
console.log('OK countries')
