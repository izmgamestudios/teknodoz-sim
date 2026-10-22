import { strToU8, zipSync } from 'fflate'

const INVALID_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g
const esc = (s) => String(s).replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// style ids (see styles.xml below)
const S = { normal: 0, header: 1, title: 2, wrap: 3, percent: 4, number: 5, warn: 6, bold: 7 }

function colName(i) {
  let n = i + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const str = (v, style = S.normal) => ({ v: v === null || v === undefined ? '' : String(v), style })
const num = (v, style = S.number) => (v === null || v === undefined || Number.isNaN(v) ? str('') : { v: Number(v), style, num: true })

function sheetXml(rows, { freeze = false } = {}) {
  const widths = []
  rows.forEach((r) => r.forEach((c, i) => {
    const len = c.num ? 10 : Math.min(60, String(c.v).split('\n').reduce((m, l) => Math.max(m, l.length), 0))
    widths[i] = Math.max(widths[i] ?? 8, Math.min(60, len + 2))
  }))
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  const data = rows
    .map((r, ri) => {
      const cells = r
        .map((c, ci) => {
          const ref = `${colName(ci)}${ri + 1}`
          if (c.num) return `<c r="${ref}" s="${c.style}"><v>${c.v}</v></c>`
          if (c.v === '') return `<c r="${ref}" s="${c.style}"/>`
          return `<c r="${ref}" s="${c.style}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`
        })
        .join('')
      return `<row r="${ri + 1}">${cells}</row>`
    })
    .join('')
  const pane = freeze ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><cols>${cols}</cols><sheetData>${data}</sheetData></worksheet>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function safeSheetName(name, used) {
  let base = String(name).replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet'
  let candidate = base
  let i = 2
  while (used.has(candidate.toLowerCase())) candidate = `${base.slice(0, 28)} ${i++}`
  used.add(candidate.toLowerCase())
  return candidate
}

const answerCell = (v) => (Array.isArray(v) ? str(v.join('; ')) : typeof v === 'number' ? num(v, S.normal) : str(v ?? ''))
const isChoice = (q) => q.type === 'single_choice' || q.type === 'multi_choice'

export function buildXlsx(report) {
  const L = report.labels
  const sheets = []

  // Summary
  const sum = [[str(report.title, S.title)], [str(report.reportTitle, S.bold)], []]
  const kv = (k, v) => sum.push([str(k, S.bold), str(v, S.wrap)])
  kv(L.task, report.meta.taskId)
  kv(L.mode, report.meta.mode)
  kv(L.model, report.meta.model)
  kv(L.pool, report.meta.pool)
  kv(L.respondents, report.meta.respondents)
  kv(L.seed, report.meta.seed)
  kv(L.date, report.meta.runDate)
  kv(report.generatedLabel, report.generatedAt)
  sum.push([])
  for (const n of report.notices) sum.push([str(n.text, S.warn)])
  if (report.notices.length) sum.push([])
  sum.push([str(report.sections.findings, S.title)])
  for (const f of report.findings) sum.push([str(`• ${f}`, S.wrap)])
  sum.push([])
  sum.push([str(report.sections.method, S.title)])
  for (const m of report.method) sum.push([str(`• ${m}`, S.wrap)])
  sheets.push({ name: report.sections.summary, rows: sum })

  // Questions
  const qr = [[L.question, L.type, L.n, L.mean, L.sd, L.median, L.top2, L.bottom2, L.nps].map((h) => str(h, S.header))]
  const or = [[L.question, L.option, L.count, L.share].map((h) => str(h, S.header))]
  for (const q of report.questions) {
    qr.push([str(q.prompt, S.wrap), str(L[q.type] ?? q.type), num(q.n, S.normal), num(q.mean), num(q.sd), num(q.median), num(q.top2, S.percent), num(q.bottom2, S.percent), q.nps ? num(q.nps.score, S.normal) : str('')])
    if (isChoice(q)) for (const o of q.options) or.push([str(q.prompt, S.wrap), str(o.label, S.wrap), num(o.count, S.normal), num(o.share, S.percent)])
  }
  sheets.push({ name: report.sections.questions, rows: qr, freeze: true })
  if (or.length > 1) sheets.push({ name: `${report.sections.questions} · ${L.option}`, rows: or, freeze: true })

  // Segments
  if (report.segments.length) {
    const sg = [[L.segment, L.group, L.n, L.question, L.value].map((h) => str(h, S.header))]
    for (const s of report.segments) for (const row of s.rows) for (const g of s.groups) {
      const v = row.cells[g.value]
      sg.push([str(s.label), str(g.label), num(g.n, S.normal), str(row.prompt, S.wrap), row.kind === 'share' ? num(v, S.percent) : num(v)])
    }
    sheets.push({ name: report.sections.segments, rows: sg, freeze: true })
  }

  // Analyses
  for (const a of report.analyses) {
    if (a.type === 'vw') {
      const rows = [[L.point, L.price].map((h) => str(h, S.header))]
      for (const [k, label] of [['pmc', L.pmc], ['opp', L.opp], ['ipp', L.ipp], ['pme', L.pme]]) rows.push([str(label), num(a.points?.[k])])
      rows.push([], [L.price, L.tooCheap, L.cheap, L.expensive, L.tooExpensive].map((h) => str(h, S.header)))
      for (const c of a.curves) rows.push([num(c.price), num(c.tooCheap, S.percent), num(c.cheap, S.percent), num(c.expensive, S.percent), num(c.tooExpensive, S.percent)])
      sheets.push({ name: report.sections.vw, rows })
    }
    if (a.type === 'mvt') {
      const rows = [[L.attribute, L.level, L.shown, L.chosen, L.rate].map((h) => str(h, S.header))]
      for (const at of a.attributes) for (const lv of at.levels) rows.push([str(at.label), str(lv.label, S.wrap), num(lv.shown, S.normal), num(lv.chosen, S.normal), num(lv.rate, S.percent)])
      rows.push([str(L.neither), str(''), num(a.neither.count, S.normal), str(''), num(a.neither.rate, S.percent)])
      sheets.push({ name: report.sections.mvt, rows, freeze: true })
    }
  }

  // Responses (wide)
  const header = [str('respondent', S.header), str('persona_id', S.header), str(L.country, S.header)]
  for (const q of report.questions) {
    header.push(str(q.id, S.header))
    if (isChoice(q)) header.push(str(`${q.id}_text`, S.header))
  }
  const resp = [header]
  for (const r of report.respondents) {
    const row = [num(r.index, S.normal), str(r.personaId ?? ''), str(r.country ?? '')]
    for (const q of report.questions) {
      row.push(answerCell(r.answers[q.id]))
      if (isChoice(q)) row.push(str(r.labels[q.id] ?? ''))
    }
    resp.push(row)
  }
  sheets.push({ name: report.sections.raw, rows: resp, freeze: true })

  // Free text + rationales
  const texts = [[L.question, L.persona, L.answer, L.reason].map((h) => str(h, S.header))]
  for (const q of report.questions) for (const r of report.respondents) {
    if (q.type === 'free_text' && r.answers[q.id] !== undefined) texts.push([str(q.prompt, S.wrap), str(r.personaId ?? r.index), str(r.answers[q.id], S.wrap), str('')])
    else if (isChoice(q) && r.rationales[q.id]) texts.push([str(q.prompt, S.wrap), str(r.personaId ?? r.index), str(r.labels[q.id] ?? '', S.wrap), str(r.rationales[q.id], S.wrap)])
  }
  if (texts.length > 1) sheets.push({ name: report.sections.texts, rows: texts, freeze: true })

  const used = new Set()
  const named = sheets.map((s) => ({ ...s, name: safeSheetName(s.name, used) }))
  const files = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${named.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
  }
  named.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows, { freeze: s.freeze }))))
  return Buffer.from(zipSync(files, { level: 6 }))
}
