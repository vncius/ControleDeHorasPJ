import { useEffect, useState, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { projetosApi, clientesApi, escoposApi, lancamentosApi } from '../services/api'
import type { ResumoProjeto, AlteracaoEscopo, LancamentoHoras, StatusEscopo, Cliente } from '../types'
import type { ToastFns } from '../App'
import ControlePonto from '../components/ControlePonto'
import TabelaLancamentos from '../components/TabelaLancamentos'
import ModalImportacao from '../components/ModalImportacao'
import { ProjetoForm, projetoParaForm, formParaPayload } from './Projetos'

interface Props { toast: ToastFns }

function progressClass(pct: number) {
  if (pct >= 100) return 'progress-danger'
  if (pct >= 80) return 'progress-warning'
  return 'progress-ok'
}

function fmtReais(v?: number) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDataBR(iso?: string) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function badgeEscopo(status: StatusEscopo) {
  const map: Record<StatusEscopo, string> = {
    Aprovada: 'badge-aprovada',
    Pendente: 'badge-pendente',
    Cancelada: 'badge-cancelado',
  }
  return <span className={`badge ${map[status]}`}>{status}</span>
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
    if (!form.titulo.trim()) { toast.error('Título obrigatório'); return }
    const horas = parseFloat(form.horasAdicionais)
    if (!horas || horas <= 0) { toast.error('Horas adicionais inválidas'); return }
    if (form.dataInicio && form.dataFim && form.dataFim < form.dataInicio) {
      toast.error('Data fim não pode ser anterior à data início'); return
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
        toast.success('Escopo atualizado!')
      } else {
        await escoposApi.criar(projetoId, payload)
        toast.success('Escopo criado!')
      }
      onSalvar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editando ? 'Editar escopo' : 'Nova alteração de escopo'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="input" placeholder="Ex: Inclusão de módulo de relatórios"
              value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição detalhada</label>
            <textarea className="input" rows={2} placeholder="Detalhe o escopo..."
              value={form.descricaoDetalhada} onChange={e => setForm(f => ({ ...f, descricaoDetalhada: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Horas adicionais *</label>
              <input className="input input-mono" type="number" placeholder="Ex: 20" min="0" step="0.5"
                value={form.horasAdicionais} onChange={e => setForm(f => ({ ...f, horasAdicionais: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusEscopo }))}>
                <option value="Pendente">Pendente</option>
                <option value="Aprovada">Aprovada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data início <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <input className="input input-mono" type="date" value={form.dataInicio}
                onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Data fim <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <input className="input input-mono" type="date" value={form.dataFim}
                onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="input" rows={2} placeholder="Observações opcionais..."
              value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar escopo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────

export default function ProjetoDetalhe({ toast }: Props) {
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
      toast.error('Erro ao carregar projeto')
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
    if (!formProjeto.nome.trim()) { toast.error('Nome é obrigatório'); return }
    if (!formProjeto.clienteId) { toast.error('Selecione um cliente'); return }
    if (!formProjeto.dataInicio) { toast.error('Data de início é obrigatória'); return }
    setSalvandoProjeto(true)
    try {
      await projetosApi.atualizar(resumo.projeto.id, formParaPayload(formProjeto, true))
      toast.success('Projeto atualizado!')
      setModalEditarProjeto(false)
      carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvandoProjeto(false)
    }
  }

  async function excluirEscopo(e: AlteracaoEscopo) {
    if (!confirm(`Excluir escopo "${e.titulo}"?`)) return
    try {
      await escoposApi.excluir(e.id)
      toast.success('Escopo excluído!')
      carregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  if (loading) return (
    <div className="loading-screen"><div className="spinner" /><span>Carregando projeto...</span></div>
  )

  if (!resumo) return (
    <div className="card">
      <div className="empty-state">
        <div>Projeto não encontrado</div>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => nav('/projetos')}>← Voltar</button>
      </div>
    </div>
  )

  const { projeto, cliente } = resumo
  const lancamentoAberto = lancamentos.find(l => !l.horaFim) ?? null
  const pct = Math.min(resumo.percentualConsumido, 100)

  // badge de status dos novos valores
  const STATUS_COR: Record<string, { bg: string; color: string }> = {
    'Aguardando início':  { bg: 'rgba(92,200,255,0.12)',  color: 'var(--info)' },
    'Em desenvolvimento': { bg: 'rgba(168,255,62,0.12)',  color: 'var(--accent)' },
    'Com impedimento':    { bg: 'rgba(255,92,122,0.12)',  color: 'var(--danger)' },
    'Em testes':          { bg: 'rgba(255,209,102,0.12)', color: 'var(--warning)' },
    'Entregue':           { bg: 'rgba(92,200,255,0.12)',  color: 'var(--info)' },
    'Finalizado':         { bg: 'rgba(92,200,255,0.12)',  color: 'var(--info)' },
    'Cancelado':          { bg: 'rgba(255,92,122,0.12)',  color: 'var(--danger)' },
  }
  const statusCor = STATUS_COR[projeto.status] ?? { bg: 'var(--bg-3)', color: 'var(--text-muted)' }

  return (
    <div style={{ animation: 'slideUp 0.25s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => nav('/projetos')}
          style={{ marginBottom: 12, color: 'var(--text-muted)' }}>
          ← Projetos
        </button>
        <div className="flex-between">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{cliente.nome}</div>
            <h1 className="page-title">{projeto.nome}</h1>
            {projeto.descricao && <p className="page-subtitle" style={{ marginTop: 4 }}>{projeto.descricao}</p>}
          </div>
          <div className="flex-center gap-8">
            <span className="badge" style={{ background: statusCor.bg, color: statusCor.color, fontSize: 11 }}>
              {projeto.status}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={abrirEditarProjeto}>✎ Editar</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setModalImportacao(true)}>↑ Importar</button>
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
        <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(168,255,62,0.2)', borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ fontSize: 16 }}>∞</span>
          <span>Projeto em horas abertas — sem limite contratado</span>
        </div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {resumo.totalTrabalhado.toFixed(1)}h trabalhadas de {resumo.totalDisponivel.toFixed(1)}h disponíveis
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: resumo.percentualConsumido >= 100 ? 'var(--danger)' : resumo.percentualConsumido >= 80 ? 'var(--warning)' : 'var(--accent)' }}>
              {resumo.percentualConsumido.toFixed(1)}%
            </span>
          </div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div className={`progress-fill ${progressClass(resumo.percentualConsumido)}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Cards métricas */}
      {resumo.horasAbertas ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 32 }}>
          <MetricCard label="Horas contratadas" value="∞ em aberto" sub="sem limite definido" />
          <MetricCard label="Trabalhadas" value={`${resumo.totalTrabalhado.toFixed(1)}h`} sub="lançamentos finalizados" destaque />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
          <MetricCard label="Contratadas" value={`${resumo.horasContratadas.toFixed(0)}h`} sub="horas base" />
          <MetricCard label="Extras aprovadas" value={`+${resumo.horasExtrasAprovadas.toFixed(1)}h`} sub="escopos aprovados" />
          <MetricCard label="Trabalhadas" value={`${resumo.totalTrabalhado.toFixed(1)}h`} sub="lançamentos finalizados" destaque />
          <MetricCard label="Saldo" value={`${resumo.saldo >= 0 ? '+' : ''}${resumo.saldo.toFixed(1)}h`} sub={resumo.saldo < 0 ? 'horas excedidas' : 'horas disponíveis'} />
        </div>
      )}

      {/* Cards financeiros */}
      {projeto.valorHora != null && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${resumo.horasAbertas ? 2 : 3}, 1fr)`, gap: 14, marginBottom: 32 }}>
          <MetricCard label="Valor/hora" value={fmtReais(projeto.valorHora)} sub="por hora" />
          {!resumo.horasAbertas && <MetricCard label="Receita prevista" value={fmtReais(resumo.valorEstimado)} sub="total disponível × valor/h" />}
          <MetricCard label="Receita executada" value={fmtReais(resumo.valorTrabalhado)} sub="horas trabalhadas × valor/h" destaque />
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
            {aba === 'lancamentos' ? `Lançamentos (${lancamentos.length})` : `Escopos (${escopos.length})`}
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
              Alterações de Escopo
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEscopoEditando(null); setModalEscopo(true) }}>
              + Nova alteração
            </button>
          </div>

          {escopos.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: '32px 24px' }}>
                <div className="empty-state-icon">⊕</div>
                <div>Nenhuma alteração de escopo</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Somente escopos aprovados somam ao total de horas</div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={() => { setEscopoEditando(null); setModalEscopo(true) }}>Adicionar primeiro escopo</button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th style={{ width: 90 }}>Início</th>
                      <th style={{ width: 90 }}>Fim</th>
                      <th style={{ width: 90 }}>Horas</th>
                      <th style={{ width: 90 }}>Status</th>
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
                        <td className="td-mono">{fmtDataBR(e.dataInicio)}</td>
                        <td className="td-mono">{fmtDataBR(e.dataFim)}</td>
                        <td className="td-mono" style={{ color: e.status === 'Aprovada' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: e.status === 'Aprovada' ? 600 : 400 }}>
                          +{e.horasAdicionais.toFixed(1)}h
                        </td>
                        <td>{badgeEscopo(e.status)}</td>
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
                        <td colSpan={3} style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total aprovado</td>
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
