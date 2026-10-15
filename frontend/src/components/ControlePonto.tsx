import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { lancamentosApi } from '../services/api'
import type { AlteracaoEscopo, LancamentoHoras } from '../types'
import type { ToastFns } from '../App'
import { horaAtual, calcularDecorrido } from '../utils/tempo'
import { useAgoraTick } from '../hooks/useAgoraTick'
import { useTituloDecorrido } from '../hooks/useTituloDecorrido'
import ConfirmModal from './ConfirmModal'
import Button from './Button'

interface Props {
  projetoId: string
  lancamentoAberto: LancamentoHoras | null  // lançamento deste projeto
  escopos: AlteracaoEscopo[]
  toast: ToastFns
  onAtualizar: () => void
}

export default function ControlePonto({ projetoId, lancamentoAberto, escopos, toast, onAtualizar }: Props) {
  const { t } = useTranslation()
  const [carregando, setCarregando] = useState(false)

  // modal finalizar
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [horaFim, setHoraFim] = useState('')
  const [descricaoFinal, setDescricaoFinal] = useState('')
  const [escopoIdFinal, setEscopoIdFinal] = useState('')
  const escoposAprovados = escopos.filter(e => e.status === 'Aprovada')

  // lançamento que será finalizado no modal — pode ser deste projeto ou de outro
  const [lancamentoParaFinalizar, setLancamentoParaFinalizar] = useState<LancamentoHoras | null>(null)

  // se true: ao finalizar, inicia automaticamente o projetoId atual
  const [iniciarAposFechar, setIniciarAposFechar] = useState(false)

  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  // modal de escolha de descrição ao iniciar (reutilizar a última ou escrever uma nova)
  const [modalDescricao, setModalDescricao] = useState(false)
  const [descricaoAnteriorSugerida, setDescricaoAnteriorSugerida] = useState('')
  const [escrevendoNovaDescricao, setEscrevendoNovaDescricao] = useState(false)
  const [novaDescricaoIniciar, setNovaDescricaoIniciar] = useState('')

  // timer — re-render a cada segundo enquanto houver lançamento aberto
  useAgoraTick(!!lancamentoAberto)
  useTituloDecorrido(lancamentoAberto?.horaInicio, lancamentoAberto?.data)

  function abrirModal(lancamento: LancamentoHoras, comTroca: boolean) {
    setLancamentoParaFinalizar(lancamento)
    setHoraFim(horaAtual())
    setDescricaoFinal(lancamento.descricao ?? '')
    setEscopoIdFinal(lancamento.escopoId ?? '')
    setIniciarAposFechar(comTroca)
    setModalFinalizar(true)
  }

  function fecharModal() {
    setModalFinalizar(false)
    setLancamentoParaFinalizar(null)
    setIniciarAposFechar(false)
  }

  async function iniciar() {
    if (carregando) return
    setCarregando(true)
    try {
      // consulta se há lançamento em andamento globalmente
      const emAndamento = await lancamentosApi.emAndamento()

      if (emAndamento && emAndamento.projetoId !== projetoId) {
        // há lançamento aberto em OUTRO projeto — abre modal de troca
        setCarregando(false)
        abrirModal(emAndamento, true)
        return
      }

      // sem conflito — a descrição é obrigatória para iniciar
      await solicitarDescricao()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('ponto.erroIniciar'))
    } finally {
      setCarregando(false)
    }
  }

  // Abre o modal de descrição: com descrição anterior, oferece reutilizá-la ou escrever uma nova;
  // sem anterior (primeiro lançamento do projeto), vai direto para o campo de texto.
  async function solicitarDescricao() {
    const { descricao } = await lancamentosApi.ultimaDescricao(projetoId)
    setDescricaoAnteriorSugerida(descricao ?? '')
    setEscrevendoNovaDescricao(!descricao)
    setNovaDescricaoIniciar('')
    setModalDescricao(true)
  }

  function fecharModalDescricao() {
    setModalDescricao(false)
    setEscrevendoNovaDescricao(false)
    setNovaDescricaoIniciar('')
  }

  async function iniciarComDescricao(descricao: string) {
    if (carregando) return
    if (!descricao.trim()) { toast.error(t('comum.descricaoObrigatoria')); return }
    setCarregando(true)
    try {
      await lancamentosApi.iniciar(projetoId, descricao.trim())
      toast.success(t('ponto.iniciado'))
      fecharModalDescricao()
      onAtualizar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('ponto.erroIniciar'))
    } finally {
      setCarregando(false)
    }
  }

  async function finalizar() {
    if (carregando) return
    if (!lancamentoParaFinalizar) return
    if (!horaFim) { toast.error(t('dashboard.horaFimObrigatoria')); return }
    if (!descricaoFinal.trim()) { toast.error(t('comum.descricaoObrigatoria')); return }
    setCarregando(true)
    try {
      await lancamentosApi.finalizar(lancamentoParaFinalizar.id, {
        horaFim,
        descricao: descricaoFinal.trim(),
        escopoId: escopoIdFinal || null,
      })
      toast.success(t('dashboard.trabalhoFinalizado'))

      const trocando = iniciarAposFechar
      fecharModal()
      onAtualizar()
      // troca de projeto: o novo lançamento também precisa de descrição
      if (trocando) await solicitarDescricao()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('dashboard.erroFinalizar'))
    } finally {
      setCarregando(false)
    }
  }

  async function cancelar() {
    if (carregando) return
    if (!lancamentoAberto) return
    setCarregando(true)
    try {
      await lancamentosApi.excluir(lancamentoAberto.id)
      toast.success(t('ponto.cancelado'))
      setConfirmarCancelar(false)
      onAtualizar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('ponto.erroCancelar'))
    } finally {
      setCarregando(false)
    }
  }

  // ── Modal compartilhado ──
  const modalJSX = modalFinalizar && lancamentoParaFinalizar && (
    <div className="modal-overlay" onClick={fecharModal}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {iniciarAposFechar ? t('ponto.modalTrocar') : t('dashboard.finalizarTrabalho')}
            </h2>
            {iniciarAposFechar && (
              <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>
                {t('ponto.avisoTroca')}
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={fecharModal}>✕</button>
        </div>

        {/* resumo do lançamento que será encerrado */}
        {iniciarAposFechar && (
          <div style={{
            background: 'var(--bg-3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}>
            {t('ponto.encerrandoIniciado', { hora: lancamentoParaFinalizar.horaInicio })}
            {lancamentoParaFinalizar.descricao && ` · ${lancamentoParaFinalizar.descricao}`}
            <span style={{ color: 'var(--accent)', marginLeft: 8 }}>
              ({t('ponto.decorrido', { tempo: calcularDecorrido(lancamentoParaFinalizar.horaInicio, lancamentoParaFinalizar.data) })})
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('comum.horaInicio')}</label>
              <input className="input input-mono" value={lancamentoParaFinalizar.horaInicio} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">{t('comum.horaFim')} *</label>
              <input className="input input-mono" type="time" value={horaFim}
                onChange={e => setHoraFim(e.target.value)} autoFocus />
            </div>
          </div>
          {/* `escopos` são do projeto desta página; ao trocar de projeto, o lançamento
              finalizado é de OUTRO projeto — nesse caso o seletor some e o escopo dele
              é mantido (o backend recusa escopo de outro projeto). */}
          {escoposAprovados.length > 0 && lancamentoParaFinalizar.projetoId === projetoId && (
            <div className="form-group">
              <label className="form-label">{t('lanc.associarEscopo')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <select className="input" value={escopoIdFinal} onChange={e => setEscopoIdFinal(e.target.value)}>
                <option value="">{t('lanc.escopoPrincipal')}</option>
                {escoposAprovados.map(e => (
                  <option key={e.id} value={e.id}>{e.titulo} ({e.horasAdicionais != null ? `+${e.horasAdicionais.toFixed(1)}h` : t('escopo.horasLivres')})</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{t('comum.descricao')} *</label>
            <textarea className="input" rows={3}
              placeholder={t('dashboard.oQueFoiFeito')}
              value={descricaoFinal}
              onChange={e => setDescricaoFinal(e.target.value)} />
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={fecharModal} disabled={carregando}>{t('comum.cancelar')}</button>
          <Button className="btn btn-primary" onClick={finalizar} loading={carregando}>
            {iniciarAposFechar ? t('ponto.encerrarEIniciar') : t('dashboard.finalizarESalvar')}
          </Button>
        </div>
      </div>
    </div>
  )

  // ── Modal de escolha de descrição ao iniciar ──
  const modalDescricaoJSX = modalDescricao && (
    <div className="modal-overlay" onClick={fecharModalDescricao}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('ponto.modalDescricaoTitulo')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={fecharModalDescricao}>✕</button>
        </div>

        {!escrevendoNovaDescricao ? (
          <>
            <div style={{
              background: 'var(--bg-3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}>
              {descricaoAnteriorSugerida}
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setEscrevendoNovaDescricao(true)} disabled={carregando}>
                {t('ponto.novaDescricao')}
              </button>
              <Button className="btn btn-primary"
                onClick={() => iniciarComDescricao(descricaoAnteriorSugerida)} loading={carregando}>
                {t('ponto.reutilizarDescricao')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">{t('comum.descricao')} *</label>
              <textarea className="input" rows={3} autoFocus
                placeholder={t('dashboard.oQueFoiFeito')}
                value={novaDescricaoIniciar}
                onChange={e => setNovaDescricaoIniciar(e.target.value)} />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary"
                onClick={() => descricaoAnteriorSugerida ? setEscrevendoNovaDescricao(false) : fecharModalDescricao()}
                disabled={carregando}>
                {descricaoAnteriorSugerida ? t('comum.voltar') : t('comum.cancelar')}
              </button>
              <Button className="btn btn-primary"
                onClick={() => iniciarComDescricao(novaDescricaoIniciar)} loading={carregando}>
                {t('ponto.iniciar')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  // ── Em andamento neste projeto ──
  if (lancamentoAberto) {
    return (
      <>
        <div style={{
          background: 'var(--accent-dim)',
          border: '1px solid var(--status-ativo-bg)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div className="flex-center gap-12">
            <div className="pulse-dot" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                {t('ponto.emAndamento', { hora: lancamentoAberto.horaInicio })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {lancamentoAberto.descricao || <em>{t('comum.semDescricao')}</em>}
                &nbsp;·&nbsp;
                <span style={{ color: 'var(--accent)' }}>
                  {t('ponto.decorrido', { tempo: calcularDecorrido(lancamentoAberto.horaInicio, lancamentoAberto.data) })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex-center gap-8">
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmarCancelar(true)} disabled={carregando}
              style={{ color: 'var(--danger)' }}>
              {t('ponto.cancelarBtn')}
            </button>
            <Button className="btn btn-primary btn-sm"
              onClick={() => abrirModal(lancamentoAberto, false)} disabled={carregando}>
              {t('ponto.finalizarBtn')}
            </Button>
          </div>
        </div>
        {modalJSX}
        {confirmarCancelar && (
          <ConfirmModal
            titulo={t('ponto.cancelarBtn')}
            mensagem={t('ponto.confirmarCancelar')}
            confirmarLabel={t('comum.confirmar')}
            perigo
            confirmando={carregando}
            onConfirmar={cancelar}
            onFechar={() => setConfirmarCancelar(false)}
          />
        )}
      </>
    )
  }

  // ── Parado ──
  return (
    <>
      <Button className="btn btn-primary" onClick={iniciar} loading={carregando}
        style={{ fontSize: 14, padding: '10px 20px' }}>
        {t('ponto.iniciar')}
      </Button>
      {modalJSX}
      {modalDescricaoJSX}
    </>
  )
}
