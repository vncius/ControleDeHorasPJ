import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import Button from './Button'

// Aceite dos Termos de Uso + Política de Privacidade (M15), no primeiro
// acesso e sempre que a versão vigente mudar. Recusar = sair.
export default function TelaConsentimento() {
  const { t } = useTranslation()
  const { aceitarTermos, logout } = useAuth()
  const navigate = useNavigate()
  const [leu, setLeu] = useState(false)
  const [processando, setProcessando] = useState<'aceitar' | 'recusar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function aceitar() {
    setProcessando('aceitar')
    setErro(null)
    try {
      await aceitarTermos()
    } catch (e) {
      setErro(e instanceof Error ? e.message : t('consentimento.erroAceitar'))
    } finally {
      setProcessando(null)
    }
  }

  async function recusar() {
    setProcessando('recusar')
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', padding: 20 }}>
      <main className="card" style={{ maxWidth: 520, width: '100%', padding: '32px 28px' }} aria-labelledby="consentimento-titulo">
        <h1 id="consentimento-titulo" className="page-title" style={{ marginBottom: 12 }}>{t('consentimento.titulo')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{t('consentimento.texto')}</p>

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, marginBottom: 24, cursor: 'pointer' }}>
          <input type="checkbox" checked={leu} onChange={(e) => setLeu(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            {t('consentimento.li')}{' '}
            <Link to="/termos" target="_blank" rel="noopener">{t('legal.termosUso')}</Link>{' '}
            {t('login.e')}{' '}
            <Link to="/privacidade" target="_blank" rel="noopener">{t('legal.politicaPrivacidade')}</Link>
          </span>
        </label>

        {erro && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{erro}</p>}

        <div className="form-actions" style={{ flexWrap: 'wrap' }}>
          <Button className="btn btn-secondary" onClick={recusar} loading={processando === 'recusar'} disabled={!!processando}>
            {t('consentimento.recusar')}
          </Button>
          <Button className="btn btn-primary" onClick={aceitar} loading={processando === 'aceitar'} disabled={!leu || !!processando}>
            {t('consentimento.aceitar')}
          </Button>
        </div>
      </main>
    </div>
  )
}
