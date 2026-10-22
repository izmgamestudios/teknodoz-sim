import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Selection = {
  ids: string[]
  toggle: (id: string) => void
  clear: () => void
}

const MAX = 100
const Ctx = createContext<Selection | null>(null)

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([])
  const toggle = useCallback(
    (id: string) =>
      setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX ? [...cur, id] : cur)),
    [],
  )
  const clear = useCallback(() => setIds([]), [])
  const value = useMemo(() => ({ ids, toggle, clear }), [ids, toggle, clear])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSelection() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSelection outside SelectionProvider')
  return v
}
