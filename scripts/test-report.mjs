// Run: node scripts/test-report.mjs  (fixtures only; never runs MatrAIx)
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildReport, questionStats, vanWestendorp } from '../server/report.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`)

// ---- Van Westendorp with hand-computed points ----
const vw = vanWestendorp({ tooCheap: [5, 10, 15, 20, 25], cheap: [10, 15, 20, 25, 30], expensive: [30, 35, 40, 45, 50], tooExpensive: [40, 45, 50, 55, 60] })
close(vw.points.opp, 32.5); close(vw.points.ipp, 30); close(vw.points.pmc, 20); close(vw.points.pme, 42.5)
assert.equal(vanWestendorp({ tooCheap: [], cheap: [1], expensive: [2], tooExpensive: [3] }), null)

// ---- question statistics ----
const lk = questionStats({ id: 'q', prompt: 'p', type: 'likert', minValue: 0, maxValue: 10 }, [10, 9, 8, 6, 0].map((value) => ({ value })))
assert.deepEqual(lk.nps, { score: 0, promoters: 40, passives: 20, detractors: 40 })
close(lk.mean, 6.6); assert.equal(lk.median, 8)
const l5 = questionStats({ id: 'q', prompt: 'p', type: 'likert', minValue: 1, maxValue: 5 }, [5, 4, 2, 1].map((value) => ({ value })))
close(l5.top2, 0.5); close(l5.bottom2, 0.5); assert.equal(l5.nps, undefined)
const ch = questionStats({ id: 'q', prompt: 'p', type: 'multi_choice', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, [{ value: ['a', 'b'] }, { value: ['a'] }, { value: ['a'] }])
assert.equal(ch.top.id, 'a'); close(ch.options[0].share, 1); close(ch.options[1].share, 0.333, 1e-3)

// ---- end-to-end fixtures via a snapshot ----
const DIR = join(ROOT, 'data/run-results')
function fixture(id, personaIds, answerSets, synthetic = false) {
  const dir = join(DIR, id)
  mkdirSync(dir, { recursive: true })
  const files = answerSets.map((answers, i) => {
    const name = `r${String(i + 1).padStart(3, '0')}.json`
    writeFileSync(join(dir, name), JSON.stringify({ answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })), trajectory: [] }))
    return { file: name, personaId: personaIds[i] ?? null }
  })
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ synthetic, source: 'test', files }))
}
const ids = []
try {
  // MVT: respondent 1 picks a,a,b,b ; respondent 2 picks neither on set_1 then a,a,b
  ids.push('aaaaaaaa-0000-4000-8000-000000000001')
  fixture(ids[0], ['0001', '0002'], [
    { set_1: 'set_1_a', set_2: 'set_2_a', set_3: 'set_3_b', set_4: 'set_4_b' },
    { set_1: 'set_1_neither', set_2: 'set_2_a', set_3: 'set_3_a', set_4: 'set_4_b' },
  ])
  const mvt = await buildReport({ id: ids[0], kind: 'simulation', createdAt: 1792700000000, params: { mode: 'auto', taskId: 'tk_teklif-studyosu_mvt-landing-page', model: 'm', pool: 'dev', seed: 1 } }, { lang: 'en' })
  const a = mvt.analyses[0]
  assert.equal(a.type, 'mvt'); assert.equal(a.answered, 8)
  assert.equal(a.neither.count, 1); close(a.neither.rate, 0.125)
  // headline level 0 is chosen in sets 1,2,3,4 by respondent 1 (rate counts shown/chosen across both respondents)
  const headline = a.attributes[0].levels
  assert.equal(headline[0].shown + headline[1].shown, 14, '7 non-neither answers x 2 profiles')
  assert.ok(headline[0].rate > headline[1].rate)
  assert.ok(mvt.findings.some((f) => /Headline/.test(f)))
  assert.ok(mvt.notices.some((n) => /Small sample/.test(n.text)))

  // VW + localisation (Turkish)
  ids.push('aaaaaaaa-0000-4000-8000-000000000002')
  const vals = [[5, 10, 30, 40], [10, 15, 35, 45], [15, 20, 40, 50], [20, 25, 45, 55], [25, 30, 50, 60]]
  fixture(ids[1], vals.map((_, i) => `000${i + 1}`), vals.map(([a, b, c, d]) => ({ vw_too_cheap: String(a), vw_bargain: `$${b}`, vw_expensive: `${c},0`, vw_too_expensive: `${d} USD` })), true)
  const price = await buildReport({ id: ids[1], kind: 'simulation', createdAt: 1792700000000, params: { mode: 'smoke', taskId: 'tk_teklif-studyosu_pricing-sensitivity', pool: 'dev' } }, { lang: 'tr', title: 'Fiyat testi' })
  const v = price.analyses[0]
  assert.equal(v.type, 'vw'); assert.deepEqual(v.n, { tooCheap: 5, cheap: 5, expensive: 5, tooExpensive: 5 })
  close(v.points.opp, 32.5); close(v.points.pmc, 20); close(v.points.pme, 42.5)
  assert.equal(price.title, 'Fiyat testi'); assert.equal(price.meta.synthetic, true)
  assert.ok(price.notices[0].text.includes('SAHTE'), 'synthetic warning is localised and first')
  assert.ok(price.findings.some((f) => f.includes('Kabul edilebilir fiyat aralığı')))
  assert.ok(price.notices.some((n) => n.text.includes('en az 30')))
  assert.equal(price.respondents.length, 5)

  // generic funnel task with persona segments (dev personas 0001..0006)
  ids.push('aaaaaaaa-0000-4000-8000-000000000003')
  const pid = ['0001', '0002', '0003', '0004', '0005', '0006']
  fixture(ids[2], pid, pid.map((_, i) => ({ q0: i < 3 ? 5 : 1, q1: i % 2 ? 'q1_5_to_10' : 'q1_under_5', q3: ['q3_save_resume'], q8: 3 })))
  const fun = await buildReport({ id: ids[2], kind: 'simulation', createdAt: 1792700000000, params: { mode: 'auto', taskId: 'tk_ayak-izi_funnel-dropoff', pool: 'dev', model: 'x' } }, { lang: 'de' })
  assert.equal(fun.meta.respondents, 6)
  assert.ok(fun.questions.find((q) => q.id === 'q0').mean === 3)
  assert.ok(fun.findings.some((f) => f.startsWith('„')), 'German quotation marks')
  assert.ok(fun.sections.questions === 'Ergebnisse je Frage')
  assert.equal(fun.respondents[0].labels.q3, 'Save and resume later')

  // empty run
  const empty = await buildReport({ id: 'aaaaaaaa-0000-4000-8000-0000000000ff', kind: 'simulation', params: { mode: 'auto', taskId: 'x', jobName: 'teknodoz-none-n1' } }, { lang: 'es' })
  assert.equal(empty.meta.respondents, 0); assert.ok(empty.notices.some((n) => /No se encontraron/.test(n.text)))
} finally {
  for (const id of ids) rmSync(join(DIR, id), { recursive: true, force: true })
}
console.log('OK report')
