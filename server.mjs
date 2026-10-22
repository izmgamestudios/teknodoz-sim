// Minimal static server for the Vite build (CloudPanel Node.js site). No dependencies.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)))
} catch {
  /* .env is optional */
}

const { handleApi } = await import('./server/api.mjs')

const ROOT = resolve(fileURLToPath(new URL('./dist', import.meta.url)))
const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '127.0.0.1'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

async function resolveFile(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '')
  const full = join(ROOT, rel)
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null
  try {
    const s = await stat(full)
    if (s.isFile()) return full
    if (s.isDirectory()) return join(full, 'index.html')
  } catch {
    /* fall through to SPA index */
  }
  return extname(rel) ? null : join(ROOT, 'index.html')
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname)
    const file = await resolveFile(pathname)
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found')
      return
    }
    const body = await readFile(file)
    const ext = extname(file)
    res.writeHead(200, {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
    })
    res.end(body)
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Bad request')
  }
}).listen(PORT, HOST, () => console.log(`teknodoz-sim on http://${HOST}:${PORT}`))
