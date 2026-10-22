import catalog from '../shared/tasks.json'

export type TaskKind = 'survey' | 'chat' | 'web' | 'os-app' | 'computer-use'

export type SimTask = { id: string; kind: TaskKind; needsDocker: boolean }

export const TASKS = catalog.tasks as SimTask[]
export const MODELS = catalog.models as string[]
export const KINDS: TaskKind[] = ['survey', 'chat', 'web', 'os-app', 'computer-use']
