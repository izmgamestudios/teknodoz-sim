// Run: node scripts/test-export.mjs OUT_DIR  -> writes sample exports for scripts/validate-exports.py (fixtures only)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildReport } from '../server/report.mjs'
import { exportReport, FORMATS } from '../server/export/index.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const out = process.argv[2]
if (!out) throw new Error('usage: node scripts/test-export.mjs OUT_DIR')
mkdirSync(out, { recursive: true })
const DIR = join(ROOT, 'data/run-results')
const ids = []

function fixture(id, personaIds, answerSets, synthetic = false) {
  ids.push(id)
  const dir = join(DIR, id)
  mkdirSync(dir, { recursive: true })
  const files = answerSets.map((answers, i) => {
    const name = `r${String(i + 1).padStart(3, '0')}.json`
    writeFileSync(join(dir, name), JSON.stringify({ answers: Object.entries(answers).map(([questionId, value, ]) => (typeof value === 'object' && !Array.isArray(value) ? { questionId, ...value } : { questionId, value })), trajectory: [] }))
    return { file: name, personaId: personaIds[i] ?? null }
  })
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ synthetic, source: 'test', files }))
}

try {
  // 1) funnel task, country personas, nasty free text, 12 respondents
  const trIds = ['TR-001', 'TR-002', 'TR-003', 'TR-004', 'TR-005', 'TR-006', 'DE-001', 'DE-002', 'DE-003', 'DE-004', 'DE-005', 'DE-006']
  const nasty = ['=cmd|\' /C calc\'!A0', '+SUM(1,1)', '@evil', '-2+3', 'Şğüİıö çok güzel <b>& "quoted"</b> 😀', 'multi\nline, with comma', '日本語のテキスト', '', 'normal', 'normal', 'x'.repeat(400), 'ok']
  fixture('bbbbbbbb-0000-4000-8000-000000000001', trIds, trIds.map((_, i) => ({
    q0: 1 + (i % 5), q1: ['q1_under_5', 'q1_5_to_10', 'q1_10_to_20', 'q1_over_20'][i % 4],
    q2: { value: ['q2_finance', 'q2_finish', 'q2_swot'][i % 3], rationale: nasty[i] || undefined },
    q3: ['q3_save_resume', 'q3_progress'].slice(0, 1 + (i % 2)), q4: 'q4_honest_none', q5: 'q5_truthful', q6: 1 + (i % 5), q7: 'q7_one_go', q8: 5 - (i % 5),
  })))
  // 2) MVT with 10 respondents
  fixture('bbbbbbbb-0000-4000-8000-000000000002', ['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009', '0010'], Array.from({ length: 10 }, (_, i) => ({
    set_1: i % 3 === 0 ? 'set_1_neither' : 'set_1_a', set_2: 'set_2_a', set_3: i % 2 ? 'set_3_b' : 'set_3_a', set_4: 'set_4_b', q_driver: 'q_driver_headline', q_clarity: 4,
  })))
  // 3) pricing (VW) with 40 respondents, smoke-style synthetic flag
  const pidx = Array.from({ length: 40 }, (_, i) => String(i + 1).padStart(4, '0'))
  fixture('bbbbbbbb-0000-4000-8000-000000000003', pidx, pidx.map((_, i) => ({
    vw_too_cheap: String(2 + (i % 8)), vw_bargain: String(5 + (i % 10)), vw_expensive: String(14 + (i % 12)), vw_too_expensive: String(22 + (i % 20)),
    q_model: 'q_model_monthly_pro', q_free_limit: 'q_free_limit_stay_until_limit', q_justify: 'q_justify_save_time', q_lifetime: 'q_lifetime_same', q_intent_pro: 1 + (i % 5), q_fair: 1 + ((i + 2) % 5),
  })), true)

  const runs = [
    ['funnel', 'bbbbbbbb-0000-4000-8000-000000000001', { mode: 'auto', taskId: 'tk_ayak-izi_funnel-dropoff', pool: 'country', model: 'anthropic/claude-sonnet-4-6', seed: 42 }, 'tr', 'Dijital Ayak İzi: Huni Terk Analizi'],
    ['mvt', 'bbbbbbbb-0000-4000-8000-000000000002', { mode: 'auto', taskId: 'tk_teklif-studyosu_mvt-landing-page', pool: 'dev', model: 'm', seed: 1 }, 'en', 'Landing page MVT'],
    ['pricing', 'bbbbbbbb-0000-4000-8000-000000000003', { mode: 'smoke', taskId: 'tk_teklif-studyosu_pricing-sensitivity', pool: 'dev', seed: 1 }, 'de', 'Preissensibilität'],
  ]
  for (const [name, id, params, lang, title] of runs) {
    const report = await buildReport({ id, kind: 'simulation', createdAt: 1792700000000, params }, { lang, title })
    for (const [format, spec] of Object.entries(FORMATS)) {
      writeFileSync(join(out, `${name}-${lang}${spec.suffix ?? ''}.${spec.ext}`), await exportReport(report, format))
    }
  }
  console.log('exports written to', out)
} finally {
  for (const id of ids) rmSync(join(DIR, id), { recursive: true, force: true })
}
