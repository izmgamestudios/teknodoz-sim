import { responsesCsv, summaryCsv } from './csv.mjs'
import { buildDocx } from './docx.mjs'
import { buildPdf } from './pdf.mjs'
import { buildXlsx } from './xlsx.mjs'

export const FORMATS = {
  json: { ext: 'json', type: 'application/json; charset=utf-8' },
  csv: { ext: 'csv', type: 'text/csv; charset=utf-8' },
  'csv-summary': { ext: 'csv', type: 'text/csv; charset=utf-8', suffix: '-summary' },
  xlsx: { ext: 'xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  docx: { ext: 'docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  pdf: { ext: 'pdf', type: 'application/pdf' },
}

export async function exportReport(report, format) {
  switch (format) {
    case 'json':
      return Buffer.from(JSON.stringify(report, null, 2))
    case 'csv':
      return Buffer.from(responsesCsv(report))
    case 'csv-summary':
      return Buffer.from(summaryCsv(report))
    case 'xlsx':
      return buildXlsx(report)
    case 'docx':
      return buildDocx(report)
    case 'pdf':
      return buildPdf(report)
    default:
      throw new Error('unsupported_format')
  }
}
