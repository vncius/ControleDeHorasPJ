import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import { IDIOMAS, definirIdioma } from '../i18n'
import type { Idioma } from '../i18n'

const BANDEIRA: Record<Idioma, string> = { pt: '🇧🇷', es: '🇪🇸', en: '🇺🇸' }

interface Props {
  onAbrirMenu?: () => void
}

export default function Topbar({ onAbrirMenu }: Props) {
  const { t, i18n } = useTranslation()
  const { tema, alternar } = useTheme()

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

      <div className="flex-center gap-8">
        <select
          className="input"
          value={i18n.language}
          onChange={e => definirIdioma(e.target.value as Idioma)}
          aria-label={t('topbar.idioma')}
          style={{ padding: '5px 8px', fontSize: 12, width: 'auto' }}
        >
          {IDIOMAS.map(idioma => (
            <option key={idioma} value={idioma}>{BANDEIRA[idioma]} {idioma.toUpperCase()}</option>
          ))}
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
      </div>
    </header>
  )
}
