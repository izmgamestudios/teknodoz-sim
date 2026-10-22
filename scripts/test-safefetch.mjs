// Run: node scripts/test-safefetch.mjs
import assert from 'node:assert/strict'
import http from 'node:http'
import { extractPage, FetchError, guardedLookup, isPublicIp, safeFetchText, validateUrl } from '../server/safefetch.mjs'

// ---- IP classification ----
for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'])
  assert.equal(isPublicIp(ip), false, `${ip} must be blocked`)
for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111'])
  assert.equal(isPublicIp(ip), true, `${ip} must be allowed`)

// ---- URL validation ----
const bad = ['file:///etc/passwd', 'ftp://example.com', 'javascript:alert(1)', 'http://localhost/', 'http://foo.localhost/', 'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/', 'https://user:pw@example.com/', 'http://example.com:8080/', 'https://example.com:22/', 'http://printer.local/', 'http://metadata.internal/', 'not a url', '']
for (const u of bad) assert.throws(() => validateUrl(u), FetchError, `must reject ${u}`)
assert.doesNotThrow(() => validateUrl('https://example.com/path?q=1'))
assert.throws(() => validateUrl('https://evil.example.com/', { allowedHosts: ['itunes.apple.com'] }), /blocked_host/)

// ---- connect-time guard: a name that resolves to loopback must be refused by the socket lookup ----
await new Promise((resolve) =>
  guardedLookup(false)('localhost', {}, (err) => {
    assert.equal(err?.code, 'EBLOCKED', 'localhost lookup must be blocked')
    resolve()
  }),
)
await new Promise((resolve) =>
  guardedLookup(true)('localhost', {}, (err, addr) => {
    assert.ifError(err)
    assert.ok(addr)
    resolve()
  }),
)

// ---- real request path against a local server (private IPs allowed only via the test flag) ----
const server = http.createServer((req, res) => {
  if (req.url === '/redir') { res.writeHead(302, { Location: 'http://169.254.169.254/' }); return res.end() }
  if (req.url === '/bin') { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return res.end('x') }
  if (req.url === '/big') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('a'.repeat(2_000_000)) }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<html><head><title>Hello &amp; Welcome</title><meta name="description" content="A demo page"></head><body><script>var x=1</script><h1>Big Headline</h1><p>Some <b>bold</b> text.</p><style>.a{}</style><!-- hidden --><h2>Pricing</h2><p>$9 per month</p></body></html>')
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const T = { allowPrivateForTests: true }
const ok = await safeFetchText(`http://127.0.0.1:${port}/`, T)
assert.match(ok.type, /text\/html/)
await assert.rejects(() => safeFetchText(`http://127.0.0.1:${port}/bin`, T), /unsupported_content/)
await assert.rejects(() => safeFetchText(`http://127.0.0.1:${port}/big`, T), /too_large/)
// without the test flag the same local URL is refused up front
await assert.rejects(() => safeFetchText(`http://127.0.0.1:${port}/`), /blocked_host|invalid_url/)
const page = extractPage(ok.body)
assert.equal(page.title, 'Hello & Welcome')
assert.equal(page.description, 'A demo page')
assert.deepEqual(page.headings, ['Big Headline', 'Pricing'])
assert.ok(page.text.includes('Some bold text.') && page.text.includes('$9 per month'))
assert.ok(!page.text.includes('var x') && !page.text.includes('hidden') && !page.text.includes('.a{}'))
server.close()

// extraction limits
const long = extractPage(`<body><p>${'word '.repeat(5000)}</p></body>`, 1000)
assert.equal(long.text.length, 1000)
assert.equal(long.truncated, true)
console.log('OK safefetch')
