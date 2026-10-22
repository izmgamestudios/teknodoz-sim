// Settings sanitizer, override application and country-edit validation. Run: node --experimental-strip-types scripts/test-settings.mjs
import assert from 'node:assert/strict'
import { applyOverrides, defaultSettings, flattenStrings, pickText, safeUrl, sanitizeSettings, SETTINGS_LANGS } from '../src/settings.ts'
import { loadDict } from '../server/i18n.mjs'
import { saveCountryEdits } from '../server/countries.mjs'

const dicts = {}
const known = {}
for (const l of SETTINGS_LANGS) { dicts[l] = await loadDict(l); known[l] = flattenStrings(dicts[l]) }

// defaults round-trip
const d = defaultSettings()
assert.deepEqual(sanitizeSettings(d, known), d)
assert.deepEqual(sanitizeSettings(null, known), d)
assert.deepEqual(sanitizeSettings('x', known), d)

// URL policy
assert.equal(safeUrl('javascript:alert(1)'), '')
assert.equal(safeUrl('data:text/html,x'), '')
assert.equal(safeUrl('//evil.com'), '')
assert.equal(safeUrl('https://example.com/a b'), 'https://example.com/a%20b')
assert.equal(safeUrl('mailto:a@b.co'), 'mailto:a@b.co')

// hostile input
const hostile = sanitizeSettings({
  brand: { nameA: '<b>x</b>', logoUrl: 'javascript:alert(1)', beta: { tr: 'Beta', xx: 'no' } },
  design: { brandColor: 'red', radius: 'huge', sidebarWidth: 99999, fontScale: -4, enabledLangs: ['xx'], defaultLang: 'fr', defaultTheme: 'neon' },
  sidebar: { items: [
    { type: 'builtin', ref: 'faq', visible: false, icon: '☺' },
    { type: 'builtin', ref: 'faq' },
    { type: 'builtin', ref: 'nope' },
    { type: 'link', ref: 'javascript:1' },
    { type: 'link', ref: 'https://example.com', label: { en: 'Ex' } },
    { type: 'page', ref: 'missing' },
  ] },
  pages: { disabled: ['admin', 'faq', 'zzz'], custom: [
    { slug: 'About', title: { en: 'About' }, body: { en: '# Hi' } },
    { slug: 'dashboard', title: { en: 'x' } },
    { slug: '../etc', title: { en: 'x' } },
    { slug: 'about', title: { en: 'dup' } },
  ] },
  header: { links: [{ type: 'page', ref: 'about', label: { en: 'A' } }] },
  content: {
    en: { 'nav.faq': 'Questions', '__proto__.polluted': 'y', 'constructor.prototype.x': 'y', 'nav.nonexistent': 'z', 'faq.items.0.q': 'Q?' },
    xx: { 'nav.faq': 'bad' },
  },
  seed: { hiddenCountries: ['TR', 'turkey', 'DE'], models: ['gpt-5', 'bad model!', 'a/b:c'] },
}, known)
assert.equal(hostile.brand.logoUrl, '')
assert.deepEqual(hostile.brand.beta, { tr: 'Beta' })
assert.equal(hostile.design.brandColor, '#6366f1')
assert.equal(hostile.design.radius, 'md')
assert.equal(hostile.design.sidebarWidth, 320)
assert.equal(hostile.design.fontScale, 90)
assert.deepEqual(hostile.design.enabledLangs, SETTINGS_LANGS)
assert.equal(hostile.design.defaultLang, '')
assert.equal(hostile.design.defaultTheme, 'system')
const faq = hostile.sidebar.items.filter((e) => e.ref === 'faq')
assert.equal(faq.length, 1)
assert.equal(faq[0].visible, false)
assert.equal(hostile.sidebar.items.filter((e) => e.type === 'builtin').length, 8)
assert.ok(hostile.sidebar.items.some((e) => e.type === 'link' && e.ref === 'https://example.com/'))
assert.ok(!hostile.sidebar.items.some((e) => e.ref.startsWith('javascript') || e.ref === 'missing'))
assert.deepEqual(hostile.pages.disabled, ['faq'])
assert.deepEqual(hostile.pages.custom.map((p) => p.slug), ['about'])
assert.equal(hostile.header.links.length, 1)
assert.deepEqual(Object.keys(hostile.content), ['en'])
assert.deepEqual(hostile.content.en, { 'nav.faq': 'Questions', 'faq.items.0.q': 'Q?' })
assert.equal({}.polluted, undefined)
assert.deepEqual(hostile.seed.hiddenCountries, ['TR', 'DE'])
assert.deepEqual(hostile.seed.models, ['gpt-5', 'a/b:c'])

// override application never mutates the source or changes structure
const base = dicts.en
const before = JSON.stringify(base)
const over = applyOverrides(base, hostile.content.en)
assert.equal(JSON.stringify(base), before)
assert.equal(over.nav.faq, 'Questions')
assert.equal(over.faq.items[0].q, 'Q?')
assert.equal(over.faq.items[0].a, base.faq.items[0].a)
assert.equal(Object.keys(flattenStrings(over)).length, Object.keys(known.en).length)
assert.equal(applyOverrides(base, { '__proto__.x': 'y', 'nav.faq.zzz': 'q', 'dashboard.steps': 'str' }).dashboard.steps.length, base.dashboard.steps.length)
assert.equal({}.x, undefined)

assert.equal(pickText({ de: 'Hallo' }, 'tr'), 'Hallo')
assert.equal(pickText({ en: 'Hi', tr: 'Selam' }, 'tr'), 'Selam')
assert.equal(pickText(undefined, 'tr'), '')

// country edit validation (all fail before anything is written)
for (const bad of [
  [{ iso2: 'ZZ', y: 10 }],
  [{ iso2: 'TR', y: 101 }],
  [{ iso2: 'TR', y: 70, e: 60 }],
  [{ iso2: 'TR', gdp: 'x' }],
  'nope',
]) assert.throws(() => saveCountryEdits(bad))
assert.throws(() => saveCountryEdits([], { perCountry: 3 }))
assert.throws(() => saveCountryEdits([], { seed: -1 }))
console.log('OK settings')
