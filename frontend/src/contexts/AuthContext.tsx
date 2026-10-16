import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { authApi, contaApi, definirAoExpirarSessao, definirAoExigirConsentimento } from '../services/api'
import { VERSAO_TERMOS } from '../config/legal'

interface Usuario {
  email: string
  nome?: string
  // true enquanto não houver aceite da versão vigente dos termos (M15):
  // o ProtectedRoute mostra a tela de aceite em vez do app
  consentimentoPendente: boolean
}

interface AuthContextValue {
  usuario: Usuario | null
  carregando: boolean
  login: (credential: string) => Promise<void>
  logout: () => Promise<void>
  logoutTodos: () => Promise<void>
  aceitarTermos: () => Promise<void>
  /** Depois de excluir a conta: só esquece o usuário (a sessão já não existe). */
  encerrarLocalmente: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  // Sessão expirada no meio do uso: qualquer chamada autenticada com 401
  // limpa o usuário, e o ProtectedRoute redireciona para o /login.
  // Termos novos no meio do uso: um 403 auth.consentimentoPendente mostra a
  // tela de aceite.
  useEffect(() => {
    definirAoExpirarSessao(() => setUsuario(null))
    definirAoExigirConsentimento(() => setUsuario((u) => (u ? { ...u, consentimentoPendente: true } : u)))
    return () => {
      definirAoExpirarSessao(null)
      definirAoExigirConsentimento(null)
    }
  }, [])

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
    await authApi.login(credential)
    // o /me traz o estado do consentimento junto com o usuário
    setUsuario(await authApi.me())
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUsuario(null)
  }, [])

  // invalida as sessões de todos os dispositivos (inclusive a deste navegador)
  const logoutTodos = useCallback(async () => {
    await authApi.logoutTodos()
    setUsuario(null)
  }, [])

  const aceitarTermos = useCallback(async () => {
    await contaApi.aceitarConsentimento(VERSAO_TERMOS)
    setUsuario((u) => (u ? { ...u, consentimentoPendente: false } : u))
  }, [])

  const encerrarLocalmente = useCallback(() => setUsuario(null), [])

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout, logoutTodos, aceitarTermos, encerrarLocalmente }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  return ctx
}
