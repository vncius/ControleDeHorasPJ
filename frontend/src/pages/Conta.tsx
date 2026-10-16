import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { contaApi } from '../services/api'
import type { DadosConta } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useFormatarData } from '../contexts/PreferenciasContext'
import { hojeLocal } from '../utils/tempo'
import Button from '../components/Button'
import Modal from '../components/Modal'
import type { ToastFns } from '../App'

// Minha conta (M15 — LGPD): dados da conta, aceite dos termos, exportação
// completa (portabilidade), sair de todos os dispositivos e exclusão da conta.
export default function Conta({ toast }: { toast: ToastFns }) {
  const { t } = useTranslation()
  const { logoutTodos, encerrarLocalmente } = useAuth()
  const { formatarData } = useFormatarData()
  const navigate = useNavigate()
  const [conta, setConta] = useState<DadosConta | null>(null)
  const [exportando, setExportando] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [emailConfirmacao, setEmailConfirmacao] = useState('')

  useEffect(() => {
    contaApi.obter().then(setConta).catch((e) => toast.error(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao abrir a página
  }, [])

  async function exportar() {
    setExportando(true)
    try {
      const dados = await contaApi.exportar()
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `horas-pj-meus-dados-${hojeLocal()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('conta.exportado'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('conta.erroExportar'))
    } finally {
      setExportando(false)
    }
  }

  async function sairDeTodos() {
    setSaindo(true)
    try {
      await logoutTodos()
      navigate('/login', { replace: true })
    } finally {
      setSaindo(false)
    }
  }

  async function excluir() {
    setExcluindo(true)
    try {
      await contaApi.excluir(emailConfirmacao)
      encerrarLocalmente()
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('conta.erroExcluir'))
      setExcluindo(false)
    }
  }

  const confere = !!conta && emailConfirmacao.trim().toLowerCase() === conta.email

  return (
    <div style={{ animation: 'slideUp 0.25s ease', maxWidth: 760 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('conta.titulo')}</h1>
          <p className="page-subtitle">{t('conta.subtitulo')}</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="conta-dados">
        <h2 id="conta-dados" className="section-title" style={{ fontSize: 14, marginBottom: 12 }}>{t('conta.dadosTitulo')}</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px', fontSize: 14, margin: 0 }}>
          <dt style={{ color: 'var(--text-muted)' }}>{t('conta.email')}</dt><dd style={{ margin: 0 }}>{conta?.email ?? '—'}</dd>
          <dt style={{ color: 'var(--text-muted)' }}>{t('conta.nome')}</dt><dd style={{ margin: 0 }}>{conta?.nome ?? '—'}</dd>
          <dt style={{ color: 'var(--text-muted)' }}>{t('conta.criadaEm')}</dt><dd style={{ margin: 0 }}>{conta ? formatarData(conta.dataCriacao.slice(0, 10)) : '—'}</dd>
          <dt style={{ color: 'var(--text-muted)' }}>{t('conta.termosAceitosEm')}</dt>
          <dd style={{ margin: 0 }}>
            {conta?.consentimentoEm ? formatarData(conta.consentimentoEm.slice(0, 10)) : '—'}{' · '}
            <Link to="/termos">{t('legal.termosUso')}</Link>{' · '}
            <Link to="/privacidade">{t('legal.politicaPrivacidade')}</Link>
          </dd>
        </dl>
      </section>

      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="conta-exportar">
        <h2 id="conta-exportar" className="section-title" style={{ fontSize: 14, marginBottom: 8 }}>{t('conta.exportarTitulo')}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>{t('conta.exportarTexto')}</p>
        <Button className="btn btn-secondary" onClick={exportar} loading={exportando}>{t('conta.exportar')}</Button>
      </section>

      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="conta-sessoes">
        <h2 id="conta-sessoes" className="section-title" style={{ fontSize: 14, marginBottom: 8 }}>{t('conta.sessoesTitulo')}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>{t('conta.sessoesTexto')}</p>
        <Button className="btn btn-secondary" onClick={sairDeTodos} loading={saindo}>{t('sair.todos')}</Button>
      </section>

      <section className="card" style={{ border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)' }} aria-labelledby="conta-excluir">
        <h2 id="conta-excluir" className="section-title" style={{ fontSize: 14, marginBottom: 8, color: 'var(--danger)' }}>{t('conta.excluirTitulo')}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>{t('conta.excluirTexto')}</p>
        <button className="btn btn-danger" onClick={() => { setEmailConfirmacao(''); setConfirmandoExclusao(true) }}>{t('conta.excluir')}</button>
      </section>

      {confirmandoExclusao && conta && (
        <Modal onFechar={() => !excluindo && setConfirmandoExclusao(false)} style={{ maxWidth: 440 }}>
          <div className="modal-header">
            <h2 className="modal-title">{t('conta.excluirConfirmarTitulo')}</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
            {t('conta.excluirConfirmarTexto', { email: conta.email })}
          </p>
          <input
            className="input"
            type="email"
            value={emailConfirmacao}
            onChange={(e) => setEmailConfirmacao(e.target.value)}
            aria-label={t('conta.email')}
            autoFocus
            style={{ marginBottom: 20 }}
          />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setConfirmandoExclusao(false)} disabled={excluindo}>{t('comum.cancelar')}</button>
            <Button className="btn btn-danger" onClick={excluir} loading={excluindo} disabled={!confere || excluindo}>
              {t('conta.excluirConfirmar')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
