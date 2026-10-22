// Loads the UI dictionaries (src/i18n/*.ts) on the server so reports use the same labels as the interface.
// Requires Node >= 22.18 (native TypeScript type stripping).
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from './paths.mjs'

export const LANGS = ['tr', 'en', 'de', 'es']
const cache = new Map()

export async function loadDict(lang) {
  const l = LANGS.includes(lang) ? lang : 'en'
  if (!cache.has(l)) {
    const mod = await import(pathToFileURL(join(ROOT, 'src', 'i18n', `${l}.ts`)).href)
    cache.set(l, mod[l])
  }
  return cache.get(l)
}
