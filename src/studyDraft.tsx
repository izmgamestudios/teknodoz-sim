import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DraftQuestion } from './importers'

export type SourceType = 'survey' | 'website' | 'appstore' | 'product'
export type StudyDraft = { src: SourceType; title: string; brief: string; url?: string; questions: DraftQuestion[] }

type Ctx = { draft: StudyDraft | null; setDraft: (d: StudyDraft) => void; clearDraft: () => void }
const C = createContext<Ctx | null>(null)

export function StudyDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<StudyDraft | null>(null)
  const setDraft = useCallback((d: StudyDraft) => setDraftState(d), [])
  const clearDraft = useCallback(() => setDraftState(null), [])
  const value = useMemo(() => ({ draft, setDraft, clearDraft }), [draft, setDraft, clearDraft])
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useStudyDraft() {
  const v = useContext(C)
  if (!v) throw new Error('useStudyDraft outside StudyDraftProvider')
  return v
}
