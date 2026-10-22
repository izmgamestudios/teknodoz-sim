// Web task generation + real-run validation checks (no MatrAIx run, no network). Run: node scripts/test-webtasks.mjs
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertPublicHost, referenceDir, validateWebInput, validateWebTaskDir, webTaskFiles, writeWebTask } from '../server/webtasks.mjs'
import { checkSurveyResults, checkWebResults, scanWebResults } from '../server/validation.mjs'
import { FetchError } from '../server/safefetch.mjs'

const ref = referenceDir()
const good = { title: 'Shop study', goal: 'Which product would you pick and why?', url: 'https://example.com/shop', confirmPermission: true }

// ---- input validation ----
const bad = (patch, code) => assert.throws(() => validateWebInput({ ...good, ...patch }), (e) => e instanceof FetchError && e.code === code, JSON.stringify(patch))
bad({ confirmPermission: false }, 'permission_required')
bad({ confirmPermission: undefined }, 'permission_required')
bad({ title: 'ab' }, 'invalid_title')
bad({ goal: 'short' }, 'invalid_goal')
bad({ url: 'ftp://example.com' }, 'invalid_url')
bad({ url: 'http://localhost/x' }, 'blocked_host')
bad({ url: 'http://127.0.0.1/' }, 'blocked_host')
bad({ url: 'http://169.254.169.254/latest' }, 'blocked_host')
bad({ url: 'https://example.com:8443/' }, 'invalid_url')
bad({ url: 'https://user:pw@example.com/' }, 'invalid_url')
assert.equal(validateWebInput(good).u.hostname, 'example.com')
await assert.rejects(assertPublicHost(new URL('https://evil.example'), async () => [{ address: '10.0.0.5', family: 4 }]), /blocked_host/)
await assert.rejects(assertPublicHost(new URL('https://evil.example'), async () => [{ address: '93.184.216.34' }, { address: '192.168.1.1' }]), /blocked_host/)
await assert.rejects(assertPublicHost(new URL('https://nx.example'), async () => { throw new Error('ENOTFOUND') }), /unresolvable_host/)
await assertPublicHost(new URL('https://ok.example'), async () => [{ address: '93.184.216.34', family: 4 }])

if (existsSync(join(ref, 'task.toml'))) {
// ---- generation against the real reference task shipped with MatrAIx ----
  const id = 'wt_0123456789'
const url = 'https://example.com/shop'
const dest = join(mkdtempSync(join(tmpdir(), 'wt-')), id)
const files = webTaskFiles({ id, title: good.title, url, goal: good.goal }, readFileSync(join(ref, 'task.toml'), 'utf8'))
writeWebTask(dest, files, ref)
const v = validateWebTaskDir(dest, ref, { id, url })
assert.ok(v.ok, JSON.stringify(v.checks.filter((c) => !c.ok)))
assert.ok(v.checks.length >= 15)
assert.match(readFileSync(join(dest, 'task.toml'), 'utf8'), /name = "application\/teknodoz-web-wt_0123456789"/)
assert.match(readFileSync(join(dest, 'input/context.md'), 'utf8'), /https:\/\/example\.com\/shop/)
assert.throws(() => webTaskFiles({ id, title: 't', url, goal: 'g' }, 'no toml here'), /reference_format_changed/)
// tampering with the verifier is detected
writeFileSync(join(dest, 'tests/test_state.py'), readFileSync(join(dest, 'tests/test_state.py'), 'utf8') + '\n# changed\n')
assert.ok(!validateWebTaskDir(dest, ref, { id, url }).ok)

} else console.log('SKIP generation checks: MatrAIx reference task not installed')

// ---- survey validation ----
const qs = [
  { id: 'q1', type: 'likert', minValue: 1, maxValue: 5 },
  { id: 'q2', type: 'single_choice', options: [{ id: 'a' }, { id: 'b' }] },
  { id: 'q3', type: 'multi_choice', options: [{ id: 'a' }, { id: 'b' }] },
  { id: 'q4', type: 'free_text' },
]
const okSet = (pid) => ({ personaId: pid, payload: { answers: [{ questionId: 'q1', value: 4 }, { questionId: 'q2', value: 'a' }, { questionId: 'q3', value: ['a', 'b'] }, { questionId: 'q4', value: 'text' }] } })
const failed = (r) => r.checks.filter((c) => !c.ok && c.level !== 'warn').map((c) => c.key)
assert.deepEqual(failed(checkSurveyResults({ sets: [okSet('p1'), okSet('p2')], synthetic: false }, qs, 2)), [])
assert.ok(checkSurveyResults({ sets: [okSet('p1'), okSet('p2')], synthetic: false }, qs, 2).ok)
assert.deepEqual(failed(checkSurveyResults({ sets: [okSet('p1')], synthetic: true }, qs, 1)), ['real_not_smoke'])
assert.deepEqual(failed(checkSurveyResults({ sets: [], synthetic: false }, qs, 2)), ['files_found'])
const broken = okSet('p1')
broken.payload.answers[0].value = 9
broken.payload.answers.pop()
assert.deepEqual(failed(checkSurveyResults({ sets: [broken], synthetic: false }, qs, 1)).sort(), ['all_questions_answered', 'values_valid'])
const unknownQ = okSet('p1')
unknownQ.payload.answers.push({ questionId: 'zz', value: 1 })
assert.deepEqual(failed(checkSurveyResults({ sets: [unknownQ], synthetic: false }, qs, 1)), ['values_valid'])
assert.ok(checkSurveyResults({ sets: [{ ...okSet('p1'), personaId: null }], synthetic: false }, qs, 1).ok, 'unresolved persona id is only a warning')
assert.deepEqual(failed(checkSurveyResults({ sets: [okSet('p1')], synthetic: false }, null, 1)), ['questionnaire_known'])

// ---- web validation ----
const choice = { decision_subject_id: 'x', decision_subject_label: 'X', decision_outcome: 'selected', basis_primary: 'price', exploration_style: 'quick_pick', reason: 'cheap', task_author: 'Acme' }
const fb = { overallExperienceRating: 7, reason: 'fine' }
assert.ok(checkWebResults([{ choice, feedback: fb, reward: '1' }], 1).ok)
assert.deepEqual(failed(checkWebResults([], 1)), ['files_found', 'choice_schema'])
assert.deepEqual(failed(checkWebResults([{ choice: { ...choice, basis_primary: 'vibes' }, feedback: fb, reward: '1' }], 1)), ['choice_schema'])
assert.deepEqual(failed(checkWebResults([{ choice, feedback: fb, reward: '0' }], 1)), ['reward_passed'])
assert.ok(checkWebResults([{ choice, feedback: null, reward: null }], 1).ok, 'missing feedback/reward are warnings (layout unknown)')

// ---- scanning a job directory ----
const job = mkdtempSync(join(tmpdir(), 'job-'))
const trial = join(job, '2026-01-01__trial_persona_0042', 'artifacts', 'app', 'output')
mkdirSync(trial, { recursive: true })
mkdirSync(join(job, '2026-01-01__trial_persona_0042', 'verifier'), { recursive: true })
writeFileSync(join(trial, 'quote_choice.json'), JSON.stringify(choice))
writeFileSync(join(trial, 'user_feedback.json'), JSON.stringify(fb))
writeFileSync(join(job, '2026-01-01__trial_persona_0042', 'verifier', 'reward.txt'), '1\n')
const items = scanWebResults(job)
assert.equal(items.length, 1)
assert.equal(items[0].reward, '1')
assert.equal(items[0].choice.task_author, 'Acme')
assert.equal(items[0].feedback.overallExperienceRating, 7)
assert.equal(scanWebResults(join(job, 'missing')).length, 0)
console.log('OK web tasks + validation')
