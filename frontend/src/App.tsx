import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useToast } from './hooks/useToast'
import type { Toast } from './hooks/useToast'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Projetos from './pages/Projetos'
import Relatorios from './pages/Relatorios'

export type ToastFns = { success: (m: string) => void; error: (m: string) => void }
export type { Toast }

export default function App() {
  const { toasts, success, error } = useToast()
  const toast: ToastFns = { success, error }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout toasts={toasts} />}>
          <Route index element={<Dashboard toast={toast} />} />
          <Route path="clientes" element={<Clientes toast={toast} />} />
          <Route path="projetos/*" element={<Projetos toast={toast} />} />
          <Route path="relatorios" element={<Relatorios />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
