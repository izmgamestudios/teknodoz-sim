import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './paths.mjs'
import { loadDict } from './i18n.mjs'
import { defaultSettings, flattenStrings, sanitizeSettings, SETTINGS_LANGS } from '../src/settings.ts'

const DATA_DIR = join(ROOT, 'data')
const FILE = join(DATA_DIR, 'settings.json')
export const MAX_SETTINGS_BYTES = 600_000

let cache = null

export function loadSettings() {
  if (cache) return cache
  let raw = {}
  try {
    if (existsSync(FILE)) raw = JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    raw = {}
  }
  cache = sanitizeSettings(raw, null)
  return cache
}

async function knownPaths() {
  const out = {}
  for (const l of SETTINGS_LANGS) out[l] = flattenStrings(await loadDict(l))
  return out
}

/** Validates against the default dictionaries, then writes atomically. Returns the stored settings. */
export async function saveSettings(raw) {
  const clean = sanitizeSettings(raw, await knownPaths())
  mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(clean))
  renameSync(tmp, FILE)
  cache = clean
  return clean
}

export function resetSettings() {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(defaultSettings()))
  cache = defaultSettings()
  return cache
}
