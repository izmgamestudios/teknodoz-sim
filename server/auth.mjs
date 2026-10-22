import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex')

export function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$')
  if (alg !== 'scrypt' || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p),
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const sign = (data) => createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')

export function createSession(email) {
  const payload = Buffer.from(JSON.stringify({ sub: email, exp: Date.now() + SESSION_TTL_MS })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function readSession(token) {
  const [payload, sig] = String(token || '').split('.')
  if (!payload || !sig) return null
  const good = Buffer.from(sign(payload))
  const given = Buffer.from(sig)
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return data.exp > Date.now() ? data : null
  } catch {
    return null
  }
}

export const SESSION_MAX_AGE_S = SESSION_TTL_MS / 1000

const attempts = new Map()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

export function isLockedOut(ip) {
  const a = attempts.get(ip)
  if (!a || a.resetAt < Date.now()) return false
  return a.count >= MAX_ATTEMPTS
}

export function recordFailure(ip) {
  const a = attempts.get(ip)
  if (!a || a.resetAt < Date.now()) attempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS })
  else a.count += 1
}

export const clearFailures = (ip) => attempts.delete(ip)
