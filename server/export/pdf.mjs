import { join } from 'node:path'
import PDFDocument from 'pdfkit'
import { ROOT } from '../paths.mjs'

const FONT = join(ROOT, 'server', 'fonts', 'DejaVuSans.ttf')
const BOLD = join(ROOT, 'server', 'fonts', 'DejaVuSans-Bold.ttf')
const BRAND = '#6366f1'
const MARGIN = 50
const pc = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`)
const isChoice = (q) => q.type === 'single_choice' || q.type === 'multi_choice'
let nf = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })
const fmt = (v) => (v === null || v === undefined ? '—' : typeof v === 'number' ? nf.format(v) : String(v))
const clean = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

export function buildPdf(report) {
  nf = new Intl.NumberFormat(report.lang, { maximumFractionDigits: 2 })
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, info: { Title: clean(report.title), Author: 'Teknodoz Simulation', Subject: clean(report.reportTitle) } })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.registerFont('R', FONT)
    doc.registerFont('B', BOLD)
    const L = report.labels
    const W = doc.page.width - MARGIN * 2
    const bottom = () => doc.page.height - MARGIN - 20

    const ensure = (h) => {
      if (doc.y + h > bottom()) doc.addPage()
    }
    const h1 = (text) => {
      ensure(60)
      doc.moveDown(0.8).font('B').fontSize(15).fillColor('#4338ca').text(clean(text), { width: W }).moveDown(0.3)
    }
    const h2 = (text) => {
      ensure(50)
      doc.moveDown(0.5).font('B').fontSize(11).fillColor('#0f172a').text(clean(text), { width: W }).moveDown(0.15)
    }
    const para = (text, opts = {}) => {
      doc.font(opts.bold ? 'B' : 'R').fontSize(opts.size ?? 9.5).fillColor(opts.color ?? '#1e293b')
      ensure(doc.heightOfString(clean(text), { width: opts.width ?? W }) + 4)
      doc.text(clean(text), { width: opts.width ?? W, indent: opts.indent ?? 0 })
    }
    const notice = (text, warn) => {
      doc.font(warn ? 'B' : 'R').fontSize(9)
      const h = doc.heightOfString(clean(text), { width: W - 16 }) + 12
      ensure(h + 8)
      const y = doc.y
      doc.save().roundedRect(MARGIN, y, W, h, 4).fill(warn ? '#fef3c7' : '#e0e7ff').restore()
      doc.fillColor('#1e293b').text(clean(text), MARGIN + 8, y + 6, { width: W - 16 })
      doc.y = y + h + 8
      doc.x = MARGIN
    }
    const bar = (x, y, w, share) => {
      doc.save().rect(x, y, w, 7).fill('#e2e8f0').restore()
      if (share > 0) doc.save().rect(x, y, Math.max(1, w * Math.min(1, share)), 7).fill(BRAND).restore()
    }
    const barRows = (rows) => {
      // rows: [{label, value, share}]
      for (const r of rows) {
        doc.font('R').fontSize(8.5)
        const label = clean(r.label)
        const lh = Math.min(doc.heightOfString(label, { width: 200 }), 24)
        ensure(Math.max(lh, 10) + 6)
        const y = doc.y
        doc.fillColor('#1e293b').text(label, MARGIN, y, { width: 200, height: 24, ellipsis: true })
        bar(MARGIN + 210, y + 2, 180, r.share)
        doc.fillColor('#475569').text(r.value, MARGIN + 400, y, { width: W - 400, align: 'right' })
        doc.y = y + Math.max(lh, 10) + 4
        doc.x = MARGIN
      }
    }
    const table = (rows, widths) => {
      doc.fontSize(8.5)
      rows.forEach((row, ri) => {
        const cells = row.map((c) => clean(c))
        doc.font(ri === 0 ? 'B' : 'R')
        const h = Math.max(...cells.map((c, i) => doc.heightOfString(c, { width: widths[i] - 8 }))) + 6
        ensure(h)
        const y = doc.y
        if (ri === 0) doc.save().rect(MARGIN, y, widths.reduce((a, b) => a + b, 0), h).fill('#e0e7ff').restore()
        let x = MARGIN
        cells.forEach((c, i) => {
          doc.fillColor('#1e293b').text(c, x + 4, y + 3, { width: widths[i] - 8 })
          x += widths[i]
        })
        doc.save().moveTo(MARGIN, y + h).lineTo(MARGIN + widths.reduce((a, b) => a + b, 0), y + h).lineWidth(0.4).stroke('#cbd5e1').restore()
        doc.y = y + h
        doc.x = MARGIN
      })
      doc.moveDown(0.5)
    }

    // ----- title block -----
    doc.font('B').fontSize(22).fillColor('#312e81').text(clean(report.title), { width: W })
    doc.font('R').fontSize(11).fillColor('#64748b').text(clean(report.reportTitle), { width: W }).moveDown(0.8)
    table(
      [
        [L.task, report.meta.taskId], [L.mode, report.meta.mode], [L.model, report.meta.model], [L.pool, report.meta.pool],
        [L.respondents, String(report.meta.respondents)], [L.seed, String(report.meta.seed)], [L.date, report.meta.runDate], [report.generatedLabel, report.generatedAt],
      ].map((r) => r).map((r, i) => (i === 0 ? r : r)),
      [150, W - 150],
    )
    for (const n of report.notices) notice(n.text, n.kind === 'warn')

    h1(report.sections.findings)
    for (const f of report.findings) para(`•  ${f}`, { indent: 6 })

    h1(report.sections.questions)
    report.questions.forEach((q, i) => {
      h2(`${i + 1}. ${q.prompt}`)
      if (q.type === 'likert') {
        const stats = [`${L.n}: ${q.n}`, `${L.mean}: ${fmt(q.mean)}`, `${L.sd}: ${fmt(q.sd)}`, `${L.median}: ${fmt(q.median)}`]
        if (q.top2 !== undefined) stats.push(`${L.top2}: ${pc(q.top2)}`)
        if (q.nps) stats.push(`${L.nps}: ${q.nps.score}`)
        para(stats.join('   ·   '), { color: '#475569', size: 8.5 })
        barRows(Object.entries(q.hist).map(([k, v]) => ({ label: k, value: `${v} · ${pc(q.n ? v / q.n : 0)}`, share: q.n ? v / q.n : 0 })))
      } else if (isChoice(q)) {
        para(`${L.n}: ${q.n}`, { color: '#475569', size: 8.5 })
        barRows(q.options.map((o) => ({ label: o.label, value: `${o.count} · ${pc(o.share)}`, share: o.share })))
      } else {
        para(`${L.n}: ${q.n}`, { color: '#475569', size: 8.5 })
        for (const tx of q.texts.slice(0, 15)) para(`–  ${tx}`, { indent: 6, size: 8.5 })
      }
    })

    const qNo = new Map(report.questions.map((q, i) => [q.id, i + 1]))
    for (const s of report.segments) {
      h1(`${report.sections.segments}: ${s.label}`)
      for (const r of s.rows) para(`Q${qNo.get(r.questionId)}: ${r.prompt.length > 90 ? `${r.prompt.slice(0, 87)}…` : r.prompt}${r.kind === 'share' ? `  →  ${r.topLabel}` : ''}`, { size: 7.5, color: '475569' })
      doc.moveDown(0.3)
      const first = 130
      const each = Math.max(34, Math.floor((W - first) / Math.max(1, s.rows.length)))
      table(
        [[s.label, ...s.rows.map((r) => `Q${qNo.get(r.questionId)}`)], ...s.groups.map((g) => [`${g.label} (${L.n}=${g.n})`, ...s.rows.map((r) => (r.cells[g.value] == null ? '—' : r.kind === 'share' ? pc(r.cells[g.value]) : fmt(r.cells[g.value])))])],
        [first, ...s.rows.map(() => each)],
      )
    }

    for (const a of report.analyses) {
      if (a.type === 'vw') {
        h1(report.sections.vw)
        table([[L.point, `${L.price} (${a.currency})`], ...[['pmc', L.pmc], ['opp', L.opp], ['ipp', L.ipp], ['pme', L.pme]].map(([k, label]) => [label, fmt(a.points?.[k])])], [330, W - 330])
        if (a.curves.length > 1) {
          ensure(210)
          const x0 = MARGIN + 30, y0 = doc.y + 8, cw = W - 40, ch = 150
          const minP = a.curves[0].price, maxP = a.curves[a.curves.length - 1].price || 1
          const px = (p) => x0 + ((p - minP) / (maxP - minP || 1)) * cw
          const py = (v) => y0 + ch - v * ch
          doc.save().lineWidth(0.5).strokeColor('#cbd5e1').rect(x0, y0, cw, ch).stroke().restore()
          const series = [['tooCheap', '#0ea5e9', L.tooCheap], ['cheap', '#22c55e', L.cheap], ['expensive', '#f59e0b', L.expensive], ['tooExpensive', '#ef4444', L.tooExpensive]]
          for (const [key, color] of series) {
            doc.save().lineWidth(1.4).strokeColor(color)
            a.curves.forEach((c, i) => (i === 0 ? doc.moveTo(px(c.price), py(c[key])) : doc.lineTo(px(c.price), py(c[key]))))
            doc.stroke().restore()
          }
          let lx = x0
          doc.font('R').fontSize(8)
          for (const [, color, label] of series) {
            doc.save().rect(lx, y0 + ch + 10, 8, 8).fill(color).restore()
            doc.fillColor('#334155').text(clean(label), lx + 12, y0 + ch + 9, { lineBreak: false })
            lx += 20 + doc.widthOfString(clean(label)) + 10
          }
          doc.fillColor('#64748b').text(`${minP}`, x0 - 4, y0 + ch + 24, { lineBreak: false }).text(`${maxP}`, x0 + cw - 20, y0 + ch + 24, { lineBreak: false })
          doc.y = y0 + ch + 44
          doc.x = MARGIN
        }
      }
      if (a.type === 'mvt') {
        h1(report.sections.mvt)
        table([[L.attribute, L.level, L.shown, L.chosen, L.rate], ...a.attributes.flatMap((at) => at.levels.map((lv) => [at.label, lv.label, String(lv.shown), String(lv.chosen), pc(lv.rate)])), [L.neither, '', '', String(a.neither.count), pc(a.neither.rate)]], [90, W - 90 - 3 * 55, 55, 55, 55])
      }
    }

    h1(report.sections.method)
    for (const m of report.method) para(`•  ${m}`, { indent: 6, size: 8.5 })

    // footers (page numbers) after layout is final
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      doc.page.margins.bottom = 0
      doc.font('R').fontSize(8).fillColor('#94a3b8').text(`${clean(report.footer)}   ·   ${i + 1} / ${range.count}`, MARGIN, doc.page.height - 36, { width: W, align: 'center', lineBreak: false })
    }
    doc.end()
  })
}
