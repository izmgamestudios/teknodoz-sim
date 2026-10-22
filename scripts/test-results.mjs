// Run: node scripts/test-results.mjs  (uses fixtures only; never runs MatrAIx)
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captureSmoke, collectResults, derivePersonaId, loadRunData, parseSmokeArtifactDirs, scanResultFiles, smokeTmpPrefix, snapshotRealRun } from '../server/results.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const envelope = (answers) => ({ instrument: { id: 'x', title: 'x' }, answers, trajectory: [{ timestamp: 't', actor: 'a', action: 'x', context: {}, outcome: {} }], smoke: { mode: 'fake' } })
const answers = (a, b) => [{ questionId: 'q0', value: a }, { questionId: 'q1', value: b, rationale: 'because' }]
const write = (p, o) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, JSON.stringify(o)) }

// ---- smoke capture ----
const base = join(tmpdir(), `matraix-smoke-test${process.pid}`)
assert.ok(base.startsWith(smokeTmpPrefix))
const d1 = join(base, 'persona_00_persona_0042'), d2 = join(base, 'persona_01_persona_0001')
write(join(d1, 'artifacts/app/output/survey_result.json'), envelope(answers(4, 'a')))
write(join(d2, 'artifacts/app/output/survey_result.json'), envelope(answers(2, 'b')))
const log = `\n$ uv run matraix smoke x\nSmoke: ok\nArtifacts:\n  ${d1}\n  ${d2}\nNotes:\n  - Artifacts under ${base}\n`
const run = { id: '11111111-1111-4111-8111-aaaaaaaaaaaa', kind: 'simulation', log, params: { mode: 'smoke', taskId: 'tk_ayak-izi_funnel-dropoff', sampleSize: 2 } }
assert.deepEqual(parseSmokeArtifactDirs(log), [d1, d2])
assert.deepEqual(parseSmokeArtifactDirs('Artifacts:\n  /etc/matraix-smoke-evil\n  /tmp/matraix-smoke-x/../../etc\n'), [])
assert.equal(captureSmoke(run), 2)
assert.ok(!existsSync(base), 'temp dir removed after capture')
const data = loadRunData(run)
assert.equal(data.synthetic, true)
assert.deepEqual(data.sets.map((s) => s.personaId).sort(), ['0001', '0042'])
const res = collectResults(run)
assert.equal(res.n, 2); assert.equal(res.synthetic, true); assert.equal(res.found, true)

// ---- real run snapshot with unknown layout + decoys ----
const jobName = 'teknodoz-test-fixture-n2'
const jobs = join(ROOT, 'vendor/MatrAIx/jobs', jobName)
write(join(jobs, 'trial__TR-001__abc/verifier/result.json'), envelope(answers(5, 'a')))
write(join(jobs, 'trial__DE-002__def/artifacts/anything.json'), envelope(answers(1, 'b')))
write(join(jobs, 'config.json'), { jobName })
write(join(jobs, 'trial__x/result.json'), { answers: [{ nope: 1 }] })
writeFileSync(join(jobs, 'big.json'), JSON.stringify(envelope(answers(3, 'a'))) + ' '.repeat(500_000))
assert.equal(scanResultFiles(jobs).length, 2)
const real = { id: '22222222-2222-4222-8222-bbbbbbbbbbbb', kind: 'simulation', params: { mode: 'auto', taskId: 'tk_ayak-izi_funnel-dropoff', jobName, personaIds: ['TR-001', 'DE-002', 'US-003'] } }
const live = collectResults(real)
assert.equal(live.n, 2); assert.equal(live.synthetic, false)
assert.equal(snapshotRealRun(real), 2)
rmSync(jobs, { recursive: true, force: true })
const after = loadRunData(real)
assert.equal(after.source, 'jobs'); assert.deepEqual(after.sets.map((s) => s.personaId).sort(), ['DE-002', 'TR-001'], 'survives job-dir cleanup, persona ids derived from paths')

// ---- diagnostics when nothing found ----
const empty = { id: '33333333-3333-4333-8333-cccccccccccc', kind: 'simulation', params: { mode: 'auto', taskId: 'x', jobName: 'teknodoz-missing-n1' } }
const none = collectResults(empty)
assert.equal(none.found, false); assert.equal(none.diagnostics.jobDirExists, false)
assert.equal(derivePersonaId('/a/b/0001/c', ['0001', '0042']), '0001')
assert.equal(derivePersonaId('/a/b/10001/c', ['0001']), null, 'numeric ids need a boundary')

for (const id of [run.id, real.id]) rmSync(join(ROOT, 'data/run-results', id), { recursive: true, force: true })
console.log('OK results')
