import { strToU8, zipSync } from 'fflate'

const INVALID_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g
const esc = (s) => String(s).replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function run(text, { bold = false, color, size, italic = false } = {}) {
  const props = `${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}${size ? `<w:sz w:val="${size}"/>` : ''}`
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

function p(content, { style, shade, after = 120, indent } = {}) {
  const runs = typeof content === 'string' ? run(content) : content.join('')
  const ppr = `${style ? `<w:pStyle w:val="${style}"/>` : ''}${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ''}<w:spacing w:after="${after}"/>${indent ? `<w:ind w:left="${indent}" w:hanging="240"/>` : ''}`
  return `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`
}

function cell(text, width, { bold = false, fill } = {}) {
  const tcpr = `<w:tcW w:w="${width}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}`
  return `<w:tc><w:tcPr>${tcpr}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run(text, { bold, size: 18 })}</w:p></w:tc>`
}

function table(rows, widths, { header = true } = {}) {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')
  const body = rows.map((r, ri) => `<w:tr>${r.map((c, ci) => cell(String(c ?? ''), widths[ci], { bold: header && ri === 0, fill: header && ri === 0 ? 'E0E7FF' : undefined })).join('')}</w:tr>`).join('')
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>`).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>${p('', { after: 120 })}`
}

const bar = (share, n = 20) => {
  const k = Math.max(0, Math.min(n, Math.round((share ?? 0) * n)))
  return '█'.repeat(k) + '░'.repeat(n - k)
}
const pc = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`)
let nf = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })
const fmt = (v) => (v === null || v === undefined ? '—' : typeof v === 'number' ? nf.format(v) : String(v))
const isChoice = (q) => q.type === 'single_choice' || q.type === 'multi_choice'

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="312E81"/><w:sz w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="4338CA"/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
</w:styles>`

export function buildDocx(report) {
  nf = new Intl.NumberFormat(report.lang, { maximumFractionDigits: 2 })
  const L = report.labels
  const body = []
  body.push(p(report.title, { style: 'Title' }))
  body.push(p([run(report.reportTitle, { color: '64748B', size: 24 })], { after: 200 }))
  const meta = [
    [L.task, report.meta.taskId], [L.mode, report.meta.mode], [L.model, report.meta.model], [L.pool, report.meta.pool],
    [L.respondents, String(report.meta.respondents)], [L.seed, String(report.meta.seed)], [L.date, report.meta.runDate], [report.generatedLabel, report.generatedAt],
  ]
  body.push(table(meta, [2600, 6400], { header: false }))
  for (const n of report.notices) body.push(p([run(n.text, { bold: n.kind === 'warn' })], { shade: n.kind === 'warn' ? 'FEF3C7' : 'E0E7FF', after: 160 }))

  body.push(p(report.sections.findings, { style: 'Heading1' }))
  for (const f of report.findings) body.push(p(`• ${f}`, { indent: 360, after: 60 }))

  body.push(p(report.sections.questions, { style: 'Heading1' }))
  report.questions.forEach((q, i) => {
    body.push(p(`${i + 1}. ${q.prompt}`, { style: 'Heading2' }))
    if (q.type === 'likert') {
      const stats = [`${L.n}: ${q.n}`, `${L.mean}: ${fmt(q.mean)}`, `${L.sd}: ${fmt(q.sd)}`, `${L.median}: ${fmt(q.median)}`]
      if (q.top2 !== undefined) stats.push(`${L.top2}: ${pc(q.top2)}`)
      if (q.nps) stats.push(`${L.nps}: ${q.nps.score} (${L.promoters} ${q.nps.promoters}%, ${L.passives} ${q.nps.passives}%, ${L.detractors} ${q.nps.detractors}%)`)
      body.push(p(stats.join(' · ')))
      const rows = [[L.value, L.count, L.share, '']]
      for (const [k, v] of Object.entries(q.hist)) rows.push([k, v, pc(q.n ? v / q.n : 0), bar(q.n ? v / q.n : 0)])
      body.push(table(rows, [1200, 1200, 1400, 5200]))
    } else if (isChoice(q)) {
      body.push(p(`${L.n}: ${q.n}`))
      const rows = [[L.option, L.count, L.share, '']]
      for (const o of q.options) rows.push([o.label, o.count, pc(o.share), bar(o.share, 16)])
      body.push(table(rows, [3900, 900, 1000, 3200]))
    } else {
      body.push(p(`${L.n}: ${q.n}`))
      for (const t of q.texts.slice(0, 30)) body.push(p(`– ${t}`, { indent: 360, after: 40 }))
    }
  })

  const qNo = new Map(report.questions.map((q, i) => [q.id, i + 1]))
  for (const s of report.segments) {
    body.push(p(`${report.sections.segments}: ${s.label}`, { style: 'Heading2' }))
    for (const r of s.rows) body.push(p([run(`Q${qNo.get(r.questionId)}: `, { bold: true, size: 17 }), run(`${r.prompt.length > 80 ? `${r.prompt.slice(0, 77)}…` : r.prompt}${r.kind === 'share' ? ` → ${r.topLabel}` : ''}`, { size: 17, color: '475569' })], { after: 20 }))
    const k = s.rows.length
    const first = 2600
    const each = Math.max(560, Math.floor((9000 - first) / Math.max(1, k)))
    const rows = [[s.label, ...s.rows.map((r) => `Q${qNo.get(r.questionId)}`)]]
    for (const g of s.groups) rows.push([`${g.label} (${L.n}=${g.n})`, ...s.rows.map((r) => (r.cells[g.value] === null || r.cells[g.value] === undefined ? '—' : r.kind === 'share' ? pc(r.cells[g.value]) : fmt(r.cells[g.value])))])
    body.push(table(rows, [first, ...s.rows.map(() => each)]))
  }

  for (const a of report.analyses) {
    if (a.type === 'vw') {
      body.push(p(report.sections.vw, { style: 'Heading1' }))
      const rows = [[L.point, `${L.price} (${a.currency})`]]
      for (const [k, label] of [['pmc', L.pmc], ['opp', L.opp], ['ipp', L.ipp], ['pme', L.pme]]) rows.push([label, fmt(a.points?.[k])])
      body.push(table(rows, [6000, 3000]))
    }
    if (a.type === 'mvt') {
      body.push(p(report.sections.mvt, { style: 'Heading1' }))
      const rows = [[L.attribute, L.level, L.shown, L.chosen, L.rate]]
      for (const at of a.attributes) for (const lv of at.levels) rows.push([at.label, lv.label, lv.shown, lv.chosen, pc(lv.rate)])
      rows.push([L.neither, '', '', a.neither.count, pc(a.neither.rate)])
      body.push(table(rows, [1700, 3900, 1000, 1000, 1400]))
    }
  }

  const reasons = report.questions.filter(isChoice).flatMap((q) => report.respondents.filter((r) => r.rationales[q.id]).map((r) => ({ q, r })))
  if (reasons.length) {
    body.push(p(report.sections.texts, { style: 'Heading1' }))
    for (const { q, r } of reasons.slice(0, 40)) body.push(p([run(`${r.personaId ?? r.index} · ${q.prompt.slice(0, 60)}: `, { bold: true, size: 18 }), run(r.rationales[q.id], { size: 18 })], { after: 60 }))
  }

  body.push(p(report.sections.method, { style: 'Heading1' }))
  for (const m of report.method) body.push(p(`• ${m}`, { indent: 360, after: 60 }))
  body.push(p([run(report.footer, { italic: true, color: '64748B', size: 18 })], { after: 0 }))

  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/_rels/document.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'word/styles.xml': strToU8(STYLES),
    'word/document.xml': strToU8(doc),
  }
  return Buffer.from(zipSync(files, { level: 6 }))
}
