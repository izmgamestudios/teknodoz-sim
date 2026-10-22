import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, api, type SystemStatus } from '../api'
import { useAuth } from '../auth'
import RunList from '../components/RunList'
import { useI18n } from '../i18n'
import { reloadCountryPool, useCountryPool } from '../personas'
import AdminValidation from './AdminValidation'
import AdminSettings, { type SettingsTab } from './AdminSettings'

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const input =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950'

function Login() {
  const { t } = useI18n()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'server_error'
      setError(t.admin.errors[code] ?? t.admin.errors.server_error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${card} max-w-sm space-y-4`}>
      <h2 className="text-lg font-semibold">{t.admin.loginTitle}</h2>
      <label className="block text-sm">
        {t.admin.email}
        <input className={input} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block text-sm">
        {t.admin.password}
        <input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? t.admin.loggingIn : t.admin.login}
      </button>
    </form>
  )
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  const { t } = useI18n()
  return (
    <li className="flex items-center justify-between py-1.5 text-sm">
      <span>{label}</span>
      <span className={ok ? 'text-emerald-500' : 'text-red-500'}>{ok ? `✓ ${t.admin.ok}` : `✕ ${t.admin.missing}`}</span>
    </li>
  )
}

type ImportIssue = { row: number; field: string; message: string; value?: string }

const TEMPLATE_CSV = [
  'id,name,country,age_bracket,gender_identity,life_stage,economic_motivation,risk_tolerance,demo_employment_status,socioeconomic_band,urbanicity,language,description,internet',
  'anna,Anna,DE,25-34,Woman,Early career,Value-driven,Cautious,Full-time,Middle,Dense urban,German,"Product designer at a startup",yes',
  'mert,Mert,TR,35-44,Man,Parent of young kids,Cost-sensitive,Risk-averse,Self-employed,Lower-middle,Suburban,Turkish,"Runs a small online shop",yes',
].join('\r\n')

function ImportPersonas() {
  const { t } = useI18n()
  const [csv, setCsv] = useState('')
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<ImportIssue[]>([])
  const [warnings, setWarnings] = useState<ImportIssue[]>([])
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const refreshCount = useCallback(() => {
    api<{ personas: unknown[] }>('/api/custom-personas').then((r) => setCount(r.personas.length)).catch(() => setCount(null))
  }, [])
  useEffect(refreshCount, [refreshCount])

  const issueText = (i: ImportIssue) => `${t.admin.ipErrors[i.message] ?? i.message}${i.value ? `: ${i.value}` : ''}`

  const run = async (save: boolean) => {
    setBusy(true)
    setErrors([])
    setWarnings([])
    setMsg('')
    try {
      if (save) {
        const r = await api<{ saved: number; total: number; warnings: ImportIssue[] }>('/api/custom-personas', { method: 'POST', body: { csv, mode } })
        setMsg(t.admin.ipSaved.replace('{n}', String(r.saved)).replace('{t}', String(r.total)))
        setWarnings(r.warnings)
        setCsv('')
        refreshCount()
      } else {
        const r = await api<{ valid: number; errors: ImportIssue[]; warnings: ImportIssue[] }>('/api/custom-personas/validate', { method: 'POST', body: { csv, mode } })
        setErrors(r.errors)
        setWarnings(r.warnings)
        if (!r.errors.length) setMsg(t.admin.ipValid.replace('{n}', String(r.valid)))
      }
    } catch (e) {
      const payload = e as { code?: string }
      setErrors([{ row: 0, field: '', message: payload.code ?? 'invalid_csv' }])
    } finally {
      setBusy(false)
    }
  }

  const clearAll = async () => {
    if (!window.confirm(t.admin.ipConfirmClear)) return
    await api('/api/custom-personas/clear', { method: 'POST', body: {} })
    refreshCount()
    setMsg('')
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'personas-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={card}>
      <h2 className="font-semibold">{t.admin.ipTitle}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.admin.ipText}</p>
      <p className="mt-2 text-xs text-slate-500">{count === null ? '…' : t.admin.ipCount.replace('{n}', String(count))}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={download} className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700">{t.admin.ipTemplate}</button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) setCsv(await f.text())
            e.target.value = ''
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700">{t.admin.ipFile}</button>
        {count !== null && count > 0 && (
          <button type="button" onClick={clearAll} className="ml-auto text-xs text-red-500 underline">{t.admin.ipClear}</button>
        )}
      </div>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        aria-label={t.admin.ipPaste}
        placeholder={t.admin.ipPaste}
        rows={6}
        className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
      />
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" name="ipmode" checked={mode === 'append'} onChange={() => setMode('append')} className="accent-indigo-500" />{t.admin.ipAppend}</label>
        <label className="flex items-center gap-1.5"><input type="radio" name="ipmode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="accent-indigo-500" />{t.admin.ipReplace}</label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy || !csv.trim()} onClick={() => run(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-slate-700">{t.admin.ipValidate}</button>
        <button type="button" disabled={busy || !csv.trim()} onClick={() => run(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t.admin.ipImport}</button>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-emerald-500">{msg}</p>}
      {errors.length > 0 && (
        <div role="alert" className="mt-3">
          <div className="mb-1 text-sm font-medium text-red-500">{t.admin.ipErrorsTitle}</div>
          <table className="w-full text-left text-xs">
            <thead><tr className="text-slate-500"><th className="pr-3">{t.admin.ipRow}</th><th className="pr-3">{t.admin.ipField}</th><th>{t.admin.ipMessage}</th></tr></thead>
            <tbody>{errors.map((e, i) => <tr key={i}><td className="pr-3">{e.row || '—'}</td><td className="pr-3">{e.field || '—'}</td><td>{issueText(e)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {warnings.length > 0 && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{t.admin.ipWarnings}: {warnings.map((w) => `${w.field} (${t.admin.ipErrors[w.message] ?? w.message})`).join(', ')}</p>
      )}
    </div>
  )
}

function CountryData() {
  const { t } = useI18n()
  const { data } = useCountryPool()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)

  const refresh = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await api<{ indicators: Record<string, { ok: boolean }>; fallbackCount: number }>('/api/countries/refresh', { method: 'POST', body: {} })
      const all = Object.values(r.indicators)
      setBad(false)
      setMsg(t.admin.cdDone.replace('{ok}', String(all.filter((x) => x.ok).length)).replace('{total}', String(all.length)).replace('{fb}', String(r.fallbackCount)))
      reloadCountryPool()
    } catch {
      setBad(true)
      setMsg(t.admin.cdFail)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={card}>
      <h2 className="font-semibold">{t.admin.cdTitle}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.admin.cdText}</p>
      {data && (
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-500">{t.admin.cdSource}</dt><dd>{data.meta.source === 'world-bank' ? t.personas.dataWorldBank : t.personas.dataBaseline}</dd></div>
          <div><dt className="text-xs text-slate-500">{t.admin.cdAsOf}</dt><dd>{data.meta.asOf}</dd></div>
          <div><dt className="text-xs text-slate-500">{t.admin.cdFetched}</dt><dd>{data.meta.fetchedAt ? new Date(data.meta.fetchedAt).toLocaleString() : '—'}</dd></div>
        </dl>
      )}
      <button type="button" onClick={refresh} disabled={busy} className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? t.admin.cdBusy : t.admin.cdBtn}
      </button>
      {msg && <p role="status" className={`mt-2 text-sm ${bad ? 'text-red-500' : 'text-emerald-500'}`}>{msg}</p>}
    </div>
  )
}

function Panel() {
  const { t } = useI18n()
  const { email, logout } = useAuth()
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [tick, setTick] = useState(0)
  const [error, setError] = useState('')

  const refresh = useCallback(() => {
    api<SystemStatus>('/api/status').then(setStatus).catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const setup = async () => {
    setError('')
    try {
      await api('/api/setup', { method: 'POST', body: {} })
      setTick((n) => n + 1)
      refresh()
    } catch (e) {
      setError(t.sim.errors[e instanceof ApiError ? e.code : 'server_error'] ?? t.sim.errors.server_error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-500">{t.admin.signedInAs} <strong>{email}</strong></span>
        <button type="button" onClick={logout} className="rounded-md border border-slate-300 px-3 py-1 dark:border-slate-700">
          {t.admin.logout}
        </button>
      </div>

      <div className={card}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">{t.admin.statusTitle}</h2>
          <button type="button" onClick={refresh} className="text-xs text-brand underline">{t.admin.refresh}</button>
        </div>
        {status && (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            <Row label={t.admin.uv} ok={status.uv} />
            <Row label={t.admin.docker} ok={status.docker} />
            <Row label={t.admin.matraix} ok={status.matraixDir} />
            <Row label={t.admin.venv} ok={status.venv} />
            <Row label={t.admin.anthropicKey} ok={status.anthropicKey} />
            <Row label={t.admin.openaiKey} ok={status.openaiKey} />
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">{t.admin.keyHint}</p>
      </div>

      <div className={card}>
        <h2 className="font-semibold">{t.admin.setupTitle}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.admin.setupText}</p>
        {status && !status.uv && <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{t.admin.setupNeedsUv}</p>}
        <button
          type="button"
          onClick={setup}
          disabled={!status?.uv || status.busy}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {t.admin.setupBtn}
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      <ImportPersonas />

      <CountryData />

      <div>
        <h2 className="mb-3 font-semibold">{t.sim.history}</h2>
        <RunList refreshKey={tick} />
      </div>
    </div>
  )
}

const TABS: ('system' | 'validate' | SettingsTab)[] = ['system', 'brand', 'menus', 'pages', 'content', 'validate', 'data']

function Tabs() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'system' | 'validate' | SettingsTab>('system')
  return (
    <div>
      <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === id ? 'border-brand font-medium text-brand' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {t.admin.set.tabs[id]}
          </button>
        ))}
      </div>
      {tab === 'system' ? <Panel /> : tab === 'validate' ? <AdminValidation /> : <AdminSettings tab={tab} />}
    </div>
  )
}

export default function Admin() {
  const { t } = useI18n()
  const { admin, loading } = useAuth()
  return (
    <section className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold">{t.admin.title}</h1>
      {loading ? null : admin ? <Tabs /> : <Login />}
    </section>
  )
}
