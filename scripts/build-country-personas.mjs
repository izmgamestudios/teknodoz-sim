// Generates shared/personas-country.json (baseline synthetic persona pool) from shared/countries.json.
// Usage: node scripts/build-country-personas.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { buildPoolFile } from '../server/countries.mjs'

const base = JSON.parse(readFileSync(new URL('../shared/countries.json', import.meta.url), 'utf8'))
const pool = buildPoolFile(base.countries, { source: base.source, asOf: base.asOf })
writeFileSync(new URL('../shared/personas-country.json', import.meta.url), JSON.stringify(pool))
console.log(`${pool.personas.length} personas for ${base.countries.length} countries`)
