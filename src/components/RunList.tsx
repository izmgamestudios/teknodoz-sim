import { useCallback, useEffect, useState } from 'react'
import { api, type RunDetail, type RunStatus, type RunSummary } from '../api'
import { useI18n } from '../i18n'
import ResultsView from './ResultsView'

const badge: Record<RunStatus, string> = {
  queued: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  canceled: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
}

export default function RunList({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useI18n()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [view, setView] = useState<'log' | 'results'>('log')

  const load = useCallback(async () => {
    try {
      setRuns((await api<{ runs: RunSummary[] }>('/api/runs')).runs)
      if (openId) setDetail(await api<RunDetail>(`/api/runs/${openId}`))
    } catch {
      /* session may have expired; page-level gate handles it */
    }
  }, [openId])

  useEffect(() => {
    load()
    const id = setInterval(load, 2500)
    return () => clearInterval(id)
  }, [load, refreshKey])

  const cancel = async (id: string) => {
    await api(`/api/runs/${id}/cancel`, { method: 'POST', body: {} }).catch(() => undefined)
    load()
  }

  if (runs.length === 0) return <p className="text-sm text-slate-500">{t.sim.noRuns}</p>

  return (
    <ul className="space-y-2">
      {runs.map((r) => {
        const title = r.kind === 'setup' ? t.sim.setupRun : r.params.title ?? t.tasks[r.params.taskId ?? '']?.title ?? r.params.taskId
        return (
          <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[r.status]}`}>{t.sim.status[r.status]}</span>
              <span className="font-medium">{title}</span>
              {r.kind === 'simulation' && (
                <span className="text-xs text-slate-500">
                  {r.params.mode === 'smoke' ? t.sim.modeSmoke.split(' (')[0] : r.params.model} · n={r.params.sampleSize}
                </span>
              )}
              <span className="ml-auto text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-2 flex gap-3 text-xs">
              <button
                type="button"
                className="text-brand underline"
                onClick={() => {
                  setDetail(null)
                  setView('log')
                  setOpenId(openId === r.id && view === 'log' ? null : r.id)
                }}
              >
                {openId === r.id && view === 'log' ? t.sim.hideLog : t.sim.log}
              </button>
              {r.kind === 'simulation' && r.params.mode === 'auto' && (
                <button
                  type="button"
                  className="text-brand underline"
                  onClick={() => {
                    setDetail(null)
                    setView('results')
                    setOpenId(openId === r.id && view === 'results' ? null : r.id)
                  }}
                >
                  {openId === r.id && view === 'results' ? t.sim.hideLog : t.sim.results}
                </button>
              )}
              {r.status === 'running' && (
                <button type="button" className="text-red-500 underline" onClick={() => cancel(r.id)}>
                  {t.sim.cancel}
                </button>
              )}
            </div>
            {openId === r.id && view === 'log' && (
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-950">
                {detail?.id === r.id ? detail.log || '…' : '…'}
              </pre>
            )}
            {openId === r.id && view === 'results' && (
              <div className="mt-2">
                <ResultsView runId={r.id} active={r.status === 'running'} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
