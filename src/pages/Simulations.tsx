import { useMemo, useState } from 'react'
import { KIND_LABELS, MODELS, TASKS, buildCommands, type TaskKind } from '../tasks'

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950'

export default function Simulations() {
  const [kind, setKind] = useState<TaskKind | 'all'>('all')
  const [taskId, setTaskId] = useState(TASKS[0].id)
  const [sampleSize, setSampleSize] = useState(4)
  const [seed, setSeed] = useState(42)
  const [model, setModel] = useState<string>(MODELS[0])
  const [mode, setMode] = useState<'auto' | 'smoke'>('smoke')
  const [copied, setCopied] = useState(false)

  const visible = useMemo(() => TASKS.filter((x) => kind === 'all' || x.kind === kind), [kind])
  const task = TASKS.find((x) => x.id === taskId) ?? TASKS[0]
  const script = buildCommands({ task, sampleSize, seed, model, mode }).join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section className="max-w-3xl">
      <h1 className="text-2xl font-bold">Simülasyonlar</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">
        MatrAIx persona motoru ile görev seç, komutu üret, sunucuda çalıştır.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['all', ...Object.keys(KIND_LABELS)] as (TaskKind | 'all')[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k)
              const first = TASKS.find((x) => k === 'all' || x.kind === k)
              if (first) setTaskId(first.id)
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              kind === k
                ? 'bg-brand text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {k === 'all' ? 'Tümü' : KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <div className={`${card} mt-4 grid gap-4 sm:grid-cols-2`}>
        <label className="sm:col-span-2 text-sm">
          Görev
          <select className={`${input} mt-1`} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            {visible.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Persona sayısı
          <input className={`${input} mt-1`} type="number" min={1} max={200} value={sampleSize}
            onChange={(e) => setSampleSize(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
        </label>
        <label className="text-sm">
          Seed
          <input className={`${input} mt-1`} type="number" value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)} />
        </label>
        <label className="text-sm">
          Model
          <select className={`${input} mt-1`} value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Mod
          <select className={`${input} mt-1`} value={mode} onChange={(e) => setMode(e.target.value as 'auto' | 'smoke')}>
            <option value="smoke">Smoke test (API key gerekmez)</option>
            <option value="auto">Gerçek çalıştırma (API key gerekir)</option>
          </select>
        </label>
      </div>

      {task.needsDocker && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
          Bu görev Docker gerektirir (sunucuda kurulu olmalı ve kullanıcı docker grubunda olmalı).
        </p>
      )}

      <div className={`${card} mt-4`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Sunucuda çalıştır: ~/app/vendor/MatrAIx
          </span>
          <button type="button" onClick={copy} className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white">
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre text-xs leading-relaxed">{script}</pre>
        {mode === 'auto' && (
          <p className="mt-3 text-xs text-slate-500">
            Önce sunucuda <code>export ANTHROPIC_API_KEY=...</code> ayarla (key'i repo'ya koyma).
          </p>
        )}
      </div>
    </section>
  )
}
