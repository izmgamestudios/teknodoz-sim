import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './paths.mjs'
import { REFERENCE_TASK } from './webtasks.mjs'

// Evidence that a *real* MatrAIx run behaves the way the app assumes. Nothing here runs MatrAIx; it inspects finished runs.
const DATA_DIR = join(ROOT, 'data')
const FILE = join(DATA_DIR, 'validation.json')
export const SURVEY_REFERENCE = 'example-survey_product-feedback'
export const REFERENCES = { survey: SURVEY_REFERENCE, web: REFERENCE_TASK }

export function readValidation() {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

export function writeValidation(kind, record) {
  const all = { ...readValidation(), [kind]: record }
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(all))
  return all
}

export const webReferenceValidated = () => readValidation().web?.ok === true

const finish = (checks) => ({ ok: checks.every((c) => c.level === 'warn' || c.ok), checks })
const mk = (checks) => (key, ok, detail = '', level = 'fail') => checks.push({ key, ok, detail, level })

/** Survey reference run: do the real result files have the shape the report code expects? */
export function checkSurveyResults({ sets, synthetic }, questions, expectedN) {
  const checks = []
  const add = mk(checks)
  add('real_not_smoke', !synthetic && sets.every((s) => !s.payload?.smoke), synthetic ? 'result files come from a smoke run' : '')
  add('files_found', sets.length > 0, `${sets.length} result file(s)`)
  add('count_matches', sets.length === expectedN, `${sets.length} of ${expectedN} personas`, 'warn')
  if (!questions?.length) {
    add('questionnaire_known', false, 'no questionnaire for this task')
    return finish(checks)
  }
  const byId = new Map(questions.map((q) => [q.id, q]))
  let missing = 0
  let invalid = 0
  for (const { payload } of sets) {
    const answers = new Map((payload.answers ?? []).map((a) => [a.questionId, a]))
    for (const q of questions) {
      const a = answers.get(q.id)
      if (!a) {
        missing++
        continue
      }
      const v = a.value
      const optionIds = new Set((q.options ?? []).map((o) => o.id))
      const ok =
        q.type === 'likert' ? Number.isFinite(Number(v)) && Number(v) >= (q.minValue ?? 1) && Number(v) <= (q.maxValue ?? 5)
        : q.type === 'single_choice' ? optionIds.has(String(v))
        : q.type === 'multi_choice' ? Array.isArray(v) && v.every((x) => optionIds.has(String(x)))
        : typeof v === 'string' && v.trim().length > 0
      if (!ok) invalid++
    }
    for (const a of payload.answers ?? []) if (!byId.has(a.questionId)) invalid++
  }
  add('all_questions_answered', missing === 0, `${missing} missing answer(s)`)
  add('values_valid', invalid === 0, `${invalid} invalid or unknown answer(s)`)
  add('persona_ids_resolved', sets.every((s) => s.personaId), 'some result files could not be tied to a persona id', 'warn')
  return finish(checks)
}

const BASIS = new Set(['price', 'quality', 'features', 'convenience', 'taste', 'trust', 'familiarity', 'novelty', 'fit', 'other'])
const STYLES = new Set(['quick_pick', 'compared_multiple', 'deep_research', 'hesitant'])
const OUTCOMES = new Set(['selected', 'considered', 'rejected', 'deferred', 'skipped'])
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0

/** Web reference run: re-applies the verifier's schema rules to the saved files and looks for the reward. */
export function checkWebResults(items, expectedN) {
  const checks = []
  const add = mk(checks)
  add('files_found', items.length > 0, `${items.length} quote_choice.json file(s)`)
  add('count_matches', items.length === expectedN, `${items.length} of ${expectedN} personas`, 'warn')
  const badChoice = items.filter((i) => {
    const c = i.choice
    return !(c && nonEmpty(c.decision_subject_id) && nonEmpty(c.decision_subject_label) && OUTCOMES.has(c.decision_outcome) && BASIS.has(c.basis_primary) && STYLES.has(c.exploration_style) && nonEmpty(c.task_author) && nonEmpty(c.reason))
  }).length
  add('choice_schema', items.length > 0 && badChoice === 0, `${badChoice} file(s) break the verifier's schema`)
  const badFeedback = items.filter((i) => {
    const f = i.feedback
    return !(f && Number.isFinite(Number(f.overallExperienceRating)) && f.overallExperienceRating >= 1 && f.overallExperienceRating <= 10 && nonEmpty(f.reason))
  }).length
  add('feedback_schema', items.length > 0 && badFeedback === 0, `${badFeedback} user_feedback.json file(s) missing or invalid`, 'warn')
  const rewards = items.map((i) => i.reward)
  add('reward_found', rewards.every((r) => r !== null && r !== undefined), 'verifier/reward.txt not found next to some results (job layout differs?)', 'warn')
  add('reward_passed', rewards.filter((r) => r !== null && r !== undefined).every((r) => String(r).trim() === '1'), 'the verifier gave reward 0 for some personas')
  return finish(checks)
}

function walk(dir, depth = 0, out = []) {
  if (depth > 9 || out.length > 3000 || !existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, depth + 1, out)
    else out.push(p)
  }
  return out
}

const readJson = (p) => {
  try {
    const t = readFileSync(p, 'utf8')
    return t.length > 200_000 ? null : JSON.parse(t)
  } catch {
    return null
  }
}

/** Web run results below a MatrAIx job directory: quote_choice.json + sibling user_feedback.json + verifier reward. */
export function scanWebResults(jobDir) {
  const files = walk(jobDir)
  const items = []
  for (const p of files) {
    if (!p.endsWith('/quote_choice.json')) continue
    const dir = p.slice(0, -'/quote_choice.json'.length)
    let reward = null
    let cur = dir
    for (let i = 0; i < 6 && cur.length >= jobDir.length && reward === null; i++) {
      const r = join(cur, 'verifier', 'reward.txt')
      if (existsSync(r)) reward = readFileSync(r, 'utf8').trim()
      cur = cur.slice(0, cur.lastIndexOf('/'))
    }
    const m = p.match(/persona_?(?:\d{2}_)?(?:persona_)?([A-Za-z0-9-]{2,})/)
    items.push({ path: p.slice(jobDir.length + 1), personaId: m ? m[1] : null, choice: readJson(p), feedback: readJson(join(dir, 'user_feedback.json')), reward })
  }
  return items
}
