// Run: node scripts/test-custompersonas.mjs  (fixtures only)
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clearCustomPersonas, importPersonaCsv, loadCustomPersonas, parsePersonaCsv } from '../server/custompersonas.mjs'
import { writePoolDataset } from '../server/runner.mjs'
import { buildReport } from '../server/report.mjs'

const ROOT = new URL('..', import.meta.url).pathname

// ---- multilingual values, aliases, quoting ----
const csv = [
  'id,name,country,age,gender,life_stage,spending,risk,employment,income,setting,language,description,internet',
  'a1,Ayşe,TR,25-34,Kadın,Kariyer başı,Değer odaklı,Temkinli,Tam zamanlı,Orta,Yoğun kentsel,Turkish,"Freelance designer, loves ""clean"" tools\nworks from cafés",evet',
  ',Hans,DE,45–54,Mann,Lebensmitte,Preissensibel,Risikoscheu,Teilzeit,Obere Mitte,Vorstädtisch,German,,ja',
  'x3,,US,18-24,Woman,Student,Cost-sensitive,Risk-seeking,Student,Low income,Rural,,,no',
  ',Lola,,65-74,Mujer,Jubilación,Indiferente,Aversión al riesgo,Jubilado,Ingresos bajos,Pueblo pequeño,,,0',
].join('\n')
let r = await parsePersonaCsv(csv)
assert.deepEqual(r.errors, [], JSON.stringify(r.errors))
assert.equal(r.personas.length, 4)
const [a, h, u, l] = r.personas
assert.equal(a.id, 'CU-A1'); assert.equal(a.c, 'TR'); assert.equal(a.l, 'turkish')
assert.deepEqual(a.d, { age_bracket: '25-34', gender_identity: 'Woman', life_stage: 'Early career', economic_motivation: 'Value-driven', risk_tolerance: 'Cautious', demo_employment_status: 'Full-time', socioeconomic_band: 'Middle', urbanicity: 'Dense urban', region: 'MENA' })
assert.ok(a.x.includes('"clean"') && a.x.includes('\n'), 'quotes and newline kept')
assert.equal(h.id, 'CU-001'); assert.equal(h.d.age_bracket, '45-54', 'en dash accepted'); assert.equal(h.d.demo_employment_status, 'Part-time'); assert.equal(h.d.region, 'Western Europe')
assert.equal(u.i, 0); assert.equal(l.d.life_stage, 'Retirement'); assert.equal(l.d.economic_motivation, 'Indifferent'); assert.equal(l.c, null); assert.equal(l.i, 0)

// ---- errors are reported per row/field and nothing is accepted partially by import ----
r = await parsePersonaCsv('age,country,risk,id,description\n99-100,TR,Cautious,,\n25-34,XX,Cautious,,\n25-34,TR,Brave,,\n25-34,TR,Cautious,bad id!,\n25-34,TR,Cautious,dup,\n35-44,TR,Cautious,dup,\n,,,,only a description\n25-34,TR,Cautious,,' + 'x'.repeat(601))
const byRow = Object.fromEntries(r.errors.map((e) => [`${e.row}:${e.field}`, e.message]))
assert.equal(byRow['2:age_bracket'], 'invalid_value'); assert.equal(byRow['3:country'], 'unknown_country'); assert.equal(byRow['4:risk_tolerance'], 'invalid_value')
assert.equal(byRow['5:id'], 'invalid_id'); assert.equal(byRow['7:id'], 'duplicate_id'); assert.equal(byRow['8:'], 'empty_row'); assert.equal(byRow['9:description'], 'too_long') // row numbers are data records (blank lines are skipped)
assert.equal(r.personas.length, 1, 'only the valid row (dup #1) parses')
assert.match((await parsePersonaCsv('')).errors[0].message, /empty/)
assert.equal((await parsePersonaCsv('foo,bar\n1,2')).errors[0].message, 'no_known_columns')
assert.ok((await parsePersonaCsv('age,mystery\n25-34,x')).warnings.some((w) => w.message === 'unknown_column'))
assert.equal((await parsePersonaCsv('age\n' + Array(501).fill('25-34').join('\n'))).errors.at(-1).message, 'too_many')

// ---- store: append / replace / clear ----
clearCustomPersonas()
let imp = await importPersonaCsv(csv, 'replace')
assert.equal(imp.saved, 4); assert.equal(loadCustomPersonas().length, 4)
const bad = await importPersonaCsv('age\nnope', 'append')
assert.equal(bad.saved, 0); assert.equal(loadCustomPersonas().length, 4, 'invalid import changes nothing')
imp = await importPersonaCsv('age,country\n25-34,TR\n35-44,DE', 'append')
assert.equal(imp.total, 6); assert.deepEqual(loadCustomPersonas().slice(4).map((p) => p.id), ['CU-003', 'CU-004'], 'auto ids continue after the highest existing number')
assert.equal((await importPersonaCsv('id,age\na1,25-34', 'append')).errors[0].message, 'duplicate_id')

// ---- MatrAIx dataset written for a run, read back with PyYAML and checked against the schema ----
const run = { id: 'x', log: '', params: { personaIds: ['CU-A1', 'CU-001', 'CU-002'], pool: 'custom', mode: 'auto' } }
writePoolDataset(run)
const dir = join(ROOT, 'vendor/MatrAIx/persona/datasets/teknodoz-custom')
const py = `
import json, yaml, sys, os
d = sys.argv[1]; enums = json.load(open(sys.argv[2]))
man = json.load(open(d + '/manifest.json'))
assert man['count'] == 3 and [p['persona_id'] for p in man['personas']] == ['CU-A1', 'CU-001', 'CU-002']
for p in man['personas']:
    y = yaml.safe_load(open(os.path.join(sys.argv[3], p['path']), encoding='utf-8'))
    assert y['persona_id'] == p['persona_id'] and y['system_prompt'] and y['source'] == 'teknodoz-import'
    for k, v in y['dimensions'].items():
        if k in enums: assert v in enums[k], (k, v)
a = yaml.safe_load(open(d + '/persona_CU-A1.yaml', encoding='utf-8'))
assert a['display_name'] == 'Ayşe' and 'Freelance designer' in a['system_prompt'] and 'Türkiye' in a['system_prompt'] and a['dimensions']['lang_turkish'] == 'Native'
print('yaml ok')
`
const out = execFileSync('python3', ['-I', '-c', py, dir, join(ROOT, 'shared/persona-enums.json'), join(ROOT, 'vendor/MatrAIx')], { encoding: 'utf8' })
assert.match(out, /yaml ok/)
rmSync(dir, { recursive: true, force: true })

// ---- report segments for a custom-pool run ----
const rid = 'dddddddd-0000-4000-8000-000000000001'
const rdir = join(ROOT, 'data/run-results', rid)
mkdirSync(rdir, { recursive: true })
const ids = ['CU-A1', 'CU-001', 'CU-002', 'CU-003']
ids.forEach((_, i) => writeFileSync(join(rdir, `r00${i + 1}.json`), JSON.stringify({ answers: [{ questionId: 'q0', value: 1 + i }], trajectory: [] })))
writeFileSync(join(rdir, 'index.json'), JSON.stringify({ synthetic: false, source: 'test', files: ids.map((personaId, i) => ({ file: `r00${i + 1}.json`, personaId })) }))
const rep = await buildReport({ id: rid, kind: 'simulation', params: { mode: 'auto', taskId: 'tk_ayak-izi_funnel-dropoff', pool: 'custom', model: 'm' } }, { lang: 'tr' })
assert.equal(rep.meta.pool, 'İçe aktarılan')
assert.ok(rep.segments.some((s) => s.facet === 'country'), 'country segments from custom personas')
rmSync(rdir, { recursive: true, force: true })
clearCustomPersonas()
console.log('OK custom personas')
