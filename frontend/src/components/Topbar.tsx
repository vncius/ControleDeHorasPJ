import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ModalConfiguracoes from './ModalConfiguracoes'

interface Props {
  onAbrirMenu?: () => void
}

export default function Topbar({ onAbrirMenu }: Props) {
  const { t } = useTranslation()
  const [modalConfig, setModalConfig] = useState(false)

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

      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setModalConfig(true)}
        aria-label={t('config.titulo')}
        title={t('config.titulo')}
        style={{ fontSize: 16 }}
      >
        ⚙
      </button>

      {modalConfig && <ModalConfiguracoes onFechar={() => setModalConfig(false)} />}
    </header>
  )
}
