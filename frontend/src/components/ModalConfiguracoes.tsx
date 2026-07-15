import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import { usePreferencias } from '../contexts/PreferenciasContext'
import type { FormatoData } from '../utils/formatoData'
import { IDIOMAS, definirIdioma } from '../i18n'
import type { Idioma } from '../i18n'

const BANDEIRA: Record<Idioma, string> = { pt: '🇧🇷', es: '🇪🇸', en: '🇺🇸' }

interface Props {
  onFechar: () => void
}

export default function ModalConfiguracoes({ onFechar }: Props) {
  const { t, i18n } = useTranslation()
  const { tema, alternar } = useTheme()
  const { formatoData, definirFormatoData } = usePreferencias()

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('config.titulo')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label className="form-label">{t('topbar.idioma')}</label>
            <select className="input" value={i18n.language} onChange={e => definirIdioma(e.target.value as Idioma)}>
              {IDIOMAS.map(idioma => (
                <option key={idioma} value={idioma}>{BANDEIRA[idioma]} {idioma.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('config.tema')}</label>
            <div className="flex-center gap-8">
              <button
                className={tema === 'dark' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                onClick={() => tema !== 'dark' && alternar()}
                style={{ flex: 1 }}
              >
                ☾ {t('config.temaEscuro')}
              </button>
              <button
                className={tema === 'light' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                onClick={() => tema !== 'light' && alternar()}
                style={{ flex: 1 }}
              >
                ☀ {t('config.temaClaro')}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('config.formatoData')}</label>
            <select className="input" value={formatoData} onChange={e => definirFormatoData(e.target.value as FormatoData)}>
              <option value="auto">{t('config.formatoAuto')}</option>
              <option value="dd-mm-yyyy">DD/MM/AAAA</option>
              <option value="mm-dd-yyyy">MM/DD/AAAA</option>
              <option value="yyyy-mm-dd">AAAA-MM-DD</option>
            </select>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={onFechar}>{t('comum.fechar')}</button>
        </div>
      </div>
    </div>
  )
}
