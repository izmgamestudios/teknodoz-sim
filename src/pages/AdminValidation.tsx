import { useCallback, useEffect, useState } from 'react'
import { ApiError, api, type SystemStatus } from '../api'
import { useI18n } from '../i18n'
import { useCatalog } from '../catalog'

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950'
const btn = 'rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-brand disabled:opacity-50 dark:border-slate-700'

type Check = { key: string; ok: boolean; detail?: string; level?: 'fail' | 'warn' }
type Record_ = { ok: boolean; runId: string; at: number; model?: string; checks: Check[] }
type WebTask = { id: string; title: string; url: string; goal: string; createdAt: number }
type Info = { state: { survey?: Record_; web?: Record_ }; webTasks: WebTask[]; maxWebPersonas: number; webGate: boolean }

function useErr() {
  const { t } = useI18n()
  const v = t.admin.val
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fail = (e: unknown, n?: number) => {
    const code = e instanceof ApiError ? e.code : 'server_error'
    setMsg({ ok: false, text: (v.errors[code as keyof typeof v.errors] ?? v.errors.server_error).replace('{n}', String(n ?? '')) })
  }
  return { msg, setMsg, fail }
}

function Result({ rec, kind }: { rec?: Record_; kind: string }) {
  const { t } = useI18n()
  const v = t.admin.val
  if (!rec) return <p className="mt-2 text-sm text-slate-500">{v.stateNever}</p>
  return (
    <div className="mt-3 text-sm" data-testid={`val-${kind}`}>
      <p className={rec.ok ? 'font-medium text-emerald-500' : 'font-medium text-red-500'}>
        {rec.ok ? `✓ ${v.statePassed}` : `✕ ${v.stateFailed}`} <span className="font-normal text-slate-500">· {v.lastCheck.replace('{t}', new Date(rec.at).toLocaleString())}</span>
      </p>
      <ul className="mt-2 space-y-1">
        {rec.checks.map((c) => (
          <li key={c.key} className="flex flex-wrap gap-x-2">
            <span className={c.ok ? 'text-emerald-500' : c.level === 'warn' ? 'text-amber-500' : 'text-red-500'}>{c.ok ? '✓' : c.level === 'warn' ? '!' : '✕'}</span>
            <span>{v.checkNames[c.key as keyof typeof v.checkNames] ?? c.key}</span>
            {!c.ok && c.detail && <span className="text-xs text-slate-500">({c.level === 'warn' ? `${v.warning}: ` : ''}{c.detail})</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReferenceStep({ kind, title, text, info, status, reload }: { kind: 'survey' | 'web'; title: string; text: string; info: Info; status: SystemStatus | null; reload: () => void }) {
  const { t } = useI18n()
  const v = t.admin.val
  const { models } = useCatalog()
  const [model, setModel] = useState(models[0])
  const [busy, setBusy] = useState(false)
  const { msg, setMsg, fail } = useErr()
  const keys = Boolean(status && status.uv && status.venv && (status.anthropicKey || status.openaiKey))
  const ready = keys && (kind === 'survey' || status?.docker)

  const post = async (path: string, body: object, ok: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await api(path, { method: 'POST', body })
      setMsg({ ok: true, text: ok })
      reload()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={card}>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text}</p>
      {!ready && <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{v.needKeys}{kind === 'web' ? ` ${v.needDocker}` : ''}</p>}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">{v.model}
          <select className={`${input} !mt-1`} value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <button type="button" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy || !ready || status?.busy} onClick={() => post('/api/validation/start', { kind, model }, v.started)}>{v.start}</button>
        <button type="button" className={btn} disabled={busy} onClick={() => post('/api/validation/check', { kind }, '')}>{v.check}</button>
      </div>
      {msg && msg.text && <p role="status" className={`mt-2 text-sm ${msg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{msg.text}</p>}
      <Result rec={info.state[kind]} kind={kind} />
    </div>
  )
}

function WebGenerator({ info, status, reload }: { info: Info; status: SystemStatus | null; reload: () => void }) {
  const { t, lang } = useI18n()
  const v = t.admin.val
  const { models } = useCatalog()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [permission, setPermission] = useState(false)
  const [model, setModel] = useState(models[0])
  const [n, setN] = useState(3)
  const [busy, setBusy] = useState(false)
  const { msg, setMsg, fail } = useErr()
  const locked = !info.webGate

  const create = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await api('/api/web-tasks', { method: 'POST', body: { url, title, goal, confirmPermission: permission } })
      setMsg({ ok: true, text: v.created })
      setUrl(''); setTitle(''); setGoal(''); setPermission(false)
      reload()
    } catch (e) {
      fail(e, info.maxWebPersonas)
    } finally {
      setBusy(false)
    }
  }

  const run = async (id: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await api(`/api/web-tasks/${id}/run`, { method: 'POST', body: { model, sampleSize: n, seed: 42 } })
      setMsg({ ok: true, text: v.started })
    } catch (e) {
      fail(e, info.maxWebPersonas)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`${card} ${locked ? 'opacity-70' : ''}`}>
      <h3 className="font-semibold">{v.genTitle}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{v.genText}</p>
      <p className="mt-1 text-xs text-slate-500">{v.genCaveat.replace('{n}', String(info.maxWebPersonas))}</p>
      {locked && <p role="note" className="mt-2 text-sm text-amber-600 dark:text-amber-300">🔒 {v.genLocked}</p>}
      <fieldset disabled={locked || busy} className="mt-3 space-y-3">
        <label className="block text-sm">{v.url}<input className={input} type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <label className="block text-sm">{v.studyTitle}<input className={input} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm">{v.goal}<textarea className={input} rows={3} maxLength={600} value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-indigo-500" checked={permission} onChange={(e) => setPermission(e.target.checked)} />{v.permission}</label>
        <button type="button" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!url || !title || !goal || !permission} onClick={create}>{v.create}</button>
      </fieldset>
      {msg && msg.text && <p role="status" className={`mt-2 text-sm ${msg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{msg.text}</p>}

      <h4 className="mb-2 mt-5 text-sm font-semibold">{v.webTasks}</h4>
      {info.webTasks.length === 0 ? <p className="text-sm text-slate-500">{v.noWebTasks}</p> : (
        <>
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            <label>{v.model}<select className={input} value={model} onChange={(e) => setModel(e.target.value)} disabled={locked}>{models.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label>{v.personasMax.replace('{n}', String(info.maxWebPersonas))}<input className={`${input} w-24`} type="number" min={1} max={info.maxWebPersonas} value={n} disabled={locked} onChange={(e) => setN(Math.max(1, Math.min(info.maxWebPersonas, Math.trunc(Number(e.target.value)) || 1)))} /></label>
          </div>
          <ul className="space-y-2">
            {info.webTasks.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{w.title}</div>
                  <a className="break-all text-xs text-brand underline" href={w.url} target="_blank" rel="noopener noreferrer">{w.url}</a>
                  <div className="text-xs text-slate-500" lang={lang}>{w.goal}</div>
                </div>
                <button type="button" className={btn} disabled={locked || busy || status?.busy || !status?.docker} onClick={() => run(w.id)}>{v.run}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default function AdminValidation() {
  const { t } = useI18n()
  const v = t.admin.val
  const [info, setInfo] = useState<Info | null>(null)
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const reload = useCallback(() => {
    api<Info>('/api/validation').then(setInfo).catch(() => setInfo(null))
    api<SystemStatus>('/api/status').then(setStatus).catch(() => setStatus(null))
  }, [])
  useEffect(reload, [reload])
  if (!info) return null
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{v.title}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{v.intro}</p>
      </div>
      <ReferenceStep kind="survey" title={v.surveyTitle} text={v.surveyText} info={info} status={status} reload={reload} />
      <ReferenceStep kind="web" title={v.webTitle} text={v.webText} info={info} status={status} reload={reload} />
      <WebGenerator info={info} status={status} reload={reload} />
    </div>
  )
}
