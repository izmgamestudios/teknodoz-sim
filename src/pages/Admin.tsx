import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, api, type SystemStatus } from '../api'
import { useAuth } from '../auth'
import RunList from '../components/RunList'
import { useI18n } from '../i18n'
import { reloadCountryPool, useCountryPool } from '../personas'

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

      <CountryData />

      <div>
        <h2 className="mb-3 font-semibold">{t.sim.history}</h2>
        <RunList refreshKey={tick} />
      </div>
    </div>
  )
}

export default function Admin() {
  const { t } = useI18n()
  const { admin, loading } = useAuth()
  return (
    <section className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">{t.admin.title}</h1>
      {loading ? null : admin ? <Panel /> : <Login />}
    </section>
  )
}
