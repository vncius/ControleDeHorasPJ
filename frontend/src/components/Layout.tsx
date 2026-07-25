import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Toast } from '../hooks/useToast'
import { useAuth } from '../contexts/AuthContext'
import Topbar from './Topbar'

interface Props {
  toasts: Toast[]
}

export default function Layout({ toasts }: Props) {
  const { t } = useTranslation()
  const location = useLocation()
  const { usuario } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)

  const NAV = [
    { to: '/', label: t('nav.dashboard'), icon: '◈' },
    { to: '/clientes', label: t('nav.clientes'), icon: '◉' },
    { to: '/projetos', label: t('nav.projetos'), icon: '◫' },
    { to: '/relatorios', label: t('nav.relatorios'), icon: '◧' },
  ]

  // fecha o menu mobile ao trocar de rota
  useEffect(() => { setMenuAberto(false) }, [location.pathname])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside className={`sidebar${menuAberto ? ' sidebar-aberta' : ''}`} style={{
        width: 'var(--sidebar-width)',
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            Horas
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            PJ <span style={{ color: 'var(--accent)' }}>_</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          {NAV.map((item) => {
            const active = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 'var(--radius)',
                  marginBottom: 2,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 14, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer da sidebar */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          {usuario && (
            <div style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 10,
            }} title={usuario.email}>
              {usuario.email}
            </div>
          )}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            v1.0.0 — MVP
          </div>
        </div>
      </aside>

      {/* Backdrop do menu mobile */}
      {menuAberto && <div className="sidebar-backdrop" onClick={() => setMenuAberto(false)} />}

      {/* Conteúdo principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar onAbrirMenu={() => setMenuAberto(v => !v)} />
        <main className="main-content" style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg-0)',
        }}>
          <Outlet />
        </main>
      </div>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? '✓ ' : '✕ '}{t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
