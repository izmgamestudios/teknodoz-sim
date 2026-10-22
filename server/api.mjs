import {
  SESSION_MAX_AGE_S, clearFailures, createSession, isLockedOut, readSession, recordFailure, verifyPassword,
} from './auth.mjs'
import { gzipSync } from 'node:zlib'
import { loadCountryPool, refreshFromWorldBank } from './countries.mjs'
import { cancelRun, getRun, listRuns, startRun, systemStatus, validate } from './runner.mjs'

const MAX_BODY = 10_000

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}

function sendCompressed(req, res, body) {
  const raw = Buffer.from(JSON.stringify(body))
  const gzip = String(req.headers['accept-encoding'] || '').includes('gzip') && raw.length > 10_000
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...(gzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
  })
  res.end(gzip ? gzipSync(raw) : raw)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('too_large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {})
      } catch {
        reject(new Error('bad_json'))
      }
    })
    req.on('error', reject)
  })
}

function cookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return ''
}

function clientIp(req) {
  return String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim()
}

function sessionCookie(req, value, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
  return `tk_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`
}

export async function handleApi(req, res, pathname) {
  const method = req.method ?? 'GET'
  const session = readSession(cookie(req, 'tk_session'))
  const admin = session && session.sub === (process.env.ADMIN_EMAIL || '').toLowerCase()

  if (method === 'POST' && !String(req.headers['content-type'] || '').startsWith('application/json')) {
    return send(res, 415, { error: 'json_required' })
  }

  try {
    if (pathname === '/api/me' && method === 'GET') {
      return send(res, 200, { admin: Boolean(admin), email: admin ? session.sub : undefined })
    }

    if (pathname === '/api/country-pool' && method === 'GET') return sendCompressed(req, res, loadCountryPool())

    if (pathname === '/api/login' && method === 'POST') {
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH) return send(res, 503, { error: 'not_configured' })
      const ip = clientIp(req)
      if (isLockedOut(ip)) return send(res, 429, { error: 'too_many_attempts' })
      const body = await readBody(req)
      const email = String(body.email ?? '').trim().toLowerCase()
      const ok =
        verifyPassword(String(body.password ?? ''), process.env.ADMIN_PASSWORD_HASH) &&
        email === process.env.ADMIN_EMAIL.toLowerCase()
      if (!ok) {
        recordFailure(ip)
        return send(res, 401, { error: 'invalid_credentials' })
      }
      clearFailures(ip)
      return send(res, 200, { admin: true, email }, { 'Set-Cookie': sessionCookie(req, createSession(email), SESSION_MAX_AGE_S) })
    }

    if (pathname === '/api/logout' && method === 'POST') {
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) })
    }

    if (!admin) return send(res, 401, { error: 'unauthorized' })

    if (pathname === '/api/countries/refresh' && method === 'POST') {
      try {
        return send(res, 200, await refreshFromWorldBank())
      } catch (e) {
        return send(res, 502, { error: 'refresh_failed', detail: String(e.message ?? e).slice(0, 400) })
      }
    }

    if (pathname === '/api/status' && method === 'GET') return send(res, 200, await systemStatus())

    if (pathname === '/api/setup' && method === 'POST') {
      const r = startRun('setup', {})
      return r.error ? send(res, 409, { error: r.error }) : send(res, 202, { id: r.run.id })
    }

    if (pathname === '/api/runs' && method === 'GET') return send(res, 200, { runs: listRuns() })

    if (pathname === '/api/runs' && method === 'POST') {
      const v = validate(await readBody(req))
      if (v.error) return send(res, 400, { error: v.error })
      const r = startRun('simulation', v.params)
      return r.error ? send(res, 409, { error: r.error }) : send(res, 202, { id: r.run.id })
    }

    const m = pathname.match(/^\/api\/runs\/([0-9a-f-]{36})(\/cancel)?$/)
    if (m) {
      const run = getRun(m[1])
      if (!run) return send(res, 404, { error: 'not_found' })
      if (m[2] && method === 'POST') return send(res, 200, { ok: cancelRun(run.id) })
      if (!m[2] && method === 'GET') return send(res, 200, { ...run, pid: undefined })
    }

    return send(res, 404, { error: 'not_found' })
  } catch (e) {
    const known = { too_large: 413, bad_json: 400 }
    return send(res, known[e.message] ?? 500, { error: known[e.message] ? e.message : 'server_error' })
  }
}
