import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { MATRAIX_DIR } from './runner.mjs'
import { ROOT } from './paths.mjs'
import { getStudy, STUDY_ID_RE } from './studies.mjs'

const MAX_FILES = 500
const MAX_DEPTH = 7

function findResultFiles(dir, depth = 0, out = []) {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES || !existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) findResultFiles(p, depth + 1, out)
    else if (name === 'survey_result.json') out.push(p)
    if (out.length >= MAX_FILES) break
  }
  return out
}

function questionsFor(taskId) {
  if (STUDY_ID_RE.test(taskId)) return getStudy(taskId)?.questions ?? null
  try {
    return JSON.parse(readFileSync(join(ROOT, 'shared', 'questionnaires.json'), 'utf8'))[taskId]?.questions ?? null
  } catch {
    return null
  }
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

export function collectResults(run) {
  const jobName = run.params?.jobName
  if (run.kind !== 'simulation' || !jobName || !/^[a-z0-9-]+$/.test(jobName)) return { n: 0, questions: [], found: false }
  const files = findResultFiles(join(MATRAIX_DIR, 'jobs', jobName))
  const sets = []
  for (const f of files) {
    try {
      const payload = JSON.parse(readFileSync(f, 'utf8'))
      if (Array.isArray(payload.answers)) sets.push(payload.answers)
    } catch {
      /* skip unreadable file */
    }
  }
  return { n: sets.length, found: sets.length > 0, questions: aggregate(sets, questionsFor(run.params.taskId)) }
}
