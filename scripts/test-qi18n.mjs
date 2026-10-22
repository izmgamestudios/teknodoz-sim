// Question translations: complete, aligned with the English questionnaires, placeholders intact. Run: node scripts/test-qi18n.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { localizeQuestions } from '../server/results.mjs'

const q = JSON.parse(readFileSync(new URL('../shared/questionnaires.builtin.json', import.meta.url), 'utf8'))
const i18n = JSON.parse(readFileSync(new URL('../shared/questionnaires.i18n.json', import.meta.url), 'utf8'))
const english = new Set()
for (const t of Object.values(q)) for (const x of t.questions) { english.add(x.prompt); for (const o of x.options ?? []) english.add(o.label) }
const digits = (s) => (s.match(/\d/g) ?? []).sort().join('')
for (const lang of ['tr', 'de', 'es']) {
  const map = i18n[lang]
  assert.deepEqual(new Set(Object.keys(map)), english, `${lang}: keys must equal the English strings`)
  let same = 0
  for (const [en, loc] of Object.entries(map)) {
    assert.ok(loc && loc.trim() && !/[\r\n]/.test(loc), `${lang}: empty or multi-line translation for ${en}`)
    assert.equal(digits(loc), digits(en), `${lang}: digits differ for "${en}"`)
    if (loc === en) same++
  }
  assert.ok(same < 60, `${lang}: too many untranslated strings (${same})`) // numbers, "Medicare", "18–24", ...
  const local = localizeQuestions(q['tk_teklif-studyosu_pricing-sensitivity'].questions, lang)
  assert.equal(local.length, q['tk_teklif-studyosu_pricing-sensitivity'].questions.length)
  assert.notEqual(local[0].prompt, q['tk_teklif-studyosu_pricing-sensitivity'].questions[0].prompt)
  assert.deepEqual(local.map((x) => x.id), q['tk_teklif-studyosu_pricing-sensitivity'].questions.map((x) => x.id))
  assert.deepEqual(local.flatMap((x) => (x.options ?? []).map((o) => o.id)), q['tk_teklif-studyosu_pricing-sensitivity'].questions.flatMap((x) => (x.options ?? []).map((o) => o.id)), 'option ids must not change')
}
assert.equal(localizeQuestions(null, 'tr'), null)
assert.deepEqual(localizeQuestions([{ id: 'a', prompt: 'Not in the table', type: 'free_text' }], 'tr'), [{ id: 'a', prompt: 'Not in the table', type: 'free_text' }])
const en = q['tk_teklif-studyosu_pricing-sensitivity'].questions
assert.equal(localizeQuestions(en, 'en'), en)
assert.equal(localizeQuestions(en, '__proto__'), en)
console.log('OK question translations')
