import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'

type AuthState = {
  loading: boolean
  admin: boolean
  email?: string
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; admin: boolean; email?: string }>({
    loading: true,
    admin: false,
  })

  useEffect(() => {
    api<{ admin: boolean; email?: string }>('/api/me')
      .then((r) => setState({ loading: false, admin: r.admin, email: r.email }))
      .catch(() => setState({ loading: false, admin: false }))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ admin: boolean; email: string }>('/api/login', { method: 'POST', body: { email, password } })
    setState({ loading: false, admin: r.admin, email: r.email })
  }, [])

  const logout = useCallback(async () => {
    await api('/api/logout', { method: 'POST', body: {} }).catch(() => undefined)
    setState({ loading: false, admin: false })
  }, [])

  return <Ctx.Provider value={{ ...state, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
