import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCountryPool } from './countries.mjs'
import { loadDict } from './i18n.mjs'
import { loadRunData, questionnaireMeta, questionsFor } from './results.mjs'
import { ROOT } from './paths.mjs'

const round = (n, d = 2) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d)
const pct = (x) => Math.round(x * 100)
const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : String(vars[k])))
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const sd = (a) => {
  if (a.length < 2) return null
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1))
}
const median = (a) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const k = Math.floor(s.length / 2)
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2
}

// ---------- persona attributes ----------
let devCache = null
function devPersonas() {
  devCache ??= new Map(JSON.parse(readFileSync(join(ROOT, 'shared', 'personas.json'), 'utf8')).personas.map((p) => [p.id, { d: p.d, region: p.d.region }]))
  return devCache
}

function personaInfo(pool) {
  if (pool === 'country') {
    const { countries, personas } = loadCountryPool()
    const byC = new Map(countries.map((c) => [c.iso2, c]))
    return new Map(personas.map((p) => [p.id, { d: p.d, country: p.c, region: byC.get(p.c)?.region }]))
  }
  return devPersonas()
}

// ---------- per-question statistics ----------
function answerValue(a) {
  return a?.value
}

export function questionStats(q, answers) {
  const base = { id: q.id, prompt: q.prompt, type: q.type, n: answers.length }
  const labelOf = (id) => q.options?.find((o) => o.id === id)?.label ?? String(id)
  if (q.type === 'likert') {
    const nums = answers.map((a) => Number(answerValue(a))).filter(Number.isFinite)
    const min = q.minValue ?? 1
    const max = q.maxValue ?? 5
    const hist = {}
    for (let v = min; v <= max; v++) hist[v] = 0
    for (const v of nums) hist[v] = (hist[v] ?? 0) + 1
    const out = { ...base, n: nums.length, min, max, mean: round(mean(nums)), sd: round(sd(nums)), median: median(nums), hist }
    if (max - min >= 3 && nums.length) {
      out.top2 = round(nums.filter((v) => v >= max - 1).length / nums.length, 3)
      out.bottom2 = round(nums.filter((v) => v <= min + 1).length / nums.length, 3)
    }
    if (min === 0 && max === 10 && nums.length) {
      const pr = nums.filter((v) => v >= 9).length / nums.length
      const de = nums.filter((v) => v <= 6).length / nums.length
      out.nps = { score: Math.round((pr - de) * 100), promoters: pct(pr), passives: pct(1 - pr - de), detractors: pct(de) }
    }
    return out
  }
  if (q.type === 'single_choice' || q.type === 'multi_choice') {
    const counts = new Map((q.options ?? []).map((o) => [o.id, 0]))
    for (const a of answers) for (const v of Array.isArray(answerValue(a)) ? answerValue(a) : [answerValue(a)]) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1)
    const options = [...counts].map(([id, count]) => ({ id, label: labelOf(id), count, share: answers.length ? round(count / answers.length, 3) : 0 }))
    const top = [...options].sort((x, y) => y.count - x.count)[0]
    return { ...base, options, top: top && top.count > 0 ? top : null, reasons: answers.map((a) => String(a.rationale ?? '').trim()).filter(Boolean).slice(0, 12) }
  }
  return { ...base, texts: answers.map((a) => String(answerValue(a) ?? '').trim()).filter(Boolean) }
}

// ---------- Van Westendorp ----------
function numbers(answers) {
  return answers
    .map((a) => String(answerValue(a) ?? '').replace(/,/g, '.').match(/-?\d+(\.\d+)?/)?.[0])
    .map(Number)
    .filter((v) => Number.isFinite(v) && v >= 0)
}

function crossing(grid, f, g) {
  for (let i = 0; i < grid.length; i++) {
    const d = f(grid[i]) - g(grid[i])
    if (d === 0) {
      // curves coincide over a run of grid points: report the middle of that run
      let j = i
      while (j + 1 < grid.length && f(grid[j + 1]) - g(grid[j + 1]) === 0) j++
      return (grid[i] + grid[j]) / 2
    }
    if (i > 0) {
      const prev = f(grid[i - 1]) - g(grid[i - 1])
      if (prev * d < 0) return grid[i - 1] + ((grid[i] - grid[i - 1]) * Math.abs(prev)) / (Math.abs(prev) + Math.abs(d))
    }
  }
  return null
}

export function vanWestendorp(sets) {
  const share = (arr, fn) => (x) => (arr.length ? arr.filter((v) => fn(v, x)).length / arr.length : 0)
  const tooCheap = share(sets.tooCheap, (v, x) => v >= x)
  const cheap = share(sets.cheap, (v, x) => v >= x)
  const expensive = share(sets.expensive, (v, x) => v <= x)
  const tooExpensive = share(sets.tooExpensive, (v, x) => v <= x)
  const notCheap = (x) => 1 - cheap(x)
  const notExpensive = (x) => 1 - expensive(x)
  const grid = [...new Set([...sets.tooCheap, ...sets.cheap, ...sets.expensive, ...sets.tooExpensive])].sort((a, b) => a - b)
  if (grid.length < 2 || Object.values(sets).some((a) => a.length === 0)) return null
  const points = {
    opp: crossing(grid, tooCheap, tooExpensive),
    ipp: crossing(grid, cheap, expensive),
    pmc: crossing(grid, tooCheap, notCheap),
    pme: crossing(grid, tooExpensive, notExpensive),
  }
  const step = Math.max(1, Math.ceil(grid.length / 40))
  const curves = grid.filter((_, i) => i % step === 0 || i === grid.length - 1).map((x) => ({ price: round(x), tooCheap: round(tooCheap(x), 3), cheap: round(cheap(x), 3), expensive: round(expensive(x), 3), tooExpensive: round(tooExpensive(x), 3) }))
  return { points: Object.fromEntries(Object.entries(points).map(([k, v]) => [k, v === null ? null : round(v)])), curves }
}

function buildVw(meta, respondents) {
  const pick = (qid) => respondents.map((r) => ({ value: r.answers[qid] }))
  const sets = { tooCheap: numbers(pick(meta.tooCheap)), cheap: numbers(pick(meta.cheap)), expensive: numbers(pick(meta.expensive)), tooExpensive: numbers(pick(meta.tooExpensive)) }
  const result = vanWestendorp(sets)
  return { type: 'vw', currency: meta.currency ?? '', n: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length])), points: result?.points ?? null, curves: result?.curves ?? [], minN: Math.min(...Object.values(sets).map((v) => v.length)) }
}

// ---------- multivariate (choice-based) ----------
function buildMvt(meta, respondents, t) {
  const attrs = meta.attributes.map((a) => ({ key: a.key, label: t.report.mvtAttr[a.key] ?? a.key, levels: a.levels.map((label) => ({ label, shown: 0, chosen: 0, rate: null })) }))
  let neither = 0
  let answered = 0
  for (const r of respondents) {
    for (const set of meta.sets) {
      const v = r.answers[set.questionId]
      if (v === undefined) continue
      answered++
      const id = String(v)
      if (id.endsWith('_neither')) {
        neither++
        continue
      }
      const chosen = id.endsWith('_a') ? set.a : id.endsWith('_b') ? set.b : null
      const other = chosen === set.a ? set.b : set.a
      if (!chosen) continue
      attrs.forEach((a, k) => {
        a.levels[chosen[k]].shown++
        a.levels[chosen[k]].chosen++
        a.levels[other[k]].shown++
      })
    }
  }
  for (const a of attrs) for (const l of a.levels) l.rate = l.shown ? round(l.chosen / l.shown, 3) : null
  return { type: 'mvt', attributes: attrs, neither: { count: neither, rate: answered ? round(neither / answered, 3) : null }, answered }
}

// ---------- segments ----------
const SEGMENT_FACETS = ['country', 'region', 'age_bracket', 'life_stage', 'economic_motivation', 'risk_tolerance', 'demo_employment_status', 'socioeconomic_band', 'gender_identity']

function facetLabel(t, facet) {
  const f = t.personas.filters
  const map = { country: t.personas.fCountry, region: f.region, age_bracket: f.age, life_stage: f.life, economic_motivation: f.econ, risk_tolerance: f.risk, demo_employment_status: t.personas.fEmployment, socioeconomic_band: t.personas.fIncome, gender_identity: t.personas.dims.gender_identity }
  return map[facet] ?? facet
}

function valueLabel(t, lang, facet, v) {
  if (facet === 'country') {
    try {
      return new Intl.DisplayNames([lang], { type: 'region' }).of(v) ?? v
    } catch {
      return v
    }
  }
  if (facet === 'region') return t.personas.regions[v] ?? v
  return t.values?.[facet]?.[v] ?? v
}

function buildSegments(respondents, questions, stats, t, lang) {
  const withInfo = respondents.filter((r) => r.info)
  if (withInfo.length < 2) return []
  const out = []
  for (const facet of SEGMENT_FACETS) {
    const groups = new Map()
    for (const r of withInfo) {
      const v = facet === 'country' ? r.info.country : facet === 'region' ? r.info.region : r.info.d?.[facet]
      if (!v) continue
      groups.set(v, [...(groups.get(v) ?? []), r])
    }
    if (groups.size < 2) continue
    const ordered = [...groups].sort((a, b) => b[1].length - a[1].length).slice(0, 8)
    const rows = []
    for (const q of questions) {
      const st = stats.find((s) => s.id === q.id)
      if (!st) continue
      if (q.type === 'likert') {
        const cells = {}
        for (const [v, rs] of ordered) {
          const nums = rs.map((r) => Number(r.answers[q.id])).filter(Number.isFinite)
          cells[v] = nums.length >= 2 ? round(mean(nums)) : null
        }
        rows.push({ questionId: q.id, prompt: q.prompt, kind: 'mean', cells })
      } else if (q.type === 'single_choice' && st.top) {
        const cells = {}
        for (const [v, rs] of ordered) {
          const answered = rs.filter((r) => r.answers[q.id] !== undefined)
          cells[v] = answered.length >= 2 ? round(answered.filter((r) => String(r.answers[q.id]) === st.top.id).length / answered.length, 3) : null
        }
        rows.push({ questionId: q.id, prompt: q.prompt, kind: 'share', topLabel: st.top.label, cells })
      }
    }
    if (rows.length) out.push({ facet, label: facetLabel(t, facet), groups: ordered.map(([v, rs]) => ({ value: v, label: valueLabel(t, lang, facet, v), n: rs.length })), rows })
  }
  return out
}

// ---------- main ----------
export async function buildReport(run, { lang = 'en', title } = {}) {
  const t = await loadDict(lang)
  const rs = t.report
  const nf = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 })
  const data = loadRunData(run)
  const params = run.params ?? {}
  const meta = questionnaireMeta(params.taskId)
  const info = personaInfo(params.pool === 'country' ? 'country' : 'dev')

  let questions = questionsFor(params.taskId)
  if (!questions) {
    const seen = new Map()
    for (const s of data.sets) for (const a of s.payload.answers) if (!seen.has(a.questionId)) seen.set(a.questionId, Array.isArray(a.value) ? 'multi_choice' : typeof a.value === 'number' ? 'likert' : 'single_choice')
    questions = [...seen].map(([id, type]) => ({ id, prompt: id, type }))
  }
  const byId = new Map(questions.map((q) => [q.id, q]))

  const respondents = data.sets.map((s, i) => {
    const answers = {}
    const rationales = {}
    for (const a of s.payload.answers) {
      answers[a.questionId] = a.value
      if (a.rationale) rationales[a.questionId] = String(a.rationale)
    }
    const labels = {}
    for (const [qid, v] of Object.entries(answers)) {
      const q = byId.get(qid)
      const lab = (id) => q?.options?.find((o) => o.id === String(id))?.label ?? String(id)
      labels[qid] = Array.isArray(v) ? v.map(lab).join('; ') : q && (q.type === 'single_choice') ? lab(v) : String(v)
    }
    return { index: i + 1, personaId: s.personaId, answers, rationales, labels, info: s.personaId ? info.get(s.personaId) : undefined }
  })

  const answersFor = (qid) => data.sets.map((s) => s.payload.answers.find((a) => a.questionId === qid)).filter(Boolean)
  const stats = questions.map((q) => questionStats(q, answersFor(q.id)))
  const n = respondents.length
  const segments = buildSegments(respondents, questions, stats, t, lang)

  const analyses = []
  if (meta.analysis?.type === 'vw') analyses.push(buildVw(meta.analysis, respondents))
  if (meta.analysis?.type === 'mvt') analyses.push(buildMvt(meta.analysis, respondents, t))

  // notices
  const notices = []
  if (data.synthetic) notices.push({ kind: 'warn', text: rs.notices.synthetic })
  if (n === 0) notices.push({ kind: 'warn', text: rs.notices.noData })
  else if (n < 30) notices.push({ kind: 'info', text: fill(rs.notices.smallN, { n }) })
  if (n > 0 && respondents.every((r) => !r.info)) notices.push({ kind: 'info', text: rs.notices.noPersonaMap })
  for (const a of analyses) {
    if (a.type === 'vw' && n > 0) {
      if (!a.points) notices.push({ kind: 'info', text: rs.notices.vwNone })
      else if (a.minN < 30) notices.push({ kind: 'info', text: rs.notices.vwSmall })
    }
  }

  // findings
  const findings = []
  for (const s of stats) {
    if (!s.n) continue
    const q = s.prompt.length > 90 ? `${s.prompt.slice(0, 87)}…` : s.prompt
    if (s.type === 'likert') {
      if (s.nps) findings.push(fill(rs.findings.nps, { nps: s.nps.score, p: s.nps.promoters, pa: s.nps.passives, d: s.nps.detractors }))
      findings.push(s.top2 !== undefined ? fill(rs.findings.likert, { q, mean: nf.format(s.mean), max: s.max, top2: pct(s.top2) }) : fill(rs.findings.likertPlain, { q, mean: nf.format(s.mean), max: s.max }))
    } else if (s.type === 'single_choice' && s.top) findings.push(fill(rs.findings.choice, { q, label: s.top.label, share: pct(s.top.share) }))
    else if (s.type === 'multi_choice' && s.top) findings.push(fill(rs.findings.multi, { q, list: [...s.options].sort((a, b) => b.count - a.count).slice(0, 3).filter((o) => o.count > 0).map((o) => `${o.label} (${pct(o.share)}%)`).join(', ') }))
    else if (s.type === 'free_text') findings.push(fill(rs.findings.text, { q, n: s.n }))
  }
  for (const a of analyses) {
    if (a.type === 'vw' && a.points?.pmc != null && a.points?.pme != null) findings.push(fill(rs.findings.vw, { lo: nf.format(a.points.pmc), hi: nf.format(a.points.pme), cur: a.currency, opp: a.points.opp == null ? '—' : nf.format(a.points.opp) }))
    if (a.type === 'mvt') for (const at of a.attributes) {
      const best = [...at.levels].filter((l) => l.rate !== null).sort((x, y) => y.rate - x.rate)[0]
      if (best) findings.push(fill(rs.findings.mvt, { attr: at.label, label: best.label, rate: pct(best.rate) }))
    }
  }
  const segFindings = []
  for (const q of questions.filter((x) => x.type === 'likert')) {
    let best = null
    for (const sg of segments) {
      const row = sg.rows.find((r) => r.questionId === q.id && r.kind === 'mean')
      if (!row) continue
      const cells = sg.groups.map((g) => ({ g, v: row.cells[g.value] })).filter((c) => c.v !== null)
      if (cells.length < 2) continue
      const hi = cells.reduce((a, b) => (b.v > a.v ? b : a))
      const lo = cells.reduce((a, b) => (b.v < a.v ? b : a))
      if (!best || hi.v - lo.v > best.spread) best = { spread: hi.v - lo.v, hi, lo, facet: sg.label }
    }
    if (best && best.spread >= 0.5) {
      const p = q.prompt.length > 70 ? `${q.prompt.slice(0, 67)}…` : q.prompt
      segFindings.push(`${best.facet}: ${fill(rs.findings.segment, { q: p, hi: best.hi.g.label, hiv: nf.format(best.hi.v), lo: best.lo.g.label, lov: nf.format(best.lo.v) })}`)
    }
  }
  findings.push(...segFindings.slice(0, 3))

  const method = [...rs.method]
  if (analyses.some((a) => a.type === 'vw')) method.push(rs.methodVw)

  const labelsMode = params.mode === 'smoke' ? rs.labels.modeSmoke : rs.labels.modeReal
  const poolLabel = params.pool === 'country' ? rs.labels.poolCountry : rs.labels.poolDev
  return {
    lang,
    title: title || meta.title || params.title || params.taskId || rs.title,
    reportTitle: rs.title,
    generatedAt: new Date().toISOString(),
    meta: {
      taskId: params.taskId ?? '',
      mode: labelsMode,
      synthetic: Boolean(data.synthetic),
      model: params.mode === 'smoke' ? '—' : params.model ?? '—',
      pool: poolLabel,
      seed: params.seed ?? '',
      respondents: n,
      runDate: run.createdAt ? new Date(run.createdAt).toISOString() : '',
    },
    notices,
    findings,
    questions: stats,
    segments,
    analyses,
    method,
    respondents: respondents.map(({ info: pinfo, ...r }) => ({ ...r, country: pinfo?.country ?? null })),
    labels: rs.labels,
    sections: rs.sections,
    footer: rs.footer,
    generatedLabel: rs.generated,
  }
}
