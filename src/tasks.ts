export type TaskKind = 'survey' | 'chat' | 'web' | 'os-app' | 'computer-use'

export type SimTask = { id: string; kind: TaskKind; needsDocker: boolean }

const t = (id: string, kind: TaskKind, needsDocker = false): SimTask => ({ id, kind, needsDocker })

// Mirrors vendor/MatrAIx/application/tasks (MatrAIx, MIT).
export const TASKS: SimTask[] = [
  t('example-survey_product-feedback', 'survey'),
  t('survey_annual-checkup-habits', 'survey'),
  t('survey_price-sensitivity-hasbro-gaming-candy-land', 'survey'),
  t('chat_meal-planning-nutrition', 'chat'),
  t('chat_openbb-corporate-action-honesty', 'chat'),
  t('example-chat-api_support_chatbot', 'chat'),
  t('example-chat-mcp_support_chatbot', 'chat'),
  t('web_mit-ocw-course-choice', 'web', true),
  t('web_notion-plan-comparison', 'web', true),
  t('example-web-browser-use_laptop-choice', 'web', true),
  t('example-web-cocoa_plan-choice', 'web', true),
  t('example-web-cua_bookshop-choice', 'web', true),
  t('example-web-playwright_quote-choice', 'web', true),
  t('os-app-ios_news-subscription-decision', 'os-app', true),
  t('os-app-macos_stocks-mu-sentiment', 'os-app', true),
  t('example-computer-use-ios_photo-access-review', 'computer-use', true),
  t('example-computer-use-linux_note-to-csv', 'computer-use', true),
  t('example-computer-use-macos_calendar-reminder-handoff', 'computer-use', true),
]

export const KIND_LABELS: Record<TaskKind, string> = {
  survey: 'Anket',
  chat: 'Chatbot',
  web: 'Web',
  'os-app': 'Uygulama',
  'computer-use': 'Bilgisayar',
}

export const MODELS = [
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-5',
] as const

export type SimConfig = {
  task: SimTask
  sampleSize: number
  seed: number
  model: string
  mode: 'auto' | 'smoke'
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase()

export function buildCommands(c: SimConfig): string[] {
  if (c.mode === 'smoke') {
    return [`uv run matraix smoke application/tasks/${c.task.id}`]
  }
  const name = `teknodoz-${slug(c.task.id)}-n${c.sampleSize}`
  return [
    [
      'uv run python application/scripts/generate_application_job.py',
      `--task application/tasks/${c.task.id}`,
      '--execution-mode auto',
      `--sample-size ${c.sampleSize}`,
      `--seed ${c.seed}`,
      `--model-name ${c.model}`,
      `--name ${name}`,
    ].join(' \\\n  '),
    `uv run matraix run -c configs/jobs/application-task-job-recipe/${name}.yaml`,
  ]
}
