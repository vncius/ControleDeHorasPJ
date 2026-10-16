import { useEffect, useState, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { projetosApi, clientesApi, escoposApi, lancamentosApi, pagamentosApi } from '../services/api'
import type { ResumoProjeto, AlteracaoEscopo, LancamentoHoras, StatusEscopo, Cliente, Pagamento } from '../types'
import type { ToastFns } from '../App'
import ControlePonto from '../components/ControlePonto'
import TabelaLancamentos from '../components/TabelaLancamentos'
import ModalImportacao from '../components/ModalImportacao'
import ConfirmModal from '../components/ConfirmModal'
import Button from '../components/Button'
import { ProjetoForm, projetoParaForm, formParaPayload } from './Projetos'
import { STATUS_COR, STATUS_PAGAMENTO_COR, STATUS_PAGAMENTO_I18N_KEY } from '../constants/statusProjeto'
import { calcularDecorridoDecimal, periodoApuracao, hojeLocal } from '../utils/tempo'
import { useAgoraTick } from '../hooks/useAgoraTick'
import { useFormatarData } from '../contexts/PreferenciasContext'
import DatePicker from '../components/DatePicker'
import Modal from '../components/Modal'

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
    horasAdicionais: editando?.horasAdicionais != null ? String(editando.horasAdicionais) : '',
    status: (editando?.status ?? 'Pendente') as StatusEscopo,
    dataInicio: editando?.dataInicio ?? '',
    dataFim: editando?.dataFim ?? '',
    observacoes: editando?.observacoes ?? '',
  })
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (salvando) return
    if (!form.titulo.trim()) { toast.error(t('escopo.tituloObrigatorio')); return }
    // vazio = horas livres (levantamento, estimativa etc.); preenchido precisa ser > 0
    const horasTexto = form.horasAdicionais.trim()
    const horas = horasTexto === '' ? undefined : parseFloat(horasTexto)
    if (horas !== undefined && (!horas || horas <= 0)) { toast.error(t('escopo.horasInvalidas')); return }
    if (form.dataInicio && form.dataFim && form.dataFim < form.dataInicio) {
      toast.error(t('escopo.dataFimAnterior')); return
    }
    setSalvando(true)
    try {
      const payload = {
        titulo: form.titulo,
        descricaoDetalhada: form.descricaoDetalhada || undefined,
        horasAdicionais: horas ?? null,   // null limpa as horas ao editar; no criar o backend trata como livre
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
    <Modal onFechar={onFechar} className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{editando ? t('escopo.modalEditar') : t('escopo.modalNovo')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar} aria-label={t('comum.fechar')}>✕</button>
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
              <label className="form-label">{t('escopo.horasAdicionais')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <input className="input input-mono" type="number" placeholder={t('escopo.horasPlaceholder')} min="0" step="0.5"
                value={form.horasAdicionais} onChange={e => setForm(f => ({ ...f, horasAdicionais: e.target.value }))} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('escopo.horasLivresDica')}</div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('comum.status')}</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusEscopo }))}>
                <option value="Pendente">{t('statusEscopo.Pendente')}</option>
                <option value="Aprovada">{t('statusEscopo.Aprovada')}</option>
                <option value="Cancelada">{t('statusEscopo.Cancelada')}</option>
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('escopo.statusDica')}</div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('comum.dataInicio')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <DatePicker value={form.dataInicio} opcional
                onChange={v => setForm(f => ({ ...f, dataInicio: v }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('comum.dataFim')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <DatePicker value={form.dataFim} opcional
                onChange={v => setForm(f => ({ ...f, dataFim: v }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('comum.observacoes')}</label>
            <textarea className="input" rows={2} placeholder={t('comum.observacoesPlaceholder')}
              value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onFechar} disabled={salvando}>{t('comum.cancelar')}</button>
          <Button className="btn btn-primary" onClick={salvar} loading={salvando}>
            {editando ? t('comum.salvar') : t('escopo.criarBtn')}
          </Button>
        </div>
    </Modal>
  )
}

// ── Modal de Pagamento ───────────────────────────────────────────

interface ModalPagamentoProps {
  projetoId: string
  editando: Pagamento | null
  toast: ToastFns
  onSalvar: () => void
  onFechar: () => void
}

function ModalPagamento({ projetoId, editando, toast, onSalvar, onFechar }: ModalPagamentoProps) {
  const { t } = useTranslation()
  const periodoPadrao = periodoApuracao(editando?.dataPagamento ?? hojeLocal())
  const [form, setForm] = useState({
    horasCobertas: editando ? String(editando.horasCobertas) : '',
    valor: editando?.valor != null ? String(editando.valor) : '',
    dataPagamento: editando?.dataPagamento ?? hojeLocal(),
    periodoApuracaoInicio: editando?.periodoApuracaoInicio ?? periodoPadrao.inicio,
    periodoApuracaoFim: editando?.periodoApuracaoFim ?? periodoPadrao.fim,
    numeroNF: editando?.numeroNF ?? '',
    observacoes: editando?.observacoes ?? '',
  })
  const [salvando, setSalvando] = useState(false)

  function usarPeriodoDe(data: string) {
    const p = periodoApuracao(data)
    setForm(f => ({ ...f, periodoApuracaoInicio: p.inicio, periodoApuracaoFim: p.fim }))
  }

  async function salvar() {
    if (salvando) return
    const horas = parseFloat(form.horasCobertas)
    if (!horas || horas <= 0) { toast.error(t('pagamento.horasInvalidas')); return }
    if (!form.dataPagamento) { toast.error(t('pagamento.dataObrigatoria')); return }
    if (!form.periodoApuracaoInicio || !form.periodoApuracaoFim) { toast.error(t('pagamento.periodoObrigatorio')); return }
    if (form.periodoApuracaoFim < form.periodoApuracaoInicio) { toast.error(t('pagamento.periodoInvalido')); return }
    setSalvando(true)
    try {
      const payload = {
        horasCobertas: horas,
        valor: form.valor ? parseFloat(form.valor) : undefined,
        dataPagamento: form.dataPagamento,
        periodoApuracaoInicio: form.periodoApuracaoInicio,
        periodoApuracaoFim: form.periodoApuracaoFim,
        numeroNF: form.numeroNF || undefined,
        observacoes: form.observacoes || undefined,
      }
      if (editando) {
        await pagamentosApi.atualizar(editando.id, payload)
        toast.success(t('pagamento.atualizado'))
      } else {
        await pagamentosApi.criar(projetoId, payload)
        toast.success(t('pagamento.criado'))
      }
      onSalvar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroSalvar'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal onFechar={onFechar} className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{editando ? t('pagamento.modalEditar') : t('pagamento.modalNovo')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar} aria-label={t('comum.fechar')}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('pagamento.horasCobertas')}</label>
              <input className="input input-mono" type="number" min="0" step="0.5"
                placeholder={t('pagamento.horasPlaceholder')}
                value={form.horasCobertas} onChange={e => setForm(f => ({ ...f, horasCobertas: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">{t('pagamento.valorLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <input className="input input-mono" type="number" min="0" step="0.01"
                placeholder={t('pagamento.valorPlaceholder')}
                value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('pagamento.dataPagamentoLabel')}</label>
              <DatePicker value={form.dataPagamento}
                onChange={v => { setForm(f => ({ ...f, dataPagamento: v })); usarPeriodoDe(v) }} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('pagamento.numeroNFLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <input className="input" placeholder={t('pagamento.numeroNFPlaceholder')}
                value={form.numeroNF} onChange={e => setForm(f => ({ ...f, numeroNF: e.target.value }))} />
            </div>
          </div>
          <div>
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>{t('pagamento.periodoApuracao')}</label>
              <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                onClick={() => usarPeriodoDe(form.dataPagamento)}>
                {t('pagamento.usarPeriodoDoData')}
              </button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <DatePicker value={form.periodoApuracaoInicio}
                  onChange={v => setForm(f => ({ ...f, periodoApuracaoInicio: v }))} />
              </div>
              <div className="form-group">
                <DatePicker value={form.periodoApuracaoFim}
                  onChange={v => setForm(f => ({ ...f, periodoApuracaoFim: v }))} />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('comum.observacoes')}</label>
            <textarea className="input" rows={2} placeholder={t('comum.observacoesPlaceholder')}
              value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onFechar} disabled={salvando}>{t('comum.cancelar')}</button>
          <Button className="btn btn-primary" onClick={salvar} loading={salvando}>
            {editando ? t('comum.salvar') : t('pagamento.criarBtn')}
          </Button>
        </div>
    </Modal>
  )
}

// ── Página principal ─────────────────────────────────────────────

export default function ProjetoDetalhe({ toast }: Props) {
  const { t } = useTranslation()
  const fmtReais = useFmtReais()
  const { formatarData: fmtDataBR } = useFormatarData()
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const location = useLocation()

  const [resumo, setResumo] = useState<ResumoProjeto | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [escopos, setEscopos] = useState<AlteracaoEscopo[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoHoras[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEscopo, setModalEscopo] = useState(false)
  const [modalImportacao, setModalImportacao] = useState(false)
  const [modalEditarProjeto, setModalEditarProjeto] = useState(false)
  const [modalPagamento, setModalPagamento] = useState(false)
  const [formProjeto, setFormProjeto] = useState<ReturnType<typeof projetoParaForm> | null>(null)
  const [salvandoProjeto, setSalvandoProjeto] = useState(false)
  const [escopoEditando, setEscopoEditando] = useState<AlteracaoEscopo | null>(null)
  const [pagamentoEditando, setPagamentoEditando] = useState<Pagamento | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'lancamentos' | 'escopos' | 'pagamentos'>('lancamentos')
  const [confirmarExcluirEscopo, setConfirmarExcluirEscopo] = useState<AlteracaoEscopo | null>(null)
  const [excluindoEscopo, setExcluindoEscopo] = useState(false)
  const [confirmarExcluirPagamento, setConfirmarExcluirPagamento] = useState<Pagamento | null>(null)
  const [excluindoPagamento, setExcluindoPagamento] = useState(false)
  const [confirmarExcluirProjeto, setConfirmarExcluirProjeto] = useState(false)
  const [excluindoProjeto, setExcluindoProjeto] = useState(false)

  const atualizarFormProjeto: Dispatch<SetStateAction<ReturnType<typeof projetoParaForm>>> = (value) => {
    setFormProjeto((prev) => {
      if (!prev) return prev
      return typeof value === 'function' ? value(prev) : value
    })
  }

  const carregar = useCallback(async () => {
    if (!id) return
    try {
      const [r, e, l, cs, pg] = await Promise.all([
        projetosApi.resumo(id),
        escoposApi.listar(id),
        lancamentosApi.listarPorProjeto(id),
        clientesApi.listar(),
        pagamentosApi.listar(id),
      ])
      setResumo(r)
      setEscopos(e)
      setLancamentos(l)
      setClientes(cs)
      setPagamentos(pg)
    } catch {
      toast.error(t('detalhe.erroCarregar'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  // CTA do Dashboard ("Registrar alteração de escopo") navega pra cá pedindo
  // pra já abrir a aba de escopos com o modal de criação — limpa o state
  // depois pra não reabrir num F5 ou numa navegação de volta.
  useEffect(() => {
    const state = location.state as { abrirEscopo?: boolean } | null
    if (state?.abrirEscopo) {
      setAbaAtiva('escopos')
      setEscopoEditando(null)
      setModalEscopo(true)
      nav(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  function abrirEditarProjeto() {
    if (!resumo) return
    setFormProjeto(projetoParaForm(resumo.projeto))
    setModalEditarProjeto(true)
  }

  async function salvarProjeto() {
    if (salvandoProjeto) return
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

  async function confirmarExclusaoEscopo() {
    if (excluindoEscopo) return
    if (!confirmarExcluirEscopo) return
    setExcluindoEscopo(true)
    try {
      await escoposApi.excluir(confirmarExcluirEscopo.id)
      toast.success(t('escopo.excluido'))
      setConfirmarExcluirEscopo(null)
      carregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('comum.erroExcluir'))
    } finally {
      setExcluindoEscopo(false)
    }
  }

  async function confirmarExclusaoPagamento() {
    if (excluindoPagamento) return
    if (!confirmarExcluirPagamento) return
    setExcluindoPagamento(true)
    try {
      await pagamentosApi.excluir(confirmarExcluirPagamento.id)
      toast.success(t('pagamento.excluido'))
      setConfirmarExcluirPagamento(null)
      carregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('comum.erroExcluir'))
    } finally {
      setExcluindoPagamento(false)
    }
  }

  async function confirmarExclusaoProjeto() {
    if (excluindoProjeto) return
    if (!resumo) return
    setExcluindoProjeto(true)
    try {
      await projetosApi.excluir(resumo.projeto.id)
      toast.success(t('projetos.excluido'))
      nav('/projetos')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('comum.erroExcluir'))
      setExcluindoProjeto(false)
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

  // consumo por escopo — mesma regra "finalizados + decorrido do aberto" aplicada por escopoId
  const trabalhadasPorEscopo = new Map<string, number>()
  lancamentos.filter(l => l.horaFim && l.escopoId).forEach(l => {
    trabalhadasPorEscopo.set(l.escopoId!, (trabalhadasPorEscopo.get(l.escopoId!) ?? 0) + (l.totalDecimal ?? 0))
  })
  if (lancamentoAberto?.escopoId) {
    trabalhadasPorEscopo.set(lancamentoAberto.escopoId, (trabalhadasPorEscopo.get(lancamentoAberto.escopoId) ?? 0) + decorridoAoVivo)
  }

  // Saldo a faturar = horas fechadas com o cliente (contratadas + extras de
  // escopo aprovadas) menos o que já foi pago — independe do que foi lançado.
  // Projeto de horas abertas não tem total fechado; nele a base é o trabalhado.
  // Projeto considerado pago não tem saldo.
  const baseFaturamento = resumo.horasAbertas ? totalTrabalhado : resumo.totalDisponivel
  const saldoAFaturar = projeto.consideradoPago
    ? 0
    : Math.max(0, Math.round((baseFaturamento - resumo.totalHorasCobertas) * 100) / 100)

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
        <div className="detalhe-header">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{cliente.nome}</div>
            <h1 className="page-title">{projeto.nome}</h1>
            {projeto.descricao && <p className="page-subtitle" style={{ marginTop: 4 }}>{projeto.descricao}</p>}
          </div>
          <div className="detalhe-header-actions">
            <span className="badge" style={{ background: statusCor.bg, color: statusCor.color, fontSize: 11 }}>
              {t(STATUS_PROJETO_I18N_KEY[projeto.status] ?? projeto.status)}
            </span>
            <span className="badge" style={{ background: STATUS_PAGAMENTO_COR[resumo.statusPagamento].bg, color: STATUS_PAGAMENTO_COR[resumo.statusPagamento].color, fontSize: 11 }}>
              {t(STATUS_PAGAMENTO_I18N_KEY[resumo.statusPagamento])}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={abrirEditarProjeto}>{t('detalhe.editar')}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setModalImportacao(true)}>{t('detalhe.importar')}</button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmarExcluirProjeto(true)}>{t('comum.excluir')}</button>
            <ControlePonto
              projetoId={projeto.id}
              lancamentoAberto={lancamentoAberto}
              escopos={escopos}
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
        {(['lancamentos', 'escopos', 'pagamentos'] as const).map(aba => (
          <button key={aba} onClick={() => setAbaAtiva(aba)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            borderBottom: abaAtiva === aba ? '2px solid var(--accent)' : '2px solid transparent',
            color: abaAtiva === aba ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 13, fontWeight: abaAtiva === aba ? 600 : 400,
            fontFamily: 'var(--font-ui)', cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s',
          }}>
            {aba === 'lancamentos'
              ? t('detalhe.abaLancamentos', { count: lancamentos.length })
              : aba === 'escopos'
                ? t('detalhe.abaEscopos', { count: escopos.length })
                : t('pagamento.aba', { count: pagamentos.length })}
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
                      <th className="hide-mobile" style={{ width: 120 }}>{t('escopo.colTrabalhadas')}</th>
                      <th style={{ width: 90 }}>{t('comum.status')}</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {escopos.map(e => {
                      const trabalhadas = trabalhadasPorEscopo.get(e.id) ?? 0
                      const pctEscopo = e.horasAdicionais ? Math.min((trabalhadas / e.horasAdicionais) * 100, 100) : 0
                      return (
                      <tr key={e.id} onClick={() => { setEscopoEditando(e); setModalEscopo(true) }}>
                        <td style={{ fontWeight: 500 }}>
                          {e.titulo}
                          {e.descricaoDetalhada && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.descricaoDetalhada}</div>}
                        </td>
                        <td className="td-mono hide-mobile">{fmtDataBR(e.dataInicio)}</td>
                        <td className="td-mono hide-mobile">{fmtDataBR(e.dataFim)}</td>
                        <td className="td-mono" style={{ color: e.status === 'Aprovada' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: e.status === 'Aprovada' ? 600 : 400 }}>
                          {e.horasAdicionais != null ? `+${e.horasAdicionais.toFixed(1)}h` : t('escopo.horasLivres')}
                        </td>
                        <td className="hide-mobile">
                          {e.status === 'Aprovada' && e.horasAdicionais == null ? (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {trabalhadas.toFixed(1)}h
                            </div>
                          ) : e.status === 'Aprovada' && e.horasAdicionais != null ? (
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>
                                {trabalhadas.toFixed(1)}h / {e.horasAdicionais.toFixed(1)}h
                              </div>
                              <div className="progress-bar" style={{ height: 4 }}>
                                <div className={`progress-fill ${progressClass(pctEscopo)}`} style={{ width: `${pctEscopo}%` }} />
                              </div>
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td><BadgeEscopo status={e.status} /></td>
                        <td onClick={ev => ev.stopPropagation()}>
                          <div className="flex-center gap-4">
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEscopoEditando(e); setModalEscopo(true) }}>✎</button>
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmarExcluirEscopo(e)} aria-label={t('comum.excluir')}>✕</button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                  {escopos.some(e => e.status === 'Aprovada') && (
                    <tfoot>
                      <tr style={{ borderTop: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('escopo.totalAprovado')}</td>
                        <td className="hide-mobile" colSpan={2} />
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>+{resumo.horasExtrasAprovadas.toFixed(1)}h</td>
                        <td className="hide-mobile" />
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

      {/* Aba Pagamentos */}
      {abaAtiva === 'pagamentos' && (
        <div>
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pagamento.titulo')}
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => { setPagamentoEditando(null); setModalPagamento(true) }}>
              {t('pagamento.novo')}
            </button>
          </div>

          {projeto.consideradoPago && (
            <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--status-ativo-bg)', borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent)' }}>
              <span style={{ fontSize: 14 }}>✓</span>
              <span>{t('pagamento.consideradoPagoBanner')}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
            <MetricCard
              label={t('pagamento.cardPago')}
              value={`${resumo.totalHorasCobertas.toFixed(1)}h`}
              sub={projeto.valorHora != null
                ? fmtReais(resumo.totalHorasCobertas * projeto.valorHora)
                : t('pagamento.cardPagoSub')}
              destaque
            />
            <MetricCard
              label={t('pagamento.cardSaldo')}
              value={`${saldoAFaturar.toFixed(1)}h`}
              sub={projeto.valorHora != null
                ? fmtReais(saldoAFaturar * projeto.valorHora)
                : resumo.horasAbertas ? t('pagamento.cardSaldoSubAberto') : t('pagamento.cardSaldoSub')}
            />
          </div>

          {pagamentos.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: '32px 24px' }}>
                <div className="empty-state-icon">$</div>
                <div>{t('pagamento.nenhum')}</div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={() => { setPagamentoEditando(null); setModalPagamento(true) }}>{t('pagamento.adicionarPrimeiro')}</button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>{t('pagamento.colData')}</th>
                      <th style={{ width: 100 }}>{t('pagamento.colHoras')}</th>
                      <th className="hide-mobile" style={{ width: 120 }}>{t('pagamento.colValor')}</th>
                      <th className="hide-mobile">{t('pagamento.colPeriodo')}</th>
                      <th className="hide-mobile" style={{ width: 110 }}>{t('pagamento.colNF')}</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentos.map(p => (
                      <tr key={p.id} onClick={() => { setPagamentoEditando(p); setModalPagamento(true) }}>
                        <td className="td-mono">{fmtDataBR(p.dataPagamento)}</td>
                        <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{p.horasCobertas.toFixed(1)}h</td>
                        <td className="td-mono hide-mobile">{fmtReais(p.valor)}</td>
                        <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {fmtDataBR(p.periodoApuracaoInicio)} → {fmtDataBR(p.periodoApuracaoFim)}
                          {p.geradoPorRegularizacao && (
                            <span className="badge" style={{ background: 'var(--bg-3)', color: 'var(--text-muted)', fontSize: 10, marginLeft: 8 }}>
                              {t('pagamento.badgeAutomatico')}
                            </span>
                          )}
                        </td>
                        <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.numeroNF ?? '—'}</td>
                        <td onClick={ev => ev.stopPropagation()}>
                          <div className="flex-center gap-4">
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setPagamentoEditando(p); setModalPagamento(true) }}>✎</button>
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmarExcluirPagamento(p)} aria-label={t('comum.excluir')}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('comum.total')}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{resumo.totalHorasCobertas.toFixed(1)}h</td>
                      <td className="hide-mobile" colSpan={3} />
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {modalPagamento && (
        <ModalPagamento projetoId={projeto.id} editando={pagamentoEditando} toast={toast}
          onSalvar={() => { setModalPagamento(false); setPagamentoEditando(null); carregar() }}
          onFechar={() => { setModalPagamento(false); setPagamentoEditando(null) }} />
      )}
      {confirmarExcluirPagamento && (
        <ConfirmModal
          titulo={t('pagamento.excluirTitulo')}
          mensagem={t('pagamento.confirmarExclusao', { horas: confirmarExcluirPagamento.horasCobertas.toFixed(1) })}
          confirmarLabel={t('comum.excluir')}
          perigo
          confirmando={excluindoPagamento}
          onConfirmar={confirmarExclusaoPagamento}
          onFechar={() => setConfirmarExcluirPagamento(null)}
        />
      )}
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
          mostrarConsideradoPago
          onSalvar={salvarProjeto}
          onFechar={() => setModalEditarProjeto(false)}
          titulo="Editar projeto"
        />
      )}
      {confirmarExcluirEscopo && (
        <ConfirmModal
          titulo={t('escopo.excluirTitulo')}
          mensagem={t('escopo.confirmarExclusao', { titulo: confirmarExcluirEscopo.titulo })}
          confirmarLabel={t('comum.excluir')}
          perigo
          confirmando={excluindoEscopo}
          onConfirmar={confirmarExclusaoEscopo}
          onFechar={() => setConfirmarExcluirEscopo(null)}
        />
      )}
      {confirmarExcluirProjeto && resumo && (
        <ConfirmModal
          titulo={t('projetos.excluirTitulo')}
          mensagem={t('projetos.confirmarExclusaoSimples', { nome: resumo.projeto.nome })}
          confirmarLabel={t('projetos.excluirTudo')}
          perigo
          confirmando={excluindoProjeto}
          onConfirmar={confirmarExclusaoProjeto}
          onFechar={() => setConfirmarExcluirProjeto(false)}
        />
      )}
    </div>
  )
}
