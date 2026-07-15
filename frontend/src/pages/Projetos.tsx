import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { projetosApi, clientesApi, lancamentosApi } from '../services/api'
import type { Projeto, Cliente, StatusProjeto } from '../types'
import type { ToastFns } from '../App'
import { STATUS_COR } from '../constants/statusProjeto'
import { hojeLocal } from '../utils/tempo'
import ProjetoDetalhe from './ProjetoDetalhe'

interface Props { toast: ToastFns }

const STATUS_OPTS: StatusProjeto[] = [
  'Aguardando início',
  'Em desenvolvimento',
  'Com impedimento',
  'Em testes',
  'Entregue',
  'Finalizado',
  'Cancelado',
]

// mapeia o valor canônico (pt, usado como chave de negócio/API) para a chave de tradução
const STATUS_I18N_KEY: Record<StatusProjeto, string> = {
  'Aguardando início': 'statusProjeto.aguardandoInicio',
  'Em desenvolvimento': 'statusProjeto.emDesenvolvimento',
  'Com impedimento': 'statusProjeto.comImpedimento',
  'Em testes': 'statusProjeto.emTestes',
  'Entregue': 'statusProjeto.entregue',
  'Finalizado': 'statusProjeto.finalizado',
  'Cancelado': 'statusProjeto.cancelado',
}

function BadgeStatus({ status }: { status: StatusProjeto }) {
  const { t } = useTranslation()
  const { bg, color } = STATUS_COR[status] ?? { bg: 'var(--bg-3)', color: 'var(--text-muted)' }
  return (
    <span className="badge" style={{ background: bg, color, fontSize: 10, whiteSpace: 'nowrap' }}>
      {t(STATUS_I18N_KEY[status])}
    </span>
  )
}

interface FormState {
  clienteId: string
  nome: string
  descricao: string
  horasAbertas: boolean
  horasContratadas: string
  valorHora: string
  status: StatusProjeto
  pago: boolean
  dataPagamento: string
  dataInicio: string
  dataFim: string
  observacoes: string
}

const EMPTY_FORM: FormState = {
  clienteId: '',
  nome: '',
  descricao: '',
  horasAbertas: false,
  horasContratadas: '',
  valorHora: '',
  status: 'Aguardando início',
  pago: false,
  dataPagamento: '',
  dataInicio: hojeLocal(),
  dataFim: '',
  observacoes: '',
}

// Componente de form reutilizável — usado em Projetos e ProjetoDetalhe
export function ProjetoForm({
  form, setForm, clientes, salvando, onSalvar, onFechar, titulo,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  clientes: Cliente[]
  salvando: boolean
  onSalvar: () => void
  onFechar: () => void
  titulo: string
}) {
  const { t } = useTranslation()
  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{titulo}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('formProjeto.clienteLabel')}</label>
              <select className="input" value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}>
                <option value="">{t('formProjeto.selecione')}</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('comum.status')}</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusProjeto }))}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{t(STATUS_I18N_KEY[s])}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('formProjeto.nomeLabel')}</label>
            <input className="input" placeholder={t('formProjeto.nomePlaceholder')} value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} autoFocus />
          </div>

          <div className="form-group">
            <label className="form-label">{t('comum.descricao')}</label>
            <textarea className="input" placeholder={t('formProjeto.descricaoPlaceholder')} value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                {t('formProjeto.horasContratadas')}
                {form.horasAbertas && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>{t('formProjeto.emAberto')}</span>}
              </label>
              <input className="input input-mono" type="number" placeholder={t('formProjeto.horasPlaceholder')}
                value={form.horasContratadas}
                onChange={e => setForm(f => ({ ...f, horasContratadas: e.target.value }))}
                min="0" step="0.5" disabled={form.horasAbertas}
                style={{ opacity: form.horasAbertas ? 0.4 : 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={form.horasAbertas}
                  onChange={e => setForm(f => ({ ...f, horasAbertas: e.target.checked, horasContratadas: e.target.checked ? '' : f.horasContratadas }))}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                {t('formProjeto.horasAbertasCheck')}
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">{t('formProjeto.valorHoraLabel')}</label>
              <input className="input input-mono" type="number" placeholder={t('formProjeto.valorHoraPlaceholder')} value={form.valorHora}
                onChange={e => setForm(f => ({ ...f, valorHora: e.target.value }))} min="0" step="0.01" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('formProjeto.dataInicioLabel')}</label>
              <input className="input input-mono" type="date" value={form.dataInicio}
                onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('formProjeto.dataFimLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <input className="input input-mono" type="date" value={form.dataFim}
                onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('comum.observacoes')}</label>
            <textarea className="input" placeholder={t('comum.observacoesPlaceholder')} value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
          </div>

          {/* Pago */}
          <div style={{
            background: form.pago ? 'rgba(92,200,255,0.06)' : 'var(--bg-3)',
            border: `1px solid ${form.pago ? 'var(--info-bg)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', padding: '12px 16px',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: form.pago ? 12 : 0 }}>
              <input type="checkbox" checked={form.pago}
                onChange={e => setForm(f => ({ ...f, pago: e.target.checked, dataPagamento: e.target.checked ? f.dataPagamento : '' }))}
                style={{ accentColor: 'var(--info)', width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: form.pago ? 'var(--info)' : 'var(--text-primary)' }}>
                  {t('formProjeto.pagoTitulo')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('formProjeto.pagoAjuda')}
                </div>
              </div>
            </label>
            {form.pago && (
              <div className="form-group">
                <label className="form-label">{t('formProjeto.dataPagamentoLabel')}</label>
                <input className="input input-mono" type="date" value={form.dataPagamento}
                  onChange={e => setForm(f => ({ ...f, dataPagamento: e.target.value }))} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {t('formProjeto.dataPagamentoAjuda')}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onFechar}>{t('comum.cancelar')}</button>
          <button className="btn btn-primary" onClick={onSalvar} disabled={salvando}>
            {salvando ? t('comum.salvando') : t('comum.salvar')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── utilidade: form a partir de Projeto ──────────────────────────
export function projetoParaForm(p: Projeto): FormState {
  return {
    clienteId: p.clienteId,
    nome: p.nome,
    descricao: p.descricao ?? '',
    horasAbertas: p.horasContratadas == null,
    horasContratadas: p.horasContratadas != null ? String(p.horasContratadas) : '',
    valorHora: p.valorHora ? String(p.valorHora) : '',
    status: p.status,
    pago: p.pago ?? false,
    dataPagamento: p.dataPagamento ?? '',
    dataInicio: p.dataInicio ?? '',
    dataFim: p.dataFim ?? '',
    observacoes: p.observacoes ?? '',
  }
}

// ── utilidade: payload a partir do form ──────────────────────────
export function formParaPayload(form: FormState, paraAtualizar = false) {
  const horas = form.horasAbertas ? null : parseFloat(form.horasContratadas)
  const base = {
    clienteId: form.clienteId,
    nome: form.nome.trim(),
    descricao: form.descricao || undefined,
    valorHora: form.valorHora ? parseFloat(form.valorHora) : undefined,
    status: form.status,
    pago: form.pago,
    dataPagamento: form.dataPagamento || undefined,
    dataInicio: form.dataInicio,
    dataFim: form.dataFim || undefined,
    observacoes: form.observacoes || undefined,
  }
  if (paraAtualizar) return { ...base, horasContratadas: horas }
  return { ...base, horasContratadas: horas ?? undefined }
}

// ── tipo para ordenação ──────────────────────────────────────────
type ColOrdem = 'cliente' | 'nome' | 'status' | 'dataInicio' | 'horasContratadas' | 'horas' | 'valorHora'

function ProjetosList({ toast }: Props) {
  const { t, i18n } = useTranslation()
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [horasPorProjeto, setHorasPorProjeto] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const STATUS_PADRAO: StatusProjeto[] = [
    'Aguardando início',
    'Em desenvolvimento',
    'Com impedimento',
    'Em testes',
    'Entregue',
  ]

  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<Set<StatusProjeto>>(new Set(STATUS_PADRAO))
  const [mostrarFiltroStatus, setMostrarFiltroStatus] = useState(false)
  const [busca, setBusca] = useState('')
  const [colOrdem, setColOrdem] = useState<ColOrdem>('cliente')
  const [ordemAsc, setOrdemAsc] = useState(true)
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null)
  const [editando, setEditando] = useState<Projeto | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [confirmarExcluir, setConfirmarExcluir] = useState<Projeto | null>(null)
  const nav = useNavigate()

  async function carregar() {
    try {
      const [ps, cs, todosLancamentos] = await Promise.all([
        projetosApi.listar(), clientesApi.listar(), lancamentosApi.listarTudo(),
      ])
      setProjetos(ps)
      setClientes(cs)
      const mapa = new Map<string, number>()
      todosLancamentos.filter(l => l.horaFim).forEach(l => {
        mapa.set(l.projetoId, Math.round(((mapa.get(l.projetoId) ?? 0) + (l.totalDecimal ?? 0)) * 100) / 100)
      })
      setHorasPorProjeto(mapa)
    } catch {
      toast.error(t('projetos.erroCarregar'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function toggleOrdem(col: ColOrdem) {
    if (colOrdem === col) setOrdemAsc(a => !a)
    else { setColOrdem(col); setOrdemAsc(true) }
  }

  function Th({ col, label, width, className }: { col: ColOrdem; label: string; width?: number; className?: string }) {
    const ativo = colOrdem === col
    return (
      <th className={className} style={{ width, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        onClick={() => toggleOrdem(col)}>
        <span style={{ color: ativo ? 'var(--accent)' : undefined }}>
          {label} {ativo ? (ordemAsc ? '↑' : '↓') : '↕'}
        </span>
      </th>
    )
  }

  const nomeCliente = (id: string) => clientes.find(c => c.id === id)?.nome ?? '—'

  function abrirNovo() { setForm(EMPTY_FORM); setEditando(null); setModal('novo') }
  function abrirEditar(p: Projeto, e: React.MouseEvent) {
    e.stopPropagation()
    setForm(projetoParaForm(p))
    setEditando(p)
    setModal('editar')
  }
  function fechar() { setModal(null); setEditando(null); setForm(EMPTY_FORM) }

  async function salvar() {
    if (!form.nome.trim()) { toast.error(t('projetos.nomeObrigatorio')); return }
    if (!form.clienteId) { toast.error(t('projetos.selecioneCliente')); return }
    if (!form.dataInicio) { toast.error(t('projetos.dataInicioObrigatoria')); return }
    if (form.dataFim && form.dataFim < form.dataInicio) { toast.error(t('projetos.dataFimInvalida')); return }
    if (!form.horasAbertas && (!parseFloat(form.horasContratadas) || parseFloat(form.horasContratadas) <= 0)) {
      toast.error(t('projetos.informeHoras')); return
    }
    setSalvando(true)
    try {
      if (modal === 'novo') {
        await projetosApi.criar(formParaPayload(form) as Parameters<typeof projetosApi.criar>[0])
        toast.success(t('projetos.criado'))
      } else if (editando) {
        await projetosApi.atualizar(editando.id, formParaPayload(form, true))
        toast.success(t('projetos.atualizado'))
      }
      fechar(); carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroSalvar'))
    } finally { setSalvando(false) }
  }

  async function excluir(p: Projeto) {
    try {
      await projetosApi.excluir(p.id)
      toast.success(t('projetos.excluido'))
      setConfirmarExcluir(null); carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroExcluir'))
      setConfirmarExcluir(null)
    }
  }

  const filtrados = projetos
    .filter(p => {
      if (filtroCliente && p.clienteId !== filtroCliente) return false
      if (filtroStatus.size > 0 && !filtroStatus.has(p.status)) return false
      if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      switch (colOrdem) {
        case 'cliente':    va = nomeCliente(a.clienteId); vb = nomeCliente(b.clienteId); break
        case 'nome':       va = a.nome; vb = b.nome; break
        case 'status':     va = a.status; vb = b.status; break
        case 'dataInicio': va = a.dataInicio ?? ''; vb = b.dataInicio ?? ''; break
        case 'horasContratadas':
          // sem limite ("Aberto") ordena por último
          va = a.horasContratadas ?? Number.MAX_SAFE_INTEGER
          vb = b.horasContratadas ?? Number.MAX_SAFE_INTEGER
          break
        case 'horas':      va = horasPorProjeto.get(a.id) ?? 0; vb = horasPorProjeto.get(b.id) ?? 0; break
        case 'valorHora':  va = a.valorHora ?? 0; vb = b.valorHora ?? 0; break
      }
      const cmp = typeof va === 'number'
        ? va - (vb as number)
        : String(va).localeCompare(String(vb), 'pt-BR')
      return ordemAsc ? cmp : -cmp
    })

  return (
    <div style={{ animation: 'slideUp 0.25s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('projetos.titulo')}</h1>
          <p className="page-subtitle">{t('projetos.subtitulo', { count: projetos.length })}</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>{t('projetos.novo')}</button>
      </div>

      {/* Filtros */}
      <div style={{ marginBottom: 20 }}>
        <div className="flex-center gap-12" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
          <input className="input" placeholder={t('projetos.buscar')} value={busca}
            onChange={e => setBusca(e.target.value)} style={{ maxWidth: 240 }} />
          <select className="input" value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">{t('projetos.todosClientes')}</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>

          {/* Filtro de status — multi-seleção */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMostrarFiltroStatus(v => !v)}
              style={{ gap: 6, minWidth: 160 }}
            >
              <span>{t('projetos.filtroStatus')}</span>
              <span style={{
                background: 'var(--bg-4)', borderRadius: 10,
                padding: '1px 7px', fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: filtroStatus.size === STATUS_OPTS.length ? 'var(--text-muted)' : 'var(--accent)',
              }}>
                {filtroStatus.size === STATUS_OPTS.length ? t('projetos.filtroTodos') : `${filtroStatus.size}/${STATUS_OPTS.length}`}
              </span>
              <span style={{ fontSize: 10 }}>{mostrarFiltroStatus ? '▲' : '▼'}</span>
            </button>

            {mostrarFiltroStatus && (
              <div style={{
                position: 'absolute', top: '110%', left: 0, zIndex: 50,
                background: 'var(--bg-2)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)', padding: '8px 0', minWidth: 220,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {/* Ações rápidas */}
                <div className="flex-center gap-8" style={{ padding: '4px 12px 8px', borderBottom: '1px solid var(--border)' }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => setFiltroStatus(new Set(STATUS_OPTS))}>
                    {t('comum.todos')}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => setFiltroStatus(new Set(STATUS_PADRAO))}>
                    {t('projetos.ativos')}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => setFiltroStatus(new Set())}>
                    {t('comum.nenhum')}
                  </button>
                </div>

                {STATUS_OPTS.map(s => {
                  const { bg, color } = STATUS_COR[s]
                  const marcado = filtroStatus.has(s)
                  return (
                    <label key={s} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 12px', cursor: 'pointer',
                      background: marcado ? 'var(--bg-3)' : 'transparent',
                      transition: 'background 0.1s',
                    }}>
                      <input type="checkbox" checked={marcado}
                        onChange={() => {
                          setFiltroStatus(prev => {
                            const next = new Set(prev)
                            next.has(s) ? next.delete(s) : next.add(s)
                            return next
                          })
                        }}
                        style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                      <span className="badge" style={{ background: bg, color, fontSize: 10 }}>{t(STATUS_I18N_KEY[s])}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {/* Fecha ao clicar fora */}
            {mostrarFiltroStatus && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                onClick={() => setMostrarFiltroStatus(false)} />
            )}
          </div>

          {(filtroCliente || busca || filtroStatus.size !== STATUS_PADRAO.length ||
            [...STATUS_PADRAO].some(s => !filtroStatus.has(s)) ||
            [...filtroStatus].some(s => !STATUS_PADRAO.includes(s))) && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setBusca(''); setFiltroCliente(''); setFiltroStatus(new Set(STATUS_PADRAO))
            }}>
              {t('projetos.resetarFiltros')}
            </button>
          )}
        </div>

        {/* Tags dos status selecionados */}
        <div className="flex-center gap-6" style={{ flexWrap: 'wrap' }}>
          {STATUS_OPTS.map(s => {
            const { bg, color } = STATUS_COR[s]
            const marcado = filtroStatus.has(s)
            return (
              <button key={s}
                onClick={() => setFiltroStatus(prev => {
                  const next = new Set(prev)
                  next.has(s) ? next.delete(s) : next.add(s)
                  return next
                })}
                style={{
                  padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  background: marcado ? bg : 'var(--bg-3)',
                  color: marcado ? color : 'var(--text-muted)',
                  opacity: marcado ? 1 : 0.5,
                  transition: 'all 0.15s',
                }}>
                {t(STATUS_I18N_KEY[s])}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ height: 200 }}><div className="spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">◫</div>
            <div>{busca || filtroCliente || filtroStatus.size < STATUS_OPTS.length ? t('projetos.nenhumEncontrado') : t('projetos.nenhumCadastrado')}</div>
            {!busca && !filtroCliente && filtroStatus.size === STATUS_OPTS.length && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={abrirNovo}>{t('projetos.criarPrimeiro')}</button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <Th col="nome" label={t('projetos.colProjeto')} />
                  <Th col="cliente" label={t('comum.cliente')} width={160} className="hide-mobile" />
                  <Th col="status" label={t('comum.status')} width={160} className="hide-mobile" />
                  <Th col="dataInicio" label={t('comum.inicio')} width={90} className="hide-mobile" />
                  <Th col="horasContratadas" label={t('projetos.colHContratadas')} width={110} />
                  <Th col="horas" label={t('projetos.colHLancadas')} width={100} />
                  <Th col="valorHora" label={t('projetos.colValorHora')} width={90} className="hide-mobile" />
                  <th className="hide-mobile" style={{ width: 60 }}>{t('comum.pago')}</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id} onClick={() => nav(`/projetos/${p.id}`)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.nome}</div>
                      {p.descricao && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.descricao}</div>}
                    </td>
                    <td className="hide-mobile" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{nomeCliente(p.clienteId)}</td>
                    <td className="hide-mobile"><BadgeStatus status={p.status} /></td>
                    <td className="td-mono hide-mobile">
                      {p.dataInicio ? new Date(p.dataInicio + 'T00:00:00').toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                    </td>
                    <td className="td-mono">
                      {p.horasContratadas != null
                        ? `${p.horasContratadas.toFixed(0)}h`
                        : <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('projetos.aberto')}</span>}
                    </td>
                    <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {(horasPorProjeto.get(p.id) ?? 0).toFixed(1)}h
                    </td>
                    <td className="td-mono hide-mobile">
                      {p.valorHora ? `R$ ${p.valorHora.toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                    <td className="hide-mobile">
                      {p.pago
                        ? <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>{t('projetos.badgePago')}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex-center gap-4">
                        <button className="btn btn-ghost btn-sm btn-icon" title={t('comum.editar')} onClick={e => abrirEditar(p, e)}>✎</button>
                        <button className="btn btn-ghost btn-sm btn-icon" title={t('comum.excluir')}
                          style={{ color: 'var(--danger)' }}
                          onClick={e => { e.stopPropagation(); setConfirmarExcluir(p) }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <ProjetoForm
          form={form} setForm={setForm} clientes={clientes}
          salvando={salvando} onSalvar={salvar} onFechar={fechar}
          titulo={modal === 'novo' ? t('projetos.novoTitulo') : t('projetos.editarTitulo')}
        />
      )}

      {confirmarExcluir && (
        <div className="modal-overlay" onClick={() => setConfirmarExcluir(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">{t('projetos.excluirTitulo')}</h2></div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              <Trans i18nKey="projetos.confirmarExclusao" values={{ nome: confirmarExcluir.nome }}>
                <strong style={{ color: 'var(--text-primary)' }} />
              </Trans>
            </p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmarExcluir(null)}>{t('comum.cancelar')}</button>
              <button className="btn btn-danger" onClick={() => excluir(confirmarExcluir)}>{t('projetos.excluirTudo')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Projetos({ toast }: Props) {
  return (
    <Routes>
      <Route index element={<ProjetosList toast={toast} />} />
      <Route path=":id" element={<ProjetoDetalhe toast={toast} />} />
    </Routes>
  )
}
