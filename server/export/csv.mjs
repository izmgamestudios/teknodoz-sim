const BOM = '﻿'

/** RFC 4180 cell. Strings starting with = + - @ are prefixed so spreadsheets never evaluate them as formulas. */
export function csvCell(v) {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const line = (cells) => cells.map(csvCell).join(',')
const isChoice = (q) => q.type === 'single_choice' || q.type === 'multi_choice'
const raw = (v) => (Array.isArray(v) ? v.join(';') : v === undefined ? '' : v)

/** One row per responding persona; choice questions get an extra "<id>_text" column with the readable label. */
export function responsesCsv(report) {
  const qs = report.questions
  const header = ['respondent', 'persona_id', 'country', ...qs.flatMap((q) => (isChoice(q) ? [q.id, `${q.id}_text`] : [q.id]))]
  const rows = report.respondents.map((r) => [
    r.index,
    r.personaId ?? '',
    r.country ?? '',
    ...qs.flatMap((q) => (isChoice(q) ? [raw(r.answers[q.id]), r.labels[q.id] ?? ''] : [raw(r.answers[q.id])])),
  ])
  return BOM + [line(header), ...rows.map(line)].join('\r\n') + '\r\n'
}

/** Question-level summary: one row per question (scale/text) or per option (choice). */
export function summaryCsv(report) {
  const header = ['question_id', 'prompt', 'type', 'n', 'mean', 'sd', 'median', 'top2_pct', 'bottom2_pct', 'nps', 'option_id', 'option_label', 'count', 'share_pct']
  const rows = []
  const pct = (x) => (x === undefined || x === null ? '' : Math.round(x * 1000) / 10)
  for (const q of report.questions) {
    if (q.type === 'likert') rows.push([q.id, q.prompt, q.type, q.n, q.mean ?? '', q.sd ?? '', q.median ?? '', pct(q.top2), pct(q.bottom2), q.nps?.score ?? '', '', '', '', ''])
    else if (isChoice(q)) for (const o of q.options) rows.push([q.id, q.prompt, q.type, q.n, '', '', '', '', '', '', o.id, o.label, o.count, pct(o.share)])
    else rows.push([q.id, q.prompt, q.type, q.n, '', '', '', '', '', '', '', '', '', ''])
  }
  return BOM + [line(header), ...rows.map(line)].join('\r\n') + '\r\n'
}
