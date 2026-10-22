import catalog from '../shared/tasks.json'

export type TaskKind = 'survey' | 'chat' | 'web' | 'os-app' | 'computer-use'

export type Method = 'concept' | 'pricing' | 'mvt' | 'usability' | 'funnel' | 'comprehension'

export type SimTask = {
  id: string
  kind: TaskKind
  needsDocker: boolean
  custom?: boolean
  product?: string
  method?: Method
}

export const TASKS = catalog.tasks as SimTask[]
export const MODELS = catalog.models as string[]
export const KINDS: TaskKind[] = ['survey', 'chat', 'web', 'os-app', 'computer-use']
export const METHODS: Method[] = ['concept', 'pricing', 'mvt', 'usability', 'funnel', 'comprehension']
