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
  params: { taskId?: string; sampleSize?: number; seed?: number; model?: string; mode?: 'smoke' | 'auto'; personaIds?: string[]; pool?: 'dev' | 'country'; title?: string; jobName?: string }
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

export type RunResults = { n: number; found: boolean; questions: QuestionResult[] }
