import { useEffect, useMemo, useState } from 'react'
import { ApiError, api } from '../api'
import { useAuth } from '../auth'
import RunList from '../components/RunList'
import type { PageId } from '../config'
import { useI18n } from '../i18n'
import { blank, MAX_QUESTIONS, parseImport, type DraftQuestion, type QType } from '../importers'
import { useSelection } from '../selection'
import { useStudyDraft, type SourceType } from '../studyDraft'
import type { TemplateId } from '../studyTemplates'
import { MODELS } from '../tasks'

type Notice = { kind: 'info' | 'warn' | 'error'; text: string }

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950'
const btn = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 disabled:opacity-50'
const SOURCES: SourceType[] = ['survey', 'website', 'appstore', 'product']
const TYPES: QType[] = ['likert', 'single_choice', 'multi_choice', 'free_text']
const clone = (qs: DraftQuestion[]) => qs.map((q) => ({ ...q, options: [...q.options] }))

function questionValid(q: DraftQuestion) {
  if (q.prompt.trim().length < 5 || q.prompt.length > 400) return false
  if (q.type === 'likert') return Number.isInteger(q.min) && Number.isInteger(q.max) && q.min >= 0 && q.max <= 10 && q.min < q.max
  if (q.type === 'single_choice' || q.type === 'multi_choice') {
    const o = q.options.map((x) => x.trim()).filter(Boolean)
    return o.length >= 2 && o.length <= 8 && o.every((x) => x.length <= 150)
  }
  return true
}

export default function Study({ go }: { go: (p: PageId) => void }) {
  const { t } = useI18n()
  const errs = t.study.errors as Record<string, string>
  const { admin, loading } = useAuth()
  const selection = useSelection()
  const { draft, clearDraft } = useStudyDraft()
  const [src, setSrc] = useState<SourceType>('survey')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [fetching, setFetching] = useState(false)
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [pristine, setPristine] = useState(false) // true while the questions are an unmodified template
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [sampleSize, setSampleSize] = useState(8)
  const [seed, setSeed] = useState(42)
  const [model, setModel] = useState(MODELS[0])
  const [mode, setMode] = useState<'smoke' | 'auto'>('smoke')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!draft) return
    setSrc(draft.src)
    setTitle(draft.title)
    setBrief(draft.brief)
    setUrl(draft.url ?? '')
    setQuestions(draft.questions.map((q) => ({ ...q, options: [...q.options] })))
    setPristine(false)
    setNotice(null)
    setStarted(false)
    clearDraft()
  }, [draft, clearDraft])

  const urlSource = src === 'website' || src === 'appstore'
  const valid = useMemo(
    () => title.trim().length >= 3 && brief.trim().length >= 20 && questions.length >= 1 && questions.length <= MAX_QUESTIONS && questions.every(questionValid),
    [title, brief, questions],
  )

  const loadTemplate = (id: TemplateId) => {
    setQuestions(id === 'blank' ? [blank()] : clone(t.seed.templates[id]))
    setPristine(id !== 'blank')
  }
  const edit = (fn: (qs: DraftQuestion[]) => DraftQuestion[]) => {
    setPristine(false)
    setQuestions(fn)
  }
  const update = (i: number, patch: Partial<DraftQuestion>) => edit((qs) => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)))
  const changeType = (i: number, type: QType) =>
    update(i, { type, options: type === 'single_choice' || type === 'multi_choice' ? (questions[i].options.length >= 2 ? questions[i].options : ['', '']) : [] })
  const move = (i: number, d: -1 | 1) =>
    edit((qs) => {
      const j = i + d
      if (j < 0 || j >= qs.length) return qs
      const c = [...qs]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  const chooseSource = (s: SourceType) => {
    setSrc(s)
    setNotice(null)
    if (questions.length === 0 || pristine) loadTemplate(s === 'website' ? 'website' : s === 'appstore' ? 'appstore' : s === 'product' ? 'product' : 'blank')
  }

  const fetchPreview = async () => {
    setFetching(true)
    setNotice(null)
    try {
      const r = await api<{ title?: string; brief?: string; thin?: boolean; unsupported?: 'apk' | 'play_store'; packageId?: string | null }>('/api/studies/preview', { method: 'POST', body: { type: src, url } })
      if (r.unsupported === 'apk') return setNotice({ kind: 'warn', text: t.study.unsupportedApk })
      if (r.unsupported === 'play_store') {
        if (!title) setTitle(r.packageId ?? '')
        return setNotice({ kind: 'warn', text: t.study.unsupportedPlay.replace('{pkg}', r.packageId ?? '—') })
      }
      setTitle(r.title ?? title)
      setBrief(r.brief ?? '')
      if (questions.length === 0 || pristine) loadTemplate(src === 'appstore' ? 'appstore' : 'website')
      if (r.thin) setNotice({ kind: 'warn', text: t.study.thin })
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'fetch_failed'
      setNotice({ kind: 'error', text: errs[code] ?? errs.fetch_failed })
    } finally {
      setFetching(false)
    }
  }

  const doImport = () => {
    const r = parseImport(importText)
    const room = MAX_QUESTIONS - questions.length
    const add = r.questions.slice(0, Math.max(0, room))
    edit((qs) => [...qs, ...add])
    setImportMsg([add.length ? t.study.importOk.replace('{n}', String(add.length)) : '', ...r.errors].filter(Boolean).join(' · '))
    if (add.length) setImportText('')
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/studies', {
        method: 'POST',
        body: {
          title, brief,
          source: { type: src, ...(urlSource && url ? { url } : {}) },
          questions: questions.map((q) => ({ type: q.type, prompt: q.prompt, options: q.options.map((o) => o.trim()).filter(Boolean), min: q.min, max: q.max, askRationale: q.askRationale })),
          sampleSize, seed, model, mode,
          personaIds: mode === 'auto' ? selection.ids : [],
        },
      })
      setStarted(true)
      setTick((n) => n + 1)
    } catch (e) {
      if (e instanceof ApiError) {
        const base = errs[e.code] ?? t.sim.errors[e.code] ?? errs.fetch_failed
        setError(base.replace('{n}', String((e.index ?? 0) + 1)))
      } else setError(t.sim.errors.server_error)
    } finally {
      setBusy(false)
    }
  }

  const noticeColor = { info: 'text-slate-500', warn: 'text-amber-600 dark:text-amber-300', error: 'text-red-500' }

  return (
    <section className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.study.title}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{t.study.intro}</p>
      </div>

      <div className={card}>
        <h2 className="font-semibold">{t.study.s1}</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={src === s}
              onClick={() => chooseSource(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${src === s ? 'bg-brand text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
            >
              {t.study.src[s]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{t.study.srcHelp[src]}</p>

        {urlSource && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input className={`${input} min-w-0 flex-1`} type="url" inputMode="url" placeholder="https://" aria-label={t.study.url} value={url} onChange={(e) => setUrl(e.target.value)} />
            <button type="button" onClick={fetchPreview} disabled={fetching || url.length < 8 || !admin} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {fetching ? t.study.fetching : t.study.fetch}
            </button>
          </div>
        )}
        {notice && <p role="status" className={`mt-2 text-sm ${noticeColor[notice.kind]}`}>{notice.text}</p>}

        <label className="mt-4 block text-sm">
          {t.study.titleLabel}
          <input className={`${input} mt-1`} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm">
          {t.study.briefLabel}
          <textarea className={`${input} mt-1 min-h-40`} value={brief} maxLength={8000} onChange={(e) => setBrief(e.target.value)} />
          <span className="text-xs text-slate-500">{t.study.briefHint.replace('{n}', String(brief.length))}</span>
        </label>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t.study.s2}</h2>
          <span className={`text-xs ${questions.length < 5 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500'}`}>
            {t.study.qCount.replace('{n}', String(questions.length))} · {t.study.qHint}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-slate-500">{t.study.tplTitle}:</span>
          {(['website', 'appstore', 'product', 'blank'] as TemplateId[]).map((id) => (
            <button key={id} type="button" onClick={() => loadTemplate(id)} className={btn}>
              {t.study.tpl[id]}
            </button>
          ))}
        </div>

        <ol className="mt-4 space-y-3">
          {questions.map((q, i) => (
            <li key={i} className={`rounded-lg border p-3 ${questionValid(q) ? 'border-slate-200 dark:border-slate-800' : 'border-amber-400/60'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Q{i + 1}</span>
                <select aria-label={t.study.qTypeLabel} className={`${input} w-auto`} value={q.type} onChange={(e) => changeType(i, e.target.value as QType)}>
                  {TYPES.map((ty) => <option key={ty} value={ty}>{t.study.qType[ty]}</option>)}
                </select>
                <span className="ml-auto flex gap-1">
                  <button type="button" className={btn} onClick={() => move(i, -1)} aria-label={t.study.up} disabled={i === 0}>↑</button>
                  <button type="button" className={btn} onClick={() => move(i, 1)} aria-label={t.study.down} disabled={i === questions.length - 1}>↓</button>
                  <button type="button" className={btn} onClick={() => edit((qs) => qs.filter((_, k) => k !== i))}>{t.study.remove}</button>
                </span>
              </div>
              <textarea className={`${input} mt-2`} rows={2} maxLength={400} aria-label={t.study.qPrompt} placeholder={t.study.qPrompt} value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
              {(q.type === 'single_choice' || q.type === 'multi_choice') && (
                <label className="mt-2 block text-xs text-slate-500">
                  {t.study.qOptions}
                  <textarea className={`${input} mt-1`} rows={4} value={q.options.join('\n')} onChange={(e) => update(i, { options: e.target.value.split('\n') })} />
                </label>
              )}
              {q.type === 'likert' && (
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <label>{t.study.qMin} <input type="number" min={0} max={9} className={`${input} ml-1 w-16`} value={q.min} onChange={(e) => update(i, { min: Math.trunc(Number(e.target.value)) })} /></label>
                  <label>{t.study.qMax} <input type="number" min={1} max={10} className={`${input} ml-1 w-16`} value={q.max} onChange={(e) => update(i, { max: Math.trunc(Number(e.target.value)) })} /></label>
                </div>
              )}
              {q.type !== 'free_text' && (
                <label className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" className="accent-indigo-500" checked={q.askRationale} onChange={(e) => update(i, { askRationale: e.target.checked })} />
                  {t.study.qRationale}
                </label>
              )}
            </li>
          ))}
        </ol>
        <button type="button" className={`${btn} mt-3`} disabled={questions.length >= MAX_QUESTIONS} onClick={() => edit((qs) => [...qs, blank()])}>
          + {t.study.addQuestion}
        </button>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-brand">{t.study.importLabel}</summary>
          <p className="mt-2 text-xs text-slate-500">{t.study.importHelp}</p>
          <textarea className={`${input} mt-2 font-mono text-xs`} rows={5} aria-label={t.study.importLabel} value={importText} onChange={(e) => setImportText(e.target.value)} />
          <button type="button" className={`${btn} mt-2`} onClick={doImport} disabled={!importText.trim() || questions.length >= MAX_QUESTIONS}>
            {t.study.importBtn}
          </button>
          {importMsg && <p role="status" className="mt-2 text-xs text-slate-500">{importMsg}</p>}
        </details>
      </div>

      <div className={card}>
        <h2 className="font-semibold">{t.study.s3}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            {t.sim.mode}
            <select className={`${input} mt-1`} value={mode} onChange={(e) => setMode(e.target.value as 'smoke' | 'auto')}>
              <option value="smoke">{t.sim.modeSmoke}</option>
              <option value="auto">{t.sim.modeAuto}</option>
            </select>
          </label>
          <label className="text-sm">
            {t.sim.model}
            <select className={`${input} mt-1`} value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm dark:border-slate-700 sm:col-span-2">
            {selection.ids.length > 0 ? (
              <>
                {t.study.audSel.replace('{n}', String(selection.ids.length)).replace('{pool}', selection.pool === 'country' ? t.study.audCountry : t.study.audDev)}{' '}
                <button type="button" className="text-brand underline" onClick={selection.clear}>{t.sim.clearSelection}</button>
              </>
            ) : (
              <>
                {t.study.audNone}{' '}
                <button type="button" className="text-brand underline" onClick={() => go('personas')}>{t.study.audPick}</button>
              </>
            )}
          </div>
          {selection.ids.length === 0 && mode === 'auto' && (
            <label className="text-sm">
              {t.study.audSample}
              <input className={`${input} mt-1`} type="number" min={1} max={100} value={sampleSize} onChange={(e) => setSampleSize(Math.max(1, Math.min(100, Math.trunc(Number(e.target.value)) || 1)))} />
            </label>
          )}
          <label className="text-sm">
            {t.sim.seed}
            <input className={`${input} mt-1`} type="number" min={0} value={seed} onChange={(e) => setSeed(Math.max(0, Math.trunc(Number(e.target.value)) || 0))} />
          </label>
        </div>
        {mode === 'smoke' && <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{t.sim.smokeNote}</p>}
        <p className="mt-3 text-xs text-slate-500">{t.study.experimental}</p>

        {!loading && !admin ? (
          <div className="mt-4">
            <p className="text-sm text-slate-500">{t.study.loginNeeded}</p>
            <button type="button" onClick={() => go('admin')} className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">{t.sim.goLogin}</button>
          </div>
        ) : (
          <button type="button" onClick={submit} disabled={busy || !valid} className="mt-4 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {busy ? t.study.creating : t.study.create}
          </button>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
        {started && <p role="status" className="mt-2 text-sm text-emerald-500">{t.study.created}</p>}
      </div>

      {admin && started && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t.sim.history}</h2>
          <RunList refreshKey={tick} />
        </div>
      )}
    </section>
  )
}
