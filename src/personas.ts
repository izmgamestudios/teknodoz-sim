import { useEffect, useState } from 'react'

export type Persona = { id: string; name: string; source: string; d: Record<string, string> }
export type PersonaData = { groups: Record<'profile' | 'decision' | 'style', string[]>; valueKeys: string[]; personas: Persona[] }

let cache: PersonaData | null = null

export function usePersonas(): PersonaData | null {
  const [data, setData] = useState<PersonaData | null>(cache)
  useEffect(() => {
    if (cache) return
    import('../shared/personas.json').then((m) => {
      cache = m.default as PersonaData
      setData(cache)
    })
  }, [])
  return data
}
