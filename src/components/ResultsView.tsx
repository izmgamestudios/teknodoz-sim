import { useEffect, useState } from 'react'
import { api, type ReportQuestion, type RunReport } from '../api'
import { LANGS, useI18n, type Lang } from '../i18n'

const pc = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`)

function Bar({ label, value, share }: { label: string; value: string; share: number }) {
  return (
    <li className="grid grid-cols-[minmax(6rem,14rem)_1fr_5rem] items-center gap-2 text-xs">
      <span className="truncate" title={label}>{label}</span>
      <span className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round(share * 100)}%` }} />
      </span>
      <span className="text-right text-slate-500">{value}</span>
    </li>
  )
}

function Question({ q, labels }: { q: ReportQuestion; labels: Record<string, string> }) {
  const { t } = useI18n()
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-sm font-medium">{q.prompt}</div>
      <div className="mb-2 text-[11px] text-slate-500">n={q.n}</div>
      {q.type === 'likert' && (
        <>
          <div className="mb-1 flex flex-wrap gap-x-4 text-xs">
            <span>{t.sim.mean}: <strong>{q.mean ?? '—'}</strong></span>
            {q.sd !== undefined && q.sd !== null && <span>{labels.sd}: {q.sd}</span>}
            {q.top2 !== undefined && <span>{labels.top2}: {pc(q.top2)}</span>}
            {q.nps && <span>{labels.nps}: <strong>{q.nps.score}</strong></span>}
          </div>
          <ul className="space-y-1">
            {Object.entries(q.hist ?? {}).map(([k, v]) => <Bar key={k} label={k} value={`${v} · ${pc(q.n ? v / q.n : 0)}`} share={q.n ? v / q.n : 0} />)}
          </ul>
        </>
      )}
      {(q.type === 'single_choice' || q.type === 'multi_choice') && (
        <>
          <ul className="space-y-1">
            {(q.options ?? []).map((o) => <Bar key={o.id} label={o.label} value={`${o.count} · ${pc(o.share)}`} share={o.share} />)}
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
          {(q.texts ?? []).slice(0, 30).map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      )}
    </div>
  )
}

const FORMATS: { id: string; label: (t: ReturnType<typeof useI18n>['t']) => string }[] = [
  { id: 'xlsx', label: () => 'Excel (.xlsx)' },
  { id: 'docx', label: () => 'Word (.docx)' },
  { id: 'pdf', label: () => 'PDF' },
  { id: 'csv', label: () => 'CSV' },
  { id: 'csv-summary', label: (t) => t.sim.csvSummary },
  { id: 'json', label: () => 'JSON' },
]

export default function ResultsView({ runId, active, title }: { runId: string; active: boolean; title?: string }) {
  const { t, lang } = useI18n()
  const [reportLang, setReportLang] = useState<Lang>(lang)
  const [report, setReport] = useState<RunReport | null>(null)
  const [error, setError] = useState(false)
  const [noData, setNoData] = useState<{ files: { path: string; size: number }[]; jobDirExists: boolean } | null>(null)

  useEffect(() => setReportLang(lang), [lang])

  useEffect(() => {
    let alive = true
    const qs = `lang=${reportLang}${title ? `&title=${encodeURIComponent(title)}` : ''}`
    const load = async () => {
      try {
        const r = await api<RunReport>(`/api/runs/${runId}/report?format=json&${qs}`)
        if (!alive) return
        setReport(r)
        setError(false)
        if (r.meta.respondents === 0) {
          const res = await api<{ diagnostics?: { files: { path: string; size: number }[]; jobDirExists: boolean } | null }>(`/api/runs/${runId}/results`)
          if (alive) setNoData(res.diagnostics ?? null)
        } else setNoData(null)
      } catch {
        if (alive) setError(true)
      }
    }
    load()
    if (!active) return () => { alive = false }
    const id = setInterval(load, 4000)
    return () => { alive = false; clearInterval(id) }
  }, [runId, active, reportLang, title])

  if (error) return <p className="text-xs text-red-500">{t.sim.errors.server_error}</p>
  if (!report) return <p className="text-xs text-slate-500">{t.sim.loadingReport}</p>
  const qs = `lang=${reportLang}${title ? `&title=${encodeURIComponent(title)}` : ''}`
  const has = report.meta.respondents > 0

  return (
    <div className="space-y-4">
      {report.notices.map((n, i) => (
        <p key={i} role="note" className={`rounded-lg px-3 py-2 text-xs ${n.kind === 'warn' ? 'bg-amber-400/10 text-amber-700 dark:text-amber-300' : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'}`}>{n.text}</p>
      ))}

      {has && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800">
          <span className="font-semibold">{t.sim.exportLabel}:</span>
          {FORMATS.map((f) => (
            <a key={f.id} href={`/api/runs/${runId}/report?format=${f.id}&${qs}`} download className="rounded-md bg-brand px-2.5 py-1 font-medium text-white hover:opacity-90">
              {f.label(t)}
            </a>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-slate-500">
            {t.sim.exportLang}
            <select value={reportLang} onChange={(e) => setReportLang(e.target.value as Lang)} className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 dark:border-slate-700 dark:bg-slate-950">
              {(Object.keys(LANGS) as Lang[]).map((l) => <option key={l} value={l}>{LANGS[l].langName}</option>)}
            </select>
          </label>
        </div>
      )}

      {!has && (
        <div className="space-y-1 text-xs text-slate-500">
          <p>{t.sim.noResults}</p>
          {noData && (
            <details>
              <summary className="cursor-pointer text-brand">{noData.jobDirExists ? `${noData.files.length} files` : 'jobs/ not found'}</summary>
              <ul className="mt-1 font-mono">
                {noData.files.map((f) => <li key={f.path}>{f.path} ({f.size} B)</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {has && (
        <>
          <p className="text-xs text-slate-500">{t.sim.resultsN.replace('{n}', String(report.meta.respondents))}</p>
          {report.findings.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">{t.sim.findingsTitle}</h3>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-700 dark:text-slate-300">
                {report.findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {report.analyses.map((a) =>
            a.type === 'vw' ? (
              <div key="vw" className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                <h3 className="mb-1 text-sm font-semibold">{t.sim.priceTitle}</h3>
                <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  {(['pmc', 'opp', 'ipp', 'pme'] as const).map((k) => (
                    <div key={k} className="flex justify-between gap-2 border-b border-slate-100 py-0.5 dark:border-slate-800">
                      <dt className="text-slate-500">{report.labels[k]}</dt>
                      <dd className="font-medium">{a.points?.[k] ?? '—'} {a.currency}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div key="mvt" className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                <h3 className="mb-2 text-sm font-semibold">{t.sim.mvtTitle}</h3>
                {a.attributes.map((at) => (
                  <div key={at.key} className="mb-2">
                    <div className="font-medium">{at.label}</div>
                    <ul className="mt-1 space-y-1">
                      {at.levels.map((lv) => <Bar key={lv.label} label={lv.label} value={`${lv.chosen}/${lv.shown} · ${pc(lv.rate)}`} share={lv.rate ?? 0} />)}
                    </ul>
                  </div>
                ))}
              </div>
            ),
          )}

          <div className="space-y-3">
            {report.questions.map((q) => <Question key={q.id} q={q} labels={report.labels} />)}
          </div>

          {report.segments.length > 0 && (
            <details className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <summary className="cursor-pointer text-sm font-semibold">{t.sim.segmentsTitle}</summary>
              {report.segments.map((s) => (
                <div key={s.facet} className="mt-3 overflow-x-auto">
                  <div className="mb-1 font-medium">{s.label}</div>
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">{report.labels.question}</th>
                        {s.groups.map((g) => <th key={g.value} className="border border-slate-200 px-2 py-1 dark:border-slate-700">{g.label} (n={g.n})</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.map((r) => (
                        <tr key={r.questionId}>
                          <td className="max-w-xs truncate border border-slate-200 px-2 py-1 dark:border-slate-700" title={r.prompt}>{r.prompt}</td>
                          {s.groups.map((g) => <td key={g.value} className="border border-slate-200 px-2 py-1 text-center dark:border-slate-700">{r.cells[g.value] === null || r.cells[g.value] === undefined ? '—' : r.kind === 'share' ? pc(r.cells[g.value]) : r.cells[g.value]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </details>
          )}

          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer text-brand">{t.sim.methodTitle}</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{report.method.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </details>
        </>
      )}
    </div>
  )
}
