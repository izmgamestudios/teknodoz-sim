export type QType = 'likert' | 'single_choice' | 'multi_choice' | 'free_text'

export type DraftQuestion = {
  type: QType
  prompt: string
  options: string[]
  min: number
  max: number
  askRationale: boolean
}

export type ImportResult = { questions: DraftQuestion[]; errors: string[] }

export const MAX_QUESTIONS = 10

export const blank = (type: QType = 'likert'): DraftQuestion => ({
  type,
  prompt: '',
  options: type === 'single_choice' || type === 'multi_choice' ? ['', ''] : [],
  min: 1,
  max: 5,
  askRationale: false,
})

const TYPE_ALIASES: Record<string, QType> = {
  likert: 'likert', scale: 'likert', rating: 'likert', rate: 'likert', nps: 'likert',
  single: 'single_choice', single_choice: 'single_choice', radio: 'single_choice', choice: 'single_choice', multiple_choice: 'single_choice', select: 'single_choice',
  multi: 'multi_choice', multi_choice: 'multi_choice', checkbox: 'multi_choice', multiselect: 'multi_choice',
  text: 'free_text', free_text: 'free_text', open: 'free_text', open_text: 'free_text', textarea: 'free_text',
}

function normalizeType(raw: unknown, hasOptions: boolean): QType {
  const key = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (key in TYPE_ALIASES) return TYPE_ALIASES[key]
  return hasOptions ? 'single_choice' : 'likert'
}

function fromObject(o: Record<string, unknown>, label: string, errors: string[]): DraftQuestion | null {
  const prompt = String(o.prompt ?? o.question ?? o.text ?? o.title ?? '').trim()
  if (prompt.length < 5) {
    errors.push(`${label}: prompt too short`)
    return null
  }
  const rawOptions = (o.options ?? o.choices ?? o.answers) as unknown
  const options = Array.isArray(rawOptions)
    ? rawOptions.map((x) => String(typeof x === 'object' && x ? (x as { label?: unknown }).label ?? '' : x).trim()).filter(Boolean)
    : typeof rawOptions === 'string'
      ? rawOptions.split('|').map((x) => x.trim()).filter(Boolean)
      : []
  const yesNo = String(o.type ?? '').toLowerCase().replace(/[\s_/-]/g, '') === 'yesno'
  const type = yesNo ? 'single_choice' : normalizeType(o.type, options.length > 0)
  const scale = Array.isArray(o.scale) ? o.scale : null
  const min = Number(o.min ?? o.minValue ?? scale?.[0] ?? 1)
  const max = Number(o.max ?? o.maxValue ?? scale?.[1] ?? 5)
  const q: DraftQuestion = { type, prompt, options: yesNo ? ['Yes', 'No'] : options, min, max, askRationale: o.askRationale === true || o.rationale === true }
  if ((type === 'single_choice' || type === 'multi_choice') && (q.options.length < 2 || q.options.length > 8)) {
    errors.push(`${label}: needs 2-8 options`)
    return null
  }
  if (type === 'likert' && !(Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max <= 10 && min < max)) {
    errors.push(`${label}: invalid scale`)
    return null
  }
  return q
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const delim = (text.split('\n', 1)[0].match(/[;\t]/)?.[0]) ?? ','
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim())) rows.push(row)
  return rows
}

function parseLines(text: string, errors: string[]): DraftQuestion[] {
  const out: DraftQuestion[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const label = `line ${i + 1}`
    const isText = /\[text\]\s*$/i.test(line)
    const body = line.replace(/\[text\]\s*$/i, '').trim()
    const parts = body.split('|').map((x) => x.trim()).filter(Boolean)
    const q = fromObject(
      isText ? { prompt: parts[0], type: 'free_text' } : parts.length > 1 ? { prompt: parts[0], type: 'single_choice', options: parts.slice(1) } : { prompt: parts[0], type: 'likert' },
      label,
      errors,
    )
    if (q) out.push(q)
  })
  return out
}

export function parseImport(input: string): ImportResult {
  const text = input.trim()
  const errors: string[] = []
  if (!text) return { questions: [], errors }
  let questions: DraftQuestion[] = []

  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : null
      if (!list) errors.push('JSON: expected an array of questions or {"questions": [...]}')
      else list.forEach((item: unknown, i: number) => {
        if (item && typeof item === 'object') {
          const q = fromObject(item as Record<string, unknown>, `question ${i + 1}`, errors)
          if (q) questions.push(q)
        } else errors.push(`question ${i + 1}: not an object`)
      })
    } catch (e) {
      errors.push(`JSON: ${(e as Error).message}`)
    }
  } else {
    const firstLine = text.split(/\r?\n/, 1)[0].toLowerCase()
    if (/^(prompt|question)\b.*[,;\t]/.test(firstLine) || /[,;\t]\s*type\b/.test(firstLine)) {
      const rows = parseCsv(text)
      const header = rows[0].map((h) => h.trim().toLowerCase())
      const col = (names: string[]) => header.findIndex((h) => names.includes(h))
      const ip = col(['prompt', 'question', 'text']), it = col(['type']), io = col(['options', 'choices']), imin = col(['min', 'minvalue']), imax = col(['max', 'maxvalue']), ir = col(['askrationale', 'rationale'])
      if (ip < 0) errors.push('CSV: missing "prompt" column')
      else rows.slice(1).forEach((r, i) => {
        const q = fromObject({
          prompt: r[ip], type: it >= 0 ? r[it] : undefined, options: io >= 0 ? r[io] : undefined,
          min: imin >= 0 && r[imin] !== '' ? r[imin] : undefined, max: imax >= 0 && r[imax] !== '' ? r[imax] : undefined,
          askRationale: ir >= 0 && /^(true|yes|1)$/i.test(r[ir] ?? ''),
        }, `row ${i + 2}`, errors)
        if (q) questions.push(q)
      })
    } else questions = parseLines(text, errors)
  }

  if (questions.length > MAX_QUESTIONS) {
    errors.push(`only the first ${MAX_QUESTIONS} questions are kept`)
    questions = questions.slice(0, MAX_QUESTIONS)
  }
  return { questions, errors }
}
