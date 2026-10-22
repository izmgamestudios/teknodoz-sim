export class ApiError extends Error {
  constructor(public status: number, public code: string) {
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
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'server_error')
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
  params: { taskId?: string; sampleSize?: number; seed?: number; model?: string; mode?: 'smoke' | 'auto'; personaIds?: string[] }
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
