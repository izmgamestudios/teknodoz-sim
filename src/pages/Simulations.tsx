import { useMemo, useState } from 'react'
import { ApiError, api } from '../api'
import { useAuth } from '../auth'
import { useSelection } from '../selection'
import RunList from '../components/RunList'
import type { PageId } from '../config'
import { useI18n } from '../i18n'
import { KINDS, MODELS, TASKS, type TaskKind } from '../tasks'

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const input =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950'

export default function Simulations({ go }: { go: (p: PageId) => void }) {
  const { t } = useI18n()
  const { admin, loading } = useAuth()
  const { ids, clear } = useSelection()
  const [kind, setKind] = useState<TaskKind | 'all'>('all')
  const [taskId, setTaskId] = useState(TASKS[0].id)
  const [sampleSize, setSampleSize] = useState(4)
  const [seed, setSeed] = useState(42)
  const [model, setModel] = useState(MODELS[0])
  const [mode, setMode] = useState<'smoke' | 'auto'>('smoke')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  const visible = useMemo(() => TASKS.filter((x) => kind === 'all' || x.kind === kind), [kind])
  const task = TASKS.find((x) => x.id === taskId) ?? TASKS[0]
  const text = t.tasks[task.id]

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/runs', { method: 'POST', body: { taskId, sampleSize, seed, model, mode, personaIds: mode === 'auto' ? ids : [] } })
      setTick((n) => n + 1)
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'server_error'
      setError(t.sim.errors[code] ?? t.sim.errors.server_error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="max-w-3xl">
      <h1 className="text-2xl font-bold">{t.sim.title}</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">{t.sim.intro}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['all', ...KINDS] as (TaskKind | 'all')[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k)
              const first = TASKS.find((x) => k === 'all' || x.kind === k)
              if (first) setTaskId(first.id)
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              kind === k ? 'bg-brand text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {k === 'all' ? t.sim.all : t.kinds[k]}
          </button>
        ))}
      </div>

      <div className={`${card} mt-4 grid gap-4 sm:grid-cols-2`}>
        <label className="text-sm sm:col-span-2">
          {t.sim.task}
          <select className={input} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            {visible.map((x) => (
              <option key={x.id} value={x.id}>
                {t.tasks[x.id]?.title ?? x.id}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-950 sm:col-span-2">
          <span className="mr-2 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand-dark dark:text-indigo-300">
            {t.kinds[task.kind]}
          </span>
          {text?.desc}
          {task.needsDocker && <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{t.sim.dockerWarn}</p>}
        </div>
        <div className="text-sm sm:col-span-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
          {ids.length > 0 ? (
            <>
              {t.sim.selectedPersonas.replace('{n}', String(ids.length))}{' '}
              <button type="button" onClick={clear} className="text-brand underline">{t.sim.clearSelection}</button>
            </>
          ) : (
            <button type="button" onClick={() => go('personas')} className="text-brand underline">{t.sim.pickPersonas}</button>
          )}
        </div>
        <label className="text-sm">
          {t.sim.personas}
          <input className={input} type="number" min={1} max={100} value={sampleSize}
            onChange={(e) => setSampleSize(Math.max(1, Math.min(100, Math.trunc(Number(e.target.value)) || 1)))} />
        </label>
        <label className="text-sm">
          {t.sim.seed}
          <input className={input} type="number" min={0} value={seed}
            onChange={(e) => setSeed(Math.max(0, Math.trunc(Number(e.target.value)) || 0))} />
        </label>
        <label className="text-sm">
          {t.sim.model}
          <select className={input} value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-sm">
          {t.sim.mode}
          <select className={input} value={mode} onChange={(e) => setMode(e.target.value as 'smoke' | 'auto')}>
            <option value="smoke">{t.sim.modeSmoke}</option>
            <option value="auto">{t.sim.modeAuto}</option>
          </select>
        </label>
      </div>

      {!loading && !admin ? (
        <div className={`${card} mt-4`}>
          <div className="font-medium">{t.sim.loginTitle}</div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.sim.loginText}</p>
          <button type="button" onClick={() => go('admin')} className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
            {t.sim.goLogin}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={busy || loading}
            onClick={start}
            className="mt-4 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? t.sim.starting : t.sim.start}
          </button>
          {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
          <h2 className="mb-3 mt-8 text-lg font-semibold">{t.sim.history}</h2>
          <RunList refreshKey={tick} />
        </>
      )}
    </section>
  )
}
