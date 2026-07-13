import { useState, useEffect, useRef } from 'react'
import { lancamentosApi } from '../services/api'
import type { LancamentoHoras } from '../types'
import type { ToastFns } from '../App'

interface Props {
  projetoId: string
  lancamentoAberto: LancamentoHoras | null  // lançamento deste projeto
  toast: ToastFns
  onAtualizar: () => void
}

function calcularDecorrido(horaInicio: string): string {
  const [h, m] = horaInicio.split(':').map(Number)
  const inicio = new Date()
  inicio.setHours(h, m, 0, 0)
  const diff = Math.max(0, Date.now() - inicio.getTime())
  const totalMin = Math.floor(diff / 60000)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function horaAtual(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function ControlePonto({ projetoId, lancamentoAberto, toast, onAtualizar }: Props) {
  const [carregando, setCarregando] = useState(false)

  // modal finalizar
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [horaFim, setHoraFim] = useState('')
  const [descricaoFinal, setDescricaoFinal] = useState('')

  // lançamento que será finalizado no modal — pode ser deste projeto ou de outro
  const [lancamentoParaFinalizar, setLancamentoParaFinalizar] = useState<LancamentoHoras | null>(null)

  // se true: ao finalizar, inicia automaticamente o projetoId atual
  const [iniciarAposFechar, setIniciarAposFechar] = useState(false)

  // timer — re-render a cada minuto
  const [, setTick] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!lancamentoAberto) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    setTick(t => t + 1)
    intervalRef.current = setInterval(() => setTick(t => t + 1), 60000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [lancamentoAberto?.id])

  function abrirModal(lancamento: LancamentoHoras, comTroca: boolean) {
    setLancamentoParaFinalizar(lancamento)
    setHoraFim(horaAtual())
    setDescricaoFinal(lancamento.descricao ?? '')
    setIniciarAposFechar(comTroca)
    setModalFinalizar(true)
  }

  function fecharModal() {
    setModalFinalizar(false)
    setLancamentoParaFinalizar(null)
    setIniciarAposFechar(false)
  }

  async function iniciar() {
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

      // sem conflito — inicia normalmente
      await lancamentosApi.iniciar(projetoId)
      toast.success('Trabalho iniciado!')
      onAtualizar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao iniciar')
    } finally {
      setCarregando(false)
    }
  }

  async function finalizar() {
    if (!lancamentoParaFinalizar) return
    if (!horaFim) { toast.error('Informe a hora de fim'); return }
    setCarregando(true)
    try {
      await lancamentosApi.finalizar(lancamentoParaFinalizar.id, {
        horaFim,
        descricao: descricaoFinal || undefined,
      })

      if (iniciarAposFechar) {
        await lancamentosApi.iniciar(projetoId)
        toast.success('Trabalho anterior encerrado e novo iniciado!')
      } else {
        toast.success('Trabalho finalizado!')
      }

      fecharModal()
      onAtualizar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao finalizar')
    } finally {
      setCarregando(false)
    }
  }

  async function cancelar() {
    if (!lancamentoAberto) return
    if (!confirm('Cancelar o lançamento em andamento? Os dados serão perdidos.')) return
    setCarregando(true)
    try {
      await lancamentosApi.excluir(lancamentoAberto.id)
      toast.success('Lançamento cancelado')
      onAtualizar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cancelar')
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
              {iniciarAposFechar ? 'Encerrar e trocar projeto' : 'Finalizar trabalho'}
            </h2>
            {iniciarAposFechar && (
              <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>
                ⚠ Encerre o trabalho atual para iniciar este projeto.
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
            Encerrando: iniciado às {lancamentoParaFinalizar.horaInicio}
            {lancamentoParaFinalizar.descricao && ` · ${lancamentoParaFinalizar.descricao}`}
            <span style={{ color: 'var(--accent)', marginLeft: 8 }}>
              ({calcularDecorrido(lancamentoParaFinalizar.horaInicio)} decorrido)
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Hora início</label>
              <input className="input input-mono" value={lancamentoParaFinalizar.horaInicio} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Hora fim *</label>
              <input className="input input-mono" type="time" value={horaFim}
                onChange={e => setHoraFim(e.target.value)} autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea className="input" rows={3}
              placeholder="O que foi feito neste período?"
              value={descricaoFinal}
              onChange={e => setDescricaoFinal(e.target.value)} />
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={fecharModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={finalizar} disabled={carregando}>
            {carregando
              ? 'Processando...'
              : iniciarAposFechar
                ? '⇄ Encerrar e iniciar novo'
                : '⏹ Finalizar e salvar'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Em andamento neste projeto ──
  if (lancamentoAberto) {
    return (
      <>
        <div style={{
          background: 'var(--accent-dim)',
          border: '1px solid rgba(168,255,62,0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div className="flex-center gap-12">
            <div className="pulse-dot" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                Em andamento — iniciado às {lancamentoAberto.horaInicio}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {lancamentoAberto.descricao || <em>sem descrição</em>}
                &nbsp;·&nbsp;
                <span style={{ color: 'var(--accent)' }}>
                  {calcularDecorrido(lancamentoAberto.horaInicio)} decorrido
                </span>
              </div>
            </div>
          </div>
          <div className="flex-center gap-8">
            <button className="btn btn-ghost btn-sm" onClick={cancelar} disabled={carregando}
              style={{ color: 'var(--danger)' }}>
              ✕ Cancelar
            </button>
            <button className="btn btn-primary btn-sm"
              onClick={() => abrirModal(lancamentoAberto, false)} disabled={carregando}>
              ⏹ Finalizar trabalho
            </button>
          </div>
        </div>
        {modalJSX}
      </>
    )
  }

  // ── Parado ──
  return (
    <>
      <button className="btn btn-primary" onClick={iniciar} disabled={carregando}
        style={{ fontSize: 14, padding: '10px 20px' }}>
        {carregando ? '...' : '▶ Iniciar trabalho'}
      </button>
      {modalJSX}
    </>
  )
}
