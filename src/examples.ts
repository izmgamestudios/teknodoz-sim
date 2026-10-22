import type { SourceType } from './studyDraft'

// Example metadata only. Brief and questions are localized seed data in src/i18n/*.ts (`seed.examples`).
export type Example = {
  id: 'coffee' | 'landing' | 'store' | 'pricing' | 'support'
  src: SourceType
  audience?: { countries: string[]; perCountry: number }
}

export const EXAMPLES: Example[] = [
  { id: 'coffee', src: 'product', audience: { countries: ['TR', 'DE'], perCountry: 5 } },
  { id: 'landing', src: 'website' },
  { id: 'store', src: 'appstore' },
  { id: 'pricing', src: 'survey' },
  { id: 'support', src: 'survey' },
]
