export class ApiError extends Error {
  constructor(public status: number, public code: string, public index?: number) {
    super(code)
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data as { error?: string; index?: number }
    throw new ApiError(res.status, d.error ?? 'server_error', d.index)
  }
  return data as T
}

export type RunStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled'

export type RunSummary = {
  id: string
  kind: 'simulation' | 'setup'
  status: RunStatus
  createdAt: number
  startedAt?: number
  endedAt?: number
  params: { taskId?: string; sampleSize?: number; seed?: number; model?: string; mode?: 'smoke' | 'auto'; personaIds?: string[]; pool?: 'dev' | 'country' | 'custom'; title?: string; jobName?: string }
}

export type RunDetail = RunSummary & { log: string }

export type SystemStatus = {
  uv: boolean
  docker: boolean
  matraixDir: boolean
  venv: boolean
  anthropicKey: boolean
  openaiKey: boolean
  busy: boolean
}

export type QuestionResult = {
  id: string
  prompt: string
  type: 'likert' | 'single_choice' | 'multi_choice' | 'free_text'
  n: number
  min?: number
  max?: number
  mean?: number | null
  hist?: Record<string, number>
  options?: { id: string; label: string; count: number }[]
  reasons?: string[]
  texts?: string[]
}

export type RunResults = {
  n: number
  found: boolean
  synthetic?: boolean
  source?: string
  questions: QuestionResult[]
  diagnostics?: { jobDirExists: boolean; files: { path: string; size: number }[] } | null
}

export type ReportQuestion = Omit<QuestionResult, 'options'> & {
  sd?: number | null
  median?: number | null
  top2?: number
  bottom2?: number
  nps?: { score: number; promoters: number; passives: number; detractors: number }
  options?: { id: string; label: string; count: number; share: number }[]
}

export type RunReport = {
  lang: string
  title: string
  meta: { respondents: number; mode: string; model: string; pool: string; synthetic: boolean }
  notices: { kind: 'warn' | 'info'; text: string }[]
  findings: string[]
  questions: ReportQuestion[]
  segments: { facet: string; label: string; groups: { value: string; label: string; n: number }[]; rows: { questionId: string; prompt: string; kind: 'mean' | 'share'; topLabel?: string; cells: Record<string, number | null> }[] }[]
  analyses: (
    | { type: 'vw'; currency: string; points: Record<'opp' | 'ipp' | 'pmc' | 'pme', number | null> | null }
    | { type: 'mvt'; attributes: { key: string; label: string; levels: { label: string; shown: number; chosen: number; rate: number | null }[] }[]; neither: { count: number; rate: number | null } }
  )[]
  method: string[]
  labels: Record<string, string>
  sections: Record<string, string>
}
