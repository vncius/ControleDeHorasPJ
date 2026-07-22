import { useTranslation } from 'react-i18next'
import Button from './Button'

interface Props {
  titulo: string
  mensagem: React.ReactNode
  confirmarLabel?: string
  perigo?: boolean
  confirmando?: boolean
  onConfirmar: () => void
  onFechar: () => void
}

export default function ConfirmModal({ titulo, mensagem, confirmarLabel, perigo, confirmando, onConfirmar, onFechar }: Props) {
  const { t } = useTranslation()
  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{titulo}</h2>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>{mensagem}</div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onFechar} disabled={confirmando}>{t('comum.cancelar')}</button>
          <Button className={perigo ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirmar} loading={confirmando}>
            {confirmarLabel ?? t('comum.confirmar')}
          </Button>
        </div>
      </div>
    </div>
  )
}
