import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './paths.mjs'
import { loadCountryPool } from './countries.mjs'
import { toMatraixCustomPersona, toMatraixPersona, toYaml } from './personagen.mjs'
import { loadCustomPersonas } from './custompersonas.mjs'
import { getStudy, STUDY_ID_RE, syncStudyTask } from './studies.mjs'
import { captureSmoke, snapshotRealRun } from './results.mjs'
import { randomUUID } from 'node:crypto'

export { ROOT }
export const MATRAIX_DIR = join(ROOT, 'vendor', 'MatrAIx')
const DATA_DIR = join(ROOT, 'data')
const CUSTOM_TASKS_DIR = join(ROOT, 'custom-tasks')
const RUNS_FILE = join(DATA_DIR, 'runs.json')
const MATRAIX_REPO = 'https://github.com/MatrAIx-ai/MatrAIx-Persona-8B'
const MAX_LOG = 200_000
const MAX_RUNS = 50
const RUN_TIMEOUT_MS = 2 * 60 * 60 * 1000

const catalog = JSON.parse(readFileSync(join(ROOT, 'shared', 'tasks.json'), 'utf8'))
const TASK_IDS = new Set(catalog.tasks.map((t) => t.id))
const MODELS = new Set(catalog.models)
const DEV_PERSONA_IDS = new Set(
  JSON.parse(readFileSync(join(ROOT, 'shared', 'personas.json'), 'utf8')).personas.map((x) => x.id),
)

const datasetRel = (pool) => `persona/datasets/teknodoz-${pool}`
const SECRET_ENV = ['ADMIN_PASSWORD_HASH', 'SESSION_SECRET']

function childEnv() {
  const env = { ...process.env }
  for (const k of SECRET_ENV) delete env[k]
  env.PATH = `${process.env.HOME}/.local/bin:${process.env.PATH}`
  return env
}

const runs = new Map()
let current = null

function load() {
  try {
    for (const r of JSON.parse(readFileSync(RUNS_FILE, 'utf8'))) {
      if (r.status === 'running' || r.status === 'queued') {
        r.status = 'failed'
        r.endedAt = r.endedAt ?? Date.now()
        r.log += '\n[server restarted]\n'
      }
      runs.set(r.id, r)
    }
  } catch {
    /* no history yet */
  }
}

function persist() {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    const all = [...runs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_RUNS)
    writeFileSync(RUNS_FILE, JSON.stringify(all))
    for (const id of [...runs.keys()]) if (!all.some((r) => r.id === id)) runs.delete(id)
  } catch {
    /* non-fatal */
  }
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
export const jobNameFor = (taskId, n) => `teknodoz-${slug(taskId)}-n${n}`

export function stepsFor(kind, p) {
  if (kind === 'setup') {
    const steps = []
    if (!existsSync(MATRAIX_DIR)) {
      steps.push({ cmd: 'git', args: ['clone', '--depth', '1', MATRAIX_REPO, MATRAIX_DIR], cwd: ROOT })
    }
    if (!existsSync(join(MATRAIX_DIR, '.venv'))) {
      steps.push({ cmd: 'uv', args: ['venv', '--python', '3.12'], cwd: MATRAIX_DIR })
    }
    steps.push({ cmd: 'uv', args: ['pip', 'install', '-e', '.'], cwd: MATRAIX_DIR })
    return steps
  }
  const task = `application/tasks/${p.taskId}`
  if (p.mode === 'smoke') {
    const n = Math.min(200, Math.max(1, p.sampleSize))
    return [{ cmd: 'uv', args: ['run', 'matraix', 'smoke', task, '--personas', String(n), '--keep-artifacts'], cwd: MATRAIX_DIR }]
  }
  const name = jobNameFor(p.taskId, p.sampleSize)
  return [
    {
      cmd: 'uv',
      args: [
        'run', 'python', 'application/scripts/generate_application_job.py',
        '--task', task, '--execution-mode', 'auto',
        ...(p.personaIds.length ? [] : ['--sample-size', String(p.sampleSize)]),
        '--seed', String(p.seed), '--model-name', p.model, '--name', name,
        ...(p.pool !== 'dev' && p.personaIds.length ? ['--dataset', datasetRel(p.pool)] : []),
        ...(p.personaIds.length ? ['--persona-ids', ...p.personaIds] : []),
      ],
      cwd: MATRAIX_DIR,
    },
    {
      cmd: 'uv',
      args: ['run', 'matraix', 'run', '-c', `configs/jobs/application-task-job-recipe/${name}.yaml`],
      cwd: MATRAIX_DIR,
    },
  ]
}

function append(run, text) {
  run.log = (run.log + text).slice(-MAX_LOG)
}

function runStep(run, step) {
  return new Promise((resolve) => {
    append(run, `\n$ ${step.cmd} ${step.args.join(' ')}\n`)
    let child
    try {
      child = spawn(step.cmd, step.args, { cwd: step.cwd, env: childEnv(), detached: true, shell: false })
    } catch (e) {
      append(run, `spawn error: ${e.message}\n`)
      return resolve(1)
    }
    run.pid = child.pid
    const timer = setTimeout(() => killGroup(child.pid), RUN_TIMEOUT_MS)
    child.stdout.on('data', (d) => append(run, d.toString()))
    child.stderr.on('data', (d) => append(run, d.toString()))
    child.on('error', (e) => {
      append(run, `error: ${e.message}\n`)
      clearTimeout(timer)
      resolve(1)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code ?? 1)
    })
  })
}

function killGroup(pid) {
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    /* already gone */
  }
}

export function writePoolDataset(run) {
  const { personaIds = [], pool, mode } = run.params
  if ((pool !== 'country' && pool !== 'custom') || mode !== 'auto' || !personaIds.length || !existsSync(MATRAIX_DIR)) return
  const rel = datasetRel(pool)
  const dir = join(MATRAIX_DIR, rel)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const { meta, countries, personas } = loadCountryPool()
  const byCountry = Object.fromEntries(countries.map((c) => [c.iso2, c]))
  const source = pool === 'country' ? new Map(personas.map((x) => [x.id, x])) : new Map(loadCustomPersonas().map((x) => [x.id, x]))
  const entries = []
  for (const id of personaIds) {
    const p = source.get(id)
    const obj = pool === 'country' ? toMatraixPersona(p, byCountry[p.c], { source: meta.source, asOf: meta.asOf }) : toMatraixCustomPersona(p, p.c ? byCountry[p.c] : null)
    writeFileSync(join(dir, `persona_${id}.yaml`), toYaml(obj) + '\n')
    entries.push({ persona_id: id, path: `${rel}/persona_${id}.yaml`, source: obj.source, display_name: obj.display_name, dimensions: obj.dimensions })
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ kind: `teknodoz-${pool}-sample`, count: entries.length, schema_version: '1.0', personas: entries }))
  append(run, `[wrote ${entries.length} ${pool} personas to ${rel}]\n`)
}

export function syncCustomTasks(run) {
  const dest = join(MATRAIX_DIR, 'application', 'tasks')
  if (!existsSync(CUSTOM_TASKS_DIR) || !existsSync(dest)) return
  try {
    const names = readdirSync(CUSTOM_TASKS_DIR)
    for (const name of names) cpSync(join(CUSTOM_TASKS_DIR, name), join(dest, name), { recursive: true, force: true })
    append(run, `[synced ${names.length} Teknodoz custom tasks]\n`)
  } catch (e) {
    append(run, `custom task sync failed: ${e.message}\n`)
  }
}

async function execute(run) {
  current = run
  run.status = 'running'
  run.startedAt = Date.now()
  try {
    if (run.kind === 'simulation') {
      syncCustomTasks(run)
      if (syncStudyTask(run.params.taskId, join(MATRAIX_DIR, 'application', 'tasks'))) append(run, '[synced study task]\n')
      writePoolDataset(run)
    }
    for (const step of stepsFor(run.kind, run.params)) {
      const code = await runStep(run, step)
      if (run.status === 'canceled') return
      if (code !== 0) {
        run.status = 'failed'
        return
      }
    }
    if (run.kind === 'setup') syncCustomTasks(run)
    if (run.kind === 'simulation') {
      const n = run.params.mode === 'smoke' ? captureSmoke(run) : snapshotRealRun(run)
      append(run, n ? `\n[kept ${n} result file(s) for the report${run.params.mode === 'smoke' ? ' (synthetic, from the fake client)' : ''}]\n` : '\n[no result files found yet for the report]\n')
    }
    run.status = 'done'
  } finally {
    run.endedAt = Date.now()
    run.pid = undefined
    current = null
    persist()
  }
}

export function validate(body) {
  const taskId = String(body?.taskId ?? '')
  const sampleSize = Number(body?.sampleSize)
  const seed = Number(body?.seed)
  const model = String(body?.model ?? '')
  const mode = body?.mode === 'auto' ? 'auto' : 'smoke'
  const rawIds = Array.isArray(body?.personaIds) ? body.personaIds : []
  if (rawIds.length > 100 || !rawIds.every((id) => typeof id === 'string')) return { error: 'invalid_personas' }
  const personaIds = [...new Set(rawIds)]
  let pool = 'dev'
  if (personaIds.length) {
    if (personaIds.every((id) => DEV_PERSONA_IDS.has(id))) pool = 'dev'
    else {
      const countryIds = new Set(loadCountryPool().personas.map((x) => x.id))
      const customIds = new Set(loadCustomPersonas().map((x) => x.id))
      if (personaIds.every((id) => countryIds.has(id))) pool = 'country'
      else if (personaIds.every((id) => customIds.has(id))) pool = 'custom'
      else return { error: 'invalid_personas' }
    }
  }
  if (!TASK_IDS.has(taskId) && !(STUDY_ID_RE.test(taskId) && getStudy(taskId))) return { error: 'invalid_task' }
  if (!Number.isInteger(sampleSize) || sampleSize < 1 || sampleSize > 100) return { error: 'invalid_sample_size' }
  if (!Number.isInteger(seed) || seed < 0 || seed > 1_000_000_000) return { error: 'invalid_seed' }
  if (!MODELS.has(model)) return { error: 'invalid_model' }
  return { params: { taskId, sampleSize: personaIds.length || sampleSize, seed, model, mode, personaIds, pool } }
}

export const isBusy = () => Boolean(current)

/** Validate run options without a task (used when the task is created afterwards). */
export function validateRunOptions(body) {
  return validate({ ...body, taskId: catalog.tasks[0].id })
}

export function startRun(kind, params) {
  if (current) return { error: 'busy' }
  if (kind === 'simulation') {
    params = { ...params, jobName: jobNameFor(params.taskId, params.sampleSize) }
    if (STUDY_ID_RE.test(params.taskId)) params.title = getStudy(params.taskId)?.title
  }
  const run = {
    id: randomUUID(), kind, params, status: 'queued', createdAt: Date.now(), log: '',
  }
  runs.set(run.id, run)
  execute(run)
  return { run }
}

export const summarize = ({ log, pid, ...rest }) => rest
export const listRuns = () => [...runs.values()].sort((a, b) => b.createdAt - a.createdAt).map(summarize)
export const getRun = (id) => runs.get(id)

export function cancelRun(id) {
  const run = runs.get(id)
  if (!run || run.status !== 'running') return false
  run.status = 'canceled'
  append(run, '\n[canceled]\n')
  if (run.pid) killGroup(run.pid)
  return true
}

function probe(cmd, args) {
  return new Promise((resolve) => {
    try {
      const c = spawn(cmd, args, { env: childEnv(), timeout: 5000 })
      c.on('error', () => resolve(false))
      c.on('close', (code) => resolve(code === 0))
    } catch {
      resolve(false)
    }
  })
}

export async function systemStatus() {
  const [uv, docker] = await Promise.all([probe('uv', ['--version']), probe('docker', ['--version'])])
  return {
    uv,
    docker,
    matraixDir: existsSync(MATRAIX_DIR),
    venv: existsSync(join(MATRAIX_DIR, '.venv')),
    anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    openaiKey: Boolean(process.env.OPENAI_API_KEY),
    busy: Boolean(current),
  }
}

load()
