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
      gap: 8,
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select
          className="input"
          value={i18n.language}
          onChange={e => definirIdioma(e.target.value as Idioma)}
          aria-label={t('topbar.idioma')}
          title={t('topbar.idioma')}
          style={{ width: 'auto', padding: '6px 8px', fontSize: 13 }}
        >
          {IDIOMAS.map(idioma => (
            <option key={idioma} value={idioma}>{BANDEIRA[idioma]} {idioma.toUpperCase()}</option>
          ))}
        </select>

        <select
          className="input"
          value={formatoData}
          onChange={e => definirFormatoData(e.target.value as FormatoData)}
          aria-label={t('config.formatoData')}
          title={t('config.formatoData')}
          style={{ width: 'auto', padding: '6px 8px', fontSize: 13 }}
        >
          <option value="auto">{t('config.formatoAuto')}</option>
          <option value="dd-mm-yyyy">DD/MM/AAAA</option>
          <option value="mm-dd-yyyy">MM/DD/AAAA</option>
          <option value="yyyy-mm-dd">AAAA-MM-DD</option>
        </select>

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
