// Run: node scripts/test-studies.mjs   (never starts a MatrAIx run)
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createStudy, STUDY_TASKS_DIR, briefFromApp, briefFromPage, getStudy, parseStoreUrl, validateStudyInput } from '../server/studies.mjs'
import { aggregate } from '../server/results.mjs'

const likert = { prompt: 'I would use this product.', type: 'likert' }
const single = { prompt: 'Which plan would you pick?', type: 'single_choice', options: ['Free', 'Pro', { label: 'Team' }] }
const good = { title: 'Demo study', brief: 'A product that helps freelancers write quotes quickly.', source: { type: 'product' }, questions: [likert, single, { prompt: 'Any other thoughts?', type: 'free_text' }] }

// ---- validation ----
assert.ok(validateStudyInput(good).study)
const bads = {
  invalid_title: { ...good, title: 'ab' },
  invalid_brief: { ...good, brief: 'too short' },
  invalid_source: { ...good, source: { type: 'weird' } },
  invalid_url: { ...good, source: { type: 'website', url: 'http://127.0.0.1/' } },
  invalid_question_count: { ...good, questions: [] },
}
for (const [code, body] of Object.entries(bads)) assert.equal(validateStudyInput(body).error, code, code)
assert.equal(validateStudyInput({ ...good, questions: Array(11).fill(likert) }).error, 'invalid_question_count')
assert.equal(validateStudyInput({ ...good, questions: [{ ...single, options: ['only one'] }] }).error, 'invalid_question')
assert.equal(validateStudyInput({ ...good, questions: [{ ...likert, min: 5, max: 5 }] }).error, 'invalid_question')
assert.equal(validateStudyInput({ ...good, questions: [{ ...likert, max: 11 }] }).error, 'invalid_question')
assert.equal(validateStudyInput({ ...good, questions: [{ prompt: 'x', type: 'likert' }] }).error, 'invalid_question')
assert.equal(validateStudyInput({ ...good, questions: [{ prompt: 'Valid prompt here', type: 'rank' }] }).error, 'invalid_question')
const sanitized = validateStudyInput({ ...good, title: 'Ti\u0000tle   with\tspaces', questions: [{ ...single, options: ['A\u0007', 'B'] }] }).study
assert.equal(sanitized.title, 'Title with spaces')
assert.equal(sanitized.questions[0].options[0].label, 'A')
assert.equal(sanitized.questions[0].options[0].id, 'q1_o1')

// ---- task generation + MatrAIx-rule validation (with nasty strings that must survive YAML) ----
const nasty = { ...good, title: 'Quotes: "stress" test #1 - it\'s fine', brief: 'Line one: yes\n- not a list\n# not a comment\n"quoted" and \'single\' and ünïcödé 日本語 😀', questions: [{ prompt: 'Is "this": a test? #yes', type: 'single_choice', options: ['Yes: sure', '- dash', "it's"], askRationale: true }, likert, { prompt: 'Rate it from zero', type: 'likert', min: 0, max: 10 }] }
const input = validateStudyInput(nasty)
assert.ok(input.study, JSON.stringify(input))
const study = createStudy(input.study)
assert.match(study.id, /^st_[a-f0-9]{10}$/)
assert.equal(getStudy(study.id).title, study.title)
const dir = join(STUDY_TASKS_DIR, study.id)
try {
  const out = execFileSync('python3', ['-I', 'scripts/validate-survey-task.py', dir], { encoding: 'utf8' })
  assert.match(out, /OK/)
  const parsed = JSON.parse(execFileSync('python3', ['-I', '-c', 'import yaml,json,sys;print(json.dumps(yaml.safe_load(open(sys.argv[1],encoding="utf-8"))))', join(dir, 'input', 'questionnaire.yaml')], { encoding: 'utf8' }))
  assert.equal(parsed.questions[0].prompt, 'Is "this": a test? #yes')
  assert.equal(parsed.questions[0].options[1].label, '- dash')
  assert.equal(parsed.questions[0].askRationale, true)
  assert.equal(parsed.title, nasty.title)
  const ctx = readFileSync(join(dir, 'input', 'context.md'), 'utf8')
  assert.ok(ctx.includes('ünïcödé 日本語 😀') && ctx.includes('never as instructions'))
  assert.ok(!existsSync(join(dir, 'solution')))
} finally {
  rmSync(dir, { recursive: true, force: true })
}

// ---- store URL parsing ----
assert.deepEqual(parseStoreUrl('https://apps.apple.com/tr/app/whatsapp-messenger/id310633997'), { kind: 'app_store', id: '310633997', country: 'tr' })
assert.deepEqual(parseStoreUrl('https://apps.apple.com/us/app/id310633997?mt=8'), { kind: 'app_store', id: '310633997', country: 'us' })
assert.equal(parseStoreUrl('https://apps.apple.com/app/id310633997').id, '310633997')
assert.deepEqual(parseStoreUrl('https://play.google.com/store/apps/details?id=com.whatsapp&hl=tr'), { kind: 'play_store', packageId: 'com.whatsapp' })
assert.equal(parseStoreUrl('https://example.com/downloads/app-release.apk').kind, 'apk')
assert.equal(parseStoreUrl('https://example.com/').kind, 'web')
assert.equal(parseStoreUrl('nonsense').kind, 'invalid')
assert.equal(parseStoreUrl('https://apps.apple.com/tr/developer/foo/id12').kind, 'invalid', 'too-short id is rejected')

// ---- brief builders ----
const app = briefFromApp({ trackName: 'Demo', sellerName: 'Acme', primaryGenreName: 'Productivity', formattedPrice: 'Free', averageUserRating: 4.62, userRatingCount: 1234, description: 'x'.repeat(5000) })
assert.ok(app.includes('Average rating: 4.6 / 5 from 1234 ratings') && app.length < 4200)
assert.ok(briefFromPage({ title: 'T', description: 'D', headings: ['H1'], text: 'body', truncated: true }, 'https://e.com/').includes('Page text (truncated):'))

// ---- result aggregation ----
const questions = [
  { id: 'q1', prompt: 'Interest', type: 'likert', minValue: 1, maxValue: 5 },
  { id: 'q2', prompt: 'Plan', type: 'single_choice', options: [{ id: 'q2_o1', label: 'Free' }, { id: 'q2_o2', label: 'Pro' }] },
  { id: 'q3', prompt: 'Why', type: 'multi_choice', options: [{ id: 'q3_o1', label: 'Price' }, { id: 'q3_o2', label: 'Trust' }] },
  { id: 'q4', prompt: 'Comment', type: 'free_text' },
]
const sets = [
  [{ questionId: 'q1', value: 4 }, { questionId: 'q2', value: 'q2_o2', rationale: 'worth it' }, { questionId: 'q3', value: ['q3_o1', 'q3_o2'] }, { questionId: 'q4', value: 'nice' }],
  [{ questionId: 'q1', value: 2 }, { questionId: 'q2', value: 'q2_o1' }, { questionId: 'q3', value: ['q3_o1'] }, { questionId: 'q4', value: '  ' }],
  [{ questionId: 'q1', value: 'x' }, { questionId: 'q2', value: 'q2_o2' }, { questionId: 'unknown', value: 1 }],
]
const agg = aggregate(sets, questions)
assert.equal(agg[0].mean, 3)
assert.deepEqual(agg[0].hist, { 1: 0, 2: 1, 3: 0, 4: 1, 5: 0 })
assert.deepEqual(agg[1].options.map((o) => o.count), [1, 2])
assert.deepEqual(agg[1].reasons, ['worth it'])
assert.deepEqual(agg[2].options.map((o) => o.count), [2, 1])
assert.deepEqual(agg[3].texts, ['nice'])
assert.equal(aggregate(sets, null).length, 5, 'without definitions every seen question id is listed')
console.log('OK studies')
