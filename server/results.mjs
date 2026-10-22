import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { ROOT } from './paths.mjs'
import { getStudy, STUDY_ID_RE } from './studies.mjs'

const MATRAIX_DIR = join(ROOT, 'vendor', 'MatrAIx')
const RESULTS_DIR = join(ROOT, 'data', 'run-results')
const MAX_FILES = 800
const MAX_DEPTH = 8
const MAX_JSON_BYTES = 400_000
const SMOKE_PREFIX = join(tmpdir(), 'matraix-smoke-')

// ---------- discovery ----------
function walk(dir, depth = 0, out = []) {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES || !existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, depth + 1, out)
    else out.push({ path: p, size: st.size })
    if (out.length >= MAX_FILES) break
  }
  return out
}

const hasAnswers = (payload) =>
  payload && Array.isArray(payload.answers) && payload.answers.length > 0 && payload.answers.every((a) => a && typeof a.questionId === 'string')

/** Find survey result envelopes ({answers:[{questionId,value}]}) anywhere below `dir`, whatever the file is called. */
export function scanResultFiles(dir) {
  const found = []
  for (const f of walk(dir)) {
    if (!f.path.endsWith('.json') || f.size > MAX_JSON_BYTES) continue
    try {
      const payload = JSON.parse(readFileSync(f.path, 'utf8'))
      if (hasAnswers(payload)) found.push({ path: f.path, payload })
    } catch {
      /* not a result file */
    }
  }
  return found
}

/** Best-effort persona id for a result file: smoke folder naming first, then known ids appearing in the path. */
export function derivePersonaId(path, knownIds = []) {
  const smoke = path.match(/persona_\d{2}_persona_([A-Za-z0-9-]+)/)
  if (smoke) return smoke[1]
  for (const id of knownIds) {
    const re = new RegExp(`(^|[^A-Za-z0-9])${id.replace(/[^A-Za-z0-9-]/g, '')}([^A-Za-z0-9]|$)`)
    if (re.test(path)) return id
  }
  return null
}

// ---------- capture ----------
export function parseSmokeArtifactDirs(log) {
  const dirs = []
  for (const m of String(log).matchAll(/^\s{2}(\/\S*matraix-smoke-\S+)$/gm)) {
    const p = resolve(m[1])
    if (p.startsWith(SMOKE_PREFIX) && !p.includes('..')) dirs.push(p)
  }
  return dirs
}

function writeSnapshot(runId, entries, meta) {
  const dir = join(RESULTS_DIR, runId)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const files = entries.map((e, i) => {
    const name = `r${String(i + 1).padStart(3, '0')}.json`
    writeFileSync(join(dir, name), JSON.stringify(e.payload))
    return { file: name, personaId: e.personaId }
  })
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ ...meta, files, capturedAt: Date.now() }))
  return files.length
}

/** Keep the synthetic answers a smoke run produced, then remove MatrAIx's temp directory. */
export function captureSmoke(run) {
  const dirs = parseSmokeArtifactDirs(run.log)
  const entries = []
  const bases = new Set()
  for (const d of dirs) {
    bases.add(d.slice(0, d.indexOf('/', SMOKE_PREFIX.length) === -1 ? undefined : d.indexOf('/', SMOKE_PREFIX.length)))
    for (const f of scanResultFiles(d)) entries.push({ payload: f.payload, personaId: derivePersonaId(f.path) })
  }
  const n = entries.length ? writeSnapshot(run.id, entries, { synthetic: true, source: 'smoke' }) : 0
  for (const b of bases) if (resolve(b).startsWith(SMOKE_PREFIX)) rmSync(b, { recursive: true, force: true })
  return n
}

/** Copy the result files of a real run out of MatrAIx's jobs directory so reports survive later cleanups. */
export function snapshotRealRun(run) {
  const jobName = run.params?.jobName
  if (!jobName || !/^[a-z0-9-]+$/.test(jobName)) return 0
  const found = scanResultFiles(join(MATRAIX_DIR, 'jobs', jobName))
  if (!found.length) return 0
  const known = run.params.personaIds ?? []
  return writeSnapshot(run.id, found.map((f) => ({ payload: f.payload, personaId: derivePersonaId(f.path, known) })), { synthetic: false, source: 'jobs' })
}

// ---------- loading ----------
export function loadRunData(run) {
  const dir = join(RESULTS_DIR, run.id)
  const indexPath = join(dir, 'index.json')
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, 'utf8'))
    const sets = index.files.map((f) => ({ personaId: f.personaId, payload: JSON.parse(readFileSync(join(dir, f.file), 'utf8')) }))
    return { sets, synthetic: Boolean(index.synthetic), source: index.source }
  }
  const jobName = run.params?.jobName
  if (run.params?.mode === 'auto' && jobName && /^[a-z0-9-]+$/.test(jobName)) {
    const known = run.params.personaIds ?? []
    const sets = scanResultFiles(join(MATRAIX_DIR, 'jobs', jobName)).map((f) => ({ personaId: derivePersonaId(f.path, known), payload: f.payload }))
    return { sets, synthetic: false, source: 'jobs' }
  }
  return { sets: [], synthetic: run.params?.mode === 'smoke', source: 'none' }
}

let qCache = { key: '', value: {} }
function loadQuestionnaires() {
  const files = ['questionnaires.builtin.json', 'questionnaires.json'].map((f) => join(ROOT, 'shared', f))
  const key = files.map((f) => (existsSync(f) ? statSync(f).mtimeMs : 0)).join(':')
  if (qCache.key === key) return qCache.value
  const merged = {}
  for (const f of files) {
    try {
      Object.assign(merged, JSON.parse(readFileSync(f, 'utf8')))
    } catch {
      /* optional file */
    }
  }
  qCache = { key, value: merged }
  return merged
}

export function questionsFor(taskId) {
  if (STUDY_ID_RE.test(taskId)) return getStudy(taskId)?.questions ?? null
  return loadQuestionnaires()[taskId]?.questions ?? null
}

export function questionnaireMeta(taskId) {
  if (STUDY_ID_RE.test(taskId)) {
    const st = getStudy(taskId)
    return { title: st?.title, analysis: st?.analysis }
  }
  const q = loadQuestionnaires()[taskId]
  return { title: q?.title, analysis: q?.analysis }
}

/** Pure aggregation: answer sets (one per persona) -> per-question summaries. */
export function aggregate(answerSets, questions) {
  const byId = new Map()
  for (const set of answerSets) for (const a of set) {
    if (!a || typeof a.questionId !== 'string') continue
    if (!byId.has(a.questionId)) byId.set(a.questionId, [])
    byId.get(a.questionId).push(a)
  }
  const defs = questions ?? [...byId.keys()].map((id) => ({ id, prompt: id, type: 'single_choice' }))
  return defs.map((q) => {
    const answers = byId.get(q.id) ?? []
    const base = { id: q.id, prompt: q.prompt, type: q.type, n: answers.length }
    const labelOf = (id) => q.options?.find((o) => o.id === id)?.label ?? String(id)
    if (q.type === 'likert') {
      const nums = answers.map((a) => Number(a.value)).filter(Number.isFinite)
      const hist = {}
      for (let v = q.minValue ?? 1; v <= (q.maxValue ?? 5); v++) hist[v] = 0
      for (const v of nums) hist[v] = (hist[v] ?? 0) + 1
      return { ...base, min: q.minValue ?? 1, max: q.maxValue ?? 5, mean: nums.length ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 100) / 100 : null, hist }
    }
    if (q.type === 'single_choice' || q.type === 'multi_choice') {
      const counts = new Map((q.options ?? []).map((o) => [o.id, 0]))
      for (const a of answers) for (const v of Array.isArray(a.value) ? a.value : [a.value]) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1)
      const reasons = answers.map((a) => String(a.rationale ?? '').trim()).filter(Boolean).slice(0, 8)
      return { ...base, options: [...counts].map(([id, count]) => ({ id, label: labelOf(id), count })), reasons }
    }
    return { ...base, texts: answers.map((a) => String(a.value ?? '').trim()).filter(Boolean).slice(0, 30) }
  })
}

const listTree = (dir) => (existsSync(dir) ? walk(dir).slice(0, 40).map((f) => ({ path: relative(dir, f.path), size: f.size })) : [])

export function collectResults(run) {
  if (run.kind !== 'simulation') return { n: 0, questions: [], found: false }
  const data = loadRunData(run)
  const answerSets = data.sets.map((s) => s.payload.answers)
  const jobName = run.params?.jobName
  const diagnostics =
    answerSets.length === 0 && run.params?.mode === 'auto' && jobName && /^[a-z0-9-]+$/.test(jobName)
      ? { jobDirExists: existsSync(join(MATRAIX_DIR, 'jobs', jobName)), files: listTree(join(MATRAIX_DIR, 'jobs', jobName)) }
      : null
  return {
    n: answerSets.length,
    found: answerSets.length > 0,
    synthetic: data.synthetic,
    source: data.source,
    questions: aggregate(answerSets, questionsFor(run.params.taskId)),
    diagnostics,
  }
}

export const smokeTmpPrefix = SMOKE_PREFIX
