import { useEffect, useState } from 'react'
import { api, type QuestionResult, type RunResults } from '../api'
import { useI18n } from '../i18n'

function Bar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <li className="grid grid-cols-[minmax(6rem,14rem)_1fr_4.5rem] items-center gap-2 text-xs">
      <span className="truncate" title={label}>{label}</span>
      <span className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right text-slate-500">{count} · {pct}%</span>
    </li>
  )
}

function Question({ q }: { q: QuestionResult }) {
  const { t } = useI18n()
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-sm font-medium">{q.prompt}</div>
      <div className="mb-2 text-[11px] text-slate-500">n={q.n}</div>
      {q.type === 'likert' && (
        <>
          <div className="mb-1 text-xs">{t.sim.mean}: <strong>{q.mean ?? '—'}</strong></div>
          <ul className="space-y-1">
            {Object.entries(q.hist ?? {}).map(([k, v]) => <Bar key={k} label={k} count={v} total={q.n} />)}
          </ul>
        </>
      )}
      {(q.type === 'single_choice' || q.type === 'multi_choice') && (
        <>
          <ul className="space-y-1">
            {(q.options ?? []).map((o) => <Bar key={o.id} label={o.label} count={o.count} total={q.n} />)}
          </ul>
          {(q.reasons?.length ?? 0) > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-brand">{t.sim.reasons}</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600 dark:text-slate-400">
                {q.reasons!.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </details>
          )}
        </>
      )}
      {q.type === 'free_text' && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600 dark:text-slate-400">
          {(q.texts ?? []).map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      )}
    </div>
  )
}

export default function ResultsView({ runId, active }: { runId: string; active: boolean }) {
  const { t } = useI18n()
  const [data, setData] = useState<RunResults | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () =>
      api<RunResults>(`/api/runs/${runId}/results`)
        .then((r) => alive && (setData(r), setError(false)))
        .catch(() => alive && setError(true))
    load()
    if (!active) return () => { alive = false }
    const id = setInterval(load, 4000)
    return () => { alive = false; clearInterval(id) }
  }, [runId, active])

  if (error) return <p className="text-xs text-red-500">{t.sim.errors.server_error}</p>
  if (!data) return <p className="text-xs text-slate-500">…</p>
  if (!data.found) return <p className="text-xs text-slate-500">{t.sim.noResults}</p>
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{t.sim.resultsN.replace('{n}', String(data.n))}</p>
      {data.questions.map((q) => <Question key={q.id} q={q} />)}
    </div>
  )
}
