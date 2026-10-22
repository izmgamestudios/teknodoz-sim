// Sanity checks for the synthetic persona sampler. Run: node scripts/test-personagen.mjs
import { existsSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { ageWeights, generatePersona, generatePool, toMatraixPersona, toYaml } from '../server/personagen.mjs'

const countries = JSON.parse(readFileSync(new URL('../shared/countries.json', import.meta.url))).countries
const by = Object.fromEntries(countries.map((c) => [c.iso2, c]))

// 1. determinism
assert.deepEqual(generatePersona(by.TR, 3, 42), generatePersona(by.TR, 3, 42))
assert.notDeepEqual(generatePersona(by.TR, 3, 42), generatePersona(by.TR, 4, 42))

// 2. values valid against MatrAIx dimensions.json (when the vendor checkout exists)
const dimsPath = new URL('../vendor/MatrAIx/persona/schema/dimensions.json', import.meta.url)
if (existsSync(dimsPath)) {
  const raw = JSON.parse(readFileSync(dimsPath))
  const items = Array.isArray(raw) ? raw : raw.dimensions
  const allowed = Object.fromEntries(items.map((x) => [x.id, new Set(x.values)]))
  let checked = 0
  for (const p of generatePool(countries, 24, 42)) {
    const persona = toMatraixPersona(p, by[p.c])
    for (const [k, v] of Object.entries(persona.dimensions)) {
      assert.ok(allowed[k], `unknown dimension ${k}`)
      assert.ok(allowed[k].has(v), `invalid value ${k}=${v} (${p.id})`)
      checked++
    }
  }
  console.log(`OK schema: ${checked} dimension values valid`)
} else console.log('SKIP schema check (no vendor/MatrAIx)')

// 3. distributions follow country inputs
const share = (iso, pred, n = 6000) => {
  let k = 0
  for (let i = 0; i < n; i++) if (pred(generatePersona(by[iso], i, 7))) k++
  return k / n
}
const young = (p) => ['18-24', '25-34'].includes(p.d.age_bracket)
const old = (p) => ['65-74', '75-84', '85+'].includes(p.d.age_bracket)
const ng = share('NG', young), jp = share('JP', young)
const ngOld = share('NG', old), jpOld = share('JP', old)
console.log(`young(18-34): NG ${ng.toFixed(2)} vs JP ${jp.toFixed(2)} | 65+: NG ${ngOld.toFixed(2)} vs JP ${jpOld.toFixed(2)}`)
assert.ok(ng > jp + 0.08, 'Nigeria should be younger than Japan')
assert.ok(jpOld > ngOld * 4, 'Japan should have far more 65+')
const csLow = share('NG', (p) => p.d.economic_motivation === 'Cost-sensitive')
const csHigh = share('CH' in by ? 'CH' : 'SG', (p) => p.d.economic_motivation === 'Cost-sensitive')
console.log(`cost-sensitive: NG ${csLow.toFixed(2)} vs SG ${csHigh.toFixed(2)}`)
assert.ok(csLow > csHigh + 0.15)
const riskYoung = (() => { let k = 0, n = 0; for (let i = 0; i < 8000; i++) { const p = generatePersona(by.US, i, 3); if (p.d.age_bracket === '18-24') { n++; if (['Risk-tolerant', 'Risk-seeking'].includes(p.d.risk_tolerance)) k++ } } return k / n })()
const riskOld = (() => { let k = 0, n = 0; for (let i = 0; i < 8000; i++) { const p = generatePersona(by.US, i, 3); if (p.d.age_bracket === '65-74') { n++; if (['Risk-tolerant', 'Risk-seeking'].includes(p.d.risk_tolerance)) k++ } } return k / n })()
console.log(`risk-tolerant/seeking: 18-24 ${riskYoung.toFixed(2)} vs 65-74 ${riskOld.toFixed(2)}`)
assert.ok(riskYoung > riskOld)
const net = share('ET', (p) => p.i === 1), net2 = share('KR', (p) => p.i === 1)
console.log(`internet users: ET ${net.toFixed(2)} vs KR ${net2.toFixed(2)}`)
assert.ok(net < 0.3 && net2 > 0.8)
const w = ageWeights(by.US).reduce((s, [, x]) => s + x, 0)
// weights are unnormalised adult population shares (weighted() normalises them)
assert.ok(w > 0.6 && w < 1.0, `adult share ${w.toFixed(2)} should be below 1`)

// 4. YAML emitter shape
const y = toYaml(toMatraixPersona(generatePersona(by.TR, 0, 42), by.TR))
assert.match(y, /^persona_id: 'TR-001'/)
assert.match(y, /\ndimensions:\n  age_bracket: '/)
assert.ok(y.includes("system_prompt: 'You live in T"))
console.log('OK all checks')
