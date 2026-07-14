import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../services/api'

interface Usuario {
  email: string
  nome?: string
}

interface AuthContextValue {
  usuario: Usuario | null
  carregando: boolean
  login: (credential: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregarSessao() {
      try {
        const me = await authApi.me()
        setUsuario(me)
      } catch {
        // 401 é esperado quando não há sessão ativa
        setUsuario(null)
      } finally {
        setCarregando(false)
      }
    }
    carregarSessao()
  }, [])

  const login = useCallback(async (credential: string) => {
    const dados = await authApi.login(credential)
    setUsuario(dados)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUsuario(null)
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  return ctx
}
