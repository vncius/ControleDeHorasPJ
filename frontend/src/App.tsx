import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useToast } from './hooks/useToast'
import type { Toast } from './hooks/useToast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Projetos from './pages/Projetos'
import Relatorios from './pages/Relatorios'

export type ToastFns = { success: (m: string) => void; error: (m: string) => void }
export type { Toast }

function ProtectedRoute() {
  const { usuario, carregando } = useAuth()

  if (carregando) {
    return (
      <div className="loading-screen"><div className="spinner" /><span>Carregando sessão...</span></div>
    )
  }

  if (!usuario) return <Navigate to="/login" replace />

  return <Outlet />
}

function AppRoutes() {
  const { toasts, success, error } = useToast()
  const toast: ToastFns = { success, error }

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout toasts={toasts} />}>
          <Route index element={<Dashboard toast={toast} />} />
          <Route path="clientes" element={<Clientes toast={toast} />} />
          <Route path="projetos/*" element={<Projetos toast={toast} />} />
          <Route path="relatorios" element={<Relatorios />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
