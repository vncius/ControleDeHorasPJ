import { useEffect, useState, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { projetosApi, clientesApi, escoposApi, lancamentosApi } from '../services/api'
import type { ResumoProjeto, AlteracaoEscopo, LancamentoHoras, StatusEscopo, Cliente } from '../types'
import type { ToastFns } from '../App'
import ControlePonto from '../components/ControlePonto'
import TabelaLancamentos from '../components/TabelaLancamentos'
import ModalImportacao from '../components/ModalImportacao'
import { ProjetoForm, projetoParaForm, formParaPayload } from './Projetos'
import { STATUS_COR } from '../constants/statusProjeto'
import { calcularDecorridoDecimal } from '../utils/tempo'
import { useAgoraTick } from '../hooks/useAgoraTick'

interface Props { toast: ToastFns }

const STATUS_PROJETO_I18N_KEY: Record<string, string> = {
  'Aguardando início': 'statusProjeto.aguardandoInicio',
  'Em desenvolvimento': 'statusProjeto.emDesenvolvimento',
  'Com impedimento': 'statusProjeto.comImpedimento',
  'Em testes': 'statusProjeto.emTestes',
  'Entregue': 'statusProjeto.entregue',
  'Finalizado': 'statusProjeto.finalizado',
  'Cancelado': 'statusProjeto.cancelado',
}

const STATUS_ESCOPO_I18N_KEY: Record<StatusEscopo, string> = {
  Aprovada: 'statusEscopo.Aprovada',
  Pendente: 'statusEscopo.Pendente',
  Cancelada: 'statusEscopo.Cancelada',
}

function progressClass(pct: number) {
  if (pct >= 100) return 'progress-danger'
  if (pct >= 80) return 'progress-warning'
  return 'progress-ok'
}

function useFmtReais() {
  const { i18n } = useTranslation()
  return (v?: number) => v == null ? '—' : v.toLocaleString(i18n.language, { style: 'currency', currency: 'BRL' })
}

function useFmtDataBR() {
  const { i18n } = useTranslation()
  return (iso?: string) => !iso ? '—' : new Date(iso + 'T00:00:00').toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function BadgeEscopo({ status }: { status: StatusEscopo }) {
  const { t } = useTranslation()
  const map: Record<StatusEscopo, string> = {
    Aprovada: 'badge-aprovada',
    Pendente: 'badge-pendente',
    Cancelada: 'badge-cancelado',
  }
  return <span className={`badge ${map[status]}`}>{t(STATUS_ESCOPO_I18N_KEY[status])}</span>
}

function MetricCard({ label, value, sub, destaque }: { label: string; value: string | number; sub?: string; destaque?: boolean }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: destaque ? 'var(--accent)' : 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

// ── Modal de Escopo ──────────────────────────────────────────────

interface ModalEscopoProps {
  projetoId: string
  editando: AlteracaoEscopo | null
  toast: ToastFns
  onSalvar: () => void
  onFechar: () => void
}

function ModalEscopo({ projetoId, editando, toast, onSalvar, onFechar }: ModalEscopoProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    titulo: editando?.titulo ?? '',
    descricaoDetalhada: editando?.descricaoDetalhada ?? '',
    horasAdicionais: editando ? String(editando.horasAdicionais) : '',
    status: (editando?.status ?? 'Pendente') as StatusEscopo,
    dataInicio: editando?.dataInicio ?? '',
    dataFim: editando?.dataFim ?? '',
    observacoes: editando?.observacoes ?? '',
  })
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!form.titulo.trim()) { toast.error(t('escopo.tituloObrigatorio')); return }
    const horas = parseFloat(form.horasAdicionais)
    if (!horas || horas <= 0) { toast.error(t('escopo.horasInvalidas')); return }
    if (form.dataInicio && form.dataFim && form.dataFim < form.dataInicio) {
      toast.error(t('escopo.dataFimAnterior')); return
    }
    setSalvando(true)
    try {
      const payload = {
        titulo: form.titulo,
        descricaoDetalhada: form.descricaoDetalhada || undefined,
        horasAdicionais: horas,
        status: form.status,
        dataInicio: form.dataInicio || undefined,
        dataFim: form.dataFim || undefined,
        observacoes: form.observacoes || undefined,
      }
      if (editando) {
        await escoposApi.atualizar(editando.id, payload)
        toast.success(t('escopo.atualizado'))
      } else {
        await escoposApi.criar(projetoId, payload)
        toast.success(t('escopo.criado'))
      }
      onSalvar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroSalvar'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editando ? t('escopo.modalEditar') : t('escopo.modalNovo')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">{t('escopo.tituloLabel')}</label>
            <input className="input" placeholder={t('escopo.tituloPlaceholder')}
              value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">{t('escopo.descricaoDetalhada')}</label>
            <textarea className="input" rows={2} placeholder={t('escopo.descricaoPlaceholder')}
              value={form.descricaoDetalhada} onChange={e => setForm(f => ({ ...f, descricaoDetalhada: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('escopo.horasAdicionais')}</label>
              <input className="input input-mono" type="number" placeholder={t('escopo.horasPlaceholder')} min="0" step="0.5"
                value={form.horasAdicionais} onChange={e => setForm(f => ({ ...f, horasAdicionais: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('comum.status')}</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusEscopo }))}>
                <option value="Pendente">{t('statusEscopo.Pendente')}</option>
                <option value="Aprovada">{t('statusEscopo.Aprovada')}</option>
                <option value="Cancelada">{t('statusEscopo.Cancelada')}</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('comum.dataInicio')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <input className="input input-mono" type="date" value={form.dataInicio}
                onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('comum.dataFim')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <input className="input input-mono" type="date" value={form.dataFim}
                onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('comum.observacoes')}</label>
            <textarea className="input" rows={2} placeholder={t('comum.observacoesPlaceholder')}
              value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onFechar}>{t('comum.cancelar')}</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? t('comum.salvando') : editando ? t('comum.salvar') : t('escopo.criarBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────

export default function ProjetoDetalhe({ toast }: Props) {
  const { t } = useTranslation()
  const fmtReais = useFmtReais()
  const fmtDataBR = useFmtDataBR()
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()

  const [resumo, setResumo] = useState<ResumoProjeto | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [escopos, setEscopos] = useState<AlteracaoEscopo[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoHoras[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEscopo, setModalEscopo] = useState(false)
  const [modalImportacao, setModalImportacao] = useState(false)
  const [modalEditarProjeto, setModalEditarProjeto] = useState(false)
  const [formProjeto, setFormProjeto] = useState<ReturnType<typeof projetoParaForm> | null>(null)
  const [salvandoProjeto, setSalvandoProjeto] = useState(false)
  const [escopoEditando, setEscopoEditando] = useState<AlteracaoEscopo | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'lancamentos' | 'escopos'>('lancamentos')

  const atualizarFormProjeto: Dispatch<SetStateAction<ReturnType<typeof projetoParaForm>>> = (value) => {
    setFormProjeto((prev) => {
      if (!prev) return prev
      return typeof value === 'function' ? value(prev) : value
    })
  }

  const carregar = useCallback(async () => {
    if (!id) return
    try {
      const [r, e, l, cs] = await Promise.all([
        projetosApi.resumo(id),
        escoposApi.listar(id),
        lancamentosApi.listarPorProjeto(id),
        clientesApi.listar(),
      ])
      setResumo(r)
      setEscopos(e)
      setLancamentos(l)
      setClientes(cs)
    } catch {
      toast.error(t('detalhe.erroCarregar'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  function abrirEditarProjeto() {
    if (!resumo) return
    setFormProjeto(projetoParaForm(resumo.projeto))
    setModalEditarProjeto(true)
  }

  async function salvarProjeto() {
    if (!resumo || !formProjeto) return
    if (!formProjeto.nome.trim()) { toast.error(t('projetos.nomeObrigatorio')); return }
    if (!formProjeto.clienteId) { toast.error(t('projetos.selecioneCliente')); return }
    if (!formProjeto.dataInicio) { toast.error(t('projetos.dataInicioObrigatoria')); return }
    setSalvandoProjeto(true)
    try {
      await projetosApi.atualizar(resumo.projeto.id, formParaPayload(formProjeto, true))
      toast.success(t('projetos.atualizado'))
      setModalEditarProjeto(false)
      carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroSalvar'))
    } finally {
      setSalvandoProjeto(false)
    }
  }

  async function excluirEscopo(e: AlteracaoEscopo) {
    if (!confirm(t('escopo.confirmarExclusao', { titulo: e.titulo }))) return
    try {
      await escoposApi.excluir(e.id)
      toast.success(t('escopo.excluido'))
      carregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('comum.erroExcluir'))
    }
  }

  // ao-vivo: totalTrabalhado do resumo só conta lançamentos finalizados — o
  // hook precisa ser chamado incondicionalmente, antes dos early returns
  const lancamentoAberto = lancamentos.find(l => !l.horaFim) ?? null
  useAgoraTick(!!lancamentoAberto)

  if (loading) return (
    <div className="loading-screen"><div className="spinner" /><span>{t('detalhe.carregando')}</span></div>
  )

  if (!resumo) return (
    <div className="card">
      <div className="empty-state">
        <div>{t('detalhe.naoEncontrado')}</div>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => nav('/projetos')}>{t('detalhe.voltar')}</button>
      </div>
    </div>
  )

  const { projeto, cliente } = resumo

  // regra única: exibido = finalizados (resumo) + decorrido do lançamento aberto
  const decorridoAoVivo = lancamentoAberto ? calcularDecorridoDecimal(lancamentoAberto.horaInicio, lancamentoAberto.data) : 0
  const totalTrabalhado = Math.round((resumo.totalTrabalhado + decorridoAoVivo) * 100) / 100
  const saldo = resumo.horasAbertas ? 0 : Math.round((resumo.totalDisponivel - totalTrabalhado) * 100) / 100
  const percentualConsumido = resumo.horasAbertas
    ? 0
    : resumo.totalDisponivel > 0
      ? Math.round((totalTrabalhado / resumo.totalDisponivel) * 10000) / 100
      : 0
  const valorTrabalhado = projeto.valorHora != null ? Math.round(totalTrabalhado * projeto.valorHora * 100) / 100 : undefined

  const pct = Math.min(percentualConsumido, 100)

  const statusCor = STATUS_COR[projeto.status] ?? { bg: 'var(--bg-3)', color: 'var(--text-muted)' }

  return (
    <div style={{ animation: 'slideUp 0.25s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => nav('/projetos')}
          style={{ marginBottom: 12, color: 'var(--text-muted)' }}>
          {t('detalhe.voltarProjetos')}
        </button>
        <div className="flex-between">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{cliente.nome}</div>
            <h1 className="page-title">{projeto.nome}</h1>
            {projeto.descricao && <p className="page-subtitle" style={{ marginTop: 4 }}>{projeto.descricao}</p>}
          </div>
          <div className="flex-center gap-8">
            <span className="badge" style={{ background: statusCor.bg, color: statusCor.color, fontSize: 11 }}>
              {t(STATUS_PROJETO_I18N_KEY[projeto.status] ?? projeto.status)}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={abrirEditarProjeto}>{t('detalhe.editar')}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setModalImportacao(true)}>{t('detalhe.importar')}</button>
            <ControlePonto
              projetoId={projeto.id}
              lancamentoAberto={lancamentoAberto}
              toast={toast}
              onAtualizar={carregar}
            />
          </div>
        </div>
      </div>

      {/* Barra de progresso */}
      {resumo.horasAbertas ? (
        <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--status-ativo-bg)', borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ fontSize: 16 }}>∞</span>
          <span>{t('detalhe.horasAbertasBanner')}</span>
        </div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('detalhe.trabalhadasDe', { trabalhado: totalTrabalhado.toFixed(1), disponivel: resumo.totalDisponivel.toFixed(1) })}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: percentualConsumido >= 100 ? 'var(--danger)' : percentualConsumido >= 80 ? 'var(--warning)' : 'var(--accent)' }}>
              {percentualConsumido.toFixed(1)}%
            </span>
          </div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div className={`progress-fill ${progressClass(percentualConsumido)}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Cards métricas */}
      {resumo.horasAbertas ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 32 }}>
          <MetricCard label={t('detalhe.cardHorasContratadas')} value={t('detalhe.emAbertoValor')} sub={t('detalhe.semLimite')} />
          <MetricCard label={t('detalhe.cardTrabalhadas')} value={`${totalTrabalhado.toFixed(1)}h`} sub={t('detalhe.lancFinalizados')} destaque />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 32 }}>
          <MetricCard label={t('detalhe.cardContratadas')} value={`${resumo.horasContratadas.toFixed(0)}h`} sub={t('detalhe.horasBase')} />
          <MetricCard label={t('detalhe.cardExtras')} value={`+${resumo.horasExtrasAprovadas.toFixed(1)}h`} sub={t('detalhe.escoposAprovados')} />
          <MetricCard label={t('detalhe.cardTrabalhadas')} value={`${totalTrabalhado.toFixed(1)}h`} sub={t('detalhe.lancFinalizados')} destaque />
          <MetricCard label={t('detalhe.cardSaldo')} value={`${saldo >= 0 ? '+' : ''}${saldo.toFixed(1)}h`} sub={saldo < 0 ? t('detalhe.horasExcedidas') : t('detalhe.horasDisponiveis')} />
        </div>
      )}

      {/* Cards financeiros */}
      {projeto.valorHora != null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 32 }}>
          <MetricCard label={t('detalhe.cardValorHora')} value={fmtReais(projeto.valorHora)} sub={t('detalhe.porHora')} />
          {!resumo.horasAbertas && <MetricCard label={t('detalhe.receitaPrevista')} value={fmtReais(resumo.valorEstimado)} sub={t('detalhe.receitaPrevistaSub')} />}
          <MetricCard label={t('detalhe.receitaExecutada')} value={fmtReais(valorTrabalhado)} sub={t('detalhe.receitaExecutadaSub')} destaque />
        </div>
      )}

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['lancamentos', 'escopos'] as const).map(aba => (
          <button key={aba} onClick={() => setAbaAtiva(aba)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            borderBottom: abaAtiva === aba ? '2px solid var(--accent)' : '2px solid transparent',
            color: abaAtiva === aba ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 13, fontWeight: abaAtiva === aba ? 600 : 400,
            fontFamily: 'var(--font-ui)', cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s',
          }}>
            {aba === 'lancamentos' ? t('detalhe.abaLancamentos', { count: lancamentos.length }) : t('detalhe.abaEscopos', { count: escopos.length })}
          </button>
        ))}
      </div>

      {/* Aba Lançamentos */}
      {abaAtiva === 'lancamentos' && (
        <TabelaLancamentos
          projetoId={projeto.id}
          lancamentos={lancamentos}
          escopos={escopos}
          toast={toast}
          onAtualizar={carregar}
        />
      )}

      {/* Aba Escopos */}
      {abaAtiva === 'escopos' && (
        <div>
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('escopo.titulo')}
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEscopoEditando(null); setModalEscopo(true) }}>
              {t('escopo.novo')}
            </button>
          </div>

          {escopos.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: '32px 24px' }}>
                <div className="empty-state-icon">⊕</div>
                <div>{t('escopo.nenhum')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('escopo.dica')}</div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={() => { setEscopoEditando(null); setModalEscopo(true) }}>{t('escopo.adicionarPrimeiro')}</button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('escopo.colTitulo')}</th>
                      <th className="hide-mobile" style={{ width: 90 }}>{t('comum.inicio')}</th>
                      <th className="hide-mobile" style={{ width: 90 }}>{t('comum.fim')}</th>
                      <th style={{ width: 90 }}>{t('escopo.colHoras')}</th>
                      <th style={{ width: 90 }}>{t('comum.status')}</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {escopos.map(e => (
                      <tr key={e.id} onClick={() => { setEscopoEditando(e); setModalEscopo(true) }}>
                        <td style={{ fontWeight: 500 }}>
                          {e.titulo}
                          {e.descricaoDetalhada && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.descricaoDetalhada}</div>}
                        </td>
                        <td className="td-mono hide-mobile">{fmtDataBR(e.dataInicio)}</td>
                        <td className="td-mono hide-mobile">{fmtDataBR(e.dataFim)}</td>
                        <td className="td-mono" style={{ color: e.status === 'Aprovada' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: e.status === 'Aprovada' ? 600 : 400 }}>
                          +{e.horasAdicionais.toFixed(1)}h
                        </td>
                        <td><BadgeEscopo status={e.status} /></td>
                        <td onClick={ev => ev.stopPropagation()}>
                          <div className="flex-center gap-4">
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEscopoEditando(e); setModalEscopo(true) }}>✎</button>
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => excluirEscopo(e)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {escopos.some(e => e.status === 'Aprovada') && (
                    <tfoot>
                      <tr style={{ borderTop: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('escopo.totalAprovado')}</td>
                        <td className="hide-mobile" colSpan={2} />
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>+{resumo.horasExtrasAprovadas.toFixed(1)}h</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {modalEscopo && (
        <ModalEscopo projetoId={projeto.id} editando={escopoEditando} toast={toast}
          onSalvar={() => { setModalEscopo(false); setEscopoEditando(null); carregar() }}
          onFechar={() => { setModalEscopo(false); setEscopoEditando(null) }} />
      )}
      {modalImportacao && (
        <ModalImportacao projetoId={projeto.id} toast={toast}
          onImportado={() => { setModalImportacao(false); carregar() }}
          onFechar={() => setModalImportacao(false)} />
      )}
      {modalEditarProjeto && formProjeto && (
        <ProjetoForm
          form={formProjeto}
          setForm={atualizarFormProjeto}
          clientes={clientes}
          salvando={salvandoProjeto}
          onSalvar={salvarProjeto}
          onFechar={() => setModalEditarProjeto(false)}
          titulo="Editar projeto"
        />
      )}
    </div>
  )
}
