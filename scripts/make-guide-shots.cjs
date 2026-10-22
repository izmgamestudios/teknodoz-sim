// Generates guide screenshots from the running app into public/guide/<lang>/*.jpg.
// Usage: BASE=http://127.0.0.1:3000 GUIDE_EMAIL=... GUIDE_PASSWORD=... node scripts/make-guide-shots.cjs
// Needs Playwright (global install) and a server started with ADMIN_EMAIL / ADMIN_PASSWORD_HASH for that account.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')

const BASE = process.env.BASE || 'http://127.0.0.1:3000'
const EMAIL = process.env.GUIDE_EMAIL
const PASSWORD = process.env.GUIDE_PASSWORD
if (!EMAIL || !PASSWORD) throw new Error('GUIDE_EMAIL and GUIDE_PASSWORD are required')

const OUT = path.join(__dirname, '..', 'public', 'guide')
const LOCALES = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', es: 'es-ES' }
const PER_COUNTRY = { tr: 'Ülke başına seç', en: 'Pick per country', de: 'Pro Land wählen', es: 'Elegir por país' }
const MODE_AUTO = 'auto'
const NAV = { dashboard: 1, personas: 2, runs: 3, study: 4, guide: 5, faq: 6, admin: 7 }
const SAMPLE_BRIEF = 'Source: https://example.com/pricing\n\nTitle: NotePilot: meeting notes that write themselves\n\nPage text:\nNotePilot joins your video calls, transcribes them and sends a summary with action items within minutes. Free for 5 meetings a month. Pro is $15 per user per month.'
const SAMPLE_LINES = 'How clear is the offer? \nWhich plan would you pick? | Free | Pro | Team\nAnything else you would like to tell us? [text]'

async function shot(page, file, opts = {}) {
  await page.screenshot({ path: file, type: 'jpeg', quality: 68, ...opts })
}

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  for (const [lang, locale] of Object.entries(LOCALES)) {
    const dir = path.join(OUT, lang)
    fs.mkdirSync(dir, { recursive: true })
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 }, locale, colorScheme: 'light' })
    await ctx.addInitScript(([l]) => {
      try { localStorage.setItem('teknodoz-theme', 'light'); localStorage.setItem('teknodoz-lang', l) } catch {}
    }, [lang])
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    const goto = async (name) => { await page.click(`aside nav button:nth-child(${NAV[name]})`); await page.waitForTimeout(450) }
    const out = (n) => path.join(dir, `${n}.jpg`)

    await page.goto(BASE + '/'); await page.waitForTimeout(600)
    await goto('admin'); await shot(page, out('01-login'))
    await page.fill('input[type=email]', EMAIL); await page.fill('input[type=password]', PASSWORD)
    await page.click('button[type=submit]'); await page.waitForTimeout(1300)
    await goto('dashboard'); await page.waitForTimeout(500); await shot(page, out('02-dashboard'))

    await goto('personas'); await page.waitForTimeout(900)
    await page.locator('button[aria-expanded]').click()
    for (const iso of ['TR', 'DE', 'US']) await page.locator(`label:has(span:text-is("${iso}")) input`).check()
    await page.waitForTimeout(200)
    await shot(page, out('03-personas'))
    await page.mouse.click(1050, 40)
    await page.fill('input[type=number]', '5')
    await page.click(`button:has-text("${PER_COUNTRY[lang]}")`); await page.waitForTimeout(300)
    await shot(page, out('04-bulk'))
    await page.locator('ul > li button').first().click(); await page.waitForTimeout(300)
    await shot(page, out('05-detail'))
    await page.keyboard.press('Escape'); await page.waitForTimeout(150)

    await goto('study')
    await page.locator('[role=tab]').nth(1).click()
    await page.fill('input[type=url]', 'https://example.com/pricing')
    await page.fill('input[maxlength="80"]', 'NotePilot landing page')
    await page.fill('textarea[maxlength="8000"]', SAMPLE_BRIEF)
    await shot(page, out('06-study-source'))
    const cards = page.locator('section > div.rounded-xl')
    await cards.nth(1).locator('summary').click()
    await cards.nth(1).locator('textarea.font-mono').fill(SAMPLE_LINES)
    await cards.nth(1).scrollIntoViewIfNeeded(); await page.waitForTimeout(200)
    await shot(page, out('07-study-questions'), { clip: undefined })
    await cards.nth(2).locator('select').first().selectOption(MODE_AUTO)
    await cards.nth(2).scrollIntoViewIfNeeded(); await page.waitForTimeout(200)
    await shot(page, out('08-run'))

    // example thumbnails: load each example through the guide page, then shoot the study builder
    for (const id of ['coffee', 'landing', 'store', 'pricing', 'support']) {
      await goto('guide')
      const idx = ['coffee', 'landing', 'store', 'pricing', 'support'].indexOf(id)
      await page.locator('article button').nth(idx).click(); await page.waitForTimeout(400)
      await goto('study'); await page.waitForTimeout(350)
      await page.evaluate(() => window.scrollTo(0, 0))
      await shot(page, out(`ex-${id}`))
    }
    console.log(lang, 'done', errors.length ? errors : '')
    await ctx.close()
  }
  await browser.close()
})()
