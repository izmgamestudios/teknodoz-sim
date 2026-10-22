// SSRF-safe HTTP(S) fetch for admin-supplied URLs.
// - http/https only, default ports only, no credentials in the URL
// - every resolved address must be public (checked inside the socket `lookup`, so the checked IP is the connected IP)
// - redirects followed manually (max 3), each hop re-validated
// - size and time limits, text content types only
import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

const MAX_BYTES = 1_500_000
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3
const UA = 'TeknodozSimulationBot/0.1 (single-page review requested by an admin)'

export class FetchError extends Error {
  constructor(code, detail = '') {
    super(code)
    this.code = code
    this.detail = detail
  }
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0
}

const V4_BLOCKED = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([base, bits]) => [ipv4ToInt(base), bits])

export function isPublicIp(ip) {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip)
    return !V4_BLOCKED.some(([base, bits]) => (n >>> (32 - bits)) === (base >>> (32 - bits)))
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPublicIp(mapped[1])
    if (lower === '::' || lower === '::1') return false
    if (/^f[cd]/.test(lower)) return false // fc00::/7 unique local
    if (/^fe[89ab]/.test(lower)) return false // fe80::/10 link-local
    if (lower.startsWith('ff')) return false // multicast
    if (lower.startsWith('64:ff9b:') || lower.startsWith('2001:db8') || lower.startsWith('100:')) return false
    return true
  }
  return false
}

export function validateUrl(raw, { allowedHosts, allowPrivateForTests } = {}) {
  let u
  try {
    u = new URL(String(raw).trim())
  } catch {
    throw new FetchError('invalid_url')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new FetchError('invalid_url', 'protocol')
  if (u.username || u.password) throw new FetchError('invalid_url', 'credentials')
  if (allowPrivateForTests) return u // test-only escape hatch; never set from the API
  if (u.port && u.port !== (u.protocol === 'https:' ? '443' : '80')) throw new FetchError('invalid_url', 'port')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new FetchError('blocked_host')
  }
  if (net.isIP(host) && !isPublicIp(host)) throw new FetchError('blocked_host')
  if (allowedHosts && !allowedHosts.includes(host)) throw new FetchError('blocked_host')
  if (u.href.length > 2000) throw new FetchError('invalid_url', 'length')
  return u
}

export function guardedLookup(allowPrivate) {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err)
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: 4 }]
      if (!allowPrivate && (list.length === 0 || !list.every((a) => isPublicIp(a.address)))) {
        return callback(Object.assign(new Error('blocked_host'), { code: 'EBLOCKED' }))
      }
      if (options && options.all) return callback(null, list)
      return callback(null, list[0].address, list[0].family)
    })
  }
}

function once(u, { allowPrivate }) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname.replace(/^\[|\]$/g, ''),
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8', 'Accept-Encoding': 'identity' },
        lookup: guardedLookup(allowPrivate),
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          return resolve({ redirect: new URL(res.headers.location, u).href })
        }
        const type = String(res.headers['content-type'] || '').toLowerCase()
        if (!/^(text\/|application\/(xhtml\+xml|json))/.test(type)) {
          res.resume()
          return reject(new FetchError('unsupported_content', type))
        }
        if (status < 200 || status >= 300) {
          res.resume()
          return reject(new FetchError('http_error', String(status)))
        }
        const chunks = []
        let size = 0
        res.on('data', (c) => {
          size += c.length
          if (size > MAX_BYTES) {
            reject(new FetchError('too_large'))
            req.destroy()
          } else chunks.push(c)
        })
        res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), type, url: u.href }))
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new FetchError('timeout')))
    req.on('error', (e) => reject(e instanceof FetchError ? e : e.code === 'EBLOCKED' ? new FetchError('blocked_host') : new FetchError('network_error', e.code || '')))
    req.end()
  })
}

export async function safeFetchText(raw, opts = {}) {
  let u = validateUrl(raw, opts)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const r = await once(u, { allowPrivate: Boolean(opts.allowPrivateForTests) })
    if (!r.redirect) return r
    u = validateUrl(r.redirect, opts)
  }
  throw new FetchError('too_many_redirects')
}

// ---------- HTML -> compact text ----------
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }
const decode = (s) =>
  s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => (Number(n) < 0x110000 ? String.fromCodePoint(Number(n)) : ''))
const clean = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

function metaContent(html, key) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1]
  return content ? decode(content).trim() : ''
}

export function extractPage(html, maxChars = 6000) {
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || metaContent(html, 'og:title')
  const description = metaContent(html, 'description') || metaContent(html, 'og:description')
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
  const headings = [...stripped.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => clean(m[2])).filter(Boolean).slice(0, 25)
  const body = stripped.match(/<body[\s\S]*<\/body>/i)?.[0] ?? stripped
  const text = clean(body.replace(/<\/(p|div|li|h[1-6]|section|article|tr|br)>/gi, '$& '))
  return { title: title.slice(0, 200), description: description.slice(0, 500), headings, text: text.slice(0, maxChars), truncated: text.length > maxChars }
}
