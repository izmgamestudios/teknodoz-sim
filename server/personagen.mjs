// Deterministic synthetic persona sampler conditioned on country-level indicators.
//
// IMPORTANT: personas are synthetic. Demographics come from country aggregates; the mappings
// to life stage, economic motivation and risk tolerance are documented HEURISTICS (not
// measured country data). Base rates for economic motivation / risk tolerance come from the
// MatrAIx dev sample (n~70); their shape across income and age is an assumption.
// Output follows the MatrAIx persona schema (dimension ids and values from persona/schema/dimensions.json).

export const PRIMARY_LANGUAGE_ENUM = new Set([
  'english', 'mandarin', 'spanish', 'hindi', 'arabic', 'french', 'portuguese', 'bengali', 'russian', 'japanese', 'german', 'swahili',
])

export const LANG_NAMES = {
  english: 'English', mandarin: 'Mandarin Chinese', cantonese: 'Cantonese', spanish: 'Spanish', hindi: 'Hindi', arabic: 'Arabic',
  french: 'French', portuguese: 'Portuguese', bengali: 'Bengali', russian: 'Russian', japanese: 'Japanese', german: 'German',
  korean: 'Korean', italian: 'Italian', turkish: 'Turkish', vietnamese: 'Vietnamese', thai: 'Thai', indonesian: 'Indonesian',
  malay: 'Malay', swahili: 'Swahili', dutch: 'Dutch', polish: 'Polish', persian: 'Persian', hebrew: 'Hebrew', greek: 'Greek',
  czech: 'Czech', hungarian: 'Hungarian', romanian: 'Romanian', swedish: 'Swedish', tagalog: 'Tagalog', urdu: 'Urdu', tamil: 'Tamil',
  telugu: 'Telugu', marathi: 'Marathi', punjabi: 'Punjabi', gujarati: 'Gujarati', hausa: 'Hausa', yoruba: 'Yoruba', igbo: 'Igbo',
  amharic: 'Amharic', zulu: 'Zulu', afrikaans: 'Afrikaans',
}

const AGE_MID = { '18-24': 21, '25-34': 30, '35-44': 40, '45-54': 50, '55-64': 60, '65-74': 70, '75-84': 80, '85+': 88 }
const WORK_BASE = [0.17, 0.25, 0.22, 0.19, 0.17]

function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function weighted(rng, entries) {
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0)
  if (total <= 0) return entries[0][0]
  let r = rng() * total
  for (const [v, w] of entries) {
    r -= Math.max(0, w)
    if (r <= 0) return v
  }
  return entries[entries.length - 1][0]
}

export function ageWeights(c) {
  const y = c.y / 100
  const e = c.e / 100
  const w = Math.max(0.3, 1 - y - e)
  const s = (y - 0.2) / 0.1
  const work = ['18-24', '25-34', '35-44', '45-54', '55-64'].map((b, k) => [b, w * 0.94 * WORK_BASE[k] * Math.exp(-s * (k - 2) * 0.25)])
  const old = [['65-74', e * 0.62], ['75-84', e * 0.3], ['85+', e * 0.08]]
  return [...work, ...old]
}

function employment(rng, c, age) {
  const u = c.unemp / 100
  const low = c.gdp < 10000
  let w
  if (age === '18-24') {
    w = [['Student', 0.38], ['Full-time', 0.22], ['Part-time', 0.12], ['Self-employed', 0.05 + (low ? 0.08 : 0)], ['Gig / freelance', 0.05], ['Unemployed', Math.min(0.35, u * 2.2)]]
  } else if (['25-34', '35-44', '45-54'].includes(age)) {
    w = [['Full-time', 0.55], ['Part-time', 0.1], ['Self-employed', 0.12 + (low ? 0.12 : 0)], ['Gig / freelance', 0.05], ['Student', age === '25-34' ? 0.05 : 0.01], ['Unemployed', u]]
  } else if (age === '55-64') {
    w = [['Full-time', 0.4], ['Part-time', 0.1], ['Self-employed', 0.12 + (low ? 0.1 : 0)], ['Retired', 0.25], ['Unemployed', u * 0.8], ['Gig / freelance', 0.03]]
  } else {
    w = [['Retired', 0.82], ['Part-time', 0.07], ['Self-employed', 0.07 + (low ? 0.05 : 0)], ['Full-time', 0.03]]
  }
  return weighted(rng, w)
}

function lifeStage(rng, c, age, emp) {
  if (emp === 'Student') return 'Student'
  if (emp === 'Retired') return 'Retirement'
  const parent = 0.6 + (c.y / 100) * 2.0
  let w
  switch (age) {
    case '18-24': w = [['Early career', 0.9], ['Parent of young kids', 0.05 * parent]]; break
    case '25-34': w = [['Early career', 0.45], ['Parent of young kids', 0.3 * parent], ['Career change', 0.07], ['Mid-life', 0.1]]; break
    case '35-44': w = [['Parent of young kids', 0.35 * parent], ['Mid-life', 0.45], ['Career change', 0.1], ['Early career', 0.1]]; break
    case '45-54': w = [['Mid-life', 0.65], ['Empty nester', 0.2], ['Career change', 0.1], ['Parent of young kids', 0.05 * parent]]; break
    case '55-64': w = [['Mid-life', 0.3], ['Empty nester', 0.35], ['Retirement', 0.25], ['Career change', 0.1]]; break
    default: w = [['Retirement', 0.85], ['Empty nester', 0.15]]
  }
  return weighted(rng, w)
}

const BAND_TABLES = [
  [8000, [0.4, 0.3, 0.2, 0.08, 0.02]],
  [20000, [0.22, 0.3, 0.28, 0.15, 0.05]],
  [45000, [0.1, 0.2, 0.35, 0.25, 0.1]],
  [Infinity, [0.07, 0.15, 0.33, 0.27, 0.18]],
]
const BANDS = ['Low income', 'Lower-middle', 'Middle', 'Upper-middle', 'High income']

function socioBand(rng, c) {
  const table = BAND_TABLES.find(([max]) => c.gdp < max)[1]
  return weighted(rng, BANDS.map((b, i) => [b, table[i]]))
}

const ECON = {
  'Low income': [0.7, 0.26, 0.01, 0.03],
  'Lower-middle': [0.62, 0.33, 0.01, 0.04],
  Middle: [0.45, 0.43, 0.06, 0.06],
  'Upper-middle': [0.3, 0.45, 0.17, 0.08],
  'High income': [0.2, 0.4, 0.28, 0.12],
}
const ECON_VALUES = ['Cost-sensitive', 'Value-driven', 'Premium-seeking', 'Indifferent']

function econMotivation(rng, band) {
  return weighted(rng, ECON_VALUES.map((v, i) => [v, ECON[band][i]]))
}

function riskTolerance(rng, age) {
  const mid = AGE_MID[age]
  const k = Math.min(1.6, Math.max(0.5, 1 + (0.35 * (35 - mid)) / 20))
  return weighted(rng, [
    ['Risk-averse', 0.29 / k],
    ['Cautious', 0.27 / Math.sqrt(k)],
    ['Balanced', 0.26],
    ['Risk-tolerant', 0.09 * Math.sqrt(k)],
    ['Risk-seeking', 0.1 * k],
  ])
}

function pickLang(rng, c) {
  const total = c.langs.reduce((s, [, w]) => s + w, 0)
  if (!c.langs.length || rng() > total) return null
  return weighted(rng, c.langs)
}

export function personaId(iso2, index) {
  return `${iso2}-${String(index + 1).padStart(3, '0')}`
}

export function generatePersona(c, index, seed = 42) {
  const rng = mulberry32(hashSeed(`${seed}:${c.iso2}:${index}`))
  const age = weighted(rng, ageWeights(c))
  const elder = AGE_MID[age] >= 65
  const gender = rng() < 0.5 + (elder ? 0.05 : 0) ? 'Woman' : 'Man'
  const emp = employment(rng, c, age)
  const urban = rng() < c.urban / 100
  const urbanicity = urban ? weighted(rng, [['Dense urban', 0.55], ['Suburban', 0.45]]) : weighted(rng, [['Small town', 0.45], ['Rural', 0.55]])
  const band = socioBand(rng, c)
  const mid = AGE_MID[age]
  const netBase = c.net / 100
  const netP = mid < 35 ? Math.min(1, netBase * 1.1) : mid < 55 ? netBase : netBase * 0.7
  const lang = pickLang(rng, c)
  const d = {
    age_bracket: age,
    gender_identity: gender,
    life_stage: lifeStage(rng, c, age, emp),
    urbanicity,
    socioeconomic_band: band,
    economic_motivation: econMotivation(rng, band),
    risk_tolerance: riskTolerance(rng, age),
    demo_employment_status: emp,
  }
  return { id: personaId(c.iso2, index), c: c.iso2, i: rng() < netP ? 1 : 0, l: lang, d }
}

export function generatePool(countries, perCountry = 24, seed = 42) {
  const out = []
  for (const c of countries) for (let i = 0; i < perCountry; i++) out.push(generatePersona(c, i, seed))
  return out
}

export function countryName(iso2, lang = 'en') {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(iso2) || iso2
  } catch {
    return iso2
  }
}

export function systemPromptFor(p, c) {
  const name = countryName(c.iso2, 'en')
  const parts = [`You live in ${name} (local currency: ${c.cur}).`]
  if (p.l) parts.push(`Your native language is ${LANG_NAMES[p.l] ?? p.l}.`)
  parts.push(
    `Answer as an ordinary resident of ${name} would: judge prices, wages and everyday situations against local conditions, and if amounts are quoted in another currency, compare them with local incomes.`,
  )
  if (!p.i) parts.push('You rarely use the internet or smartphone apps.')
  return parts.join(' ')
}

// Full MatrAIx persona object (what goes into persona_<id>.yaml)
export function toMatraixPersona(p, c, meta = {}) {
  const dimensions = { ...p.d, region: c.region }
  if (p.l) {
    if (PRIMARY_LANGUAGE_ENUM.has(p.l)) dimensions.primary_language = p.l[0].toUpperCase() + p.l.slice(1)
    dimensions[`lang_${p.l}`] = 'Native'
  }
  return {
    persona_id: p.id,
    version: '1.0',
    source: 'teknodoz-synthetic',
    display_name: p.id,
    system_prompt: systemPromptFor(p, c),
    dimensions,
    provenance: {
      generator: 'teknodoz-country-sampler',
      country: c.iso2,
      data_source: meta.source ?? 'baseline',
      data_as_of: meta.asOf ?? 'unknown',
      synthetic: true,
    },
  }
}

// Minimal YAML emitter for nested string/boolean/number maps (single-quoted strings).
export function toYaml(obj, indent = 0) {
  const pad = ' '.repeat(indent)
  const lines = []
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') {
      lines.push(`${pad}${k}:`)
      lines.push(toYaml(v, indent + 2))
    } else if (typeof v === 'string') {
      lines.push(`${pad}${k}: '${v.replace(/'/g, "''")}'`)
    } else {
      lines.push(`${pad}${k}: ${v}`)
    }
  }
  return lines.join('\n')
}

/** MatrAIx persona for an imported (CSV) persona. `c` is the country record when a country code was given. */
export function toMatraixCustomPersona(p, c, meta = {}) {
  const dimensions = { ...p.d }
  if (c && !dimensions.region) dimensions.region = c.region
  if (p.l) {
    if (PRIMARY_LANGUAGE_ENUM.has(p.l)) dimensions.primary_language = p.l[0].toUpperCase() + p.l.slice(1)
    dimensions[`lang_${p.l}`] = 'Native'
  }
  const parts = []
  if (c) parts.push(`You live in ${countryName(c.iso2, 'en')} (local currency: ${c.cur}).`)
  if (p.l) parts.push(`Your native language is ${LANG_NAMES[p.l] ?? p.l}.`)
  if (p.x) parts.push(`About you: ${p.x}`)
  parts.push(c ? `Answer as an ordinary resident of ${countryName(c.iso2, 'en')} would, judging prices and situations against local conditions.` : 'Answer as this person would, in their own voice.')
  if (!p.i) parts.push('You rarely use the internet or smartphone apps.')
  return {
    persona_id: p.id,
    version: '1.0',
    source: 'teknodoz-import',
    display_name: p.n || p.id,
    system_prompt: parts.join(' '),
    dimensions,
    provenance: { generator: 'teknodoz-csv-import', country: c?.iso2 ?? '', data_source: meta.source ?? 'import', synthetic: false },
  }
}
