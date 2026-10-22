import { useEffect, useState } from 'react'
import { api, type RunSummary, type SystemStatus } from '../api'
import { useAuth } from '../auth'
import type { PageId } from '../config'
import { LANGS, useI18n } from '../i18n'
import { usePersonas } from '../personas'
import { KINDS, TASKS } from '../tasks'

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const LEVEL_AT = [0, 5, 20]

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={card}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

export default function Dashboard({ go }: { go: (p: PageId) => void }) {
  const { t } = useI18n()
  const { admin, loading } = useAuth()
  const personas = usePersonas()
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [status, setStatus] = useState<SystemStatus | null>(null)

  useEffect(() => {
    if (!admin) return
    api<{ runs: RunSummary[] }>('/api/runs').then((r) => setRuns(r.runs)).catch(() => setRuns(null))
    api<SystemStatus>('/api/status').then(setStatus).catch(() => setStatus(null))
  }, [admin])

  const sims = (runs ?? []).filter((r) => r.kind === 'simulation')
  const finished = sims.filter((r) => r.status === 'done' || r.status === 'failed')
  const done = sims.filter((r) => r.status === 'done').length
  const last = sims[0]
  const level = LEVEL_AT.filter((n) => done >= n).length - 1
  const nextAt = LEVEL_AT[level + 1]
  const kindCounts = KINDS.map((k) => ({ k, n: TASKS.filter((x) => x.kind === k).length }))
  const max = Math.max(...kindCounts.map((x) => x.n))
  const ready = status && status.uv && status.matraixDir && status.venv && (status.anthropicKey || status.openaiKey)

  return (
    <section className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t.dashboard.title}</h1>
        <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">{t.dashboard.text}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => go('runs')} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
            {t.dashboard.ctaRun}
          </button>
          <button type="button" onClick={() => go('personas')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">
            {t.dashboard.ctaPersonas}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.dashboard.stats.tasks} value={String(TASKS.length)} />
        <Stat label={t.dashboard.stats.personas} value={personas ? String(personas.personas.length) : '…'} />
        <Stat label={t.dashboard.stats.langs} value={String(Object.keys(LANGS).length)} />
        {admin ? (
          <Stat label={t.dashboard.stats.runs} value={String(sims.length)} />
        ) : (
          <Stat label={t.dashboard.stats.runs} value="—" />
        )}
      </div>

      {admin ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className={card}>
            <h2 className="font-semibold">{t.dashboard.level.title}: {t.dashboard.level.names[level]}</h2>
            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full rounded-full bg-brand" style={{ width: `${nextAt ? ((done - LEVEL_AT[level]) / (nextAt - LEVEL_AT[level])) * 100 : 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {nextAt
                ? t.dashboard.level.next.replace('{n}', String(nextAt - done)).replace('{level}', t.dashboard.level.names[level + 1])
                : t.dashboard.level.max}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">{t.dashboard.stats.success}</dt>
                <dd className="font-semibold">{finished.length ? `${Math.round((done / finished.length) * 100)}%` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t.dashboard.stats.last}</dt>
                <dd className="font-semibold">{last ? new Date(last.createdAt).toLocaleDateString() : t.dashboard.stats.never}</dd>
              </div>
            </dl>
          </div>
          <div className={card}>
            <h2 className="font-semibold">{t.dashboard.ready.title}</h2>
            <p className={`mt-2 text-sm ${ready ? 'text-emerald-500' : 'text-amber-500'}`}>
              {status === null ? '…' : ready ? `✓ ${t.dashboard.ready.ok}` : `! ${t.dashboard.ready.missing}`}
            </p>
            {!ready && (
              <button type="button" onClick={() => go('admin')} className="mt-3 text-sm text-brand underline">
                {t.dashboard.ready.go}
              </button>
            )}
          </div>
        </div>
      ) : (
        !loading && (
          <button type="button" onClick={() => go('admin')} className={`${card} w-full text-left text-sm text-slate-500`}>
            {t.dashboard.loginHint}
          </button>
        )
      )}

      <div className={card}>
        <h2 className="mb-3 font-semibold">{t.dashboard.kindsTitle}</h2>
        <ul className="space-y-2">
          {kindCounts.map(({ k, n }) => (
            <li key={k} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
              <span>{t.kinds[k]}</span>
              <span className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="text-right text-slate-500">{n}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">{t.dashboard.stepsTitle}</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {t.dashboard.steps.map((s) => (
            <li key={s.t} className={card}>
              <div className="font-medium">{s.t}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
