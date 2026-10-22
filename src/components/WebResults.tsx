import { useEffect, useState } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'

type Item = {
  path: string
  personaId: string | null
  choice: { decision_subject_label?: string; task_author?: string; basis_primary?: string; exploration_style?: string; reason?: string } | null
  feedback: { overallExperienceRating?: number } | null
  reward: string | null
}

export default function WebResults({ runId, active }: { runId: string; active: boolean }) {
  const { t } = useI18n()
  const v = t.admin.val
  const [items, setItems] = useState<Item[] | null>(null)
  const [diag, setDiag] = useState<{ files: { path: string; size: number }[]; jobDirExists: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      api<{ web?: { items: Item[] }; diagnostics?: { files: { path: string; size: number }[]; jobDirExists: boolean } | null }>(`/api/runs/${runId}/results`)
        .then((r) => { if (alive) { setItems(r.web?.items ?? []); setDiag(r.diagnostics ?? null) } })
        .catch(() => alive && setItems([]))
    void load()
    if (!active) return () => { alive = false }
    const id = setInterval(load, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [runId, active])

  if (!items) return <p className="text-xs text-slate-500">{t.sim.loadingReport}</p>
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `web-results-${runId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-2 text-xs">
      <h3 className="text-sm font-semibold">{v.resTitle}</h3>
      <p role="note" className="rounded-lg bg-amber-400/10 px-3 py-2 text-amber-700 dark:text-amber-300">{v.resNote}</p>
      {items.length === 0 ? (
        <div className="text-slate-500">
          <p>{v.none}</p>
          {diag && (
            <details>
              <summary className="cursor-pointer text-brand">{diag.jobDirExists ? `${diag.files.length} files` : 'jobs/ not found'}</summary>
              <ul className="mt-1 font-mono">{diag.files.map((f) => <li key={f.path}>{f.path} ({f.size} B)</li>)}</ul>
            </details>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-slate-500">
                <tr>{[v.persona, v.choice, v.source, v.basis, v.style, v.rating, v.reward, v.reason].map((h) => <th key={h} className="p-1.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.path} className="border-t border-slate-200 align-top dark:border-slate-800">
                    <td className="p-1.5">{i.personaId ?? '—'}</td>
                    <td className="p-1.5">{i.choice?.decision_subject_label ?? '—'}</td>
                    <td className="p-1.5">{i.choice?.task_author ?? '—'}</td>
                    <td className="p-1.5">{i.choice?.basis_primary ?? '—'}</td>
                    <td className="p-1.5">{i.choice?.exploration_style ?? '—'}</td>
                    <td className="p-1.5">{i.feedback?.overallExperienceRating ?? '—'}</td>
                    <td className="p-1.5">{i.reward ?? '—'}</td>
                    <td className="p-1.5">{i.choice?.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={download} className="rounded-md bg-brand px-2.5 py-1 font-medium text-white">{v.dl}</button>
        </>
      )}
    </div>
  )
}
