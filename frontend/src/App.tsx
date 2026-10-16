import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from './hooks/useToast'
import type { Toast } from './hooks/useToast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PreferenciasProvider } from './contexts/PreferenciasContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Projetos from './pages/Projetos'
import Relatorios from './pages/Relatorios'
import Conta from './pages/Conta'
import Legal from './pages/Legal'
import TelaConsentimento from './components/TelaConsentimento'

export type ToastFns = { success: (m: string) => void; error: (m: string) => void }
export type { Toast }

function ProtectedRoute() {
  const { t } = useTranslation()
  const { usuario, carregando } = useAuth()

  if (carregando) {
    return (
      <div className="loading-screen"><div className="spinner" /><span>{t('app.carregandoSessao')}</span></div>
    )
  }

  if (!usuario) return <Navigate to="/login" replace />
  // termos nunca aceitos ou versão nova (M15): aceite antes de usar o app
  if (usuario.consentimentoPendente) return <TelaConsentimento />

  return <Outlet />
}

function AppRoutes() {
  const { toasts, success, error } = useToast()
  const toast: ToastFns = { success, error }

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      {/* públicas: acessíveis sem login (link no login e na tela de aceite) */}
      <Route path="termos" element={<Legal tipo="termos" />} />
      <Route path="privacidade" element={<Legal tipo="privacidade" />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout toasts={toasts} />}>
          <Route index element={<Dashboard toast={toast} />} />
          <Route path="clientes" element={<Clientes toast={toast} />} />
          <Route path="projetos/*" element={<Projetos toast={toast} />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="conta" element={<Conta toast={toast} />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <PreferenciasProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </PreferenciasProvider>
    </ThemeProvider>
  )
}
