// Helpers for localized seed data (study templates and example studies) stored in the i18n dictionaries.
export type SeedQType = 'likert' | 'single_choice' | 'multi_choice' | 'free_text'
export type SeedQ = { type: SeedQType; prompt: string; options: string[]; min: number; max: number; askRationale: boolean }

export const L = (prompt: string, min = 1, max = 5, askRationale = false): SeedQ => ({ type: 'likert', prompt, options: [], min, max, askRationale })
export const S = (prompt: string, options: string[], askRationale = false): SeedQ => ({ type: 'single_choice', prompt, options, min: 1, max: 5, askRationale })
export const M = (prompt: string, options: string[]): SeedQ => ({ type: 'multi_choice', prompt, options, min: 1, max: 5, askRationale: false })
export const T = (prompt: string): SeedQ => ({ type: 'free_text', prompt, options: [], min: 1, max: 5, askRationale: false })

export type SeedExample = { brief: string; questions: SeedQ[] }
export type SeedTemplates = { website: SeedQ[]; appstore: SeedQ[]; product: SeedQ[] }
export type SeedExamples = Record<'coffee' | 'landing' | 'store' | 'pricing' | 'support', SeedExample>
