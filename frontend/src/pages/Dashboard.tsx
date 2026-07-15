import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { dashboardApi, lancamentosApi } from '../services/api'
import type { DashboardData, ResumoProjeto } from '../types'
import type { ToastFns } from '../App'
import { horaAtual, calcularDecorrido, calcularDecorridoDecimal } from '../utils/tempo'
import { useAgoraTick } from '../hooks/useAgoraTick'
import { useTituloDecorrido } from '../hooks/useTituloDecorrido'
import { useFormatarData } from '../contexts/PreferenciasContext'

// Mirror de backend/src/utils/faturamento.ts::lancamentoEhFaturavel — fonte
// única da regra é o backend; esta cópia só decide em qual bucket (fat./pago)
// somar o tempo ao vivo entre um fetch e outro. O próximo fetch reconcilia.
function emAndamentoEhFaturavel(l: NonNullable<DashboardData['lancamentoEmAndamento']>): boolean {
  const p = l.projeto
  if (p.status === 'Finalizado' || p.status === 'Cancelado') return false
  if (p.pago && !p.dataPagamento) return false
  if (!p.dataPagamento) return true
  return l.data < p.dataPagamento
}

// regra única: exibido = finalizados (resumo) + decorrido do lançamento aberto
function aplicarDecorridoAoResumo(r: ResumoProjeto, decorrido: number): ResumoProjeto {
  const totalTrabalhado = Math.round((r.totalTrabalhado + decorrido) * 100) / 100
  const saldo = r.horasAbertas ? 0 : Math.round((r.totalDisponivel - totalTrabalhado) * 100) / 100
  const percentualConsumido = r.horasAbertas
    ? 0
    : r.totalDisponivel > 0 ? Math.round((totalTrabalhado / r.totalDisponivel) * 10000) / 100 : 0
  const valorTrabalhado = r.projeto.valorHora != null ? Math.round(totalTrabalhado * r.projeto.valorHora * 100) / 100 : undefined
  return { ...r, totalTrabalhado, saldo, percentualConsumido, valorTrabalhado }
}

function fmt(h: number) { return h.toFixed(1).replace('.', ',') + 'h' }
function pct(v: number) { return Math.min(v, 100) }
function progressClass(p: number) {
  if (p >= 90) return 'progress-danger'
  if (p >= 75) return 'progress-warning'
  return 'progress-ok'
}
interface Props { toast: ToastFns }

// ── Card de projeto reutilizável ─────────────────────────────────
function CardProjeto({ r, pago, onClick }: { r: ResumoProjeto; pago?: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  const { formatarData: fmtData } = useFormatarData()
  return (
    <div
      className="card"
      style={{
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        padding: '16px 20px',
        borderColor: pago ? 'rgba(92,200,255,0.2)' : 'var(--border)',
      }}
      onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.borderColor = pago ? 'rgba(92,200,255,0.4)' : 'var(--border-light)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = pago ? 'rgba(92,200,255,0.2)' : 'var(--border)')}
    >
      <div className="flex-between" style={{ marginBottom: 6 }}>
        <div>
          <div className="flex-center gap-6">
            <div style={{ fontSize: 13, fontWeight: 600 }}>{r.projeto.nome}</div>
            {r.temEscopoPendente && (
              <span className="badge badge-pendente" title={t('dashboard.escopoPendente')}>⊕</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.cliente.nome}</div>
        </div>
        {!r.horasAbertas && !pago && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: r.saldo < 0 ? 'var(--danger)' : 'var(--accent)', fontWeight: 600 }}>
              {r.saldo >= 0 ? '+' : ''}{r.saldo.toFixed(1)}h
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('dashboard.saldo')}</div>
          </div>
        )}
        {pago && (
          <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>{t('dashboard.badgePago')}</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
        {fmtData(r.projeto.dataInicio)}
        {r.projeto.dataFim ? ` → ${fmtData(r.projeto.dataFim)}` : ` → ${t('dashboard.ateEmAndamento')}`}
      </div>
      {r.horasAbertas ? (
        <div className="flex-between">
          <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t('dashboard.horasEmAberto')}</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {t('dashboard.horasTrabalhadas', { horas: r.totalTrabalhado.toFixed(1) })}
          </span>
        </div>
      ) : (
        <>
          <div className="flex-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {r.totalTrabalhado.toFixed(1)}h / {r.totalDisponivel.toFixed(1)}h
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: r.percentualConsumido >= 90 ? 'var(--danger)' : r.percentualConsumido >= 75 ? 'var(--warning)' : 'var(--text-secondary)' }}>
              {r.percentualConsumido.toFixed(0)}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill ${pago ? '' : progressClass(r.percentualConsumido)}`}
              style={{ width: `${pct(r.percentualConsumido)}%`, background: pago ? 'var(--info)' : undefined }}
            />
          </div>
        </>
      )}
      {r.emAndamento && (
        <div className="flex-center gap-4" style={{ marginTop: 8 }}>
          <div className="pulse-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>{t('comum.emAndamento')}</span>
        </div>
      )}
    </div>
  )
}

// ── Seção de projetos com filtro ─────────────────────────────────
function SecaoProjetos({
  titulo, projetos, pago, cor, nav,
}: {
  titulo: string
  projetos: ResumoProjeto[]
  pago?: boolean
  cor: string
  nav: (path: string) => void
}) {
  const { t } = useTranslation()
  const [busca, setBusca] = useState('')
  const filtrados = projetos.filter(r =>
    !busca ||
    r.projeto.nome.toLowerCase().includes(busca.toLowerCase()) ||
    r.cliente.nome.toLowerCase().includes(busca.toLowerCase())
  )
  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: cor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {titulo}
          <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 4 }}>
            {projetos.length}
          </span>
        </h2>
        <input
          className="input"
          placeholder={t('dashboard.filtrar')}
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ width: 140, padding: '5px 10px', fontSize: 12 }}
        />
      </div>
      {filtrados.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '24px' }}>
            <div>{busca ? t('dashboard.nenhumProjetoEncontrado') : t('dashboard.nenhumProjetoSecao')}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(r => (
            <CardProjeto key={r.projeto.id} r={r} pago={pago} onClick={() => nav(`/projetos/${r.projeto.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dashboard principal ──────────────────────────────────────────
export default function Dashboard({ toast }: Props) {
  const { t } = useTranslation()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [horaFim, setHoraFim] = useState('')
  const [descricaoFinal, setDescricaoFinal] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchedAtRef = useRef<number | null>(null)
  const nav = useNavigate()

  async function carregar(silencioso = false) {
    try {
      const d = await dashboardApi.obter()
      setData(d)
      fetchedAtRef.current = Date.now()
    }
    catch { if (!silencioso) toast.error(t('dashboard.erroCarregar')) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    carregar()
    intervalRef.current = setInterval(() => carregar(true), 60000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // tempo real: hooks chamados incondicionalmente, antes dos early returns
  useAgoraTick(!!data?.lancamentoEmAndamento)
  useTituloDecorrido(data?.lancamentoEmAndamento?.horaInicio, data?.lancamentoEmAndamento?.data)

  function abrirModalFinalizar() {
    if (!data?.lancamentoEmAndamento) return
    setHoraFim(horaAtual())
    setDescricaoFinal(data.lancamentoEmAndamento.descricao ?? '')
    setModalFinalizar(true)
  }

  function fecharModalFinalizar() {
    setModalFinalizar(false)
  }

  async function confirmarFinalizar() {
    if (!data?.lancamentoEmAndamento) return
    if (!horaFim) { toast.error(t('dashboard.horaFimObrigatoria')); return }
    setFinalizando(true)
    try {
      await lancamentosApi.finalizar(data.lancamentoEmAndamento.id, {
        horaFim,
        descricao: descricaoFinal || undefined,
      })
      toast.success(t('dashboard.trabalhoFinalizado'))
      setModalFinalizar(false)
      carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('dashboard.erroFinalizar'))
    } finally { setFinalizando(false) }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>{t('comum.carregando')}</span></div>
  if (!data) return null

  const emAndamento = data.lancamentoEmAndamento
  // delta desde o último fetch: os totais Hoje/Semana/Mês já vieram do backend
  // com o decorrido de então embutido, então somamos só o que passou depois
  const deltaDesdeFetch = emAndamento && fetchedAtRef.current
    ? Math.max(0, (Date.now() - fetchedAtRef.current) / 3600000)
    : 0
  const emAndamentoFat = emAndamento ? emAndamentoEhFaturavel(emAndamento) : false
  // cards de projeto não têm o aberto embutido em nenhum momento — soma o decorrido inteiro
  const decorridoAoVivo = emAndamento ? calcularDecorridoDecimal(emAndamento.horaInicio, emAndamento.data) : 0

  const horasHoje = data.horasHoje + (emAndamentoFat ? deltaDesdeFetch : 0)
  const horasSemana = data.horasSemana + (emAndamentoFat ? deltaDesdeFetch : 0)
  const horasMes = data.horasMes + (emAndamentoFat ? deltaDesdeFetch : 0)
  const horasHojePago = data.horasHojePago + (emAndamento && !emAndamentoFat ? deltaDesdeFetch : 0)
  const horasSemanaPago = data.horasSemanaPago + (emAndamento && !emAndamentoFat ? deltaDesdeFetch : 0)
  const horasMesPago = data.horasMesPago + (emAndamento && !emAndamentoFat ? deltaDesdeFetch : 0)

  function comDecorridoAoVivo(lista: ResumoProjeto[]): ResumoProjeto[] {
    if (!emAndamento) return lista
    return lista.map(r => r.projeto.id === emAndamento.projetoId ? aplicarDecorridoAoResumo(r, decorridoAoVivo) : r)
  }
  const resumosProjetos = comDecorridoAoVivo(data.resumosProjetos)
  const resumosProjetosPagos = comDecorridoAoVivo(data.resumosProjetosPagos)
  const projetosProximosLimite = comDecorridoAoVivo(data.projetosProximosLimite)

  const temProjetosPagos = resumosProjetosPagos.length > 0
  const temHorasPagas = horasHojePago > 0 || horasSemanaPago > 0 || horasMesPago > 0

  return (
    <div style={{ animation: 'slideUp 0.25s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.titulo')}</h1>
          <p className="page-subtitle">{t('dashboard.subtitulo')}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => carregar()}>{t('dashboard.atualizar')}</button>
      </div>

      {/* Lançamento em andamento */}
      {emAndamento && (
        <div style={{
          background: 'var(--accent-dim)', border: '1px solid rgba(168,255,62,0.3)',
          borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <div className="flex-center gap-12">
            <div className="pulse-dot" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{t('dashboard.trabalhoEmAndamento')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {emAndamento.projeto.nome} · {emAndamento.cliente.nome}
                &nbsp;· {t('dashboard.iniciadoAs', { hora: emAndamento.horaInicio })}
                &nbsp;·&nbsp;<span style={{ color: 'var(--accent)' }}>{t('ponto.decorrido', { tempo: calcularDecorrido(emAndamento.horaInicio, emAndamento.data) })}</span>
                {emAndamento.projeto.pago && (
                  <span style={{ marginLeft: 8, color: 'var(--info)' }}>{t('dashboard.tagPago')}</span>
                )}
              </div>
              {emAndamento.descricao && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{emAndamento.descricao}</div>
              )}
            </div>
          </div>
          <div className="flex-center gap-8">
            <button className="btn btn-secondary btn-sm" onClick={() => nav(`/projetos/${emAndamento.projetoId}`)}>{t('dashboard.verProjeto')}</button>
            <button className="btn btn-primary btn-sm" onClick={abrirModalFinalizar} disabled={finalizando}>
              {finalizando ? '...' : t('dashboard.finalizar')}
            </button>
          </div>
        </div>
      )}

      {modalFinalizar && emAndamento && (
        <div className="modal-overlay" onClick={fecharModalFinalizar}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('dashboard.finalizarTrabalho')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={fecharModalFinalizar}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
              {emAndamento.projeto.nome} · {emAndamento.cliente.nome}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('comum.horaInicio')}</label>
                  <input className="input input-mono" value={emAndamento.horaInicio} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('comum.horaFim')} *</label>
                  <input className="input input-mono" type="time" value={horaFim}
                    onChange={e => setHoraFim(e.target.value)} autoFocus />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('comum.descricao')}</label>
                <textarea className="input" rows={3}
                  placeholder={t('dashboard.oQueFoiFeito')}
                  value={descricaoFinal}
                  onChange={e => setDescricaoFinal(e.target.value)} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={fecharModalFinalizar}>{t('comum.cancelar')}</button>
              <button className="btn btn-primary" onClick={confirmarFinalizar} disabled={finalizando}>
                {finalizando ? t('comum.processando') : t('dashboard.finalizarESalvar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cards faturáveis ── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          {t('dashboard.horasFaturaveis')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: temHorasPagas ? 24 : 32 }}>
          {[
            { label: t('dashboard.hoje'), value: fmt(horasHoje), sub: emAndamentoFat ? t('dashboard.incluiTempoAberto') : t('dashboard.horasFinalizadas') },
            { label: t('dashboard.semana'), value: fmt(horasSemana), sub: t('dashboard.subFaturaveis') },
            { label: t('dashboard.mes'), value: fmt(horasMes), sub: t('dashboard.subFaturaveis') },
            { label: t('dashboard.projetos'), value: resumosProjetos.length, sub: t('dashboard.faturaveisAtivos') },
          ].map(m => (
            <div key={m.label} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '-0.02em', marginBottom: 4 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cards não faturáveis (apenas se houver) ── */}
      {(temHorasPagas || temProjetosPagos) && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {t('dashboard.horasProjetosPagos')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
            {[
              { label: t('dashboard.hoje'), value: fmt(horasHojePago), sub: t('dashboard.subProjetoPago') },
              { label: t('dashboard.semana'), value: fmt(horasSemanaPago), sub: t('dashboard.subProjetoPago') },
              { label: t('dashboard.mes'), value: fmt(horasMesPago), sub: t('dashboard.subProjetoPago') },
              { label: t('dashboard.projetos'), value: resumosProjetosPagos.length, sub: t('dashboard.pagosEmAndamento') },
            ].map(m => (
              <div key={m.label} className="card" style={{ padding: '20px 24px', borderColor: 'var(--info-bg)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--info)', letterSpacing: '-0.02em', marginBottom: 4 }}>{m.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Listas de projetos ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        {/* Faturáveis */}
        <SecaoProjetos
          titulo={t('dashboard.projetosFaturaveis')}
          projetos={resumosProjetos}
          cor="var(--text-secondary)"
          nav={nav}
        />

        {/* Direita: Alertas OU Pagos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Alertas */}
          {projetosProximosLimite.length > 0 && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('dashboard.atencaoLimite')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {projetosProximosLimite.map(r => (
                  <div
                    key={r.projeto.id}
                    className="card"
                    style={{ cursor: 'pointer', borderColor: r.percentualConsumido >= 100 ? 'rgba(255,92,122,0.4)' : 'rgba(255,209,102,0.3)', padding: '16px 20px' }}
                    onClick={() => nav(`/projetos/${r.projeto.id}`)}
                  >
                    <div className="flex-between" style={{ marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.projeto.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.cliente.nome}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: r.percentualConsumido >= 100 ? 'var(--danger)' : 'var(--warning)' }}>
                        {r.percentualConsumido.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {t('dashboard.horasDe', { trabalhado: r.totalTrabalhado.toFixed(1), disponivel: r.totalDisponivel.toFixed(1) })}
                      {r.saldo < 0 && <span style={{ color: 'var(--danger)' }}> · {t('dashboard.horasExcedidas', { horas: Math.abs(r.saldo).toFixed(1) })}</span>}
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 10 }}
                      onClick={ev => { ev.stopPropagation(); nav(`/projetos/${r.projeto.id}`, { state: { abrirEscopo: true } }) }}
                    >
                      {t('dashboard.registrarEscopo')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projetos pagos */}
          {temProjetosPagos && (
            <SecaoProjetos
              titulo={t('dashboard.pagosTitulo')}
              projetos={data.resumosProjetosPagos}
              pago
              cor="var(--info)"
              nav={nav}
            />
          )}

          {/* Estado vazio */}
          {data.projetosProximosLimite.length === 0 && !temProjetosPagos && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('dashboard.atencaoLimite')}
              </h2>
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon" style={{ fontSize: 24 }}>✓</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{t('dashboard.todosDentroLimite')}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
