import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { usePreferencias } from '../contexts/PreferenciasContext'
import { useAuth } from '../contexts/AuthContext'
import type { FormatoData } from '../utils/formatoData'
import { IDIOMAS, definirIdioma } from '../i18n'
import type { Idioma } from '../i18n'
import Button from './Button'

const BANDEIRA: Record<Idioma, string> = { pt: '🇧🇷', es: '🇪🇸', en: '🇺🇸' }

const svgProps = {
  width: 13,
  height: 13,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function IconeIdioma() {
  return (
    <svg {...svgProps} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
    </svg>
  )
}

function IconeCalendario() {
  return (
    <svg {...svgProps} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

interface Props {
  onAbrirMenu?: () => void
}

export default function Topbar({ onAbrirMenu }: Props) {
  const { t, i18n } = useTranslation()
  const { tema, alternar } = useTheme()
  const { formatoData, definirFormatoData } = usePreferencias()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [saindo, setSaindo] = useState(false)

  async function handleLogout() {
    if (saindo) return
    setSaindo(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setSaindo(false)
    }
  }

  return (
    <header style={{
      height: 'var(--topbar-height)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px 0 12px',
      flexShrink: 0,
    }}>
      {onAbrirMenu ? (
        <button
          className="btn btn-ghost btn-icon btn-menu-mobile"
          onClick={onAbrirMenu}
          aria-label="Menu"
          style={{ fontSize: 16 }}
        >
          ☰
        </button>
      ) : <span />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <label className="topbar-select-wrap" title={t('topbar.idioma')}>
          <IconeIdioma />
          <select
            className="topbar-select"
            value={i18n.language}
            onChange={e => definirIdioma(e.target.value as Idioma)}
            aria-label={t('topbar.idioma')}
          >
            {IDIOMAS.map(idioma => (
              <option key={idioma} value={idioma}>{BANDEIRA[idioma]} {idioma.toUpperCase()}</option>
            ))}
          </select>
        </label>

        <label className="topbar-select-wrap" title={t('config.formatoData')}>
          <IconeCalendario />
          <select
            className="topbar-select"
            value={formatoData}
            onChange={e => definirFormatoData(e.target.value as FormatoData)}
            aria-label={t('config.formatoData')}
          >
            <option value="auto">{t('config.formatoAuto')}</option>
            <option value="dd-mm-yyyy">DD/MM/AAAA</option>
            <option value="mm-dd-yyyy">MM/DD/AAAA</option>
            <option value="yyyy-mm-dd">AAAA-MM-DD</option>
          </select>
        </label>

        <button
          className="btn btn-ghost btn-icon"
          onClick={alternar}
          aria-label={tema === 'dark' ? t('topbar.temaClaro') : t('topbar.temaEscuro')}
          title={tema === 'dark' ? t('topbar.temaClaro') : t('topbar.temaEscuro')}
          style={{ fontSize: 16 }}
        >
          {tema === 'dark' ? '☀' : '☾'}
        </button>

        <Button
          onClick={handleLogout}
          loading={saindo}
          className="btn btn-ghost btn-icon"
          aria-label={t('nav.sair')}
          title={t('nav.sair')}
          style={{ fontSize: 16 }}
        >
          ⏻
        </Button>
      </div>
    </header>
  )
}
