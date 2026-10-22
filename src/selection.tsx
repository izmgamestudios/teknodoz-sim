import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type PersonaPool = 'dev' | 'country' | 'custom'

type Selection = {
  ids: string[]
  pool: PersonaPool | null
  /** Toggle one id. Returns true when the selection was reset because it came from another pool. */
  toggle: (id: string, pool: PersonaPool) => boolean
  /** Add many ids (deduplicated, capped). Returns { added, switched, capped }. */
  addMany: (ids: string[], pool: PersonaPool) => { added: number; switched: boolean; capped: boolean }
  clear: () => void
}

export const MAX_SELECTION = 100
const Ctx = createContext<Selection | null>(null)

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ ids: string[]; pool: PersonaPool | null }>({ ids: [], pool: null })

  const toggle = useCallback(
    (id: string, pool: PersonaPool) => {
      let switched = false
      setState((cur) => {
        if (cur.pool && cur.pool !== pool && cur.ids.length > 0) {
          switched = true
          return { ids: [id], pool }
        }
        const has = cur.ids.includes(id)
        const ids = has ? cur.ids.filter((x) => x !== id) : cur.ids.length < MAX_SELECTION ? [...cur.ids, id] : cur.ids
        return { ids, pool: ids.length ? pool : null }
      })
      return switched
    },
    [],
  )

  const addMany = useCallback(
    (incoming: string[], pool: PersonaPool) => {
      const result = { added: 0, switched: false, capped: false }
      setState((cur) => {
        const base = cur.pool && cur.pool !== pool ? [] : cur.ids
        result.switched = Boolean(cur.pool && cur.pool !== pool && cur.ids.length > 0)
        const merged = [...base]
        for (const id of incoming) {
          if (merged.includes(id)) continue
          if (merged.length >= MAX_SELECTION) {
            result.capped = true
            break
          }
          merged.push(id)
        }
        result.added = merged.length - base.length
        return { ids: merged, pool: merged.length ? pool : null }
      })
      return result
    },
    [],
  )

  const clear = useCallback(() => setState({ ids: [], pool: null }), [])
  const value = useMemo(() => ({ ...state, toggle, addMany, clear }), [state, toggle, addMany, clear])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSelection() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSelection outside SelectionProvider')
  return v
}
