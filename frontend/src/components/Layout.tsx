import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { Toast } from '../hooks/useToast'

interface Props {
  toasts: Toast[]
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/clientes', label: 'Clientes', icon: '◉' },
  { to: '/projetos', label: 'Projetos', icon: '◫' },
  { to: '/relatorios', label: 'Relatórios', icon: '◧' },
]

export default function Layout({ toasts }: Props) {
  const location = useLocation()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
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
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          letterSpacing: '0.04em',
        }}>
          v1.0.0 — MVP
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--bg-0)',
        padding: '32px 36px',
      }}>
        <Outlet />
      </main>

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
